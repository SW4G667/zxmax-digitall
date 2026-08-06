DROP POLICY IF EXISTS "Buyers can save pending pix charge" ON public.purchases;

DROP POLICY IF EXISTS "Users can view own tag assignments" ON public.user_tag_assignments;
DROP POLICY IF EXISTS "Tagged users can view tag definitions" ON public.user_tags;
DROP POLICY IF EXISTS "Users can view assigned tags" ON public.user_tags;

REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT SELECT (id, seller_id, seller_public_id, seller_name, name, price, category, image, banner, description, approved, delivery_type, variations, questions, sales, rating, created_at, updated_at) ON public.products TO authenticated;

REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (user_id, public_id, display_name, avatar_url, is_verified_seller, created_at) ON public.profiles TO anon;