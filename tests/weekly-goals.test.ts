// Weekly goals (decision of 6 November 2026): three goals per Zurich week, counted against a baseline from the start
// of the week, paid once in fragments or a league reward pack, the same in single player and co-op.
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { installLightRoomMocks } from './helpers/light-room-mock.ts';
import { GAME_FEATURES_SCHEMA_VERSION, SEASON_MODE_DIVISION_COUNT, STAR_XI_PLAYERS, applySeasonPrestige, getTournamentRewardPack, initialGameFeatures, normalizeGameFeatures, openEarnedPack, setBestStarXI } from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';
import { claimWeeklyGoal, ensureWeeklyGoals, generateWeeklyGoals, getMsUntilNextWeek, getWeekKey, getWeekNumber, getWeeklyCounters, getWeeklyFragmentRewards, getWeeklyGoalViews, weeklyGoalsNeedUpdate, WEEKLY_METRIC_DEFINITIONS } from '../app/weekly-goals.ts';
import type { WeeklyGoal } from '../app/weekly-goals.ts';
import { WeeklyGoalsPanel } from '../app/weekly-goals-panel.tsx';

const { GoalClickerDatabase } = await import('../db/index.ts');
const { POST, GET } = await import('../app/api/multiplayer/route.ts');

// Monday 9 November 2026, 00:30 in Zurich (CET, UTC+1) is Sunday 23:30 UTC.
const SUNDAY_LATE = Date.UTC(2026, 10, 8, 22, 30); // Sunday 23:30 Zurich
const MONDAY_EARLY = Date.UTC(2026, 10, 8, 23, 30); // Monday 00:30 Zurich
const WEDNESDAY = Date.UTC(2026, 10, 11, 12, 0);
const NEXT_MONDAY = Date.UTC(2026, 10, 16, 8, 0);

/** Forces one goal of the week, so a test knows exactly what counts. */
function withGoal(features: GameFeatures, now: number, goal: Omit<WeeklyGoal, 'id'>, minigameWins = 0) {
  ensureWeeklyGoals(features, now, minigameWins);
  const id = `${features.weekly!.week}:1:${goal.metric}`;
  features.weekly = { ...features.weekly!, goals: [{ ...goal, id }] };
  return id;
}

test('the week starts on Monday at midnight in Zurich, not in UTC', () => {
  assert.equal(getWeekKey(SUNDAY_LATE), '2026-11-02');
  assert.equal(getWeekKey(MONDAY_EARLY), '2026-11-09');
  assert.equal(getWeekKey(WEDNESDAY), '2026-11-09');
  assert.equal(getWeekKey(NEXT_MONDAY), '2026-11-16');
  // Summer time: Monday 30 March 2026, 00:30 in Zurich is Sunday 22:30 UTC.
  assert.equal(getWeekKey(Date.UTC(2026, 2, 29, 22, 30)), '2026-03-30');
  assert.equal(getWeekNumber('2026-11-09'), 46);
  assert.equal(getWeekNumber('2026-12-28'), 53);
  assert.equal(getWeekNumber('2027-01-04'), 1);
  assert.ok(getMsUntilNextWeek(SUNDAY_LATE) <= 31 * 60_000);
  assert.ok(getMsUntilNextWeek(MONDAY_EARLY) > 6 * 86_400_000);
});

test('three distinct goals per week and league, the same for everybody, the hard one pays a league reward pack', () => {
  const features = initialGameFeatures(WEDNESDAY);
  features.seasonMode = { ...features.seasonMode, highestDivision: 9 };
  const goals = generateWeeklyGoals('2026-11-09', features);
  assert.deepEqual(generateWeeklyGoals('2026-11-09', features), goals);
  assert.equal(goals.length, 3);
  assert.equal(new Set(goals.map((g) => g.metric)).size, 3);
  const [easy, medium] = getWeeklyFragmentRewards(9);
  assert.deepEqual(goals.map((g) => g.reward), [{ kind: 'fragments', amount: easy }, { kind: 'fragments', amount: medium }, { kind: 'pack', packId: getTournamentRewardPack('cup', 9).id }]);
  goals.forEach((goal, tier) => assert.equal(goal.target, WEEKLY_METRIC_DEFINITIONS[goal.metric].targets[tier]));
  assert.ok(goals.every((g) => g.id.startsWith('2026-11-09:')));
  // Another week draws again; goals that cannot be reached (no rival, no special card) are never chosen.
  const weeks = Array.from({ length: 30 }, (_, i) => generateWeeklyGoals(new Date(Date.UTC(2026, 0, 5 + 7 * i)).toISOString().slice(0, 10), features));
  assert.ok(new Set(weeks.map((w) => w.map((g) => g.metric).join())).size > 5);
  assert.ok(weeks.flat().every((g) => g.metric !== 'derbyWins' && g.metric !== 'specialGrowth'));
  // Rewards stay moderate: fragments only (never goals), at most 1500 per goal.
  for (const division of [1, 5, 10, 15]) assert.ok(getWeeklyFragmentRewards(division).every((n) => n > 0 && n <= 1500));
});

test('only what happens after the week started counts (baseline), and a new week starts from zero', () => {
  const features = initialGameFeatures(WEDNESDAY);
  features.chronicle.totals.leagueWins = 40;
  const id = withGoal(features, MONDAY_EARLY, { metric: 'leagueWins', target: 3, reward: { kind: 'fragments', amount: 500 } });
  assert.equal(features.weekly!.baseline.leagueWins, 40);
  assert.equal(getWeeklyGoalViews(features).find((g) => g.id === id)!.progress, 0);
  features.chronicle.totals.leagueWins = 42;
  assert.equal(getWeeklyGoalViews(features)[0].progress, 2);
  assert.equal(claimWeeklyGoal(features, id, WEDNESDAY).ok, false);
  features.chronicle.totals.leagueWins = 45;
  assert.equal(getWeeklyGoalViews(features)[0].progress, 3, 'progress stops at the target');
  // Within the week nothing changes; the next Monday sets a new baseline and new goals.
  assert.equal(ensureWeeklyGoals(features, WEDNESDAY), false);
  assert.equal(weeklyGoalsNeedUpdate(features, NEXT_MONDAY, 0), true);
  assert.equal(ensureWeeklyGoals(features, NEXT_MONDAY, 0), true);
  assert.equal(features.weekly!.week, '2026-11-16');
  assert.equal(features.weekly!.baseline.leagueWins, 45);
  assert.deepEqual(features.weekly!.claimed, []);
  assert.ok(getWeeklyGoalViews(features, 0).every((g) => g.progress === 0));
  // A clock that runs behind never goes back to the older week.
  assert.equal(ensureWeeklyGoals(features, WEDNESDAY, 0), false);
  assert.equal(features.weekly!.week, '2026-11-16');
});

test('a goal pays exactly once; a goal of a past week cannot be claimed any more', () => {
  const features = initialGameFeatures(WEDNESDAY);
  const id = withGoal(features, MONDAY_EARLY, { metric: 'cleanSheets', target: 1, reward: { kind: 'fragments', amount: 600 } });
  features.chronicle.totals.cleanSheets += 1;
  const first = claimWeeklyGoal(features, id, WEDNESDAY);
  assert.equal(first.ok, true);
  assert.equal(features.starXI.fragments, 600);
  const again = claimWeeklyGoal(features, id, WEDNESDAY);
  assert.equal(again.ok, false);
  assert.equal(features.starXI.fragments, 600);
  // Survives saving and loading.
  const loaded = normalizeGameFeatures(JSON.parse(JSON.stringify(features)));
  assert.deepEqual(loaded.weekly, features.weekly);
  assert.equal(claimWeeklyGoal(loaded, id, WEDNESDAY).ok, false);
  assert.equal(loaded.starXI.fragments, 600);
  // Next week the old goal id no longer exists.
  const late = claimWeeklyGoal(loaded, id, NEXT_MONDAY);
  assert.equal(late.ok, false);
  assert.match(late.ok ? '' : late.error, /vergangenen Woche/);
  assert.equal(loaded.starXI.fragments, 600);
});

test('the pack goal leaves one reward pack for the best league, which opens like any earned pack and counts as opened', () => {
  const features = initialGameFeatures(WEDNESDAY);
  features.seasonMode = { ...features.seasonMode, highestDivision: 12 };
  const packId = getTournamentRewardPack('cup', 12).id as `reward-${1 | 2 | 3 | 4 | 5 | 6}`;
  const id = withGoal(features, MONDAY_EARLY, { metric: 'goalsScored', target: 6, reward: { kind: 'pack', packId } });
  features.chronicle.totals.goalsFor += 7;
  assert.equal(claimWeeklyGoal(features, id, WEDNESDAY).ok, true);
  assert.equal(claimWeeklyGoal(features, id, WEDNESDAY).ok, false);
  const packs = features.earnedPacks.filter((p) => p.id === `weekly-${id}`);
  assert.equal(packs.length, 1);
  assert.equal(packs[0].packId, packId);
  const opened = features.chronicle.totals.packsOpened;
  assert.ok(openEarnedPack(features, packs[0].id, WEDNESDAY, () => 0.3));
  assert.equal(features.chronicle.totals.packsOpened, opened + 1);
  assert.equal(openEarnedPack(features, packs[0].id, WEDNESDAY, () => 0.3), null);
  assert.equal(features.chronicle.totals.packsOpened, opened + 1);
});

test('mini game wins live outside the features: an unknown baseline is filled in later, never counted from zero', () => {
  const features = initialGameFeatures(WEDNESDAY);
  ensureWeeklyGoals(features, MONDAY_EARLY); // e.g. a match finished before the timer saw the new week
  assert.equal(features.weekly!.baseline.minigameWins, undefined);
  const id = `${features.weekly!.week}:1:minigameWins`;
  features.weekly = { ...features.weekly!, goals: [{ id, metric: 'minigameWins', target: 2, reward: { kind: 'fragments', amount: 300 } }] };
  assert.equal(getWeeklyGoalViews(features, 120)[0].progress, 0);
  assert.equal(weeklyGoalsNeedUpdate(features, WEDNESDAY, 120), true);
  assert.equal(ensureWeeklyGoals(features, WEDNESDAY, 120), true);
  assert.equal(features.weekly!.baseline.minigameWins, 120);
  assert.equal(getWeeklyGoalViews(features, 122)[0].progress, 2);
  assert.equal(claimWeeklyGoal(features, id, WEDNESDAY, 122).ok, true);
});

test('Prestige keeps the week: progress, baseline and claims stay, nothing can be claimed twice', () => {
  let features = initialGameFeatures(WEDNESDAY);
  features.starterSquadGranted = true;
  features.starXI = setBestStarXI({ ...features.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => !p.isCustom && !p.retired).slice(0, 18).map((p) => p.id) }, []);
  features.seasonMode = { ...features.seasonMode, division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, hallOfFame: true };
  features = normalizeGameFeatures(features);
  features.chronicle.totals.wins = 10;
  const id = withGoal(features, MONDAY_EARLY, { metric: 'matchWins', target: 1, reward: { kind: 'fragments', amount: 750 } });
  features.chronicle.totals.wins += 1;
  assert.equal(claimWeeklyGoal(features, id, WEDNESDAY).ok, true);
  const result = applySeasonPrestige(features, features.starXI.ownedIds[0], WEDNESDAY + 1000, 'weekly-prestige');
  assert.equal(result.error, '');
  assert.deepEqual(result.features.weekly, features.weekly);
  assert.equal(result.features.chronicle.totals.wins, features.chronicle.totals.wins);
  assert.equal(claimWeeklyGoal(result.features, id, WEDNESDAY + 2000).ok, false);
  assert.equal(result.features.starXI.fragments, 750);
  // A counter that ever falls below its baseline only lowers the baseline: progress is never negative or stuck.
  result.features.chronicle.totals.wins = 0;
  assert.equal(ensureWeeklyGoals(result.features, WEDNESDAY + 3000), true);
  assert.equal(result.features.weekly!.baseline.matchWins, 0);
});

test('old saves load: missions stay as harmless data, no weekly goals yet, schema version 9', () => {
  const old = JSON.parse(JSON.stringify(initialGameFeatures(WEDNESDAY))) as Record<string, unknown>;
  delete old.chronicle; delete old.weekly; old.schemaVersion = 8;
  (old.missions as { id: string; claimed: boolean }[])[0].claimed = true;
  const loaded = normalizeGameFeatures(old);
  assert.equal(loaded.schemaVersion, GAME_FEATURES_SCHEMA_VERSION);
  assert.equal(GAME_FEATURES_SCHEMA_VERSION, 9);
  assert.equal(loaded.weekly, undefined);
  assert.equal(loaded.missions[0].claimed, true);
  assert.equal(loaded.chronicle.totals.matches, 0);
  // Garbage in a stored week is dropped instead of breaking the save.
  assert.equal(normalizeGameFeatures({ ...old, weekly: { week: 'bad' } }).weekly, undefined);
  const forged = normalizeGameFeatures({ ...old, weekly: { week: '2026-11-09', division: 3, goals: [{ id: '2026-11-02:1:leagueWins', metric: 'leagueWins', target: 1, reward: { kind: 'fragments', amount: 1 } }, { id: '2026-11-09:2:x', metric: 'nope', target: 1, reward: { kind: 'fragments', amount: 1 } }, { id: '2026-11-09:3:goalsScored', metric: 'goalsScored', target: 5, reward: { kind: 'fragments', amount: 1e9 } }], baseline: { goalsScored: 3 }, claimed: ['unknown'] } });
  assert.deepEqual(forged.weekly!.goals.map((g) => g.id), ['2026-11-09:3:goalsScored']);
  assert.equal((forged.weekly!.goals[0].reward as { amount: number }).amount, 10000);
  assert.deepEqual(forged.weekly!.claimed, []);
});

test('the Wochenziele panel shows progress, rewards and a claim button for solo and co-op', () => {
  const features = initialGameFeatures(WEDNESDAY);
  const id = withGoal(features, MONDAY_EARLY, { metric: 'leagueWins', target: 2, reward: { kind: 'fragments', amount: 500 } });
  features.chronicle.totals.leagueWins += 2;
  const html = renderToStaticMarkup(React.createElement(WeeklyGoalsPanel, { features, minigameWins: 0, coop: false, busy: false, now: WEDNESDAY, onClaim: () => {} }));
  assert.match(html, /WOCHENZIELE \/ KW 46/);
  assert.match(html, /Gewinne 2 Ligaspiele/);
  assert.match(html, /500 Fragmente/);
  assert.match(html, />Abholen</);
  assert.doesNotMatch(html, /[–—]/);
  claimWeeklyGoal(features, id, WEDNESDAY);
  const coop = renderToStaticMarkup(React.createElement(WeeklyGoalsPanel, { features, minigameWins: 0, coop: true, busy: false, now: WEDNESDAY, onClaim: () => {} }));
  assert.match(coop, /KOOP \/ WOCHENZIELE/);
  assert.match(coop, />Abgeholt</);
});

// Co-op: the world shares the week; weekly-claim replaces mission-claim and pays once for all seats.
let row: RoomRow;
GoalClickerDatabase.prototype.getRoom = async (code) => code === row.code ? structuredClone(row) : null;
GoalClickerDatabase.prototype.updateRoom = async (code, values: RoomUpdate, conditions = {}) => {
  if (code !== row.code || conditions.sharedStateVersion !== undefined && conditions.sharedStateVersion !== row.sharedStateVersion || conditions.lastPassiveAt !== undefined && conditions.lastPassiveAt !== row.lastPassiveAt) return null;
  row = { ...row, ...values };
  return structuredClone(row);
};
installLightRoomMocks(GoalClickerDatabase);
function setup(features: GameFeatures) {
  const now = new Date().toISOString();
  const defaults = Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([key, col]) => [key, col.default ?? null]));
  row = { ...defaults, code: 'WEEKLY', hostPlayerId: 'host-player-123', hostName: 'Nicolas', guestPlayerId: 'guest-player-123', guestName: 'Silvan', hostLastSeenAt: now, guestLastSeenAt: now, lastPassiveAt: now, updatedAt: now, sharedFeaturesJson: JSON.stringify(features) } as RoomRow;
}
async function action(name: string, extra: Record<string, unknown> = {}, playerId = 'host-player-123') {
  const response = await POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: name, code: 'WEEKLY', playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION, ...extra }) }));
  return { status: response.status, data: await response.json() as { room?: { game: { features: GameFeatures } }; error?: string } };
}

test('co-op: the server starts the week, a finished goal pays once even with both seats claiming at the same time', async () => {
  const features = initialGameFeatures();
  setup(features);
  const viewed = await GET(new Request(`http://localhost/api/multiplayer?code=WEEKLY&playerId=guest-player-123&protocol=${MULTIPLAYER_PROTOCOL_VERSION}`));
  const state = (await viewed.json() as { room: { game: { features: GameFeatures } } }).room.game.features;
  assert.equal(state.weekly?.week, getWeekKey());
  assert.equal(state.weekly?.goals.length, 3);
  // Prepare a finished goal in the stored world.
  const stored = normalizeGameFeatures(JSON.parse(row.sharedFeaturesJson));
  const id = withGoal(stored, Date.now(), { metric: 'leagueWins', target: 1, reward: { kind: 'fragments', amount: 1000 } });
  stored.chronicle.totals.leagueWins += 1;
  row.sharedFeaturesJson = JSON.stringify(stored);
  const results = await Promise.all([action('weekly-claim', { goalId: id }), action('weekly-claim', { goalId: id }, 'guest-player-123')]);
  assert.ok(results.some((r) => r.status === 200), JSON.stringify(results.map((r) => r.data.error)));
  const saved = JSON.parse(row.sharedFeaturesJson) as GameFeatures;
  assert.equal(saved.starXI.fragments, 1000);
  assert.deepEqual(saved.weekly!.claimed, [id]);
  const again = await action('weekly-claim', { goalId: id });
  assert.equal(again.status, 409);
  assert.equal((JSON.parse(row.sharedFeaturesJson) as GameFeatures).starXI.fragments, 1000);
  // An unfinished or unknown goal is refused.
  assert.equal((await action('weekly-claim', { goalId: 'nope' })).status, 409);
});

test('co-op: old clients claiming a mission get a reload hint and nothing is paid', async () => {
  const features = initialGameFeatures();
  setup(features);
  const before = row.sharedCoins;
  const result = await action('mission-claim', { missionId: 'team-goals' });
  assert.equal(result.status, 409);
  assert.match(result.data.error ?? '', /Wochenziele/);
  assert.equal(row.sharedCoins, before);
});

test('counters for the goals come from the club: matches, packs, album and special growth', () => {
  const features = initialGameFeatures(WEDNESDAY);
  features.chronicle.totals = { ...features.chronicle.totals, leagueWins: 2, wins: 3, cleanSheets: 1, goalsFor: 9, derbyWins: 1, tournamentWins: 1, packsOpened: 4 };
  features.career.collectedIds = STAR_XI_PLAYERS.slice(0, 7).map((p) => p.id);
  features.career.players['star-goat-nicu'] = { ...features.career.players['star-goat-nicu'], appearances: 3, minutes: 270, goals: 0, assists: 0, ratingTotal: 21, ratedMatches: 3, motm: 0, subAppearances: 0, subRatingTotal: 0, subMinutes: 0, points: 7, recent: [] };
  assert.deepEqual(getWeeklyCounters(features, 5), { leagueWins: 2, matchWins: 3, cleanSheets: 1, goalsScored: 9, derbyWins: 1, tournamentWins: 1, packsOpened: 4, minigameWins: 5, specialGrowth: 7, albumCards: 7 });
  assert.equal(getWeeklyCounters(features).minigameWins, undefined);
});

test('schema 9 is protected from older clients: a client of schema 8 keeps such a save untouched', async () => {
  const { isGameFromNewerVersion, isSaveFromNewerVersion, uploadSchemaVersion } = await import('../app/game/save-schema.ts');
  const { STORAGE_KEY } = await import('../app/game/constants.ts');
  const features = initialGameFeatures(WEDNESDAY);
  ensureWeeklyGoals(features, WEDNESDAY, 0);
  const stored = JSON.stringify({ goals: 1, features });
  assert.equal(isGameFromNewerVersion(stored, 8), true, 'an older client sees a newer save');
  assert.equal(isGameFromNewerVersion(stored), false, 'this client reads its own saves');
  assert.equal(isSaveFromNewerVersion({ [STORAGE_KEY]: stored }, 8), true);
  assert.equal(uploadSchemaVersion({ [STORAGE_KEY]: stored }), 9);
  // A schema 8 save is upgraded on load and keeps everything it had.
  const old = JSON.stringify({ goals: 1, features: { ...JSON.parse(JSON.stringify(features)), schemaVersion: 8, weekly: undefined } });
  assert.equal(isGameFromNewerVersion(old), false);
});
