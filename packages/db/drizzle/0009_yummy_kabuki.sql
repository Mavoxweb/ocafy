CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_email" text NOT NULL,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"household_id" text,
	"reason" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"household_id" uuid,
	"kind" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"note" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"due_at" timestamp NOT NULL,
	"handled_by" text,
	"completed_at" timestamp,
	"evidence" text
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "platform_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"totp_secret" text NOT NULL,
	"totp_enabled_at" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "platform_staff_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "support_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"author" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_notes" ADD CONSTRAINT "support_notes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_created_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_household_idx" ON "admin_audit_log" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "data_requests_status_idx" ON "data_requests" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "data_requests_user_idx" ON "data_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_notes_household_idx" ON "support_notes" USING btree ("household_id");
--> statement-breakpoint
-- O registro de auditoria é imutável: nenhuma alteração, exclusão ou truncamento (nem pelo app).
CREATE OR REPLACE FUNCTION forbid_audit_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log é imutável';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER admin_audit_log_immutable BEFORE UPDATE OR DELETE ON "admin_audit_log" FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();
--> statement-breakpoint
CREATE TRIGGER admin_audit_log_no_truncate BEFORE TRUNCATE ON "admin_audit_log" FOR EACH STATEMENT EXECUTE FUNCTION forbid_audit_change();
--> statement-breakpoint
INSERT INTO "feature_flags" ("key", "enabled", "description") VALUES
  ('maintenance', false, 'Modo manutenção: o app só permite leitura'),
  ('signups_open', true, 'Novas casas podem ser criadas'),
  ('push_enabled', true, 'Envio de avisos push')
ON CONFLICT ("key") DO NOTHING;
