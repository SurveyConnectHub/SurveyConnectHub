-- Add new columns to jobs table for multi-step job posting
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS experience_level text,
  ADD COLUMN IF NOT EXISTS screening_questions text[];

-- Add screening_answers column to job_applications table
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS screening_answers text[];

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_jobs_experience_level ON jobs(experience_level);
CREATE INDEX IF NOT EXISTS idx_jobs_screening_questions ON jobs USING GIN(screening_questions);
