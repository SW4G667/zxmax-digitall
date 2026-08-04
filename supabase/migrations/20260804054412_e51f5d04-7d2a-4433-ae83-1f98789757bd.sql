DROP POLICY IF EXISTS "Public can view safe profile fields via public view" ON public.profiles;
DROP POLICY IF EXISTS "Public can view approved products via public view" ON public.products;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.products FROM anon;

CREATE OR REPLACE FUNCTION public.protect_purchase_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.buyer_id THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.product_id IS DISTINCT FROM OLD.product_id
       OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
       OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
       OR NEW.buyer_email IS DISTINCT FROM OLD.buyer_email
       OR NEW.seller_email IS DISTINCT FROM OLD.seller_email
       OR NEW.variation_name IS DISTINCT FROM OLD.variation_name THEN
      RAISE EXCEPTION 'Compradores não podem alterar dados financeiros do pedido';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.seller_id THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
       OR NEW.seller_id IS DISTINCT FROM OLD.seller_id THEN
      RAISE EXCEPTION 'Vendedores não podem alterar valores do pedido';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_purchase_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_purchase_updates_trg ON public.purchases;
CREATE TRIGGER protect_purchase_updates_trg
BEFORE UPDATE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.protect_purchase_updates();