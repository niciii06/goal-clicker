CREATE TABLE "coop_rooms" (
	"code" text PRIMARY KEY NOT NULL,
	"room_name" text DEFAULT 'Meine Welt' NOT NULL,
	"host_player_id" text NOT NULL,
	"host_name" text NOT NULL,
	"host_last_seen_at" text DEFAULT '' NOT NULL,
	"guest_player_id" text,
	"guest_name" text,
	"guest_last_seen_at" text DEFAULT '' NOT NULL,
	"player3_player_id" text,
	"player3_name" text,
	"player3_last_seen_at" text DEFAULT '' NOT NULL,
	"player4_player_id" text,
	"player4_name" text,
	"player4_last_seen_at" text DEFAULT '' NOT NULL,
	"shared_coins" double precision DEFAULT 0 NOT NULL,
	"host_goals" double precision DEFAULT 0 NOT NULL,
	"guest_goals" double precision DEFAULT 0 NOT NULL,
	"player3_goals" double precision DEFAULT 0 NOT NULL,
	"player4_goals" double precision DEFAULT 0 NOT NULL,
	"host_clicks" bigint DEFAULT 0 NOT NULL,
	"guest_clicks" bigint DEFAULT 0 NOT NULL,
	"player3_clicks" bigint DEFAULT 0 NOT NULL,
	"player4_clicks" bigint DEFAULT 0 NOT NULL,
	"shared_upgrade_level" integer DEFAULT 0 NOT NULL,
	"shared_total_goals" double precision DEFAULT 0 NOT NULL,
	"shared_season_goals" double precision DEFAULT 0 NOT NULL,
	"shared_upgrades_json" text DEFAULT '{}' NOT NULL,
	"shared_achievements_json" text DEFAULT '[]' NOT NULL,
	"shared_stars" integer DEFAULT 0 NOT NULL,
	"shared_seasons" integer DEFAULT 0 NOT NULL,
	"shared_minigame_wins" integer DEFAULT 0 NOT NULL,
	"shared_minigame_cooldowns_json" text DEFAULT '{}' NOT NULL,
	"shared_features_json" text DEFAULT '{}' NOT NULL,
	"shared_state_backup_json" text DEFAULT '{}' NOT NULL,
	"shared_state_version" bigint DEFAULT 0 NOT NULL,
	"redeemed_bonus_codes_json" text DEFAULT '[]' NOT NULL,
	"last_passive_at" text DEFAULT '' NOT NULL,
	"pending_player_id" text,
	"pending_upgrade_id" text,
	"pending_upgrade_name" text,
	"pending_cost" double precision,
	"pending_upgrade_count" integer,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coop_rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "solo_travel" (
	"owner" text NOT NULL,
	"fixture_id" text NOT NULL,
	"journey_json" jsonb NOT NULL,
	CONSTRAINT "solo_travel_owner_fixture_id_pk" PRIMARY KEY("owner","fixture_id")
);
--> statement-breakpoint
ALTER TABLE "solo_travel" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "coop_rooms_host_player_idx" ON "coop_rooms" USING btree ("host_player_id");--> statement-breakpoint
CREATE INDEX "coop_rooms_guest_player_idx" ON "coop_rooms" USING btree ("guest_player_id");--> statement-breakpoint
CREATE INDEX "coop_rooms_player3_player_idx" ON "coop_rooms" USING btree ("player3_player_id");--> statement-breakpoint
CREATE INDEX "coop_rooms_player4_player_idx" ON "coop_rooms" USING btree ("player4_player_id");