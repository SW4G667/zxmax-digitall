DROP POLICY IF EXISTS "Approved products are public and owners manage visibility" ON public.products;
CREATE POLICY "Public can view approved products"
ON public.products FOR SELECT TO anon, authenticated
USING (approved = true);
CREATE POLICY "Sellers can view own products"
ON public.products FOR SELECT TO authenticated
USING (auth.uid() = seller_id);
CREATE POLICY "Admins can view all products"
ON public.products FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));