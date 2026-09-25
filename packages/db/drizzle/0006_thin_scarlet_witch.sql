CREATE TABLE "shopping_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" text,
	"category" text,
	"urgency" text DEFAULT 'soon' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"added_by" uuid,
	"bought_by" uuid,
	"bought_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"done_by" uuid,
	"items_count" integer DEFAULT 0 NOT NULL,
	"done_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "shop_cadence" text;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "shop_day" integer;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_added_by_household_members_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_bought_by_household_members_id_fk" FOREIGN KEY ("bought_by") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_trips" ADD CONSTRAINT "shopping_trips_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_trips" ADD CONSTRAINT "shopping_trips_done_by_household_members_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shopping_items_household_idx" ON "shopping_items" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "shopping_trips_household_idx" ON "shopping_trips" USING btree ("household_id","done_at");
--> statement-breakpoint
CREATE TRIGGER shopping_items_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "shopping_items" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();
--> statement-breakpoint
CREATE TRIGGER shopping_trips_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "shopping_trips" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();
