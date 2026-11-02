// Finishes account deletions (and failed registrations) whose login Neon Auth could not delete itself: Neon's
// Managed Better Auth has no self service delete-user. The game already deleted the data and marked the login
// (auth_identities.deleted_at); the login itself can only be deleted as an admin.
//
//   DATABASE_URL=<branch, direct> NEON_AUTH_BASE_URL=<Auth URL of the same branch> \
//     npx tsx scripts/migration/finish-account-deletions.mts            # lists what is pending, with the commands
//   ... --finish                                                         # after the logins were deleted at Neon
//
// Delete each listed login with the Neon CLI (neon neon-auth user delete <id> --project-id ... --branch ...), the
// Neon Console (Auth > Users) or the Neon MCP tool delete_auth_user. --finish then removes the mark of every login
// that no longer exists in neon_auth."user" of the same database, and keeps the others. Prints login IDs only.
import { connect, flag } from './shared.mts';

const base = (process.env.NEON_AUTH_BASE_URL ?? '').trim().replace(/\/+$/, '');
if (!base) {
  console.error('NEON_AUTH_BASE_URL der Zielumgebung fehlt.');
  process.exit(2);
}
const issuer = (() => { const url = new URL(base); return `${url.origin}${url.pathname.replace(/\/+$/, '')}`; })();
const finish = flag('--finish');
const { sql, host } = connect('DATABASE_URL');
try {
  const pending = await sql<{ subject: string; account_id: string; method: string; deleted_at: string }[]>`select subject, account_id::text, method, deleted_at from auth_identities where issuer = ${issuer} and deleted_at is not null order by deleted_at`;
  console.log(`Datenbank ${host}, Login Umgebung ${new URL(issuer).hostname}: ${pending.length} gesperrte Logins`);
  const [{ present: hasNeonAuth }] = await sql`select to_regclass('neon_auth."user"') is not null as present`;
  for (const row of pending) {
    const [exists] = hasNeonAuth ? await sql`select 1 from neon_auth."user" where id::text = ${row.subject}` : [true];
    const still = Boolean(exists);
    console.log(`${row.subject}  ${row.method.padEnd(20)} markiert ${row.deleted_at}  ${still ? 'Login besteht noch' : 'Login ist weg'}`);
    if (still && !finish) console.log(`    neon neon-auth user delete ${row.subject} --project-id <projekt> --branch <branch>`);
    if (!still && finish) {
      // The data of the account is already gone (deleteAccountData); only the mark is left.
      await sql`delete from auth_identities where issuer = ${issuer} and subject = ${row.subject} and deleted_at is not null`;
      console.log('    Markierung entfernt, Löschung abgeschlossen.');
    }
  }
  if (!hasNeonAuth) console.log('Hinweis: neon_auth."user" ist in dieser Datenbank nicht sichtbar; --finish entfernt dann nichts.');
} finally {
  await sql.end();
}
