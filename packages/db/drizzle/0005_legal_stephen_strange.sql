CREATE TABLE "task_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"task_key" text NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "household_members" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "kind" text DEFAULT 'account' NOT NULL;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "age_band" text;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_assignments_uq" ON "task_assignments" USING btree ("household_id","task_key");--> statement-breakpoint
CREATE TRIGGER task_assignments_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "task_assignments" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();
