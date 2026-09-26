-- A instância possui um grant explícito para anon em algumas funções legadas.
-- A autorização interna exige sessão, mas removemos a superfície anônima por defesa em profundidade.

REVOKE ALL ON FUNCTION public.update_platform_categories(text[]) FROM anon;
REVOKE ALL ON FUNCTION public.update_platform_categories(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_platform_categories(text[]) TO authenticated, service_role;
