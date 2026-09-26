-- Capacidades delegáveis são uma camada complementar aos papéis existentes.
-- Admin mantém o controle integral e não pode receber nem perder capacidades por
-- esta tabela. Somente ações de baixo/médio risco que já têm contratos no
-- servidor entram nesta allow-list; manutenção, cargos, integrações, segredos,
-- saques, reembolsos e pagamentos continuam exclusivamente com admin.

CREATE TABLE IF NOT EXISTS public.user_capabilities (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability text NOT NULL CHECK (capability IN (
    'moderate_catalog',
    'review_identity',
    'manage_user_safety',
    'manage_tags',
    'view_sanitized_webhooks'
  )),
  granted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, capability)
);

CREATE INDEX IF NOT EXISTS user_capabilities_user_id_idx
  ON public.user_capabilities (user_id);

ALTER TABLE public.user_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_capabilities FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_capability(
  _user_id uuid,
  _capability text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Um chamador só pode consultar a própria capacidade; admin também pode
  -- consultar a capacidade de outro usuário para alimentar o diretório seguro.
  IF _user_id <> auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN false;
  END IF;

  IF _capability NOT IN (
    'moderate_catalog',
    'review_identity',
    'manage_user_safety',
    'manage_tags',
    'view_sanitized_webhooks'
  ) THEN
    RETURN false;
  END IF;

  -- Administradores continuam irrecuperáveis por esta tabela de delegação.
  IF public.has_role(_user_id, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  RETURN public.has_role(_user_id, 'support'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.user_capabilities uc
      WHERE uc.user_id = _user_id
        AND uc.capability = _capability
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_capabilities()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role public.app_role;
  allowed text[] := ARRAY[
    'moderate_catalog',
    'review_identity',
    'manage_user_safety',
    'manage_tags',
    'view_sanitized_webhooks'
  ];
  resolved_capabilities jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  SELECT ur.role INTO current_role
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  ORDER BY ur.role
  LIMIT 1;

  IF current_role = 'admin'::public.app_role THEN
    resolved_capabilities := to_jsonb(allowed);
  ELSIF current_role = 'support'::public.app_role THEN
    SELECT COALESCE(jsonb_agg(uc.capability ORDER BY uc.capability), '[]'::jsonb)
      INTO resolved_capabilities
    FROM public.user_capabilities uc
    WHERE uc.user_id = auth.uid();
  ELSE
    resolved_capabilities := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'role', COALESCE(current_role::text, 'user'),
    'capabilities', resolved_capabilities
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_capability_directory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'public_id', p.public_id,
        'display_name', p.display_name,
        'role', ur.role,
        'capabilities', CASE
          WHEN ur.role = 'admin'::public.app_role THEN to_jsonb(ARRAY[
            'moderate_catalog',
            'review_identity',
            'manage_user_safety',
            'manage_tags',
            'view_sanitized_webhooks'
          ]::text[])
          ELSE COALESCE((
            SELECT jsonb_agg(uc.capability ORDER BY uc.capability)
            FROM public.user_capabilities uc
            WHERE uc.user_id = ur.user_id
          ), '[]'::jsonb)
        END
      )
      ORDER BY p.public_id
    )
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.role IN ('admin'::public.app_role, 'support'::public.app_role)
  ), '[]'::jsonb);
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
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

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

-- Ao remover suporte, remover imediatamente delegações que só fazem sentido
-- naquele papel. A atribuição de admin continua imutável por esse mecanismo.
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

  IF _role <> 'support'::public.app_role THEN
    DELETE FROM public.user_capabilities WHERE user_id = target_user_id;
  END IF;

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

REVOKE ALL ON FUNCTION public.has_capability(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_admin_capabilities() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_capability_directory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_user_capabilities(bigint, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_admin_capabilities() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_capability_directory() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_user_capabilities(bigint, text[]) TO authenticated, service_role;
