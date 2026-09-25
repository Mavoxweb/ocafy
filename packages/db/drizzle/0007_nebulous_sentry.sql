CREATE TABLE "member_absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"from_date" varchar(10) NOT NULL,
	"until_date" varchar(10) NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "member_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"mode" text DEFAULT 'home' NOT NULL,
	"leave_time" text,
	"back_time" text
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_prefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"morning" boolean DEFAULT true NOT NULL,
	"night" boolean DEFAULT true NOT NULL,
	"due" boolean DEFAULT true NOT NULL,
	"defrost" boolean DEFAULT true NOT NULL,
	"partner" boolean DEFAULT true NOT NULL,
	"shopping" boolean DEFAULT true NOT NULL,
	"quiet_start" text DEFAULT '22:00' NOT NULL,
	"quiet_end" text DEFAULT '07:00' NOT NULL,
	"remind_before_min" integer DEFAULT 15 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_prefs_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_success_at" timestamp,
	"fail_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_absences" ADD CONSTRAINT "member_absences_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_absences" ADD CONSTRAINT "member_absences_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_schedule" ADD CONSTRAINT "member_schedule_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_schedule" ADD CONSTRAINT "member_schedule_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_absences_member_idx" ON "member_absences" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_schedule_uq" ON "member_schedule" USING btree ("member_id","weekday");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_log_dedupe_uq" ON "notification_log" USING btree ("member_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notification_log_created_idx" ON "notification_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_uq" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_member_idx" ON "push_subscriptions" USING btree ("member_id");
--> statement-breakpoint
CREATE TRIGGER member_schedule_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "member_schedule" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();
--> statement-breakpoint
CREATE TRIGGER member_absences_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "member_absences" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();
--> statement-breakpoint
CREATE TRIGGER notification_prefs_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "notification_prefs" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();
--> statement-breakpoint
CREATE TRIGGER push_subscriptions_bump_rev AFTER INSERT OR DELETE ON "push_subscriptions" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();
