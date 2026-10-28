// Two tabs, one localStorage: only the tab in use saves, and an older tab never writes its game back.
import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map<string, string>();
let failWrites = false;
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { if (failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError'); store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  },
});
const { STORAGE_KEY, BACKUP_STORAGE_KEY } = await import('../app/game/constants.ts');
// The same module twice is two tabs: each has its own tab id and loaded revision.
type StorageModule = typeof import('../app/game/storage.ts');
const storageModule = (tab: string) => import(`../app/game/storage.ts?tab=${tab}`) as Promise<StorageModule>;
const tabA = await storageModule('a');
const tabB = await storageModule('b');
const { selectSafestStoredGame } = await import('../app/save-safety.ts');
const { localSaveFailed, SAVE_WRITER_KEY } = await import('../app/game/save-revision.ts');
const { normalizeTravel } = await import('../app/travel-data.ts');

const game = (totalGoals: number, ownedIds: string[] = []) => {
  const value = tabA.initialGame();
  value.goals = value.totalGoals = totalGoals;
  value.features.starXI.ownedIds = ownedIds;
  return value;
};
const stored = () => JSON.parse(store.get(STORAGE_KEY)!) as { totalGoals: number; features: { starXI: { ownedIds: string[] } } };

test('an older tab cannot overwrite a card bought in the tab in use, even with more goals', () => {
  store.clear(); failWrites = false;
  tabA.markLocalSaveLoaded(); tabB.markLocalSaveLoaded();
  assert.equal(tabA.persistLocalGame(game(100)), 'saved');
  // Both tabs now show the same game.
  tabB.markLocalSaveLoaded();
  assert.equal(tabA.persistLocalGame(game(100, ['new-card'])), 'saved');
  // Tab B keeps running in the background and gets ahead on goals; tab A is the one in use.
  assert.equal(tabB.persistLocalGame(game(101)), 'other-tab');
  // Even after tab A was closed, tab B has to load the newer game before it may save.
  store.delete(SAVE_WRITER_KEY);
  assert.equal(tabB.persistLocalGame(game(101)), 'stale');
  assert.deepEqual(stored().features.starXI.ownedIds, ['new-card']);
  // Using tab B makes it load the newer game first.
  assert.equal(tabB.claimLocalSave(), 'stale');
});

test('only the tab in use saves; the other one waits until it is used and has loaded the newest game', () => {
  store.clear(); failWrites = false;
  tabA.markLocalSaveLoaded(); tabB.markLocalSaveLoaded();
  assert.equal(tabA.claimLocalSave(), 'ok');
  assert.equal(tabA.persistLocalGame(game(10)), 'saved');
  assert.equal(tabB.persistLocalGame(game(10)), 'other-tab');
  tabB.markLocalSaveLoaded();
  assert.equal(tabB.claimLocalSave(), 'ok');
  assert.equal(tabB.persistLocalGame(game(20)), 'saved');
  assert.equal(tabA.persistLocalGame(game(30)), 'other-tab');
  assert.equal(tabA.claimLocalSave(), 'stale');
  assert.equal(stored().totalGoals, 20);
});

test('a reset in one tab keeps the other tab from saving the old game back', () => {
  store.clear(); failWrites = false;
  tabA.markLocalSaveLoaded(); tabB.markLocalSaveLoaded();
  tabA.persistLocalGame(game(500));
  tabB.markLocalSaveLoaded();
  tabB.clearStoredGames();
  assert.equal(tabA.persistLocalGame(game(600)), 'other-tab');
  store.delete(SAVE_WRITER_KEY);
  assert.equal(tabA.persistLocalGame(game(600)), 'stale');
  assert.equal(store.get(STORAGE_KEY), undefined);
});

test('a free departure is kept after a reload, the backup with more players does not win', () => {
  const before = JSON.stringify(game(100, ['a', 'b']));
  const after = JSON.stringify({ ...game(100, ['a']), lastSaved: Date.now() + 1000 });
  const selected = selectSafestStoredGame([{ key: STORAGE_KEY, raw: after }, { key: BACKUP_STORAGE_KEY, raw: before }]);
  assert.equal(selected?.key, STORAGE_KEY);
});

test('a full storage is reported instead of passing for saved', () => {
  store.clear(); failWrites = false;
  tabA.markLocalSaveLoaded();
  tabA.claimLocalSave();
  assert.equal(tabA.persistLocalGame(game(100)), 'saved');
  failWrites = true;
  assert.equal(tabA.persistLocalGame(game(200)), 'failed');
  assert.equal(localSaveFailed(), true);
  failWrites = false;
  assert.equal(tabA.persistLocalGame(game(300)), 'saved');
  assert.equal(localSaveFailed(), false);
});

test('a broken travel event in an imported save does not stop the game from loading', () => {
  assert.doesNotThrow(() => normalizeTravel({ journey: { id: 'x', fixture: { id: 'f' }, events: [null] }, stats: null }));
  const broken = game(100) as unknown as { features: { travel: unknown } };
  broken.features.travel = { journey: { id: 'x', fixture: { id: 'f', venue: { lat: 1, lon: 1, city: 'Bern' }, opponent: 'X' }, transport: 'bus', startedAt: 1, baseMs: 10, endsAt: 20, events: [null] }, stats: null };
  assert.equal(tabA.storedGameLoads(JSON.stringify(broken)), true);
  assert.equal(tabA.storedGameLoads('{"features":'), false);
});
