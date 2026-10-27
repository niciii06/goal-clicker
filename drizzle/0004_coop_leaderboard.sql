ALTER TABLE "coop_rooms" ADD COLUMN "shared_best_league" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "coop_rooms" ADD COLUMN "shared_trophies" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "coop_rooms_total_goals_idx" ON "coop_rooms" USING btree ("shared_total_goals" DESC NULLS LAST);