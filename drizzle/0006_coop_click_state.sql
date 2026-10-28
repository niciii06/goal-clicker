ALTER TABLE "coop_rooms" ADD COLUMN IF NOT EXISTS "click_state_json" text DEFAULT '{}' NOT NULL;
