-- Canonical Robux offer contract.
-- A Robux listing has one source of truth: package price in products.price,
-- units/minimum/stock on the root row and exactly one derived JSON variation.

CREATE OR REPLACE FUNCTION public.canonicalize_robux_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  offer jsonb;
  units_text text;
  package_units integer;
BEGIN
  IF NEW.category IS DISTINCT FROM 'Robux e Gift Cards' THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(COALESCE(NEW.variations, '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(COALESCE(NEW.variations, '[]'::jsonb)) <> 1 THEN
    RAISE EXCEPTION 'Uma oferta Robux precisa ter uma única configuração de pacote'
      USING ERRCODE = '22023';
  END IF;

  offer := NEW.variations->0;
  units_text := NULLIF(regexp_replace(COALESCE(offer->>'name', ''), '[^0-9]', '', 'g'), '');
  IF units_text IS NULL OR units_text::numeric > 2147483647 THEN
    RAISE EXCEPTION 'Informe uma quantidade válida de Robux no pacote'
      USING ERRCODE = '22023';
  END IF;
  package_units := units_text::integer;

  IF package_units <= 0 THEN
    RAISE EXCEPTION 'Informe uma quantidade válida de Robux no pacote'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.stock IS NULL OR NEW.stock < 0 THEN
    RAISE EXCEPTION 'Informe o estoque disponível de Robux'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.min_quantity IS NULL OR NEW.min_quantity <= 0 THEN
    RAISE EXCEPTION 'Informe a quantidade mínima de compra de Robux'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.min_quantity > NEW.stock THEN
    RAISE EXCEPTION 'A quantidade mínima não pode exceder o estoque disponível'
      USING ERRCODE = '22023';
  END IF;

  -- Name and description are intentionally not seller-editable for Robux.
  NEW.name := 'Robux';
  NEW.description := '';
  NEW.variations := jsonb_build_array(
    jsonb_build_object(
      'name', package_units::text || ' Robux',
      'price', NEW.price,
      'stock', NEW.stock,
      'minQuantity', NEW.min_quantity
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS canonicalize_robux_offer_trg ON public.products;
CREATE TRIGGER a_canonicalize_robux_offer_trg
  BEFORE INSERT OR UPDATE OF category, name, description, price, variations, stock, min_quantity
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.canonicalize_robux_offer();

-- IDs and display names must be derived by the trusted database, not accepted
-- from a product form. A missing public profile is a hard publication failure.
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
  WHERE id = auth.uid()
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

CREATE OR REPLACE FUNCTION public.protect_product_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.approved = true AND COALESCE(OLD.approved, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar anúncios' USING ERRCODE = '42501';
  END IF;
  NEW.seller_id := OLD.seller_id;
  NEW.seller_public_id := OLD.seller_public_id;
  NEW.seller_name := OLD.seller_name;
  NEW.sales := OLD.sales;
  NEW.rating := OLD.rating;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.canonicalize_robux_offer() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_product_insert_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_product_approval() FROM PUBLIC, anon, authenticated;
