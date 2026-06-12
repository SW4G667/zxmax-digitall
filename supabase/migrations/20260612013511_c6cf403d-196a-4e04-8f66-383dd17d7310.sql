DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT user_id, public_id, display_name, avatar_url, is_verified_seller, created_at
FROM public.profiles;
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT ALL ON public.profiles_public TO service_role;

GRANT INSERT (seller_email) ON public.products TO authenticated;

REVOKE EXECUTE ON FUNCTION public.protect_product_approval() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_product_price() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;