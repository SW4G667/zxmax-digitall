-- Secure public marketplace read model and tighten sensitive access

-- Public safe catalog: approved products only, no seller email and no delivery content.
CREATE OR REPLACE VIEW public.products_public AS
SELECT
  id,
  seller_id,
  seller_public_id,
  seller_name,
  name,
  price,
  category,
  image,
  banner,
  description,
  approved,
  delivery_type,
  variations,
  questions,
  sales,
  rating,
  created_at,
  updated_at
FROM public.products
WHERE approved = true;

GRANT SELECT ON public.products_public TO anon;
GRANT SELECT ON public.products_public TO authenticated;
GRANT SELECT ON public.products_public TO service_role;

-- Public profile read model: safe seller card only.
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT
  user_id,
  public_id,
  display_name,
  avatar_url,
  is_verified_seller,
  created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon;
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO service_role;

-- Keep old delivery data out of the broadly-readable products table.
INSERT INTO public.product_delivery (product_id, delivery_type, delivery_content)
SELECT id, delivery_type, delivery_content
FROM public.products
WHERE delivery_content IS NOT NULL AND delivery_content <> ''
ON CONFLICT (product_id) DO UPDATE
SET delivery_type = EXCLUDED.delivery_type,
    delivery_content = EXCLUDED.delivery_content,
    updated_at = now();

UPDATE public.products
SET delivery_content = NULL
WHERE delivery_content IS NOT NULL;

-- Column-level grants for products: authenticated users can read safe product fields only.
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.products FROM authenticated;
GRANT SELECT (
  id,
  seller_id,
  seller_public_id,
  seller_name,
  name,
  price,
  category,
  image,
  banner,
  description,
  approved,
  delivery_type,
  variations,
  questions,
  sales,
  rating,
  created_at,
  updated_at
) ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- Purchase column grants: parties may read their own order details; direct client writes are limited.
REVOKE UPDATE ON public.purchases FROM authenticated;
GRANT SELECT ON public.purchases TO authenticated;
GRANT INSERT (product_id, buyer_id, buyer_email, buyer_public_id, seller_id, seller_email, seller_public_id, status, amount, messages, variation_name) ON public.purchases TO authenticated;
GRANT UPDATE (evopay_charge_id, pix_qr_code, pix_expires_at, updated_at) ON public.purchases TO authenticated;
GRANT UPDATE (reviewed, review_stars, review_comment, updated_at) ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;

-- Replace broken product_delivery policy so buyers only see delivery for the product they paid for.
DROP POLICY IF EXISTS "Delivery visible to seller paid buyer or admin" ON public.product_delivery;
CREATE POLICY "Delivery visible to seller paid buyer or admin"
ON public.product_delivery
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_delivery.product_id
      AND p.seller_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.purchases pu
    WHERE pu.product_id = product_delivery.product_id
      AND pu.buyer_id = auth.uid()
      AND pu.status IN ('paid', 'delivered')
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Product changes remain seller/admin only, but non-admin sellers cannot approve products themselves.
DROP POLICY IF EXISTS "Sellers and admins can update products" ON public.products;
CREATE POLICY "Sellers can update own unapproved fields and admins can manage products"
ON public.products
FOR UPDATE
TO authenticated
USING ((auth.uid() = seller_id) OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (auth.uid() = seller_id AND approved = false)
);

-- Product approval guard remains server-side.
DROP TRIGGER IF EXISTS protect_product_approval_trigger ON public.products;
CREATE TRIGGER protect_product_approval_trigger
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.protect_product_approval();

-- Reduce direct purchase update policies to the two safe client-side cases.
DROP POLICY IF EXISTS "Buyers can save pending pix charge" ON public.purchases;
CREATE POLICY "Buyers can save pending pix charge"
ON public.purchases
FOR UPDATE
TO authenticated
USING ((auth.uid() = buyer_id) AND status = 'pending')
WITH CHECK ((auth.uid() = buyer_id) AND status = 'pending');

DROP POLICY IF EXISTS "Buyers can review delivered purchases" ON public.purchases;
CREATE POLICY "Buyers can review delivered purchases"
ON public.purchases
FOR UPDATE
TO authenticated
USING ((auth.uid() = buyer_id) AND status = 'delivered')
WITH CHECK ((auth.uid() = buyer_id) AND status = 'delivered');

-- User tags are admin-only operational data.
DROP POLICY IF EXISTS "Everyone can view tag assignments" ON public.user_tag_assignments;
DROP POLICY IF EXISTS "Everyone can view tags" ON public.user_tags;
CREATE POLICY "Users can view own tag assignments and admins can view all"
ON public.user_tag_assignments
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Authenticated users can view tag labels"
ON public.user_tags
FOR SELECT
TO authenticated
USING (true);

-- Security definer functions used only by RLS should not be callable by anonymous users directly.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_banned(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_order_party(bigint, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.order_chat_open(bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_product_approval() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_product_price() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;