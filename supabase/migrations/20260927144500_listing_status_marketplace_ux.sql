-- V8: explicit listing lifecycle so moderation state is not inferred from a single boolean.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS listing_status text;

UPDATE public.products
SET listing_status = CASE
  WHEN approved THEN 'approved'
  ELSE COALESCE(NULLIF(listing_status, ''), 'pending')
END
WHERE listing_status IS NULL OR listing_status = '' OR (approved AND listing_status <> 'approved');

ALTER TABLE public.products
  ALTER COLUMN listing_status SET DEFAULT 'pending',
  ALTER COLUMN listing_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_listing_status_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_listing_status_check
      CHECK (listing_status IN ('pending', 'approved', 'rejected', 'paused'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_listing_status
  ON public.products(listing_status, created_at DESC);

CREATE OR REPLACE FUNCTION public.sync_product_listing_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.approved THEN
      NEW.listing_status := 'approved';
    ELSIF NEW.listing_status IS NULL OR NEW.listing_status = '' THEN
      NEW.listing_status := 'pending';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.approved IS DISTINCT FROM OLD.approved THEN
    IF NEW.approved THEN
      NEW.listing_status := 'approved';
    ELSIF NEW.listing_status IS NOT DISTINCT FROM OLD.listing_status THEN
      NEW.listing_status := 'paused';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_listing_status ON public.products;
CREATE TRIGGER trg_sync_product_listing_status
BEFORE INSERT OR UPDATE OF approved, listing_status
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_listing_status();

CREATE OR REPLACE FUNCTION public.moderate_product(
  _product_id bigint,
  _approved boolean,
  _reason text DEFAULT NULL
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed public.products;
BEGIN
  PERFORM public.require_admin_capability('moderate_catalog');

  UPDATE public.products
  SET approved = _approved,
      listing_status = CASE WHEN _approved THEN 'approved' ELSE 'rejected' END,
      updated_at = now()
  WHERE id = _product_id
  RETURNING * INTO changed;

  IF changed IS NULL THEN
    RAISE EXCEPTION 'Anúncio não encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, reason, metadata)
  VALUES (
    auth.uid(),
    CASE WHEN _approved THEN 'product.approved' ELSE 'product.rejected' END,
    'products',
    _product_id::text,
    NULLIF(btrim(_reason), ''),
    jsonb_build_object('seller_id', changed.seller_id, 'name', changed.name, 'listing_status', changed.listing_status)
  );

  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_product(bigint, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderate_product(bigint, boolean, text) TO authenticated, service_role;

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

  SELECT * INTO target_product FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anúncio não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF target_product.seller_id IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Você não tem permissão para remover este anúncio.' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.purchases WHERE product_id = _product_id) INTO has_purchase_history;
  IF has_purchase_history THEN
    UPDATE public.products
       SET approved = false, listing_status = 'paused', updated_at = now()
     WHERE id = _product_id;
    RETURN jsonb_build_object('status', 'paused', 'product_id', _product_id);
  END IF;

  DELETE FROM public.products WHERE id = _product_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count <> 1 THEN
    RAISE EXCEPTION 'Não foi possível concluir a remoção do anúncio.' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('status', 'deleted', 'product_id', _product_id);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_product(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_product(bigint) TO authenticated;
