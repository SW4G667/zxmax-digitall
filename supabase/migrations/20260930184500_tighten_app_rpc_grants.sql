-- Tighten execution grants after the App security sweep.
-- Public status/fee functions intentionally remain public. Internal trigger,
-- admin and balance helpers do not.

revoke all on function public.get_my_app_dashboard() from public,anon,authenticated;
grant execute on function public.get_my_app_dashboard() to service_role;

revoke all on function public.merchant_gateway_available_balance(uuid) from public,anon,authenticated;
grant execute on function public.merchant_gateway_available_balance(uuid) to service_role;

revoke all on function public.block_banned_user_write() from public,anon,authenticated;
revoke all on function public.enforce_fresh_listing_membership() from public,anon,authenticated;
revoke all on function public.notify_order_message() from public,anon,authenticated;
revoke all on function public.notify_withdrawal_change() from public,anon,authenticated;

revoke all on function public.admin_adjust_wallet_balance(bigint,numeric,text) from public,anon;
grant execute on function public.admin_adjust_wallet_balance(bigint,numeric,text) to authenticated;

revoke all on function public.get_admin_financial_activity(integer) from public,anon;
grant execute on function public.get_admin_financial_activity(integer) to authenticated;

revoke all on function public.request_gateway_withdrawal(numeric,text,text) from public,anon;
grant execute on function public.request_gateway_withdrawal(numeric,text,text) to authenticated;
