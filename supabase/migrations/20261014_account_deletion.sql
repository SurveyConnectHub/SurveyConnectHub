-- Account deletion (soft delete).
--
-- A deleted account keeps its row so contracts, messages, reviews and payment
-- history that point at it stay valid. The delete-account API route blanks the
-- personal data, sets is_deleted, frees the email and bans the auth user.
-- This migration adds the flag and hides deleted users from the public views.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- public_profiles: signed-in users only, never deleted accounts.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT id, full_name, username, country, city, bio, avatar_url
FROM public.profiles
WHERE is_deleted = false;

-- public_professional_profiles: verified and not deleted.
DROP VIEW IF EXISTS public.public_professional_profiles;
CREATE VIEW public.public_professional_profiles
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
WHERE pp.verification_status = 'verified'
  AND p.is_deleted = false;

REVOKE ALL ON public.public_professional_profiles FROM anon, authenticated;
GRANT SELECT ON public.public_professional_profiles TO authenticated;

-- public_jobs: open jobs whose client has not deleted their account.
CREATE OR REPLACE VIEW public.public_jobs
WITH (security_invoker = false) AS
SELECT
  j.id,
  j.title,
  j.profession_type,
  j.budget,
  j.budget_type,
  j.budget_model,
  j.budget_min,
  j.budget_max,
  j.job_type,
  j.is_remote,
  j.experience_level,
  j.required_verification,
  j.location_country,
  j.location_city,
  j.created_at
FROM public.jobs j
WHERE j.status = 'open'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles c
    WHERE c.id = j.client_id AND c.is_deleted = true
  );
