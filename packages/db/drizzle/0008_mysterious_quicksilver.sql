CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"household_id" uuid,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"error" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"applied_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "entitlement_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"source" text NOT NULL,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"overrides" jsonb,
	"reason" text,
	"granted_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text NOT NULL,
	"plan" text DEFAULT 'plus' NOT NULL,
	"interval" text DEFAULT 'quarterly' NOT NULL,
	"status" text NOT NULL,
	"current_period_end" timestamp,
	"grace_until" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"payer_email" text,
	"dunning_step" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_events_uq" ON "billing_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "billing_events_received_idx" ON "billing_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "entitlement_grants_household_idx" ON "entitlement_grants" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_provider_ref_uq" ON "subscriptions" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "subscriptions_household_idx" ON "subscriptions" USING btree ("household_id");
--> statement-breakpoint
-- Casas criadas antes dos planos ficam com cortesia sem prazo (não perdem nada); o admin pode revogar.
INSERT INTO "entitlement_grants" ("household_id", "plan", "source", "reason", "granted_by")
SELECT h."id", 'plus', 'founder', 'Casa criada antes da introdução dos planos', 'system'
FROM "households" h
WHERE NOT EXISTS (SELECT 1 FROM "entitlement_grants" g WHERE g."household_id" = h."id");
--> statement-breakpoint
CREATE TRIGGER entitlement_grants_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "entitlement_grants" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();
--> statement-breakpoint
CREATE TRIGGER subscriptions_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "subscriptions" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();
