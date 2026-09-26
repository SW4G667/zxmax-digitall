-- Reforça a camada recém-criada de capacidades: toda ação delegável exige
-- sessão AAL2 e decisão de capacidade feita no banco. Poderes de plataforma e
-- financeiros permanecem sob o papel admin, fora desta allow-list.

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
  IF auth.uid() IS NULL
     OR _user_id IS NULL
     OR COALESCE(auth.jwt() ->> 'aal', '') <> 'aal2' THEN
    RETURN false;
  END IF;

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

CREATE OR REPLACE FUNCTION public.require_primary_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR COALESCE(auth.jwt() ->> 'aal', '') <> 'aal2'
     OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Você não tem a permissão necessária para esta ação.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_admin_capability(_capability text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_capability(auth.uid(), _capability) THEN
    RAISE EXCEPTION 'Você não tem a permissão necessária para esta ação.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.moderate_product(
  _product_id bigint,
  _approved boolean,
  _reason text DEFAULT NULL
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed public.products;
BEGIN
  PERFORM public.require_admin_capability('moderate_catalog');

  UPDATE public.products
  SET approved = _approved,
      updated_at = now()
  WHERE id = _product_id
  RETURNING * INTO changed;

  IF changed IS NULL THEN
    RAISE EXCEPTION 'Anúncio não encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, reason, metadata)
  VALUES (
    auth.uid(),
    CASE WHEN _approved THEN 'product.approved' ELSE 'product.unapproved' END,
    'products',
    _product_id::text,
    NULLIF(btrim(_reason), ''),
    jsonb_build_object('seller_id', changed.seller_id, 'name', changed.name)
  );

  RETURN changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_user_tags()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.require_admin_capability('manage_tags');
  SELECT jsonb_build_object(
    'tags', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY lower(t.name)) FROM public.user_tags t), '[]'::jsonb),
    'assignments', COALESCE((
      SELECT jsonb_object_agg(tagged.public_id::text, tagged.tag_ids)
      FROM (
        SELECT p.public_id, jsonb_agg(a.tag_id::text ORDER BY a.tag_id::text) AS tag_ids
        FROM public.user_tag_assignments a
        JOIN public.profiles p ON p.user_id = a.user_id
        GROUP BY p.public_id
      ) tagged
    ), '{}'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_admin_user_tag(_name text, _color text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tag_name text := btrim(COALESCE(_name, ''));
  tag_color text := lower(btrim(COALESCE(_color, '')));
  tag_id uuid;
BEGIN
  PERFORM public.require_admin_capability('manage_tags');
  IF char_length(tag_name) < 2 OR char_length(tag_name) > 32 THEN RAISE EXCEPTION 'invalid_tag_name'; END IF;
  IF tag_color !~ '^#[0-9a-f]{6}$' THEN RAISE EXCEPTION 'invalid_tag_color'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_tags WHERE lower(name) = lower(tag_name)) THEN RAISE EXCEPTION 'tag_already_exists'; END IF;
  INSERT INTO public.user_tags(name, color) VALUES (tag_name, tag_color) RETURNING id INTO tag_id;
  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, metadata)
  VALUES (auth.uid(), 'tag.created', 'user_tags', tag_id::text, jsonb_build_object('name', tag_name, 'color', tag_color));
  RETURN tag_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_admin_user_tag(_tag_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin_capability('manage_tags');
  DELETE FROM public.user_tags WHERE id = _tag_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tag_not_found'; END IF;
  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, metadata)
  VALUES (auth.uid(), 'tag.deleted', 'user_tags', _tag_id::text, '{}'::jsonb);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_admin_user_tag(_public_id bigint, _tag_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE target_user uuid;
BEGIN
  PERFORM public.require_admin_capability('manage_tags');
  SELECT user_id INTO target_user FROM public.profiles WHERE public_id = _public_id;
  IF target_user IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_tags WHERE id = _tag_id) THEN RAISE EXCEPTION 'tag_not_found'; END IF;
  INSERT INTO public.user_tag_assignments(user_id, tag_id) VALUES (target_user, _tag_id) ON CONFLICT (user_id, tag_id) DO NOTHING;
  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, metadata)
  VALUES (auth.uid(), 'tag.assigned', 'user_tag_assignments', target_user::text, jsonb_build_object('public_id', _public_id, 'tag_id', _tag_id));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.unassign_admin_user_tag(_public_id bigint, _tag_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE target_user uuid;
BEGIN
  PERFORM public.require_admin_capability('manage_tags');
  SELECT user_id INTO target_user FROM public.profiles WHERE public_id = _public_id;
  IF target_user IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  DELETE FROM public.user_tag_assignments WHERE user_id = target_user AND tag_id = _tag_id;
  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, metadata)
  VALUES (auth.uid(), 'tag.unassigned', 'user_tag_assignments', target_user::text, jsonb_build_object('public_id', _public_id, 'tag_id', _tag_id));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.require_primary_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_admin_capability(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.require_primary_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.require_admin_capability(text) TO service_role;
