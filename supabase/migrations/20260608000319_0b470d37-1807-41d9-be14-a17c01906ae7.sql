-- Add Pix charge tracking columns to purchases
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS evopay_charge_id text,
  ADD COLUMN IF NOT EXISTS pix_qr_code text,
  ADD COLUMN IF NOT EXISTS pix_expires_at timestamptz;

-- Validate product price minimum (>= 5) without CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_product_price()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price < 5 THEN
    RAISE EXCEPTION 'O preço mínimo de um produto é R$ 5,00';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS validate_product_price_trg ON public.products;
CREATE TRIGGER validate_product_price_trg
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_price();

-- Order messages table (real chat per order)
CREATE TABLE IF NOT EXISTS public.order_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id bigint NOT NULL,
  sender_id uuid NOT NULL,
  body text,
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON public.order_messages(order_id);

GRANT SELECT, INSERT ON public.order_messages TO authenticated;
GRANT ALL ON public.order_messages TO service_role;

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Helper: is the user a party of the order
CREATE OR REPLACE FUNCTION public.is_order_party(_order_id bigint, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchases
    WHERE id = _order_id AND (buyer_id = _user_id OR seller_id = _user_id)
  )
$$;

-- Helper: order is in a chat-enabled status (paid/delivered)
CREATE OR REPLACE FUNCTION public.order_chat_open(_order_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchases
    WHERE id = _order_id AND status IN ('paid','delivered','dispute')
  )
$$;

CREATE POLICY "Order parties and admins can read messages"
ON public.order_messages FOR SELECT
TO authenticated
USING (public.is_order_party(order_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Order parties can send messages when chat open"
ON public.order_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_order_party(order_id, auth.uid())
  AND public.order_chat_open(order_id)
);

-- Realtime
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;