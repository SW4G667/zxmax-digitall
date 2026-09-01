-- Atribuição de papéis só ocorre no banco: o navegador não pode escrever
-- diretamente em user_roles nem descobrir IDs internos de perfil.
CREATE OR REPLACE FUNCTION public.assign_user_role(
  _email text,
  _role public.app_role
)
RETURNS public.user_roles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  assigned public.user_roles;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem atribuir cargos' USING ERRCODE = '42501';
  END IF;

  IF _email IS NULL OR btrim(_email) = '' THEN
    RAISE EXCEPTION 'E-mail obrigatório' USING ERRCODE = '22023';
  END IF;

  SELECT p.user_id
    INTO target_user_id
    FROM public.profiles AS p
   WHERE lower(p.email) = lower(btrim(_email))
   LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, _role)
  ON CONFLICT (user_id, role) DO UPDATE SET role = EXCLUDED.role
  RETURNING * INTO assigned;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, metadata)
  VALUES (
    auth.uid(),
    'role.assigned',
    'user_roles',
    target_user_id::text,
    jsonb_build_object('role', _role)
  );

  RETURN assigned;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role(text, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(text, public.app_role) TO authenticated, service_role;
