-- RLS for order-attachments bucket. Path format: <order_id>/<uploader_uid>/<filename>
CREATE POLICY "Order parties can read attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'order-attachments'
  AND (
    public.is_order_party((split_part(name, '/', 1))::bigint, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Order parties can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_order_party((split_part(name, '/', 1))::bigint, auth.uid())
);