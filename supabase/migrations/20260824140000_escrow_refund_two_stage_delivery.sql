-- ============================================================================
-- ZXMAX · Migration: Escrow, Reembolso pelo Vendedor e Entrega em Duas Etapas
-- ============================================================================

-- 1) Adicionar colunas de controle de entrega, reembolso e liberação de saldo
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS delivered_pending_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_released boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

-- Conceder SELECT para as novas colunas
GRANT SELECT (delivered_pending_at, refund_reason, refunded_at, seller_released, released_at) ON public.purchases TO authenticated;

-- 2) Função para verificar contatos externos em textos (WhatsApp, Discord, e-mail, telefone, links)
CREATE OR REPLACE FUNCTION public.contains_external_contact(_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  clean_text text := LOWER(COALESCE(_text, ''));
BEGIN
  IF clean_text = '' THEN RETURN false; END IF;

  -- Regex para whatsapp, discord, email, telefone, telegram, instagram, e-mail, links http
  IF clean_text ~* '(whats|zap|wpp|whasapp|vatsapp|discord|disc|\.gg/|telegram|t\.me|insta|instagram|email|e-mail|gmail|hotmail|yahoo|outlook|telefone|celular|fone)' THEN
    RETURN true;
  END IF;

  -- Regex para e-mail
  IF clean_text ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' THEN
    RETURN true;
  END IF;

  -- Regex para links/URLs
  IF clean_text ~* '(https?://|www\.|[a-z0-9-]+\.(com|br|net|org|io|me|gg))' THEN
    RETURN true;
  END IF;

  -- Regex para números de telefone/celular (8+ dígitos consecutivos ou formatados)
  IF clean_text ~* '(\+?55\s*)?(\(?\d{2}\)?\s*)?\d{4,5}[-\s.]?\d{4}' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.contains_external_contact(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contains_external_contact(text) TO authenticated, service_role;

-- 3) RPC: Vendedor confirma entrega -> status = 'delivered_pending_confirmation'
CREATE OR REPLACE FUNCTION public.mark_order_delivered(_order_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.purchases;
  now_ts timestamptz := now();
  auto_release_ts timestamptz := now_ts + interval '3 days';
  auto_release_str text;
  next_messages jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Faça login novamente.';
  END IF;

  SELECT * INTO p FROM public.purchases WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF p.seller_id <> auth.uid() THEN
    RAISE EXCEPTION 'Apenas o vendedor pode marcar a entrega do pedido.';
  END IF;

  IF p.status <> 'paid' THEN
    RAISE EXCEPTION 'O pedido só pode ser marcado como entregue quando estiver em status pago.';
  END IF;

  auto_release_str := to_char(auto_release_ts AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:mi');
  next_messages := COALESCE(p.messages, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'from', 'System',
    'text', '📦 O vendedor marcou o pedido como entregue! Aguardando confirmação de recebimento pelo comprador. Liberação automática para o vendedor em ' || auto_release_str || '.',
    'date', now_ts
  ));

  UPDATE public.purchases
  SET status = 'delivered_pending_confirmation',
      delivered_pending_at = now_ts,
      messages = next_messages,
      updated_at = now_ts
  WHERE id = _order_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'delivered_pending_confirmation',
    'delivered_pending_at', now_ts,
    'auto_release_at', auto_release_ts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_order_delivered(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_order_delivered(bigint) TO authenticated, service_role;

-- 4) RPC: Comprador confirma recebimento -> status = 'delivered' (liberação imediata)
CREATE OR REPLACE FUNCTION public.confirm_order_receipt(_order_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.purchases;
  now_ts timestamptz := now();
  next_messages jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Faça login novamente.';
  END IF;

  SELECT * INTO p FROM public.purchases WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF p.buyer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Apenas o comprador pode confirmar o recebimento do pedido.';
  END IF;

  IF p.status NOT IN ('paid', 'delivered_pending_confirmation') THEN
    RAISE EXCEPTION 'Status do pedido não permite confirmação de recebimento.';
  END IF;

  next_messages := COALESCE(p.messages, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'from', 'System',
    'text', '✅ Comprador confirmou o recebimento do produto. Dinheiro liberado para o vendedor!',
    'date', now_ts
  ));

  UPDATE public.purchases
  SET status = 'delivered',
      seller_released = true,
      released_at = now_ts,
      messages = next_messages,
      updated_at = now_ts
  WHERE id = _order_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'delivered',
    'released_at', now_ts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order_receipt(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_order_receipt(bigint) TO authenticated, service_role;

-- 5) RPC: Vendedor realiza reembolso -> status = 'refunded'
CREATE OR REPLACE FUNCTION public.seller_refund_order(_order_id bigint, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.purchases;
  clean_reason text := TRIM(COALESCE(_reason, ''));
  now_ts timestamptz := now();
  next_messages jsonb;
  formatted_amount text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Faça login novamente.';
  END IF;

  IF length(clean_reason) < 10 THEN
    RAISE EXCEPTION 'O motivo do reembolso deve ter pelo menos 10 caracteres.';
  END IF;

  IF public.contains_external_contact(clean_reason) THEN
    RAISE EXCEPTION 'Não é permitido enviar contatos externos (WhatsApp, Discord, e-mail, links ou telefone).';
  END IF;

  SELECT * INTO p FROM public.purchases WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF p.seller_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas o vendedor do pedido ou um administrador pode realizar o reembolso.';
  END IF;

  IF p.status IN ('refunded', 'cancelled') THEN
    RAISE EXCEPTION 'Este pedido já foi reembolsado ou cancelado.';
  END IF;

  IF p.status = 'pending' THEN
    RAISE EXCEPTION 'Não é possível reembolsar um pedido que ainda não foi pago.';
  END IF;

  formatted_amount := 'R$ ' || REPLACE(ROUND(p.amount, 2)::text, '.', ',');

  next_messages := COALESCE(p.messages, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'from', 'System',
    'text', '💸 REEMBOLSO REALIZADO PELO VENDEDOR' || char(10) ||
            'Valor: ' || formatted_amount || char(10) ||
            'Motivo: ' || clean_reason || char(10) ||
            'Prazo de crédito: até 1–2 dias úteis, prazo do banco emissor do comprador.',
    'date', now_ts
  ));

  UPDATE public.purchases
  SET status = 'refunded',
      refund_reason = clean_reason,
      refunded_at = now_ts,
      messages = next_messages,
      updated_at = now_ts
  WHERE id = _order_id;

  -- Trilha em admin_audit_log
  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, reason, metadata)
  VALUES (
    auth.uid(),
    'order.refunded',
    'purchases',
    _order_id::text,
    clean_reason,
    jsonb_build_object('amount', p.amount, 'buyer_id', p.buyer_id, 'seller_id', p.seller_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'refunded',
    'amount', p.amount,
    'refund_reason', clean_reason,
    'refunded_at', now_ts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seller_refund_order(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_refund_order(bigint, text) TO authenticated, service_role;

-- 6) RPC: Auto-release de 3 dias (processa pedidos em delivered_pending_confirmation com > 3 dias)
CREATE OR REPLACE FUNCTION public.process_auto_release_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  now_ts timestamptz := now();
  processed_count integer := 0;
  next_messages jsonb;
BEGIN
  FOR r IN
    SELECT * FROM public.purchases
    WHERE status = 'delivered_pending_confirmation'
      AND delivered_pending_at IS NOT NULL
      AND delivered_pending_at <= (now_ts - interval '3 days')
    FOR UPDATE
  LOOP
    next_messages := COALESCE(r.messages, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'from', 'System',
      'text', '⏰ Liberação automática realizada! 3 dias se passaram após a confirmação de entrega sem contestação do comprador.',
      'date', now_ts
    ));

    UPDATE public.purchases
    SET status = 'delivered',
        seller_released = true,
        released_at = now_ts,
        messages = next_messages,
        updated_at = now_ts
    WHERE id = r.id;

    processed_count := processed_count + 1;
  END LOOP;

  RETURN processed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.process_auto_release_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_auto_release_orders() TO authenticated, service_role;
