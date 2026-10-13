-- Public job listings, and lock the profile views to signed-in users.
--
-- 1. Logged-out visitors may browse open jobs through a safe view that exposes
--    only: title, category, budget, job type, general region and posted date.
--    No client identity, exact location, description, attachments or contacts.
-- 2. The full `jobs` table is no longer readable without signing in. Before
--    this, anyone holding the public API key could read every column of every
--    open job (including client_id and attachment links).
-- 3. public_profiles / public_professional_profiles are no longer readable by
--    logged-out visitors, and total_earned is removed from the professional view.

-- 1. Safe public view of open jobs only (closed/filled jobs drop out).
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
WHERE j.status = 'open';

REVOKE ALL ON public.public_jobs FROM anon, authenticated;
GRANT SELECT ON public.public_jobs TO anon, authenticated;

-- 2. Full job rows: signed-in users only.
DROP POLICY IF EXISTS "jobs_select_open" ON public.jobs;
CREATE POLICY "jobs_select_open" ON public.jobs
  FOR SELECT TO authenticated
  USING (status = 'open' OR client_id = auth.uid());

-- 3. Profile views: signed-in users only.
REVOKE ALL ON public.public_profiles FROM anon;

-- A view cannot lose a column with CREATE OR REPLACE, so recreate it.
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
WHERE pp.verification_status = 'verified';

-- New objects can inherit default grants to anon, so revoke explicitly.
REVOKE ALL ON public.public_professional_profiles FROM anon, authenticated;
GRANT SELECT ON public.public_professional_profiles TO authenticated;
