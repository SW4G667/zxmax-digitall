-- Listing access: confirmed email + verified membership in the configured Discord server.
-- Phone/SMS is intentionally no longer part of the listing gate.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discord_user_id text,
  ADD COLUMN IF NOT EXISTS discord_guild_id text,
  ADD COLUMN IF NOT EXISTS discord_member_verified_at timestamptz;

-- Users must never be able to self-assert server membership or verification.
CREATE OR REPLACE FUNCTION public.protect_profile_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_verified_seller IS DISTINCT FROM OLD.is_verified_seller
     OR NEW.public_id IS DISTINCT FROM OLD.public_id
     OR NEW.verification_notes IS DISTINCT FROM OLD.verification_notes
     OR NEW.phone_verified_at IS DISTINCT FROM OLD.phone_verified_at
     OR NEW.discord_user_id IS DISTINCT FROM OLD.discord_user_id
     OR NEW.discord_guild_id IS DISTINCT FROM OLD.discord_guild_id
     OR NEW.discord_member_verified_at IS DISTINCT FROM OLD.discord_member_verified_at THEN
    RAISE EXCEPTION 'Apenas o servidor ou a moderação podem alterar dados de verificação';
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NEW.verification_status <> 'pending' THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar ou recusar a verificação';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_listing_phone_verification_trg ON public.products;
DROP FUNCTION IF EXISTS public.enforce_listing_phone_verification();

CREATE OR REPLACE FUNCTION public.enforce_listing_email_discord()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  email_ok boolean := false;
  discord_ok timestamptz;
BEGIN
  IF current_user IN ('postgres','service_role','supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para anunciar.' USING ERRCODE = '42501';
  END IF;

  IF NEW.seller_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Vendedor inválido.' USING ERRCODE = '42501';
  END IF;

  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  SELECT (u.email_confirmed_at IS NOT NULL)
    INTO email_ok
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF NOT COALESCE(email_ok,false) THEN
    RAISE EXCEPTION 'Confirme seu e-mail antes de anunciar.' USING ERRCODE = '42501';
  END IF;

  SELECT p.discord_member_verified_at
    INTO discord_ok
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF discord_ok IS NULL THEN
    RAISE EXCEPTION 'Entre no servidor do Discord e verifique sua conta antes de anunciar.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_listing_email_discord_trg ON public.products;
CREATE TRIGGER enforce_listing_email_discord_trg
BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_email_discord();

REVOKE ALL ON FUNCTION public.enforce_listing_email_discord() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_listing_email_discord() TO service_role;

CREATE INDEX IF NOT EXISTS profiles_discord_user_id_idx
  ON public.profiles(discord_user_id)
  WHERE discord_user_id IS NOT NULL;
