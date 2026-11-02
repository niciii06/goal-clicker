// Imports the logins of the original Supabase project into legacy_identities of a Neon branch, once.
// Only the account ID, the provider and the provider subject (Google sub, or the user ID for e-mail logins) are
// copied; no e-mail address, no password hash, no token. Nothing in profiles, cloud_saves, player_accounts or
// coop_rooms is touched. Repeatable: existing rows are kept and compared.
//
//   LEGACY_DATABASE_URL=<Supabase, read only use> TARGET_DATABASE_URL=<Neon, direct connection> \
//     npx tsx scripts/migration/import-legacy-identities.mts [--dry-run]
//
// Refuses (exit 1) when an old login has no profile or no cloud save in the target, when a user has more than one
// login of a kind, or when an imported row differs from the source.
import { connect, flag } from './shared.mts';

const dryRun = flag('--dry-run');
const source = connect('LEGACY_DATABASE_URL', { readOnly: true });
const target = connect('TARGET_DATABASE_URL');
console.log(`Quelle: ${source.host} (nur lesen), Ziel: ${target.host}${dryRun ? ' (Probelauf, schreibt nichts)' : ''}`);

try {
  const rows = await source.sql<{ account_id: string; provider: string; provider_subject: string; deleted: boolean; anonymous: boolean }[]>`
    select i.user_id::text as account_id, i.provider, i.provider_id as provider_subject, (u.deleted_at is not null) as deleted, coalesce(u.is_anonymous, false) as anonymous
    from auth.identities i join auth.users u on u.id = i.user_id
    order by i.provider, i.user_id`;
  const usable = rows.filter((row) => !row.deleted && !row.anonymous && (row.provider === 'google' || row.provider === 'email'));
  const problems: string[] = [];
  if (usable.length !== rows.length) problems.push(`${rows.length - usable.length} Logins sind gelöscht, anonym oder von einem anderen Anbieter`);
  const perKind = new Map<string, number>();
  for (const row of usable) perKind.set(`${row.provider}:${row.account_id}`, (perKind.get(`${row.provider}:${row.account_id}`) ?? 0) + 1);
  if ([...perKind.values()].some((count) => count > 1)) problems.push('ein Konto hat mehrere Logins derselben Art');
  for (const row of usable) {
    if (row.provider === 'email' && row.provider_subject !== row.account_id) problems.push(`E-Mail Login mit abweichender Kennung (Konto …${row.account_id.slice(-4)})`);
    const [present] = await target.sql`select (select count(*) from profiles where user_id = ${row.account_id}::uuid)::int as profiles, (select count(*) from cloud_saves where user_id = ${row.account_id}::uuid)::int as saves, (select count(*) from player_accounts where user_id = ${row.account_id}::uuid)::int as links, (select login_email is not null from profiles where user_id = ${row.account_id}::uuid) as has_login_email`;
    if (present.profiles !== 1) problems.push(`kein Profil im Ziel (Konto …${row.account_id.slice(-4)})`);
    if (present.saves !== 1) problems.push(`kein Cloud Spielstand im Ziel (Konto …${row.account_id.slice(-4)})`);
    if (row.provider === 'email' && present.has_login_email !== true) problems.push(`Benutzername Konto ohne alte Login Adresse (Konto …${row.account_id.slice(-4)})`);
  }
  const google = usable.filter((row) => row.provider === 'google').length;
  const email = usable.filter((row) => row.provider === 'email').length;
  console.log(`Alte Logins: ${usable.length} (Google ${google}, Benutzername ${email})`);
  if (problems.length) {
    for (const problem of problems) console.error(`FEHLER: ${problem}`);
    process.exitCode = 1;
  } else if (!dryRun) {
    await target.sql.begin(async (tx) => {
      for (const row of usable) await tx`insert into legacy_identities (provider, provider_subject, account_id) values (${row.provider}, ${row.provider_subject}, ${row.account_id}::uuid) on conflict (provider, provider_subject) do nothing`;
      for (const row of usable) {
        const [stored] = await tx`select account_id::text as account_id from legacy_identities where provider = ${row.provider} and provider_subject = ${row.provider_subject}`;
        if (stored.account_id !== row.account_id) throw new Error(`Abweichende Zuordnung im Ziel (Konto …${row.account_id.slice(-4)}), nichts übernommen.`);
      }
    });
    const [{ n }] = await target.sql`select count(*)::int as n from legacy_identities`;
    console.log(`Übernommen. legacy_identities im Ziel: ${n}`);
  } else console.log('Probelauf ohne Fehler.');
} finally {
  await source.sql.end();
  await target.sql.end();
}
