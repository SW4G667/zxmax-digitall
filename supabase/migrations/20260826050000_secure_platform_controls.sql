-- Controles administrativos de manutenção e limites operacionais.
-- A configuração pública fica limitada ao estado/mensagem de manutenção;
-- alterações continuam restritas a administradores autenticados e auditadas.

CREATE OR REPLACE FUNCTION public.get_platform_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'maintenance', COALESCE((value->>'maintenance')::boolean, false),
    'message', LEFT(COALESCE(value->>'maintenance_message', ''), 300)
  )
  FROM public.app_settings
  WHERE key = 'platform'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_admin_platform_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;

  SELECT value INTO settings FROM public.app_settings WHERE key = 'platform';
  RETURN jsonb_build_object(
    'maintenance', COALESCE((settings->>'maintenance')::boolean, false),
    'message', LEFT(COALESCE(settings->>'maintenance_message', ''), 300),
    'minProductPrice', COALESCE((settings->>'min_product_price')::numeric, 2),
    'minWithdraw', COALESCE((settings->>'min_withdraw')::numeric, 5)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_platform_settings(
  _maintenance boolean,
  _message text,
  _min_product_price numeric,
  _min_withdraw numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing jsonb := '{}'::jsonb;
  next_settings jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
  IF _message IS NULL OR char_length(btrim(_message)) > 300 THEN
    RAISE EXCEPTION 'A mensagem de manutenção deve ter até 300 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF _min_product_price IS NULL OR _min_product_price < 2 OR _min_product_price > 1000000 THEN
    RAISE EXCEPTION 'O preço mínimo deve ficar entre R$ 2,00 e R$ 1.000.000,00.' USING ERRCODE = '22023';
  END IF;
  IF _min_withdraw IS NULL OR _min_withdraw < 5 OR _min_withdraw > 1000000 THEN
    RAISE EXCEPTION 'O saque mínimo deve ficar entre R$ 5,00 e R$ 1.000.000,00.' USING ERRCODE = '22023';
  END IF;

  SELECT value INTO existing FROM public.app_settings WHERE key = 'platform';
  next_settings := COALESCE(existing, '{}'::jsonb) || jsonb_build_object(
    'maintenance', _maintenance,
    'maintenance_message', btrim(_message),
    'min_product_price', round(_min_product_price, 2),
    'min_withdraw', round(_min_withdraw, 2)
  );

  INSERT INTO public.app_settings(key, value)
  VALUES ('platform', next_settings)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  INSERT INTO public.admin_audit_log(actor_id, action, target_table, target_id, metadata)
  VALUES (
    auth.uid(),
    'platform.settings_updated',
    'app_settings',
    'platform',
    jsonb_build_object(
      'maintenance', _maintenance,
      'min_product_price', round(_min_product_price, 2),
      'min_withdraw', round(_min_withdraw, 2)
    )
  );

  RETURN public.get_admin_platform_settings();
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_platform_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_platform_settings(boolean, text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_status() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_platform_settings(boolean, text, numeric, numeric) TO authenticated, service_role;
