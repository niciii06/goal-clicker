CREATE TABLE "cloud_saves" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"save_json" text NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cloud_saves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"username_key" text NOT NULL,
	"display_name" text NOT NULL,
	"username_changed_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "profiles_username_key_unique" UNIQUE("username_key")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;