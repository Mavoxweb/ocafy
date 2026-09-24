ALTER TABLE "households" ADD COLUMN "rev" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE OR REPLACE FUNCTION bump_household_rev() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE households SET rev = rev + 1 WHERE id = OLD.household_id;
    RETURN OLD;
  END IF;
  UPDATE households SET rev = rev + 1 WHERE id = NEW.household_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER household_members_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "household_members" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER invites_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "invites" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER rooms_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "rooms" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER task_overrides_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "task_overrides" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER completions_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "completions" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER meals_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "meals" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER litter_settings_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "litter_settings" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER office_projects_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "office_projects" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER office_goals_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "office_goals" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER office_steps_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "office_steps" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER inventory_items_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "inventory_items" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER completion_reactions_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "completion_reactions" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER task_trades_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "task_trades" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER store_rewards_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "store_rewards" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();--> statement-breakpoint
CREATE TRIGGER reward_purchases_bump_rev AFTER INSERT OR UPDATE OR DELETE ON "reward_purchases" FOR EACH ROW EXECUTE FUNCTION bump_household_rev();
