-- Administrative import only. Never grant the normal runtime role access here.
CREATE SCHEMA IF NOT EXISTS migration_private;
REVOKE ALL ON SCHEMA migration_private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS migration_private.legacy_passwords (
  account_id uuid PRIMARY KEY,
  login_email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON migration_private.legacy_passwords FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'goal_clicker_password_verifier') THEN
    CREATE ROLE goal_clicker_password_verifier LOGIN NOBYPASSRLS NOINHERIT;
  END IF;
END $$;
GRANT USAGE ON SCHEMA migration_private TO goal_clicker_password_verifier;
GRANT SELECT, DELETE ON migration_private.legacy_passwords TO goal_clicker_password_verifier;
-- Set its password securely through provider administration, never in this file.
