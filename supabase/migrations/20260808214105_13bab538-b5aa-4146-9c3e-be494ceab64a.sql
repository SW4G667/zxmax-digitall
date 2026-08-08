REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_banned(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_order_party(bigint, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.order_chat_open(bigint) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_withdrawal(bigint, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(bigint, text) FROM authenticated;