-- Remove the old placeholder that used the support URL as if it were the
-- official Discord invitation. Administrators must explicitly save a valid
-- invite in the Discord invite field.
UPDATE public.app_settings
SET value = jsonb_set(COALESCE(value,'{}'::jsonb), '{supportUrl}', '""'::jsonb, true)
WHERE key = 'site_branding'
  AND COALESCE(value->>'discordInviteUrl','') = ''
  AND COALESCE(value->>'supportUrl','') = 'https://discord.gg/zxmax';
