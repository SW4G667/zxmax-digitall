REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_purchase_updates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_withdrawal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_product_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_product_price() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;