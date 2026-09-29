UPDATE public.products
SET approved=false, listing_status='paused', updated_at=now()
WHERE lower(btrim(name))='robux'
  AND category NOT IN ('Robux','Robux e Gift Cards');

CREATE OR REPLACE FUNCTION public.prevent_misclassified_robux()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public
AS $$
BEGIN
  IF lower(btrim(COALESCE(NEW.name,'')))='robux'
     AND COALESCE(NEW.category,'') NOT IN ('Robux','Robux e Gift Cards') THEN
    RAISE EXCEPTION 'Robux deve ser anunciado somente no mercado próprio de Robux'
      USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_misclassified_robux_trg ON public.products;
CREATE TRIGGER prevent_misclassified_robux_trg
BEFORE INSERT OR UPDATE OF name,category ON public.products
FOR EACH ROW EXECUTE FUNCTION public.prevent_misclassified_robux();

REVOKE ALL ON FUNCTION public.prevent_misclassified_robux() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_misclassified_robux() TO service_role;
