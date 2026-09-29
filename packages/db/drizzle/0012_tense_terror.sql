CREATE TABLE "marketing_campaign_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"household_id" uuid,
	"member_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"cta_label" text,
	"cta_url" text,
	"kind" text DEFAULT 'banner' NOT NULL,
	"audience" text DEFAULT 'all' NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp,
	"dismissible" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_campaign_events" ADD CONSTRAINT "marketing_campaign_events_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaign_events" ADD CONSTRAINT "marketing_campaign_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaign_events" ADD CONSTRAINT "marketing_campaign_events_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketing_events_campaign_idx" ON "marketing_campaign_events" USING btree ("campaign_id","kind");--> statement-breakpoint
CREATE INDEX "marketing_events_member_idx" ON "marketing_campaign_events" USING btree ("member_id","campaign_id");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_active_idx" ON "marketing_campaigns" USING btree ("active","priority");