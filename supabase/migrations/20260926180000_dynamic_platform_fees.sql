-- V6: centraliza taxas e regras de saque no servidor.
-- Mantém wrappers compatíveis para clientes antigos durante a publicação gradual.

INSERT INTO public.app_settings(key, value)
VALUES (
  'platform',
  jsonb_build_object(
    'maintenance', false,
    'maintenance_message', '',
    'min_product_price', 2.00,
    'min_withdraw', 5.00,
    'buyer_fee', 0.90,
    'withdraw_fee', 3.50
  )
)
ON CONFLICT (key) DO UPDATE
SET value =
  COALESCE(public.app_settings.value, '{}'::jsonb)
  || CASE WHEN NOT COALESCE(public.app_settings.value, '{}'::jsonb) ? 'buyer_fee'
          THEN jsonb_build_object('buyer_fee', 0.90) ELSE '{}'::jsonb END
  || CASE WHEN NOT COALESCE(public.app_settings.value, '{}'::jsonb) ? 'withdraw_fee'
          THEN jsonb_build_object('withdraw_fee', 3.50) ELSE '{}'::jsonb END;

CREATE OR REPLACE FUNCTION public.get_public_platform_fees()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings jsonb := '{}'::jsonb;
BEGIN
  SELECT value INTO settings FROM public.app_settings WHERE key = 'platform';
  RETURN jsonb_build_object(
    'buyerFee', COALESCE((settings->>'buyer_fee')::numeric, 0.90),
    'minWithdraw', COALESCE((settings->>'min_withdraw')::numeric, 5.00),
    'withdrawFee', COALESCE((settings->>'withdraw_fee')::numeric, 3.50),
    'minProductPrice', COALESCE((settings->>'min_product_price')::numeric, 2.00)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_platform_fees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_platform_fees() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_platform_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
  SELECT value INTO settings FROM public.app_settings WHERE key = 'platform';
  RETURN jsonb_build_object(
    'maintenance', COALESCE((settings->>'maintenance')::boolean, false),
    'message', LEFT(COALESCE(settings->>'maintenance_message', ''), 300),
    'minProductPrice', COALESCE((settings->>'min_product_price')::numeric, 2.00),
    'minWithdraw', COALESCE((settings->>'min_withdraw')::numeric, 5.00),
    'buyerFee', COALESCE((settings->>'buyer_fee')::numeric, 0.90),
    'withdrawFee', COALESCE((settings->>'withdraw_fee')::numeric, 3.50)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_platform_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_settings() TO authenticated;

DROP FUNCTION IF EXISTS public.update_platform_settings(boolean, text, numeric, numeric, numeric, numeric);

CREATE FUNCTION public.update_platform_settings(
  _maintenance boolean,
  _message text,
  _min_product_price numeric,
  _min_withdraw numeric,
  _buyer_fee numeric,
  _withdraw_fee numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing jsonb := '{}'::jsonb;
  next_settings jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
  IF _message IS NULL OR char_length(btrim(_message)) > 300 THEN
    RAISE EXCEPTION 'A mensagem de manutenção deve ter até 300 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF _min_product_price IS NULL OR _min_product_price < 2 OR _min_product_price > 1000000 THEN
    RAISE EXCEPTION 'O preço mínimo deve ficar entre R$ 2,00 e R$ 1.000.000,00.' USING ERRCODE = '22023';
  END IF;
  IF _min_withdraw IS NULL OR _min_withdraw < 1 OR _min_withdraw > 1000000 THEN
    RAISE EXCEPTION 'O saque mínimo deve ficar entre R$ 1,00 e R$ 1.000.000,00.' USING ERRCODE = '22023';
  END IF;
  IF _buyer_fee IS NULL OR _buyer_fee < 0 OR _buyer_fee > 1000 THEN
    RAISE EXCEPTION 'A taxa do comprador deve ficar entre R$ 0,00 e R$ 1.000,00.' USING ERRCODE = '22023';
  END IF;
  IF _withdraw_fee IS NULL OR _withdraw_fee < 0 OR _withdraw_fee >= _min_withdraw THEN
    RAISE EXCEPTION 'A taxa de saque deve ser menor que o saque mínimo.' USING ERRCODE = '22023';
  END IF;

  SELECT value INTO existing FROM public.app_settings WHERE key = 'platform';
  next_settings := COALESCE(existing, '{}'::jsonb) || jsonb_build_object(
    'maintenance', _maintenance,
    'maintenance_message', btrim(_message),
    'min_product_price', round(_min_product_price, 2),
    'min_withdraw', round(_min_withdraw, 2),
    'buyer_fee', round(_buyer_fee, 2),
    'withdraw_fee', round(_withdraw_fee, 2)
  );

  INSERT INTO public.app_settings(key, value)
  VALUES ('platform', next_settings)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, metadata)
  VALUES (
    auth.uid(),
    'platform.settings_updated',
    'app_settings',
    'platform',
    jsonb_build_object(
      'maintenance', _maintenance,
      'min_product_price', round(_min_product_price, 2),
      'min_withdraw', round(_min_withdraw, 2),
      'buyer_fee', round(_buyer_fee, 2),
      'withdraw_fee', round(_withdraw_fee, 2)
    )
  );

  RETURN public.get_admin_platform_settings();
END;
$$;

REVOKE ALL ON FUNCTION public.update_platform_settings(boolean, text, numeric, numeric, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_settings(boolean, text, numeric, numeric, numeric, numeric) TO authenticated;

-- Compatibilidade com o frontend antigo durante o rollout.
CREATE OR REPLACE FUNCTION public.update_platform_settings(
  _maintenance boolean,
  _message text,
  _min_product_price numeric,
  _min_withdraw numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings jsonb := '{}'::jsonb;
BEGIN
  SELECT value INTO settings FROM public.app_settings WHERE key = 'platform';
  RETURN public.update_platform_settings(
    _maintenance,
    _message,
    _min_product_price,
    _min_withdraw,
    COALESCE((settings->>'buyer_fee')::numeric, 0.90),
    COALESCE((settings->>'withdraw_fee')::numeric, 3.50)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_platform_settings(boolean, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_settings(boolean, text, numeric, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.withdrawable_balance(_user_id uuid, _exclude_id bigint DEFAULT NULL::bigint)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gross numeric := 0;
  already numeric := 0;
BEGIN
  SELECT COALESCE(SUM(COALESCE(product_amount, GREATEST(amount - COALESCE(buyer_fee, 0), 0))), 0)
    INTO gross
  FROM public.purchases
  WHERE seller_id = _user_id
    AND status = 'delivered';

  SELECT COALESCE(SUM(amount), 0)
    INTO already
  FROM public.withdrawals
  WHERE user_id = _user_id
    AND status IN ('pending', 'approved')
    AND method <> 'admin_fee'
    AND (_exclude_id IS NULL OR id <> _exclude_id);

  RETURN GREATEST(0, ROUND(gross - already, 2));
END;
$$;

REVOKE ALL ON FUNCTION public.withdrawable_balance(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdrawable_balance(uuid, bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _amount numeric,
  _method text DEFAULT 'normal'::text,
  _idempotency_key text DEFAULT NULL::text,
  _retry_of bigint DEFAULT NULL::bigint,
  _pix_key text DEFAULT NULL::text
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
  settings jsonb := '{}'::jsonb;
  min_required numeric := 5.00;
  fixed_fee numeric := 3.50;
  available_balance numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT value INTO settings FROM public.app_settings WHERE key = 'platform';
  min_required := COALESCE((settings->>'min_withdraw')::numeric, 5.00);
  fixed_fee := COALESCE((settings->>'withdraw_fee')::numeric, 3.50);

  IF req_amount IS NULL OR req_amount < min_required THEN
    RAISE EXCEPTION 'O valor mínimo de saque é R$ %', to_char(min_required, 'FM999999990D00');
  END IF;
  IF fixed_fee < 0 OR req_amount <= fixed_fee THEN
    RAISE EXCEPTION 'O valor do saque precisa ser maior que a taxa configurada';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));

  SELECT * INTO w FROM public.withdrawals WHERE idempotency_key = key;
  IF w IS NOT NULL THEN
    IF w.user_id <> auth.uid() THEN RAISE EXCEPTION 'Chave de idempotência inválida'; END IF;
    RETURN w;
  END IF;

  SELECT * INTO prof FROM public.profiles WHERE user_id = auth.uid();
  IF prof IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  IF _method = 'admin_fee' THEN
    IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Apenas administradores podem sacar taxas da plataforma';
    END IF;
  ELSE
    IF NOT prof.is_verified_seller THEN
      RAISE EXCEPTION 'Conclua a verificação de identidade antes de sacar';
    END IF;
    available_balance := public.withdrawable_balance(auth.uid(), NULL);
    IF req_amount > available_balance THEN
      RAISE EXCEPTION 'Saldo disponível insuficiente para este saque';
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
    user_id, user_public_id, user_email, amount, fee, net_amount,
    method, pix_key, idempotency_key, retry_of
  ) VALUES (
    auth.uid(), prof.public_id::text, prof.email, req_amount,
    ROUND(fixed_fee, 2), ROUND(req_amount - fixed_fee, 2),
    COALESCE(_method, 'normal'), chosen_pix, key, _retry_of
  )
  RETURNING * INTO w;

  INSERT INTO public.withdrawal_events(withdrawal_id, event_type, actor_id, note)
  VALUES (
    w.id,
    CASE WHEN _retry_of IS NULL THEN 'requested' ELSE 'resubmitted' END,
    auth.uid(),
    ''
  );

  RETURN w;
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal(numeric, text, text, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, bigint, text) TO authenticated;

-- Wrapper seguro para versões antigas do cliente.
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _amount numeric,
  _method text DEFAULT 'normal'::text,
  _idempotency_key text DEFAULT NULL::text,
  _retry_of bigint DEFAULT NULL::bigint
)
RETURNS public.withdrawals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.request_withdrawal(_amount, _method, _idempotency_key, _retry_of, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal(numeric, text, text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, bigint) TO authenticated;
