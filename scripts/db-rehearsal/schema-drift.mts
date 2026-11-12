// Read only comparison of a database with the repository: db/schema.ts (journal 0000 to 0007), the hand applied
// migrations 0008 and 0009 and the runtime role. Prints a report and exits 1 on drift. Never writes: the session
// is read only (default_transaction_read_only) and the script only reads the catalog, no game rows.
//
//   DATABASE_URL=<database> npx tsx scripts/db-rehearsal/schema-drift.mts
//
// Meant for the owner, against a Neon branch (staging first), with a direct connection. Rehearsed only locally.
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { is } from 'drizzle-orm';
import { PgTable as PgTableClass } from 'drizzle-orm/pg-core';
import * as schema from '../../db/schema.ts';
import { connect } from '../migration/shared.mts';

const { sql, host } = connect('DATABASE_URL', { readOnly: true });
const problems: string[] = [];
const notes: string[] = [];

/** information_schema data_type for a drizzle column type. */
const TYPES: Record<string, string> = {
  PgText: 'text', PgInteger: 'integer', PgBigInt53: 'bigint', PgBigInt64: 'bigint', PgDoublePrecision: 'double precision',
  PgBoolean: 'boolean', PgJsonb: 'jsonb', PgUUID: 'uuid',
};
// Columns that exist only after a hand applied migration, on purpose not declared in db/schema.ts.
const EXTRA_COLUMNS: Record<string, string> = { 'coop_rooms.features_key': '0009', 'solo_travel.created_at': '0009' };

try {
  console.log(`Datenbank: ${host} (nur lesen)`);
  const columns = await sql<{ table_name: string; column_name: string; data_type: string; is_nullable: string }[]>`
    select table_name, column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public'`;
  const byTable = new Map<string, Map<string, { type: string; nullable: boolean }>>();
  for (const c of columns) {
    if (!byTable.has(c.table_name)) byTable.set(c.table_name, new Map());
    byTable.get(c.table_name)!.set(c.column_name, { type: c.data_type, nullable: c.is_nullable === 'YES' });
  }
  const rls = new Map((await sql<{ relname: string; relrowsecurity: boolean }[]>`
    select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'`)
    .map((r) => [r.relname, r.relrowsecurity]));

  const declared = new Set<string>();
  for (const value of Object.values(schema)) {
    if (!is(value, PgTableClass)) continue;
    const config = getTableConfig(value as PgTable);
    declared.add(config.name);
    const live = byTable.get(config.name);
    if (!live) { problems.push(`Tabelle fehlt: ${config.name}`); continue; }
    if (rls.get(config.name) !== true) problems.push(`RLS aus: ${config.name}`);
    for (const column of config.columns) {
      const found = live.get(column.name);
      const expected = TYPES[column.columnType] ?? column.getSQLType();
      if (!found) problems.push(`Spalte fehlt: ${config.name}.${column.name}`);
      else {
        if (found.type !== expected) problems.push(`Typ abweichend: ${config.name}.${column.name} ist ${found.type}, erwartet ${expected}`);
        if (found.nullable === column.notNull) problems.push(`NULL abweichend: ${config.name}.${column.name}`);
      }
    }
    for (const name of live.keys()) {
      if (config.columns.some((c) => c.name === name)) continue;
      const migration = EXTRA_COLUMNS[`${config.name}.${name}`];
      if (migration) notes.push(`${config.name}.${name}: vorhanden (Migration ${migration} angewendet)`);
      else problems.push(`Spalte nicht im Repository: ${config.name}.${name}`);
    }
  }
  for (const table of byTable.keys()) if (!declared.has(table)) notes.push(`Weitere Tabelle in public: ${table}`);
  for (const [key, migration] of Object.entries(EXTRA_COLUMNS)) {
    const [table, column] = key.split('.');
    if (!byTable.get(table)?.has(column)) notes.push(`${key}: fehlt (Migration ${migration} nicht angewendet; der Code läuft auch so)`);
  }

  const [m0009] = await sql`select exists (select 1 from pg_trigger where tgname = 'coop_rooms_features_key' and not tgisinternal) as trigger`;
  const has0009Column = byTable.get('coop_rooms')?.has('features_key') ?? false;
  if (has0009Column !== m0009.trigger) problems.push('0009 nur teilweise angewendet: Spalte features_key und Trigger passen nicht zusammen');
  const [m0008] = await sql`select to_regclass('migration_private.legacy_passwords') is not null as present`;
  notes.push(`0008 (migration_private.legacy_passwords): ${m0008.present ? 'vorhanden' : 'nicht vorhanden'}`);
  const [journal] = await sql`select to_regclass('drizzle.__drizzle_migrations') is not null as present`;
  if (journal.present) {
    const rows = await sql`select count(*)::int as n, max(created_at)::text as last from drizzle.__drizzle_migrations`;
    notes.push(`Drizzle Journal in der Datenbank: ${rows[0].n} Einträge, letzter created_at ${rows[0].last}`);
  } else {
    notes.push('Drizzle Journal in der Datenbank: keines (db:migrate hier NICHT ausführen, siehe docs/db-rehearsal.md)');
  }
  const [role] = await sql`select exists (select 1 from pg_roles where rolname = 'goal_clicker_app') as present`;
  const policies = await sql`select count(*)::int as n from pg_policies where schemaname = 'public' and policyname = 'goal_clicker_app_all'`;
  notes.push(`Laufzeitrolle goal_clicker_app: ${role.present ? 'vorhanden' : 'fehlt'}, Policies ${policies[0].n} von ${declared.size}`);

  for (const note of notes) console.log(`  · ${note}`);
  if (problems.length) {
    console.log(`DRIFT (${problems.length}):`);
    for (const problem of problems) console.log(`  ✗ ${problem}`);
    process.exitCode = 1;
  } else {
    console.log('Kein Drift zwischen Datenbank und db/schema.ts.');
  }
} finally {
  await sql.end({ timeout: 5 });
}
