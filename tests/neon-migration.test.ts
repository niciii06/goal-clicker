// The Neon Auth migration: every original account is reopened by a verified proof, never by an e-mail address, a
// username or a known player ID, and nothing of its game data changes. Runs against the in-memory store and a
// stand-in for Neon Auth (tests/helpers/memory-account-store.ts); tests/db-postgres.test.ts runs the same
// binding and recovery rules against PostgreSQL.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { getCloudSaveResponse, getProfileResponse, hashRecoveryCode, loginResponse, recoveryCodeResponse } from '../app/account-api.ts';
import { authConfigProblem, authIssuer, authMode } from '../app/auth/config.ts';
import { checkGoogleLinks, clearIdentityCacheForTests, resolveAccount } from '../app/auth/identity.ts';
import type { IdentityDeps } from '../app/auth/identity.ts';
import { accountDeps, call, fakeNeon, ISSUER, memoryStore, sessionCookieFrom } from './helpers/memory-account-store.ts';
import type { FakeNeon, MemoryStore } from './helpers/memory-account-store.ts';

const game = (totalGoals: number) => JSON.stringify({ goals: totalGoals, totalGoals, clicks: totalGoals, seasons: 3, stars: 4 });
const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** The nine original accounts in the shape they have in the copied database: 3 Google, 6 username accounts. */
function legacyFixture() {
  const store = memoryStore();
  const passwords: Record<string, { userId: string; password: string }> = {};
  const accounts: { id: string; kind: 'google' | 'email'; sub?: string; username: string; password?: string; loginEmail?: string }[] = [];
  for (let i = 1; i <= 9; i++) {
    const id = uuid(i);
    const google = i <= 3;
    const username = google ? `GoogleFan${i}` : `Spieler_${i}`;
    const loginEmail = google ? undefined : `p-legacy-${i}@players.goal-clicker.vercel.app`;
    const password = google ? undefined : `altes-passwort-${i}`;
    store.profiles.set(id, { userId: id, username, usernameKey: username.toLowerCase(), displayName: `Name ${i}`, loginEmail: loginEmail ?? null, usernameChangedAt: '2026-08-20T10:00:00.000Z', createdAt: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-20T10:00:00.000Z' });
    store.saves.set(id, { userId: id, saveJson: JSON.stringify({ goalClickerSiteSaveV3: game(1000 * i) }), version: 10 + i, active: true, activeVersion: 10 + i, updatedAt: '2026-10-30T10:00:00.000Z' });
    store.playerLinks.set(id, `player-original-${i}`);
    const sub = google ? `11398328434823460${i}` : undefined;
    store.legacy.push({ provider: google ? 'google' : 'email', providerSubject: google ? sub! : id, accountId: id, importedAt: '' });
    if (!google) passwords[loginEmail!] = { userId: id, password: password! };
    accounts.push({ id, kind: google ? 'google' : 'email', sub, username, password, loginEmail });
  }
  return { store, passwords, accounts };
}

function identityDeps(store: MemoryStore, neon: FakeNeon): IdentityDeps {
  let ids = 0;
  return { store: () => store, listAccounts: (session) => neon.listAccounts(session), unlinkAccount: (session, origin, providerId) => neon.unlink(session, origin, providerId), now: () => new Date('2026-11-02T10:00:00.000Z'), newAccountId: () => uuid(500 + ++ids) };
}

const snapshot = (store: MemoryStore) => JSON.stringify({ profiles: [...store.profiles], saves: [...store.saves], links: [...store.playerLinks] });

beforeEach(() => clearIdentityCacheForTests());

test('the three Google accounts are recovered by the Google subject Neon Auth verified, nothing else changes', async () => {
  const { store, accounts } = legacyFixture();
  const neon = fakeNeon();
  const before = snapshot(store);
  for (const account of accounts.filter((a) => a.kind === 'google')) {
    const login = neon.googleLogin(account.sub!);
    assert.ok(login.ok);
    const result = await resolveAccount(neon.session(login.sessionCookie)!, 'http://localhost', identityDeps(store, neon));
    assert.deepEqual(result, { ok: true, accountId: account.id, method: 'legacy-google', created: false });
    // The Neon user ID is the login, never the account.
    assert.notEqual(login.subject, account.id);
  }
  assert.equal(store.identities.length, 3);
  assert.equal(snapshot(store), before);
});

test('a second Neon login can never take an original Google account that is already recovered', async () => {
  const { store, accounts } = legacyFixture();
  const neon = fakeNeon();
  const google = accounts[0];
  const first = neon.googleLogin(google.sub!);
  assert.ok(first.ok);
  assert.equal((await resolveAccount(neon.session(first.sessionCookie)!, 'o', identityDeps(store, neon))).ok, true);
  // Another Neon user claiming the same Google subject (it cannot happen in Neon, the mapping still refuses it).
  neon.users.set('neon-intruder', { id: 'neon-intruder', email: 'x@example.com', password: null, name: '', google: google.sub! });
  neon.sessions.set('intruder-token', 'neon-intruder');
  const result = await resolveAccount(neon.session('__Secure-neon-auth.session_token=intruder-token')!, 'o', identityDeps(store, neon));
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.errorCode, 'ACCOUNT_ALREADY_CLAIMED');
  assert.equal(store.identities.length, 1);
});

test('an e-mail address, a username or a player ID is never proof: an unbound password login gets no account', async () => {
  const { store, accounts } = legacyFixture();
  const neon = fakeNeon();
  // Someone creates a Neon login with the address of an original Google player and with an original username.
  const attack = await neon.signUp(`${accounts[0].sub}@gmail.example`, 'angreifer-passwort', accounts[0].username);
  assert.ok(attack.ok);
  const result = await resolveAccount(neon.session(attack.sessionCookie)!, 'o', identityDeps(store, neon));
  assert.equal(!result.ok && result.errorCode, 'IDENTITY_UNBOUND');
  // Even with Google added to that login afterwards, the mixed login is refused instead of bound.
  neon.users.get(attack.subject)!.google = accounts[0].sub!;
  const mixed = await resolveAccount(neon.session(attack.sessionCookie)!, 'o', identityDeps(store, neon));
  assert.equal(!mixed.ok && mixed.errorCode, 'IDENTITY_UNBOUND');
  assert.equal(store.identities.length, 0);
});

test('a new Google player gets a new empty account with its own ID; a failed lookup creates nothing', async () => {
  const { store } = legacyFixture();
  const neon = fakeNeon();
  const login = neon.googleLogin('999999999999');
  assert.ok(login.ok);
  const session = neon.session(login.sessionCookie)!;
  const deps = identityDeps(store, neon);
  const broken = { ...deps, listAccounts: async () => { throw new Error('Neon Auth down'); } };
  await assert.rejects(resolveAccount(session, 'o', broken));
  assert.equal(store.identities.length, 0);
  const created = await resolveAccount(session, 'o', deps);
  assert.equal(created.ok && created.created, true);
  assert.equal(created.ok && created.accountId, uuid(501));
  assert.equal(store.profiles.has(uuid(501)), false);
  // Concurrent first requests of the same login end in one account.
  const again = await Promise.all(Array.from({ length: 5 }, () => resolveAccount(session, 'o', deps)));
  assert.ok(again.every((r) => r.ok && r.accountId === uuid(501)));
  assert.equal(store.identities.length, 1);
});

test('all six username accounts are recovered by logging in with the old password, nothing else changes', async () => {
  const { store, passwords, accounts } = legacyFixture();
  const neon = fakeNeon();
  const deps = accountDeps(store, neon, { legacy: passwords });
  const before = snapshot(store);
  for (const account of accounts.filter((a) => a.kind === 'email')) {
    const response = await call(loginResponse, deps, 'POST', '/api/login', { username: account.username, password: account.password });
    assert.equal(response.status, 200, account.username);
    assert.deepEqual(await response.json(), { signedIn: true, recovered: true });
    const cookie = sessionCookieFrom(response);
    // The new session opens exactly the original profile and save.
    const profile = await (await call(getProfileResponse, deps, 'GET', '/api/profile', undefined, cookie)).json() as { profile: { username: string } };
    assert.equal(profile.profile.username, account.username);
    const save = await (await call(getCloudSaveResponse, deps, 'GET', '/api/save', undefined, cookie)).json() as { version: number };
    assert.equal(save.version, store.saves.get(account.id)!.version);
    // The second login is a normal Neon sign in with the same password.
    const second = await call(loginResponse, deps, 'POST', '/api/login', { username: account.username, password: account.password });
    assert.deepEqual(await second.json(), { signedIn: true });
  }
  assert.equal(store.identities.length, 6);
  assert.ok(store.identities.every((identity) => identity.method === 'legacy-password' && identity.loginEmail?.endsWith('@players.goal-clicker.vercel.app')));
  assert.equal(snapshot(store), before);
});

test('a wrong old password, a password of another account or a Google account recover nothing', async () => {
  const { store, passwords, accounts } = legacyFixture();
  const neon = fakeNeon();
  const deps = accountDeps(store, neon, { legacy: passwords });
  const [a, b] = accounts.filter((x) => x.kind === 'email');
  assert.equal((await call(loginResponse, deps, 'POST', '/api/login', { username: a.username, password: 'falsch-falsch' })).status, 401);
  assert.equal((await call(loginResponse, deps, 'POST', '/api/login', { username: a.username, password: b.password })).status, 401);
  // A proof for another account (Supabase answers with B's ID for A's address) is refused.
  passwords[a.loginEmail!] = { userId: b.id, password: 'passt-aber-falsches-konto' };
  assert.equal((await call(loginResponse, deps, 'POST', '/api/login', { username: a.username, password: 'passt-aber-falsches-konto' })).status, 401);
  assert.equal((await call(loginResponse, deps, 'POST', '/api/login', { username: accounts[0].username, password: 'irgendein-passwort' })).status, 401);
  assert.equal(neon.users.size, 0);
  assert.equal(store.identities.length + store.recovery.length, 0);
});

test('with the old login service unavailable the recovery is reported as blocked and creates nothing', async () => {
  const { store, passwords, accounts } = legacyFixture();
  const neon = fakeNeon();
  const account = accounts.find((a) => a.kind === 'email')!;
  const down = await call(loginResponse, accountDeps(store, neon, { legacy: passwords, legacyDown: () => true }), 'POST', '/api/login', { username: account.username, password: account.password });
  assert.equal(down.status, 503);
  assert.equal(((await down.json()) as { errorCode: string }).errorCode, 'RECOVERY_UNAVAILABLE');
  const off = await call(loginResponse, accountDeps(store, neon), 'POST', '/api/login', { username: account.username, password: account.password });
  assert.equal(off.status, 503);
  assert.equal(neon.users.size, 0);
  assert.equal(store.identities.length, 0);
});

test('ten concurrent recoveries of one account create one login and bind it once', async () => {
  const { store, passwords, accounts } = legacyFixture();
  const neon = fakeNeon();
  const deps = accountDeps(store, neon, { legacy: passwords });
  const account = accounts.find((a) => a.kind === 'email')!;
  const responses = await Promise.all(Array.from({ length: 10 }, () => call(loginResponse, deps, 'POST', '/api/login', { username: account.username, password: account.password })));
  assert.ok(responses.every((r) => r.status === 200), JSON.stringify(responses.map((r) => r.status)));
  assert.equal(neon.users.size, 1);
  assert.equal(store.identities.length, 1);
  assert.equal(store.identities[0].accountId, account.id);
});

test('a recovery that failed half way is finished by the retry with the same new login', async () => {
  const { store, passwords, accounts } = legacyFixture();
  const neon = fakeNeon();
  const deps = accountDeps(store, neon, { legacy: passwords });
  const account = accounts.find((a) => a.kind === 'email')!;
  // 1. Neon Auth refuses the sign up once.
  neon.failSignUps = 1;
  assert.equal((await call(loginResponse, deps, 'POST', '/api/login', { username: account.username, password: account.password })).status, 503);
  // 2. The login is created, but binding fails (database gone for a moment).
  const complete = store.completeRecovery;
  store.completeRecovery = async () => { throw new Error('database gone'); };
  assert.equal((await call(loginResponse, deps, 'POST', '/api/login', { username: account.username, password: account.password })).status, 503);
  assert.equal(neon.users.size, 1);
  assert.equal(store.identities.length, 0);
  // No session of the unbound login is left behind.
  assert.equal(neon.sessions.size, 0);
  store.completeRecovery = complete;
  // 3. The retry signs in to the login of step 2 instead of creating another one, and binds it.
  const retry = await call(loginResponse, deps, 'POST', '/api/login', { username: account.username, password: account.password });
  assert.equal(retry.status, 200);
  assert.equal(neon.users.size, 1);
  assert.equal(store.identities.length, 1);
  assert.equal(store.identities[0].subject, [...neon.users.keys()][0]);
});

test('a consumed or expired claim cannot be replayed to bind another login', async () => {
  const { store, passwords, accounts } = legacyFixture();
  const neon = fakeNeon();
  let now = new Date('2026-11-02T10:00:00.000Z');
  const deps = accountDeps(store, neon, { legacy: passwords, now: () => now });
  const account = accounts.find((a) => a.kind === 'email')!;
  assert.equal((await call(loginResponse, deps, 'POST', '/api/login', { username: account.username, password: account.password })).status, 200);
  const claim = store.recovery[0];
  // Replaying the consumed claim with another Neon login is refused.
  const other = await neon.signUp('p-other@players.goal-clicker.vercel.app', 'x-passwort-1', 'x');
  assert.ok(other.ok);
  const replay = await store.completeRecovery({ accountId: account.id, issuer: ISSUER, subject: other.subject, loginEmail: claim.destinationEmail, method: 'legacy-password', now: now.toISOString() });
  assert.deepEqual(replay, { ok: false, reason: 'consumed-by-other' });
  // A claim window that ran out is refused as well.
  const second = accounts.filter((a) => a.kind === 'email')[1];
  await store.openRecoveryClaim({ accountId: second.id, issuer: ISSUER, method: 'legacy-password', destinationEmail: 'p-x@players.goal-clicker.vercel.app', claimExpiresAt: '2026-11-02T10:05:00.000Z', now: now.toISOString() });
  now = new Date('2026-11-02T10:06:00.000Z');
  const expired = await store.completeRecovery({ accountId: second.id, issuer: ISSUER, subject: other.subject, loginEmail: 'p-x@players.goal-clicker.vercel.app', method: 'legacy-password', now: now.toISOString() });
  assert.deepEqual(expired, { ok: false, reason: 'expired' });
  assert.equal(store.identities.length, 1);
});

test('an owner code recovers exactly its account, once, with a new password', async () => {
  const { store, accounts } = legacyFixture();
  const neon = fakeNeon();
  const deps = accountDeps(store, neon);
  const [a, b] = accounts.filter((x) => x.kind === 'email');
  const code = 'ABCD-EFGH-JKLM-NPQR-STUV';
  store.codes.push({ codeHash: hashRecoveryCode(code), accountId: a.id, issuer: ISSUER, expiresAt: '2026-11-03T10:00:00.000Z', usedAt: null, createdAt: '' });
  // The code of A does not open B, and a wrong code opens nothing.
  assert.equal((await call(recoveryCodeResponse, deps, 'POST', '/api/recovery', { username: b.username, code, password: 'neues-passwort-1' })).status, 401);
  assert.equal((await call(recoveryCodeResponse, deps, 'POST', '/api/recovery', { username: a.username, code: 'WXYZ-WXYZ-WXYZ-WXYZ-WXYZ', password: 'neues-passwort-1' })).status, 401);
  const ok = await call(recoveryCodeResponse, deps, 'POST', '/api/recovery', { username: a.username, code: code.toLowerCase(), password: 'neues-passwort-1' });
  assert.equal(ok.status, 200);
  assert.equal(store.identities[0].accountId, a.id);
  assert.ok(store.codes[0].usedAt);
  // Used up: a second use is refused, the new password works for the normal login.
  assert.equal((await call(recoveryCodeResponse, deps, 'POST', '/api/recovery', { username: a.username, code, password: 'anderes-passwort-2' })).status, 401);
  assert.equal((await call(loginResponse, deps, 'POST', '/api/login', { username: a.username, password: 'neues-passwort-1' })).status, 200);
  // An expired code is refused.
  store.codes.push({ codeHash: hashRecoveryCode('OLDC-OLDC-OLDC-OLDC-OLDC'), accountId: b.id, issuer: ISSUER, expiresAt: '2026-11-01T10:00:00.000Z', usedAt: null, createdAt: '' });
  assert.equal((await call(recoveryCodeResponse, deps, 'POST', '/api/recovery', { username: b.username, code: 'OLDC-OLDC-OLDC-OLDC-OLDC', password: 'neues-passwort-1' })).status, 401);
  assert.equal(store.identities.length, 1);
});

test('linking the old Google login of another original account is undone and reported as taken', async () => {
  const { store, passwords, accounts } = legacyFixture();
  const neon = fakeNeon();
  const deps = accountDeps(store, neon, { legacy: passwords });
  const user = accounts.find((a) => a.kind === 'email')!;
  const response = await call(loginResponse, deps, 'POST', '/api/login', { username: user.username, password: user.password });
  const session = neon.session(sessionCookieFrom(response))!;
  // The player links Google, and that Google login is the one of original account 1.
  neon.users.get(session.subject)!.google = accounts[0].sub!;
  assert.equal(await checkGoogleLinks(session, user.id, 'o', identityDeps(store, neon)), 'conflict');
  assert.equal(neon.users.get(session.subject)!.google, null);
  // An unrelated Google login stays linked.
  neon.users.get(session.subject)!.google = '55555';
  assert.equal(await checkGoogleLinks(session, user.id, 'o', identityDeps(store, neon)), 'linked');
});

test('one account can never read or write the save of another', async () => {
  const { store, passwords, accounts } = legacyFixture();
  const neon = fakeNeon();
  const deps = accountDeps(store, neon, { legacy: passwords });
  const [a, b] = accounts.filter((x) => x.kind === 'email');
  const cookieA = sessionCookieFrom(await call(loginResponse, deps, 'POST', '/api/login', { username: a.username, password: a.password }));
  const save = await (await call(getCloudSaveResponse, deps, 'GET', '/api/save', undefined, cookieA)).json() as { keys: Record<string, string> };
  assert.equal(save.keys.goalClickerSiteSaveV3, game(1000 * Number(a.id.slice(-2))));
  assert.notEqual(save.keys.goalClickerSiteSaveV3, JSON.parse(store.saves.get(b.id)!.saveJson).goalClickerSiteSaveV3);
  // A made up session or none at all reads nothing.
  assert.equal((await call(getCloudSaveResponse, deps, 'GET', '/api/save', undefined, '__Secure-neon-auth.session_token=forged')).status, 401);
  assert.equal((await call(getCloudSaveResponse, deps, 'GET', '/api/save')).status, 401);
});

const ENV = ['NEON_AUTH_BASE_URL', 'NEON_AUTH_COOKIE_SECRET', 'NETLIFY', 'VERCEL', 'SITE_ID', 'DEPLOY_ID', 'AWS_LAMBDA_FUNCTION_NAME', 'NETLIFY_FUNCTIONS_TOKEN', 'GOAL_CLICKER_HOSTED_BUILD', 'AUTH_REQUIRED'];
let savedEnv: Record<string, string | undefined> = {};
function clearEnv() {
  savedEnv = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
  for (const key of ENV) delete process.env[key];
}
afterEach(() => {
  for (const key of ENV) if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
  savedEnv = {};
});

test('missing or invalid auth configuration fails closed on a host and is never anonymous there', () => {
  clearEnv();
  assert.equal(authMode(), 'anonymous');
  for (const host of ['NETLIFY', 'SITE_ID', 'AWS_LAMBDA_FUNCTION_NAME', 'VERCEL', 'GOAL_CLICKER_HOSTED_BUILD']) {
    process.env[host] = host === 'GOAL_CLICKER_HOSTED_BUILD' ? '1' : 'true';
    assert.equal(authMode(), 'misconfigured', host);
    delete process.env[host];
  }
  // A partial or broken configuration is misconfigured even on a developer machine.
  process.env.NEON_AUTH_BASE_URL = 'https://ep-x.neonauth.example/neondb/auth/';
  assert.equal(authMode(), 'misconfigured');
  process.env.NEON_AUTH_COOKIE_SECRET = 'too-short';
  assert.match(authConfigProblem()!, /32 Zeichen/);
  assert.equal(authMode(), 'misconfigured');
  process.env.NEON_AUTH_COOKIE_SECRET = 'x'.repeat(32);
  assert.equal(authMode(), 'neon');
  assert.equal(authIssuer(), 'https://ep-x.neonauth.example/neondb/auth');
  process.env.NEON_AUTH_BASE_URL = 'http://ep-x.neonauth.example/neondb/auth';
  assert.equal(authMode(), 'misconfigured');
  process.env.NEON_AUTH_BASE_URL = 'not a url';
  assert.equal(authMode(), 'misconfigured');
  process.env.NEON_AUTH_BASE_URL = 'http://localhost:4010/auth';
  assert.equal(authMode(), 'neon');
  process.env.NETLIFY = 'true';
  assert.equal(authMode(), 'misconfigured');
});
