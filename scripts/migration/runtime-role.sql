-- Runtime role for the app on Neon: goal_clicker_app may read and write exactly the game and account tables,
-- through one policy per table, and nothing else (no DDL, no neon_auth schema, no other schemas). RLS stays on;
-- the app no longer needs neondb_owner, which bypasses RLS.
--
-- Run as neondb_owner on the branch (staging first), with a direct connection, for example:
--   psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migration/runtime-role.sql
-- Then set its password OUTSIDE this file (Neon Console > Roles, or: \password goal_clicker_app in psql) and put
-- the pooled connection string of goal_clicker_app into DATABASE_URL of the matching Netlify context.
-- Idempotent. Migrations and the import scripts keep using neondb_owner (direct connection).

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'goal_clicker_app') then
    create role goal_clicker_app login nobypassrls noinherit;
  end if;
end $$;

grant usage on schema public to goal_clicker_app;
revoke create on schema public from goal_clicker_app;

do $$
declare
  t text;
begin
  foreach t in array array['coop_rooms', 'solo_travel', 'player_accounts', 'profiles', 'cloud_saves', 'auth_identities', 'legacy_identities', 'account_recovery', 'recovery_codes', 'rate_limits'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to goal_clicker_app', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'goal_clicker_app_all') then
      execute format('create policy goal_clicker_app_all on public.%I for all to goal_clicker_app using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- legacy_identities is written only by the import script (owner); the app reads it and deletes rows of deleted accounts.
revoke insert, update on public.legacy_identities from goal_clicker_app;
