-- V8: branding images include hero/social/promo banners, so the site-assets
-- bucket needs a banner-sized limit and an explicit safe image allow-list.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY[
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/x-icon'
    ]::text[]
WHERE id = 'site-assets';
