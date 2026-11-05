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

test('a broken travel event in a stored save does not stop the game from loading', () => {
  assert.doesNotThrow(() => normalizeTravel({ journey: { id: 'x', fixture: { id: 'f' }, events: [null] }, stats: null }));
  const broken = game(100) as unknown as { features: { travel: unknown } };
  broken.features.travel = { journey: { id: 'x', fixture: { id: 'f', venue: { lat: 1, lon: 1, city: 'Bern' }, opponent: 'X' }, transport: 'bus', startedAt: 1, baseMs: 10, endsAt: 20, events: [null] }, stats: null };
  assert.doesNotThrow(() => tabA.normalizeRuntimeGame(JSON.parse(JSON.stringify(broken))));
});

// ---- Save integrity: newer versions (R01), background cap (B21), one clock (L04), save files (B24) -------------

const { GAME_FEATURES_SCHEMA_VERSION } = await import('../app/feature-data.ts');
const { RECOVERY_STORAGE_KEY } = await import('../app/game/constants.ts');
const { buildSaveFile, collectSaveKeys, parseSaveFile, replaceLocalSave } = await import('../app/game/save-export.ts');
const { getCurrentTime, monotonicElapsed } = await import('../app/game/clock.ts');

test('R01: a stored game from a newer version is never normalized and written over', () => {
  store.clear(); failWrites = false;
  tabA.markLocalSaveLoaded();
  tabA.claimLocalSave();
  const future = JSON.stringify({ ...game(500), features: { ...game(500).features, schemaVersion: GAME_FEATURES_SCHEMA_VERSION + 1, futureField: { kept: true } } });
  store.set(STORAGE_KEY, future);
  assert.equal(tabA.persistLocalGame(game(900)), 'outdated');
  assert.equal(store.get(STORAGE_KEY), future, 'exactly as the newer version stored it');
  assert.equal(store.has(BACKUP_STORAGE_KEY), false);
});

test('older saves without a schema version (or below the current one) load and save as before', () => {
  for (const schemaVersion of [undefined, 5, GAME_FEATURES_SCHEMA_VERSION - 1]) {
    store.clear(); failWrites = false;
    tabA.markLocalSaveLoaded();
    tabA.claimLocalSave();
    const old = { goals: 70, totalGoals: 70, clicks: 3, seasons: 1, stars: 1, features: schemaVersion === undefined ? {} : { schemaVersion } };
    store.set(STORAGE_KEY, JSON.stringify(old));
    const loaded = tabA.normalizeRuntimeGame(tabA.readStoredGame().saved);
    assert.equal(loaded.totalGoals, 70);
    assert.equal(loaded.features.schemaVersion, GAME_FEATURES_SCHEMA_VERSION);
    assert.equal(tabA.persistLocalGame({ ...loaded, lastSaved: Date.now() }), 'saved');
    assert.equal(stored().totalGoals, 70);
  }
});

test('B21: a hidden tab earns at most 8 hours of passive income per return, measured on the monotonic clock', () => {
  const state = { ...tabA.initialGame(), upgrades: { ballboy: 10 } };
  const hour = 60 * 60_000;
  const oneHour = tabA.advanceLocalGameWhileOpen(state, hour, 10 * hour).totalGoals;
  const eightHours = tabA.advanceLocalGameWhileOpen(state, 8 * hour, 10 * hour).totalGoals;
  const aYear = tabA.advanceLocalGameWhileOpen(state, 365 * 24 * hour, 10 * hour).totalGoals;
  assert.ok(oneHour > 0 && eightHours > oneHour);
  assert.equal(aYear, eightHours, 'a year (or a clock set forward) pays no more than 8 hours');
  assert.equal(tabA.advanceLocalGameWhileOpen(state, -5 * hour, 10 * hour).totalGoals, 0, 'a clock set back earns nothing');
  // Saving in the background every hour does not reset the budget of the hidden period.
  let hiddenAt: number | null = 0, budget = tabA.MAX_BACKGROUND_CATCH_UP_MS, paid = 0;
  for (let now = hour; now <= 48 * hour; now += hour) {
    const taken = tabA.takeBackgroundTime(hiddenAt, budget, now);
    paid += taken.elapsedMs; budget = taken.budgetMs; hiddenAt = now;
  }
  assert.equal(paid, 8 * hour);
  assert.deepEqual(tabA.takeBackgroundTime(null, budget, 5), { elapsedMs: 0, budgetMs: budget }, 'a visible tab is not paid');
  assert.equal(monotonicElapsed(100, 50), 0);
});

test('L04: the mini game cooldown is written with the same session clock it is checked with', () => {
  const cooldownMs = tabA.getMiniGameCooldownUntil('penalty', 0);
  assert.ok(cooldownMs > 0);
  assert.equal(tabA.getMiniGameCooldownUntil('penalty', 1_000), 1_000 + cooldownMs);
  const before = getCurrentTime();
  const until = tabA.getMiniGameCooldownUntil('penalty');
  const after = getCurrentTime();
  assert.ok(until >= before + cooldownMs && until <= after + cooldownMs);
});

test('B24: a save file holds the game as it is on screen and round-trips; bad files are refused with a reason', () => {
  store.clear(); failWrites = false;
  store.set(STORAGE_KEY, JSON.stringify(game(100)));
  store.set('goalClickerLayoutV3', '["shop"]');
  // The stored game is older than the screen (storage full): the file takes the game on screen.
  const keys = collectSaveKeys(localStorage, game(250));
  const file = JSON.stringify(buildSaveFile(keys, new Date('2026-11-05T10:00:00Z')));
  const parsed = parseSaveFile(file);
  assert.ok(parsed.ok);
  assert.equal(parsed.ok && parsed.summary.totalGoals, 250);
  assert.equal(parsed.ok && parsed.keys.goalClickerLayoutV3, '["shop"]');
  assert.equal(parsed.ok && parsed.exportedAt, '2026-11-05T10:00:00.000Z');
  assert.match((parseSaveFile('{broken') as { error: string }).error, /kein Goal Clicker Spielstand/);
  assert.match((parseSaveFile(JSON.stringify({ format: 'other' })) as { error: string }).error, /kein Goal Clicker Spielstand/);
  assert.match((parseSaveFile(JSON.stringify({ format: 'goal-clicker-save', formatVersion: 1, keys: { goalClickerSiteSaveV3: '{broken' } })) as { error: string }).error, /beschädigt/);
  const future = buildSaveFile({ [STORAGE_KEY]: JSON.stringify({ ...game(5), features: { schemaVersion: GAME_FEATURES_SCHEMA_VERSION + 1 } }) });
  assert.match((parseSaveFile(JSON.stringify(future)) as { error: string }).error, /neueren Version/);
  const empty = buildSaveFile({ [STORAGE_KEY]: JSON.stringify({ goals: 0, totalGoals: 0, clicks: 0, seasons: 0 }) });
  assert.match((parseSaveFile(JSON.stringify(empty)) as { error: string }).error, /keinen Fortschritt/);
});

test('B24: importing keeps the previous game as the local backup and puts everything back on a full storage', () => {
  store.clear(); failWrites = false;
  store.set(STORAGE_KEY, JSON.stringify(game(400)));
  store.set(BACKUP_STORAGE_KEY, JSON.stringify(game(390)));
  const imported = { [STORAGE_KEY]: JSON.stringify(game(50)) };
  failWrites = true;
  assert.throws(() => replaceLocalSave(localStorage, imported));
  failWrites = false;
  assert.equal(stored().totalGoals, 400, 'nothing replaced');
  assert.equal((JSON.parse(store.get(BACKUP_STORAGE_KEY)!) as { totalGoals: number }).totalGoals, 390);
  replaceLocalSave(localStorage, imported);
  assert.equal(stored().totalGoals, 50);
  assert.equal((JSON.parse(store.get(BACKUP_STORAGE_KEY)!) as { totalGoals: number }).totalGoals, 400, 'the previous game is the backup');
  assert.equal((JSON.parse(store.get(RECOVERY_STORAGE_KEY)!) as { totalGoals: number }).totalGoals, 390);
  // The imported game is what loads next, although the backup holds more progress.
  assert.equal(tabA.readStoredGame().saved?.totalGoals, 50);
});
