// Read only report for the release gate: row counts and checksums of the game tables (compare Supabase, Neon
// staging and Neon production), and how many original accounts already have a login in this environment.
// Prints counts and hashes only, never IDs, names, e-mail addresses or saves.
//
//   DATABASE_URL=<database> [NEON_AUTH_BASE_URL=<Auth URL of that branch>] npx tsx scripts/migration/verify-accounts.mts
import { connect } from './shared.mts';

const { sql, host } = connect('DATABASE_URL', { readOnly: true });
const TABLES: Record<string, string> = {
  coop_rooms: 'code',
  player_accounts: 'user_id',
  profiles: 'user_id',
  cloud_saves: 'user_id',
  solo_travel: 'owner, fixture_id',
};
try {
  console.log(`Datenbank: ${host}`);
  let total = 0;
  for (const [table, order] of Object.entries(TABLES)) {
    const [row] = await sql.unsafe(`select count(*)::int as n, md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by ${order}), '')) as checksum from ${table} t`);
    total += row.n;
    console.log(`${table.padEnd(16)} ${String(row.n).padStart(5)}  ${row.checksum}`);
  }
  console.log(`${'gesamt'.padEnd(16)} ${String(total).padStart(5)}`);
  // What a full read costs in database egress (uncompressed text, as PostgreSQL sends it).
  const [rooms] = await sql`select coalesce(avg(octet_length(shared_features_json)), 0)::int as features_avg, coalesce(max(octet_length(shared_features_json)), 0)::int as features_max, coalesce(avg(octet_length(shared_state_backup_json)), 0)::int as backup_avg from coop_rooms`;
  const [saves] = await sql`select coalesce(avg(octet_length(save_json)), 0)::int as avg, coalesce(max(octet_length(save_json)), 0)::int as max from cloud_saves`;
  console.log(`Weltgrösse (Text): Features Schnitt ${rooms.features_avg} B, max ${rooms.features_max} B, Backup Schnitt ${rooms.backup_avg} B; Cloud Spielstand Schnitt ${saves.avg} B, max ${saves.max} B`);
  const exists = async (table: string) => (await sql`select to_regclass(${table}) is not null as ok`)[0].ok as boolean;
  if (await exists('public.legacy_identities')) {
    const legacy = await sql`select provider, count(*)::int as n from legacy_identities group by provider order by provider`;
    console.log(`Alte Logins importiert: ${legacy.map((r) => `${r.provider} ${r.n}`).join(', ') || 'keine'}`);
    const base = (process.env.NEON_AUTH_BASE_URL ?? '').trim().replace(/\/+$/, '');
    if (base) {
      const url = new URL(base);
      const issuer = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
      const [status] = await sql`
        select count(distinct l.account_id)::int as original,
               count(distinct a.account_id)::int as recovered
        from legacy_identities l left join auth_identities a on a.account_id = l.account_id and a.issuer = ${issuer} and a.deleted_at is null`;
      const methods = await sql`select method, count(*)::int as n from auth_identities where issuer = ${issuer} group by method order by method`;
      console.log(`Login Umgebung ${url.hostname}: ${status.recovered} von ${status.original} Originalkonten übernommen; Logins nach Art: ${methods.map((r) => `${r.method} ${r.n}`).join(', ') || 'keine'}`);
    }
  } else console.log('Migration 0007 ist noch nicht angewendet (legacy_identities fehlt).');
} finally {
  await sql.end();
}
