CREATE TABLE "player_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"email" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "player_accounts_player_id_unique" UNIQUE("player_id")
);
--> statement-breakpoint
ALTER TABLE "player_accounts" ENABLE ROW LEVEL SECURITY;