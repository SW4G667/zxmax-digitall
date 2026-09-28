-- Listing gate: no phone/SMS requirement.
-- A normal seller may create an announcement only after confirming the ZXMAX
-- e-mail and proving that the linked Discord identity belongs to the official
-- server configured by an administrator.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discord_user_id text,
  ADD COLUMN IF NOT EXISTS discord_guild_id text,
  ADD COLUMN IF NOT EXISTS discord_member_verified_at timestamptz;

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
  verified_at timestamptz;
  verified_guild_id text := '';
  configured_guild_id text := '';
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role'
     OR session_user IN ('postgres','supabase_admin') THEN
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

  SELECT COALESCE(value->>'discordGuildId','')
    INTO configured_guild_id
  FROM public.app_settings
  WHERE key = 'site_branding';

  IF configured_guild_id = '' THEN
    RAISE EXCEPTION 'O servidor oficial do Discord ainda não foi configurado pela administração.' USING ERRCODE = '42501';
  END IF;

  SELECT p.discord_member_verified_at, COALESCE(p.discord_guild_id,'')
    INTO verified_at, verified_guild_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF verified_at IS NULL THEN
    RAISE EXCEPTION 'Entre no servidor oficial do Discord e verifique sua conta antes de anunciar.' USING ERRCODE = '42501';
  END IF;

  IF verified_guild_id IS DISTINCT FROM configured_guild_id THEN
    RAISE EXCEPTION 'O servidor oficial do Discord mudou. Verifique sua participação novamente antes de anunciar.' USING ERRCODE = '42501';
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
