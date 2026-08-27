-- Correct the profile lookup used for future product writes. `profiles.id` is an
-- internal row key; auth.uid() must match the unique `profiles.user_id` column.
-- This migration intentionally does not rewrite historical product rows.

CREATE OR REPLACE FUNCTION public.enforce_product_insert_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  public_identity record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.seller_id := auth.uid();
  SELECT public_id, display_name
  INTO public_identity
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF public_identity.public_id IS NULL THEN
    RAISE EXCEPTION 'Perfil público do vendedor não está disponível'
      USING ERRCODE = '42501';
  END IF;

  NEW.seller_public_id := public_identity.public_id::text;
  NEW.seller_name := COALESCE(NULLIF(btrim(public_identity.display_name), ''), 'Vendedor');
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.approved := false;
    NEW.sales := 0;
    NEW.rating := 0;
  END IF;
  RETURN NEW;
END;
$$;

-- Make reruns and restores deterministic: the old name and the current ordered
-- name are both removed before exactly one canonicalization trigger is created.
DROP TRIGGER IF EXISTS canonicalize_robux_offer_trg ON public.products;
DROP TRIGGER IF EXISTS a_canonicalize_robux_offer_trg ON public.products;
CREATE TRIGGER a_canonicalize_robux_offer_trg
  BEFORE INSERT OR UPDATE OF category, name, description, price, variations, stock, min_quantity
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.canonicalize_robux_offer();

REVOKE ALL ON FUNCTION public.enforce_product_insert_approval() FROM PUBLIC, anon, authenticated;
