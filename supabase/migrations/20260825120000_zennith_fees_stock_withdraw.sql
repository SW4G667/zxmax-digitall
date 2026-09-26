-- ==============================================================================
-- ZXMAX · 2026-08-25 · ZennithPay + taxa do comprador + saque + estoque
--
-- Idempotente e aditivo. Reaplica o mínimo de R$ 2,00 (o trigger antigo de
-- R$ 5,00 ainda rejeitava anúncios válidos em produção).
-- ==============================================================================

-- 1) Preço mínimo R$ 2,00 (trigger + constraint)
CREATE OR REPLACE FUNCTION public.validate_product_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.price IS NULL OR NEW.price <> NEW.price THEN
    RAISE EXCEPTION 'Preço inválido' USING ERRCODE = '22P02';
  END IF;
  IF NEW.price < 2 THEN
    RAISE EXCEPTION 'O preço mínimo de um anúncio é R$ 2,00' USING ERRCODE = '23514';
  END IF;
  IF NEW.price > 1000000 THEN
    RAISE EXCEPTION 'O preço máximo de um anúncio é R$ 1.000.000,00' USING ERRCODE = '23514';
  END IF;
  NEW.price := round(NEW.price, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_product_price_trg ON public.products;
CREATE TRIGGER validate_product_price_trg
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_price();

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_minimum_price;
ALTER TABLE public.products ADD CONSTRAINT products_minimum_price CHECK (price >= 2) NOT VALID;

-- 2) Colunas de estoque + grants (para o "/" vazio na vitrine Robux)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_quantity integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS delivery_time text;

GRANT SELECT (stock, min_quantity, delivery_time) ON public.products TO anon, authenticated;
GRANT INSERT (stock, min_quantity, delivery_time) ON public.products TO authenticated;
GRANT UPDATE (stock, min_quantity, delivery_time) ON public.products TO authenticated;

-- 3) Pedido guarda o que o vendedor recebe e o que o cliente paga
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS product_amount numeric;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS buyer_fee numeric NOT NULL DEFAULT 0.90;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS quantity numeric;

UPDATE public.purchases
   SET buyer_fee = COALESCE(buyer_fee, 0.90),
       product_amount = COALESCE(product_amount, ROUND(GREATEST(amount - 0.90, 0), 2))
 WHERE product_amount IS NULL;

GRANT SELECT (product_amount, buyer_fee, quantity) ON public.purchases TO authenticated;

-- 4) Taxas oficiais da plataforma
INSERT INTO public.app_settings (key, value)
VALUES (
  'fees',
  jsonb_build_object(
    'commission', 0,
    'buyer_fee', 0.90,
    'min_withdraw', 10.00,
    'withdraw_fee', 3.50
  )
)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(public.app_settings.value, '{}'::jsonb)
  || jsonb_build_object(
    'buyer_fee', 0.90,
    'min_withdraw', 10.00,
    'withdraw_fee', 3.50
  );

-- 5) Saque: mínimo R$ 10,00 e taxa R$ 3,50
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS fee numeric NOT NULL DEFAULT 3.50,
  ADD COLUMN IF NOT EXISTS net_amount numeric;

CREATE OR REPLACE FUNCTION public.validate_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  gross numeric := 0;
  already numeric := 0;
  available numeric := 0;
  is_adm boolean := false;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount < 10 THEN
    RAISE EXCEPTION 'O valor mínimo de saque é R$ 10,00';
  END IF;

  IF COALESCE(TRIM(NEW.pix_key), '') = '' THEN
    RAISE EXCEPTION 'Cadastre uma chave Pix antes de solicitar saque';
  END IF;

  IF NEW.fee IS NULL OR NEW.fee = 0 THEN
    NEW.fee := 3.50;
  END IF;
  NEW.net_amount := ROUND(NEW.amount - NEW.fee, 2);
  IF NEW.net_amount <= 0 THEN
    RAISE EXCEPTION 'O valor do saque deve ser superior à taxa de R$ 3,50';
  END IF;

  is_adm := public.has_role(NEW.user_id, 'admin'::app_role);

  IF is_adm AND NEW.method = 'admin_fee' THEN
    SELECT COALESCE(SUM(COALESCE(buyer_fee, 0.90)), 0) INTO gross
    FROM public.purchases
    WHERE status IN ('paid', 'delivered', 'delivered_pending_confirmation');

    SELECT COALESCE(SUM(amount), 0) INTO already
    FROM public.withdrawals
    WHERE method = 'admin_fee' AND status IN ('pending', 'approved') AND id <> COALESCE(NEW.id, -1);

    available := gross - already;
    IF NEW.amount > available THEN
      RAISE EXCEPTION 'Saldo de taxas do admin insuficiente. Disponível: R$ %', ROUND(available, 2);
    END IF;
  ELSE
    SELECT COALESCE(SUM(COALESCE(product_amount, GREATEST(amount - COALESCE(buyer_fee, 0.90), 0))), 0)
      INTO gross
    FROM public.purchases
    WHERE seller_id = NEW.user_id
      AND status IN ('delivered', 'delivered_pending_confirmation');

    SELECT COALESCE(SUM(amount), 0) INTO already
    FROM public.withdrawals
    WHERE user_id = NEW.user_id
      AND status IN ('pending', 'approved')
      AND method <> 'admin_fee'
      AND id <> COALESCE(NEW.id, -1);

    available := gross - already;
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

CREATE OR REPLACE FUNCTION public.withdrawable_balance(_user_id uuid, _exclude_id bigint DEFAULT NULL)
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
  SELECT COALESCE(SUM(COALESCE(product_amount, GREATEST(amount - COALESCE(buyer_fee, 0.90), 0))), 0)
    INTO gross
  FROM public.purchases
  WHERE seller_id = _user_id
    AND status IN ('delivered', 'delivered_pending_confirmation');

  SELECT COALESCE(SUM(amount), 0) INTO already
  FROM public.withdrawals
  WHERE user_id = _user_id
    AND status IN ('pending', 'approved')
    AND method <> 'admin_fee'
    AND (_exclude_id IS NULL OR id <> _exclude_id);

  RETURN ROUND(gross - already, 2);
END;
$$;

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
  fixed_fee numeric := 3.50;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO w FROM public.withdrawals WHERE idempotency_key = key;
  IF w IS NOT NULL THEN
    IF w.user_id <> auth.uid() THEN RAISE EXCEPTION 'Chave de idempotência inválida'; END IF;
    RETURN w;
  END IF;

  SELECT * INTO prof FROM public.profiles WHERE user_id = auth.uid();
  IF prof IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  IF _method = 'admin_fee' THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Apenas administradores podem sacar taxas da plataforma';
    END IF;
  ELSE
    IF NOT prof.is_verified_seller THEN
      RAISE EXCEPTION 'Conclua a verificação de identidade antes de sacar';
    END IF;
  END IF;

  IF req_amount < 10 THEN
    RAISE EXCEPTION 'O valor mínimo de saque é R$ 10,00';
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

  BEGIN
    INSERT INTO public.withdrawal_events (withdrawal_id, event_type, actor_id, note)
    VALUES (w.id, CASE WHEN _retry_of IS NULL THEN 'requested' ELSE 'resubmitted' END, auth.uid(), '');
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN w;
END;
$$;

-- 6) Ao confirmar pagamento, baixa o estoque quando ele existe
CREATE OR REPLACE FUNCTION public.apply_verified_payment(
  _provider text,
  _event_key text,
  _event_type text,
  _purchase_id bigint,
  _charge_id text,
  _confirmed_amount numeric,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(applied boolean, resulting_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purchase_row public.purchases%ROWTYPE;
  product_row public.products%ROWTYPE;
  delivery_text text;
  next_status text := 'paid';
  next_messages jsonb;
  qty numeric := 1;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'server_only';
  END IF;

  INSERT INTO public.payment_events(provider, event_key, event_type, purchase_id, charge_id, payload)
  VALUES (_provider, _event_key, _event_type, _purchase_id, _charge_id, COALESCE(_payload, '{}'::jsonb))
  ON CONFLICT (provider, event_key) DO NOTHING;

  IF NOT FOUND THEN
    SELECT p.status INTO resulting_status FROM public.purchases p WHERE p.id = _purchase_id;
    applied := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO purchase_row FROM public.purchases WHERE id = _purchase_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase_not_found'; END IF;
  IF purchase_row.status <> 'pending' THEN
    resulting_status := purchase_row.status;
    applied := false;
    RETURN NEXT;
    RETURN;
  END IF;
  IF purchase_row.evopay_charge_id IS DISTINCT FROM _charge_id THEN RAISE EXCEPTION 'charge_mismatch'; END IF;
  IF purchase_row.amount IS DISTINCT FROM _confirmed_amount THEN RAISE EXCEPTION 'amount_mismatch'; END IF;

  SELECT * INTO product_row FROM public.products WHERE id = purchase_row.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;
  next_messages := COALESCE(purchase_row.messages, '[]'::jsonb);
  qty := COALESCE(purchase_row.quantity, 1);

  IF product_row.delivery_type = 'auto' THEN
    SELECT delivery_content INTO delivery_text FROM public.product_delivery WHERE product_id = purchase_row.product_id;
    IF COALESCE(delivery_text, '') <> '' THEN
      next_status := 'delivered';
      next_messages := next_messages || jsonb_build_array(jsonb_build_object(
        'from', 'System',
        'text', '📦 ENTREGA_AUTO: ' || delivery_text,
        'date', now()
      ));
    END IF;
  END IF;

  UPDATE public.purchases
  SET status = next_status, messages = next_messages, updated_at = now()
  WHERE id = _purchase_id;
  UPDATE public.products
     SET sales = COALESCE(sales, 0) + 1,
         stock = CASE
           WHEN stock IS NULL THEN NULL
           ELSE GREATEST(stock - GREATEST(qty, 1), 0)
         END
   WHERE id = purchase_row.product_id;

  applied := true;
  resulting_status := next_status;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_verified_payment(text,text,text,bigint,text,numeric,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_payment(text,text,text,bigint,text,numeric,jsonb) TO service_role;
