ALTER TABLE `coop_rooms` ADD `player3_player_id` text;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `player3_name` text;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `player3_last_seen_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `player4_player_id` text;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `player4_name` text;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `player4_last_seen_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `player3_goals` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `player4_goals` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `player3_clicks` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `player4_clicks` integer DEFAULT 0 NOT NULL;