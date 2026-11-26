// Restore, migration and multi-device rehearsal on a DISPOSABLE local PostgreSQL server (docs/db-rehearsal.md).
// Synthetic fixtures only. This is a local simulation: it proves what pg_dump/pg_restore and the code do with a
// restored database, not that a Neon PITR restore works (that needs a Neon branch, done by the owner).
//
//   TEST_DATABASE_URL=postgres://tester@127.0.0.1:55432/postgres node --import tsx --test tests/db-rehearsal.test.ts
//
// The URL must point to localhost and to a role that may CREATE DATABASE. Every database this test creates is
// named gc_rehearsal_* and dropped at the end; the database in the URL itself is only used to create them.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const rawUrl = process.env.TEST_DATABASE_URL;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
function localOnly(url: string | undefined) {
  if (!url) return 'TEST_DATABASE_URL is not set';
  try { return LOCAL_HOSTS.has(new URL(url).hostname) ? false : 'refused: TEST_DATABASE_URL is not a local server'; } catch { return 'TEST_DATABASE_URL is not a URL'; }
}
const skip = localOnly(rawUrl);

// The client sync code reads localStorage and window at import; give it the same minimal browser as tests/cloud-sync.
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear() },
  window: Object.assign(new EventTarget(), { setInterval: () => 1, clearInterval: () => {}, setTimeout, clearTimeout }),
  document: { addEventListener: () => {}, removeEventListener: () => {}, visibilityState: 'visible' },
});
const { planInitialSync } = await import('../app/cloud-sync.ts');
const { STORAGE_KEY } = await import('../app/game/constants.ts');
const { GoalClickerDatabase } = await import('../db/index.ts');
const schema = await import('../db/schema.ts');

const RUN = `gc_rehearsal_${process.pid}_${Date.now().toString(36)}`;
const TABLES: Record<string, string> = {
  coop_rooms: 'code', solo_travel: 'owner, fixture_id', player_accounts: 'user_id', profiles: 'user_id', cloud_saves: 'user_id',
  auth_identities: 'issuer, subject', legacy_identities: 'provider, provider_subject', account_recovery: 'account_id, issuer',
  recovery_codes: 'code_hash', rate_limits: 'key',
};
const created: string[] = [];
const pools: postgres.Sql[] = [];
let admin: postgres.Sql;

function urlFor(name: string) { const u = new URL(rawUrl!); u.pathname = `/${name}`; return u.toString(); }
function sqlFor(name: string) { const s = postgres(urlFor(name), { max: 4, onnotice: () => {} }); pools.push(s); return s; }
function appDb(name: string) {
  const s = postgres(urlFor(name), { prepare: false, fetch_types: false, max: 4, onnotice: () => {} });
  pools.push(s);
  return new GoalClickerDatabase(() => drizzle(s, { schema }));
}
async function createDatabase(suffix: string) {
  const name = `${RUN}_${suffix}`;
  await admin.unsafe(`create database "${name}"`);
  created.push(name);
  return name;
}
function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  return { ok: result.status === 0, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}
/** psql -f, as an owner applies the prepared migrations 0008/0009 by hand (HOSTING.md). */
function psqlFile(name: string, file: string) {
  const result = run('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', urlFor(name), '-f', file]);
  assert.ok(result.ok, `${file}: ${result.out}`);
}
function psqlText(name: string, text: string) {
  const dir = mkdtempSync(join(tmpdir(), 'gc-rehearsal-'));
  try { writeFileSync(join(dir, 'step.sql'), text); psqlFile(name, join(dir, 'step.sql')); } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** Everything about the schema that a migration could change, as a sorted list (no data). */
async function fingerprint(sql: postgres.Sql) {
  const rows = await sql<{ x: string }[]>`
    select x from (
      select 'col ' || table_schema || '.' || table_name || '.' || column_name || ' ' || data_type || ' null=' || is_nullable || ' default=' || coalesce(column_default, '') as x
        from information_schema.columns where table_schema in ('public', 'migration_private')
      union all select 'idx ' || schemaname || '.' || indexname || ' ' || indexdef from pg_indexes where schemaname in ('public', 'migration_private')
      union all select 'con ' || c.conrelid::regclass::text || ' ' || c.conname || ' ' || pg_get_constraintdef(c.oid)
        from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname in ('public', 'migration_private')
      union all select 'trg ' || tgrelid::regclass::text || ' ' || tgname from pg_trigger where not tgisinternal
      union all select 'fn ' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
      union all select 'rls ' || c.relname || ' ' || c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
      union all select 'pol ' || tablename || ' ' || policyname from pg_policies where schemaname = 'public'
      union all select 'acl ' || table_schema || '.' || table_name || ' ' || grantee || ' ' || privilege_type
        from information_schema.role_table_grants where table_schema in ('public', 'migration_private') and grantee <> current_user
    ) s order by x`;
  return rows.map((r) => r.x);
}
/** Row count and md5 of every row per table (the method of scripts/migration/verify-accounts.mts). */
async function checksums(sql: postgres.Sql) {
  const out: Record<string, string> = {};
  for (const [table, order] of Object.entries(TABLES)) {
    const [row] = await sql.unsafe(`select count(*)::int as n, md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by ${order}), '')) as h from ${table} t`);
    out[table] = `${row.n}:${row.h}`;
  }
  return out;
}

// ---- Synthetic fixtures -------------------------------------------------------------------------------------
const iso = (minute: number) => new Date(Date.UTC(2026, 10, 12, 9, minute)).toISOString();
/** A save as the game writes it: team, bank, album, prestige and progress live inside the game JSON. */
function gameSave(goals: number, extra: Record<string, unknown> = {}) {
  const game = { goals, totalGoals: goals, clicks: goals, seasons: 1 + Math.floor(goals / 100), stars: 2, coins: goals * 3,
    squad: ['GK-1', 'DF-2', 'MF-3', 'FW-4'], bank: { balance: goals * 10, loans: [] }, album: { 'card-1': 2, 'card-7': 1 },
    prestige: { level: goals >= 300 ? 1 : 0, chosenCard: 'card-7' }, ...extra };
  return { [STORAGE_KEY]: JSON.stringify(game) };
}
const goalsOf = (saveJson: string | null | undefined) => saveJson ? (JSON.parse(JSON.parse(saveJson)[STORAGE_KEY]) as { totalGoals: number }).totalGoals : 0;

async function seed(db: InstanceType<typeof GoalClickerDatabase>, sql: postgres.Sql) {
  for (let i = 1; i <= 6; i++) {
    const user = `00000000-0000-4000-8000-00000000000${i}`;
    await db.linkAccount(user, `player-${i}`, null);
    await db.createProfile(user, `fixture${i}`, `Fixture ${i}`, iso(i));
    await db.putCloudSave(user, JSON.stringify(gameSave(50 * i, { emoji: '⚽ Ümläüt' })), 0, iso(i));
    await db.bindIdentity({ issuer: 'https://auth.example.test', subject: `sub-${i}`, accountId: user, method: 'email', loginEmail: `fixture${i}@example.test`, createdAt: iso(i) });
    await db.putSoloJourney(`player-${i}`, `fixture-${i}`, { stadium: 'Bern', leg: i });
  }
  for (const code of ['RHA1', 'RHB2', 'RHC3']) {
    await db.insertRoom({ code, hostPlayerId: 'player-1', hostName: 'Fixture 1', guestPlayerId: 'player-2', guestName: 'Fixture 2', hostLastSeenAt: iso(1), lastPassiveAt: iso(1), updatedAt: iso(2),
      sharedCoins: 1.5e15, hostGoals: 1234, sharedStateVersion: 7, sharedFeaturesJson: JSON.stringify({ album: { 'card-1': 3 }, bank: 99, code }) });
  }
  await sql`insert into rate_limits (key, window_start, hits) values ('fixture', 1, 3)`;
}

before(async () => {
  if (skip) return;
  admin = postgres(rawUrl!, { max: 1, onnotice: () => {} });
});

after(async () => {
  for (const pool of pools) await pool.end({ timeout: 5 }).catch(() => {});
  for (const name of created.reverse()) await admin?.unsafe(`drop database if exists "${name}" with (force)`).catch(() => {});
  await admin?.end({ timeout: 5 });
});

// ---- Migration timeline -------------------------------------------------------------------------------------

test('a fresh database: the journal applies 0000 to 0007, then 0008 and 0009 by hand, twice without change', { skip }, async () => {
  const name = await createDatabase('fresh');
  const sql = sqlFor(name);
  await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as { entries: { tag: string }[] };
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from drizzle.__drizzle_migrations`;
  assert.equal(n, journal.entries.length, 'every journal entry is recorded once');
  assert.equal(journal.entries.at(-1)!.tag, '0007_neon_auth_identities', 'the journal still ends at 0007 (0008/0009 are applied by hand)');

  await seed(appDb(name), sql);
  const data = await checksums(sql);
  const journalOnly = await fingerprint(sql);

  psqlFile(name, 'drizzle/0008_offline_legacy_passwords.sql');
  const with0008 = await fingerprint(sql);
  psqlFile(name, 'drizzle/0008_offline_legacy_passwords.sql');
  assert.deepEqual(await fingerprint(sql), with0008, '0008 is idempotent');
  assert.ok(with0008.some((x) => x.startsWith('col migration_private.legacy_passwords.password_hash')));
  // The runtime role must not see the private schema (0008 revokes PUBLIC; grants only the verifier).
  assert.ok(!with0008.some((x) => x.startsWith('acl migration_private.') && !x.includes('goal_clicker_password_verifier')));

  psqlFile(name, 'drizzle/0009_coop_features_key_solo_travel_created_at.sql');
  const with0009 = await fingerprint(sql);
  psqlFile(name, 'drizzle/0009_coop_features_key_solo_travel_created_at.sql');
  assert.deepEqual(await fingerprint(sql), with0009, '0009 is idempotent');
  const keys = await sql`select count(*)::int as n from coop_rooms where features_key is distinct from md5(shared_features_json)`;
  assert.equal(keys[0].n, 0, 'every existing world got its features key');

  // No game data changed: the checksums of all rows without the two new columns are the same.
  const withoutNewColumns = await checksumsWithout(sql, { coop_rooms: ['features_key'], solo_travel: ['created_at'] });
  assert.deepEqual(withoutNewColumns, data, 'applying 0008 and 0009 keeps every row');

  // The documented rollback of 0009 restores the schema of before, and applying it again the schema of after.
  psqlText(name, 'DROP TRIGGER coop_rooms_features_key ON coop_rooms; DROP FUNCTION coop_rooms_set_features_key(); ALTER TABLE coop_rooms DROP COLUMN features_key; ALTER TABLE solo_travel DROP COLUMN created_at;');
  assert.deepEqual(await fingerprint(sql), with0008, 'rollback of 0009 is exact');
  assert.deepEqual(await checksums(sql), data, 'rollback of 0009 keeps every row');
  psqlFile(name, 'drizzle/0009_coop_features_key_solo_travel_created_at.sql');
  assert.deepEqual(await fingerprint(sql), with0009);
  assert.notDeepEqual(journalOnly, with0009);
});

async function checksumsWithout(sql: postgres.Sql, drop: Record<string, string[]>) {
  const out: Record<string, string> = {};
  for (const [table, order] of Object.entries(TABLES)) {
    const minus = (drop[table] ?? []).map((c) => ` - '${c}'`).join('');
    const [row] = await sql.unsafe(`select count(*)::int as n, md5(coalesce(string_agg((to_jsonb(t)${minus})::text, '|' order by ${order}), '')) as h from ${table} t`);
    out[table] = `${row.n}:${row.h}`;
  }
  return out;
}

test('the app works the same with and without 0009 on the same data', { skip }, async () => {
  const name = await createDatabase('app0009');
  const sql = sqlFor(name);
  await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
  const db = appDb(name);
  await seed(db, sql);
  const before = await db.getLightRoom('RHA1');
  psqlFile(name, 'drizzle/0009_coop_features_key_solo_travel_created_at.sql');
  const db2 = appDb(name);
  const afterApply = await db2.getLightRoom('RHA1');
  assert.equal(afterApply!.featuresKey, before!.featuresKey, 'stored key equals the md5 the server computed before');
  await db2.updateRoom('RHA1', { sharedFeaturesJson: JSON.stringify({ changed: true }) });
  const [{ k }] = await sql`select features_key = md5(shared_features_json) as k from coop_rooms where code = 'RHA1'`;
  assert.equal(k, true, 'the trigger keeps the key current');
  await db2.putSoloJourney('player-9', 'fixture-9', { leg: 1 });
  const [{ c }] = await sql`select created_at as c from solo_travel where owner = 'player-9'`;
  assert.match(c, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/, 'new journeys get created_at from the default');
});

test('a Neon like branch without journal: db:migrate fails on 0000 and changes nothing', { skip }, async () => {
  const name = await createDatabase('nojournal');
  const sql = sqlFor(name);
  // As on Neon: the schema exists, created by hand from the SQL files, but drizzle.__drizzle_migrations does not.
  for (const file of ['0000_supabase_initial', '0001_player_accounts', '0002_profiles_cloud_saves', '0003_profile_login_email', '0004_coop_leaderboard',
    '0005_active_version_and_leaderboard_backfill', '0006_coop_click_state', '0007_neon_auth_identities', '0008_offline_legacy_passwords', '0009_coop_features_key_solo_travel_created_at']) {
    psqlFile(name, `drizzle/${file}.sql`);
  }
  await seed(appDb(name), sql);
  const schemaBefore = await fingerprint(sql);
  const dataBefore = await checksums(sql);
  // 42P07: relation already exists. drizzle runs all pending migrations in one transaction.
  await assert.rejects(migrate(drizzle(sql), { migrationsFolder: 'drizzle' }), (error: Error & { cause?: { code?: string } }) =>
    /Failed query: CREATE TABLE "coop_rooms"/.test(error.message) && error.cause?.code === '42P07');
  assert.deepEqual(await fingerprint(sql), schemaBefore, 'the failed migrate rolled back completely');
  assert.deepEqual(await checksums(sql), dataBefore, 'no row changed');
});

test('baseline: recording 0000 to 0007 as applied makes db:migrate a no-op, and a later migration applies once', { skip }, async () => {
  const name = await createDatabase('baseline');
  const sql = sqlFor(name);
  for (const file of ['0000_supabase_initial', '0001_player_accounts', '0002_profiles_cloud_saves', '0003_profile_login_email', '0004_coop_leaderboard',
    '0005_active_version_and_leaderboard_backfill', '0006_coop_click_state', '0007_neon_auth_identities', '0009_coop_features_key_solo_travel_created_at']) {
    psqlFile(name, `drizzle/${file}.sql`);
  }
  await seed(appDb(name), sql);
  psqlFile(name, 'scripts/db-rehearsal/baseline-drizzle-journal.sql');
  psqlFile(name, 'scripts/db-rehearsal/baseline-drizzle-journal.sql');
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from drizzle.__drizzle_migrations`;
  assert.equal(n, 8, 'the baseline is idempotent');

  const schemaBefore = await fingerprint(sql);
  const dataBefore = await checksums(sql);
  await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
  assert.deepEqual(await fingerprint(sql), schemaBefore, 'nothing from 0000 to 0007 ran again');
  assert.deepEqual(await checksums(sql), dataBefore);

  // A future migration 0010 in a copy of the folder: applied exactly once, then never again.
  const dir = mkdtempSync(join(tmpdir(), 'gc-rehearsal-mig-'));
  try {
    cpSync('drizzle', dir, { recursive: true });
    const journal = JSON.parse(readFileSync(join(dir, 'meta/_journal.json'), 'utf8')) as { entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[] };
    journal.entries.push({ idx: 8, version: '7', when: journal.entries.at(-1)!.when + 1000, tag: '0010_rehearsal_probe', breakpoints: true });
    writeFileSync(join(dir, 'meta/_journal.json'), JSON.stringify(journal));
    writeFileSync(join(dir, '0010_rehearsal_probe.sql'), 'ALTER TABLE "profiles" ADD COLUMN "rehearsal_probe" text;');
    await migrate(drizzle(sql), { migrationsFolder: dir });
    await migrate(drizzle(sql), { migrationsFolder: dir });
    const cols = await sql`select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'rehearsal_probe'`;
    assert.equal(cols.length, 1);
    assert.deepEqual(await checksumsWithout(sql, { profiles: ['rehearsal_probe'] }), dataBefore);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- Restore and devices ------------------------------------------------------------------------------------

test('backup and restore keep every row, the schema, RLS, policies and grants', { skip }, async () => {
  const name = await createDatabase('source');
  const sql = sqlFor(name);
  await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
  psqlFile(name, 'drizzle/0009_coop_features_key_solo_travel_created_at.sql');
  psqlFile(name, 'scripts/migration/runtime-role.sql');
  await seed(appDb(name), sql);
  const schemaBefore = await fingerprint(sql);
  const dataBefore = await checksums(sql);

  const dir = mkdtempSync(join(tmpdir(), 'gc-rehearsal-dump-'));
  try {
    const dump = join(dir, 'backup.dump');
    const dumped = run('pg_dump', ['-Fc', '-d', urlFor(name), '-f', dump]);
    assert.ok(dumped.ok, dumped.out);
    const target = await createDatabase('restored');
    const restored = run('pg_restore', ['--exit-on-error', '-d', urlFor(target), dump]);
    assert.ok(restored.ok, restored.out);
    const tsql = sqlFor(target);
    assert.deepEqual(await fingerprint(tsql), schemaBefore, 'schema, RLS, policies and grants are back');
    assert.deepEqual(await checksums(tsql), dataBefore, 'every row is back, byte for byte');
    const [{ saves }] = await tsql`select count(*)::int as saves from cloud_saves where save_json like '%Ümläüt%'`;
    assert.equal(saves, 6, 'UTF-8 inside saves survives');
    const rdb = appDb(target);
    assert.equal((await rdb.getRoom('RHA1'))!.sharedCoins, 1.5e15, 'large numbers survive');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('two devices after a restore to an older backup: the more advanced device keeps its progress', { skip }, async () => {
  const name = await createDatabase('devices');
  const sql = sqlFor(name);
  await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
  const server = appDb(name);
  const user = '00000000-0000-4000-8000-0000000000aa';
  await server.linkAccount(user, 'player-aa', null);
  await server.createProfile(user, 'twodevices', 'Zwei Geräte', iso(0));

  // Laptop (A) and phone (B) log in to the same account and play in turns.
  const a1 = await server.putCloudSave(user, JSON.stringify(gameSave(100)), 0, iso(1));
  assert.equal(a1.save!.version, 1);
  const bLoaded = await server.getCloudSaveSince(user, 0);
  const b2 = await server.putCloudSave(user, JSON.stringify(gameSave(200)), bLoaded!.version, iso(2));
  assert.equal(b2.save!.version, 2);

  // Backup at version 2.
  const dir = mkdtempSync(join(tmpdir(), 'gc-rehearsal-dev-'));
  try {
    const dump = join(dir, 'v2.dump');
    assert.ok(run('pg_dump', ['-Fc', '-d', urlFor(name), '-f', dump]).ok);

    // A loads version 2, plays on to 300 goals and stores version 3. B follows and loads version 3.
    const aLoaded = await server.getCloudSaveSince(user, 1);
    const a3 = await server.putCloudSave(user, JSON.stringify(gameSave(300)), aLoaded!.version, iso(3));
    assert.equal(a3.save!.version, 3);
    const bAt3 = await server.getCloudSaveSince(user, 2);
    assert.equal(goalsOf(bAt3!.saveJson), 300);
    const stale = await server.putCloudSave(user, JSON.stringify(gameSave(150)), 2, iso(3));
    assert.ok(stale.conflict, 'a device on an old version cannot overwrite');

    // Incident: the database is restored from the version 2 backup (new database, as a restored branch would be).
    const target = await createDatabase('devices_restored');
    assert.ok(run('pg_restore', ['--exit-on-error', '-d', urlFor(target), dump]).ok);
    const restoredServer = appDb(target);
    const cloud = (await restoredServer.getCloudSave(user))!;
    assert.equal(cloud.version, 2);
    assert.equal(goalsOf(cloud.saveJson), 200);
    const cloudState = { version: cloud.version, updatedAt: cloud.updatedAt, active: cloud.active, activeVersion: cloud.activeVersion, keys: JSON.parse(cloud.saveJson) };

    // Both devices remember version 3 and hold 300 goals; A played since. Neither is rolled back by the restore.
    const local300 = gameSave(300);
    assert.equal(planInitialSync({ userId: user, version: 3, hash: 'a', played: true }, cloudState, local300), 'keep-local');
    assert.equal(planInitialSync({ userId: user, version: 3, hash: 'b', played: false }, cloudState, local300), 'keep-local');
    // A third device last synced at version 1 and not played since takes the restored cloud save.
    assert.equal(planInitialSync({ userId: user, version: 1, hash: 'c', played: false }, cloudState, gameSave(100)), 'use-cloud');

    // Both devices write back on top of the restored version at the same time: exactly one wins.
    const race = await Promise.all([
      restoredServer.putCloudSave(user, JSON.stringify(local300), cloud.version, iso(5)),
      appDb(target).putCloudSave(user, JSON.stringify(local300), cloud.version, iso(5)),
    ]);
    assert.equal(race.filter((r) => r.save).length, 1, 'one overwrite wins');
    const loser = race.find((r) => r.conflict)!;
    assert.equal(goalsOf(loser.conflict!.saveJson), 300, 'the other device gets the same 300 goals back');
    const final = (await restoredServer.getCloudSave(user))!;
    assert.equal(final.version, 3);
    assert.equal(goalsOf(final.saveJson), 300, 'the progress after the backup is back in the cloud');
    // Now at version 3 with the same game, both devices just continue.
    const finalState = { version: final.version, updatedAt: final.updatedAt, active: final.active, activeVersion: final.activeVersion, keys: JSON.parse(final.saveJson) };
    assert.equal(planInitialSync({ userId: user, version: 3, hash: 'a', played: true }, finalState, local300), 'use-local');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
