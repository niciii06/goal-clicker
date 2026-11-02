-- Neon Auth migration: login to game account mapping, imported Supabase logins, the temporary recovery bridge
-- and shared rate limits. Idempotent (IF NOT EXISTS), so it can also be applied by hand with psql on a database
-- whose drizzle journal was not copied. Touches no existing table.
CREATE TABLE IF NOT EXISTS "account_recovery" (
	"account_id" uuid NOT NULL,
	"issuer" text NOT NULL,
	"destination_email" text NOT NULL,
	"method" text,
	"claim_expires_at" text,
	"consumed_at" text,
	"subject" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "account_recovery_account_id_issuer_pk" PRIMARY KEY("account_id","issuer")
);
--> statement-breakpoint
ALTER TABLE "account_recovery" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_identities" (
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"account_id" uuid NOT NULL,
	"method" text NOT NULL,
	"login_email" text,
	"deleted_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "auth_identities_issuer_subject_pk" PRIMARY KEY("issuer","subject")
);
--> statement-breakpoint
ALTER TABLE "auth_identities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legacy_identities" (
	"provider" text NOT NULL,
	"provider_subject" text NOT NULL,
	"account_id" uuid NOT NULL,
	"imported_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "legacy_identities_provider_provider_subject_pk" PRIMARY KEY("provider","provider_subject")
);
--> statement-breakpoint
ALTER TABLE "legacy_identities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" bigint NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recovery_codes" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"issuer" text NOT NULL,
	"expires_at" text NOT NULL,
	"used_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recovery_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_recovery_destination_key" ON "account_recovery" USING btree ("destination_email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_identities_account_issuer_key" ON "auth_identities" USING btree ("account_id","issuer");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_identities_login_email_key" ON "auth_identities" USING btree ("login_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_identities_account_idx" ON "legacy_identities" USING btree ("account_id");