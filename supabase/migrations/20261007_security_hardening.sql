-- Restrict direct profile reads to owners and contract participants.
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_select_contract_participant" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.contracts c
      WHERE (c.client_id = auth.uid() OR c.professional_id = auth.uid())
        AND (c.client_id = profiles.id OR c.professional_id = profiles.id)
    )
  );

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT id, full_name, username, country, city, bio, avatar_url
FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Public professional data is exposed through a safe view; private verification
-- and document fields remain owner/service-role only.
DROP POLICY IF EXISTS "prof_profiles_select_all" ON public.professional_profiles;
CREATE POLICY "prof_profiles_select_own" ON public.professional_profiles
  FOR SELECT USING (id = auth.uid());

CREATE OR REPLACE VIEW public.public_professional_profiles
WITH (security_invoker = false) AS
SELECT
  pp.id,
  pp.profession_type,
  pp.secondary_profession,
  pp.years_experience,
  pp.skills,
  pp.certifications,
  pp.hourly_rate,
  pp.portfolio_description,
  pp.total_jobs_completed,
  pp.total_earned,
  pp.average_rating,
  pp.total_reviews,
  pp.software_tools,
  pp.survey_equipment,
  pp.delivery_formats,
  pp.job_types_supported,
  pp.primary_disciplines,
  pp.service_area_label,
  pp.service_area_radius_km,
  pp.verification_status,
  pp.created_at,
  p.full_name,
  p.username,
  p.country,
  p.city,
  p.bio,
  p.avatar_url
FROM public.professional_profiles pp
JOIN public.profiles p ON p.id = pp.id
WHERE pp.verification_status = 'verified';
GRANT SELECT ON public.public_professional_profiles TO anon, authenticated;

-- Only administrators or server-side jobs may change verification controls.
CREATE OR REPLACE FUNCTION prevent_client_verification_changes()
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

  IF COALESCE(caller_is_admin, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.id_document_url IS DISTINCT FROM OLD.id_document_url
     OR NEW.license_url IS DISTINCT FROM OLD.license_url
     OR NEW.verification_notes IS DISTINCT FROM OLD.verification_notes
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    RAISE EXCEPTION 'Verification fields can only be changed by an administrator';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_client_verification_changes
  ON public.professional_profiles;
CREATE TRIGGER trg_prevent_client_verification_changes
  BEFORE UPDATE ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_client_verification_changes();

-- Durable webhook idempotency key. Paystack retries must not replay state changes.
CREATE TABLE IF NOT EXISTS public.paystack_webhook_events (
  event_key text PRIMARY KEY,
  event_name text NOT NULL,
  reference text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
ALTER TABLE public.paystack_webhook_events
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;
ALTER TABLE public.paystack_webhook_events ENABLE ROW LEVEL SECURITY;
