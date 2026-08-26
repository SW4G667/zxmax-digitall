-- Configurações públicas de gateway podem guardar toggles/taxas, nunca credenciais.
UPDATE public.app_settings
SET value = COALESCE(value, '{}'::jsonb)
  - 'apiKey' - 'api_key' - 'secret' - 'secretKey' - 'clientSecret'
  - 'accessToken' - 'access_token' - 'token' - 'webhookSecret'
WHERE key IN ('zennithpay', 'vexopay', 'stripe', 'evopay');
