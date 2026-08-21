-- ============================================================================
-- ZXMAX: fix verification approval, public catalog, admin login gate (30d)
-- Additive only. Does not drop existing tables or working policies.
-- ============================================================================

-- 1) Product approval trigger must allow service_role (auth.uid() is NULL)
CREATE OR REPLACE FUNCTION public.protect_product_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.approved = true AND COALESCE(OLD.approved, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar anúncios';
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Extra product columns must be readable by the public view (security_invoker)
GRANT SELECT (
  id, seller_id, seller_public_id, seller_name, seller_email, name, price, category,
  image, banner, description, approved, delivery_type, variations, questions,
  sales, rating, created_at, updated_at, stock, min_quantity, delivery_time,
  seller_rating, seller_reviews
) ON public.products TO anon, authenticated;

GRANT UPDATE (
  seller_public_id, seller_name, name, price, category, image, banner,
  description, approved, delivery_type, variations, questions, updated_at,
  stock, min_quantity, delivery_time
) ON public.products TO authenticated;

-- Recreate public catalog with only columns anon can read (safe + extra granted above)
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

-- 3) Profile verification columns: never NULL, grant updates
ALTER TABLE public.profiles
  ALTER COLUMN verification_notes SET DEFAULT '',
  ALTER COLUMN verification_selfie_path SET DEFAULT '',
  ALTER COLUMN verification_status SET DEFAULT 'none';

UPDATE public.profiles SET verification_notes = '' WHERE verification_notes IS NULL;
UPDATE public.profiles SET verification_selfie_path = '' WHERE verification_selfie_path IS NULL;
UPDATE public.profiles SET verification_status = 'none' WHERE verification_status IS NULL;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (
  display_name, avatar_url, pix_key, document_type, updated_at,
  full_name, cpf, birth_date, phone, city, state,
  verification_selfie_path, verification_status, verification_notes,
  verification_submitted_at, is_verified_seller
) ON public.profiles TO authenticated;

-- 4) Admin login confirmation (email link + trusted device 30 days)
CREATE TABLE IF NOT EXISTS public.admin_login_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS public.admin_webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  device_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_login_tokens_user ON public.admin_login_tokens(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_trusted_devices_lookup ON public.admin_trusted_devices(user_id, device_id);

ALTER TABLE public.admin_login_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_webauthn_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_login_tokens FROM anon, authenticated;
REVOKE ALL ON public.admin_trusted_devices FROM anon, authenticated;
REVOKE ALL ON public.admin_webauthn_credentials FROM anon, authenticated;
GRANT ALL ON public.admin_login_tokens TO service_role;
GRANT ALL ON public.admin_trusted_devices TO service_role;
GRANT ALL ON public.admin_webauthn_credentials TO service_role;

-- 5) Persist platform extras (categories, featured, maintenance)
INSERT INTO public.app_settings (key, value)
VALUES (
  'platform',
  jsonb_build_object(
    'categories', jsonb_build_array(
      'Robux e Gift Cards', 'Bots Discord', 'Contas', 'Scripts', 'Assinaturas',
      'Designs Digitais', 'Serviços Online', 'Consultoria Virtual', 'Keys de Software',
      'Arquivos', 'Jogos e Itens'
    ),
    'featured_ids', jsonb_build_array(),
    'maintenance', false,
    'maintenance_message', '',
    'min_product_price', 2,
    'min_withdraw', 3.5
  )
)
ON CONFLICT (key) DO NOTHING;

-- 6) Support tickets persisted (admin panel)
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  user_email text NOT NULL DEFAULT '',
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

DROP POLICY IF EXISTS "Users see own tickets, admin sees all" ON public.support_tickets;
CREATE POLICY "Users see own tickets, admin sees all"
ON public.support_tickets FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can open own tickets" ON public.support_tickets;
CREATE POLICY "Users can open own tickets"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users and admin can update tickets" ON public.support_tickets;
CREATE POLICY "Users and admin can update tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 7) Persist global notices for all users
ALTER TABLE public.global_notices ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.global_notices TO anon, authenticated;
GRANT INSERT, DELETE ON public.global_notices TO authenticated;
GRANT ALL ON public.global_notices TO service_role;

DROP POLICY IF EXISTS "Anyone can read notices" ON public.global_notices;
CREATE POLICY "Anyone can read notices"
ON public.global_notices FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage notices" ON public.global_notices;
CREATE POLICY "Admins manage notices"
ON public.global_notices FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete notices" ON public.global_notices;
CREATE POLICY "Admins delete notices"
ON public.global_notices FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
