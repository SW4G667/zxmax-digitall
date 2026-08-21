-- Storage RLS policies for product-images bucket
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Users can update own product images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND owner = auth.uid());

CREATE POLICY "Users can delete own product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND owner = auth.uid());