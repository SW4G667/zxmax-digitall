-- Fix admin RLS to allow admin to verify users and approve products/docs
-- This fixes bug where products only appear for admin and docs can't be approved

-- Allow admin to update any profile (for verification)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile and admins can update all" ON public.profiles;

CREATE POLICY "Users can update own profile and admins can update all"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admin to view all profiles
DROP POLICY IF EXISTS "Public can view safe profile fields via public view" ON public.profiles;
DROP POLICY IF EXISTS "Public can view safe seller profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow admin to view and update all seller_documents
DROP POLICY IF EXISTS "Users can view own seller documents" ON public.seller_documents;
DROP POLICY IF EXISTS "Users can submit own seller documents" ON public.seller_documents;
DROP POLICY IF EXISTS "Admins can update seller documents" ON public.seller_documents;
DROP POLICY IF EXISTS "Users can view own and admins view all documents" ON public.seller_documents;

CREATE POLICY "Users can view own and admins view all documents"
ON public.seller_documents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own documents"
ON public.seller_documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update all documents"
ON public.seller_documents
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admin to approve all products
DROP POLICY IF EXISTS "Approved products are public" ON public.products;
DROP POLICY IF EXISTS "Public can view approved products via public view" ON public.products;
DROP POLICY IF EXISTS "Public can view approved products" ON public.products;
DROP POLICY IF EXISTS "Users can view approved and own" ON public.products;

CREATE POLICY "Public can view approved products"
ON public.products
FOR SELECT
TO anon
USING (approved = true);

CREATE POLICY "Authenticated can view approved and own and admin can view all"
ON public.products
FOR SELECT
TO authenticated
USING (approved = true OR auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Ensure products_public view shows approved only but is accessible
DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public
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
  updated_at,
  stock,
  min_quantity,
  delivery_time
FROM public.products
WHERE approved = true;

GRANT SELECT ON public.products_public TO anon, authenticated, service_role;

-- Add missing columns if not exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock integer DEFAULT 1000;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_quantity integer DEFAULT 100;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS delivery_time text DEFAULT '11 min - 1 h';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seller_rating numeric DEFAULT 99.4;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seller_reviews integer DEFAULT 100;

-- Ensure storage bucket exists and admin can access
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('order-attachments', 'order-attachments', false) ON CONFLICT (id) DO NOTHING;

-- Storage policies for admin
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
CREATE POLICY "Users can view own documents and admin can view all"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
CREATE POLICY "Users can upload own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow admin to delete documents if needed
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;
CREATE POLICY "Admins can delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'::app_role));
