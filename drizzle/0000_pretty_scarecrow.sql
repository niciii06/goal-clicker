CREATE TABLE `coop_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host_player_id` text NOT NULL,
	`host_name` text NOT NULL,
	`guest_player_id` text,
	`guest_name` text,
	`shared_coins` real DEFAULT 0 NOT NULL,
	`host_goals` real DEFAULT 0 NOT NULL,
	`guest_goals` real DEFAULT 0 NOT NULL,
	`host_clicks` integer DEFAULT 0 NOT NULL,
	`guest_clicks` integer DEFAULT 0 NOT NULL,
	`shared_upgrade_level` integer DEFAULT 0 NOT NULL,
	`pending_player_id` text,
	`pending_upgrade_id` text,
	`pending_upgrade_name` text,
	`pending_cost` real,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leaderboard_entries` (
	`player_id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`total_goals` real DEFAULT 0 NOT NULL,
	`season_goals` real DEFAULT 0 NOT NULL,
	`minigame_wins` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
