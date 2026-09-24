CREATE TABLE "onboarding_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"step" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"species" text NOT NULL,
	"size" text,
	"coat" text,
	"outdoor_access" boolean,
	"litter" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "mode" text DEFAULT 'couple' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "dwelling" text DEFAULT 'apartment' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "size" text DEFAULT 'm' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "intensity" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "cooks_at_home" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "uses_frozen" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "has_washer" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "has_plants" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "has_car" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "office_project" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "onboarded_at" timestamp;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "kind" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onboarding_events_user_idx" ON "onboarding_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "pets_household_idx" ON "pets" USING btree ("household_id");
--> statement-breakpoint
-- ===== Backfill (expand): casas existentes continuam funcionando com o código antigo e o novo =====
UPDATE "rooms" SET "kind" = CASE
  WHEN "slug" ~ '^quarto[0-9]*$' THEN 'quarto'
  ELSE "slug"
END WHERE "kind" = '';
--> statement-breakpoint
-- Cômodo "gatos" vira pets (um gato por unidade de cats_count). A linha antiga de "gatos"/"casa" fica (o app novo as ignora).
INSERT INTO "pets" ("household_id", "name", "species", "litter")
SELECT r."household_id", 'Gato ' || g.n, 'cat', 'litter'
FROM "rooms" r
JOIN "litter_settings" l ON l."household_id" = r."household_id"
CROSS JOIN LATERAL generate_series(1, GREATEST(l."cats_count", 1)) AS g(n)
WHERE r."slug" = 'gatos'
  AND NOT EXISTS (SELECT 1 FROM "pets" p WHERE p."household_id" = r."household_id");
--> statement-breakpoint
-- Projeto Escritório só aparece para quem já usava.
UPDATE "households" SET "office_project" = true
WHERE "id" IN (
  SELECT "household_id" FROM "office_projects"
  UNION SELECT "household_id" FROM "office_goals"
  UNION SELECT "household_id" FROM "office_steps"
);
--> statement-breakpoint
UPDATE "households" SET "onboarded_at" = "created_at" WHERE "onboarded_at" IS NULL;
--> statement-breakpoint
CREATE TRIGGER pets_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "pets" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();
