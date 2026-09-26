-- A remoção precisa retornar um resultado inequívoco: operações RLS sem linha
-- afetada não podem ser interpretadas pelo cliente como exclusão bem-sucedida.
CREATE OR REPLACE FUNCTION public.remove_product(_product_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_product public.products;
  has_purchase_history boolean;
  deleted_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO target_product
  FROM public.products
  WHERE id = _product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anúncio não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF target_product.seller_id IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Você não tem permissão para remover este anúncio.' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.purchases
    WHERE product_id = _product_id
  )
  INTO has_purchase_history;

  IF has_purchase_history THEN
    UPDATE public.products
    SET approved = false,
        updated_at = now()
    WHERE id = _product_id;

    RETURN jsonb_build_object('status', 'paused', 'product_id', _product_id);
  END IF;

  DELETE FROM public.products
  WHERE id = _product_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count <> 1 THEN
    RAISE EXCEPTION 'Não foi possível concluir a remoção do anúncio.' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('status', 'deleted', 'product_id', _product_id);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_product(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_product(bigint) TO authenticated, service_role;
