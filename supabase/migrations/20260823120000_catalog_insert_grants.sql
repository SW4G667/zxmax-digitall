-- Catalog inserts must work for regular authenticated sellers even when older
-- column-level grants are still active. This is additive: RLS policies remain in force.
GRANT SELECT (
  id, seller_id, seller_public_id, seller_name, seller_email, name, price, category,
  image, banner, description, approved, delivery_type, variations, questions,
  sales, rating, created_at, updated_at, stock, min_quantity, delivery_time
) ON public.products TO anon, authenticated;

GRANT INSERT (
  seller_id, seller_public_id, seller_name, seller_email, name, price, category,
  image, banner, description, approved, delivery_type, variations, questions,
  stock, min_quantity, delivery_time
) ON public.products TO authenticated;

GRANT UPDATE (approved) ON public.products TO authenticated;
GRANT SELECT ON public.products_public TO anon, authenticated;
