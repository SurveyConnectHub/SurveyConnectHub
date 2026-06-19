CREATE TABLE IF NOT EXISTS "public"."saved_jobs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "job_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id"),
  UNIQUE ("user_id", "job_id")
);

ALTER TABLE ONLY "public"."saved_jobs"
  ADD CONSTRAINT "saved_jobs_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "public"."profiles"("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE ONLY "public"."saved_jobs"
  ADD CONSTRAINT "saved_jobs_job_id_fkey"
  FOREIGN KEY ("job_id")
  REFERENCES "public"."jobs"("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;

CREATE POLICY "saved_jobs_select_own"
  ON "public"."saved_jobs"
  AS RESTRICTIVE FOR SELECT
  TO "public"
  USING (auth.uid() = user_id);

CREATE POLICY "saved_jobs_insert_own"
  ON "public"."saved_jobs"
  AS RESTRICTIVE FOR INSERT
  TO "public"
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_jobs_delete_own"
  ON "public"."saved_jobs"
  AS RESTRICTIVE FOR DELETE
  TO "public"
  USING (auth.uid() = user_id);

ALTER TABLE "public"."saved_jobs" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id
  ON "public"."saved_jobs" USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_saved_jobs_job_id
  ON "public"."saved_jobs" USING btree (job_id);
