ALTER TABLE `coop_rooms` ADD `shared_total_goals` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `shared_season_goals` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `shared_upgrades_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `shared_achievements_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `shared_stars` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `shared_seasons` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `shared_minigame_wins` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `shared_minigame_cooldowns_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `last_passive_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `pending_upgrade_count` integer;
