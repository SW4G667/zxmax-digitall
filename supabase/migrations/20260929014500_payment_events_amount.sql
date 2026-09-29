-- apply_verified_payment_v2 records the provider-confirmed amount for audit.
-- Older production schema missed this column, causing every verified payment
-- application to fail after the provider returned COMPLETED.
alter table public.payment_events
  add column if not exists amount numeric;

comment on column public.payment_events.amount is
  'Amount confirmed by the payment provider for this event.';
