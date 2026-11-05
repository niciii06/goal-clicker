// The autosave skips re-reading its own last write and rotates the backups once a minute, without giving up any
// of the save safety checks.
import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  },
});
const { STORAGE_KEY, BACKUP_STORAGE_KEY, RECOVERY_STORAGE_KEY } = await import('../app/game/constants.ts');
const storage = await import('../app/game/storage.ts');
const { GAME_FEATURES_SCHEMA_VERSION } = await import('../app/feature-data.ts');

let clock = 1_900_000_000_000;
const realNow = Date.now;
Date.now = () => clock;
test.after(() => { Date.now = realNow; });

const game = (totalGoals: number, lastSaved = clock) => {
  const value = storage.initialGame();
  value.goals = value.totalGoals = totalGoals;
  value.lastSaved = lastSaved;
  return value;
};
const fresh = () => { store.clear(); storage.resetLocalSaveCache(); storage.markLocalSaveLoaded(); };
function countParses<T>(fn: () => T) {
  const original = JSON.parse;
  let count = 0;
  JSON.parse = ((...args: Parameters<typeof JSON.parse>) => { count += 1; return original(...args); }) as typeof JSON.parse;
  try { return { result: fn(), count }; } finally { JSON.parse = original; }
}

test('a save over the own last write parses only the new text', () => {
  fresh();
  assert.equal(storage.persistLocalGame(game(10)), 'saved');
  clock += 2200;
  // Writer marker and the new save itself: nothing parses the 300 KB stored game or the backup again.
  const { result, count } = countParses(() => storage.persistLocalGame(game(11)));
  assert.equal(result, 'saved');
  assert.ok(count <= 2, `parsed ${count} times`);
  assert.equal(JSON.parse(store.get(STORAGE_KEY)!).totalGoals, 11);
});

test('the fast path still keeps a save that would lose progress', () => {
  fresh();
  assert.equal(storage.persistLocalGame(game(100)), 'saved');
  clock += 2200;
  assert.equal(storage.persistLocalGame(game(50)), 'kept');
  assert.equal(JSON.parse(store.get(STORAGE_KEY)!).totalGoals, 100);
  // An older lastSaved with the same goals is a regression too.
  assert.equal(storage.persistLocalGame(game(100, clock - 60_000)), 'kept');
  assert.equal(JSON.parse(store.get(STORAGE_KEY)!).totalGoals, 100);
});

test('a stored game replaced behind the tab (no revision bump) is read again, also a newer version', () => {
  fresh();
  assert.equal(storage.persistLocalGame(game(10)), 'saved');
  const newer = JSON.parse(store.get(STORAGE_KEY)!);
  newer.features.schemaVersion = GAME_FEATURES_SCHEMA_VERSION + 1;
  newer.totalGoals = newer.goals = 5;
  store.set(STORAGE_KEY, JSON.stringify(newer));
  clock += 2200;
  assert.equal(storage.persistLocalGame(game(20)), 'outdated');
  // A replaced copy with more progress is not overwritten by a save that would lose it.
  newer.features.schemaVersion = GAME_FEATURES_SCHEMA_VERSION;
  newer.totalGoals = newer.goals = 500;
  store.set(STORAGE_KEY, JSON.stringify(newer));
  assert.equal(storage.persistLocalGame(game(20)), 'kept');
  assert.equal(JSON.parse(store.get(STORAGE_KEY)!).totalGoals, 500);
});

test('backup and recovery rotate at most once a minute', () => {
  fresh();
  const goals = () => [BACKUP_STORAGE_KEY, RECOVERY_STORAGE_KEY].map((key) => store.has(key) ? JSON.parse(store.get(key)!).totalGoals : null);
  assert.equal(storage.persistLocalGame(game(1)), 'saved');
  assert.deepEqual(goals(), [null, null]);
  clock += 2000;
  assert.equal(storage.persistLocalGame(game(2)), 'saved');
  assert.deepEqual(goals(), [1, null], 'the first save over a stored game makes a backup');
  for (let goals = 3; goals <= 20; goals += 1) { clock += 2000; assert.equal(storage.persistLocalGame(game(goals)), 'saved'); }
  assert.deepEqual(goals(), [1, null], 'no rotation within the minute');
  clock += storage.BACKUP_ROTATION_INTERVAL_MS;
  assert.equal(storage.persistLocalGame(game(21)), 'saved');
  assert.deepEqual(goals(), [20, 1]);
  assert.equal(JSON.parse(store.get(STORAGE_KEY)!).totalGoals, 21);
});
