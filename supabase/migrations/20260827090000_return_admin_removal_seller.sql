-- A migração anterior foi aplicada antes de o e-mail de retirada ser adicionado.
-- Mantemos a resposta pública da Edge Function mínima, mas o contrato interno
-- precisa devolver seller_id para localizar o destinatário no servidor.
CREATE OR REPLACE FUNCTION public.admin_remove_product(
  _product_id bigint,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_product public.products;
  has_purchase_history boolean;
  action_status text;
  safe_reason text;
  deleted_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Você não tem permissão para retirar anúncios.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'Confirme a autenticação em dois fatores antes de retirar um anúncio.' USING ERRCODE = '42501';
  END IF;

  safe_reason := left(regexp_replace(btrim(COALESCE(_reason, '')), '\s+', ' ', 'g'), 500);
  IF char_length(safe_reason) < 3 THEN
    RAISE EXCEPTION 'Informe um motivo de ao menos 3 caracteres.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO target_product FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anúncio não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.purchases WHERE product_id = _product_id)
  INTO has_purchase_history;

  IF has_purchase_history THEN
    UPDATE public.products SET approved = false, updated_at = now() WHERE id = _product_id;
    action_status := 'paused';
  ELSE
    DELETE FROM public.products WHERE id = _product_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count <> 1 THEN
      RAISE EXCEPTION 'Não foi possível concluir a retirada do anúncio.' USING ERRCODE = 'P0001';
    END IF;
    action_status := 'deleted';
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, reason, metadata)
  VALUES (
    auth.uid(), 'product.removed_by_admin', 'products', _product_id::text, safe_reason,
    jsonb_build_object('status', action_status, 'seller_id', target_product.seller_id, 'name', target_product.name)
  );

  RETURN jsonb_build_object(
    'status', action_status,
    'product_id', _product_id,
    'name', target_product.name,
    'seller_id', target_product.seller_id
  );
END;
$$;
