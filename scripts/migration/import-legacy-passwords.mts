// Administrative transfer only; no credential material is printed or written to disk.
import { connect, flag } from './shared.mts';
const source = connect('LEGACY_DATABASE_URL', { readOnly: true });
const target = connect('TARGET_DATABASE_URL');
try {
  const rows = await source.sql<{ account_id: string; login_email: string; password_hash: string }[]>`
    select u.id::text as account_id, p.login_email, u.encrypted_password as password_hash
    from auth.users u join public.profiles p on p.user_id = u.id
    where p.login_email is not null and u.deleted_at is null and not coalesce(u.is_anonymous, false)`;
  if (rows.length !== 6 || rows.some(r => !/^\$2[aby]\$\d{2}\$/.test(r.password_hash))) throw Error('Unexpected credential count or format');
  await target.sql.begin(async tx => {
    for (const row of rows) {
      const [present] = await tx`select user_id from public.profiles where user_id=${row.account_id}::uuid and login_email=${row.login_email}`;
      if (!present) throw Error('Source account does not match target profile');
      const [bound] = await tx`select 1 from public.auth_identities where account_id=${row.account_id}::uuid and deleted_at is null`;
      // Never re-import a retired credential after an account has migrated.
      if (bound) continue;
      if (!flag('--dry-run')) {
        await tx`insert into migration_private.legacy_passwords(account_id,login_email,password_hash)
          values(${row.account_id}::uuid,${row.login_email},${row.password_hash}) on conflict(account_id) do nothing`;
        const [matches] = await tx`select 1 from migration_private.legacy_passwords
          where account_id=${row.account_id}::uuid and login_email=${row.login_email} and password_hash=${row.password_hash}`;
        if (!matches) throw Error('Existing migration credential differs; transaction rolled back');
      }
    }
  });
  console.log(flag('--dry-run') ? 'Six legacy credentials validated; dry run only.' : 'Legacy credentials imported and verified.');
} catch {
  console.error('Credential import failed; no credential details are logged.');
  process.exitCode = 1;
} finally { await source.sql.end(); await target.sql.end(); }
