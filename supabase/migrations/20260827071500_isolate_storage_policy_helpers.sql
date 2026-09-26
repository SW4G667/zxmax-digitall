-- Storage policies must not depend on a helper whose direct execution is
-- denied to the authenticated role. The new helpers bind every check to the
-- current session and safely reject arbitrary product-image paths.

CREATE OR REPLACE FUNCTION public.is_current_order_party(_order_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.purchases
      WHERE id = _order_id
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
$$;

CREATE OR REPLACE FUNCTION public.is_current_order_attachment_party(_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_segment text;
  order_identifier bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  order_segment := split_part(COALESCE(_object_name, ''), '/', 1);
  IF order_segment !~ '^[0-9]+$' OR order_segment::numeric > 9223372036854775807 THEN
    RETURN false;
  END IF;
  order_identifier := order_segment::bigint;
  RETURN public.is_current_order_party(order_identifier);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_current_order_chat_open(_order_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_current_order_party(_order_id)
    AND EXISTS (
      SELECT 1
      FROM public.purchases
      WHERE id = _order_id
        AND status IN ('paid', 'delivered', 'dispute')
    )
$$;

REVOKE ALL ON FUNCTION public.is_current_order_party(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_current_order_attachment_party(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_current_order_chat_open(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_order_party(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_current_order_attachment_party(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_current_order_chat_open(bigint) TO authenticated, service_role;

DROP POLICY IF EXISTS "Order parties and admins can read messages" ON public.order_messages;
CREATE POLICY "Order parties and admins can read messages"
ON public.order_messages FOR SELECT
TO authenticated
USING (
  public.is_current_order_party(order_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Order parties can send messages when chat open" ON public.order_messages;
CREATE POLICY "Order parties can send messages when chat open"
ON public.order_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_current_order_chat_open(order_id)
);

DROP POLICY IF EXISTS "Order parties can read attachments" ON storage.objects;
CREATE POLICY "Order parties can read attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'order-attachments'
  AND (
    public.is_current_order_attachment_party(name)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Order parties can upload attachments" ON storage.objects;
CREATE POLICY "Order parties can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_current_order_attachment_party(name)
);
