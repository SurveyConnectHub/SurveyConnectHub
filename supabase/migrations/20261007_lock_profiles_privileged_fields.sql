-- Prevent self-escalation through mutable authorization columns on profiles.
-- Users may update their own profile, but role/is_admin must remain unchanged.

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION prevent_profile_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT is_admin INTO caller_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  IF COALESCE(caller_is_admin, false)
     OR (NEW.role IS NOT DISTINCT FROM OLD.role
         AND NEW.is_admin IS NOT DISTINCT FROM OLD.is_admin) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Profile privilege fields can only be changed by an administrator';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_changes ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_changes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_changes();
