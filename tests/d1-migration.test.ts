// Needs TEST_DATABASE_URL (an empty scratch PostgreSQL database), like tests/db-postgres.test.ts.
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { migrateD1ToPostgres } from '../scripts/migrate-d1-to-supabase.mjs';

const url = process.env.TEST_DATABASE_URL ?? '';
const skip = url ? false : 'TEST_DATABASE_URL is not set';
let admin: postgres.Sql;
let dir = '';
const quiet = () => {};

/** Builds a D1 database the way production got it: every legacy migration in order, then rows. */
async function legacyD1() {
  const db = new DatabaseSync(':memory:');
  const folder = 'db/d1-legacy-migrations';
  for (const file of (await readdir(folder)).filter((f) => f.endsWith('.sql')).sort()) {
    for (const statement of (await readFile(join(folder, file), 'utf8')).split('--> statement-breakpoint')) if (statement.trim()) db.exec(statement);
  }
  db.prepare("insert into coop_rooms (code, host_player_id, host_name, guest_player_id, guest_name, shared_coins, host_clicks, shared_features_json, shared_state_version, updated_at) values ('WELT01', 'host-1', 'Nicolas', 'guest-1', 'Silvan', 1234.5, 99, '{\"a\":1}', 7, '2026-10-01 10:00:00')").run();
  db.prepare("insert into coop_rooms (code, host_player_id, host_name, player3_player_id, player3_name, shared_state_version, updated_at) values ('WELT02', 'host-2', 'Anna', 'p3', 'Drei', 3, '2026-10-02T08:00:00.000Z')").run();
  db.prepare("insert into solo_travel values ('host-1', 'cup:x', '{\"id\":\"j1\",\"consumed\":false}')").run();
  db.prepare("insert into solo_travel values ('host-1', 'reward:y', '{\"opening\":{\"id\":\"o\"}}')").run();
  db.prepare("insert into solo_travel values ('host-1', 'broken', '{not json')").run();
  db.prepare("insert into leaderboard_entries (player_id, nickname, total_goals) values ('host-1', 'Nicolas', 5)").run();
  return db;
}

/** The text format of `wrangler d1 export`: schema statements followed by one INSERT per row. */
function exportSql(db: DatabaseSync) {
  const lines = ['PRAGMA defer_foreign_keys=TRUE;'];
  const tables = db.prepare("select name, sql from sqlite_master where type = 'table'").all() as { name: string; sql: string }[];
  for (const table of tables) {
    lines.push(`${table.sql};`);
    for (const row of db.prepare(`select * from "${table.name}"`).all() as Record<string, unknown>[]) {
      const values = Object.values(row).map((v) => v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
      lines.push(`INSERT INTO "${table.name}" (${Object.keys(row).map((k) => `"${k}"`).join(',')}) VALUES(${values.join(',')});`);
    }
  }
  return `${lines.join('\n')}\n`;
}

before(async () => {
  if (!url) return;
  admin = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(admin), { migrationsFolder: 'drizzle' });
  await admin`truncate coop_rooms, solo_travel`;
  dir = await mkdtemp(join(tmpdir(), 'd1-migration-'));
  await writeFile(join(dir, 'export.sql'), exportSql(await legacyD1()));
});
after(async () => { await admin?.end(); });

test('a D1 export lands in PostgreSQL with converted types and archived extra tables', { skip }, async () => {
  const result = await migrateD1ToPostgres({ dump: join(dir, 'export.sql'), databaseUrl: url, archiveDir: dir, log: quiet });
  assert.deepEqual(result.written, { rooms: 2, journeys: 2 });
  const [room] = await admin`select * from coop_rooms where code = 'WELT01'`;
  assert.equal(room.shared_coins, 1234.5);
  assert.equal(Number(room.host_clicks), 99);
  assert.equal(room.shared_features_json, '{"a":1}');
  assert.equal(room.room_name, 'Meine Welt');
  assert.equal(room.updated_at, '2026-10-01T10:00:00.000Z');
  const [journey] = await admin`select journey_json from solo_travel where fixture_id = 'cup:x'`;
  assert.deepEqual(journey.journey_json, { id: 'j1', consumed: false });
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'd1-archive-leaderboard_entries.json'), 'utf8'))[0].nickname, 'Nicolas');
});

test('running it again changes nothing and never overwrites newer play or consumed receipts', { skip }, async () => {
  const again = await migrateD1ToPostgres({ dump: join(dir, 'export.sql'), databaseUrl: url, archiveDir: dir, log: quiet });
  assert.deepEqual(again.written, { rooms: 2, journeys: 0 });
  // The world is played on Supabase after the first run, and the journey there is consumed.
  await admin`update coop_rooms set shared_state_version = 12, shared_coins = 9999, updated_at = '2026-10-20T00:00:00.000Z' where code = 'WELT01'`;
  await admin`update solo_travel set journey_json = '{"id":"j1","consumed":true}' where fixture_id = 'cup:x'`;
  const third = await migrateD1ToPostgres({ dump: join(dir, 'export.sql'), databaseUrl: url, archiveDir: dir, log: quiet });
  assert.deepEqual(third.written, { rooms: 1, journeys: 0 });
  const [room] = await admin`select shared_coins from coop_rooms where code = 'WELT01'`;
  assert.equal(room.shared_coins, 9999);
  const [journey] = await admin`select journey_json from solo_travel where fixture_id = 'cup:x'`;
  assert.equal(journey.journey_json.consumed, true);
  const [{ n }] = await admin`select count(*)::int as n from coop_rooms`;
  assert.equal(n, 2);
});

test('a dry run reads the export and writes nothing', { skip }, async () => {
  await admin`truncate coop_rooms, solo_travel`;
  const result = await migrateD1ToPostgres({ dump: join(dir, 'export.sql'), databaseUrl: url, dryRun: true, log: quiet });
  assert.equal(result.rooms, 2);
  const [{ n }] = await admin`select count(*)::int as n from coop_rooms`;
  assert.equal(n, 0);
});
