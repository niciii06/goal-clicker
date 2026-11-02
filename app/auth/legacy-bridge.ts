// Server-only offline password migration. This connection belongs to a dedicated
// verifier role; the normal application role must never read password hashes.
import postgres from 'postgres';
import { compare } from 'bcryptjs';
export type LegacyCheck = { result: 'valid'; userId: string } | { result: 'invalid' } | { result: 'unavailable' } | { result: 'rate-limited' };
let verifier: postgres.Sql | undefined;
function db() {
  const url = process.env.LEGACY_PASSWORD_DATABASE_URL;
  if (!url) throw new Error('Offline migration verifier is not configured');
  return verifier ??= postgres(url, { prepare: false, fetch_types: false, max: 1, idle_timeout: 20 });
}
export function legacyBridgeConfigured() { return Boolean(process.env.LEGACY_PASSWORD_DATABASE_URL); }
export async function checkLegacyCredential(row: { account_id: string; password_hash: string } | undefined, password: string): Promise<LegacyCheck> {
  if (!row || !/^\$2[aby]\$\d{2}\$/.test(row.password_hash)) return { result: 'invalid' };
  const hash = row.password_hash.replace(/^\$2y\$/, '$2b$');
  return await compare(password, hash) ? { result: 'valid', userId: row.account_id } : { result: 'invalid' };
}
export async function verifyLegacyPassword(email: string, password: string): Promise<LegacyCheck> {
  if (!legacyBridgeConfigured()) return { result: 'unavailable' };
  try {
    const rows = await db()<{ account_id: string; password_hash: string }[]>`
      select account_id, password_hash from migration_private.legacy_passwords where login_email = ${email}`;
    return await checkLegacyCredential(rows[0], password);
  } catch { return { result: 'unavailable' }; }
}
// Called only after supported Neon APIs verified the credential and the canonical
// identity was bound. Failure retains the recovery proof for a later safe retry.
export async function retireLegacyPassword(accountId: string) {
  if (!legacyBridgeConfigured()) return;
  try { await db()`delete from migration_private.legacy_passwords where account_id = ${accountId}::uuid`; }
  catch { /* A later successful login retries retirement; never log credentials. */ }
}
