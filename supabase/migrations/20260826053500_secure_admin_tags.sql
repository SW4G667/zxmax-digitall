-- Tags são dados operacionais: administração ocorre apenas por RPCs auditadas.
DROP POLICY IF EXISTS "Admins can manage tags" ON public.user_tags;
DROP POLICY IF EXISTS "Admins can manage tag assignments" ON public.user_tag_assignments;
DROP POLICY IF EXISTS "Users can view own tag assignments and admins can view all" ON public.user_tag_assignments;

CREATE POLICY "Users can view own tag assignments"
ON public.user_tag_assignments
FOR SELECT TO authenticated
USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.user_tags FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_tag_assignments FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_user_tags()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

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
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'admin_required'; END IF;
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
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'admin_required'; END IF;
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
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'admin_required'; END IF;
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
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'admin_required'; END IF;
  SELECT user_id INTO target_user FROM public.profiles WHERE public_id = _public_id;
  IF target_user IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  DELETE FROM public.user_tag_assignments WHERE user_id = target_user AND tag_id = _tag_id;
  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, metadata)
  VALUES (auth.uid(), 'tag.unassigned', 'user_tag_assignments', target_user::text, jsonb_build_object('public_id', _public_id, 'tag_id', _tag_id));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_tags() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_admin_user_tag(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_admin_user_tag(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_admin_user_tag(bigint, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unassign_admin_user_tag(bigint, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_tags() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_admin_user_tag(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_admin_user_tag(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_admin_user_tag(bigint, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unassign_admin_user_tag(bigint, uuid) TO authenticated, service_role;
