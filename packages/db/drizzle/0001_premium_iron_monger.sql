CREATE INDEX "reactions_household_idx" ON "completion_reactions" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "inventory_household_idx" ON "inventory_items" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "invites_household_idx" ON "invites" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "purchases_household_idx" ON "reward_purchases" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "rewards_household_idx" ON "store_rewards" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "trades_household_idx" ON "task_trades" USING btree ("household_id");