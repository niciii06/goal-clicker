ALTER TABLE `coop_rooms` ADD `room_name` text DEFAULT 'Meine Welt' NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `shared_state_backup_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `shared_state_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `redeemed_bonus_codes_json` text DEFAULT '[]' NOT NULL;