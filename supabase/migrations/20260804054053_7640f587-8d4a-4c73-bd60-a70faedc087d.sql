-- 1. Remove hardcoded admin bootstrap from signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || encode(NEW.email::bytea, 'base64'))
  );
  RETURN NEW;
END;
$function$;

-- 2. Lock anonymous access to internal tables; public browsing goes through the public views only
REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.product_delivery FROM anon;
REVOKE ALL ON public.user_tags FROM anon;
REVOKE ALL ON public.products_public FROM anon, authenticated;
REVOKE ALL ON public.profiles_public FROM anon, authenticated;
GRANT SELECT ON public.products_public TO anon, authenticated;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view approved safe products" ON public.products;
DROP POLICY IF EXISTS "Public can view safe seller profiles" ON public.profiles;

CREATE POLICY "Public can view approved products via public view"
ON public.products FOR SELECT TO anon
USING (approved = true);

CREATE POLICY "Public can view safe profile fields via public view"
ON public.profiles FOR SELECT TO anon
USING (true);

-- the views are security_invoker, so anon needs column-scoped rights on the base tables
GRANT SELECT (id, seller_id, seller_public_id, seller_name, name, price, category, image, banner,
              description, approved, delivery_type, variations, questions, sales, rating,
              created_at, updated_at)
  ON public.products TO anon;
GRANT SELECT (user_id, public_id, display_name, avatar_url, is_verified_seller, created_at)
  ON public.profiles TO anon;

-- 3. Restore the privileges signed-in users actually need (these were missing and broke the app)
GRANT SELECT (id, seller_id, seller_public_id, seller_email, seller_name, name, price, category,
              image, banner, description, approved, delivery_type, variations, questions, sales,
              rating, created_at, updated_at)
  ON public.products TO authenticated;
GRANT INSERT, UPDATE ON public.products TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.product_delivery TO authenticated;
GRANT SELECT ON public.user_tags TO authenticated;
GRANT ALL ON public.products, public.profiles, public.purchases, public.product_delivery, public.user_tags TO service_role;

-- 4. Buyers/sellers may only touch the pix + review fields of a purchase
CREATE OR REPLACE FUNCTION public.protect_purchase_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.buyer_email IS DISTINCT FROM OLD.buyer_email
     OR NEW.seller_email IS DISTINCT FROM OLD.seller_email
     OR NEW.buyer_public_id IS DISTINCT FROM OLD.buyer_public_id
     OR NEW.seller_public_id IS DISTINCT FROM OLD.seller_public_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.variation_name IS DISTINCT FROM OLD.variation_name THEN
    RAISE EXCEPTION 'Somente os campos de pagamento e avaliação podem ser alterados neste pedido';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_purchase_updates_trg ON public.purchases;
CREATE TRIGGER protect_purchase_updates_trg
BEFORE UPDATE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.protect_purchase_updates();

-- 5. Server-side validation of withdrawal amounts against the real seller balance
CREATE OR REPLACE FUNCTION public.validate_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  commission numeric := 10;
  gross numeric := 0;
  already numeric := 0;
  available numeric := 0;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount < 5 THEN
    RAISE EXCEPTION 'O valor mínimo de saque é R$ 5,00';
  END IF;
  IF COALESCE(TRIM(NEW.pix_key), '') = '' THEN
    RAISE EXCEPTION 'Cadastre uma chave Pix antes de solicitar saque';
  END IF;

  SELECT COALESCE((value->>'commission')::numeric, 10) INTO commission
  FROM public.app_settings WHERE key = 'fees';
  commission := COALESCE(commission, 10);

  SELECT COALESCE(SUM(amount), 0) INTO gross
  FROM public.purchases
  WHERE seller_id = NEW.user_id AND status = 'delivered';

  SELECT COALESCE(SUM(amount), 0) INTO already
  FROM public.withdrawals
  WHERE user_id = NEW.user_id AND status IN ('pending', 'approved');

  available := (gross * (100 - commission) / 100) - already;

  IF NEW.amount > available THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %', ROUND(available, 2);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_withdrawal_trg ON public.withdrawals;
CREATE TRIGGER validate_withdrawal_trg
BEFORE INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal();

-- 6. Internal user tags are not public knowledge
DROP POLICY IF EXISTS "Authenticated users can view tag labels" ON public.user_tags;
CREATE POLICY "Admins and tagged users can view tags"
ON public.user_tags FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_tag_assignments a
    WHERE a.tag_id = user_tags.id AND a.user_id = auth.uid()
  )
);