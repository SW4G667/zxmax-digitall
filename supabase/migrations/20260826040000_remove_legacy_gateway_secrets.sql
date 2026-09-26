-- ZXMAX · Remove credenciais históricas de JSON administrativo e audita mudanças.
-- Após esta migração, secrets devem existir apenas nas variáveis de Edge Functions.

UPDATE public.app_settings
SET value = value
  - 'apiKey'
  - 'clientSecret'
  - 'secretKey'
  - 'webhookSecret'
  - 'webhookToken'
  - 'publishableKey'
  - 'clientId'
WHERE key IN ('zennithpay', 'vexopay', 'evopay', 'stripe', 'discord');

CREATE OR REPLACE FUNCTION public.log_app_settings_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, metadata)
    VALUES (
      auth.uid(),
      'gateway.config_changed',
      'app_settings',
      NEW.key,
      jsonb_build_object('changed_keys', ARRAY(SELECT jsonb_object_keys(NEW.value)))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_app_settings_change_trg ON public.app_settings;
CREATE TRIGGER log_app_settings_change_trg
AFTER UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.log_app_settings_change();

REVOKE ALL ON FUNCTION public.log_app_settings_change() FROM PUBLIC, anon, authenticated;
