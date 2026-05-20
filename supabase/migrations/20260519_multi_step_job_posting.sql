-- Add new columns to jobs table for multi-step job posting
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS experience_level text,
  ADD COLUMN IF NOT EXISTS screening_questions text[];

-- Add screening_answers column to job_applications table
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS screening_answers text[];

-- Ensure portfolio_items has file_url column
ALTER TABLE IF EXISTS portfolio_items
  ADD COLUMN IF NOT EXISTS file_url text;

-- Set default budget_model for existing jobs that don't have it
UPDATE jobs
SET budget_model = 'fixed'
WHERE budget_model IS NULL OR budget_model = '';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_jobs_experience_level ON jobs(experience_level);
CREATE INDEX IF NOT EXISTS idx_jobs_screening_questions ON jobs USING GIN(screening_questions);
