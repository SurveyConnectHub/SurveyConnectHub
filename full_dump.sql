-- Full dump via Management API -- Date: 2026-06-16T19:19:03.349Z
--=STMT=
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions" VERSION '1.11';
--=STMT=
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions" VERSION '1.3';
--=STMT=
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions" VERSION '1.1';
--=STMT=
CREATE TYPE "application_status" AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
--=STMT=
CREATE TYPE "contract_status" AS ENUM ('pending', 'active', 'completed', 'disputed', 'cancelled');
--=STMT=
CREATE TYPE "job_status" AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
--=STMT=
CREATE TYPE "milestone_status" AS ENUM ('pending', 'funded', 'submitted', 'approved', 'disputed', 'released');
--=STMT=
CREATE TYPE "notification_type" AS ENUM ('application', 'contract', 'message', 'payment', 'review', 'verification');
--=STMT=
CREATE TYPE "profession_type" AS ENUM ('land_surveyor', 'gis_analyst', 'drone_pilot', 'cartographer', 'photogrammetrist', 'lidar_specialist', 'remote_sensing_analyst', 'urban_planner', 'spatial_data_scientist', 'hydrographic_surveyor', 'mining_surveyor', 'construction_surveyor', 'environmental_analyst', 'bim_specialist', 'other');
--=STMT=
CREATE TYPE "transaction_type" AS ENUM ('escrow_deposit', 'milestone_release', 'refund', 'platform_fee');
--=STMT=
CREATE TYPE "user_role" AS ENUM ('client', 'professional');
--=STMT=
CREATE TYPE "verification_status" AS ENUM ('unverified', 'pending', 'verified', 'rejected');
--=STMT=
CREATE TABLE IF NOT EXISTS "public"."client_profiles" (
  "id" uuid NOT NULL,
  "company_name" text,
  "company_website" text,
  "industry" text,
  "total_jobs_posted" integer DEFAULT 0,
  "total_spent" numeric DEFAULT 0,
  "payment_method_on_file" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "onboarding_dismissed_at" timestamp with time zone,
  PRIMARY KEY ("id")
);
--=STMT=
CREATE TABLE IF NOT EXISTS "public"."contracts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "professional_id" uuid NOT NULL,
  "application_id" uuid,
  "agreed_budget" numeric NOT NULL,
  "platform_fee" numeric,
  "professional_receives" numeric,
  "escrow_amount" numeric DEFAULT 0,
  "status" contract_status DEFAULT 'pending'::contract_status,
  "start_date" timestamp with time zone DEFAULT now(),
  "end_date" timestamp with time zone,
  "payment_reference" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "payment_released_at" timestamp with time zone,
  "ngn_amount_paid" integer,
  "exchange_rate_used" numeric,
  PRIMARY KEY ("id")
);
--=STMT=
CREATE TABLE IF NOT EXISTS "public"."job_applications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL,
  "professional_id" uuid NOT NULL,
  "cover_letter" text NOT NULL,
  "proposed_rate" numeric NOT NULL,
  "estimated_duration" text,
  "status" application_status DEFAULT 'pending'::application_status,
  "client_notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "estimated_delivery" text,
  "relevant_experience" text,
  "questions_for_client" text,
  "portfolio_item_id" uuid,
  "portfolio_attachment_url" text,
  "screening_answers" text[],
  PRIMARY KEY ("id")
);
--=STMT=
CREATE TABLE IF NOT EXISTS "public"."jobs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "profession_type" profession_type NOT NULL,
  "budget" numeric NOT NULL,
  "budget_type" text DEFAULT 'fixed'::text,
  "location_country" text,
  "location_city" text,
  "is_remote" boolean DEFAULT false,
  "status" job_status DEFAULT 'open'::job_status,
  "required_verification" boolean DEFAULT true,
  "attachments" text[],
  "views_count" integer DEFAULT 0,
  "applications_count" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "view_count" integer DEFAULT 0,
  "job_type" text DEFAULT 'remote'::text NOT NULL,
  "location" text,
  "required_skills" text[] DEFAULT '{}'::text[] NOT NULL,
  "estimated_duration" text,
  "brief_attachment_url" text,
  "experience_level" text,
  "screening_questions" text[],
  "budget_model" text DEFAULT 'fixed'::text NOT NULL,
  "budget_min" numeric,
  "budget_max" numeric,
  PRIMARY KEY ("id")
);
--=STMT=
CREATE TABLE IF NOT EXISTS "public"."messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "contract_id" uuid NOT NULL,
  "sender_id" uuid NOT NULL,
  "content" text NOT NULL,
  "attachment_url" text,
  "attachment_type" text,
  "is_read" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "read_at" timestamp with time zone,
  PRIMARY KEY ("id")
);
--=STMT=
CREATE TABLE IF NOT EXISTS "public"."milestones" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "contract_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "amount" numeric NOT NULL,
  "status" milestone_status DEFAULT 'pending'::milestone_status,
  "due_date" timestamp with time zone,
  "deliverables_description" text,
  "deliverables_url" text[],
  "funded_at" timestamp with time zone,
  "submitted_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  "stripe_payment_intent_id" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id")
);
--=STMT=
CREATE TABLE IF NOT EXISTS "public"."notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" notification_type NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "is_read" boolean DEFAULT false,
  "related_job_id" uuid,
  "related_contract_id" uuid,
  "related_application_id" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "link" text,
  "read_at" timestamp with time zone,
  PRIMARY KEY ("id")
);
--=STMT=
CREATE TABLE IF NOT EXISTS "public"."portfolio_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "professional_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "profession_type" profession_type,
  "image_urls" text[],
  "completion_date" timestamp with time zone,
  "client_name" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "file_url" text,
  PRIMARY KEY ("id")
);
--=STMT=
CREATE TABLE IF NOT EXISTS "public"."professional_profiles" (
  "id" uuid NOT NULL,
  "profession_type" profession_type NOT NULL,
  "secondary_profession" profession_type,
  "years_experience" integer,
  "skills" text[],
  "certifications" text[],
  "license_number" text,
  "license_url" text,
  "id_document_url" text,
  "verification_status" verification_status DEFAULT 'unverified'::verification_status,
  "verification_notes" text,
  "verified_at" timestamp with time zone,
  "hourly_rate" numeric,
  "portfolio_description" text,
  "total_jobs_completed" integer DEFAULT 0,
  "total_earned" numeric DEFAULT 0,
  "average_rating" numeric DEFAULT 0,
  "total_reviews" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "onboarding_completed" boolean DEFAULT false,
  "onboarding_step" text DEFAULT 'profile'::text,
  "onboarding_completed_at" timestamp with time zone,
  "software_tools" text[] DEFAULT '{}'::text[] NOT NULL,
  PRIMARY KEY ("id")
);
--=STMT=
CREATE TABLE IF NOT EXISTS "public"."profiles" (
  "id" uuid NOT NULL,
  "role" user_role NOT NULL,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "country" text,
  "city" text,
  "bio" text,
  "avatar_url" text,
  "stripe_customer_id" text,
  "stripe_account_id" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "bank_name" text,
  "bank_account_number" text,
  "bank_account_name" text,
  "paystack_recipient_code" text,
  "is_admin" boolean DEFAULT false,
  "notification_email" boolean DEFAULT true,
  "notification_messages" boolean DEFAULT true,
  "notification_marketing" boolean DEFAULT false,
  PRIMARY KEY ("id")
);
--=STMT=
CREATE TABLE IF NOT EXISTS "public"."reviews" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "contract_id" uuid NOT NULL,
  "reviewer_id" uuid NOT NULL,
  "reviewee_id" uuid NOT NULL,
  "rating" integer NOT NULL,
  "comment" text,
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id")
);
--=STMT=
CREATE TABLE IF NOT EXISTS "public"."transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "contract_id" uuid NOT NULL,
  "milestone_id" uuid,
  "type" transaction_type NOT NULL,
  "amount" numeric NOT NULL,
  "platform_fee" numeric DEFAULT 0,
  "stripe_charge_id" text,
  "stripe_transfer_id" text,
  "status" text DEFAULT 'pending'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id")
);
--=STMT=
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON public.contracts USING btree (client_id);
--=STMT=
CREATE INDEX IF NOT EXISTS idx_contracts_professional_id ON public.contracts USING btree (professional_id);
--=STMT=
CREATE UNIQUE INDEX IF NOT EXISTS job_applications_job_id_professional_id_key ON public.job_applications USING btree (job_id, professional_id);
--=STMT=
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON public.job_applications USING btree (job_id);
--=STMT=
CREATE INDEX IF NOT EXISTS idx_job_applications_professional_id ON public.job_applications USING btree (professional_id);
--=STMT=
CREATE UNIQUE INDEX IF NOT EXISTS job_applications_job_professional_uidx ON public.job_applications USING btree (job_id, professional_id);
--=STMT=
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs USING btree (client_id);
--=STMT=
CREATE INDEX IF NOT EXISTS idx_jobs_screening_questions ON public.jobs USING gin (screening_questions);
--=STMT=
CREATE INDEX IF NOT EXISTS idx_jobs_experience_level ON public.jobs USING btree (experience_level);
--=STMT=
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs USING btree (status);
--=STMT=
CREATE INDEX IF NOT EXISTS idx_jobs_profession_type ON public.jobs USING btree (profession_type);
--=STMT=
CREATE INDEX IF NOT EXISTS messages_contract_id_idx ON public.messages USING btree (contract_id);
--=STMT=
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages USING btree (created_at);
--=STMT=
CREATE INDEX IF NOT EXISTS idx_messages_contract_id ON public.messages USING btree (contract_id);
--=STMT=
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created ON public.notifications USING btree (user_id, is_read, created_at DESC);
--=STMT=
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);
--=STMT=
CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_account_id_key ON public.profiles USING btree (stripe_account_id);
--=STMT=
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key ON public.profiles USING btree (email);
--=STMT=
CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_id_key ON public.profiles USING btree (stripe_customer_id);
--=STMT=
CREATE UNIQUE INDEX IF NOT EXISTS reviews_contract_id_reviewer_id_key ON public.reviews USING btree (contract_id, reviewer_id);
--=STMT=
CREATE UNIQUE INDEX IF NOT EXISTS reviews_contract_reviewer_uidx ON public.reviews USING btree (contract_id, reviewer_id);
--=STMT=
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews USING btree (reviewee_id);
--=STMT=
ALTER TABLE ONLY "public"."contracts" ADD CONSTRAINT "contracts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON UPDATE NO ACTION ON DELETE CASCADE;
--=STMT=
ALTER TABLE ONLY "public"."contracts" ADD CONSTRAINT "contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
--=STMT=
ALTER TABLE ONLY "public"."contracts" ADD CONSTRAINT "contracts_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
--=STMT=
ALTER TABLE ONLY "public"."contracts" ADD CONSTRAINT "contracts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
--=STMT=
ALTER TABLE ONLY "public"."client_profiles" ADD CONSTRAINT "client_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON UPDATE NO ACTION ON DELETE CASCADE;
--=STMT=
ALTER TABLE ONLY "public"."professional_profiles" ADD CONSTRAINT "professional_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON UPDATE NO ACTION ON DELETE CASCADE;
--=STMT=
ALTER TABLE ONLY "public"."jobs" ADD CONSTRAINT "jobs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON UPDATE NO ACTION ON DELETE CASCADE;
--=STMT=
ALTER TABLE ONLY "public"."job_applications" ADD CONSTRAINT "job_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON UPDATE NO ACTION ON DELETE CASCADE;
--=STMT=
ALTER TABLE ONLY "public"."job_applications" ADD CONSTRAINT "job_applications_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON UPDATE NO ACTION ON DELETE CASCADE;
--=STMT=
ALTER TABLE ONLY "public"."milestones" ADD CONSTRAINT "milestones_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON UPDATE NO ACTION ON DELETE CASCADE;
--=STMT=
ALTER TABLE ONLY "public"."messages" ADD CONSTRAINT "messages_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON UPDATE NO ACTION ON DELETE CASCADE;
--=STMT=
ALTER TABLE ONLY "public"."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
--=STMT=
ALTER TABLE ONLY "public"."reviews" ADD CONSTRAINT "reviews_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON UPDATE NO ACTION ON DELETE CASCADE;
--=STMT=
ALTER TABLE ONLY "public"."reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
--=STMT=
ALTER TABLE ONLY "public"."reviews" ADD CONSTRAINT "reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "public"."profiles"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
--=STMT=
ALTER TABLE ONLY "public"."transactions" ADD CONSTRAINT "transactions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
--=STMT=
ALTER TABLE ONLY "public"."transactions" ADD CONSTRAINT "transactions_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
--=STMT=
ALTER TABLE ONLY "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON UPDATE NO ACTION ON DELETE CASCADE;
--=STMT=
ALTER TABLE ONLY "public"."notifications" ADD CONSTRAINT "notifications_related_job_id_fkey" FOREIGN KEY ("related_job_id") REFERENCES "public"."jobs"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
--=STMT=
ALTER TABLE ONLY "public"."notifications" ADD CONSTRAINT "notifications_related_contract_id_fkey" FOREIGN KEY ("related_contract_id") REFERENCES "public"."contracts"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
--=STMT=
ALTER TABLE ONLY "public"."notifications" ADD CONSTRAINT "notifications_related_application_id_fkey" FOREIGN KEY ("related_application_id") REFERENCES "public"."job_applications"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
--=STMT=
ALTER TABLE ONLY "public"."portfolio_items" ADD CONSTRAINT "portfolio_items_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON UPDATE NO ACTION ON DELETE CASCADE;
--=STMT=
ALTER TABLE ONLY "public"."job_applications" ADD CONSTRAINT "job_applications_portfolio_item_id_fkey" FOREIGN KEY ("portfolio_item_id") REFERENCES "public"."portfolio_items"("id") ON UPDATE NO ACTION ON DELETE SET NULL;
--=STMT=
CREATE OR REPLACE FUNCTION public.decrement_applications_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE jobs SET applications_count = GREATEST(applications_count - 1, 0)
  WHERE id = OLD.job_id;
  RETURN OLD;
END;
$function$

--=STMT=
CREATE OR REPLACE FUNCTION public.increment_applications_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE jobs SET applications_count = applications_count + 1
  WHERE id = NEW.job_id;
  RETURN NEW;
END;
$function$

--=STMT=
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$

--=STMT=
CREATE OR REPLACE FUNCTION public.update_applications_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE jobs SET applications_count = (
      SELECT COUNT(*) FROM job_applications WHERE job_id = NEW.job_id
    ) WHERE id = NEW.job_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE jobs SET applications_count = (
      SELECT COUNT(*) FROM job_applications WHERE job_id = OLD.job_id
    ) WHERE id = OLD.job_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE jobs SET applications_count = (
      SELECT COUNT(*) FROM job_applications WHERE job_id = NEW.job_id
    ) WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$function$

--=STMT=
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$

--=STMT=
CREATE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
--=STMT=
CREATE TRIGGER "update_client_profiles_updated_at" BEFORE UPDATE ON "public"."client_profiles" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
--=STMT=
CREATE TRIGGER "update_professional_profiles_updated_at" BEFORE UPDATE ON "public"."professional_profiles" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
--=STMT=
CREATE TRIGGER "update_jobs_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
--=STMT=
CREATE TRIGGER "update_contracts_updated_at" BEFORE UPDATE ON "public"."contracts" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
--=STMT=
CREATE TRIGGER "update_milestones_updated_at" BEFORE UPDATE ON "public"."milestones" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
--=STMT=
CREATE TRIGGER "update_applications_count" AFTER INSERT ON "public"."job_applications" FOR EACH ROW EXECUTE FUNCTION update_applications_count();
--=STMT=
CREATE TRIGGER "update_applications_count" AFTER DELETE ON "public"."job_applications" FOR EACH ROW EXECUTE FUNCTION update_applications_count();
--=STMT=
CREATE TRIGGER "update_applications_count" AFTER UPDATE ON "public"."job_applications" FOR EACH ROW EXECUTE FUNCTION update_applications_count();
--=STMT=
CREATE TRIGGER "trg_inc_applications_count" AFTER INSERT ON "public"."job_applications" FOR EACH ROW EXECUTE FUNCTION increment_applications_count();
--=STMT=
CREATE TRIGGER "trg_dec_applications_count" AFTER DELETE ON "public"."job_applications" FOR EACH ROW EXECUTE FUNCTION decrement_applications_count();
--=STMT=
CREATE POLICY "Clients can view own client profile" ON "public"."client_profiles" AS RESTRICTIVE FOR SELECT TO "public" USING ((auth.uid() = id));
--=STMT=
CREATE POLICY "Clients can update own client profile" ON "public"."client_profiles" AS RESTRICTIVE FOR UPDATE TO "public" USING ((auth.uid() = id));
--=STMT=
CREATE POLICY "Clients can insert own client profile" ON "public"."client_profiles" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK ((auth.uid() = id));
--=STMT=
CREATE POLICY "Professionals can view own contracts" ON "public"."contracts" AS RESTRICTIVE FOR SELECT TO "public" USING ((auth.uid() = professional_id));
--=STMT=
CREATE POLICY "Clients can create contracts" ON "public"."contracts" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK ((auth.uid() = client_id));
--=STMT=
CREATE POLICY "contracts_update_parties" ON "public"."contracts" AS RESTRICTIVE FOR UPDATE TO "public" USING (((client_id = auth.uid()) OR (professional_id = auth.uid())));
--=STMT=
CREATE POLICY "contracts_select_parties" ON "public"."contracts" AS RESTRICTIVE FOR SELECT TO "public" USING (((client_id = auth.uid()) OR (professional_id = auth.uid())));
--=STMT=
CREATE POLICY "Clients can update payment reference" ON "public"."contracts" AS RESTRICTIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = client_id));
--=STMT=
CREATE POLICY "Clients and professionals can update contracts" ON "public"."contracts" AS RESTRICTIVE FOR UPDATE TO "public" USING (((auth.uid() = client_id) OR (auth.uid() = professional_id)));
--=STMT=
CREATE POLICY "contracts_insert_client" ON "public"."contracts" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK ((client_id = auth.uid()));
--=STMT=
CREATE POLICY "Clients can view own contracts" ON "public"."contracts" AS RESTRICTIVE FOR SELECT TO "public" USING ((auth.uid() = client_id));
--=STMT=
CREATE POLICY "applications_update_own" ON "public"."job_applications" AS RESTRICTIVE FOR UPDATE TO "public" USING (((professional_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM jobs
  WHERE ((jobs.id = job_applications.job_id) AND (jobs.client_id = auth.uid()))))));
--=STMT=
CREATE POLICY "Clients can view applications for their jobs" ON "public"."job_applications" AS RESTRICTIVE FOR SELECT TO "public" USING ((EXISTS ( SELECT 1
   FROM jobs
  WHERE ((jobs.id = job_applications.job_id) AND (jobs.client_id = auth.uid())))));
--=STMT=
CREATE POLICY "applications_select" ON "public"."job_applications" AS RESTRICTIVE FOR SELECT TO "public" USING (((professional_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM jobs
  WHERE ((jobs.id = job_applications.job_id) AND (jobs.client_id = auth.uid()))))));
--=STMT=
CREATE POLICY "Professionals can create applications" ON "public"."job_applications" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK (((auth.uid() = professional_id) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'professional'::user_role))))));
--=STMT=
CREATE POLICY "Professionals can view own applications" ON "public"."job_applications" AS RESTRICTIVE FOR SELECT TO "public" USING ((auth.uid() = professional_id));
--=STMT=
CREATE POLICY "Clients can update application status" ON "public"."job_applications" AS RESTRICTIVE FOR UPDATE TO "public" USING ((EXISTS ( SELECT 1
   FROM jobs
  WHERE ((jobs.id = job_applications.job_id) AND (jobs.client_id = auth.uid())))));
--=STMT=
CREATE POLICY "applications_insert_professional" ON "public"."job_applications" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK ((professional_id = auth.uid()));
--=STMT=
CREATE POLICY "Clients can delete own jobs" ON "public"."jobs" AS RESTRICTIVE FOR DELETE TO "public" USING ((auth.uid() = client_id));
--=STMT=
CREATE POLICY "Clients can create jobs" ON "public"."jobs" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK (((auth.uid() = client_id) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'client'::user_role))))));
--=STMT=
CREATE POLICY "Clients can update own jobs" ON "public"."jobs" AS RESTRICTIVE FOR UPDATE TO "public" USING ((auth.uid() = client_id));
--=STMT=
CREATE POLICY "Authenticated users can view open jobs" ON "public"."jobs" AS RESTRICTIVE FOR SELECT TO "public" USING ((auth.role() = 'authenticated'::text));
--=STMT=
CREATE POLICY "jobs_select_open" ON "public"."jobs" AS RESTRICTIVE FOR SELECT TO "public" USING (((status = 'open'::job_status) OR (client_id = auth.uid())));
--=STMT=
CREATE POLICY "jobs_insert_client" ON "public"."jobs" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK ((client_id = auth.uid()));
--=STMT=
CREATE POLICY "jobs_update_own" ON "public"."jobs" AS RESTRICTIVE FOR UPDATE TO "public" USING ((client_id = auth.uid()));
--=STMT=
CREATE POLICY "Contract participants can read messages" ON "public"."messages" AS RESTRICTIVE FOR SELECT TO "public" USING ((EXISTS ( SELECT 1
   FROM contracts
  WHERE ((contracts.id = messages.contract_id) AND ((contracts.client_id = auth.uid()) OR (contracts.professional_id = auth.uid()))))));
--=STMT=
CREATE POLICY "Contract parties can view messages" ON "public"."messages" AS RESTRICTIVE FOR SELECT TO "public" USING ((EXISTS ( SELECT 1
   FROM contracts
  WHERE ((contracts.id = messages.contract_id) AND ((contracts.client_id = auth.uid()) OR (contracts.professional_id = auth.uid()))))));
--=STMT=
CREATE POLICY "messages_insert_parties" ON "public"."messages" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM contracts
  WHERE ((contracts.id = messages.contract_id) AND ((contracts.client_id = auth.uid()) OR (contracts.professional_id = auth.uid())))))));
--=STMT=
CREATE POLICY "Contract participants can insert messages" ON "public"."messages" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM contracts
  WHERE ((contracts.id = messages.contract_id) AND ((contracts.client_id = auth.uid()) OR (contracts.professional_id = auth.uid())) AND (contracts.payment_released_at IS NULL))))));
--=STMT=
CREATE POLICY "Contract parties can send messages" ON "public"."messages" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM contracts
  WHERE ((contracts.id = messages.contract_id) AND ((contracts.client_id = auth.uid()) OR (contracts.professional_id = auth.uid())))))));
--=STMT=
CREATE POLICY "messages_select_parties" ON "public"."messages" AS RESTRICTIVE FOR SELECT TO "public" USING ((EXISTS ( SELECT 1
   FROM contracts
  WHERE ((contracts.id = messages.contract_id) AND ((contracts.client_id = auth.uid()) OR (contracts.professional_id = auth.uid()))))));
--=STMT=
CREATE POLICY "Clients can create milestones" ON "public"."milestones" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK ((EXISTS ( SELECT 1
   FROM contracts
  WHERE ((contracts.id = milestones.contract_id) AND (contracts.client_id = auth.uid())))));
--=STMT=
CREATE POLICY "Contract parties can view milestones" ON "public"."milestones" AS RESTRICTIVE FOR SELECT TO "public" USING ((EXISTS ( SELECT 1
   FROM contracts
  WHERE ((contracts.id = milestones.contract_id) AND ((contracts.client_id = auth.uid()) OR (contracts.professional_id = auth.uid()))))));
--=STMT=
CREATE POLICY "Contract parties can update milestones" ON "public"."milestones" AS RESTRICTIVE FOR UPDATE TO "public" USING ((EXISTS ( SELECT 1
   FROM contracts
  WHERE ((contracts.id = milestones.contract_id) AND ((contracts.client_id = auth.uid()) OR (contracts.professional_id = auth.uid()))))));
--=STMT=
CREATE POLICY "Users can view own notifications" ON "public"."notifications" AS RESTRICTIVE FOR SELECT TO "public" USING ((auth.uid() = user_id));
--=STMT=
CREATE POLICY "Users can update own notifications" ON "public"."notifications" AS RESTRICTIVE FOR UPDATE TO "public" USING ((auth.uid() = user_id));
--=STMT=
CREATE POLICY "notifications_own" ON "public"."notifications" AS RESTRICTIVE FOR ALL TO "public" USING ((user_id = auth.uid()));
--=STMT=
CREATE POLICY "Professionals can manage own portfolio" ON "public"."portfolio_items" AS RESTRICTIVE FOR ALL TO "public" USING ((auth.uid() = professional_id));
--=STMT=
CREATE POLICY "portfolio_items_select_own" ON "public"."portfolio_items" AS RESTRICTIVE FOR SELECT TO "public" USING ((auth.uid() = professional_id));
--=STMT=
CREATE POLICY "portfolio_items_insert_own" ON "public"."portfolio_items" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK ((auth.uid() = professional_id));
--=STMT=
CREATE POLICY "portfolio_items_delete_own" ON "public"."portfolio_items" AS RESTRICTIVE FOR DELETE TO "public" USING ((auth.uid() = professional_id));
--=STMT=
CREATE POLICY "Authenticated users can view portfolios" ON "public"."portfolio_items" AS RESTRICTIVE FOR SELECT TO "public" USING ((auth.role() = 'authenticated'::text));
--=STMT=
CREATE POLICY "Admins can read all professional profiles" ON "public"."professional_profiles" AS RESTRICTIVE FOR SELECT TO "public" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
--=STMT=
CREATE POLICY "prof_profiles_select_all" ON "public"."professional_profiles" AS RESTRICTIVE FOR SELECT TO "public" USING (true);
--=STMT=
CREATE POLICY "Professionals can view own professional profile" ON "public"."professional_profiles" AS RESTRICTIVE FOR SELECT TO "public" USING ((auth.uid() = id));
--=STMT=
CREATE POLICY "Professionals can insert own professional profile" ON "public"."professional_profiles" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK ((auth.uid() = id));
--=STMT=
CREATE POLICY "Authenticated users can view professional profiles" ON "public"."professional_profiles" AS RESTRICTIVE FOR SELECT TO "public" USING ((auth.role() = 'authenticated'::text));
--=STMT=
CREATE POLICY "Professionals can update own professional profile" ON "public"."professional_profiles" AS RESTRICTIVE FOR UPDATE TO "public" USING ((auth.uid() = id));
--=STMT=
CREATE POLICY "Public can view verified professionals" ON "public"."professional_profiles" AS RESTRICTIVE FOR SELECT TO "public" USING ((verification_status = 'verified'::verification_status));
--=STMT=
CREATE POLICY "Admins can update professional profiles" ON "public"."professional_profiles" AS RESTRICTIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
--=STMT=
CREATE POLICY "prof_profiles_write_own" ON "public"."professional_profiles" AS RESTRICTIVE FOR ALL TO "public" USING ((id = auth.uid()));
--=STMT=
CREATE POLICY "profiles_select_own" ON "public"."profiles" AS RESTRICTIVE FOR SELECT TO "public" USING ((auth.uid() = id));
--=STMT=
CREATE POLICY "profiles_update_own" ON "public"."profiles" AS RESTRICTIVE FOR UPDATE TO "public" USING ((auth.uid() = id));
--=STMT=
CREATE POLICY "profiles_select_public" ON "public"."profiles" AS RESTRICTIVE FOR SELECT TO "public" USING (true);
--=STMT=
CREATE POLICY "Authenticated users can view all profiles" ON "public"."profiles" AS RESTRICTIVE FOR SELECT TO "authenticated" USING (true);
--=STMT=
CREATE POLICY "Users can update own profile" ON "public"."profiles" AS RESTRICTIVE FOR UPDATE TO "public" USING ((auth.uid() = id));
--=STMT=
CREATE POLICY "Users can insert own profile" ON "public"."profiles" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK ((auth.uid() = id));
--=STMT=
CREATE POLICY "Anyone can view profiles" ON "public"."profiles" AS RESTRICTIVE FOR SELECT TO "public" USING (true);
--=STMT=
CREATE POLICY "Contract parties can create reviews" ON "public"."reviews" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK (((auth.uid() = reviewer_id) AND (EXISTS ( SELECT 1
   FROM contracts
  WHERE ((contracts.id = reviews.contract_id) AND (contracts.status = 'completed'::contract_status) AND ((contracts.client_id = auth.uid()) OR (contracts.professional_id = auth.uid())))))));
--=STMT=
CREATE POLICY "Anyone can view reviews" ON "public"."reviews" AS RESTRICTIVE FOR SELECT TO "authenticated" USING (true);
--=STMT=
CREATE POLICY "Clients can insert reviews" ON "public"."reviews" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid() = reviewer_id));
--=STMT=
CREATE POLICY "reviews_select_all" ON "public"."reviews" AS RESTRICTIVE FOR SELECT TO "public" USING (true);
--=STMT=
CREATE POLICY "reviews_insert_client" ON "public"."reviews" AS RESTRICTIVE FOR INSERT TO "public" WITH CHECK (((reviewer_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM contracts
  WHERE ((contracts.id = reviews.contract_id) AND (contracts.client_id = auth.uid()) AND (contracts.payment_released_at IS NOT NULL))))));
--=STMT=
CREATE POLICY "Authenticated users can view reviews" ON "public"."reviews" AS RESTRICTIVE FOR SELECT TO "public" USING ((auth.role() = 'authenticated'::text));
--=STMT=
CREATE POLICY "Contract parties can view transactions" ON "public"."transactions" AS RESTRICTIVE FOR SELECT TO "public" USING ((EXISTS ( SELECT 1
   FROM contracts
  WHERE ((contracts.id = transactions.contract_id) AND ((contracts.client_id = auth.uid()) OR (contracts.professional_id = auth.uid()))))));
--=STMT=
ALTER TABLE "public"."client_profiles" ENABLE ROW LEVEL SECURITY;
--=STMT=
ALTER TABLE "public"."professional_profiles" ENABLE ROW LEVEL SECURITY;
--=STMT=
ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;
--=STMT=
ALTER TABLE "public"."job_applications" ENABLE ROW LEVEL SECURITY;
--=STMT=
ALTER TABLE "public"."milestones" ENABLE ROW LEVEL SECURITY;
--=STMT=
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;
--=STMT=
ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;
--=STMT=
ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;
--=STMT=
ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;
--=STMT=
ALTER TABLE "public"."portfolio_items" ENABLE ROW LEVEL SECURITY;
--=STMT=
ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;
--=STMT=
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
--=STMT=
INSERT INTO "public"."client_profiles" ("id","company_name","company_website","industry","total_jobs_posted","total_spent","payment_method_on_file","created_at","updated_at","onboarding_dismissed_at") VALUES
  ('15004154-26b1-43a9-85ed-59472bd83e64',NULL,NULL,NULL,0,'0.00',false,'2026-04-12 09:34:46.912597+00','2026-04-12 09:34:46.912597+00',NULL),
  ('22a9f0b6-0194-4a25-82f4-061dc7e5d2cd',NULL,NULL,NULL,0,'0.00',false,'2026-04-27 20:50:21.463648+00','2026-04-27 20:50:21.463648+00',NULL),
  ('28ebb5ae-ecf9-43d9-9964-58ab983aabc4',NULL,NULL,NULL,0,'0.00',false,'2026-04-30 18:53:21.923093+00','2026-04-30 18:53:21.923093+00',NULL),
  ('2cbfe756-56da-47b1-9665-703393494a9a',NULL,NULL,NULL,0,'0.00',false,'2026-04-27 12:32:56.542923+00','2026-04-27 12:32:56.542923+00',NULL),
  ('46342bdb-4654-4813-9e9f-094e72364c4a',NULL,NULL,NULL,0,'0.00',false,'2026-04-23 05:28:05.57133+00','2026-04-23 05:28:05.57133+00',NULL),
  ('509075b7-08f4-4602-8149-e9ae22c92f1c',NULL,NULL,NULL,0,'0.00',false,'2026-04-30 19:19:34.531022+00','2026-04-30 19:19:34.531022+00',NULL),
  ('554a0a6d-0858-4e90-adce-f58e9e699b35',NULL,NULL,NULL,0,'0.00',false,'2026-04-10 18:22:44.852406+00','2026-04-10 18:22:44.852406+00',NULL),
  ('7dc8c7cb-baf9-4e3d-ab26-2b24a287ee48',NULL,NULL,NULL,0,'0.00',false,'2026-04-28 18:06:42.25031+00','2026-04-28 18:06:42.25031+00',NULL),
  ('9efab5df-002b-4bbe-90cf-8330e4c55fcc',NULL,NULL,NULL,0,'0.00',false,'2026-04-30 18:50:18.740507+00','2026-04-30 18:50:18.740507+00',NULL),
  ('9ff627e5-dc90-4064-af68-4f8e1e62d039',NULL,NULL,NULL,0,'0.00',false,'2026-04-06 10:35:15.390743+00','2026-04-06 10:35:15.390743+00',NULL),
  ('ab2c3938-403d-4dae-b92e-8fddc48e77db',NULL,NULL,NULL,0,'0.00',false,'2026-04-06 11:03:03.173008+00','2026-04-06 11:03:03.173008+00',NULL),
  ('b42b53eb-0997-4a80-bfbc-9652412a5db0',NULL,NULL,NULL,0,'0.00',false,'2026-05-05 11:31:27.1803+00','2026-05-05 11:31:27.1803+00',NULL),
  ('c9eee12f-b674-4ea3-922b-be75943f56de',NULL,NULL,NULL,0,'0.00',false,'2026-04-30 18:55:02.850629+00','2026-04-30 18:55:02.850629+00',NULL),
  ('de45f6b0-3dbd-4acd-a580-2b99e2e5ad83',NULL,NULL,NULL,0,'0.00',false,'2026-04-20 12:02:11.472109+00','2026-04-20 12:02:11.472109+00',NULL),
  ('e1f1fdbe-b415-45d0-b809-432126dd7320',NULL,NULL,NULL,0,'0.00',false,'2026-04-28 19:01:04.480502+00','2026-04-28 19:01:04.480502+00',NULL),
  ('eacd3c94-beed-4929-bd63-90b3d5600cf4',NULL,NULL,NULL,0,'0.00',false,'2026-04-25 16:23:34.351978+00','2026-04-25 16:23:34.351978+00',NULL);
--=STMT=
INSERT INTO "public"."contracts" ("id","job_id","client_id","professional_id","application_id","agreed_budget","platform_fee","professional_receives","escrow_amount","status","start_date","end_date","payment_reference","created_at","updated_at","payment_released_at","ngn_amount_paid","exchange_rate_used") VALUES
  ('0d039619-8c4a-4748-ac24-1836be747057','a50708af-6c80-4b87-ad70-8ec0aac67f70','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','e12fe93f-5baa-4785-b49f-1a153f91888f','2481.00','372.15','2108.85','2481.00','active','2026-06-04 18:07:15.561+00',NULL,'SC-0d039619-8c4a-4748-ac24-1836be747057-1780596352787','2026-06-04 18:05:46.904243+00','2026-06-04 18:07:15.845629+00',NULL,3546939,'1361.5628'),
  ('18a49335-085e-4acb-9703-5239964025c2','c0da2087-2940-4af8-b7a3-ec797afe6973','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','2907fc62-6384-4544-aefb-11f7ddac7319','28829.00','4324.35','24504.65','28829.00','active','2026-06-04 03:28:16.846+00',NULL,'SC-18a49335-085e-4acb-9703-5239964025c2-1780543596714','2026-06-04 03:26:27.508288+00','2026-06-04 03:28:16.936736+00',NULL,41215119,'1361.5628'),
  ('1cdd36d2-8012-4ffc-98e3-f6a373810a87','824d95ea-6a64-4325-a04b-a373b4039097','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','41da756a-75cd-4064-a1ae-53a7433e0578','600000.00','90000.00','510000.00','600000.00','pending','2026-04-19 06:46:46.993006+00',NULL,NULL,'2026-04-19 06:46:46.993006+00','2026-04-19 06:46:46.993006+00',NULL,NULL,NULL),
  ('1df35be1-0654-4cfe-851d-c2f816a4af1c','5979e66f-2131-4b38-ac9a-beea54af80ef','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','698dcebb-3ddb-4518-b93e-b6362d0ce996','3000.00','450.00','2550.00','3000.00','active','2026-05-05 14:27:28.361+00',NULL,'SC-1df35be1-0654-4cfe-851d-c2f816a4af1c-1777991160997','2026-05-05 14:25:46.891908+00','2026-05-05 14:27:28.641266+00',NULL,4314721,'1369.7527'),
  ('24beb9e0-9d02-4e42-9458-4006f9b0edcb','124a3618-048d-49d1-ab19-eb37a4e8ae19','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','98f449ec-6438-469c-bf33-bb29b5112d37','95.00','14.25','80.75','95.00','active','2026-04-25 15:21:50.555+00',NULL,'SC-24beb9e0-9d02-4e42-9458-4006f9b0edcb-1777130429654','2026-04-25 15:20:16.768244+00','2026-04-25 15:21:50.801369+00',NULL,135176,'1355.1492'),
  ('28bd6dc5-d1c6-4e9a-acdf-b7932cd0ca20','824d95ea-6a64-4325-a04b-a373b4039097','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','41da756a-75cd-4064-a1ae-53a7433e0578','600000.00','90000.00','510000.00','600000.00','pending','2026-04-18 18:24:22.062367+00',NULL,NULL,'2026-04-18 18:24:22.062367+00','2026-04-18 18:24:22.062367+00',NULL,NULL,NULL),
  ('2a5bd106-f4c4-4999-abc8-6486af801096','824d95ea-6a64-4325-a04b-a373b4039097','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','41da756a-75cd-4064-a1ae-53a7433e0578','600000.00','90000.00','510000.00','600000.00','pending','2026-04-19 06:59:30.650677+00',NULL,NULL,'2026-04-19 06:59:30.650677+00','2026-04-19 06:59:30.650677+00',NULL,NULL,NULL),
  ('38885bbe-8c9c-4588-87b1-53433ffb3118','8fb08988-13f7-4c62-a513-72a40bf996d7','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','441be8bf-be20-4a6b-ba73-272a739129d3','79.00','11.85','67.15','79.00','pending','2026-04-17 18:19:24.142695+00',NULL,'sc_38885bbe-8c9c-4588-87b1-53433ffb3118_1776449977976','2026-04-17 18:19:24.142695+00','2026-04-17 18:19:38.755689+00',NULL,NULL,NULL),
  ('3c28aab2-d287-40d4-b065-5dbe581f6984','29844d0d-e203-4e6d-b2ba-92ec920f1534','de45f6b0-3dbd-4acd-a580-2b99e2e5ad83','2f035835-66fe-4d11-bde4-fc37fa310083','823e427c-96db-49f3-95a8-919288938969','2500.00','375.00','2125.00','2500.00','completed','2026-04-21 10:44:59.463+00',NULL,'SC-3c28aab2-d287-40d4-b065-5dbe581f6984-1776768206204','2026-04-21 10:43:20.39054+00','2026-04-23 10:17:06.929711+00',NULL,NULL,NULL),
  ('4224bd6f-f73b-40d8-9002-fd152e80f4a5','824d95ea-6a64-4325-a04b-a373b4039097','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','41da756a-75cd-4064-a1ae-53a7433e0578','600000.00','90000.00','510000.00','600000.00','pending','2026-04-18 18:35:28.966788+00',NULL,NULL,'2026-04-18 18:35:28.966788+00','2026-04-18 18:35:28.966788+00',NULL,NULL,NULL),
  ('4a092198-eb66-4b5f-9869-d0b7fd3ef35d','35923c28-db77-4238-b93f-6324b05e1821','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','17894d00-e0b0-46d6-9535-2b95ab2284b2','410.00','61.50','348.50','410.00','completed','2026-04-19 06:43:10.315+00',NULL,'SC-4a092198-eb66-4b5f-9869-d0b7fd3ef35d-1776580863291','2026-04-18 19:01:01.004005+00','2026-04-25 14:27:25.728414+00',NULL,NULL,NULL),
  ('4b3b90e4-7ecb-47ae-8239-2e7a12d29f0a','efe5ebd4-b644-4961-b43e-b155ae8eee36','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','1001a6a8-92e8-4580-926d-b1f97e5b8c4c','69.00','10.35','58.65','69.00','pending','2026-04-17 18:15:52.64664+00',NULL,NULL,'2026-04-17 18:15:52.64664+00','2026-04-17 18:15:52.64664+00',NULL,NULL,NULL),
  ('6356af10-5523-49de-9cf2-5a1b67501f69','9894bac9-4015-49b5-a6ed-953f3857895e','22a9f0b6-0194-4a25-82f4-061dc7e5d2cd','2f035835-66fe-4d11-bde4-fc37fa310083','9aab4773-783e-493e-b42d-0b834c61c15e','23264.00','3489.60','19774.40','23264.00','completed','2026-04-27 20:54:07.232+00',NULL,'SC-6356af10-5523-49de-9cf2-5a1b67501f69-1777323159074','2026-04-27 20:52:28.59485+00','2026-04-27 20:56:54.522317+00',NULL,33044352,'1352.7687'),
  ('65ed137d-cf7a-48b2-a330-6ae519f1e01f','94d5bf9c-3ace-423c-bb2c-98865d210e08','509075b7-08f4-4602-8149-e9ae22c92f1c','2f035835-66fe-4d11-bde4-fc37fa310083','41238a02-568c-4b91-946a-e084f937210b','16555.00','2483.25','14071.75','16555.00','active','2026-05-22 19:26:00.093+00',NULL,'SC-65ed137d-cf7a-48b2-a330-6ae519f1e01f-1779477875696','2026-05-22 19:24:27.648415+00','2026-05-22 19:26:00.184239+00',NULL,23842503,'1371.6186'),
  ('67ad9952-f15e-4d56-a189-b0029468067b','1b692224-8fda-43fe-a864-d1869bb89358','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','ea237de8-1770-4b70-997c-02e9032e6cea','6000.00','900.00','5100.00','6000.00','completed','2026-04-18 00:11:44.858+00',NULL,'sc_67ad9952-f15e-4d56-a189-b0029468067b_1776470968780','2026-04-18 00:08:40.114999+00','2026-04-18 07:03:40.495505+00',NULL,NULL,NULL),
  ('760a60b7-47eb-48be-bba0-bf0243312d11','3765eb2b-b8cf-49e5-989f-dce3393bba7c','c9eee12f-b674-4ea3-922b-be75943f56de','2f035835-66fe-4d11-bde4-fc37fa310083','97e13019-b8a1-47fc-8158-6fd0df9cf95d','5572.00','835.80','4736.20','5572.00','completed','2026-04-30 19:01:52.078+00',NULL,'SC-760a60b7-47eb-48be-bba0-bf0243312d11-1777575634225','2026-04-30 19:00:27.503775+00','2026-04-30 19:04:12.016696+00',NULL,8055648,'1376.8926'),
  ('7a68ec6b-c1c6-4636-ba9b-7473b7e61f75','bbac79ba-22a4-437b-8306-ffd3daf63db5','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','21934764-d811-4723-97b8-c2fdc4b409ad','3000.00','450.00','2550.00','3000.00','completed','2026-04-19 10:48:31.51+00',NULL,'SC-7a68ec6b-c1c6-4636-ba9b-7473b7e61f75-1776595633633','2026-04-19 10:47:04.669785+00','2026-04-19 10:49:22.532409+00',NULL,NULL,NULL),
  ('7adfb062-601a-4387-bbd4-9f80c1e2ab24','6ec2e6ce-c046-46a3-b026-6ec313eadb48','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','baf853ec-ccdc-428b-b3c5-f235ab2e7508','5000.00','750.00','4250.00','5000.00','pending','2026-04-17 23:52:29.571674+00',NULL,'sc_7adfb062-601a-4387-bbd4-9f80c1e2ab24_1776469962466','2026-04-17 23:52:29.571674+00','2026-04-17 23:52:42.284912+00',NULL,NULL,NULL),
  ('805de760-0497-4b5d-8ad2-5d9a488dae82','cc82db63-529d-490a-bbc4-fc1a8b15f84c','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','8401e924-572e-4a5e-bfd5-9abc3e138b49','600.00','90.00','510.00','600.00','active','2026-05-05 02:42:53.176+00',NULL,'SC-805de760-0497-4b5d-8ad2-5d9a488dae82-1777948861865','2026-05-05 02:40:54.872425+00','2026-05-05 02:42:53.447964+00',NULL,862944,'1369.7527'),
  ('90b78976-a4df-4f90-a73a-53bbc36f5db3','c189a171-c6fe-432c-8c1d-364d43810fe0','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','3f48e45d-ae01-4773-9228-d9d0bddccf57','14000.00','2100.00','11900.00','14000.00','completed','2026-04-19 07:53:03.279+00',NULL,'SC-90b78976-a4df-4f90-a73a-53bbc36f5db3-1776585070082','2026-04-19 07:51:03.555809+00','2026-04-25 14:27:22.880307+00',NULL,NULL,NULL),
  ('a0393cef-5b35-4a65-a00a-372d7ee5ac73','f4127f10-d4e2-46fd-b27d-4a5620256c97','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','54683bb3-e35a-4e68-ab21-3d32a430d516','1354.00','203.10','1150.90','1354.00','active','2026-04-25 14:30:17.885+00',NULL,'SC-a0393cef-5b35-4a65-a00a-372d7ee5ac73-1777127324757','2026-04-25 14:28:35.29062+00','2026-04-25 14:30:17.971024+00',NULL,1981662,'1355.1492'),
  ('a2ff353a-afec-41d3-bbcd-20916bc1e325','6ec2e6ce-c046-46a3-b026-6ec313eadb48','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','baf853ec-ccdc-428b-b3c5-f235ab2e7508','5000.00','750.00','4250.00','5000.00','pending','2026-04-17 18:42:41.864299+00',NULL,'sc_a2ff353a-afec-41d3-bbcd-20916bc1e325_1776451368581','2026-04-17 18:42:41.864299+00','2026-04-17 18:42:49.248946+00',NULL,NULL,NULL),
  ('a4d72313-4110-4c11-b26a-8b7bc8cd7d3f','6ec2e6ce-c046-46a3-b026-6ec313eadb48','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','baf853ec-ccdc-428b-b3c5-f235ab2e7508','5000.00','750.00','4250.00','5000.00','pending','2026-04-17 23:51:27.311226+00',NULL,NULL,'2026-04-17 23:51:27.311226+00','2026-04-17 23:51:27.311226+00',NULL,NULL,NULL),
  ('b50c9fdc-c485-43a4-8396-f3cdb60319b2','f4127f10-d4e2-46fd-b27d-4a5620256c97','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','54683bb3-e35a-4e68-ab21-3d32a430d516','1354.00','203.10','1150.90','1354.00','pending','2026-04-25 14:28:15.659685+00',NULL,NULL,'2026-04-25 14:28:15.659685+00','2026-04-25 14:28:15.659685+00',NULL,NULL,NULL),
  ('be7e557d-e824-49a4-a87f-1dcaca2fd31c','3891f41f-9ab9-444d-b36b-d542ffd390e8','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','6ced8574-386e-4d30-8925-35dba7b8ce49','3890.00','583.50','3306.50','3890.00','completed','2026-04-19 13:35:40.758+00',NULL,'SC-be7e557d-e824-49a4-a87f-1dcaca2fd31c-1776605479979','2026-04-19 13:29:47.4466+00','2026-04-20 11:22:52.841032+00',NULL,NULL,NULL),
  ('c316ead3-f275-4d84-bcd1-99c566780079','b9601584-cd0e-4b5d-be92-85d26346b7cb','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','9085c751-d823-4732-8c80-12f2bea55f79','400.00','60.00','340.00','400.00','active','2026-05-22 19:28:07.32+00',NULL,'SC-c316ead3-f275-4d84-bcd1-99c566780079-1779477979642','2026-05-22 19:26:12.745914+00','2026-05-22 19:28:07.389376+00',NULL,576080,'1371.6186'),
  ('cfeaad1f-e33e-41da-a494-980fe7e7daea','824d95ea-6a64-4325-a04b-a373b4039097','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','41da756a-75cd-4064-a1ae-53a7433e0578','600000.00','90000.00','510000.00','600000.00','pending','2026-04-18 18:44:44.509345+00',NULL,NULL,'2026-04-18 18:44:44.509345+00','2026-04-18 18:44:44.509345+00',NULL,NULL,NULL),
  ('d529974b-fc4f-42a8-a703-46a205b86d68','4e369999-1eaf-4da4-bf44-bf9995642f38','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','2776fd7c-48d0-4c5c-b881-f2f9897cbf97','500.00','75.00','425.00','500.00','completed','2026-04-18 00:06:38.059+00',NULL,'sc_d529974b-fc4f-42a8-a703-46a205b86d68_1776470683167','2026-04-18 00:00:06.146076+00','2026-04-18 07:03:42.946063+00',NULL,NULL,NULL),
  ('f244840a-cb41-4cf0-bae2-e88bbd6ce574','58acf034-cb6c-4e0d-9da7-8cc989712c0b','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','9c654c4a-b122-4614-9e86-136d9f094fcd','3000.00','450.00','2550.00','3000.00','pending','2026-04-17 14:36:00.706004+00',NULL,NULL,'2026-04-17 14:36:00.706004+00','2026-04-17 14:36:00.706004+00',NULL,NULL,NULL),
  ('f9557da3-d604-444e-b8ba-33af5d7ab64e','b0f04ee6-d0a7-42b4-ba66-562e0f14f109','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','f77c0eed-7d66-41b2-a639-7d716e8459aa','38.00','5.70','32.30','38.00','active','2026-05-14 18:15:51.991+00',NULL,'SC-f9557da3-d604-444e-b8ba-33af5d7ab64e-1778782453758','2026-05-14 18:14:05.218472+00','2026-05-14 18:15:52.246357+00',NULL,54640,'1369.4342'),
  ('fa5d5553-682b-4da1-bc76-5b0f9b80377d','35923c28-db77-4238-b93f-6324b05e1821','9ff627e5-dc90-4064-af68-4f8e1e62d039','2f035835-66fe-4d11-bde4-fc37fa310083','17894d00-e0b0-46d6-9535-2b95ab2284b2','410.00','61.50','348.50','410.00','pending','2026-04-18 18:57:34.68817+00',NULL,NULL,'2026-04-18 18:57:34.68817+00','2026-04-18 18:57:34.68817+00',NULL,NULL,NULL);
--=STMT=
INSERT INTO "public"."job_applications" ("id","job_id","professional_id","cover_letter","proposed_rate","estimated_duration","status","client_notes","created_at","updated_at","estimated_delivery","relevant_experience","questions_for_client","portfolio_item_id","portfolio_attachment_url","screening_answers") VALUES
  ('1001a6a8-92e8-4580-926d-b1f97e5b8c4c','efe5ebd4-b644-4961-b43e-b155ae8eee36','2f035835-66fe-4d11-bde4-fc37fa310083','i am the one','69.00',NULL,'accepted',NULL,'2026-04-17 18:14:49.723597+00','2026-04-17 18:14:49.723597+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('17894d00-e0b0-46d6-9535-2b95ab2284b2','35923c28-db77-4238-b93f-6324b05e1821','2f035835-66fe-4d11-bde4-fc37fa310083','i got you','410.00',NULL,'accepted',NULL,'2026-04-18 18:57:19.191628+00','2026-04-18 18:57:19.191628+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('21934764-d811-4723-97b8-c2fdc4b409ad','bbac79ba-22a4-437b-8306-ffd3daf63db5','2f035835-66fe-4d11-bde4-fc37fa310083','i got you','3000.00',NULL,'accepted',NULL,'2026-04-19 10:46:29.942724+00','2026-04-19 10:46:29.942724+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('2776fd7c-48d0-4c5c-b881-f2f9897cbf97','4e369999-1eaf-4da4-bf44-bf9995642f38','2f035835-66fe-4d11-bde4-fc37fa310083','i got this','500.00',NULL,'accepted',NULL,'2026-04-17 23:57:51.83051+00','2026-04-17 23:57:51.83051+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('2907fc62-6384-4544-aefb-11f7ddac7319','c0da2087-2940-4af8-b7a3-ec797afe6973','2f035835-66fe-4d11-bde4-fc37fa310083','I am him','28829.00',NULL,'accepted',NULL,'2026-06-04 03:25:50.515238+00','2026-06-04 03:25:50.515238+00','2_weeks','ALL OF THE ABOVE',NULL,NULL,NULL,NULL),
  ('3f48e45d-ae01-4773-9228-d9d0bddccf57','c189a171-c6fe-432c-8c1d-364d43810fe0','2f035835-66fe-4d11-bde4-fc37fa310083','tjrrjy','14000.00',NULL,'accepted',NULL,'2026-04-19 07:50:26.440664+00','2026-04-19 07:50:26.440664+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('41238a02-568c-4b91-946a-e084f937210b','94d5bf9c-3ace-423c-bb2c-98865d210e08','2f035835-66fe-4d11-bde4-fc37fa310083','I AM HIM','16555.00',NULL,'accepted',NULL,'2026-05-22 19:22:17.889275+00','2026-05-22 19:22:17.889275+00','2_weeks','FUCK YOU',NULL,NULL,NULL,NULL),
  ('41da756a-75cd-4064-a1ae-53a7433e0578','824d95ea-6a64-4325-a04b-a373b4039097','2f035835-66fe-4d11-bde4-fc37fa310083','b hhhbhj','600000.00',NULL,'pending',NULL,'2026-04-17 23:18:50.8559+00','2026-04-17 23:18:50.8559+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('441be8bf-be20-4a6b-ba73-272a739129d3','8fb08988-13f7-4c62-a513-72a40bf996d7','2f035835-66fe-4d11-bde4-fc37fa310083','Ut minim ullam in sa','79.00',NULL,'accepted',NULL,'2026-04-17 18:18:44.431687+00','2026-04-17 18:18:44.431687+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('54683bb3-e35a-4e68-ab21-3d32a430d516','f4127f10-d4e2-46fd-b27d-4a5620256c97','2f035835-66fe-4d11-bde4-fc37fa310083','Nostrud cupiditate aut dolor id voluptate dolores quisquam perspiciatis veniam eligendi assumenda animi et commodo est similique ipsum autem','1354.00',NULL,'accepted',NULL,'2026-04-25 14:25:07.203995+00','2026-04-25 14:25:07.203995+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('698dcebb-3ddb-4518-b93e-b6362d0ce996','5979e66f-2131-4b38-ac9a-beea54af80ef','2f035835-66fe-4d11-bde4-fc37fa310083','i am the one','3000.00',NULL,'accepted',NULL,'2026-05-05 14:25:05.233276+00','2026-05-05 14:25:05.233276+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('6ced8574-386e-4d30-8925-35dba7b8ce49','3891f41f-9ab9-444d-b36b-d542ffd390e8','2f035835-66fe-4d11-bde4-fc37fa310083','I got this','3890.00',NULL,'accepted',NULL,'2026-04-19 13:28:47.319715+00','2026-04-19 13:28:47.319715+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('7b135ff4-11ad-4666-940d-c21b42ac4200','98b9ffc0-90df-4475-934a-1b3b3c1a4a88','2f035835-66fe-4d11-bde4-fc37fa310083','I AM HIM','600.00',NULL,'pending',NULL,'2026-05-23 17:51:09.825215+00','2026-05-23 17:51:09.825215+00','2_weeks','ALL OF THE ABOVE',NULL,NULL,NULL,NULL),
  ('7e73a55c-d00b-47c4-9ee4-a516365300ce','93940bc2-42c1-4dde-959f-b4c05aef48aa','2f035835-66fe-4d11-bde4-fc37fa310083','I AM HIM','1499.00',NULL,'pending',NULL,'2026-05-22 19:09:11.932159+00','2026-05-22 19:09:11.932159+00','2_weeks','ALL OF THE ABOVE',NULL,NULL,'2f035835-66fe-4d11-bde4-fc37fa310083/portfolio-1779476944206-ZYRON_Master_Document_v3.pdf',NULL),
  ('823e427c-96db-49f3-95a8-919288938969','29844d0d-e203-4e6d-b2ba-92ec920f1534','2f035835-66fe-4d11-bde4-fc37fa310083','Voluptatem velit et sed fugiat odio quis deserunt dolor commodi amet vel molestiae ipsum dolorum neque sint illum','2500.00',NULL,'accepted',NULL,'2026-04-21 10:40:34.202938+00','2026-04-21 10:40:34.202938+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('8401e924-572e-4a5e-bfd5-9abc3e138b49','cc82db63-529d-490a-bbc4-fc1a8b15f84c','2f035835-66fe-4d11-bde4-fc37fa310083','I am  the one','600.00',NULL,'accepted',NULL,'2026-05-05 02:39:28.204486+00','2026-05-05 02:39:28.204486+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('9085c751-d823-4732-8c80-12f2bea55f79','b9601584-cd0e-4b5d-be92-85d26346b7cb','2f035835-66fe-4d11-bde4-fc37fa310083','I AM HIM','400.00',NULL,'accepted',NULL,'2026-05-22 19:07:16.744311+00','2026-05-22 19:07:16.744311+00','2_weeks','ALL OF THE ABOVE',NULL,NULL,NULL,NULL),
  ('97e13019-b8a1-47fc-8158-6fd0df9cf95d','3765eb2b-b8cf-49e5-989f-dce3393bba7c','2f035835-66fe-4d11-bde4-fc37fa310083','Veritatis eiusmod voluptate vel impedit qui mollitia ipsum et quaerat sint deserunt tempora est quos debitis nisi','5572.00',NULL,'accepted',NULL,'2026-04-30 18:59:53.682762+00','2026-04-30 18:59:53.682762+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('98f449ec-6438-469c-bf33-bb29b5112d37','124a3618-048d-49d1-ab19-eb37a4e8ae19','2f035835-66fe-4d11-bde4-fc37fa310083','Quia nisi qui cum non quos deserunt perferendis vitae expedita eum dolorum enim','95.00',NULL,'accepted',NULL,'2026-04-25 15:19:40.485081+00','2026-04-25 15:19:40.485081+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('9aab4773-783e-493e-b42d-0b834c61c15e','9894bac9-4015-49b5-a6ed-953f3857895e','2f035835-66fe-4d11-bde4-fc37fa310083','i am good','23264.00',NULL,'accepted',NULL,'2026-04-27 20:52:11.553205+00','2026-04-27 20:52:11.553205+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('9c654c4a-b122-4614-9e86-136d9f094fcd','58acf034-cb6c-4e0d-9da7-8cc989712c0b','2f035835-66fe-4d11-bde4-fc37fa310083','I got you','3000.00',NULL,'accepted',NULL,'2026-04-17 14:35:11.373415+00','2026-04-17 14:35:11.373415+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('baf853ec-ccdc-428b-b3c5-f235ab2e7508','6ec2e6ce-c046-46a3-b026-6ec313eadb48','2f035835-66fe-4d11-bde4-fc37fa310083','I got this','5000.00',NULL,'accepted',NULL,'2026-04-17 18:41:47.42171+00','2026-04-17 18:41:47.42171+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('e01557dd-4b90-4cd4-9003-278583dea492','d2807ea5-c736-4612-b974-b804113da7cb','2f035835-66fe-4d11-bde4-fc37fa310083','bhhh','900.00',NULL,'pending',NULL,'2026-05-23 18:24:41.540752+00','2026-05-23 18:24:41.540752+00','2_weeks','jbjbjkbj',NULL,NULL,NULL,NULL),
  ('e12fe93f-5baa-4785-b49f-1a153f91888f','a50708af-6c80-4b87-ad70-8ec0aac67f70','2f035835-66fe-4d11-bde4-fc37fa310083','I Am him','2481.00',NULL,'accepted',NULL,'2026-06-04 18:03:10.539293+00','2026-06-04 18:03:10.539293+00','1_week','bmnn',NULL,NULL,'2f035835-66fe-4d11-bde4-fc37fa310083/portfolio-1780596187298-ZYRON_Master_Document_v1.pdf',NULL),
  ('ea237de8-1770-4b70-997c-02e9032e6cea','1b692224-8fda-43fe-a864-d1869bb89358','2f035835-66fe-4d11-bde4-fc37fa310083','hhhb','6000.00',NULL,'accepted',NULL,'2026-04-17 23:15:10.890154+00','2026-04-17 23:15:10.890154+00',NULL,NULL,NULL,NULL,NULL,NULL),
  ('f77c0eed-7d66-41b2-a639-7d716e8459aa','b0f04ee6-d0a7-42b4-ba66-562e0f14f109','2f035835-66fe-4d11-bde4-fc37fa310083','Voluptate proident modi et sint eiusmod rem sit','38.00',NULL,'accepted',NULL,'2026-05-14 18:10:51.473968+00','2026-05-14 18:10:51.473968+00','1_month','Consequatur Possimu','Sunt vel nemo itaque',NULL,NULL,NULL);
--=STMT=
INSERT INTO "public"."jobs" ("id","client_id","title","description","profession_type","budget","budget_type","location_country","location_city","is_remote","status","required_verification","attachments","views_count","applications_count","created_at","updated_at","view_count","job_type","location","required_skills","estimated_duration","brief_attachment_url","experience_level","screening_questions","budget_model","budget_min","budget_max") VALUES
  ('124a3618-048d-49d1-ab19-eb37a4e8ae19','9ff627e5-dc90-4064-af68-4f8e1e62d039','Qui commodo cumque e','Et blanditiis ipsum ','mining_surveyor','23316.00','fixed','United Kingdom','Voluptatem Excepteu',true,'in_progress',true,NULL,0,1,'2026-04-25 15:18:31.893433+00','2026-04-25 15:21:51.779756+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('1b692224-8fda-43fe-a864-d1869bb89358','9ff627e5-dc90-4064-af68-4f8e1e62d039','survey of pieces of land','6 plots','land_surveyor','5000.00','fixed','Nigeria','Lagos',true,'in_progress',true,NULL,0,1,'2026-04-17 18:36:59.357525+00','2026-04-18 00:11:45.876796+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('29844d0d-e203-4e6d-b2ba-92ec920f1534','de45f6b0-3dbd-4acd-a580-2b99e2e5ad83','testing 2.0','Quas earum rerum deb','other','26586.00','hourly','Tanzania','Sequi ut at laborum ',true,'in_progress',true,NULL,0,1,'2026-04-20 12:03:16.344561+00','2026-04-21 10:45:00.392764+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('35923c28-db77-4238-b93f-6324b05e1821','9ff627e5-dc90-4064-af68-4f8e1e62d039','Reprehenderit ea dol','Est quos modi sit et','remote_sensing_analyst','409.00','fixed','Tanzania','Consequatur volupta',false,'in_progress',true,NULL,0,1,'2026-04-18 18:55:05.297815+00','2026-04-19 06:43:11.212637+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('3765eb2b-b8cf-49e5-989f-dce3393bba7c','c9eee12f-b674-4ea3-922b-be75943f56de','Qui ad maxime sunt a','Esse delectus sunt','hydrographic_surveyor','5773.00','hourly','Ghana','Cillum voluptate ear',true,'completed',true,NULL,0,1,'2026-04-30 18:59:06.73516+00','2026-04-30 19:04:53.551543+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('3891f41f-9ab9-444d-b36b-d542ffd390e8','9ff627e5-dc90-4064-af68-4f8e1e62d039','Dolore laborum Adip','Ut sit sed sed quia','remote_sensing_analyst','3867.00','fixed','United States','Est aut in qui labor',true,'in_progress',true,NULL,0,1,'2026-04-19 13:28:10.366354+00','2026-04-19 13:35:41.927394+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('4e369999-1eaf-4da4-bf44-bf9995642f38','9ff627e5-dc90-4064-af68-4f8e1e62d039','Blanditiis alias eiu','Adipisci est ut mole','mining_surveyor','8000.00','hourly','Ghana','Ea eos voluptate sus',true,'completed',true,NULL,0,1,'2026-04-17 23:56:23.648292+00','2026-04-25 14:27:03.317055+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('58acf034-cb6c-4e0d-9da7-8cc989712c0b','9ff627e5-dc90-4064-af68-4f8e1e62d039','survey for 4 hectares of land ','just survey','land_surveyor','3000.00','fixed','Nigeria','lagos',true,'in_progress',true,NULL,0,1,'2026-04-17 14:34:28.475319+00','2026-04-17 23:17:58.885214+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('5979e66f-2131-4b38-ac9a-beea54af80ef','9ff627e5-dc90-4064-af68-4f8e1e62d039','Repellendus Perfere','Sint odit dolores ea','gis_analyst','1969.00','fixed','Ghana','Soluta at omnis qui ',false,'in_progress',true,NULL,0,1,'2026-05-05 14:22:39.584325+00','2026-05-05 14:27:29.216179+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('60fcdff7-5ad8-4d5e-9a0a-0d2080c327ed','9ff627e5-dc90-4064-af68-4f8e1e62d039','Land survey of 70 hectares of land ','just survey','land_surveyor','700.00','fixed',NULL,NULL,false,'open',true,NULL,0,0,'2026-05-19 18:27:20.595061+00','2026-05-19 18:27:20.595061+00',0,'hybrid',NULL,'{}','2_weeks','9ff627e5-dc90-4064-af68-4f8e1e62d039/job-brief-1779215238509-ZYRON_Master_Document_v3.docx','expert',NULL,'fixed',NULL,NULL),
  ('66e22ead-30d6-4048-b272-feb3b6117c17','9ff627e5-dc90-4064-af68-4f8e1e62d039','farm of 70 hectares in ogun state','lkjnk4tjk','land_surveyor','700.00','fixed',NULL,NULL,false,'open',true,NULL,0,0,'2026-06-01 16:02:38.523512+00','2026-06-01 16:02:38.523512+00',0,'remote',NULL,'{}','1_month','9ff627e5-dc90-4064-af68-4f8e1e62d039/job-brief-1780329756565-Dominion-Assignment.pdf','intermediate',NULL,'fixed',NULL,NULL),
  ('6ec2e6ce-c046-46a3-b026-6ec313eadb48','9ff627e5-dc90-4064-af68-4f8e1e62d039','A land','a land','land_surveyor','5000.00','fixed','Ghana','Lagos',false,'in_progress',true,NULL,0,1,'2026-04-17 18:38:11.65544+00','2026-04-17 23:53:19.492202+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('824d95ea-6a64-4325-a04b-a373b4039097','9ff627e5-dc90-4064-af68-4f8e1e62d039','survey for surveyconnect land','survey gravity survey','other','500.00','fixed','South Africa','johannesburg',true,'open',true,NULL,0,1,'2026-04-17 18:29:11.229652+00','2026-04-17 23:18:50.8559+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('8fb08988-13f7-4c62-a513-72a40bf996d7','9ff627e5-dc90-4064-af68-4f8e1e62d039','Illum dicta tenetur','Et magni beatae quia','construction_surveyor','88.00','fixed','United States','Consectetur eos cul',true,'in_progress',true,NULL,0,1,'2026-04-17 18:14:17.931852+00','2026-04-17 23:17:58.885214+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('93940bc2-42c1-4dde-959f-b4c05aef48aa','9ff627e5-dc90-4064-af68-4f8e1e62d039','Land Survey of 100 hectares of land','Wha if it is done','land_surveyor','1500.00','fixed',NULL,NULL,false,'open',true,NULL,0,1,'2026-05-19 19:51:17.595992+00','2026-05-22 19:09:11.932159+00',0,'hybrid',NULL,'{}','1_month','9ff627e5-dc90-4064-af68-4f8e1e62d039/job-brief-1779220275781-ZYRON_Master_Document_v3.pdf','expert',NULL,'negotiable','1000','1500'),
  ('94d5bf9c-3ace-423c-bb2c-98865d210e08','509075b7-08f4-4602-8149-e9ae22c92f1c','Tempor velit ex fugi','Ipsum error molesti','land_surveyor','16555.00','fixed',NULL,NULL,false,'in_progress',true,NULL,0,1,'2026-05-22 19:21:30.009697+00','2026-05-22 19:26:00.796975+00',0,'remote',NULL,'{}','1_week',NULL,'expert',NULL,'fixed',NULL,NULL),
  ('9894bac9-4015-49b5-a6ed-953f3857895e','22a9f0b6-0194-4a25-82f4-061dc7e5d2cd','Beatae laboriosam m','Nulla qui iure in mo','land_surveyor','23264.00','fixed','england','Eum quae nemo sit ve',false,'in_progress',true,NULL,0,1,'2026-04-27 20:50:53.606243+00','2026-04-27 20:54:08.394165+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('98b9ffc0-90df-4475-934a-1b3b3c1a4a88','46342bdb-4654-4813-9e9f-094e72364c4a','Totam sit distinctio','Velit beatae eius vo','gis_analyst','600.00','fixed',NULL,NULL,false,'open',true,NULL,0,1,'2026-05-23 17:49:38.936191+00','2026-05-23 17:51:09.825215+00',0,'hybrid',NULL,'{}','2_weeks',NULL,'intermediate',NULL,'fixed',NULL,NULL),
  ('9c8ad930-17a1-4296-ae54-6e432b809549','9ff627e5-dc90-4064-af68-4f8e1e62d039','Totam irure praesent','Ad harum sed est mol','remote_sensing_analyst','956.00','fixed',NULL,NULL,false,'open',true,NULL,0,0,'2026-05-14 18:18:35.248552+00','2026-05-14 18:18:35.248552+00',0,'remote',NULL,'{}','3_months',NULL,NULL,NULL,'fixed',NULL,NULL),
  ('a50708af-6c80-4b87-ad70-8ec0aac67f70','9ff627e5-dc90-4064-af68-4f8e1e62d039','Amet aut a doloribu','Est eius enim aute ','bim_specialist','2481.00','fixed',NULL,NULL,false,'in_progress',true,NULL,0,1,'2026-06-04 18:01:13.582063+00','2026-06-04 18:07:16.670885+00',0,'remote',NULL,'{}','1_week',NULL,'expert',NULL,'fixed',NULL,NULL),
  ('b0f04ee6-d0a7-42b4-ba66-562e0f14f109','9ff627e5-dc90-4064-af68-4f8e1e62d039','Inventore non culpa ','Dolor dignissimos lo','bim_specialist','8087.00','fixed',NULL,NULL,false,'in_progress',true,NULL,0,1,'2026-05-13 14:05:53.724027+00','2026-05-14 18:15:52.815256+00',0,'remote',NULL,'{}','6_months','9ff627e5-dc90-4064-af68-4f8e1e62d039/job-brief-1778681153348-ZYRON_Master_Document_v1.pdf',NULL,NULL,'fixed',NULL,NULL),
  ('b9601584-cd0e-4b5d-be92-85d26346b7cb','9ff627e5-dc90-4064-af68-4f8e1e62d039','Rerum et qui nisi om','Velit duis eaque bl','bim_specialist','300.00','fixed',NULL,NULL,false,'in_progress',true,NULL,0,1,'2026-05-19 19:54:07.398759+00','2026-05-22 19:28:07.907102+00',0,'remote',NULL,'{}','1_day',NULL,'entry_level',NULL,'negotiable','300',NULL),
  ('bbac79ba-22a4-437b-8306-ffd3daf63db5','9ff627e5-dc90-4064-af68-4f8e1e62d039','Dolorem do nisi dolo','Porro quam maxime qu','gis_analyst','8431.00','hourly','United Kingdom','Aperiam quae qui eos',false,'in_progress',false,NULL,0,1,'2026-04-19 10:34:28.009752+00','2026-04-19 10:48:32.690783+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('c0da2087-2940-4af8-b7a3-ec797afe6973','9ff627e5-dc90-4064-af68-4f8e1e62d039','Soluta modi laborum','Ut veritatis delenit','photogrammetrist','28829.00','fixed',NULL,NULL,false,'in_progress',true,NULL,0,1,'2026-06-04 03:24:29.04842+00','2026-06-04 03:28:17.322566+00',0,'hybrid',NULL,'{}','3_months',NULL,'expert',NULL,'fixed',NULL,NULL),
  ('c189a171-c6fe-432c-8c1d-364d43810fe0','9ff627e5-dc90-4064-af68-4f8e1e62d039','Sed sed repudiandae ','Ratione ipsam maxime','land_surveyor','13174.00','fixed','Tanzania','Pariatur Quis est ',false,'in_progress',false,NULL,0,1,'2026-04-19 07:49:24.971993+00','2026-04-19 07:53:04.555858+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('cc82db63-529d-490a-bbc4-fc1a8b15f84c','9ff627e5-dc90-4064-af68-4f8e1e62d039','Land survey','5 hectraes ','land_surveyor','600.00','fixed','Nigeria','Lagos',false,'in_progress',true,NULL,0,1,'2026-05-05 02:37:21.642102+00','2026-05-05 02:42:53.829592+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('d2807ea5-c736-4612-b974-b804113da7cb','46342bdb-4654-4813-9e9f-094e72364c4a','My house','Land surveyor ','land_surveyor','900.00','fixed',NULL,NULL,false,'open',true,NULL,0,1,'2026-05-20 08:39:19.265626+00','2026-05-23 18:24:41.540752+00',0,'on_site','Ikorodu lagos','{}','2_weeks',NULL,'expert',NULL,'fixed',NULL,NULL),
  ('d8cf4c88-22bd-4199-ab27-85b37b8ad316','509075b7-08f4-4602-8149-e9ae22c92f1c','Esse dolor eos eos','Est magnam sunt ape','remote_sensing_analyst','1070.00','fixed','Kenya','Enim laborum magni e',true,'open',true,NULL,0,0,'2026-05-05 11:44:09.780984+00','2026-05-05 11:44:09.780984+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('efe5ebd4-b644-4961-b43e-b155ae8eee36','9ff627e5-dc90-4064-af68-4f8e1e62d039','Amet non eiusmod au','Porro est nihil non','spatial_data_scientist','70.00','fixed','South Africa','Quia sed id quo tene',true,'in_progress',true,NULL,0,1,'2026-04-17 18:13:50.324616+00','2026-04-17 23:17:58.885214+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL),
  ('f4127f10-d4e2-46fd-b27d-4a5620256c97','9ff627e5-dc90-4064-af68-4f8e1e62d039','Est ut quis nobis lo','Ex cupidatat nulla e','environmental_analyst','13094.00','fixed','Kenya','Quia eos distinctio',false,'in_progress',true,NULL,0,1,'2026-04-25 13:33:07.852768+00','2026-04-25 14:30:18.601437+00',0,'remote',NULL,'{}',NULL,NULL,NULL,NULL,'fixed',NULL,NULL);
--=STMT=
INSERT INTO "public"."messages" ("id","contract_id","sender_id","content","attachment_url","attachment_type","is_read","created_at","read_at") VALUES
  ('511022c7-5073-422f-892e-6bdba547e52d','0d039619-8c4a-4748-ac24-1836be747057','9ff627e5-dc90-4064-af68-4f8e1e62d039','hello',NULL,NULL,false,'2026-06-04 18:08:20.85477+00',NULL),
  ('791ec4ee-1c46-4cf2-9fde-7b7bfd37b303','6356af10-5523-49de-9cf2-5a1b67501f69','2f035835-66fe-4d11-bde4-fc37fa310083','the job has been completed im awaiting payment release',NULL,NULL,false,'2026-04-27 20:56:21.962848+00',NULL),
  ('a2774f87-5914-4e75-8338-b0732336bf70','6356af10-5523-49de-9cf2-5a1b67501f69','22a9f0b6-0194-4a25-82f4-061dc7e5d2cd','Hello how are you doing',NULL,NULL,false,'2026-04-27 20:55:20.963462+00',NULL),
  ('ab06847d-449c-401d-ae49-0ba8017cad68','6356af10-5523-49de-9cf2-5a1b67501f69','2f035835-66fe-4d11-bde4-fc37fa310083','I am doing great how is things sir',NULL,NULL,false,'2026-04-27 20:55:45.035465+00',NULL),
  ('f8854677-6af1-47a5-8a59-8ea83b1702bf','0d039619-8c4a-4748-ac24-1836be747057','9ff627e5-dc90-4064-af68-4f8e1e62d039','i am the client it is 20 acres that i wan you to work on',NULL,NULL,false,'2026-06-04 18:08:54.3453+00',NULL);
--=STMT=
INSERT INTO "public"."notifications" ("id","user_id","type","title","message","is_read","related_job_id","related_contract_id","related_application_id","created_at","link","read_at") VALUES
  ('474899ce-78e1-4a25-9855-5bef2f53dfb6','9ff627e5-dc90-4064-af68-4f8e1e62d039','application','New application received','testing professional applied to "Amet aut a doloribu"',false,NULL,NULL,NULL,'2026-06-04 18:03:11.333091+00','/dashboard/client/jobs/a50708af-6c80-4b87-ad70-8ec0aac67f70/applications',NULL),
  ('51fb2e2e-6942-4f53-bf42-950afc2a6400','9ff627e5-dc90-4064-af68-4f8e1e62d039','contract','Contract activated','Your contract for "Soluta modi laborum" with testing professional is now active.',false,NULL,NULL,NULL,'2026-06-04 03:28:17.890147+00','/dashboard/client/contracts',NULL),
  ('5a3375d4-48c7-477f-a28c-abcb577fd511','46342bdb-4654-4813-9e9f-094e72364c4a','application','New application received','testing professional applied to "My house"',false,NULL,NULL,NULL,'2026-05-23 18:24:42.472207+00','/dashboard/client/jobs/d2807ea5-c736-4612-b974-b804113da7cb/applications',NULL),
  ('63d492b8-28a7-44e6-a9cd-3724a15d111e','9ff627e5-dc90-4064-af68-4f8e1e62d039','application','New application received','testing professional applied to "Land Survey of 100 hectares of land"',false,NULL,NULL,NULL,'2026-05-22 19:09:12.374717+00','/dashboard/client/jobs/93940bc2-42c1-4dde-959f-b4c05aef48aa/applications',NULL),
  ('66d0c912-1a63-4573-8daf-7d37292b903a','509075b7-08f4-4602-8149-e9ae22c92f1c','application','New application received','testing professional applied to "Tempor velit ex fugi"',true,NULL,NULL,NULL,'2026-05-22 19:22:19.296269+00','/dashboard/client/jobs/94d5bf9c-3ace-423c-bb2c-98865d210e08/applications','2026-05-22 19:26:43.958+00'),
  ('70a051be-e316-4013-a8a3-5e239b51efb3','2f035835-66fe-4d11-bde4-fc37fa310083','contract','Contract activated','Your contract for "Tempor velit ex fugi" with hardex is now active.',true,NULL,NULL,NULL,'2026-05-22 19:26:01.578926+00','/dashboard/professional/contracts','2026-06-04 18:07:41.625+00'),
  ('87aeb792-0bcc-498a-9653-e94c1de80399','9ff627e5-dc90-4064-af68-4f8e1e62d039','application','New application received','testing professional applied to "Soluta modi laborum"',false,NULL,NULL,NULL,'2026-06-04 03:25:50.89419+00','/dashboard/client/jobs/c0da2087-2940-4af8-b7a3-ec797afe6973/applications',NULL),
  ('9047f193-2f7c-4b46-8817-a52635cf98ba','2f035835-66fe-4d11-bde4-fc37fa310083','contract','Contract activated','Your contract for "Rerum et qui nisi om" with john doe is now active.',true,NULL,NULL,NULL,'2026-05-22 19:28:08.582228+00','/dashboard/professional/contracts','2026-06-04 18:07:41.625+00'),
  ('91b91e8b-9c0a-4696-b4f1-1a428693f70a','9ff627e5-dc90-4064-af68-4f8e1e62d039','contract','Contract activated','Your contract for "Rerum et qui nisi om" with testing professional is now active.',false,NULL,NULL,NULL,'2026-05-22 19:28:08.582228+00','/dashboard/client/contracts',NULL),
  ('abd9c4cc-4a26-4b88-af82-1ca3bce5d470','509075b7-08f4-4602-8149-e9ae22c92f1c','contract','Contract activated','Your contract for "Tempor velit ex fugi" with testing professional is now active.',true,NULL,NULL,NULL,'2026-05-22 19:26:01.578926+00','/dashboard/client/contracts','2026-05-22 19:26:43.958+00'),
  ('bfa2802d-98e8-4e66-9889-2a12e1336e45','46342bdb-4654-4813-9e9f-094e72364c4a','application','New application received','testing professional applied to "Totam sit distinctio"',false,NULL,NULL,NULL,'2026-05-23 17:51:10.220768+00','/dashboard/client/jobs/98b9ffc0-90df-4475-934a-1b3b3c1a4a88/applications',NULL),
  ('d5a99393-fec3-46a8-924c-14c2f844a4cd','9ff627e5-dc90-4064-af68-4f8e1e62d039','application','New application received','testing professional applied to "Rerum et qui nisi om"',false,NULL,NULL,NULL,'2026-05-22 19:07:17.335183+00','/dashboard/client/jobs/b9601584-cd0e-4b5d-be92-85d26346b7cb/applications',NULL),
  ('eb09e34e-aab4-4f8f-8c9d-dc50ae77c9c6','9ff627e5-dc90-4064-af68-4f8e1e62d039','contract','Contract activated','Your contract for "Amet aut a doloribu" with testing professional is now active.',false,NULL,NULL,NULL,'2026-06-04 18:07:17.530362+00','/dashboard/client/contracts',NULL),
  ('ed7600b0-6376-43de-8a12-5ccfed723bd1','2f035835-66fe-4d11-bde4-fc37fa310083','contract','Contract activated','Your contract for "Soluta modi laborum" with john doe is now active.',true,NULL,NULL,NULL,'2026-06-04 03:28:17.890147+00','/dashboard/professional/contracts','2026-06-04 18:07:41.625+00'),
  ('f44f1ca8-b942-4c96-a108-2120754369fe','2f035835-66fe-4d11-bde4-fc37fa310083','contract','Contract activated','Your contract for "Amet aut a doloribu" with john doe is now active.',true,NULL,NULL,NULL,'2026-06-04 18:07:17.530362+00','/dashboard/professional/contracts','2026-06-04 18:07:41.625+00');
--=STMT=
INSERT INTO "public"."professional_profiles" ("id","profession_type","secondary_profession","years_experience","skills","certifications","license_number","license_url","id_document_url","verification_status","verification_notes","verified_at","hourly_rate","portfolio_description","total_jobs_completed","total_earned","average_rating","total_reviews","created_at","updated_at","onboarding_completed","onboarding_step","onboarding_completed_at","software_tools") VALUES
  ('0300dbf4-73e8-4d82-8c6a-a6f30ec95db6','other',NULL,6,NULL,NULL,'TEST/2026/11','0300dbf4-73e8-4d82-8c6a-a6f30ec95db6/license-1775934521376.jpg','0300dbf4-73e8-4d82-8c6a-a6f30ec95db6/id-1775934520232.png','verified',NULL,NULL,NULL,NULL,0,'0.00','0.00',0,'2026-04-11 19:08:35.756097+00','2026-04-11 19:09:09.013389+00',false,'profile',NULL,'{}'),
  ('0e0fb784-e0fe-4572-a25d-b5a40ee18abd','land_surveyor',NULL,20,NULL,NULL,'172',NULL,NULL,'unverified',NULL,NULL,NULL,NULL,0,'0.00','0.00',0,'2026-05-05 03:30:21.829154+00','2026-05-05 03:30:24.069054+00',true,'complete','2026-05-05 03:30:23.223+00','{}'),
  ('2f035835-66fe-4d11-bde4-fc37fa310083','land_surveyor',NULL,3,NULL,NULL,'TEST/2024/001','2f035835-66fe-4d11-bde4-fc37fa310083/license-1775405902088.png','2f035835-66fe-4d11-bde4-fc37fa310083/id-1775405900129.jpeg','verified',NULL,NULL,NULL,NULL,0,'0.00','0.00',0,'2026-04-05 16:18:24.553696+00','2026-04-27 12:49:08.143454+00',true,'complete','2026-04-27 12:49:07.062+00','{}'),
  ('5a259c50-f3bb-41b7-8e39-da318f3bcf44','remote_sensing_analyst',NULL,20,NULL,NULL,'NIS/2024/1234','5a259c50-f3bb-41b7-8e39-da318f3bcf44/license-1776107201835.png','5a259c50-f3bb-41b7-8e39-da318f3bcf44/id-1776107201150.jpeg','verified',NULL,NULL,NULL,NULL,0,'0.00','0.00',0,'2026-04-13 19:06:37.438836+00','2026-04-13 19:07:11.756851+00',false,'profile',NULL,'{}'),
  ('6b07047a-60a1-420f-a727-b6aebf55d589','land_surveyor',NULL,20,NULL,NULL,'172',NULL,NULL,'rejected',NULL,NULL,NULL,NULL,0,'0.00','0.00',0,'2026-05-11 14:32:52.698907+00','2026-05-11 14:33:27.772067+00',true,'complete','2026-05-11 14:33:26.387+00','{}'),
  ('77b9097e-5ffc-413c-ac6d-5b71e45a02f1','drone_pilot',NULL,67,NULL,NULL,NULL,NULL,NULL,'rejected',NULL,NULL,NULL,NULL,0,'0.00','0.00',0,'2026-05-25 19:14:58.44775+00','2026-05-25 19:16:07.460256+00',true,'complete','2026-05-25 19:16:09.82+00','{ArcGIS Pro,QGIS,ArcGIS Online,Google Earth Engine,Pix4D,AutoCAD Civil 3D,PostGIS,Agisoft Metashape,GDAL/OGR}'),
  ('7c82c756-1e81-4409-b750-33a8415c486f','other',NULL,25,NULL,NULL,'172',NULL,NULL,'rejected',NULL,NULL,NULL,NULL,0,'0.00','0.00',0,'2026-05-11 14:34:40.493464+00','2026-05-11 14:35:26.429838+00',true,'complete','2026-05-11 14:35:25.138+00','{}'),
  ('9ac4f123-ed05-4274-8f9c-431cf93d35a3','land_surveyor',NULL,0,NULL,NULL,'','9ac4f123-ed05-4274-8f9c-431cf93d35a3/license-1776613741339.pdf','9ac4f123-ed05-4274-8f9c-431cf93d35a3/id-1776613730272.pdf','verified',NULL,NULL,NULL,NULL,0,'0.00','0.00',0,'2026-04-19 15:49:10.13779+00','2026-04-24 17:08:56.636494+00',false,'profile',NULL,'{}'),
  ('b96386ac-b63a-4217-b96c-cbccfb8fac75','land_surveyor',NULL,34,NULL,NULL,'172',NULL,NULL,'rejected',NULL,NULL,NULL,NULL,0,'0.00','0.00',0,'2026-05-11 15:42:54.428392+00','2026-05-11 15:44:07.872894+00',true,'complete','2026-05-11 15:44:06.615+00','{}'),
  ('dc5b4c4a-e9c7-4a2b-8265-a788d1a5553d','cartographer',NULL,19,NULL,NULL,NULL,NULL,NULL,'unverified',NULL,NULL,NULL,NULL,0,'0.00','0.00',0,'2026-05-28 18:35:23.426232+00','2026-05-28 18:35:25.765124+00',true,'complete','2026-05-28 18:35:26.404+00','{ArcGIS Online,Google Earth Engine,Pix4D,AutoCAD Civil 3D,QGIS,Global Mapper}');
--=STMT=
INSERT INTO "public"."profiles" ("id","role","full_name","email","phone","country","city","bio","avatar_url","stripe_customer_id","stripe_account_id","is_active","created_at","updated_at","bank_name","bank_account_number","bank_account_name","paystack_recipient_code","is_admin","notification_email","notification_messages","notification_marketing") VALUES
  ('0300dbf4-73e8-4d82-8c6a-a6f30ec95db6','professional','kory dev','korydev@gmail.com','07000000000','Tanzania',NULL,NULL,NULL,NULL,NULL,true,'2026-04-08 18:06:07.339763+00','2026-04-08 18:06:07.339763+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('08c19652-fb75-405b-958a-8f0f97f6526b','professional','Dominion Oluwanimotele','dominioniseoluwa74@gmail.com','+2349032025619','Nigeria',NULL,NULL,NULL,NULL,NULL,true,'2026-04-11 14:01:28.274491+00','2026-04-11 14:01:28.274491+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('0e0fb784-e0fe-4572-a25d-b5a40ee18abd','professional','Desirae Waters','dywa@mailinator.com','+1 (166) 676-3909','Senegal','london','Alias ut sunt incidu',NULL,NULL,NULL,true,'2026-05-04 21:32:47.025785+00','2026-05-05 03:30:21.585204+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('11815b5a-ea2b-46af-9752-71e29bff1ba4','professional','deprof','deprof@gmail.com','07000000000','Nigeria',NULL,NULL,NULL,NULL,NULL,true,'2026-04-27 13:02:01.693677+00','2026-04-27 13:02:01.693677+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('15004154-26b1-43a9-85ed-59472bd83e64','client','Olamilekan Adu','olamilekansam006@gmail.com','08145243729','Nigeria',NULL,NULL,NULL,NULL,NULL,true,'2026-04-12 09:34:46.334697+00','2026-04-12 09:34:46.334697+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('19f60f54-6994-4839-ac92-1214a7cb9e54','professional','Leonard Stefanus','leonardstefanus69@gmail.com','+264817778038','Other',NULL,NULL,NULL,NULL,NULL,true,'2026-04-11 17:09:53.500016+00','2026-04-11 17:09:53.500016+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('22a9f0b6-0194-4a25-82f4-061dc7e5d2cd','client','Regina Mcguire','sepup@mailinator.com','+1 (545) 365-9782','Other',NULL,NULL,NULL,NULL,NULL,true,'2026-04-27 20:50:21.01996+00','2026-04-27 20:50:21.01996+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('27ce074b-da18-48b8-9bd2-61ebe42e9a29','professional','Sasha Johnston','tewegahis@mailinator.com','+1 (171) 994-6938','Minus sed veniam fa','In adipisicing qui p','Facere accusantium e',NULL,NULL,NULL,true,'2026-04-27 14:28:04.612284+00','2026-04-27 20:46:25.599049+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('28ebb5ae-ecf9-43d9-9964-58ab983aabc4','client','Brody Branch','nipugycu@mailinator.com','+1 (518) 727-3557','United States',NULL,NULL,NULL,NULL,NULL,true,'2026-04-30 18:53:21.337022+00','2026-04-30 18:53:21.337022+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('2cbfe756-56da-47b1-9665-703393494a9a','client','client ','client@gmail.com','07010145485','Nigeria',NULL,NULL,NULL,NULL,NULL,true,'2026-04-27 12:32:55.810974+00','2026-04-27 12:32:55.810974+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('2f035835-66fe-4d11-bde4-fc37fa310083','professional','testing professional','testprof@gmail.com','07010145485','Nigeria','Akure,remote','Quia ratione',NULL,NULL,NULL,true,'2026-04-05 08:07:58.803951+00','2026-04-28 05:44:13.424689+00','999992','7010145485','Adekola Abiola Oluyemi',NULL,false,true,true,false),
  ('46342bdb-4654-4813-9e9f-094e72364c4a','client','Korede Adekola','korylinemedia@gmail.com','+2347010145485','Nigeria',NULL,NULL,NULL,NULL,NULL,true,'2026-04-23 05:28:05.097111+00','2026-04-23 10:25:09.717374+00',NULL,NULL,NULL,NULL,true,true,true,false),
  ('509075b7-08f4-4602-8149-e9ae22c92f1c','client','hardex','adesinayomide2@gmail.com','','Nigeria',NULL,NULL,NULL,NULL,NULL,true,'2026-04-30 19:19:34.279856+00','2026-04-30 19:19:34.279856+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('554a0a6d-0858-4e90-adce-f58e9e699b35','client','Benard Ladslaus ','benardmahendeka1@gmail.com','0746543260','Tanzania',NULL,NULL,NULL,NULL,NULL,true,'2026-04-10 18:22:44.247916+00','2026-04-10 18:22:44.247916+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('5a259c50-f3bb-41b7-8e39-da318f3bcf44','professional','korede tech','korytech@gmail.com','+2347010145485','Nigeria',NULL,NULL,NULL,NULL,NULL,true,'2026-04-06 10:36:37.339933+00','2026-04-06 10:36:37.339933+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('6b07047a-60a1-420f-a727-b6aebf55d589','professional','Britanney Leon','fywo@mailinator.com','+1 (365) 754-2716','Canada','london','Culpa ex aut sed in',NULL,NULL,NULL,true,'2026-05-11 14:32:52.07215+00','2026-05-11 14:33:24.784973+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('77b9097e-5ffc-413c-ac6d-5b71e45a02f1','professional','Amena Brennan','tokobagoky@mailinator.com','+1 (666) 648-7975','Senegal','Quasi perspiciatis','Libero quam aute opt',NULL,NULL,NULL,true,'2026-05-25 19:14:57.98267+00','2026-05-25 19:16:02.812243+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('7c82c756-1e81-4409-b750-33a8415c486f','professional','dominion jatuwashe','dominionjatuwashe@gmail.com','+1 (915) 269-1094','South Africa','johannesburg','I am me',NULL,NULL,NULL,true,'2026-05-11 14:34:39.976496+00','2026-05-11 14:35:23.739564+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('7dc8c7cb-baf9-4e3d-ab26-2b24a287ee48','client','Mechelle Bryant','tevytex@mailinator.com','+1 (253) 688-6789','United Kingdom',NULL,NULL,NULL,NULL,NULL,true,'2026-04-28 18:06:41.697189+00','2026-04-28 18:06:41.697189+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('881b2fa7-08bf-4538-ade3-7dbe83a96721','professional','Sonya Bender','mire@mailinator.com','+1 (373) 616-8301','Sed voluptates offic','Vitae sed voluptatem','Et itaque laboriosam',NULL,NULL,NULL,true,'2026-04-27 06:06:13.70776+00','2026-04-27 14:19:15.023878+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('9ac4f123-ed05-4274-8f9c-431cf93d35a3','professional','Benard Mahendeka','benardmahendeka13@gmail.com','+255718165741','Tanzania',NULL,NULL,NULL,NULL,NULL,true,'2026-04-10 18:03:44.277758+00','2026-04-10 18:03:44.277758+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('9efab5df-002b-4bbe-90cf-8330e4c55fcc','client','Chelsea Peck','lizyrato@mailinator.com','+1 (225) 121-7353','United States',NULL,NULL,NULL,NULL,NULL,true,'2026-04-30 18:50:18.157052+00','2026-04-30 18:50:18.157052+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('9ff627e5-dc90-4064-af68-4f8e1e62d039','client','john doe','johndoe@gmail.com','+2347010145485','Nigeria',NULL,NULL,NULL,NULL,NULL,true,'2026-04-06 10:35:14.518641+00','2026-04-06 10:35:14.518641+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('a23341aa-6afe-4899-a9e7-622729990be7','professional','Price Estrada','goxyqoleto@mailinator.com','+1 (224) 725-1241','South Africa',NULL,NULL,NULL,NULL,NULL,true,'2026-04-25 16:22:24.134079+00','2026-04-25 16:22:24.134079+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('ab2c3938-403d-4dae-b92e-8fddc48e77db','client','client1','client1@gmail.com','07000000000','Kenya','','',NULL,NULL,NULL,true,'2026-04-06 11:03:02.602345+00','2026-04-27 12:50:56.945645+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('af1dc249-6778-4eca-b2cb-316ecfa3cb8d','professional','Beatrice Holland','jogu@mailinator.com','+1 (874) 781-8123','Kenya',NULL,NULL,NULL,NULL,NULL,true,'2026-04-23 13:28:45.224363+00','2026-04-23 13:28:45.224363+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('b42b53eb-0997-4a80-bfbc-9652412a5db0','client','Vincent Wiley','nyruhox@mailinator.com','+1 (976) 173-8752','Côte d''Ivoire',NULL,NULL,NULL,NULL,NULL,true,'2026-05-05 11:31:26.732781+00','2026-05-05 11:31:26.732781+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('b855a12a-462e-4ee9-8a05-505d64ac74d0','professional','Jakeem Gill','gigako@mailinator.com','+1 (586) 705-8384','United States',NULL,NULL,NULL,NULL,NULL,true,'2026-04-20 12:05:49.479341+00','2026-04-20 12:05:49.479341+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('b96386ac-b63a-4217-b96c-cbccfb8fac75','professional','gahkusi davis','gahkusidavis@gmail.com','+1 (915) 269-1094','Nigeria','Lagos','I am me',NULL,NULL,NULL,true,'2026-05-11 15:42:53.795841+00','2026-05-11 15:44:05.874284+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('c9eee12f-b674-4ea3-922b-be75943f56de','client','Leigh Rodgers','xudakazoj@mailinator.com','+1 (998) 976-6425','Senegal',NULL,NULL,NULL,NULL,NULL,true,'2026-04-30 18:55:02.398442+00','2026-04-30 18:55:02.398442+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('cfcdd705-6330-4fb3-b8a1-e36660460b83','professional','Forrest Flowers','hahup@mailinator.com','+1 (872) 126-3376','Australia','london','i am a boy',NULL,NULL,NULL,true,'2026-04-30 18:53:49.055875+00','2026-04-30 18:54:05.238381+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('dc5b4c4a-e9c7-4a2b-8265-a788d1a5553d','professional','Emmanuel Kory','adekolakorede31@gmail.com','07075844893','Nigeria','Lagos','ygygyggygygugygyugghhvvgvghvcxxzds',NULL,NULL,NULL,true,'2026-04-30 19:22:57.414253+00','2026-05-28 18:35:22.283506+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('de45f6b0-3dbd-4acd-a580-2b99e2e5ad83','client','Watashi wa kory desu','korydes@gmail.com','09000000000','Nigeria',NULL,NULL,NULL,NULL,NULL,true,'2026-04-20 12:01:55.350614+00','2026-04-20 12:01:55.350614+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('e1f1fdbe-b415-45d0-b809-432126dd7320','client','Kristen Odom','zyditubo@mailinator.com','+1 (968) 639-4849','United Kingdom','Toronto','',NULL,NULL,NULL,true,'2026-04-28 19:01:03.97682+00','2026-04-29 01:42:26.739195+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('eacd3c94-beed-4929-bd63-90b3d5600cf4','client','Walter Phillips','fywefaqiw@mailinator.com','+1 (551) 819-5739','Tanzania',NULL,NULL,NULL,NULL,NULL,true,'2026-04-25 16:23:33.727779+00','2026-04-25 16:23:33.727779+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('f11b7e6c-05e9-4ced-8ef8-ead7ccc0f1b2','professional','Keely Sharp','kifohonabo@mailinator.com','+1 (998) 551-7676','United Kingdom','london','type shi',NULL,NULL,NULL,true,'2026-04-27 14:31:56.561368+00','2026-04-27 14:39:23.179361+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('fbdc65d0-a131-48bf-846c-cb6694bdbebd','professional','Suki Moore','kixomyra@mailinator.com','+1 (915) 269-1094','Senegal',NULL,NULL,NULL,NULL,NULL,true,'2026-04-23 10:51:24.977394+00','2026-04-23 10:51:24.977394+00',NULL,NULL,NULL,NULL,false,true,true,false),
  ('fe052c3b-ed01-4ada-8033-2ef963e0cab4','professional','Kuame Shaw','vysiwu@mailinator.com','+1 (997) 539-4249','United States','london','tyc ty',NULL,NULL,NULL,true,'2026-04-28 05:42:40.602249+00','2026-04-28 05:42:57.968715+00',NULL,NULL,NULL,NULL,false,true,true,false);
--=STMT=
INSERT INTO storage.buckets ("id","name","owner","created_at","updated_at","public","avif_autodetection","file_size_limit","allowed_mime_types","owner_id","type") VALUES ('job-briefs','job-briefs',NULL,'2026-05-13 14:01:03.001809+00','2026-05-13 14:01:03.001809+00',false,false,10485760,NULL,NULL,'STANDARD') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO storage.buckets ("id","name","owner","created_at","updated_at","public","avif_autodetection","file_size_limit","allowed_mime_types","owner_id","type") VALUES ('portfolio-attachments','portfolio-attachments',NULL,'2026-05-13 14:04:58.504205+00','2026-05-13 14:04:58.504205+00',false,false,5242880,'{application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document}',NULL,'STANDARD') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO storage.buckets ("id","name","owner","created_at","updated_at","public","avif_autodetection","file_size_limit","allowed_mime_types","owner_id","type") VALUES ('portfolio-images','portfolio-images',NULL,'2026-04-05 15:57:11.318163+00','2026-04-05 15:57:11.318163+00',true,false,10485760,'{image/jpeg,image/png,image/webp}',NULL,'STANDARD') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO storage.buckets ("id","name","owner","created_at","updated_at","public","avif_autodetection","file_size_limit","allowed_mime_types","owner_id","type") VALUES ('verification-documents','verification-documents',NULL,'2026-04-05 15:55:44.76797+00','2026-04-05 15:55:44.76797+00',false,false,5242880,'{image/jpeg,image/png,application/pdf}',NULL,'STANDARD') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','9ac4f123-ed05-4274-8f9c-431cf93d35a3','authenticated','authenticated','benardmahendeka13@gmail.com','$2a$10$u0nmIFeLiv7oSbgbZHdc0uKnI8J6lpFoWO0q/1UwogmZiUdjocFYe','2026-04-10 18:03:43.708991+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-21 20:26:26.471144+00','{"provider":"email","providers":["email"]}','{"sub":"9ac4f123-ed05-4274-8f9c-431cf93d35a3","email":"benardmahendeka13@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-10 18:03:43.692461+00','2026-04-21 20:26:26.491535+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','08c19652-fb75-405b-958a-8f0f97f6526b','authenticated','authenticated','dominioniseoluwa74@gmail.com','$2a$10$pEkFLyEZP0bB7mTfDRGmQuv7RFYBDy/t2eErTmmDzDJu6nDLnpra.','2026-04-11 14:01:27.398057+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-11 14:01:27.410157+00','{"provider":"email","providers":["email"]}','{"sub":"08c19652-fb75-405b-958a-8f0f97f6526b","email":"dominioniseoluwa74@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-11 14:01:27.370689+00','2026-04-11 20:11:52.236911+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','5a259c50-f3bb-41b7-8e39-da318f3bcf44','authenticated','authenticated','korytech@gmail.com','$2a$10$6hzBBgL7/GxD8NzYVxVTpOIA3tAjCmJyk2antmX7HO9YwHXm8nXrG','2026-04-06 10:36:36.949274+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-15 19:30:57.960075+00','{"provider":"email","providers":["email"]}','{"sub":"5a259c50-f3bb-41b7-8e39-da318f3bcf44","email":"korytech@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-06 10:36:36.924534+00','2026-04-17 23:40:37.04144+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','46342bdb-4654-4813-9e9f-094e72364c4a','authenticated','authenticated','korylinemedia@gmail.com','$2a$10$g2NCalkLMQU9qJi02VTyw.Aow3kwZGriE6ISbYOmPhEtEWgSES/Fu','2026-04-23 05:28:04.229777+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-05-23 17:48:46.292288+00','{"provider":"email","providers":["email"]}','{"sub":"46342bdb-4654-4813-9e9f-094e72364c4a","email":"korylinemedia@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-23 05:28:04.202403+00','2026-05-25 18:54:07.54727+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','0300dbf4-73e8-4d82-8c6a-a6f30ec95db6','authenticated','authenticated','korydev@gmail.com','$2a$10$mLtN6F15l/k4U5GeJL8gieHcl0ZqjIib/nA3grUGeuL4zNgvi4J9e','2026-04-08 18:06:05.739858+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-13 18:47:57.108979+00','{"provider":"email","providers":["email"]}','{"sub":"0300dbf4-73e8-4d82-8c6a-a6f30ec95db6","email":"korydev@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-08 18:06:05.681475+00','2026-04-13 18:47:57.118322+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','de45f6b0-3dbd-4acd-a580-2b99e2e5ad83','authenticated','authenticated','korydes@gmail.com','$2a$10$hmYtCPyLETE88l8oRUAIVOy2asFpreJ5vEPcC3PN8A5IoTvvT/ex.','2026-04-20 12:01:52.188571+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-23 10:16:37.692419+00','{"provider":"email","providers":["email"]}','{"sub":"de45f6b0-3dbd-4acd-a580-2b99e2e5ad83","email":"korydes@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-20 12:01:52.165123+00','2026-04-23 10:16:37.707226+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','fbdc65d0-a131-48bf-846c-cb6694bdbebd','authenticated','authenticated','kixomyra@mailinator.com','$2a$10$K7A9yKieLZubc1qgDpqoJu9SxmNTp1093Xxrft0XIdvIWoARRzGhK','2026-04-23 10:51:24.494557+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-23 10:51:24.501742+00','{"provider":"email","providers":["email"]}','{"sub":"fbdc65d0-a131-48bf-846c-cb6694bdbebd","email":"kixomyra@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-23 10:51:24.47276+00','2026-04-23 12:18:50.267374+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','b855a12a-462e-4ee9-8a05-505d64ac74d0','authenticated','authenticated','gigako@mailinator.com','$2a$10$W5.zJ79iGy9P7PSNGy0r.OwgK17mulGmctKaR/qmS1zd5CNWW2BBG','2026-04-20 12:05:46.397829+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-20 12:05:46.402902+00','{"provider":"email","providers":["email"]}','{"sub":"b855a12a-462e-4ee9-8a05-505d64ac74d0","email":"gigako@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-20 12:05:46.372871+00','2026-04-23 13:31:18.832469+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','2f035835-66fe-4d11-bde4-fc37fa310083','authenticated','authenticated','testprof@gmail.com','$2a$10$Qq/hG8.bcOHUnPe8p5vsKePu6NO8OopsAM5U1IFo1slAjbyPhIlBG','2026-04-05 08:07:58.302846+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-06-16 05:23:16.978421+00','{"provider":"email","providers":["email"]}','{"sub":"2f035835-66fe-4d11-bde4-fc37fa310083","email":"testprof@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-05 08:07:58.295677+00','2026-06-16 05:23:17.069413+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','9ff627e5-dc90-4064-af68-4f8e1e62d039','authenticated','authenticated','johndoe@gmail.com','$2a$10$nQdsEnQiYCG7YlfGRK/aROxRM3vyvxJoET4HnvzYejTZQNJy70ucO','2026-04-06 10:35:13.039919+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-06-01 16:26:59.373455+00','{"provider":"email","providers":["email"]}','{"sub":"9ff627e5-dc90-4064-af68-4f8e1e62d039","email":"johndoe@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-06 10:35:13.01012+00','2026-06-12 18:24:24.339446+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','15004154-26b1-43a9-85ed-59472bd83e64','authenticated','authenticated','olamilekansam006@gmail.com','$2a$10$BmE3FSvLCJOAdbeBDLar6eX.AWIbEc9JRnAQbEKdb0kE4a1YPlVaS','2026-04-12 09:34:45.41298+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-12 09:34:45.42764+00','{"provider":"email","providers":["email"]}','{"sub":"15004154-26b1-43a9-85ed-59472bd83e64","email":"olamilekansam006@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-12 09:34:45.367553+00','2026-04-14 18:50:46.071171+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','19f60f54-6994-4839-ac92-1214a7cb9e54','authenticated','authenticated','leonardstefanus69@gmail.com','$2a$10$uaxShRyZ.b9eR1Bpk2Bh1.4QolkA1RuTbhpwCUZ6Hgn7M.Kzv90ue','2026-04-11 17:09:52.788778+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-11 17:10:17.62197+00','{"provider":"email","providers":["email"]}','{"sub":"19f60f54-6994-4839-ac92-1214a7cb9e54","email":"leonardstefanus69@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-11 17:09:52.769409+00','2026-04-11 17:10:17.624315+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','ab2c3938-403d-4dae-b92e-8fddc48e77db','authenticated','authenticated','client1@gmail.com','$2a$10$mx3UtJ1S3Hm01LT/X3QTdOgWHyPtpCH6XrND91blPHMpmBIbEbbQW','2026-04-06 11:03:01.787455+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-27 12:34:33.169373+00','{"provider":"email","providers":["email"]}','{"sub":"ab2c3938-403d-4dae-b92e-8fddc48e77db","email":"client1@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-06 11:03:01.764946+00','2026-04-27 12:34:33.194731+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','554a0a6d-0858-4e90-adce-f58e9e699b35','authenticated','authenticated','benardmahendeka1@gmail.com','$2a$10$F2BcHf7a.xvUGahFYe3uneROW0qD/8ye8UnRf22GpKAJjxH6sL4RK','2026-04-10 18:22:43.51885+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-19 15:49:39.016423+00','{"provider":"email","providers":["email"]}','{"sub":"554a0a6d-0858-4e90-adce-f58e9e699b35","email":"benardmahendeka1@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-10 18:22:43.49826+00','2026-04-21 20:24:33.123613+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','881b2fa7-08bf-4538-ade3-7dbe83a96721','authenticated','authenticated','mire@mailinator.com','$2a$10$GAFhBSCzqHyDfk5ZrtjYZOE0PcMl5LyLtQxjfkqlQfa0EdShtH/w2','2026-04-27 06:06:13.255757+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-27 06:06:13.265769+00','{"provider":"email","providers":["email"]}','{"sub":"881b2fa7-08bf-4538-ade3-7dbe83a96721","email":"mire@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-27 06:06:13.235304+00','2026-04-27 14:14:22.27563+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','eacd3c94-beed-4929-bd63-90b3d5600cf4','authenticated','authenticated','fywefaqiw@mailinator.com','$2a$10$jq/AuT/mxErbPc4iNcqScuf/.0ZDgEd1WUKRqABhPSHkJAJvttOqy','2026-04-25 16:23:33.385998+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-25 16:23:33.390154+00','{"provider":"email","providers":["email"]}','{"sub":"eacd3c94-beed-4929-bd63-90b3d5600cf4","email":"fywefaqiw@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-25 16:23:33.371807+00','2026-04-27 06:04:53.053958+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','ebcead3a-da1e-42c3-9dff-c5026cf67615','authenticated','authenticated','hardex1339@gmail.com','$2a$10$MRhMVY9LSadNaYysMCGVOOxgeW6f67f6u36QMVhvLsi.V4BT8aW8.','2026-04-23 13:35:36.16173+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-23 13:35:36.16905+00','{"provider":"email","providers":["email"]}','{"sub":"ebcead3a-da1e-42c3-9dff-c5026cf67615","email":"hardex1339@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-23 13:35:36.136443+00','2026-04-23 13:35:36.174064+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','af1dc249-6778-4eca-b2cb-316ecfa3cb8d','authenticated','authenticated','jogu@mailinator.com','$2a$10$t6SRwrUfq4nogoLFsVdusOHmgPrEYnE0/qHiZpXsjHFde9N75d7CS','2026-04-23 13:28:44.751217+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-23 13:28:44.76551+00','{"provider":"email","providers":["email"]}','{"sub":"af1dc249-6778-4eca-b2cb-316ecfa3cb8d","email":"jogu@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-23 13:28:44.731624+00','2026-04-23 17:57:29.725189+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','f11b7e6c-05e9-4ced-8ef8-ead7ccc0f1b2','authenticated','authenticated','kifohonabo@mailinator.com','$2a$10$mOU5O2HvzOfVMdloBGqxTerHv/sTsRwGEVl/MXfWJJezF9xQtTTwy','2026-04-27 14:31:55.655209+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-27 14:31:55.663002+00','{"provider":"email","providers":["email"]}','{"sub":"f11b7e6c-05e9-4ced-8ef8-ead7ccc0f1b2","email":"kifohonabo@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-27 14:31:55.612998+00','2026-04-27 14:31:55.675325+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','2cbfe756-56da-47b1-9665-703393494a9a','authenticated','authenticated','client@gmail.com','$2a$10$xLaOOXv6EKU0qaSwxmS3gepXxhG/fkxfUfjQtjgADGVS4Z/4B8MFG','2026-04-27 12:32:55.287249+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-27 12:32:55.294928+00','{"provider":"email","providers":["email"]}','{"sub":"2cbfe756-56da-47b1-9665-703393494a9a","email":"client@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-27 12:32:55.237805+00','2026-04-27 12:32:55.29944+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','27ce074b-da18-48b8-9bd2-61ebe42e9a29','authenticated','authenticated','tewegahis@mailinator.com','$2a$10$Rt12nw2zjEbRd7lmxW3T6.OQ06mhtIi8P/6vRAwTsHdIm4NS22Zta','2026-04-27 14:28:03.694342+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-27 14:28:03.702965+00','{"provider":"email","providers":["email"]}','{"sub":"27ce074b-da18-48b8-9bd2-61ebe42e9a29","email":"tewegahis@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-27 14:28:03.648025+00','2026-04-27 20:45:15.146793+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','a23341aa-6afe-4899-a9e7-622729990be7','authenticated','authenticated','goxyqoleto@mailinator.com','$2a$10$sINX90S6hNYXbhFBX6NswuLaEfs83qG1XNiAPbACJDNsywPy6q8qe','2026-04-25 16:22:23.179648+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-25 16:22:23.188368+00','{"provider":"email","providers":["email"]}','{"sub":"a23341aa-6afe-4899-a9e7-622729990be7","email":"goxyqoleto@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-25 16:22:23.135526+00','2026-04-25 16:22:23.200327+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','11815b5a-ea2b-46af-9752-71e29bff1ba4','authenticated','authenticated','deprof@gmail.com','$2a$10$g3OHDTGsNQ8K.zlgYgxEguDyrYgYAj1IH7rGS.tNsOBPwzxDdf9Hi','2026-04-27 13:02:01.126726+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-27 13:02:01.137671+00','{"provider":"email","providers":["email"]}','{"sub":"11815b5a-ea2b-46af-9752-71e29bff1ba4","email":"deprof@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-27 13:02:01.10286+00','2026-04-27 13:02:01.149587+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','22a9f0b6-0194-4a25-82f4-061dc7e5d2cd','authenticated','authenticated','sepup@mailinator.com','$2a$10$JCxEQxOLk4bQJo7DPZJoguOIt1fcqJN7CGvXvUWTO0XLoSDJPwBCy','2026-04-27 20:50:20.494258+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-27 20:50:20.501338+00','{"provider":"email","providers":["email"]}','{"sub":"22a9f0b6-0194-4a25-82f4-061dc7e5d2cd","email":"sepup@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-27 20:50:20.461239+00','2026-04-28 05:40:53.043732+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','fe052c3b-ed01-4ada-8033-2ef963e0cab4','authenticated','authenticated','vysiwu@mailinator.com','$2a$10$/p.HToGDC1AzaJ1Z80dFh.Sqj4g3KmsWLlkp8cTwIxUsEeHxJ3iPq','2026-04-28 05:42:39.716881+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-28 05:42:39.727021+00','{"provider":"email","providers":["email"]}','{"sub":"fe052c3b-ed01-4ada-8033-2ef963e0cab4","email":"vysiwu@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-28 05:42:39.637297+00','2026-04-28 05:42:39.744822+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','7dc8c7cb-baf9-4e3d-ab26-2b24a287ee48','authenticated','authenticated','tevytex@mailinator.com','$2a$10$PWH7tVVqqsawXFQYby2w2es..UHPtvwFI7iWGZ.nArme2R6kxq8km','2026-04-28 18:06:40.69829+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-28 18:06:40.719888+00','{"provider":"email","providers":["email"]}','{"sub":"7dc8c7cb-baf9-4e3d-ab26-2b24a287ee48","email":"tevytex@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-28 18:06:40.638773+00','2026-04-28 18:06:40.775724+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','e1f1fdbe-b415-45d0-b809-432126dd7320','authenticated','authenticated','zyditubo@mailinator.com','$2a$10$F/O0qBB6JY5A9Ko1b7wCc.pJaDLO5L6Lsb0jBecGsvaIsdUUCn2Ly','2026-04-28 19:01:03.226123+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-30 18:54:42.145788+00','{"provider":"email","providers":["email"]}','{"sub":"e1f1fdbe-b415-45d0-b809-432126dd7320","email":"zyditubo@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-28 19:01:03.193952+00','2026-04-30 18:54:42.15221+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','9efab5df-002b-4bbe-90cf-8330e4c55fcc','authenticated','authenticated','lizyrato@mailinator.com','$2a$10$ReWT7HnrVG54kfQMj36u4.g7nboa1I4uJ5itLx2FS33dyb3hSMWB.','2026-04-30 18:50:17.013116+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-30 18:54:59.712103+00','{"provider":"email","providers":["email"]}','{"sub":"9efab5df-002b-4bbe-90cf-8330e4c55fcc","email":"lizyrato@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-30 18:50:16.964076+00','2026-04-30 18:54:59.714845+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','28ebb5ae-ecf9-43d9-9964-58ab983aabc4','authenticated','authenticated','nipugycu@mailinator.com','$2a$10$H6IUyGkdBXq4FGtlIUSRVesy.VpeNsG3rSEnNb6Imh3pebFCh5ghe','2026-04-30 18:53:20.763192+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-30 18:53:20.769273+00','{"provider":"email","providers":["email"]}','{"sub":"28ebb5ae-ecf9-43d9-9964-58ab983aabc4","email":"nipugycu@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-30 18:53:20.737035+00','2026-04-30 18:53:20.777327+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','7c82c756-1e81-4409-b750-33a8415c486f','authenticated','authenticated','dominionjatuwashe@gmail.com','$2a$10$kAkxJART4fay/zEbfGPZG.KkybKM3gQhtLgWxtmJlnSuBdMdGxl5a','2026-05-11 14:34:39.233679+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-05-11 14:34:39.23901+00','{"provider":"email","providers":["email"]}','{"sub":"7c82c756-1e81-4409-b750-33a8415c486f","email":"dominionjatuwashe@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-05-11 14:34:39.219101+00','2026-05-11 14:34:39.245466+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','cfcdd705-6330-4fb3-b8a1-e36660460b83','authenticated','authenticated','hahup@mailinator.com','$2a$10$mXuJeU7fg0JHbIZzBxLfne.EdxqQ.ll/bfm/uyZrKbS2E0w9BiEwO','2026-04-30 18:53:48.834949+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-30 18:53:48.837854+00','{"provider":"email","providers":["email"]}','{"sub":"cfcdd705-6330-4fb3-b8a1-e36660460b83","email":"hahup@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-30 18:53:48.825733+00','2026-04-30 18:53:48.840552+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','b42b53eb-0997-4a80-bfbc-9652412a5db0','authenticated','authenticated','nyruhox@mailinator.com','$2a$10$Wlxm4TcQxibJh8mfxn9A3eq7RyOyd97YJp9uFr5vQjxwEFnFVGsvO','2026-05-05 11:31:26.277519+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-05-05 11:31:26.28566+00','{"provider":"email","providers":["email"]}','{"sub":"b42b53eb-0997-4a80-bfbc-9652412a5db0","email":"nyruhox@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-05-05 11:31:26.256552+00','2026-05-05 14:20:19.186584+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','0e0fb784-e0fe-4572-a25d-b5a40ee18abd','authenticated','authenticated','dywa@mailinator.com','$2a$10$0BufFchjLFmOAMrWrq28YOViA.fx7AmCBHJbein48MWoYEdyVZnKi','2026-05-04 21:32:44.609501+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-05-04 21:32:44.618308+00','{"provider":"email","providers":["email"]}','{"sub":"0e0fb784-e0fe-4572-a25d-b5a40ee18abd","email":"dywa@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-05-04 21:32:44.576799+00','2026-05-05 03:30:43.251448+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','c9eee12f-b674-4ea3-922b-be75943f56de','authenticated','authenticated','xudakazoj@mailinator.com','$2a$10$uyDRdhrN0HLyxTUIV3UJGOdSD6BZ4BwI5y5paTjJ8iJ.qdWIyxSTu','2026-04-30 18:55:01.979265+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-30 18:55:01.983799+00','{"provider":"email","providers":["email"]}','{"sub":"c9eee12f-b674-4ea3-922b-be75943f56de","email":"xudakazoj@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-30 18:55:01.968377+00','2026-04-30 18:55:01.986753+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','6b07047a-60a1-420f-a727-b6aebf55d589','authenticated','authenticated','fywo@mailinator.com','$2a$10$4yAHlYcqg4XbS5I96hh8ru9i8m9.adSDsjWfPYZuvSMcNYDS6DxG.','2026-05-11 14:32:51.046567+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-05-11 14:32:51.06034+00','{"provider":"email","providers":["email"]}','{"sub":"6b07047a-60a1-420f-a727-b6aebf55d589","email":"fywo@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-05-11 14:32:51.002619+00','2026-05-11 14:32:51.086988+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','dc5b4c4a-e9c7-4a2b-8265-a788d1a5553d','authenticated','authenticated','adekolakorede31@gmail.com','$2a$10$EVCPRmWyTqC9IHjNEZL4b.oxc0XVyaersDYJ3dlI9V1I6hQKuZ89W','2026-04-30 19:22:56.228599+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-04-30 19:22:56.231839+00','{"provider":"email","providers":["email"]}','{"sub":"dc5b4c4a-e9c7-4a2b-8265-a788d1a5553d","email":"adekolakorede31@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-30 19:22:56.200642+00','2026-05-01 18:18:50.501503+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','b96386ac-b63a-4217-b96c-cbccfb8fac75','authenticated','authenticated','gahkusidavis@gmail.com','$2a$10$iOdw5scgbeRc2Qdj2cIMWOTcR1jmUpTvQ1hEwRWqz24RbdzRNWNRG','2026-05-11 15:42:52.554742+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-05-11 15:42:52.572496+00','{"provider":"email","providers":["email"]}','{"sub":"b96386ac-b63a-4217-b96c-cbccfb8fac75","email":"gahkusidavis@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-05-11 15:42:52.490535+00','2026-05-11 15:42:52.607893+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','509075b7-08f4-4602-8149-e9ae22c92f1c','authenticated','authenticated','adesinayomide2@gmail.com','$2a$10$cb06MVx7D0r1Mn33yETknuCWePJF/Q9TVE7q18QHt1WCN6m755cle','2026-04-30 19:19:33.951971+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-05-22 19:19:44.665503+00','{"provider":"email","providers":["email"]}','{"sub":"509075b7-08f4-4602-8149-e9ae22c92f1c","email":"adesinayomide2@gmail.com","email_verified":true,"phone_verified":false}',NULL,'2026-04-30 19:19:33.93136+00','2026-05-28 18:18:21.76191+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."users" ("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous") VALUES ('00000000-0000-0000-0000-000000000000','77b9097e-5ffc-413c-ac6d-5b71e45a02f1','authenticated','authenticated','tokobagoky@mailinator.com','$2a$10$.j4jGsE/8sLX.oLuDiNYI.ad5gfyQwdy2bJ6cWI59WMWSCi275GNy','2026-05-25 19:14:57.204641+00',NULL,'',NULL,'',NULL,'','',NULL,'2026-05-25 19:14:57.214901+00','{"provider":"email","providers":["email"]}','{"sub":"77b9097e-5ffc-413c-ac6d-5b71e45a02f1","email":"tokobagoky@mailinator.com","email_verified":true,"phone_verified":false}',NULL,'2026-05-25 19:14:57.178824+00','2026-05-28 21:02:17.111962+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,false,NULL,false) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('0300dbf4-73e8-4d82-8c6a-a6f30ec95db6','0300dbf4-73e8-4d82-8c6a-a6f30ec95db6','{"sub":"0300dbf4-73e8-4d82-8c6a-a6f30ec95db6","email":"korydev@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-08 18:06:05.717696+00','2026-04-08 18:06:05.717753+00','2026-04-08 18:06:05.717753+00','f0cd676d-6c52-4531-8338-9c0ca24bf6e2') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('08c19652-fb75-405b-958a-8f0f97f6526b','08c19652-fb75-405b-958a-8f0f97f6526b','{"sub":"08c19652-fb75-405b-958a-8f0f97f6526b","email":"dominioniseoluwa74@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-11 14:01:27.393632+00','2026-04-11 14:01:27.393681+00','2026-04-11 14:01:27.393681+00','1b35f201-ab9b-4f91-9f33-0e4f5203dc2b') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('0e0fb784-e0fe-4572-a25d-b5a40ee18abd','0e0fb784-e0fe-4572-a25d-b5a40ee18abd','{"sub":"0e0fb784-e0fe-4572-a25d-b5a40ee18abd","email":"dywa@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-05-04 21:32:44.603702+00','2026-05-04 21:32:44.603748+00','2026-05-04 21:32:44.603748+00','4e662054-990e-4fb8-a255-ad7458bb8b25') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('11815b5a-ea2b-46af-9752-71e29bff1ba4','11815b5a-ea2b-46af-9752-71e29bff1ba4','{"sub":"11815b5a-ea2b-46af-9752-71e29bff1ba4","email":"deprof@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-27 13:02:01.120361+00','2026-04-27 13:02:01.120406+00','2026-04-27 13:02:01.120406+00','2b08f759-1080-4da3-8315-722a099d98bc') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('15004154-26b1-43a9-85ed-59472bd83e64','15004154-26b1-43a9-85ed-59472bd83e64','{"sub":"15004154-26b1-43a9-85ed-59472bd83e64","email":"olamilekansam006@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-12 09:34:45.398382+00','2026-04-12 09:34:45.401676+00','2026-04-12 09:34:45.401676+00','cbef8684-76a8-46c5-b94d-132e0ec7b289') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('19f60f54-6994-4839-ac92-1214a7cb9e54','19f60f54-6994-4839-ac92-1214a7cb9e54','{"sub":"19f60f54-6994-4839-ac92-1214a7cb9e54","email":"leonardstefanus69@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-11 17:09:52.784637+00','2026-04-11 17:09:52.784686+00','2026-04-11 17:09:52.784686+00','55a93310-b2ad-4b9d-99b6-a926817f69be') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('22a9f0b6-0194-4a25-82f4-061dc7e5d2cd','22a9f0b6-0194-4a25-82f4-061dc7e5d2cd','{"sub":"22a9f0b6-0194-4a25-82f4-061dc7e5d2cd","email":"sepup@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-27 20:50:20.489452+00','2026-04-27 20:50:20.489507+00','2026-04-27 20:50:20.489507+00','11d90268-b283-4986-9eb7-c9df8e4a7584') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('27ce074b-da18-48b8-9bd2-61ebe42e9a29','27ce074b-da18-48b8-9bd2-61ebe42e9a29','{"sub":"27ce074b-da18-48b8-9bd2-61ebe42e9a29","email":"tewegahis@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-27 14:28:03.683704+00','2026-04-27 14:28:03.683758+00','2026-04-27 14:28:03.683758+00','9af5bb53-d72c-4ebe-81ff-6fc6decd97a5') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('28ebb5ae-ecf9-43d9-9964-58ab983aabc4','28ebb5ae-ecf9-43d9-9964-58ab983aabc4','{"sub":"28ebb5ae-ecf9-43d9-9964-58ab983aabc4","email":"nipugycu@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-30 18:53:20.757331+00','2026-04-30 18:53:20.757387+00','2026-04-30 18:53:20.757387+00','c7258cc7-69f4-4728-a479-61f22c3e6378') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('2cbfe756-56da-47b1-9665-703393494a9a','2cbfe756-56da-47b1-9665-703393494a9a','{"sub":"2cbfe756-56da-47b1-9665-703393494a9a","email":"client@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-27 12:32:55.276389+00','2026-04-27 12:32:55.276443+00','2026-04-27 12:32:55.276443+00','da979700-adb1-4222-96a5-4eae4ca59de5') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('2f035835-66fe-4d11-bde4-fc37fa310083','2f035835-66fe-4d11-bde4-fc37fa310083','{"sub":"2f035835-66fe-4d11-bde4-fc37fa310083","email":"testprof@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-05 08:07:58.300144+00','2026-04-05 08:07:58.30019+00','2026-04-05 08:07:58.30019+00','5d1c11df-cc83-4a21-a4e6-5d5db13194c6') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('46342bdb-4654-4813-9e9f-094e72364c4a','46342bdb-4654-4813-9e9f-094e72364c4a','{"sub":"46342bdb-4654-4813-9e9f-094e72364c4a","email":"korylinemedia@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-23 05:28:04.223335+00','2026-04-23 05:28:04.223387+00','2026-04-23 05:28:04.223387+00','725c88b9-f014-4653-8bd8-aed5999ec2f2') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('509075b7-08f4-4602-8149-e9ae22c92f1c','509075b7-08f4-4602-8149-e9ae22c92f1c','{"sub":"509075b7-08f4-4602-8149-e9ae22c92f1c","email":"adesinayomide2@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-30 19:19:33.948032+00','2026-04-30 19:19:33.948079+00','2026-04-30 19:19:33.948079+00','ab1c8606-10a0-462c-83b2-267ae382398d') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('554a0a6d-0858-4e90-adce-f58e9e699b35','554a0a6d-0858-4e90-adce-f58e9e699b35','{"sub":"554a0a6d-0858-4e90-adce-f58e9e699b35","email":"benardmahendeka1@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-10 18:22:43.514595+00','2026-04-10 18:22:43.514643+00','2026-04-10 18:22:43.514643+00','74caa0fe-279a-459f-b4d8-ab567ffa3ec6') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('5a259c50-f3bb-41b7-8e39-da318f3bcf44','5a259c50-f3bb-41b7-8e39-da318f3bcf44','{"sub":"5a259c50-f3bb-41b7-8e39-da318f3bcf44","email":"korytech@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-06 10:36:36.942414+00','2026-04-06 10:36:36.942472+00','2026-04-06 10:36:36.942472+00','89569217-333c-4170-8585-606f78365860') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('6b07047a-60a1-420f-a727-b6aebf55d589','6b07047a-60a1-420f-a727-b6aebf55d589','{"sub":"6b07047a-60a1-420f-a727-b6aebf55d589","email":"fywo@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-05-11 14:32:51.03269+00','2026-05-11 14:32:51.032739+00','2026-05-11 14:32:51.032739+00','93a06755-89f5-475f-b4af-859d127ac66a') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('77b9097e-5ffc-413c-ac6d-5b71e45a02f1','77b9097e-5ffc-413c-ac6d-5b71e45a02f1','{"sub":"77b9097e-5ffc-413c-ac6d-5b71e45a02f1","email":"tokobagoky@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-05-25 19:14:57.199719+00','2026-05-25 19:14:57.199764+00','2026-05-25 19:14:57.199764+00','659ba928-82d4-471e-917e-23de0e9903a8') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('7c82c756-1e81-4409-b750-33a8415c486f','7c82c756-1e81-4409-b750-33a8415c486f','{"sub":"7c82c756-1e81-4409-b750-33a8415c486f","email":"dominionjatuwashe@gmail.com","email_verified":false,"phone_verified":false}','email','2026-05-11 14:34:39.230236+00','2026-05-11 14:34:39.230295+00','2026-05-11 14:34:39.230295+00','04cd4935-0e4e-416d-9ce8-baf60b662ba4') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('7dc8c7cb-baf9-4e3d-ab26-2b24a287ee48','7dc8c7cb-baf9-4e3d-ab26-2b24a287ee48','{"sub":"7dc8c7cb-baf9-4e3d-ab26-2b24a287ee48","email":"tevytex@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-28 18:06:40.677395+00','2026-04-28 18:06:40.677445+00','2026-04-28 18:06:40.677445+00','44da16f6-6ba8-4297-b021-3a704828de2c') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('881b2fa7-08bf-4538-ade3-7dbe83a96721','881b2fa7-08bf-4538-ade3-7dbe83a96721','{"sub":"881b2fa7-08bf-4538-ade3-7dbe83a96721","email":"mire@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-27 06:06:13.250347+00','2026-04-27 06:06:13.2504+00','2026-04-27 06:06:13.2504+00','ebe66ed2-3b6e-4ee7-9c1b-e7407dc34f1c') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('9ac4f123-ed05-4274-8f9c-431cf93d35a3','9ac4f123-ed05-4274-8f9c-431cf93d35a3','{"sub":"9ac4f123-ed05-4274-8f9c-431cf93d35a3","email":"benardmahendeka13@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-10 18:03:43.705151+00','2026-04-10 18:03:43.7052+00','2026-04-10 18:03:43.7052+00','d44386d9-dc2a-4795-bdf6-12d1a0314d2e') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('9efab5df-002b-4bbe-90cf-8330e4c55fcc','9efab5df-002b-4bbe-90cf-8330e4c55fcc','{"sub":"9efab5df-002b-4bbe-90cf-8330e4c55fcc","email":"lizyrato@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-30 18:50:17.001127+00','2026-04-30 18:50:17.001204+00','2026-04-30 18:50:17.001204+00','a5db3957-7c0f-49cb-a375-32cef5d093c8') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('9ff627e5-dc90-4064-af68-4f8e1e62d039','9ff627e5-dc90-4064-af68-4f8e1e62d039','{"sub":"9ff627e5-dc90-4064-af68-4f8e1e62d039","email":"johndoe@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-06 10:35:13.03385+00','2026-04-06 10:35:13.033899+00','2026-04-06 10:35:13.033899+00','183c70f0-b0c0-411d-af4f-386b6b88baf0') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('a23341aa-6afe-4899-a9e7-622729990be7','a23341aa-6afe-4899-a9e7-622729990be7','{"sub":"a23341aa-6afe-4899-a9e7-622729990be7","email":"goxyqoleto@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-25 16:22:23.170971+00','2026-04-25 16:22:23.171019+00','2026-04-25 16:22:23.171019+00','005c7b12-0509-4212-91c8-d10e7b6ffd2f') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('ab2c3938-403d-4dae-b92e-8fddc48e77db','ab2c3938-403d-4dae-b92e-8fddc48e77db','{"sub":"ab2c3938-403d-4dae-b92e-8fddc48e77db","email":"client1@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-06 11:03:01.778781+00','2026-04-06 11:03:01.778836+00','2026-04-06 11:03:01.778836+00','033d3645-9fde-492c-b25c-15318f8c0443') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('af1dc249-6778-4eca-b2cb-316ecfa3cb8d','af1dc249-6778-4eca-b2cb-316ecfa3cb8d','{"sub":"af1dc249-6778-4eca-b2cb-316ecfa3cb8d","email":"jogu@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-23 13:28:44.746294+00','2026-04-23 13:28:44.74635+00','2026-04-23 13:28:44.74635+00','b405ec7d-bb97-41dc-82fa-9fe86cb81f41') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('b42b53eb-0997-4a80-bfbc-9652412a5db0','b42b53eb-0997-4a80-bfbc-9652412a5db0','{"sub":"b42b53eb-0997-4a80-bfbc-9652412a5db0","email":"nyruhox@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-05-05 11:31:26.272514+00','2026-05-05 11:31:26.272561+00','2026-05-05 11:31:26.272561+00','505a3b91-0386-490a-9225-6d54e7d313b1') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('b855a12a-462e-4ee9-8a05-505d64ac74d0','b855a12a-462e-4ee9-8a05-505d64ac74d0','{"sub":"b855a12a-462e-4ee9-8a05-505d64ac74d0","email":"gigako@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-20 12:05:46.38896+00','2026-04-20 12:05:46.389007+00','2026-04-20 12:05:46.389007+00','b97b2f99-4a3d-4cff-aa79-3392cdd1d185') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('b96386ac-b63a-4217-b96c-cbccfb8fac75','b96386ac-b63a-4217-b96c-cbccfb8fac75','{"sub":"b96386ac-b63a-4217-b96c-cbccfb8fac75","email":"gahkusidavis@gmail.com","email_verified":false,"phone_verified":false}','email','2026-05-11 15:42:52.536399+00','2026-05-11 15:42:52.536455+00','2026-05-11 15:42:52.536455+00','99a650c3-5b1e-4748-b7d7-041ed28b13db') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('c9eee12f-b674-4ea3-922b-be75943f56de','c9eee12f-b674-4ea3-922b-be75943f56de','{"sub":"c9eee12f-b674-4ea3-922b-be75943f56de","email":"xudakazoj@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-30 18:55:01.976707+00','2026-04-30 18:55:01.976759+00','2026-04-30 18:55:01.976759+00','b545baf4-8e12-4c08-983c-1a45450b2163') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('cfcdd705-6330-4fb3-b8a1-e36660460b83','cfcdd705-6330-4fb3-b8a1-e36660460b83','{"sub":"cfcdd705-6330-4fb3-b8a1-e36660460b83","email":"hahup@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-30 18:53:48.832559+00','2026-04-30 18:53:48.832615+00','2026-04-30 18:53:48.832615+00','aa9dbe0a-d3af-447a-bca9-38f17b72495a') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('dc5b4c4a-e9c7-4a2b-8265-a788d1a5553d','dc5b4c4a-e9c7-4a2b-8265-a788d1a5553d','{"sub":"dc5b4c4a-e9c7-4a2b-8265-a788d1a5553d","email":"adekolakorede31@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-30 19:22:56.22145+00','2026-04-30 19:22:56.221506+00','2026-04-30 19:22:56.221506+00','991c2a07-1895-45c1-9c3a-82aee230d0ce') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('de45f6b0-3dbd-4acd-a580-2b99e2e5ad83','de45f6b0-3dbd-4acd-a580-2b99e2e5ad83','{"sub":"de45f6b0-3dbd-4acd-a580-2b99e2e5ad83","email":"korydes@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-20 12:01:52.182111+00','2026-04-20 12:01:52.18256+00','2026-04-20 12:01:52.18256+00','8af8b953-e195-4ba5-a5c0-35362380a855') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('e1f1fdbe-b415-45d0-b809-432126dd7320','e1f1fdbe-b415-45d0-b809-432126dd7320','{"sub":"e1f1fdbe-b415-45d0-b809-432126dd7320","email":"zyditubo@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-28 19:01:03.218451+00','2026-04-28 19:01:03.218502+00','2026-04-28 19:01:03.218502+00','c05b91b3-4368-48a4-96d9-3714cc3040c5') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('eacd3c94-beed-4929-bd63-90b3d5600cf4','eacd3c94-beed-4929-bd63-90b3d5600cf4','{"sub":"eacd3c94-beed-4929-bd63-90b3d5600cf4","email":"fywefaqiw@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-25 16:23:33.382218+00','2026-04-25 16:23:33.382267+00','2026-04-25 16:23:33.382267+00','c0151ce4-d489-43e9-98ac-453b6b6bedb1') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('ebcead3a-da1e-42c3-9dff-c5026cf67615','ebcead3a-da1e-42c3-9dff-c5026cf67615','{"sub":"ebcead3a-da1e-42c3-9dff-c5026cf67615","email":"hardex1339@gmail.com","email_verified":false,"phone_verified":false}','email','2026-04-23 13:35:36.156358+00','2026-04-23 13:35:36.156409+00','2026-04-23 13:35:36.156409+00','a8ec979c-5e08-4e72-b5f8-814e9071aa52') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('f11b7e6c-05e9-4ced-8ef8-ead7ccc0f1b2','f11b7e6c-05e9-4ced-8ef8-ead7ccc0f1b2','{"sub":"f11b7e6c-05e9-4ced-8ef8-ead7ccc0f1b2","email":"kifohonabo@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-27 14:31:55.648995+00','2026-04-27 14:31:55.649065+00','2026-04-27 14:31:55.649065+00','1746e543-8ece-4753-b546-927ea0223879') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('fbdc65d0-a131-48bf-846c-cb6694bdbebd','fbdc65d0-a131-48bf-846c-cb6694bdbebd','{"sub":"fbdc65d0-a131-48bf-846c-cb6694bdbebd","email":"kixomyra@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-23 10:51:24.490595+00','2026-04-23 10:51:24.49064+00','2026-04-23 10:51:24.49064+00','78389791-4835-4f8d-8147-1bc9b19c4465') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."identities" ("provider_id","user_id","identity_data","provider","last_sign_in_at","created_at","updated_at","id") VALUES ('fe052c3b-ed01-4ada-8033-2ef963e0cab4','fe052c3b-ed01-4ada-8033-2ef963e0cab4','{"sub":"fe052c3b-ed01-4ada-8033-2ef963e0cab4","email":"vysiwu@mailinator.com","email_verified":false,"phone_verified":false}','email','2026-04-28 05:42:39.701528+00','2026-04-28 05:42:39.701619+00','2026-04-28 05:42:39.701619+00','f78e9bc6-4c50-4712-89a7-4b27f2c627e5') ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('07bbd3bd-c2a3-4b0f-b64e-10c06479c123','2f035835-66fe-4d11-bde4-fc37fa310083','2026-06-16 05:23:16.980197+00','2026-06-16 05:23:16.980197+00',NULL,'aal1',NULL,NULL,'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36','105.119.11.244',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('0be70926-b9a5-4cd8-9f21-fb4af3772861','2f035835-66fe-4d11-bde4-fc37fa310083','2026-06-01 16:03:29.213061+00','2026-06-01 16:03:29.213061+00',NULL,'aal1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','105.119.36.207',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('2c8d6e6f-4519-4f17-8376-9f9c8754b82c','2f035835-66fe-4d11-bde4-fc37fa310083','2026-06-04 18:10:33.311234+00','2026-06-04 18:10:33.311234+00',NULL,'aal1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36','105.119.32.221',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('4670382d-fafe-4c9c-88dc-93af73348974','2f035835-66fe-4d11-bde4-fc37fa310083','2026-06-01 16:05:28.326711+00','2026-06-01 17:18:26.205008+00',NULL,'aal1',NULL,'2026-06-01 17:18:26.204915','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','105.119.31.210',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('6f6a455a-660d-4f1d-bb26-9a6d0d489434','b96386ac-b63a-4217-b96c-cbccfb8fac75','2026-05-11 15:42:52.575551+00','2026-05-11 15:42:52.575551+00',NULL,'aal1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','105.119.38.30',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('7a9ae4d5-adea-4092-8c75-67aad140ae4c','15004154-26b1-43a9-85ed-59472bd83e64','2026-04-12 09:34:45.427757+00','2026-04-14 18:50:47.180093+00',NULL,'aal1',NULL,'2026-04-14 18:50:47.179978','node','3.8.191.169',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('8b71d66b-26bd-4cf6-8834-e5274ca1c09f','08c19652-fb75-405b-958a-8f0f97f6526b','2026-04-11 14:01:27.410253+00','2026-04-11 20:11:54.441338+00',NULL,'aal1',NULL,'2026-04-11 20:11:54.441218','node','35.178.108.178',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('a41f3425-28d1-4313-942a-d00bd490eb36','a23341aa-6afe-4899-a9e7-622729990be7','2026-04-25 16:22:23.189471+00','2026-04-25 16:22:23.189471+00',NULL,'aal1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','105.113.22.128',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('ae6af6d8-035e-4f34-afa2-a25aa1f8c281','11815b5a-ea2b-46af-9752-71e29bff1ba4','2026-04-27 13:02:01.137837+00','2026-04-27 13:02:01.137837+00',NULL,'aal1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','105.119.31.93',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('b34c4f49-f7a9-472a-a24b-59d5957f91cf','19f60f54-6994-4839-ac92-1214a7cb9e54','2026-04-11 17:10:17.622091+00','2026-04-11 17:10:17.622091+00',NULL,'aal1',NULL,NULL,'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36','105.232.129.133',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('bce8664e-df1a-415b-b919-0b8b9830ae54','ebcead3a-da1e-42c3-9dff-c5026cf67615','2026-04-23 13:35:36.169181+00','2026-04-23 13:35:36.169181+00',NULL,'aal1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','105.119.2.149',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('c07d5b95-bdc9-4ca2-acd6-79319c60f93e','2f035835-66fe-4d11-bde4-fc37fa310083','2026-06-04 03:24:57.635877+00','2026-06-04 17:43:23.823958+00',NULL,'aal1',NULL,'2026-06-04 17:43:23.823847','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','105.119.32.221',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('d3fa3c9f-da78-427e-ad2a-cfe24f71842c','7c82c756-1e81-4409-b750-33a8415c486f','2026-05-11 14:34:39.239752+00','2026-05-11 14:34:39.239752+00',NULL,'aal1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','105.119.33.179',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('e1ac6b24-3587-4991-8e84-01b1e6eda31a','9ff627e5-dc90-4064-af68-4f8e1e62d039','2026-06-01 16:26:59.375461+00','2026-06-12 18:24:24.352645+00',NULL,'aal1',NULL,'2026-06-12 18:24:24.351963','Vercel Edge Functions','18.170.44.246',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;
--=STMT=
INSERT INTO auth."sessions" ("id","user_id","created_at","updated_at","factor_id","aal","not_after","refreshed_at","user_agent","ip","tag","oauth_client_id","refresh_token_hmac_key","refresh_token_counter","scopes") VALUES ('e786a47a-0768-4928-a3ad-2e1fb34352a3','19f60f54-6994-4839-ac92-1214a7cb9e54','2026-04-11 17:09:52.795478+00','2026-04-11 17:09:52.795478+00',NULL,'aal1',NULL,NULL,'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36','105.232.129.133',NULL,NULL,NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING;