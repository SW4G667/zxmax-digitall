-- Social link preview images are no longer configurable in ZXMAX.
UPDATE public.app_settings
SET value = value - 'socialPreviewUrl'
WHERE key = 'site_branding'
  AND jsonb_typeof(value) = 'object';
