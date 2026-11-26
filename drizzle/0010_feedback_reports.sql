-- PREPARED, NOT APPLIED. Like 0008 and 0009 this file has no journal entry; the owner applies it by hand when the
-- feedback form goes live (psql -f, as the table owner), first on a copy of the live branch. Idempotent.
-- Until it exists, /api/feedback answers "not available yet" and the form stays hidden (GOAL_CLICKER_FEEDBACK=1 and
-- this table are both needed). The runtime role only inserts; reading the reports is for the owner.
-- Rollback: DROP TABLE feedback_reports;
CREATE TABLE IF NOT EXISTS "feedback_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "kind" text NOT NULL CHECK ("kind" IN ('bug', 'improvement', 'feature')),
  "title" text NOT NULL CHECK (char_length("title") BETWEEN 3 AND 120),
  "description" text NOT NULL CHECK (char_length("description") BETWEEN 10 AND 4000),
  "account_id" uuid,
  "player_id" text,
  "locale" text,
  "screenshot_type" text CHECK ("screenshot_type" IN ('image/png', 'image/jpeg', 'image/webp')),
  "screenshot_base64" text,
  -- Set once a notification mail went out; the mail service is not chosen yet (Nicolas, 25.11.2026).
  "notified_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_reports_created_at" ON "feedback_reports" ("created_at");--> statement-breakpoint
ALTER TABLE "feedback_reports" ENABLE ROW LEVEL SECURITY;
