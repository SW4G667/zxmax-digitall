-- 1) Remove duplicate approval trigger (it fired twice on every product update)
DROP TRIGGER IF EXISTS protect_product_approval_trigger ON public.products;

-- 2) Never allow an administrator account to be banned
CREATE OR REPLACE FUNCTION public.prevent_admin_ban()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active = true AND public.has_role(NEW.user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Não é possível banir uma conta administradora';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_admin_ban_trg ON public.bans;
CREATE TRIGGER prevent_admin_ban_trg
BEFORE INSERT OR UPDATE ON public.bans
FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_ban();

-- 3) Lift any active ban currently applied to an administrator
UPDATE public.bans b
SET active = false
WHERE b.active = true
  AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = b.user_id AND r.role = 'admin'::app_role);