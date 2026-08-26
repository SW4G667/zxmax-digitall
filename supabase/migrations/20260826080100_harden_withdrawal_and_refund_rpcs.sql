-- Financial RPCs must not be callable through legacy overloads or disclose a
-- seller's balance. The active withdrawal path serializes per seller and
-- checks the amount against server-side released earnings.

REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.withdrawable_balance(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seller_refund_order(bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_auto_release_orders() FROM PUBLIC, anon, authenticated;

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
  fixed_fee numeric := 3.50;
  available_balance numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF req_amount IS NULL OR req_amount < 10 THEN
    RAISE EXCEPTION 'O valor mínimo de saque é R$ 10,00';
  END IF;

  -- A second concurrent request from the same seller must wait, otherwise both
  -- could observe the same available balance before either row is inserted.
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
    SELECT COALESCE(SUM(COALESCE(product_amount, GREATEST(amount - COALESCE(buyer_fee, 0.90), 0))), 0)
      INTO available_balance
      FROM public.purchases
     WHERE seller_id = auth.uid()
       AND status = 'delivered';
    available_balance := available_balance - COALESCE((
      SELECT SUM(amount)
      FROM public.withdrawals
      WHERE user_id = auth.uid()
        AND status IN ('pending', 'approved')
        AND method <> 'admin_fee'
    ), 0);
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
    user_id, user_public_id, user_email, amount, fee, net_amount, method, pix_key, idempotency_key, retry_of
  ) VALUES (
    auth.uid(), prof.public_id::text, prof.email, req_amount, fixed_fee, ROUND(req_amount - fixed_fee, 2),
    COALESCE(_method, 'normal'), chosen_pix, key, _retry_of
  ) RETURNING * INTO w;

  INSERT INTO public.withdrawal_events (withdrawal_id, event_type, actor_id, note)
  VALUES (w.id, CASE WHEN _retry_of IS NULL THEN 'requested' ELSE 'resubmitted' END, auth.uid(), '');

  RETURN w;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, bigint, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_auto_release_orders() TO service_role;
