-- Perfis contêm e-mail, chave Pix e dados de verificação. Nunca devem ser
-- consultáveis como diretório público. A vitrine usa a view mínima abaixo.
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view safe seller profiles" ON public.profiles;

REVOKE ALL ON public.profiles FROM anon;

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  user_id,
  public_id,
  display_name,
  avatar_url,
  is_verified_seller,
  created_at
FROM public.profiles;

REVOKE ALL ON public.profiles_public FROM anon, authenticated;
GRANT SELECT ON public.profiles_public TO anon, authenticated, service_role;
