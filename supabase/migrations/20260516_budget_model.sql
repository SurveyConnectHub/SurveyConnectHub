ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS budget_model text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS budget_min numeric,
  ADD COLUMN IF NOT EXISTS budget_max numeric;
