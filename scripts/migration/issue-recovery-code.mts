// TEMPORARY recovery bridge: issues a one time recovery code for exactly one original account that has no Neon
// login yet, for the case that the old password is lost or the old Supabase project is gone. The owner hands the
// code to the player in person (not by e-mail or chat). Only its SHA-256 hash is stored.
//
//   DATABASE_URL=<Neon branch> NEON_AUTH_BASE_URL=<Auth URL of the same branch> \
//     npx tsx scripts/migration/issue-recovery-code.mts --username <name> [--hours 24]
import { hashRecoveryCode, newRecoveryCode } from '../../app/auth/recovery-code.ts';
import { connect, option } from './shared.mts';

const username = option('--username').trim().toLowerCase();
const hours = Math.min(72, Math.max(1, Number(option('--hours') || 24)));
const base = (process.env.NEON_AUTH_BASE_URL ?? '').trim().replace(/\/+$/, '');
if (!username || !base) {
  console.error('Aufruf: --username <name> und NEON_AUTH_BASE_URL der Zielumgebung sind nötig.');
  process.exit(2);
}
const issuer = (() => { const url = new URL(base); return `${url.origin}${url.pathname.replace(/\/+$/, '')}`; })();
const { sql, host } = connect('DATABASE_URL');
try {
  const [profile] = await sql`select user_id::text as account_id from profiles where username_key = ${username}`;
  if (!profile) throw new Error('Diesen Benutzernamen gibt es nicht.');
  const legacy = await sql`select provider from legacy_identities where account_id = ${profile.account_id}::uuid`;
  if (!legacy.length) throw new Error('Das ist kein Konto aus dem ursprünglichen Projekt.');
  const [bound] = await sql`select 1 from auth_identities where account_id = ${profile.account_id}::uuid and issuer = ${issuer}`;
  if (bound) throw new Error('Dieses Konto hat in dieser Umgebung schon einen Login. Kein Code nötig.');
  const code = newRecoveryCode();
  const expiresAt = new Date(Date.now() + hours * 3_600_000).toISOString();
  // Older unused codes of this account stop working.
  await sql.begin(async (tx) => {
    await tx`update recovery_codes set used_at = ${new Date().toISOString()} where account_id = ${profile.account_id}::uuid and issuer = ${issuer} and used_at is null`;
    await tx`insert into recovery_codes (code_hash, account_id, issuer, expires_at) values (${hashRecoveryCode(code)}, ${profile.account_id}::uuid, ${issuer}, ${expiresAt})`;
  });
  console.log(`Datenbank ${host}, Login Umgebung ${new URL(issuer).hostname}`);
  console.log(`Code für ${username}, gültig bis ${expiresAt}, einmalig:`);
  console.log(`\n    ${code}\n`);
  console.log('Persönlich weitergeben. Der Spieler wählt damit unter "Ich habe einen Wiederherstellungscode" ein neues Passwort.');
} catch (error) {
  console.error(`FEHLER: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
