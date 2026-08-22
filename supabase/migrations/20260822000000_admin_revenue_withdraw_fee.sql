-- ============================================================================
-- Migration: Admin Revenue, Platform Commission Wallet, Min Withdraw R$ 5,00, Fixed Fee R$ 1,20
-- ============================================================================

-- 1) Add fee and net_amount columns to withdrawals if not present
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS fee numeric NOT NULL DEFAULT 1.20,
  ADD COLUMN IF NOT EXISTS net_amount numeric;

UPDATE public.withdrawals
   SET fee = 1.20,
       net_amount = ROUND(amount - 1.20, 2)
 WHERE net_amount IS NULL;

-- 2) Update app_settings default minimum withdrawal to R$ 5,00 and withdrawal fee to R$ 1,20
INSERT INTO public.app_settings (key, value)
VALUES (
  'fees',
  jsonb_build_object(
    'commission', 10,
    'instant_fee', 7,
    'min_withdraw', 5.00,
    'withdraw_fee', 1.20
  )
)
ON CONFLICT (key) DO UPDATE
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(public.app_settings.value, '{}'::jsonb),
      '{min_withdraw}', '5.00'::jsonb
    ),
    '{withdraw_fee}', '1.20'::jsonb
  ),
  '{commission}', COALESCE(public.app_settings.value->'commission', '10'::jsonb)
);

-- Also update platform settings
UPDATE public.app_settings
   SET value = jsonb_set(value, '{min_withdraw}', '5.00'::jsonb)
 WHERE key = 'platform';

-- 3) Server-side validation of withdrawal amounts: min R$ 5,00, balances check
CREATE OR REPLACE FUNCTION public.validate_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  commission numeric := 10;
  gross numeric := 0;
  already numeric := 0;
  available numeric := 0;
  is_adm boolean := false;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount < 5 THEN
    RAISE EXCEPTION 'O valor mínimo de saque é R$ 5,00';
  END IF;

  IF COALESCE(TRIM(NEW.pix_key), '') = '' THEN
    RAISE EXCEPTION 'Cadastre uma chave Pix antes de solicitar saque';
  END IF;

  -- Ensure fixed fee of R$ 1.20 is recorded
  IF NEW.fee IS NULL OR NEW.fee = 0 THEN
    NEW.fee := 1.20;
  END IF;
  NEW.net_amount := ROUND(NEW.amount - NEW.fee, 2);
  IF NEW.net_amount <= 0 THEN
    RAISE EXCEPTION 'O valor do saque deve ser superior à taxa de R$ 1,20';
  END IF;

  SELECT COALESCE((value->>'commission')::numeric, 10) INTO commission
  FROM public.app_settings WHERE key = 'fees';
  commission := COALESCE(commission, 10);

  is_adm := public.has_role(NEW.user_id, 'admin'::app_role);

  IF is_adm AND NEW.method = 'admin_fee' THEN
    -- Admin withdrawing platform commission revenue
    SELECT COALESCE(SUM(amount), 0) INTO gross
    FROM public.purchases
    WHERE status IN ('paid', 'delivered');

    SELECT COALESCE(SUM(amount), 0) INTO already
    FROM public.withdrawals
    WHERE method = 'admin_fee' AND status IN ('pending', 'approved') AND id <> COALESCE(NEW.id, -1);

    available := (gross * commission / 100) - already;

    IF NEW.amount > available THEN
      RAISE EXCEPTION 'Saldo de taxas do admin insuficiente. Disponível: R$ %', ROUND(available, 2);
    END IF;
  ELSE
    -- Regular seller withdrawal
    SELECT COALESCE(SUM(amount), 0) INTO gross
    FROM public.purchases
    WHERE seller_id = NEW.user_id AND status = 'delivered';

    SELECT COALESCE(SUM(amount), 0) INTO already
    FROM public.withdrawals
    WHERE user_id = NEW.user_id
      AND status IN ('pending', 'approved')
      AND method <> 'admin_fee'
      AND id <> COALESCE(NEW.id, -1);

    available := (gross * (100 - commission) / 100) - already;

    IF NEW.amount > available THEN
      RAISE EXCEPTION 'Saldo insuficiente. Disponível para saque: R$ %', ROUND(available, 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_withdrawal_trg ON public.withdrawals;
CREATE TRIGGER validate_withdrawal_trg
BEFORE INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal();

-- 4) Available balance calculation helper
CREATE OR REPLACE FUNCTION public.withdrawable_balance(_user_id uuid, _exclude_id bigint DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  commission numeric := 10;
  gross numeric := 0;
  already numeric := 0;
BEGIN
  SELECT COALESCE((value->>'commission')::numeric, 10) INTO commission
  FROM public.app_settings WHERE key = 'fees';
  commission := COALESCE(commission, 10);

  SELECT COALESCE(SUM(amount), 0) INTO gross
  FROM public.purchases
  WHERE seller_id = _user_id AND status = 'delivered';

  SELECT COALESCE(SUM(amount), 0) INTO already
  FROM public.withdrawals
  WHERE user_id = _user_id
    AND status IN ('pending', 'approved')
    AND method <> 'admin_fee'
    AND (_exclude_id IS NULL OR id <> _exclude_id);

  RETURN ROUND((gross * (100 - commission) / 100) - already, 2);
END;
$$;

REVOKE ALL ON FUNCTION public.withdrawable_balance(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdrawable_balance(uuid, bigint) TO authenticated, service_role;

-- 5) Request withdrawal supporting Pix key override and admin fee method
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _amount numeric,
  _method text DEFAULT 'normal',
  _idempotency_key text DEFAULT NULL,
  _retry_of bigint DEFAULT NULL,
  _pix_key text DEFAULT NULL
)
RETURNS public.withdrawals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.withdrawals;
  prof public.profiles;
  key text := COALESCE(NULLIF(TRIM(_idempotency_key), ''), gen_random_uuid()::text);
  prev public.withdrawals;
  chosen_pix text;
  req_amount numeric := ROUND(_amount, 2);
  fixed_fee numeric := 1.20;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO w FROM public.withdrawals WHERE idempotency_key = key;
  IF w IS NOT NULL THEN
    IF w.user_id <> auth.uid() THEN RAISE EXCEPTION 'Chave de idempotência inválida'; END IF;
    RETURN w; -- idempotent replay
  END IF;

  SELECT * INTO prof FROM public.profiles WHERE user_id = auth.uid();
  IF prof IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  -- Admin fee method only requires admin role, not seller KYC
  IF _method = 'admin_fee' THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Apenas administradores podem sacar taxas da plataforma';
    END IF;
  ELSE
    IF NOT prof.is_verified_seller THEN
      RAISE EXCEPTION 'Conclua a verificação de identidade antes de sacar';
    END IF;
  END IF;

  IF _retry_of IS NOT NULL THEN
    SELECT * INTO prev FROM public.withdrawals WHERE id = _retry_of FOR UPDATE;
    IF prev IS NULL OR prev.user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Saque original não encontrado';
    END IF;
    IF prev.status <> 'rejected' THEN
      RAISE EXCEPTION 'Só é possível reenviar um saque recusado';
    END IF;
  END IF;

  chosen_pix := COALESCE(NULLIF(TRIM(_pix_key), ''), prof.pix_key, '');
  IF chosen_pix = '' THEN
    RAISE EXCEPTION 'Cadastre uma chave Pix no perfil antes de solicitar saque';
  END IF;

  INSERT INTO public.withdrawals (
    user_id, user_public_id, user_email, amount, fee, net_amount, method, pix_key, idempotency_key, retry_of
  )
  VALUES (
    auth.uid(), prof.public_id::text, prof.email, req_amount, fixed_fee, ROUND(req_amount - fixed_fee, 2),
    COALESCE(_method, 'normal'), chosen_pix, key, _retry_of
  )
  RETURNING * INTO w;

  INSERT INTO public.withdrawal_events (withdrawal_id, event_type, actor_id, note)
  VALUES (w.id, CASE WHEN _retry_of IS NULL THEN 'requested' ELSE 'resubmitted' END, auth.uid(), '');

  RETURN w;
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal(numeric, text, text, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, bigint, text) TO authenticated, service_role;
