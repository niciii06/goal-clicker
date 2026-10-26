// Saving, importing, resetting and loading from the cloud when storage misbehaves (memory localStorage).
import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map<string, string>();
let failWritesFor: ((key: string, value: string) => boolean) | null = null;
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { if (failWritesFor?.(k, String(v))) throw new DOMException('Quota exceeded', 'QuotaExceededError'); store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  },
});
const { STORAGE_KEY, BACKUP_STORAGE_KEY, RECOVERY_STORAGE_KEY, LEGACY_STORAGE_KEYS } = await import('../app/game/constants.ts');
const { clearStoredGames, initialGame, persistLocalGame, readStoredGame, resumeLocalPersistence, suspendLocalPersistence } = await import('../app/game/storage.ts');
const { applySaveFile, parseSaveFile } = await import('../app/save-file.ts');
const { applyCloudSave } = await import('../app/cloud-sync.ts');
const { shouldRejectRegressedSave } = await import('../app/save-safety.ts');

const game = (totalGoals: number, extra: Record<string, unknown> = {}) => ({ ...initialGame(), goals: totalGoals, totalGoals, clicks: totalGoals, ...extra });
const goalsIn = (key: string) => (JSON.parse(store.get(key) ?? 'null') as { totalGoals?: number } | null)?.totalGoals;

test('a failed import puts the previous game back and keeps saving afterwards', () => {
  store.clear(); failWritesFor = null;
  persistLocalGame(game(100));
  const file = parseSaveFile(JSON.stringify({ format: 'goal-clicker-save', version: 1, exportedAt: '', origin: '', keys: { [STORAGE_KEY]: JSON.stringify(game(999)) } }));
  assert.ok(file.ok);
  // The import starts, storage is full.
  suspendLocalPersistence();
  failWritesFor = (key, value) => key === STORAGE_KEY && value.includes('"totalGoals":999');
  assert.throws(() => applySaveFile(localStorage, file.file));
  failWritesFor = null;
  resumeLocalPersistence();
  assert.equal(goalsIn(STORAGE_KEY), 100, 'previous game is back');
  persistLocalGame(game(300));
  assert.equal(goalsIn(STORAGE_KEY), 300, 'and saving works again');
});

test('a save file whose game is not a game is refused before anything is replaced', () => {
  const wrap = (raw: string) => JSON.stringify({ format: 'goal-clicker-save', version: 1, exportedAt: '', origin: '', keys: { [STORAGE_KEY]: raw } });
  for (const raw of ['null', '42', '[]', '"text"', '{"name":"no goals"}']) assert.equal(parseSaveFile(wrap(raw)).ok, false, raw);
  assert.equal(parseSaveFile(wrap(JSON.stringify(game(5)))).ok, true);
});

test('a reset also forgets old save versions, so the deleted progress does not come back', () => {
  store.clear(); failWritesFor = null;
  store.set(LEGACY_STORAGE_KEYS[0], JSON.stringify(game(100)));
  store.set(BACKUP_STORAGE_KEY, JSON.stringify(game(80)));
  store.set(RECOVERY_STORAGE_KEY, JSON.stringify(game(70)));
  store.set(STORAGE_KEY, JSON.stringify(game(90)));
  clearStoredGames();
  assert.equal(readStoredGame().saved, undefined);
});

test('loading the cloud save keeps the local copies when storage is full', () => {
  store.clear();
  store.set(STORAGE_KEY, JSON.stringify(game(100)));
  store.set(BACKUP_STORAGE_KEY, JSON.stringify(game(90)));
  failWritesFor = (key, value) => key === STORAGE_KEY && value.includes('"totalGoals":500');
  assert.throws(() => applyCloudSave('u', { version: 3, updatedAt: null, active: true, keys: { [STORAGE_KEY]: JSON.stringify(game(500)) } }));
  failWritesFor = null;
  assert.equal(goalsIn(STORAGE_KEY), 100);
  assert.equal(goalsIn(BACKUP_STORAGE_KEY), 90);
});

test('a player leaving for free is saved; a tab that fell behind is not', () => {
  const before = game(1000, { lastSaved: 1000, features: { starXI: { ownedIds: ['a'] } } });
  const departure = game(1000, { lastSaved: 2000, features: { starXI: { ownedIds: [] } } });
  assert.equal(shouldRejectRegressedSave(before, departure), false, 'newer write with one player fewer');
  assert.equal(shouldRejectRegressedSave(departure, { ...before, lastSaved: 500 }), true, 'older write with the same goals');
  assert.equal(shouldRejectRegressedSave(before, game(900, { lastSaved: 3000 })), true, 'fewer lifetime goals');
});
