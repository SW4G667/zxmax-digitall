DROP POLICY IF EXISTS "Products viewable by authenticated users" ON public.products;
CREATE POLICY "Approved products are public and owners manage visibility"
ON public.products
FOR SELECT
TO public
USING (
  approved = true
  OR (auth.uid() IS NOT NULL AND auth.uid() = seller_id)
  OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::public.app_role))
);