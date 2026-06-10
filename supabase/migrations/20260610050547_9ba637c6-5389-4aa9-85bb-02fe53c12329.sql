-- 1. Profiles: remove anonymous read access (emails were public)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 2. Products: remove anonymous read access (seller emails were public)
DROP POLICY IF EXISTS "Approved products are public" ON public.products;
CREATE POLICY "Products viewable by authenticated users"
ON public.products
FOR SELECT
TO authenticated
USING ((approved = true) OR (auth.uid() = seller_id) OR public.has_role(auth.uid(), 'admin'));

-- 3. Team chat: admins only
DROP POLICY IF EXISTS "Authenticated users can view team chat" ON public.team_chat;
DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.team_chat;
CREATE POLICY "Admins can view team chat"
ON public.team_chat
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can send team chat"
ON public.team_chat
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Product images: enforce path ownership on upload
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Users can upload product images to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Chat attachments: only owner or admin can view
DROP POLICY IF EXISTS "Authenticated users can view chat attachments" ON storage.objects;
CREATE POLICY "Owner or admin can view chat attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
);