-- A troca de cargo é uma transição exclusiva: não pode deixar privilégios
-- antigos acumulados nem permitir que o único operador se rebaixe pelo painel.
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
  previous_roles public.app_role[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem atribuir cargos' USING ERRCODE = '42501';
  END IF;

  IF _email IS NULL OR btrim(_email) = '' THEN
    RAISE EXCEPTION 'E-mail obrigatório' USING ERRCODE = '22023';
  END IF;

  SELECT p.user_id INTO target_user_id
  FROM public.profiles AS p
  WHERE lower(p.email) = lower(btrim(_email))
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF target_user_id = auth.uid() AND _role <> 'admin'::public.app_role THEN
    RAISE EXCEPTION 'Você não pode remover seu próprio cargo administrativo pelo painel' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(role ORDER BY role), ARRAY[]::public.app_role[])
    INTO previous_roles
  FROM public.user_roles
  WHERE user_id = target_user_id;

  DELETE FROM public.user_roles WHERE user_id = target_user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, _role)
  RETURNING * INTO assigned;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, metadata)
  VALUES (
    auth.uid(),
    'role.transitioned',
    'user_roles',
    target_user_id::text,
    jsonb_build_object('previous_roles', to_jsonb(previous_roles), 'new_role', _role)
  );

  RETURN assigned;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role(text, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(text, public.app_role) TO authenticated, service_role;
