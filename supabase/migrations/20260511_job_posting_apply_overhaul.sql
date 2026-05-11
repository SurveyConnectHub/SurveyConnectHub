-- Job posting and application overhaul

-- Jobs table updates
ALTER TABLE jobs
	ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'remote',
	ADD COLUMN IF NOT EXISTS location text,
	ADD COLUMN IF NOT EXISTS required_skills text[] NOT NULL DEFAULT '{}'::text[],
	ADD COLUMN IF NOT EXISTS estimated_duration text,
	ADD COLUMN IF NOT EXISTS brief_attachment_url text;

ALTER TABLE jobs
	DROP COLUMN IF EXISTS deadline;

-- Job applications table updates
ALTER TABLE job_applications
	DROP COLUMN IF EXISTS availability_date,
	ADD COLUMN IF NOT EXISTS estimated_delivery text,
	ADD COLUMN IF NOT EXISTS relevant_experience text,
	ADD COLUMN IF NOT EXISTS questions_for_client text,
	ADD COLUMN IF NOT EXISTS portfolio_item_id uuid,
	ADD COLUMN IF NOT EXISTS portfolio_attachment_url text;

-- Portfolio items for professionals
CREATE TABLE IF NOT EXISTS portfolio_items (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	professional_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
	title text,
	file_url text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portfolio_items_select_own"
	ON portfolio_items
	FOR SELECT
	USING (auth.uid() = professional_id);

CREATE POLICY "portfolio_items_insert_own"
	ON portfolio_items
	FOR INSERT
	WITH CHECK (auth.uid() = professional_id);

CREATE POLICY "portfolio_items_delete_own"
	ON portfolio_items
	FOR DELETE
	USING (auth.uid() = professional_id);

ALTER TABLE job_applications
	ADD CONSTRAINT job_applications_portfolio_item_id_fkey
	FOREIGN KEY (portfolio_item_id)
	REFERENCES portfolio_items(id)
	ON DELETE SET NULL;

-- Storage buckets for job briefs and portfolio attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-briefs', 'job-briefs', false)
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio-attachments', 'portfolio-attachments', false)
ON CONFLICT DO NOTHING;

INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
	'job_briefs_upload_own',
	'job-briefs',
	'INSERT',
	'(auth.role() = ''authenticated'' AND auth.uid()::text = (storage.foldername(name))[1])'
) ON CONFLICT DO NOTHING;

INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
	'job_briefs_delete_own',
	'job-briefs',
	'DELETE',
	'(auth.uid()::text = (storage.foldername(name))[1])'
) ON CONFLICT DO NOTHING;

INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
	'portfolio_attachments_upload_own',
	'portfolio-attachments',
	'INSERT',
	'(auth.role() = ''authenticated'' AND auth.uid()::text = (storage.foldername(name))[1])'
) ON CONFLICT DO NOTHING;

INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
	'portfolio_attachments_delete_own',
	'portfolio-attachments',
	'DELETE',
	'(auth.uid()::text = (storage.foldername(name))[1])'
) ON CONFLICT DO NOTHING;
