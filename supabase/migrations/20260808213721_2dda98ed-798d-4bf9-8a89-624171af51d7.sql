GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

GRANT EXECUTE ON FUNCTION public.withdrawable_balance(uuid, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(bigint, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(bigint, text) TO authenticated, service_role;