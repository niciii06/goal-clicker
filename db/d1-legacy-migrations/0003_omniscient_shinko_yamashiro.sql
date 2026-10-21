ALTER TABLE `coop_rooms` ADD `host_last_seen_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `coop_rooms` ADD `guest_last_seen_at` text DEFAULT '' NOT NULL;