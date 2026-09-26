-- ZXMAX: MagnusPay PIX, public profile projection and editable site branding.
-- Incremental migration: preserves existing users, products and orders.

ALTER TABLE public.profiles_public
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles_public ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profiles_public FROM anon, authenticated;
GRANT SELECT ON TABLE public.profiles_public TO anon, authenticated;
GRANT ALL ON TABLE public.profiles_public TO service_role;

DROP POLICY IF EXISTS "Public profiles are readable" ON public.profiles_public;
CREATE POLICY "Public profiles are readable"
ON public.profiles_public FOR SELECT TO anon, authenticated USING (true);

CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.sync_profile_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.profiles_public WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;

  INSERT INTO public.profiles_public
    (user_id, public_id, display_name, avatar_url, is_verified_seller, created_at, updated_at)
  VALUES
    (NEW.user_id, NEW.public_id, COALESCE(NEW.display_name, ''), NULLIF(NEW.avatar_url, ''),
     COALESCE(NEW.is_verified_seller, false), COALESCE(NEW.created_at, now()), now())
  ON CONFLICT (user_id) DO UPDATE SET
    public_id = EXCLUDED.public_id,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    is_verified_seller = EXCLUDED.is_verified_seller,
    updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_profile_public() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_public_sync ON public.profiles;
CREATE TRIGGER profiles_public_sync
AFTER INSERT OR UPDATE OF public_id, display_name, avatar_url, is_verified_seller OR DELETE
ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.sync_profile_public();

INSERT INTO public.profiles_public
  (user_id, public_id, display_name, avatar_url, is_verified_seller, created_at, updated_at)
SELECT user_id, public_id, COALESCE(display_name, ''), NULLIF(avatar_url, ''),
       COALESCE(is_verified_seller, false), created_at, now()
FROM public.profiles
WHERE user_id IS NOT NULL AND public_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  public_id = EXCLUDED.public_id,
  display_name = EXCLUDED.display_name,
  avatar_url = EXCLUDED.avatar_url,
  is_verified_seller = EXCLUDED.is_verified_seller,
  updated_at = now();

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS provider_payment_id text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.purchases'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%payment_provider%'
  LOOP
    EXECUTE format('ALTER TABLE public.purchases DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_payment_provider_check
  CHECK (
    payment_provider IS NULL OR payment_provider = ANY (
      ARRAY['magnuspay_pix','zennith_pix','vexopay_pix','crypto','card','boleto']::text[]
    )
  ) NOT VALID;
ALTER TABLE public.purchases VALIDATE CONSTRAINT purchases_payment_provider_check;

ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_payment_status_check;
ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_payment_status_check
  CHECK (payment_status = ANY (ARRAY['pending','paid','failed','expired','cancelled']::text[]))
  NOT VALID;
ALTER TABLE public.purchases VALIDATE CONSTRAINT purchases_payment_status_check;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_provider_payment
  ON public.purchases(payment_provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

INSERT INTO public.app_settings(key, value)
VALUES ('magnuspay', '{"pixEnabled":true,"pixFee":0}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings(key, value)
VALUES ('site_branding', jsonb_build_object(
  'siteName','ZXMAX',
  'logoUrl','',
  'faviconUrl','',
  'heroTitle','Compre e venda produtos digitais com segurança',
  'heroSubtitle','Marketplace para produtos, serviços e itens digitais.',
  'supportUrl','https://discord.gg/zxmax'
))
ON CONFLICT (key) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-assets','site-assets',true,2097152,ARRAY['image/png','image/jpeg','image/webp','image/x-icon']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
