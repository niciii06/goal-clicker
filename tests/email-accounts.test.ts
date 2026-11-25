// Notion P1 «E-Mail-Pflicht, E-Mail-Verifizierung und Passwort-Zurücksetzen»: new password accounts with a real
// e-mail address (GOAL_CLICKER_EMAIL_SIGNUP), confirmed with a one time code before the account opens; sign in with
// the address; a neutral reset with a one time code. Old username accounts, Google and every account ID stay as they
// were, and nothing is ever joined by e-mail address.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { getCloudSaveResponse, getProfileResponse, loginResponse, normalizeEmail, passwordResetResponse, putCloudSaveResponse, registerResponse, resendVerificationResponse, verifyEmailResponse } from '../app/account-api.ts';
import type { AccountApiDeps } from '../app/account-api.ts';
import { clearIdentityCacheForTests, lookupAccount, resolveAccount } from '../app/auth/identity.ts';
import type { AuthSession } from '../app/auth/server.ts';
import { accountDeps, fakeNeon, ISSUER, memoryStore, sessionCookieFrom } from './helpers/memory-account-store.ts';

type Body = Record<string, unknown> & { errorCode?: string; verificationRequired?: boolean; codeSent?: boolean; email?: string | null; profile?: { username: string } | null };

function setup(emailSignup = true) {
  const store = memoryStore();
  const neon = fakeNeon();
  const deps: AccountApiDeps = accountDeps(store, neon, { emailSignup });
  const call = async (handler: (request: Request, deps: AccountApiDeps) => Promise<Response>, path: string, body?: unknown, cookie = '', method = body === undefined ? 'GET' : 'POST') => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (cookie) headers.cookie = cookie;
    const response = await handler(new Request(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), deps);
    return { status: response.status, cookie: sessionCookieFrom(response), data: await response.json() as Body };
  };
  const register = (email: unknown, username = 'Keeper', password = 'sicheres-passwort') => call(registerResponse, '/api/register', { username, displayName: 'Goalie', password, email });
  return { store, neon, deps, call, register };
}

beforeEach(() => clearIdentityCacheForTests());

test('the address is cleaned: lower case, a plain shape, never the generated login domain', () => {
  assert.equal(normalizeEmail('  Lea.Muster@Example.CH '), 'lea.muster@example.ch');
  for (const bad of ['', 'lea', 'lea@', '@example.ch', 'lea@example', 'le a@example.ch', 'p-1@players.goal-clicker.vercel.app', `${'a'.repeat(250)}@x.ch`, 42]) assert.equal(normalizeEmail(bad), '', String(bad));
});

test('flag off: registration ignores an e-mail and stays the generated username login (unchanged)', async () => {
  const { register, store, neon } = setup(false);
  const created = await register('lea@example.ch');
  assert.equal(created.status, 201);
  assert.equal(created.data.verificationRequired, undefined);
  assert.equal(store.identities[0].method, 'password');
  assert.match(store.identities[0].loginEmail ?? '', /^p-.+@players\.goal-clicker\.vercel\.app$/);
  assert.ok(!neon.calls.some((c) => c.startsWith('send-verification')), 'no mail without the flag');
});

test('new e-mail account: pending until the code, then the account opens; the account is bound by login, not by address', async () => {
  const { register, call, store, neon } = setup();
  assert.equal((await register('')).data.errorCode, 'INVALID_EMAIL');
  assert.equal((await register('p-x@players.goal-clicker.vercel.app')).data.errorCode, 'INVALID_EMAIL');
  const created = await register('Lea@Example.ch');
  assert.equal(created.status, 201);
  assert.equal(created.data.verificationRequired, true);
  assert.equal(created.data.codeSent, true);
  const identity = store.identities.find((i) => i.method === 'email')!;
  assert.equal(identity.loginEmail, 'lea@example.ch');
  assert.equal(store.profiles.get(identity.accountId)?.loginEmail, null, 'no generated address on the profile');
  // Signed in at Neon, but the game account stays closed: profile and cloud save answer EMAIL_UNVERIFIED.
  for (const handler of [getProfileResponse, getCloudSaveResponse]) {
    const pending = await call(handler, '/api/profile', undefined, created.cookie);
    assert.equal(pending.status, 403); assert.equal(pending.data.errorCode, 'EMAIL_UNVERIFIED');
  }
  const put = await call(putCloudSaveResponse, '/api/save', { baseVersion: 0, keys: {} }, created.cookie, 'PUT');
  assert.equal(put.data.errorCode, 'EMAIL_UNVERIFIED', 'no save before the address is confirmed');
  // Wrong code, then the right one.
  const code = neon.lastCode('lea@example.ch');
  assert.match(code, /^\d{6}$/);
  const wrong = await call(verifyEmailResponse, '/api/email/verify', { email: 'lea@example.ch', code: code === '123456' ? '654321' : '123456' });
  assert.equal(wrong.status, 400); assert.equal(wrong.data.errorCode, 'INVALID_CODE');
  const ok = await call(verifyEmailResponse, '/api/email/verify', { email: 'LEA@example.ch', code });
  assert.equal(ok.status, 200);
  const profile = await call(getProfileResponse, '/api/profile', undefined, created.cookie);
  assert.equal(profile.status, 200);
  assert.equal(profile.data.profile?.username, 'Keeper');
  assert.equal(profile.data.email, 'lea@example.ch', 'the player sees the own real address');
  // The code works once.
  assert.equal((await call(verifyEmailResponse, '/api/email/verify', { email: 'lea@example.ch', code })).data.errorCode, 'INVALID_CODE');
});

test('codes: malformed, expired, three wrong tries lock the code; resend gives a new one; resend is neutral', async () => {
  const { register, call, neon } = setup();
  await register('mia@example.ch', 'Mia');
  for (const code of ['', '12345', '1234567', 'abcdef']) assert.equal((await call(verifyEmailResponse, '/api/email/verify', { email: 'mia@example.ch', code })).data.errorCode, 'INVALID_CODE');
  const first = neon.lastCode('mia@example.ch');
  const other = first === '111111' ? '222222' : '111111';
  assert.equal((await call(verifyEmailResponse, '/api/email/verify', { email: 'mia@example.ch', code: other })).status, 400);
  assert.equal((await call(verifyEmailResponse, '/api/email/verify', { email: 'mia@example.ch', code: other })).status, 400);
  const locked = await call(verifyEmailResponse, '/api/email/verify', { email: 'mia@example.ch', code: other });
  assert.equal(locked.status, 429); assert.equal(locked.data.errorCode, 'CODE_LOCKED');
  assert.equal((await call(verifyEmailResponse, '/api/email/verify', { email: 'mia@example.ch', code: first })).data.errorCode, 'INVALID_CODE', 'a locked code is gone');
  // A new code, and it expires after 15 minutes.
  const resent = await call(resendVerificationResponse, '/api/email/resend', { email: 'mia@example.ch' });
  assert.equal(resent.status, 202);
  const second = neon.lastCode('mia@example.ch');
  assert.notEqual(second, first);
  const start = Date.now(); neon.clock = () => start + 16 * 60_000;
  assert.equal((await call(verifyEmailResponse, '/api/email/verify', { email: 'mia@example.ch', code: second })).data.errorCode, 'INVALID_CODE', 'expired');
  neon.clock = () => Date.now();
  await call(resendVerificationResponse, '/api/email/resend', { email: 'mia@example.ch' });
  assert.equal((await call(verifyEmailResponse, '/api/email/verify', { email: 'mia@example.ch', code: neon.lastCode('mia@example.ch') })).status, 200);
  // Unknown or Google address: the same answer, and no mail.
  const before = neon.outbox.length;
  for (const email of ['nobody@example.ch', 'not-an-address']) assert.deepEqual((await call(resendVerificationResponse, '/api/email/resend', { email })).data, { sent: true });
  assert.equal(neon.outbox.length, before);
});

test('sign in with the address: e-mail accounts only, pending accounts stay closed, wrong password neutral', async () => {
  const { register, call, neon } = setup();
  await register('noa@example.ch', 'Noa');
  const pending = await call(loginResponse, '/api/login', { username: 'Noa@Example.ch', password: 'sicheres-passwort' });
  assert.equal(pending.status, 200); assert.equal(pending.data.verificationRequired, true);
  assert.equal((await call(getProfileResponse, '/api/profile', undefined, pending.cookie)).data.errorCode, 'EMAIL_UNVERIFIED');
  await call(verifyEmailResponse, '/api/email/verify', { email: 'noa@example.ch', code: neon.lastCode('noa@example.ch') });
  const verified = await call(loginResponse, '/api/login', { username: 'noa@example.ch', password: 'sicheres-passwort' });
  assert.equal(verified.data.verificationRequired, false);
  assert.equal((await call(getProfileResponse, '/api/profile', undefined, verified.cookie)).status, 200);
  assert.equal((await call(loginResponse, '/api/login', { username: 'noa@example.ch', password: 'falsches-passwort' })).data.errorCode, 'INVALID_LOGIN');
  assert.equal((await call(loginResponse, '/api/login', { username: 'nobody@example.ch', password: 'sicheres-passwort' })).data.errorCode, 'INVALID_LOGIN');
  // The username still opens the same account (through the account's own login address).
  const byName = await call(loginResponse, '/api/login', { username: 'Noa', password: 'sicheres-passwort' });
  assert.equal(byName.status, 200);
  assert.equal((await call(getProfileResponse, '/api/profile', undefined, byName.cookie)).data.profile?.username, 'Noa');
});

test('a pending e-mail account stays closed on the username path too', async () => {
  const { register, call } = setup();
  await register('ivo@example.ch', 'Ivo');
  const byName = await call(loginResponse, '/api/login', { username: 'Ivo', password: 'sicheres-passwort' });
  assert.equal(byName.status, 200);
  assert.equal((await call(getProfileResponse, '/api/profile', undefined, byName.cookie)).data.errorCode, 'EMAIL_UNVERIFIED');
});

test('no joining by address: a Google login with the same address keeps its own account, and an address login never opens a Google account', async () => {
  const { register, call, store, neon } = setup();
  const google = neon.googleLogin('google-sub-1', 'kim@example.ch');
  assert.ok(google.ok);
  store.identities.push({ issuer: ISSUER, subject: google.subject, accountId: 'google-account', method: 'google', loginEmail: null, deletedAt: null, createdAt: '' });
  const taken = await register('kim@example.ch', 'Kim');
  assert.equal(taken.status, 409); assert.equal(taken.data.errorCode, 'EMAIL_UNAVAILABLE');
  assert.equal(store.identities.length, 1, 'no second binding, no new account');
  assert.equal(store.profiles.size, 0);
  // Google's Neon user has no password: an address login is refused, the Google account is untouched.
  assert.equal((await call(loginResponse, '/api/login', { username: 'kim@example.ch', password: 'irgendwas-langes' })).status, 401);
  // And a reset code is never sent for a Google address.
  const before = neon.outbox.length;
  assert.deepEqual((await call(passwordResetResponse, '/api/password-reset', { email: 'kim@example.ch' })).data, { sent: true });
  assert.equal(neon.outbox.length, before);
  assert.equal((await call(getProfileResponse, '/api/profile', undefined, google.sessionCookie)).status, 200, 'Google still opens its account');
});

test('password reset: neutral request, single use code, new password works, old one not; other logins and addresses unaffected', async () => {
  const { register, call, neon } = setup();
  await register('ben@example.ch', 'Ben');
  await call(verifyEmailResponse, '/api/email/verify', { email: 'ben@example.ch', code: neon.lastCode('ben@example.ch') });
  // The same answer for a known, an unknown and a malformed address.
  for (const email of ['ben@example.ch', 'nobody@example.ch', 'x']) {
    const asked = await call(passwordResetResponse, '/api/password-reset', { email });
    assert.equal(asked.status, 202); assert.deepEqual(asked.data, { sent: true });
  }
  const code = neon.lastCode('ben@example.ch', 'forget-password');
  assert.match(code, /^\d{6}$/);
  assert.equal(neon.outbox.filter((m) => m.type === 'forget-password').length, 1, 'only the known e-mail account got a mail');
  assert.equal((await call(passwordResetResponse, '/api/password-reset', { email: 'ben@example.ch', code, password: 'kurz' })).data.errorCode, 'INVALID');
  assert.equal((await call(passwordResetResponse, '/api/password-reset', { email: 'nobody@example.ch', code, password: 'neues-passwort-1' })).data.errorCode, 'INVALID_CODE');
  const reset = await call(passwordResetResponse, '/api/password-reset', { email: 'ben@example.ch', code, password: 'neues-passwort-1' });
  assert.equal(reset.status, 200); assert.deepEqual(reset.data, { reset: true });
  assert.equal((await call(passwordResetResponse, '/api/password-reset', { email: 'ben@example.ch', code, password: 'neues-passwort-2' })).data.errorCode, 'INVALID_CODE', 'the code works once');
  assert.equal((await call(loginResponse, '/api/login', { username: 'ben@example.ch', password: 'sicheres-passwort' })).status, 401);
  assert.equal((await call(loginResponse, '/api/login', { username: 'ben@example.ch', password: 'neues-passwort-1' })).status, 200);
});

test('old username accounts are unchanged by the flag: same generated login, same account ID, same save', async () => {
  const off = setup(false);
  const created = await off.register(undefined, 'Oldie');
  const identity = off.store.identities[0];
  // The same store and Neon, now with the flag on.
  const deps = accountDeps(off.store, off.neon, { emailSignup: true });
  const login = await loginResponse(new Request('http://localhost/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'Oldie', password: 'sicheres-passwort' }) }), deps);
  assert.equal(login.status, 200);
  const cookie = sessionCookieFrom(login);
  const profile = await getProfileResponse(new Request('http://localhost/api/profile', { headers: { cookie } }), deps);
  assert.equal(profile.status, 200);
  assert.equal(((await profile.json()) as Body).email, null, 'the generated address is never shown');
  assert.equal(off.store.identities.length, 1); assert.equal(off.store.identities[0].accountId, identity.accountId); assert.equal(off.store.identities[0].method, 'password');
  assert.equal(created.status, 201);
});

test('identity gate (app/auth/identity.ts): only e-mail logins wait for a confirmed address; Google and password logins never do', async () => {
  const store = memoryStore();
  const deps = { store: () => store, listAccounts: async () => [], unlinkAccount: async () => true, now: () => new Date(), newAccountId: () => 'new-account' };
  const session = (subject: string, emailVerified?: boolean): AuthSession => ({ issuer: ISSUER, subject, email: `${subject}@example.ch`, emailVerified, name: '', sessionCookie: 'c=1' });
  for (const [subject, method] of [['s-email', 'email'], ['s-password', 'password'], ['s-google', 'google'], ['s-legacy', 'legacy-google']] as const) store.identities.push({ issuer: ISSUER, subject, accountId: `acc-${subject}`, method, loginEmail: null, deletedAt: null, createdAt: '' });
  assert.equal((await lookupAccount(session('s-email', false), deps)).ok, false);
  assert.equal(((await resolveAccount(session('s-email'), 'http://localhost', deps)) as { errorCode: string }).errorCode, 'EMAIL_UNVERIFIED');
  // Still closed from the identity cache, then open once confirmed.
  assert.equal(((await lookupAccount(session('s-email', false), deps)) as { errorCode: string }).errorCode, 'EMAIL_UNVERIFIED');
  assert.deepEqual(await lookupAccount(session('s-email', true), deps), { ok: true, accountId: 'acc-s-email', method: 'email', created: false });
  for (const subject of ['s-password', 's-google', 's-legacy']) {
    assert.equal((await lookupAccount(session(subject, false), deps)).ok, true, subject);
    assert.equal((await resolveAccount(session(subject, false), 'http://localhost', deps)).ok, true, subject);
  }
});
