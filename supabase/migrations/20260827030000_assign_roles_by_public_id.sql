-- O painel usa somente ID público para localizar operadores. Nenhuma interface
-- administrativa precisa transportar endereço de e-mail para gerir papel ou
-- capacidade.

CREATE OR REPLACE FUNCTION public.assign_user_role_by_public_id(
  _public_id bigint,
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
  PERFORM public.require_primary_admin();

  IF _public_id IS NULL OR _public_id <= 0 THEN
    RAISE EXCEPTION 'invalid_public_id' USING ERRCODE = '22023';
  END IF;

  SELECT p.user_id INTO target_user_id
  FROM public.profiles p
  WHERE p.public_id = _public_id
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
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

  IF _role <> 'support'::public.app_role THEN
    DELETE FROM public.user_capabilities WHERE user_id = target_user_id;
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, metadata)
  VALUES (
    auth.uid(),
    'role.transitioned',
    'user_roles',
    target_user_id::text,
    jsonb_build_object(
      'public_id', _public_id,
      'previous_roles', to_jsonb(previous_roles),
      'new_role', _role
    )
  );

  RETURN assigned;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_capabilities(
  _public_id bigint,
  _capabilities text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  target_role public.app_role;
  normalized_capabilities text[];
  previous_capabilities text[];
BEGIN
  PERFORM public.require_primary_admin();

  IF _public_id IS NULL OR _public_id <= 0 THEN
    RAISE EXCEPTION 'invalid_public_id' USING ERRCODE = '22023';
  END IF;

  SELECT p.user_id INTO target_user_id
  FROM public.profiles p
  WHERE p.public_id = _public_id
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT ur.role INTO target_role
  FROM public.user_roles ur
  WHERE ur.user_id = target_user_id
  ORDER BY ur.role
  LIMIT 1;

  IF target_role <> 'support'::public.app_role THEN
    RAISE EXCEPTION 'capabilities_require_support_role' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT capability ORDER BY capability), ARRAY[]::text[])
    INTO normalized_capabilities
  FROM unnest(COALESCE(_capabilities, ARRAY[]::text[])) AS capability
  WHERE capability IN (
    'moderate_catalog',
    'review_identity',
    'manage_user_safety',
    'manage_tags',
    'view_sanitized_webhooks'
  );

  IF COALESCE(array_length(normalized_capabilities, 1), 0)
      <> COALESCE(array_length(_capabilities, 1), 0) THEN
    RAISE EXCEPTION 'invalid_capability' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(uc.capability ORDER BY uc.capability), ARRAY[]::text[])
    INTO previous_capabilities
  FROM public.user_capabilities uc
  WHERE uc.user_id = target_user_id;

  DELETE FROM public.user_capabilities WHERE user_id = target_user_id;
  INSERT INTO public.user_capabilities (user_id, capability, granted_by)
  SELECT target_user_id, capability, auth.uid()
  FROM unnest(normalized_capabilities) AS capability;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, metadata)
  VALUES (
    auth.uid(),
    'capabilities.replaced',
    'user_capabilities',
    target_user_id::text,
    jsonb_build_object(
      'public_id', _public_id,
      'previous_capabilities', to_jsonb(previous_capabilities),
      'new_capabilities', to_jsonb(normalized_capabilities)
    )
  );

  RETURN jsonb_build_object('public_id', _public_id, 'capabilities', to_jsonb(normalized_capabilities));
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role_by_public_id(bigint, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role_by_public_id(bigint, public.app_role) TO authenticated, service_role;
