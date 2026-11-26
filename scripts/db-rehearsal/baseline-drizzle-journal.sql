-- PROPOSAL, NOT APPLIED ANYWHERE LIVE. Rehearsed only on disposable local databases (tests/db-rehearsal.test.ts).
--
-- Baseline for a database whose schema was created by hand (Neon branches: psql -f, no Drizzle journal). It records
-- the journal entries 0000 to 0007 as applied, with the same hash and created_at that `drizzle-kit migrate` would
-- write, so that a later `drizzle-kit migrate` only runs migrations after 0007 instead of failing on 0000.
-- 0008 and 0009 stay outside the journal (administrative, applied by hand); see docs/db-rehearsal.md.
--
-- It refuses to run unless every object of 0000 to 0007 that later migrations depend on exists, and it never
-- touches a game table. Idempotent: rows that are already there are not added again.
-- Hashes: sha256 of each drizzle/<tag>.sql exactly as in the repository (drizzle-orm/migrator.js).
-- Rollback: DROP TABLE drizzle.__drizzle_migrations; (only if it did not exist before; the schema stays as it is).
\set ON_ERROR_STOP on
begin;

do $$
declare
  missing text[] := array[]::text[];
  t text;
begin
  foreach t in array array['public.coop_rooms', 'public.solo_travel', 'public.player_accounts', 'public.profiles', 'public.cloud_saves',
                           'public.auth_identities', 'public.legacy_identities', 'public.account_recovery', 'public.recovery_codes', 'public.rate_limits'] loop
    if to_regclass(t) is null then missing := missing || t; end if;
  end loop;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'login_email') then missing := missing || 'profiles.login_email (0003)'::text; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cloud_saves' and column_name = 'active_version') then missing := missing || 'cloud_saves.active_version (0005)'::text; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'coop_rooms' and column_name = 'click_state_json') then missing := missing || 'coop_rooms.click_state_json (0006)'::text; end if;
  if cardinality(missing) > 0 then
    raise exception 'Baseline refused, schema of 0000 to 0007 incomplete: %', array_to_string(missing, ', ');
  end if;
end $$;

create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);

insert into drizzle.__drizzle_migrations (hash, created_at)
select v.hash, v.created_at
from (values
  (0, '0000_supabase_initial', 'fa58de87ba940316c3d9d77682b196ad3e11cce7dcb78f701f4460934dff03d6', 1792585839539::bigint),
  (1, '0001_player_accounts', 'd49e49af6af60794f23ba711f6568f7d491a0f29ebdc7962bf84b51e73822a71', 1792586283092),
  (2, '0002_profiles_cloud_saves', '3b46c8486003820e102e213b872c66f1f64dc467db097037bebcd9222e9337ab', 1792660366874),
  (3, '0003_profile_login_email', 'be1effbf941252d145e501f51f37ff59777b865b9995959e711e7ad3ef49688e', 1792662183749),
  (4, '0004_coop_leaderboard', 'ee70952454fe391e4387dee915ff7a95f84821d30bd03809b32b4c68aa865bd7', 1793095417937),
  (5, '0005_active_version_and_leaderboard_backfill', '4a3955f47340d5525e3dbf941ba075bfb65675918d183d7a18d3d1f1e44d957c', 1793197394630),
  (6, '0006_coop_click_state', 'b521f7139e80386e1b188df8146ae987b164fc5bbe7d89b744ba689373c97391', 1793198373212),
  (7, '0007_neon_auth_identities', 'a97e46b4d6f228f9dc76b2492fae582bb19e00446a6bcfe08bc869ed54621c7a', 1793610389043)
) as v(idx, tag, hash, created_at)
where not exists (select 1 from drizzle.__drizzle_migrations m where m.hash = v.hash)
order by v.idx;

commit;
