// Prestige rules of 5 November 2026: every Club Office upgrade goes back to level 0, special cards and the one chosen
// normal card keep their improvements, discarded cards lose theirs (a copy obtained later starts at its base
// rating), album, history and claimed rewards stay. Solo and co-op share applyGamePrestige.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { installLightRoomMocks } from './helpers/light-room-mock.ts';
import {
  SEASON_MODE_DIVISION_COUNT, STAR_XI_PLAYERS, addStarXIPlayer, applySeasonPrestige, beginSeasonCupMatch, getStarXIPlayer, getStarXISelection, initialGameFeatures, normalizeGameFeatures, setBestStarXI,
} from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';
import { claimAlbumReward, claimAllAlbumRewards, emptyPlayerStats, getAlbumGroups, getCareerCard, getMilestoneStats, getSpecialGrowth, prepareCareerMatch, recordCareerMatch } from '../app/career-data.ts';
import { getBaseClickPower, getBasePassivePower, getClickPower, getLevel, getPassivePower } from '../app/game/economy.ts';
import { applyGamePrestige } from '../app/game/prestige.ts';
import { normalizeRuntimeGame } from '../app/game/storage.ts';
import type { GameState } from '../app/game/types.ts';
import { UPGRADES } from '../app/game/upgrades.ts';
import { getReachedLeague, getUpgradeUnlockLeague, isLeagueContentUnlocked } from '../app/season-progression.ts';
import { selectSafestStoredGame, shouldRejectRegressedSave } from '../app/save-safety.ts';
import { createJourney, fixtureFor } from '../app/travel-data.ts';
import { VENUES } from '../app/travel-geography.ts';

const { GoalClickerDatabase } = await import('../db/index.ts');
const { POST, clearRoomCacheForTests } = await import('../app/api/multiplayer/route.ts');

const ALEXIA = 'star-fc27w-227203'; // Alexia Putellaz, 91, midfielder
const LINEUP_SPECIAL = 'star-goat-nicu', BENCH_SPECIAL = 'star-maetthu', RESERVE_SPECIAL = 'star-pfuschi';
const SPECIALS = [LINEUP_SPECIAL, BENCH_SPECIAL, RESERVE_SPECIAL];
const NORMALS = STAR_XI_PLAYERS.filter((player) => !player.isCustom && !player.retired && !player.id.startsWith('scrap-') && player.id !== ALEXIA && player.rating < 85).slice(0, 23).map((player) => player.id);
const KEEPER_NORMAL = NORMALS[0];
const NOW = 2_000_000_000_000;

const rating = (features: GameFeatures, id: string) => getCareerCard(features.career, getStarXIPlayer(id)!).rating;
const roundTrip = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const allUpgrades = () => Object.fromEntries(UPGRADES.map((upgrade, index) => [upgrade.id, upgrade.kind === 'multiplier' ? 3 : 5 + index]));

/**
 * A Hall of Fame club before Prestige: a special in the starting eleven, one on the bench and one in reserve, all
 * grown to 90; Alexia upgraded from 91 to 94 by her 100 appearances; injuries, bans and yellow cards on the books.
 */
function hallOfFameFeatures(prestigeCount = 0): GameFeatures {
  const features = initialGameFeatures(NOW - 1_000_000);
  features.starterSquadGranted = true;
  const best = setBestStarXI({ ...features.starXI, ownedIds: [...SPECIALS, ALEXIA, ...NORMALS] }, []);
  const lineupIds = best.lineupIds.map((id) => SPECIALS.includes(id) && id !== LINEUP_SPECIAL ? '' : id);
  if (!lineupIds.includes(LINEUP_SPECIAL)) lineupIds[lineupIds.findIndex((id) => id !== ALEXIA && id !== '')] = LINEUP_SPECIAL;
  const benchIds = best.benchIds.map((id) => SPECIALS.includes(id) ? '' : id);
  benchIds[0] = BENCH_SPECIAL;
  features.starXI = { ...best, lineupIds, benchIds };
  const stats = (extra: Partial<ReturnType<typeof emptyPlayerStats>>) => ({ ...emptyPlayerStats(), ...extra });
  features.career.players = {
    [ALEXIA]: stats({ appearances: 100, minutes: 8000, goals: 12, assists: 9, recent: [9, 9, 9, 9, 9] }),
    [KEEPER_NORMAL]: stats({ appearances: 99, minutes: 7000, recent: [7, 7] }),
    [NORMALS[1]]: stats({ appearances: 30, recent: [8, 8, 8] }),
    ...Object.fromEntries(SPECIALS.map((id) => [id, stats({ appearances: 40, points: 50 })])),
  };
  features.career.collectedIds = ['star-di-santo'];
  features.career.claimedAlbumRewards = ['collect-10'];
  features.cup.injuredPlayerIds = { [ALEXIA]: 2, [NORMALS[3]]: 1, [RESERVE_SPECIAL]: 1 };
  features.cup.suspendedPlayerIds = [NORMALS[4]];
  features.discipline.league = { [ALEXIA]: 2, [LINEUP_SPECIAL]: 1 };
  features.discipline.tournaments = { stadium: { [NORMALS[5]]: 1 } };
  features.discipline.bans = [{ id: 'ban-1', playerId: NORMALS[6], competition: 'league', matches: 1, yellowCards: 3, createdAt: 1, sourceMatchId: 'm1' }];
  features.seasonMode = { ...features.seasonMode, division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, hallOfFame: true, prestigeCount };
  const normalized = normalizeGameFeatures(roundTrip(features));
  // The setup really has the improvements the rules talk about.
  assert.equal(rating(normalized, ALEXIA), 94);
  for (const id of SPECIALS) assert.equal(rating(normalized, id), 90, id);
  assert.ok(normalized.starXI.lineupIds.includes(LINEUP_SPECIAL));
  assert.ok(normalized.starXI.benchIds.includes(BENCH_SPECIAL));
  assert.ok(!normalized.starXI.lineupIds.includes(RESERVE_SPECIAL) && !normalized.starXI.benchIds.includes(RESERVE_SPECIAL));
  return normalized;
}

function hallOfFameGame(prestigeCount = 0): GameState {
  return normalizeRuntimeGame({ goals: 5_000_000, totalGoals: 9_000_000_000, seasonGoals: 8_000_000, clicks: 12_345, stars: 20, seasons: 14, upgrades: allUpgrades(), achievements: [], lastSaved: NOW, features: hallOfFameFeatures(prestigeCount) });
}

/** A real league match with the current squad, won 1:0, recorded like the game records it. */
function playWonMatch(features: GameFeatures, now: number) {
  features.starXI = setBestStarXI(features.starXI, [], { career: features.career, cup: features.cup });
  features.cup = beginSeasonCupMatch(features.cup, features.seasonMode, now, getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds), features.starXI.formationPositions, features.starXI.lineupIds, features.starXI.benchIds);
  prepareCareerMatch(features);
  features.cup.homeScore = 1; features.cup.awayScore = 0; features.cup.active = false;
  recordCareerMatch(features, now);
  return normalizeGameFeatures(roundTrip(features));
}

function soloPrestige(game: GameState, keep: string | null, requestId = 'solo-1', now = NOW) {
  const result = applyGamePrestige(game, keep, now, requestId);
  assert.equal(result.error, '');
  return result.game;
}

test('1 every Club Office upgrade goes back to level 0; unlocks, click and passive power follow the reset levels', () => {
  const before = hallOfFameGame();
  assert.ok(UPGRADES.every((upgrade) => getLevel(before.upgrades, upgrade.id) > 0));
  assert.equal(UPGRADES.length, 27);
  const after = soloPrestige(before, KEEPER_NORMAL);
  for (const upgrade of UPGRADES) assert.equal(getLevel(after.upgrades, upgrade.id), 0, upgrade.id);
  assert.deepEqual(after.upgrades, {});
  // Exactly as in a new game: no passive income from upgrades, clicks at the base value (with the +20 % bonus).
  assert.equal(getBasePassivePower(after.upgrades, after.stars, after.features), getBasePassivePower({}, after.stars, after.features));
  assert.equal(getBasePassivePower(after.upgrades, 0, after.features), 0);
  assert.equal(getBaseClickPower(after.upgrades, after.stars, after.features), getBaseClickPower({}, after.stars, after.features));
  assert.ok(getClickPower(after.upgrades, after.stars, after.features, NOW) < getClickPower(before.upgrades, before.stars, before.features, NOW) / 100);
  assert.equal(getPassivePower(after.upgrades, 0, after.features, NOW), 0);
  // Unlock eligibility stays: the highest league is kept, every upgrade can be bought again right away.
  assert.equal(after.features.seasonMode.highestDivision, SEASON_MODE_DIVISION_COUNT);
  const reached = getReachedLeague(after.seasons, after.features.seasonMode.highestDivision);
  for (const upgrade of UPGRADES) assert.ok(isLeagueContentUnlocked(getUpgradeUnlockLeague(upgrade.id), reached), upgrade.id);
  // Spendable goals 0, lifetime counters, stars and fragments unchanged, +20 % additive.
  assert.equal(after.goals, 0);
  assert.equal(after.totalGoals, before.totalGoals);
  assert.equal(after.clicks, before.clicks);
  assert.equal(after.stars, before.stars);
  assert.equal(after.features.starXI.fragments, before.features.starXI.fragments);
  assert.equal(after.features.seasonMode.prestigeCount, 1);
  // The input is not touched.
  assert.ok(UPGRADES.every((upgrade) => getLevel(before.upgrades, upgrade.id) > 0));
});

test('2 special cards keep their growth from the starting eleven, the bench and the reserve', () => {
  const before = hallOfFameGame();
  const after = soloPrestige(before, KEEPER_NORMAL).features;
  for (const id of SPECIALS) {
    assert.ok(after.starXI.ownedIds.includes(id), id);
    assert.equal(rating(after, id), 90, id);
    assert.equal(getSpecialGrowth(after.career, getStarXIPlayer(id)!).points, 50, id);
  }
});

test('3 the selected normal card keeps its milestone bonus: Alexia kept at 94 stays 94', () => {
  const after = soloPrestige(hallOfFameGame(), ALEXIA).features;
  assert.deepEqual([...after.starXI.ownedIds].sort(), [...SPECIALS, ALEXIA].sort());
  assert.equal(rating(after, ALEXIA), 94);
  assert.equal(rating(normalizeGameFeatures(roundTrip(after)), ALEXIA), 94);
  // Selected by its stable id; a name is not an id.
  assert.match(applyGamePrestige(hallOfFameGame(), 'Alexia Putellaz', NOW, 'by-name').error, /nicht in deinem Kader/);
});

test('4 a discarded Alexia upgraded to 94 comes back at her base rating 91', () => {
  const after = soloPrestige(hallOfFameGame(), KEEPER_NORMAL).features;
  assert.ok(!after.starXI.ownedIds.includes(ALEXIA));
  // Album registration alone does not grant the card or the old bonus.
  assert.ok(after.career.collectedIds.includes(ALEXIA));
  assert.equal(rating(after, ALEXIA), 91);
  const again = normalizeGameFeatures(roundTrip({ ...after, starXI: addStarXIPlayer(after.starXI, ALEXIA) }));
  assert.ok(again.starXI.ownedIds.includes(ALEXIA));
  assert.equal(rating(again, ALEXIA), 91);
  assert.equal(getCareerCard(again.career, getStarXIPlayer(ALEXIA)!).milestone, undefined);
});

test('5 old career statistics do not reapply discarded bonuses, not even the form, while the history stays', () => {
  const before = hallOfFameGame();
  const after = soloPrestige(before, KEEPER_NORMAL).features;
  const again = normalizeGameFeatures(roundTrip({ ...after, starXI: addStarXIPlayer(after.starXI, ALEXIA) }));
  // The history still shows 100 appearances, but milestones count from the Prestige on.
  assert.equal(again.career.players[ALEXIA].appearances, 100);
  assert.equal(again.career.players[ALEXIA].goals, 12);
  assert.deepEqual(getMilestoneStats(again.career, ALEXIA), { appearances: 0, minutes: 0, goals: 0, assists: 0, motm: 0 });
  assert.equal(again.career.milestoneCards[ALEXIA], undefined);
  // The next match does not get any rating bonus for her either.
  const match = structuredClone(again);
  for (const id of NORMALS) match.starXI = addStarXIPlayer(match.starXI, id);
  match.starXI = setBestStarXI(match.starXI, []);
  prepareCareerMatch(match);
  // A bonus of 0 is not stored (every reader reads a missing entry as 0).
  assert.equal(match.cup.careerBonuses?.[ALEXIA] ?? 0, 0);
  // Discarded specials with history (none here) and normals alike: no injuries or bans come back with the card.
  assert.equal(again.cup.injuredPlayerIds[ALEXIA], undefined);
  assert.equal(again.discipline.league[ALEXIA], undefined);
  assert.ok(!again.discipline.bans.some((ban) => ban.playerId === NORMALS[6]));
  assert.ok(!again.cup.suspendedPlayerIds.includes(NORMALS[4]));
});

test('6 retained and new cards keep progressing after Prestige', () => {
  let features = soloPrestige(hallOfFameGame(), KEEPER_NORMAL).features;
  // The retained normal card had 99 appearances (+2); one more match unlocks its 100 appearance milestone (+3).
  const keeperBase = getStarXIPlayer(KEEPER_NORMAL)!.rating;
  assert.equal(rating(features, KEEPER_NORMAL), keeperBase + 2);
  // The squad is rebuilt with packs, Alexia among them; she has played 9 matches since.
  for (const id of [ALEXIA, ...NORMALS.slice(1, 12)]) features.starXI = addStarXIPlayer(features.starXI, id);
  features.career.players[ALEXIA] = { ...features.career.players[ALEXIA], appearances: 109 };
  // A special grows on: 54 points, a win adds 3, so 57 points are level 11.
  features.career.players[LINEUP_SPECIAL] = { ...features.career.players[LINEUP_SPECIAL], points: 54 };
  features = normalizeGameFeatures(roundTrip(features));
  assert.equal(rating(features, ALEXIA), 91);
  features = playWonMatch(features, NOW + 60_000);
  for (const id of [KEEPER_NORMAL, ALEXIA, LINEUP_SPECIAL]) assert.ok(features.career.reports.at(-1)!.players.some((player) => player.playerId === id), `${id} played`);
  assert.equal(rating(features, KEEPER_NORMAL), keeperBase + 3);
  assert.equal(rating(features, ALEXIA), 92, 'Alexia earns her first milestone again after 10 new appearances');
  assert.equal(rating(features, LINEUP_SPECIAL), 91);
  assert.equal(rating(normalizeGameFeatures(roundTrip(features)), ALEXIA), 92);
});

test('7 album and historical statistics stay; registration never grants ownership', () => {
  const before = hallOfFameGame();
  const after = soloPrestige(before, KEEPER_NORMAL).features;
  const reloaded = normalizeGameFeatures(roundTrip(after));
  for (const id of [...SPECIALS, ALEXIA, ...NORMALS, 'star-di-santo']) assert.ok(reloaded.career.collectedIds.includes(id), id);
  assert.deepEqual([...reloaded.starXI.ownedIds].sort(), [...SPECIALS, KEEPER_NORMAL].sort());
  for (const [id, stats] of Object.entries(before.features.career.players)) {
    assert.deepEqual({ ...reloaded.career.players[id], recent: [] }, { ...stats, recent: [] }, id);
  }
  assert.deepEqual(reloaded.career.reports, before.features.career.reports);
  assert.deepEqual(reloaded.career.awards, before.features.career.awards);
  // The retained cards keep their form as well.
  assert.deepEqual(reloaded.career.players[KEEPER_NORMAL].recent, [7, 7]);
});

test('8 claimed album rewards stay claimed and cannot be claimed again', () => {
  const after = soloPrestige(hallOfFameGame(), KEEPER_NORMAL).features;
  const reloaded = normalizeGameFeatures(roundTrip(after));
  assert.deepEqual(reloaded.career.claimedAlbumRewards, ['collect-10']);
  assert.equal(getAlbumGroups(reloaded.career).find((group) => group.id === 'collect-10')?.claimed, true);
  const fragments = reloaded.starXI.fragments;
  assert.equal(claimAlbumReward(reloaded, 'collect-10'), false);
  assert.equal(reloaded.starXI.fragments, fragments);
  const claimedBefore = reloaded.career.claimedAlbumRewards.length;
  claimAllAlbumRewards(reloaded);
  assert.ok(reloaded.career.claimedAlbumRewards.filter((id) => id === 'collect-10').length === 1);
  assert.ok(reloaded.career.claimedAlbumRewards.length >= claimedBefore);
});

test('roster cleanup: the retained cards fill the eleven, nothing points at discarded cards', () => {
  const after = soloPrestige(hallOfFameGame(), KEEPER_NORMAL).features;
  const owned = new Set(after.starXI.ownedIds);
  for (const id of [...after.starXI.lineupIds, ...after.starXI.benchIds].filter(Boolean)) assert.ok(owned.has(id), id);
  // Fit retained cards play; the injured reserve special stays out until it is fit.
  assert.ok(after.starXI.lineupIds.includes(LINEUP_SPECIAL));
  assert.ok(after.starXI.lineupIds.includes(BENCH_SPECIAL) || after.starXI.benchIds.includes(BENCH_SPECIAL));
  assert.ok(after.starXI.lineupIds.includes(KEEPER_NORMAL) || after.starXI.benchIds.includes(KEEPER_NORMAL));
  assert.ok(![...after.starXI.lineupIds, ...after.starXI.benchIds].includes(RESERVE_SPECIAL));
  assert.deepEqual(after.cup.injuredPlayerIds, { [RESERVE_SPECIAL]: 1 });
  assert.deepEqual(after.cup.suspendedPlayerIds, []);
  assert.deepEqual(after.discipline.league, { [LINEUP_SPECIAL]: 1 });
  assert.deepEqual(after.discipline.bans, []);
  assert.deepEqual(after.discipline.tournaments.stadium ?? {}, {});
});

test('travel fines of an arrived journey are paid before the goals go to 0', () => {
  const game = hallOfFameGame();
  const journey = createJourney({ ...fixtureFor(game.features, 'season'), away: true, venue: VENUES.miami }, NOW - 600_000, () => 0.99, game.features);
  game.features.travel.journey = { ...journey, consumed: true, events: [{ id: 'speeding', text: 'Raser', at: 0, delta: 0, fine: 60 }], endsAt: NOW - 1000 };
  // The match of that journey is over (no squad lock any more).
  delete game.features.squadLock;
  delete (game.features.travel.journey as { squadLock?: unknown }).squadLock;
  const after = soloPrestige(game, KEEPER_NORMAL);
  const fine = after.features.history.find((entry) => entry.title === 'Reisebusse bezahlt');
  assert.ok(fine, 'the fine is booked');
  assert.doesNotMatch(fine.detail, /-0 Tore/);
  assert.ok(after.seasonGoals < game.seasonGoals);
  assert.equal(after.goals, 0);
  assert.equal(after.totalGoals, game.totalGoals);
});

test('10 a repeated request (double click, retry) applies Prestige once', () => {
  const first = soloPrestige(hallOfFameGame(), KEEPER_NORMAL, 'same');
  // Played on and bought upgrades since: a late duplicate must not reset them again.
  const later = { ...first, goals: 1234, upgrades: { boots: 4 } };
  const retry = applyGamePrestige(later, KEEPER_NORMAL, NOW + 5000, 'same');
  assert.equal(retry.duplicate, true);
  assert.equal(retry.game, later);
  assert.equal(retry.game.features.seasonMode.prestigeCount, 1);
  assert.equal(retry.game.features.history.filter((entry) => /^Prestige \d+ gestartet$/.test(entry.title)).length, 1);
  // Without the Hall of Fame no second Prestige can start from the same screen either.
  assert.match(applyGamePrestige(later, KEEPER_NORMAL, NOW + 5000, 'other').error, /Hall of Fame/);
});

test('11 saving, normalizing and reloading keep the reset; old saves load unchanged; older saves do not win', () => {
  const before = hallOfFameGame();
  const after = { ...soloPrestige(before, KEEPER_NORMAL), lastSaved: NOW + 1 };
  const reloaded = normalizeRuntimeGame(roundTrip(after));
  assert.deepEqual(reloaded.upgrades, {});
  assert.deepEqual(reloaded.features.career, after.features.career);
  assert.deepEqual(reloaded.features.starXI, after.features.starXI);
  assert.deepEqual(normalizeRuntimeGame(roundTrip(reloaded)).features, reloaded.features, 'normalization is stable');
  assert.ok(reloaded.features.career.milestoneBase[ALEXIA]);
  // A save from before this update (no milestone baseline) keeps every card's improvements: no retroactive rewrite.
  const old = roundTrip(before) as unknown as { features: { career: Record<string, unknown> } };
  delete old.features.career.milestoneBase;
  const oldLoaded = normalizeRuntimeGame(old);
  assert.equal(rating(oldLoaded.features, ALEXIA), 94);
  assert.deepEqual(oldLoaded.features.career.milestoneBase, {});
  // The save from before the Prestige has the same lifetime goals and more cards and upgrades, yet it never wins.
  const preRaw = JSON.stringify(before), postRaw = JSON.stringify(after);
  assert.equal(shouldRejectRegressedSave(roundTrip(after), { ...roundTrip(before), lastSaved: NOW + 10 }), true);
  assert.equal(shouldRejectRegressedSave(roundTrip(before), roundTrip(after)), false);
  assert.equal(selectSafestStoredGame([{ key: 'main', raw: null }, { key: 'backup', raw: preRaw }, { key: 'recovery', raw: postRaw }])?.key, 'recovery');
});

// Co-op: the same reset through the route, with the shared upgrades column.
let row: RoomRow;
GoalClickerDatabase.prototype.getRoom = async (code) => code === row.code ? structuredClone(row) : null;
GoalClickerDatabase.prototype.updateRoom = async (code, values: RoomUpdate, conditions = {}) => {
  if (code !== row.code) return null;
  if (conditions.sharedStateVersion !== undefined && conditions.sharedStateVersion !== row.sharedStateVersion) return null;
  if (conditions.lastPassiveAt !== undefined && conditions.lastPassiveAt !== row.lastPassiveAt) return null;
  row = { ...row, ...values }; return structuredClone(row);
};
installLightRoomMocks(GoalClickerDatabase);
function setupRoom(game: GameState) {
  clearRoomCacheForTests();
  const iso = new Date().toISOString();
  const defaults = Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([key, column]) => [key, column.default ?? null]));
  row = { ...defaults, code: 'PRESTR', hostPlayerId: 'host-player-123', hostName: 'Nicolas', guestPlayerId: 'guest-player-123', guestName: 'Silvan', hostLastSeenAt: iso, guestLastSeenAt: iso, lastPassiveAt: iso, updatedAt: iso, sharedCoins: game.goals, sharedTotalGoals: game.totalGoals, sharedSeasonGoals: game.seasonGoals, sharedStars: game.stars, sharedSeasons: game.seasons, sharedUpgradesJson: JSON.stringify(game.upgrades), sharedUpgradeLevel: Object.values(game.upgrades).reduce((sum, level) => sum + level, 0), sharedFeaturesJson: JSON.stringify(game.features) } as RoomRow;
}
async function post(action: string, extra: Record<string, unknown>, playerId = 'host-player-123') {
  const response = await POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, code: 'PRESTR', playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION, ...extra }) }));
  return { status: response.status, data: await response.json() as { error?: string; errorCode?: string; room?: { game: { features?: GameFeatures } } } };
}
const storedFeatures = () => normalizeGameFeatures(JSON.parse(row.sharedFeaturesJson));

test('9 solo and co-op produce the same reset', async () => {
  const solo = soloPrestige(hallOfFameGame(), ALEXIA, 'equal-1', Date.now());
  setupRoom(hallOfFameGame());
  assert.equal((await post('season-prestige', { requestId: 'equal-1', keepNormalId: ALEXIA, expectedPrestigeCount: 0 })).status, 200);
  const coop = storedFeatures();
  assert.deepEqual(JSON.parse(row.sharedUpgradesJson), {});
  assert.equal(row.sharedUpgradeLevel, 0);
  assert.equal(row.sharedCoins, 0);
  assert.equal(row.pendingUpgradeId, null);
  assert.deepEqual(solo.upgrades, {});
  assert.equal(solo.goals, 0);
  // Lifetime goals stay (the room only adds the passive income of the last moments).
  assert.ok(row.sharedTotalGoals >= solo.totalGoals);
  assert.deepEqual(coop.starXI, solo.features.starXI);
  assert.deepEqual(coop.career, solo.features.career);
  assert.deepEqual(coop.discipline, solo.features.discipline);
  assert.deepEqual(coop.cup.injuredPlayerIds, solo.features.cup.injuredPlayerIds);
  // The saga timer depends on when the room was last refreshed, the rest must match.
  assert.deepEqual({ ...coop.transferSaga, nextAt: 0 }, { ...solo.features.transferSaga, nextAt: 0 });
  assert.equal(coop.seasonMode.prestigeCount, solo.features.seasonMode.prestigeCount);
  assert.equal(rating(coop, ALEXIA), 94);
  for (const id of SPECIALS) assert.equal(rating(coop, id), 90);
  assert.ok(!coop.career.milestoneCards[KEEPER_NORMAL]?.length && coop.career.milestoneBase[KEEPER_NORMAL]);
});

test('10 co-op: a retried request or the other seat applies Prestige once; upgrades bought since stay; another seat is told', async () => {
  setupRoom(hallOfFameGame());
  const request = { requestId: 'coop-dup', keepNormalId: KEEPER_NORMAL, expectedPrestigeCount: 0 };
  assert.equal((await post('season-prestige', request)).status, 200);
  // The team earns goals and buys an upgrade again after Prestige.
  row = { ...row, sharedCoins: 1_000 };
  clearRoomCacheForTests();
  assert.equal((await post('buy', { upgradeId: 'boots', count: 1 })).status, 200);
  assert.deepEqual(JSON.parse(row.sharedUpgradesJson), { boots: 1 });
  const coins = row.sharedCoins;
  assert.equal((await post('season-prestige', request)).status, 200);
  assert.equal((await post('season-prestige', request, 'guest-player-123')).status, 200);
  assert.deepEqual(JSON.parse(row.sharedUpgradesJson), { boots: 1 });
  assert.equal(row.sharedCoins, coins);
  assert.equal(storedFeatures().seasonMode.prestigeCount, 1);
  assert.equal(storedFeatures().history.filter((entry) => /^Prestige \d+ gestartet$/.test(entry.title)).length, 1);
  // The other seat confirms its own dialog late: rejected, and the answer carries the world that already restarted.
  const late = await post('season-prestige', { requestId: 'coop-late', keepNormalId: KEEPER_NORMAL, expectedPrestigeCount: 0 }, 'guest-player-123');
  assert.equal(late.status, 409);
  assert.equal(late.data.errorCode, 'PRESTIGE_ALREADY_STARTED');
  assert.equal(late.data.room?.game.features?.seasonMode.prestigeCount, 1);
  assert.deepEqual(JSON.parse(row.sharedUpgradesJson), { boots: 1 });
});

test('11 co-op: reloading the room keeps every upgrade at 0 and the card baselines', async () => {
  setupRoom(hallOfFameGame());
  assert.equal((await post('season-prestige', { requestId: 'coop-reload', keepNormalId: KEEPER_NORMAL, expectedPrestigeCount: 0 })).status, 200);
  clearRoomCacheForTests();
  const state = await post('join', { nickname: 'Nicolas' });
  assert.equal(state.status, 200);
  const features = state.data.room!.game.features!;
  assert.equal(rating(normalizeGameFeatures(features), ALEXIA), 91);
  // The full backup copy of the world carries the reset as well, so no fallback brings old levels back.
  assert.deepEqual(JSON.parse(row.sharedStateBackupJson).upgrades, {});
  assert.equal(applySeasonPrestige(storedFeatures(), KEEPER_NORMAL, NOW, 'x').error.length > 0, true);
});
