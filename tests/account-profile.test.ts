import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createProfileResponse, deleteProfileResponse, getCloudSaveResponse, getProfileResponse, loginEmailResponse, putCloudSaveResponse, registerResponse, updateProfileResponse, usernameAvailabilityResponse } from '../app/account-api.ts';
import type { AccountApiDeps } from '../app/account-api.ts';
import { cleanCloudSaveKeys, hashText, serializeCloudSaveKeys, summarizeSave } from '../app/cloud-save-rules.ts';
import { adoptOwnUpload, planInitialSync } from '../app/cloud-sync.ts';
import { cleanDisplayName, displayNameError, isPasswordLoginEmail, nextUsernameChangeAt, passwordError, usernameError } from '../app/profile-rules.ts';
import type { CloudSave, Profile } from '../db/index.ts';

const ENV_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
let savedEnv: Record<string, string | undefined> = {};
beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example-project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
});
afterEach(() => {
  for (const key of ENV_KEYS) if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
});

const game = (totalGoals: number) => JSON.stringify({ goals: totalGoals, totalGoals, clicks: totalGoals, seasons: 1, stars: 2 });

/** An in-memory store with the same rules as the PostgreSQL methods. */
function memoryStore() {
  const profiles = new Map<string, Profile>();
  const saves = new Map<string, CloudSave>();
  const logins = new Map<string, { email: string; password: string }>();
  let nextLogin = 0;
  return {
    profiles, saves, logins,
    getProfile: async (userId: string) => profiles.get(userId) ?? null,
    getProfileByUsername: async (key: string) => [...profiles.values()].find((p) => p.usernameKey === key) ?? null,
    createPasswordLogin: async (email: string, password: string) => {
      const id = `00000000-0000-4000-8000-${String(++nextLogin).padStart(12, '0')}`;
      logins.set(id, { email, password });
      return id;
    },
    deleteLogin: async (userId: string) => logins.delete(userId),
    isUsernameTaken: async (key: string, except?: string) => [...profiles.values()].some((p) => p.usernameKey === key && p.userId !== except),
    createProfile: async (userId: string, username: string, displayName: string, now: string, loginEmail: string | null = null) => {
      if ([...profiles.values()].some((p) => p.usernameKey === username.toLowerCase())) return { reason: 'taken' as const };
      if (profiles.has(userId)) return { reason: 'exists' as const };
      const profile = { userId, username, usernameKey: username.toLowerCase(), displayName, loginEmail, usernameChangedAt: now, createdAt: now, updatedAt: now };
      profiles.set(userId, profile);
      return { profile };
    },
    updateDisplayName: async (userId: string, displayName: string) => { const p = profiles.get(userId); if (p) p.displayName = displayName; return p ?? null; },
    changeUsername: async (userId: string, username: string, now: string, cutoff: string) => {
      const p = profiles.get(userId);
      if (!p) return { reason: 'missing' as const };
      if (p.usernameKey === username.toLowerCase()) { p.username = username; return { profile: p }; }
      if ([...profiles.values()].some((o) => o.usernameKey === username.toLowerCase())) return { reason: 'taken' as const };
      if (p.usernameChangedAt > cutoff) return { reason: 'too-soon' as const };
      Object.assign(p, { username, usernameKey: username.toLowerCase(), usernameChangedAt: now });
      return { profile: p };
    },
    getCloudSave: async (userId: string) => saves.get(userId) ?? null,
    putCloudSave: async (userId: string, saveJson: string, baseVersion: number, now: string, active = true) => {
      const current = saves.get(userId);
      if ((current?.version ?? 0) !== baseVersion) return { conflict: current ?? null };
      const save = { userId, saveJson, version: baseVersion + 1, active, activeVersion: active ? baseVersion + 1 : current?.activeVersion ?? 0, updatedAt: now };
      saves.set(userId, save);
      return { save };
    },
    deleteAccount: async (userId: string) => { profiles.delete(userId); saves.delete(userId); return { loginDeleted: true }; },
  };
}

function setup(user: { id: string; email: string | null } | null = { id: 'user-a', email: 'a@example.com' }) {
  const store = memoryStore();
  let now = new Date('2026-10-01T10:00:00.000Z');
  const deps: AccountApiDeps = { getUser: async () => user, db: () => store, now: () => now, signUp: async () => { throw new Error('the database creates the logins in these tests'); } };
  const call = async (handler: (request: Request, deps: AccountApiDeps) => Promise<Response>, method = 'GET', body?: unknown, path = '/api/profile') => {
    const response = await handler(new Request(`http://localhost${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }), deps);
    return { status: response.status, data: await response.json() as Record<string, unknown> & { profile?: { username: string; displayName: string; nextUsernameChangeAt: string }; errorCode?: string } };
  };
  return { store, call, setNow: (value: string) => { now = new Date(value); } };
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

test('registering with username and password creates login and profile, the username leads to the login', async () => {
  const { call, store } = setup(null);
  assert.deepEqual((await call(usernameAvailabilityResponse, 'GET', undefined, '/api/profile/username?name=Keeper')).data, { available: true });
  assert.equal((await call(registerResponse, 'POST', { username: 'Keeper', displayName: 'Goalie', password: 'short' }, '/api/register')).status, 400);
  const created = await call(registerResponse, 'POST', { username: 'Keeper', displayName: ' Goalie ', password: 'sicheres-passwort' }, '/api/register');
  assert.equal(created.status, 201);
  assert.equal(created.data.profile!.displayName, 'Goalie');
  const email = created.data.email as string;
  assert.equal(isPasswordLoginEmail(email), true);
  assert.deepEqual([...store.logins.values()], [{ email, password: 'sicheres-passwort' }]);
  // The generated address is only handed out for the username, and never with the profile.
  assert.deepEqual((await call(loginEmailResponse, 'POST', { username: 'KEEPER' }, '/api/login')).data, { email });
  assert.equal((await call(loginEmailResponse, 'POST', { username: 'nobody' }, '/api/login')).status, 404);
  assert.equal(JSON.stringify(created.data.profile).includes(email), false);
  const again = await call(registerResponse, 'POST', { username: 'keeper', displayName: 'Zwei', password: 'sicheres-passwort' }, '/api/register');
  assert.equal(again.data.errorCode, 'USERNAME_TAKEN');
  assert.equal(store.logins.size, 1);
});

test('a Google account has no login address behind its username', async () => {
  const { call } = setup();
  await call(createProfileResponse, 'POST', { username: 'Googler', displayName: 'G' + 'oo' });
  assert.equal((await call(loginEmailResponse, 'POST', { username: 'Googler' }, '/api/login')).status, 404);
});

test('without a login the profile and save API answer 401', async () => {
  const { call } = setup(null);
  assert.equal((await call(getProfileResponse)).data.errorCode, 'LOGIN_REQUIRED');
  assert.equal((await call(getCloudSaveResponse, 'GET', undefined, '/api/save')).status, 401);
});

test('the first login has no profile, then creates one with a unique username', async () => {
  const { call, store } = setup();
  assert.deepEqual((await call(getProfileResponse)).data, { email: 'a@example.com', profile: null });
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

test('deleting the profile needs the username as confirmation', async () => {
  const { call, store } = setup();
  await call(createProfileResponse, 'POST', { username: 'Nico_06', displayName: 'Nico' });
  assert.equal((await call(deleteProfileResponse, 'DELETE', { confirm: 'someone' })).data.errorCode, 'CONFIRM_REQUIRED');
  assert.deepEqual((await call(deleteProfileResponse, 'DELETE', { confirm: 'nico_06' })).data, { deleted: true, loginDeleted: true });
  assert.equal(store.profiles.size, 0);
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
  assert.equal(planInitialSync(null, cloud, local), 'use-cloud');
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

test('a registration whose profile fails to save removes its new login again', async () => {
  const { call, store } = setup(null);
  store.createProfile = async () => { throw new Error('database gone for a moment'); };
  const response = await call(registerResponse, 'POST', { username: 'Keeper', displayName: 'Goalie', password: 'sicheres-passwort' }, '/api/register');
  assert.equal(response.status, 503);
  assert.equal(store.logins.size, 0);
});

test('a deleted account cannot create a profile or a first cloud save with its old token', async () => {
  const store = memoryStore();
  let exists = true;
  const deps: AccountApiDeps = { getUser: async () => ({ id: 'user-a', email: 'a@example.com' }), db: () => store, now: () => new Date('2026-10-01T10:00:00.000Z'), signUp: async () => null, loginExists: async () => exists };
  const send = async (handler: (request: Request, deps: AccountApiDeps) => Promise<Response>, method: string, body: unknown, path = '/api/profile') => (await handler(new Request(`http://localhost${path}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), deps)).status;
  exists = false;
  assert.equal(await send(createProfileResponse, 'POST', { username: 'Nico_06', displayName: 'Nico' }), 401);
  assert.equal(await send(putCloudSaveResponse, 'PUT', { baseVersion: 0, keys: { goalClickerSiteSaveV3: game(5) } }, '/api/save'), 401);
  assert.equal(store.profiles.size + store.saves.size, 0);
  exists = true;
  assert.equal(await send(createProfileResponse, 'POST', { username: 'Nico_06', displayName: 'Nico' }), 201);
});
