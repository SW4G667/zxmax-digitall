REVOKE EXECUTE ON FUNCTION public.withdrawable_balance(uuid, bigint) FROM authenticated;

CREATE OR REPLACE FUNCTION public.current_user_withdrawable_balance()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 0::numeric
    ELSE public.withdrawable_balance(auth.uid(), NULL)
  END
$$;

REVOKE ALL ON FUNCTION public.current_user_withdrawable_balance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_withdrawable_balance() TO authenticated, service_role;