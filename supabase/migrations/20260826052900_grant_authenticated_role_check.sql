-- O cliente nunca recebe um papel por cache. Ele consulta esta RPC, que valida
-- o papel no banco. Sem o grant autenticado, toda conta é apresentada como não
-- administrativa apesar de o registro estar correto.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
