-- Fix public safe views to run as the caller, not as a privileged view owner.
CREATE OR REPLACE VIEW public.products_public
WITH (security_invoker = true) AS
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

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT
  user_id,
  public_id,
  display_name,
  avatar_url,
  is_verified_seller,
  created_at
FROM public.profiles;

GRANT SELECT ON public.products_public TO anon, authenticated, service_role;
GRANT SELECT ON public.profiles_public TO anon, authenticated, service_role;

-- Let anonymous visitors read only safe approved product columns needed by the storefront.
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
) ON public.products TO anon;

DROP POLICY IF EXISTS "Public can view approved safe products" ON public.products;
CREATE POLICY "Public can view approved safe products"
ON public.products
FOR SELECT
TO anon
USING (approved = true);

-- Let anonymous visitors read only safe public seller profile columns through profiles_public.
GRANT SELECT (user_id, public_id, display_name, avatar_url, is_verified_seller, created_at) ON public.profiles TO anon;

DROP POLICY IF EXISTS "Public can view safe seller profiles" ON public.profiles;
CREATE POLICY "Public can view safe seller profiles"
ON public.profiles
FOR SELECT
TO anon
USING (true);

-- Restrict direct execution of helper functions as much as possible while keeping RLS functional.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_banned(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_banned(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_order_party(bigint, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_order_party(bigint, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.order_chat_open(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_chat_open(bigint) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
REVOKE EXECUTE ON FUNCTION public.protect_product_approval() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_product_approval() TO service_role;
REVOKE EXECUTE ON FUNCTION public.validate_product_price() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_product_price() TO service_role;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;