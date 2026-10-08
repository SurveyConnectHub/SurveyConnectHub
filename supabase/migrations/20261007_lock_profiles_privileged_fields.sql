-- Prevent self-escalation through mutable authorization columns on profiles.
-- Users may update their own profile, but role/is_admin must remain unchanged.

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND EXISTS (
      SELECT 1
      FROM profiles current_profile
      WHERE current_profile.id = auth.uid()
        AND current_profile.role = role
        AND current_profile.is_admin IS NOT DISTINCT FROM is_admin
    )
  );
