CREATE SEQUENCE IF NOT EXISTS public.profile_public_id_seq START WITH 100000 INCREMENT BY 1;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS public_id bigint;

UPDATE public.profiles
SET public_id = nextval('public.profile_public_id_seq')
WHERE public_id IS NULL;

SELECT setval(
  'public.profile_public_id_seq',
  GREATEST(100000, COALESCE((SELECT max(public_id) FROM public.profiles), 100000)),
  true
);

ALTER TABLE public.profiles
ALTER COLUMN public_id SET DEFAULT nextval('public.profile_public_id_seq');

ALTER TABLE public.profiles
ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_id_key ON public.profiles(public_id);
CREATE INDEX IF NOT EXISTS idx_profiles_public_id ON public.profiles(public_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.seller_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  document_type text NOT NULL DEFAULT 'rg_ou_certidao',
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own seller documents" ON public.seller_documents;
CREATE POLICY "Users can view own seller documents"
ON public.seller_documents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can submit own seller documents" ON public.seller_documents;
CREATE POLICY "Users can submit own seller documents"
ON public.seller_documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update seller documents" ON public.seller_documents;
CREATE POLICY "Admins can update seller documents"
ON public.seller_documents
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_seller_documents_user_status ON public.seller_documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_seller_documents_created_at ON public.seller_documents(created_at DESC);