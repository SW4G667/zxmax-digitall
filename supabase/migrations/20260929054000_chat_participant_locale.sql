ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale text,
  ADD COLUMN IF NOT EXISTS country_code text;

CREATE OR REPLACE FUNCTION public.get_order_participant_locales(_order_id bigint)
RETURNS TABLE(user_id uuid, locale text, country_code text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.locale, p.country_code
  FROM public.profiles p
  WHERE p.user_id IN (
    SELECT buyer_id FROM public.purchases WHERE id = _order_id
    UNION
    SELECT seller_id FROM public.purchases WHERE id = _order_id
  )
  AND EXISTS (
    SELECT 1 FROM public.purchases o
    WHERE o.id = _order_id
      AND auth.uid() IN (o.buyer_id, o.seller_id)
  );
$$;

REVOKE ALL ON FUNCTION public.get_order_participant_locales(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_participant_locales(bigint) TO authenticated;
