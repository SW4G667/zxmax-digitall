-- The client pre-validates these values for a clear message; the bucket enforces
-- them for every Storage client and prevents oversized or non-image uploads.
UPDATE storage.buckets
SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'product-images';
