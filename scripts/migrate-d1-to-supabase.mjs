#!/usr/bin/env node
// Copies the Goal Clicker data from a Cloudflare D1 export into the Supabase (PostgreSQL) database.
//
//   DATABASE_URL=postgres://... node scripts/migrate-d1-to-supabase.mjs --dump d1-export.sql [--dry-run] [--force]
//   DATABASE_URL=postgres://... node scripts/migrate-d1-to-supabase.mjs --sqlite d1-copy.sqlite
//
// Idempotent: running it again changes nothing. A world that was already played on Supabase after an
// earlier run (higher shared_state_version or newer updated_at) is never overwritten unless --force is given.
// Journey and reward receipts already consumed on Supabase stay consumed.
// Run `npm run db:migrate` first so the tables exist. The D1 export is read into an in-memory SQLite
// database (node:sqlite, Node 22.13 or newer); nothing is written back to the export.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

const ROOM_COLUMNS = {
  code: "text", room_name: "text", host_player_id: "text", host_name: "text", host_last_seen_at: "text",
  guest_player_id: "text", guest_name: "text", guest_last_seen_at: "text",
  player3_player_id: "text", player3_name: "text", player3_last_seen_at: "text",
  player4_player_id: "text", player4_name: "text", player4_last_seen_at: "text",
  shared_coins: "real", host_goals: "real", guest_goals: "real", player3_goals: "real", player4_goals: "real",
  host_clicks: "int", guest_clicks: "int", player3_clicks: "int", player4_clicks: "int",
  shared_upgrade_level: "int", shared_total_goals: "real", shared_season_goals: "real",
  shared_upgrades_json: "text", shared_achievements_json: "text", shared_stars: "int", shared_seasons: "int",
  shared_minigame_wins: "int", shared_minigame_cooldowns_json: "text", shared_features_json: "text",
  shared_state_backup_json: "text", shared_state_version: "int", redeemed_bonus_codes_json: "text",
  last_passive_at: "text", pending_player_id: "text", pending_upgrade_id: "text", pending_upgrade_name: "text",
  pending_cost: "real", pending_upgrade_count: "int", updated_at: "text",
};
/** Columns added by later D1 migrations; older exports get the PostgreSQL defaults. */
const ROOM_DEFAULTS = {
  room_name: "Meine Welt", host_last_seen_at: "", guest_last_seen_at: "", player3_last_seen_at: "", player4_last_seen_at: "",
  shared_coins: 0, host_goals: 0, guest_goals: 0, player3_goals: 0, player4_goals: 0,
  host_clicks: 0, guest_clicks: 0, player3_clicks: 0, player4_clicks: 0, shared_upgrade_level: 0,
  shared_total_goals: 0, shared_season_goals: 0, shared_upgrades_json: "{}", shared_achievements_json: "[]",
  shared_stars: 0, shared_seasons: 0, shared_minigame_wins: 0, shared_minigame_cooldowns_json: "{}",
  shared_features_json: "{}", shared_state_backup_json: "{}", shared_state_version: 0, redeemed_bonus_codes_json: "[]",
  last_passive_at: "",
};
const MIGRATED_TABLES = new Set(["coop_rooms", "solo_travel"]);
const IGNORED_TABLES = new Set(["d1_migrations", "_cf_KV", "_cf_METADATA", "sqlite_sequence"]);

/** D1 wrote CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS"; the app compares ISO strings. */
function isoTimestamp(value) {
  if (typeof value !== "string") return value;
  return /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value) ? `${value.replace(" ", "T")}.000Z` : value;
}

function roomRow(source) {
  const row = {};
  for (const [column, type] of Object.entries(ROOM_COLUMNS)) {
    let value = Object.hasOwn(source, column) ? source[column] : undefined;
    if (value === undefined || value === null) value = ROOM_DEFAULTS[column] ?? null;
    if (value !== null && type === "int") value = Math.trunc(Number(value));
    if (value !== null && type === "real") value = Number(value);
    if (value !== null && type === "text") value = String(value);
    row[column] = value;
  }
  row.updated_at = isoTimestamp(row.updated_at) || new Date(0).toISOString();
  if (!row.code || !row.host_player_id || !row.host_name) throw new Error(`coop_rooms row without code or host: ${JSON.stringify(source).slice(0, 120)}`);
  return row;
}

/**
 * SQLite manages sqlite_sequence (and other sqlite_ tables) itself and refuses to create or fill them,
 * so exports that list them as ordinary tables could not be read. Their content is not needed.
 */
export function withoutSqliteInternals(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !/^\s*(CREATE TABLE( IF NOT EXISTS)?|INSERT INTO|DELETE FROM)\s+["'`\[]?sqlite_/i.test(line))
    .join("\n");
}

async function openSource({ dump, sqlite }) {
  const { DatabaseSync } = await import("node:sqlite");
  if (sqlite) return new DatabaseSync(resolve(sqlite), { readOnly: true });
  const db = new DatabaseSync(":memory:");
  db.exec(withoutSqliteInternals(readFileSync(resolve(dump), "utf8")));
  return db;
}

function tableNames(source) {
  return source.prepare("select name from sqlite_master where type = 'table'").all().map((row) => row.name);
}

/**
 * @param {{ dump?: string; sqlite?: string; databaseUrl: string; dryRun?: boolean; force?: boolean; archiveDir?: string; log?: (line: string) => void }} options
 */
export async function migrateD1ToPostgres({ dump, sqlite, databaseUrl, dryRun = false, force = false, archiveDir = ".", log = console.log }) {
  if (!dump === !sqlite) throw new Error("Give exactly one source: --dump <d1-export.sql> or --sqlite <file>.");
  if (!databaseUrl) throw new Error("DATABASE_URL is missing.");
  const source = await openSource({ dump, sqlite });
  const tables = tableNames(source);
  if (!tables.includes("coop_rooms")) throw new Error("The export has no coop_rooms table. Is it the Goal Clicker database?");

  const rooms = source.prepare("select * from coop_rooms").all().map(roomRow);
  const journeys = [];
  let invalidJourneys = 0;
  if (tables.includes("solo_travel")) {
    for (const row of source.prepare("select owner, fixture_id, journey_json from solo_travel").all()) {
      try {
        journeys.push({ owner: String(row.owner), fixture_id: String(row.fixture_id), journey_json: JSON.parse(String(row.journey_json)) });
      } catch {
        invalidJourneys += 1;
      }
    }
  }
  // Tables the current app no longer reads (for example the old leaderboard) are kept as JSON files.
  const archived = [];
  for (const table of tables.filter((name) => !MIGRATED_TABLES.has(name) && !IGNORED_TABLES.has(name))) {
    const rows = source.prepare(`select * from "${table.replaceAll('"', '""')}"`).all();
    if (!dryRun) writeFileSync(resolve(archiveDir, `d1-archive-${table}.json`), `${JSON.stringify(rows, null, 2)}\n`);
    archived.push(`${table} (${rows.length})`);
  }
  source.close();
  log(`Read ${rooms.length} worlds and ${journeys.length} receipts${invalidJourneys ? `, skipped ${invalidJourneys} receipts with invalid JSON` : ""}.`);
  if (archived.length) log(`${dryRun ? "Would archive" : "Archived"} unused tables as JSON: ${archived.join(", ")}.`);
  if (dryRun) return { rooms: rooms.length, journeys: journeys.length, written: { rooms: 0, journeys: 0 } };

  const sql = postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const written = await sql.begin(async (tx) => {
      let roomCount = 0, journeyCount = 0;
      const columns = Object.keys(ROOM_COLUMNS);
      const updates = columns.filter((column) => column !== "code").map((column) => `"${column}" = excluded."${column}"`).join(", ");
      const guard = force ? "" : ` where coop_rooms.shared_state_version <= excluded.shared_state_version and coop_rooms.updated_at <= excluded.updated_at`;
      for (const room of rooms) {
        const result = await tx.unsafe(
          `insert into coop_rooms (${columns.map((column) => `"${column}"`).join(", ")}) values (${columns.map((_, i) => `$${i + 1}`).join(", ")})
           on conflict (code) do update set ${updates}${guard}
           returning code`,
          columns.map((column) => room[column]),
        );
        roomCount += result.length;
      }
      for (const journey of journeys) {
        const result = await tx`
          insert into solo_travel (owner, fixture_id, journey_json) values (${journey.owner}, ${journey.fixture_id}, ${tx.json(journey.journey_json)})
          on conflict (owner, fixture_id) do update set journey_json = excluded.journey_json
          where solo_travel.journey_json is distinct from excluded.journey_json
            and (${force} or coalesce(solo_travel.journey_json->'consumed', 'null'::jsonb) in ('null'::jsonb, 'false'::jsonb, '0'::jsonb))
          returning owner`;
        journeyCount += result.length;
      }
      return { rooms: roomCount, journeys: journeyCount };
    });
    log(`Wrote ${written.rooms} worlds and ${written.journeys} receipts (unchanged or newer rows on Supabase were left alone).`);
    return { rooms: rooms.length, journeys: journeys.length, written };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function parseArgs(argv) {
  const options = { dryRun: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dump") options.dump = argv[++i];
    else if (arg === "--sqlite") options.sqlite = argv[++i];
    else if (arg === "--archive-dir") options.archiveDir = argv[++i];
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else throw new Error(`Unknown argument ${arg}`);
  }
  return options;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const file = options.dump ?? options.sqlite;
    if (file && !existsSync(file)) throw new Error(`File not found: ${file}`);
    await migrateD1ToPostgres({ ...options, databaseUrl: process.env.DATABASE_URL ?? "" });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
