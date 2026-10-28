ALTER TABLE "cloud_saves" ADD COLUMN IF NOT EXISTS "active_version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Existing saves count as played up to their current version, so no older device can replace them unasked.
UPDATE "cloud_saves" SET "active_version" = "version" WHERE "active_version" = 0;--> statement-breakpoint
-- Worlds saved before the leaderboard columns existed get their best league and trophies from the stored game.
DO $$
DECLARE
  r record;
  f jsonb;
  trophies integer;
  division integer;
BEGIN
  FOR r IN SELECT "code", "shared_features_json", "shared_seasons" FROM "coop_rooms" LOOP
    BEGIN
      f := r."shared_features_json"::jsonb;
      SELECT coalesce(sum(CASE WHEN value ~ '^[0-9]+$' THEN value::integer ELSE 0 END), 0) INTO trophies
        FROM jsonb_each_text(coalesce(f #> '{cup,trophies}', '{}'::jsonb));
      division := CASE WHEN (f #>> '{seasonMode,highestDivision}') ~ '^[0-9]+$' THEN (f #>> '{seasonMode,highestDivision}')::integer ELSE 1 END;
      UPDATE "coop_rooms" SET
        "shared_trophies" = trophies,
        "shared_best_league" = least(16 - greatest(1, least(15, r."shared_seasons" + 1)), 16 - greatest(1, least(15, division)))
        WHERE "code" = r."code";
    EXCEPTION WHEN others THEN
      -- A world with a broken stored game keeps its defaults until its next save.
      NULL;
    END;
  END LOOP;
END $$;
