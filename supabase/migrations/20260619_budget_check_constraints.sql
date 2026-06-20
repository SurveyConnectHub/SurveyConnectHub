-- Enforce budget caps at the database level (not just client-side UI)
ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_budget_check,
  ADD CONSTRAINT jobs_budget_check CHECK (budget > 0 AND budget <= 30000);

ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_budget_min_check,
  ADD CONSTRAINT jobs_budget_min_check CHECK (budget_min IS NULL OR (budget_min > 0 AND budget_min <= 30000));

ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_budget_max_check,
  ADD CONSTRAINT jobs_budget_max_check CHECK (budget_max IS NULL OR (budget_max > 0 AND budget_max <= 30000));

ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_agreed_budget_check,
  ADD CONSTRAINT contracts_agreed_budget_check CHECK (agreed_budget > 0 AND agreed_budget <= 30000);
