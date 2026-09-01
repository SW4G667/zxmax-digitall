-- Categorias são configuração global: apenas administradores autenticados podem alterá-las.
-- O cliente nunca escreve diretamente em app_settings.

CREATE OR REPLACE FUNCTION public.update_platform_categories(_categories text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing jsonb := '{}'::jsonb;
  normalized text[];
  category text;
  category_count integer;
  distinct_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;

  IF _categories IS NULL OR cardinality(_categories) < 1 OR cardinality(_categories) > 30 THEN
    RAISE EXCEPTION 'Informe entre 1 e 30 categorias.' USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(btrim(value) ORDER BY ordinality)
    INTO normalized
  FROM unnest(_categories) WITH ORDINALITY AS entries(value, ordinality);

  FOREACH category IN ARRAY normalized LOOP
    IF char_length(category) < 2 OR char_length(category) > 64 OR category ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'Cada categoria deve ter entre 2 e 64 caracteres válidos.' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  SELECT count(*), count(DISTINCT lower(value))
    INTO category_count, distinct_count
  FROM unnest(normalized) AS entries(value);
  IF category_count <> distinct_count THEN
    RAISE EXCEPTION 'Não repita categorias.' USING ERRCODE = '22023';
  END IF;

  SELECT value INTO existing FROM public.app_settings WHERE key = 'platform';
  existing := COALESCE(existing, '{}'::jsonb) || jsonb_build_object('categories', to_jsonb(normalized));

  INSERT INTO public.app_settings(key, value)
  VALUES ('platform', existing)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, metadata)
  VALUES (
    auth.uid(),
    'platform.categories_updated',
    'app_settings',
    'platform',
    jsonb_build_object('category_count', category_count)
  );

  RETURN jsonb_build_object('categories', to_jsonb(normalized));
END;
$$;

REVOKE ALL ON FUNCTION public.update_platform_categories(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_platform_categories(text[]) TO authenticated, service_role;
