ALTER TABLE "coop_rooms" ADD COLUMN IF NOT EXISTS "shared_best_league" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "coop_rooms" ADD COLUMN IF NOT EXISTS "shared_trophies" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coop_rooms_total_goals_idx" ON "coop_rooms" USING btree ("shared_total_goals" DESC NULLS LAST);