CREATE TABLE IF NOT EXISTS public.product_delivery (
  product_id bigint PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  delivery_type text NOT NULL DEFAULT 'manual',
  delivery_content text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_delivery TO authenticated;
GRANT ALL ON public.product_delivery TO service_role;
ALTER TABLE public.product_delivery ENABLE ROW LEVEL SECURITY;

INSERT INTO public.product_delivery (product_id, delivery_type, delivery_content)
SELECT id, delivery_type, delivery_content
FROM public.products
WHERE delivery_content IS NOT NULL
ON CONFLICT (product_id) DO UPDATE SET
  delivery_type = EXCLUDED.delivery_type,
  delivery_content = EXCLUDED.delivery_content,
  updated_at = now();

CREATE POLICY "Delivery visible to seller paid buyer or admin"
ON public.product_delivery
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.purchases pu WHERE pu.product_id = product_id AND pu.buyer_id = auth.uid() AND pu.status IN ('paid','delivered'))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Sellers can create delivery for own products"
ON public.product_delivery
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Sellers can update delivery for own products"
ON public.product_delivery
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE TRIGGER update_product_delivery_updated_at
BEFORE UPDATE ON public.product_delivery
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

UPDATE public.products SET delivery_content = NULL WHERE delivery_content IS NOT NULL;

DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
SELECT user_id, public_id, display_name, avatar_url, is_verified_seller, created_at
FROM public.profiles;
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT ALL ON public.profiles_public TO service_role;

REVOKE ALL ON public.app_settings FROM anon;
REVOKE ALL ON public.webhook_logs FROM anon, authenticated;
GRANT SELECT ON public.webhook_logs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;

REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, pix_key, document_type, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users and admins can view protected profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update safe own profile fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.products FROM anon, authenticated;
GRANT SELECT (id, seller_id, seller_public_id, seller_name, name, price, category, image, banner, description, approved, delivery_type, variations, questions, sales, rating, created_at, updated_at) ON public.products TO authenticated;
GRANT INSERT (seller_id, seller_public_id, seller_name, name, price, category, image, banner, description, delivery_type, variations, questions) ON public.products TO authenticated;
GRANT UPDATE (seller_public_id, seller_name, name, price, category, image, banner, description, approved, delivery_type, variations, questions, updated_at) ON public.products TO authenticated;
GRANT DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

CREATE OR REPLACE FUNCTION public.protect_product_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approved = true AND COALESCE(OLD.approved, false) IS DISTINCT FROM true AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar anúncios';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_product_approval_trg ON public.products;
CREATE TRIGGER protect_product_approval_trg
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.protect_product_approval();

REVOKE ALL ON public.purchases FROM anon, authenticated;
GRANT SELECT (id, product_id, buyer_id, buyer_public_id, seller_id, seller_public_id, status, amount, messages, reviewed, review_stars, review_comment, variation_name, created_at, updated_at, evopay_charge_id, pix_qr_code, pix_expires_at) ON public.purchases TO authenticated;
GRANT UPDATE (reviewed, review_stars, review_comment, updated_at) ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
DROP POLICY IF EXISTS "Purchase parties and admins can update" ON public.purchases;
CREATE POLICY "Buyers can review delivered purchases"
ON public.purchases
FOR UPDATE
TO authenticated
USING (auth.uid() = buyer_id AND status = 'delivered')
WITH CHECK (auth.uid() = buyer_id AND status = 'delivered');

REVOKE ALL ON public.withdrawals FROM anon, authenticated;
GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;

REVOKE ALL ON public.seller_documents FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.seller_documents TO authenticated;
GRANT ALL ON public.seller_documents TO service_role;

REVOKE ALL ON public.order_messages FROM anon, authenticated;
GRANT SELECT, INSERT ON public.order_messages TO authenticated;
GRANT ALL ON public.order_messages TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_messages') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.order_messages;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

DROP POLICY IF EXISTS "Users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Authenticated users can view own chat attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

REVOKE EXECUTE ON FUNCTION public.protect_product_approval() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;