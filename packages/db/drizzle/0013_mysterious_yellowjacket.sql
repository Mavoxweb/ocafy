DROP INDEX "marketing_events_member_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_events_unique" ON "marketing_campaign_events" USING btree ("campaign_id","member_id","kind");