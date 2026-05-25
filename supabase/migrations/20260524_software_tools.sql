ALTER TABLE professional_profiles
ADD COLUMN IF NOT EXISTS software_tools text[] NOT NULL DEFAULT '{}';
