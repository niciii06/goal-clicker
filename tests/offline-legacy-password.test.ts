import test from 'node:test';
import assert from 'node:assert/strict';
import { hash } from 'bcryptjs';
import { checkLegacyCredential } from '../app/auth/legacy-bridge';
test('offline bcrypt proof preserves the exact canonical account, without a provider request', async () => {
  const row = { account_id: 'original-account', password_hash: await hash('synthetic-test-password', 4) };
  assert.deepEqual(await checkLegacyCredential(row, 'synthetic-test-password'), { result: 'valid', userId: 'original-account' });
  assert.deepEqual(await checkLegacyCredential(row, 'wrong-password'), { result: 'invalid' });
  assert.deepEqual(await checkLegacyCredential(undefined, 'synthetic-test-password'), { result: 'invalid' });
  assert.deepEqual(await checkLegacyCredential({ ...row, password_hash: 'malformed' }, 'synthetic-test-password'), { result: 'invalid' });
  assert.deepEqual(await checkLegacyCredential({ ...row, password_hash: row.password_hash.replace('$2b$', '$2y$') }, 'synthetic-test-password'), { result: 'valid', userId: 'original-account' });
});
