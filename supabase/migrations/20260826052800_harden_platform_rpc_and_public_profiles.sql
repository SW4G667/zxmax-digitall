-- Hardening posterior ao Security Advisor:
-- 1. As RPCs administrativas continuam disponíveis a authenticated, mas nunca anon.
-- 2. O diretório público vira uma tabela projetada, evitando uma view SECURITY DEFINER.

REVOKE ALL ON FUNCTION public.get_admin_platform_settings() FROM anon;
REVOKE ALL ON FUNCTION public.update_platform_settings(boolean, text, numeric, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.get_admin_platform_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_platform_settings(boolean, text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_platform_settings(boolean, text, numeric, numeric) TO authenticated, service_role;

DROP VIEW IF EXISTS public.profiles_public;

CREATE TABLE public.profiles_public (
  user_id uuid PRIMARY KEY,
  public_id bigint NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  is_verified_seller boolean NOT NULL DEFAULT false,
  created_at timestamptz
);

ALTER TABLE public.profiles_public ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profiles_public FROM PUBLIC;
GRANT SELECT ON TABLE public.profiles_public TO anon, authenticated, service_role;

CREATE POLICY "Public profiles expose only safe fields"
ON public.profiles_public
FOR SELECT
TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.sync_public_profile_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles_public (user_id, public_id, display_name, avatar_url, is_verified_seller, created_at)
  VALUES (
    NEW.user_id,
    NEW.public_id,
    COALESCE(NULLIF(btrim(NEW.display_name), ''), 'Usuário'),
    NEW.avatar_url,
    COALESCE(NEW.is_verified_seller, false),
    NEW.created_at
  )
  ON CONFLICT (user_id) DO UPDATE SET
    public_id = EXCLUDED.public_id,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    is_verified_seller = EXCLUDED.is_verified_seller,
    created_at = EXCLUDED.created_at;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_public_profile_projection() FROM PUBLIC, anon, authenticated;

INSERT INTO public.profiles_public (user_id, public_id, display_name, avatar_url, is_verified_seller, created_at)
SELECT
  user_id,
  public_id,
  COALESCE(NULLIF(btrim(display_name), ''), 'Usuário'),
  avatar_url,
  COALESCE(is_verified_seller, false),
  created_at
FROM public.profiles
ON CONFLICT (user_id) DO UPDATE SET
  public_id = EXCLUDED.public_id,
  display_name = EXCLUDED.display_name,
  avatar_url = EXCLUDED.avatar_url,
  is_verified_seller = EXCLUDED.is_verified_seller,
  created_at = EXCLUDED.created_at;

DROP TRIGGER IF EXISTS sync_public_profile_projection ON public.profiles;
CREATE TRIGGER sync_public_profile_projection
AFTER INSERT OR UPDATE OF public_id, display_name, avatar_url, is_verified_seller, created_at
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_profile_projection();
