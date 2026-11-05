-- PREPARED, NOT APPLIED. Like 0008 this file has no journal entry; the owner applies it by hand when ready
-- (psql -f, as the table owner). The server works the same before and after it:
--   * coop_rooms.features_key: md5 of shared_features_json, kept current by a trigger whenever the features are
--     inserted or changed, by every writer. Polls read it instead of hashing several hundred KB each time
--     (db/index.ts falls back to md5() while the column is missing or still null).
--   * solo_travel.created_at: when a journey or reward receipt was created, for later cleanup. Rows from before
--     this migration stay null (age unknown); new rows get the time from the column default.
-- Rollback: DROP TRIGGER coop_rooms_features_key ON coop_rooms; DROP FUNCTION coop_rooms_set_features_key();
--           ALTER TABLE coop_rooms DROP COLUMN features_key; ALTER TABLE solo_travel DROP COLUMN created_at;
ALTER TABLE "coop_rooms" ADD COLUMN IF NOT EXISTS "features_key" text;--> statement-breakpoint
CREATE OR REPLACE FUNCTION coop_rooms_set_features_key() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW."shared_features_json" IS DISTINCT FROM OLD."shared_features_json" OR NEW."features_key" IS NULL THEN
    NEW."features_key" := md5(NEW."shared_features_json");
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS coop_rooms_features_key ON "coop_rooms";--> statement-breakpoint
CREATE TRIGGER coop_rooms_features_key BEFORE INSERT OR UPDATE ON "coop_rooms"
  FOR EACH ROW EXECUTE FUNCTION coop_rooms_set_features_key();--> statement-breakpoint
-- Existing worlds: the same md5 the server computed so far.
UPDATE "coop_rooms" SET "features_key" = md5("shared_features_json") WHERE "features_key" IS NULL;--> statement-breakpoint
ALTER TABLE "solo_travel" ADD COLUMN IF NOT EXISTS "created_at" text;--> statement-breakpoint
ALTER TABLE "solo_travel" ALTER COLUMN "created_at" SET DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
