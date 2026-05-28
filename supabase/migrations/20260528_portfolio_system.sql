-- Portfolio system expansion

-- Extend portfolio items for geospatial details
ALTER TABLE portfolio_items
	ADD COLUMN IF NOT EXISTS description text,
	ADD COLUMN IF NOT EXISTS project_type text,
	ADD COLUMN IF NOT EXISTS data_sources text,
	ADD COLUMN IF NOT EXISTS crs text,
	ADD COLUMN IF NOT EXISTS scale_resolution text,
	ADD COLUMN IF NOT EXISTS software_used text[] NOT NULL DEFAULT '{}'::text[],
	ADD COLUMN IF NOT EXISTS preview_image_url text,
	ADD COLUMN IF NOT EXISTS map_embed_html text,
	ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill preview image from existing file_url
UPDATE portfolio_items
SET preview_image_url = file_url
WHERE preview_image_url IS NULL AND file_url IS NOT NULL;

ALTER TABLE portfolio_items
	ALTER COLUMN preview_image_url SET NOT NULL;

-- Allow authenticated users to view portfolio items
CREATE POLICY "portfolio_items_select_authenticated"
	ON portfolio_items
	FOR SELECT
	USING (auth.role() = 'authenticated');

-- Allow professionals to update their own portfolio items
CREATE POLICY "portfolio_items_update_own"
	ON portfolio_items
	FOR UPDATE
	USING (auth.uid() = professional_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_items_professional_created
	ON portfolio_items (professional_id, created_at DESC);

-- Storage bucket for portfolio preview images (private, signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio-images', 'portfolio-images', false)
ON CONFLICT DO NOTHING;

-- Allow authenticated users to read preview images via signed URLs
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
	'portfolio_images_read_authenticated',
	'portfolio-images',
	'SELECT',
	'(auth.role() = ''authenticated'')'
) ON CONFLICT DO NOTHING;

-- Allow professionals to upload preview images to their folder
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
	'portfolio_images_upload_own',
	'portfolio-images',
	'INSERT',
	'(auth.role() = ''authenticated'' AND auth.uid()::text = (storage.foldername(name))[1])'
) ON CONFLICT DO NOTHING;

-- Allow professionals to delete their own preview images
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
	'portfolio_images_delete_own',
	'portfolio-images',
	'DELETE',
	'(auth.uid()::text = (storage.foldername(name))[1])'
) ON CONFLICT DO NOTHING;
