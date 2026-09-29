ALTER TABLE public.order_messages
  ADD COLUMN IF NOT EXISTS sender_locale text;

COMMENT ON COLUMN public.order_messages.sender_locale IS
  'BCP-47 locale reported by the authenticated sender client, used only to decide whether to offer translation.';
