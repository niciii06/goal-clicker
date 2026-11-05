import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProfileResponse, deleteProfileResponse, getCloudSaveResponse, getProfileResponse, loginResponse, putCloudSaveResponse, registerResponse, updateProfileResponse, usernameAvailabilityResponse } from '../app/account-api.ts';
import type { AccountApiDeps } from '../app/account-api.ts';
import { cleanCloudSaveKeys, hashText, serializeCloudSaveKeys, summarizeSave } from '../app/cloud-save-rules.ts';
import { adoptOwnUpload, planInitialSync } from '../app/cloud-sync.ts';
import { cleanDisplayName, displayNameError, isPasswordLoginEmail, nextUsernameChangeAt, passwordError, usernameError } from '../app/profile-rules.ts';
import { accountDeps, fakeNeon, ISSUER, memoryStore, sessionCookieFrom } from './helpers/memory-account-store.ts';

const game = (totalGoals: number) => JSON.stringify({ goals: totalGoals, totalGoals, clicks: totalGoals, seasons: 1, stars: 2 });

/** A Google login that is already bound to the game account user-a, and helpers to call the API as it. */
function setup(signedIn = true) {
  const store = memoryStore();
  const neon = fakeNeon();
  let now = new Date('2026-10-01T10:00:00.000Z');
  const deps: AccountApiDeps = { ...accountDeps(store, neon), now: () => now };
  let cookie = '';
  if (signedIn) {
    const login = neon.googleLogin('google-sub-a', 'a@example.com');
    if (!login.ok) throw new Error('login');
    store.identities.push({ issuer: ISSUER, subject: login.subject, accountId: 'user-a', method: 'google', loginEmail: null, deletedAt: null, createdAt: '' });
    cookie = login.sessionCookie;
  }
  const call = async (handler: (request: Request, deps: AccountApiDeps) => Promise<Response>, method = 'GET', body?: unknown, path = '/api/profile', withCookie = cookie) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (withCookie) headers.cookie = withCookie;
    const response = await handler(new Request(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), deps);
    return { status: response.status, response, data: await response.json() as Record<string, unknown> & { profile?: { username: string; displayName: string; nextUsernameChangeAt: string }; errorCode?: string } };
  };
  return { store, neon, deps, call, setNow: (value: string) => { now = new Date(value); } };
}

test('usernames are 3 to 20 plain characters, unique without regard to case, display names are cleaned', () => {
  assert.equal(usernameError('Nico_06'), null);
  assert.match(usernameError('ab')!, /mindestens 3/);
  assert.match(usernameError('Nicolás')!, /ohne Umlaute/);
  assert.match(usernameError('Admin')!, /reserviert/);
  assert.match(usernameError('a'.repeat(21))!, /höchstens 20/);
  assert.equal(cleanDisplayName('  Nico ​  Kräuter\u0007 '), 'Nico Kräuter');
  assert.match(displayNameError(' x ')!, /mindestens 2/);
  assert.match(displayNameError('x'.repeat(19))!, /höchstens 18/);
  assert.equal(nextUsernameChangeAt('2026-10-01T10:00:00.000Z'), '2026-10-31T10:00:00.000Z');
});

test('passwords need 8 to 72 bytes and generated login addresses are recognised', () => {
  assert.match(passwordError('short')!, /mindestens 8/);
  assert.equal(passwordError('lang-genug-1'), null);
  assert.match(passwordError('ä'.repeat(40))!, /höchstens 72/);
  assert.equal(isPasswordLoginEmail('p-1@players.goal-clicker.vercel.app'), true);
  assert.equal(isPasswordLoginEmail('nico@gmail.com'), false);
});

test('registering with username and password creates a Neon login, a new account and its profile', async () => {
  const { call, store, neon } = setup(false);
  assert.deepEqual((await call(usernameAvailabilityResponse, 'GET', undefined, '/api/profile/username?name=Keeper')).data, { available: true });
  assert.equal((await call(registerResponse, 'POST', { username: 'Keeper', displayName: 'Goalie', password: 'short' }, '/api/register')).status, 400);
  const created = await call(registerResponse, 'POST', { username: 'Keeper', displayName: ' Goalie ', password: 'sicheres-passwort' }, '/api/register');
  assert.equal(created.status, 201);
  assert.equal(created.data.profile!.displayName, 'Goalie');
  // The browser is signed in by the answer; the generated address never reaches it.
  assert.ok(sessionCookieFrom(created.response));
  assert.equal(JSON.stringify(created.data).includes('@players.'), false);
  const [user] = [...neon.users.values()];
  assert.equal(isPasswordLoginEmail(user.email), true);
  const [identity] = store.identities;
  assert.equal(identity.subject, user.id);
  assert.equal(identity.loginEmail, user.email);
  // The game account ID is a new ID of its own, not the Neon user ID.
  assert.notEqual(identity.accountId, user.id);
  assert.equal(store.profiles.get(identity.accountId)!.username, 'Keeper');
  const again = await call(registerResponse, 'POST', { username: 'keeper', displayName: 'Zwei', password: 'sicheres-passwort' }, '/api/register');
  assert.equal(again.data.errorCode, 'USERNAME_TAKEN');
  assert.equal(neon.users.size, 1);
  // Signing in with the username works, a wrong password and an unknown name look the same.
  const login = await call(loginResponse, 'POST', { username: 'KEEPER', password: 'sicheres-passwort' }, '/api/login', '');
  assert.equal(login.status, 200);
  assert.ok(sessionCookieFrom(login.response));
  const wrong = await call(loginResponse, 'POST', { username: 'Keeper', password: 'falsches-passwort' }, '/api/login', '');
  const unknown = await call(loginResponse, 'POST', { username: 'nobody', password: 'falsches-passwort' }, '/api/login', '');
  assert.deepEqual([wrong.status, wrong.data], [unknown.status, unknown.data]);
  assert.equal(wrong.status, 401);
});

test('a Google account cannot be signed into with a username and password', async () => {
  const { call } = setup();
  await call(createProfileResponse, 'POST', { username: 'Googler', displayName: 'G' + 'oo' });
  assert.equal((await call(loginResponse, 'POST', { username: 'Googler', password: 'irgendwas-langes' }, '/api/login', '')).status, 401);
});

test('without a login the profile and save API answer 401', async () => {
  const { call } = setup(false);
  assert.equal((await call(getProfileResponse)).data.errorCode, 'LOGIN_REQUIRED');
  assert.equal((await call(getCloudSaveResponse, 'GET', undefined, '/api/save')).status, 401);
});

test('the first login has no profile, then creates one with a unique username', async () => {
  const { call, store } = setup();
  assert.deepEqual((await call(getProfileResponse)).data, { email: 'a@example.com', profile: null });
  // An original account keeps its profile: creating one does nothing.
  assert.equal((await call(createProfileResponse, 'POST', { username: 'ab', displayName: 'Nico' })).status, 400);
  const created = await call(createProfileResponse, 'POST', { username: 'Nico_06', displayName: '  Nico   K ' });
  assert.equal(created.status, 201);
  assert.equal(created.data.profile!.displayName, 'Nico K');
  assert.equal((await call(createProfileResponse, 'POST', { username: 'Other', displayName: 'Nico' })).data.errorCode, 'PROFILE_EXISTS');
  store.profiles.delete('user-a');
  store.profiles.set('user-b', { userId: 'user-b', username: 'Taken', usernameKey: 'taken', displayName: 'B', loginEmail: null, usernameChangedAt: '', createdAt: '', updatedAt: '' });
  assert.equal((await call(createProfileResponse, 'POST', { username: 'TAKEN', displayName: 'Nico' })).data.errorCode, 'USERNAME_TAKEN');
  assert.deepEqual((await call(usernameAvailabilityResponse, 'GET', undefined, '/api/profile/username?name=taken')).data, { available: false, error: 'Dieser Benutzername ist schon vergeben.' });
  assert.deepEqual((await call(usernameAvailabilityResponse, 'GET', undefined, '/api/profile/username?name=free_name')).data, { available: true });
});

test('the username changes at most every 30 days, the display name any time', async () => {
  const { call, setNow } = setup();
  await call(createProfileResponse, 'POST', { username: 'Nico_06', displayName: 'Nico' });
  assert.equal((await call(updateProfileResponse, 'PATCH', { displayName: 'Nicolas' })).data.profile!.displayName, 'Nicolas');
  assert.equal((await call(updateProfileResponse, 'PATCH', { username: 'NICO_06' })).data.profile!.username, 'NICO_06');
  setNow('2026-10-20T10:00:00.000Z');
  assert.equal((await call(updateProfileResponse, 'PATCH', { username: 'NewName' })).data.errorCode, 'USERNAME_TOO_SOON');
  setNow('2026-11-01T10:00:00.000Z');
  const changed = await call(updateProfileResponse, 'PATCH', { username: 'NewName' });
  assert.equal(changed.data.profile!.username, 'NewName');
  assert.equal(changed.data.profile!.nextUsernameChangeAt, '2026-12-01T10:00:00.000Z');
});

test('a rejected profile change changes nothing, not even the display name sent along', async () => {
  const { call, store } = setup();
  await call(createProfileResponse, 'POST', { username: 'Nico_06', displayName: 'Nico' });
  assert.equal((await call(updateProfileResponse, 'PATCH', { displayName: 'Neu', username: '!' })).status, 400);
  assert.equal(store.profiles.get('user-a')!.displayName, 'Nico');
  store.profiles.set('user-b', { userId: 'user-b', username: 'Taken', usernameKey: 'taken', displayName: 'B', loginEmail: null, usernameChangedAt: '', createdAt: '', updatedAt: '' });
  assert.equal((await call(updateProfileResponse, 'PATCH', { displayName: 'Neu', username: 'Taken' })).data.errorCode, 'USERNAME_TAKEN');
  assert.equal(store.profiles.get('user-a')!.displayName, 'Nico');
});

test('a cloud save only replaces the version it was loaded from', async () => {
  const { call } = setup();
  const save = (baseVersion: number, goals: number, active?: boolean) => call(putCloudSaveResponse, 'PUT', { baseVersion, active, keys: { goalClickerSiteSaveV3: game(goals), goalClickerPlayerIdV3: 'never-synced' } }, '/api/save');
  assert.deepEqual((await call(getCloudSaveResponse, 'GET', undefined, '/api/save')).data, { version: 0, updatedAt: null, active: false, activeVersion: 0, keys: null });
  assert.equal((await save(0, 10)).data.version, 1);
  assert.equal((await save(1, 20, false)).data.version, 2);
  // A device that already has version 2 only learns that nothing is newer, without the whole save.
  assert.deepEqual((await call(getCloudSaveResponse, 'GET', undefined, '/api/save?since=2')).data, { version: 2, updatedAt: '2026-10-01T10:00:00.000Z', active: false, activeVersion: 1, keys: null, unchanged: true });
  // A second device still on version 1 gets the newer save back instead of overwriting it.
  const conflict = await save(1, 15);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.data.errorCode, 'SAVE_CONFLICT');
  assert.equal(conflict.data.version, 2);
  assert.equal(conflict.data.active, false);
  // Version 2 only collected passive goals; what was played is still version 1.
  assert.equal(conflict.data.activeVersion, 1);
  assert.deepEqual(conflict.data.keys, { goalClickerSiteSaveV3: game(20) });
  assert.equal((await call(putCloudSaveResponse, 'PUT', { baseVersion: 2, keys: { goalClickerLayoutV3: '[]' } }, '/api/save')).status, 400);
});

test('deleting the profile deletes the game data, locks the login and never claims the login is gone', async () => {
  const { call, store, neon, deps } = setup();
  await call(createProfileResponse, 'POST', { username: 'Nico_06', displayName: 'Nico' });
  await call(putCloudSaveResponse, 'PUT', { baseVersion: 0, keys: { goalClickerSiteSaveV3: game(5) } }, '/api/save');
  assert.equal((await call(deleteProfileResponse, 'DELETE', { confirm: 'someone' })).data.errorCode, 'CONFIRM_REQUIRED');
  assert.equal(store.profiles.size, 1);
  const [subject] = [...neon.users.keys()];
  const cookie = [...neon.sessions.keys()][0];
  // Neon Auth has no self service deletion: a deletion request.
  const requested = await call(deleteProfileResponse, 'DELETE', { confirm: 'nico_06' });
  assert.equal(requested.status, 202);
  assert.deepEqual({ deleted: requested.data.deleted, dataDeleted: requested.data.dataDeleted, loginDeleted: requested.data.loginDeleted }, { deleted: false, dataDeleted: true, loginDeleted: false });
  assert.equal(store.profiles.size + store.saves.size, 0);
  assert.ok(store.identities[0].deletedAt, 'the login is marked and locked');
  assert.equal(neon.sessions.size, 0, 'every session of the login is ended');
  assert.ok(neon.users.has(subject), 'the login itself still exists until the owner removes it');
  // Signing in again: the marked login opens nothing and creates nothing.
  const again = neon.googleLogin('google-sub-a');
  assert.ok(again.ok);
  const lookup = await deps.lookupAccount(neon.session(again.sessionCookie)!);
  assert.equal(!lookup.ok && lookup.errorCode, 'ACCOUNT_DELETION_PENDING');
  // When Neon Auth can delete the login itself, the deletion is complete.
  void cookie;
  store.identities.length = 0;
  const second = setup();
  second.neon.deleteWorks = true;
  await second.call(createProfileResponse, 'POST', { username: 'Zweiter', displayName: 'Zwei' });
  assert.deepEqual((await second.call(deleteProfileResponse, 'DELETE', { confirm: 'zweiter' })).data, { deleted: true, dataDeleted: true, loginDeleted: true });
  assert.equal(second.store.identities.length + second.neon.users.size, 0);
});

test('a device keeps its save when it continues the cloud version, otherwise takes the cloud', () => {
  const local = { goalClickerSiteSaveV3: game(50) };
  const cloud = { version: 4, updatedAt: '2026-10-01T10:00:00.000Z', active: true, keys: { goalClickerSiteSaveV3: game(80) } };
  const hash = hashText(serializeCloudSaveKeys(local));
  const empty = { version: 0, updatedAt: null, active: false, keys: null };
  assert.equal(planInitialSync(null, empty, {}), 'fresh');
  assert.equal(planInitialSync(null, empty, local), 'use-local');
  assert.equal(planInitialSync({ userId: 'u', version: 4, hash: 'older' }, cloud, local), 'use-local');
  assert.equal(planInitialSync(null, cloud, {}), 'use-cloud');
  assert.equal(planInitialSync(null, cloud, { goalClickerSiteSaveV3: JSON.stringify({ goals: 0, totalGoals: 0, clicks: 0, seasons: 0 }) }), 'use-cloud');
  assert.equal(planInitialSync({ userId: 'u', version: 3, hash, played: true }, cloud, local), 'use-cloud');
  // Changed only by passive goals since the last sync: the device takes the newer cloud save.
  assert.equal(planInitialSync({ userId: 'u', version: 3, hash: 'changed-since' }, cloud, local), 'use-cloud');
  // Signing in is required, so the profile's save wins without asking, even when this device was played.
  assert.equal(planInitialSync({ userId: 'u', version: 3, hash: 'changed-since', played: true }, cloud, local), 'use-cloud');
  // Only a cloud save that merely collected passive goals gives way to a device that was played.
  assert.equal(planInitialSync({ userId: 'u', version: 3, hash: 'changed-since', played: true }, { ...cloud, active: false }, local), 'keep-local');
  // A device that played once and then only collected passive goals still protects what was played there.
  const playedThenPassive = { ...cloud, version: 5, active: false, activeVersion: 4 };
  assert.equal(planInitialSync({ userId: 'u', version: 3, hash: 'changed-since', played: true }, playedThenPassive, local), 'use-cloud');
  assert.equal(planInitialSync({ userId: 'u', version: 4, hash: 'changed-since', played: true }, playedThenPassive, local), 'keep-local');
  // A guest's save with progress meets an account save with progress: the player chooses (L11), nothing is replaced.
  assert.equal(planInitialSync(null, cloud, local), 'choose');
  assert.equal(planInitialSync(null, cloud, { ...cloud.keys }), 'use-cloud');
  // An upload sent while the page closed went through without an answer: the device recognises its own save
  // and simply continues, instead of mistaking it for another device's save.
  const sent = hashText(serializeCloudSaveKeys(cloud.keys!));
  const own = adoptOwnUpload({ userId: 'u', version: 3, hash: 'older', played: true, pending: [sent] }, cloud);
  assert.deepEqual(own, { userId: 'u', version: cloud.version, hash: sent, played: true });
  assert.equal(planInitialSync(own, cloud, local), 'use-local');
  // A retry with newer progress does not forget the earlier upload that the cloud may already hold.
  assert.deepEqual(adoptOwnUpload({ userId: 'u', version: 3, hash: 'older', played: true, pending: [sent, 'newer-progress'] }, cloud), own);
  assert.equal(adoptOwnUpload({ userId: 'u', version: 3, hash: 'older', pending: ['something-else'] }, cloud), null);
  assert.equal(adoptOwnUpload({ userId: 'u', version: 3, hash: 'older' }, cloud), null);
});

test('only the game, layout and vibration keys travel to the cloud', () => {
  assert.deepEqual(cleanCloudSaveKeys({ goalClickerSiteSaveV3: game(1), goalClickerLayoutV3: '[]', goalClickerPlayerIdV3: 'id', other: 'x' }), { goalClickerSiteSaveV3: game(1), goalClickerLayoutV3: '[]' });
  assert.equal(cleanCloudSaveKeys({ goalClickerSiteSaveV3: '{broken' }), null);
  assert.deepEqual(summarizeSave({ goalClickerSiteSaveV3: game(7) }), { totalGoals: 7, seasons: 1, stars: 2, clicks: 7 });
});

test('a registration whose profile fails to save locks its new login and leaves no session', async () => {
  const { call, store, neon } = setup(false);
  store.createProfile = async () => { throw new Error('database gone for a moment'); };
  const response = await call(registerResponse, 'POST', { username: 'Keeper', displayName: 'Goalie', password: 'sicheres-passwort' }, '/api/register');
  assert.equal(response.status, 503);
  assert.equal(sessionCookieFrom(response.response), '');
  // Neon Auth cannot delete it: the half made login is locked for the owner's deletion and has no session left.
  assert.equal(store.identities.length, 1);
  assert.ok(store.identities[0].deletedAt);
  assert.equal(neon.sessions.size, 0);
  assert.equal(store.profiles.size, 0);
});

test('a deleted login cannot create a profile or a first cloud save with its old cookie', async () => {
  const { call, store, neon } = setup();
  // Neon Auth no longer knows the session (deleted or revoked user).
  neon.sessions.clear();
  assert.equal((await call(createProfileResponse, 'POST', { username: 'Nico_06', displayName: 'Nico' })).status, 401);
  assert.equal((await call(putCloudSaveResponse, 'PUT', { baseVersion: 0, keys: { goalClickerSiteSaveV3: game(5) } }, '/api/save')).status, 401);
  assert.equal(store.profiles.size + store.saves.size, 0);
});

test('state changing account calls from another site are refused', async () => {
  const { deps, store } = setup();
  const response = await createProfileResponse(new Request('http://localhost/api/profile', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ username: 'Evil_1', displayName: 'Evil' }) }), deps);
  assert.equal(response.status, 403);
  assert.equal(store.profiles.size, 0);
});
