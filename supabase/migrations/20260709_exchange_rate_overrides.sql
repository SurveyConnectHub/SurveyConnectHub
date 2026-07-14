CREATE TABLE IF NOT EXISTS "public"."exchange_rate_overrides" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "rate" numeric NOT NULL CHECK (rate > 0),
  "set_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

ALTER TABLE ONLY "public"."exchange_rate_overrides"
  ADD CONSTRAINT "exchange_rate_overrides_set_by_fkey"
  FOREIGN KEY ("set_by") REFERENCES "public"."profiles"("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_exchange_rate_overrides_created_at
  ON "public"."exchange_rate_overrides" ("created_at" DESC);

ALTER TABLE "public"."exchange_rate_overrides" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exchange_rate_overrides_select_admin"
  ON "public"."exchange_rate_overrides"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (SELECT is_admin FROM "public"."profiles" WHERE id = auth.uid()) = true
  );

CREATE POLICY "exchange_rate_overrides_insert_admin"
  ON "public"."exchange_rate_overrides"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    set_by = auth.uid()
    AND (SELECT is_admin FROM "public"."profiles" WHERE id = auth.uid()) = true
  );