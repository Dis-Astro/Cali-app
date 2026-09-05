-- Additive guard: keep self-service profile edits, but never self-promotion.
-- RLS remains responsible for which rows the caller may update.
CREATE OR REPLACE FUNCTION public.protect_profile_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    IF COALESCE(auth.role(), '') = 'service_role'
       OR (auth.uid() IS NULL AND auth.role() IS NULL AND session_user = 'postgres')
       OR public.is_admin(auth.uid()) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Solo un amministratore può modificare ruolo e identità del profilo'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_profile_identity
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_identity();
