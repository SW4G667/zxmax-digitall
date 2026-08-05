CREATE OR REPLACE FUNCTION public.protect_profile_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_verified_seller IS DISTINCT FROM OLD.is_verified_seller
     OR NEW.public_id IS DISTINCT FROM OLD.public_id
     OR NEW.verification_notes IS DISTINCT FROM OLD.verification_notes THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar o status de verificação';
  END IF;

  -- usuário só pode colocar o próprio cadastro em análise
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NEW.verification_status <> 'pending' THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar ou recusar a verificação';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_verification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_verification_trg ON public.profiles;
CREATE TRIGGER protect_profile_verification_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_verification();