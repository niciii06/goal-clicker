// "Turnier aufgeben" after "Reise antreten" (hotfix): giving up is refused while the squad travels to the next round,
// saves that older builds left stuck (unconsumed journey + squad lock of a given up run) are repaired on load, and
// giving up ends the run's yellow cards and bans like an elimination.
import assert from 'node:assert/strict';
import test from 'node:test';
import { STAR_XI_PLAYERS, TOURNAMENT_COOLDOWN_MS, getPrestigeBlockReason, normalizeGameFeatures, repairAbandonedTournamentJourney, setBestStarXI } from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';
import { fixtureFor, travelGate, eligibilityError } from '../app/travel-data.ts';
import { abandonTournamentBlockReason, abandonTournamentRun, canAbandonTournament } from '../app/game/tournament-abandon.ts';
import { competitionFor, squadBanError } from '../app/discipline.ts';

const NOW = 1_800_000_000_000;

function squad(): GameFeatures {
  const f = normalizeGameFeatures({});
  const ids = STAR_XI_PLAYERS.filter((p) => !p.isCustom && !p.id.startsWith('scrap-') && !p.benchOnly).slice(0, 40).map((p) => p.id);
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: ids }, []);
  f.starterSquadGranted = true;
  return f;
}
function waitingRun(): GameFeatures {
  const f = squad();
  f.cup = { ...f.cup, mode: 'tournament', tournamentId: 'stadium', pendingNextRound: true, round: 1, matchStartedAt: NOW - 600_000 };
  return f;
}
function departed(): GameFeatures {
  const f = waitingRun();
  assert.equal(travelGate(f, fixtureFor(f, 'tournament', 'stadium'), NOW, true), 'Reise gestartet.');
  assert.ok(f.travel.journey && f.squadLock);
  return f;
}
/** What the builds before the hotfix did: give up without looking at the journey. */
function oldAbandon(value: GameFeatures, now: number): GameFeatures {
  const f = structuredClone(value);
  const runId = `${f.cup.tournamentId}:${f.cup.matchStartedAt}`;
  f.cup = { ...f.cup, pendingNextRound: false, round: 0, nextTournamentAt: now + TOURNAMENT_COOLDOWN_MS, lastResult: 'Turnier nach Runde 1 aufgegeben.' };
  f.completedTournamentRuns = [...f.completedTournamentRuns, runId];
  return f;
}
const reload = (f: GameFeatures) => normalizeGameFeatures(JSON.parse(JSON.stringify(f)));

test('giving up is refused once the squad has set off for the next round', () => {
  const f = departed();
  assert.equal(canAbandonTournament(f), false);
  assert.match(abandonTournamentBlockReason(f)!, /unterwegs/);
  assert.equal(abandonTournamentRun(f, NOW + 1000), null);
  // A squad lock alone (journey already gone) blocks as well.
  const lockOnly = structuredClone(f); lockOnly.travel = { ...lockOnly.travel, journey: null };
  assert.equal(canAbandonTournament(lockOnly), false);
  // Before departing, giving up still works.
  assert.ok(abandonTournamentRun(waitingRun(), NOW));
});

test('a save stuck by the old behaviour is repaired on load and plays again', () => {
  const stuck = oldAbandon(departed(), NOW + 1000);
  assert.ok(stuck.travel.journey && !stuck.travel.journey.consumed && stuck.squadLock);
  const later = NOW + 3_600_000;
  assert.match(String(travelGate(structuredClone(stuck), fixtureFor(stuck, 'season'), later, true)), /bereits begonnene/);
  const repaired = reload(stuck);
  assert.equal(repaired.travel.journey, null);
  assert.equal(repaired.squadLock, undefined);
  assert.equal(travelGate(structuredClone(repaired), fixtureFor(repaired, 'season'), later, true) === 'Schliesse zuerst die bereits begonnene Auswärtsreise ab.', false);
  assert.equal(eligibilityError(repaired, 'season', 'stadium', later), null);
  assert.notEqual(getPrestigeBlockReason(repaired), 'Die letzte Partie wird noch abgeschlossen.');
  // Nothing else changes.
  for (const key of ['completedTournamentRuns', 'history', 'earnedPacks', 'discipline'] as const) assert.deepEqual(repaired[key], stuck[key], key);
  assert.deepEqual([repaired.starXI.ownedIds, repaired.starXI.lineupIds, repaired.starXI.benchIds], [stuck.starXI.ownedIds, stuck.starXI.lineupIds, stuck.starXI.benchIds]);
  assert.deepEqual([repaired.cup.pendingNextRound, repaired.cup.round, repaired.cup.nextTournamentAt, repaired.cup.lastResult, repaired.cup.trophies], [stuck.cup.pendingNextRound, stuck.cup.round, stuck.cup.nextTournamentAt, stuck.cup.lastResult, stuck.cup.trophies]);
  assert.deepEqual(repaired.travel.stats, stuck.travel.stats);
  // Idempotent.
  assert.deepEqual(reload(repaired).travel.journey, null);
});

test('legitimate journeys are never touched by the repair', () => {
  // The current tournament round on its way.
  const current = departed();
  assert.equal(repairAbandonedTournamentJourney(current, NOW), false);
  const reloaded = reload(current);
  assert.equal(reloaded.travel.journey?.id, current.travel.journey?.id);
  assert.ok(reloaded.squadLock);
  // A new tournament run (round 0) on its way after the break.
  const fresh = squad();
  fresh.cup = { ...fresh.cup, pendingNextRound: false, round: 0, nextTournamentAt: NOW - 1, mode: 'tournament', tournamentId: 'stadium' };
  fresh.completedTournamentRuns = ['stadium:123'];
  assert.equal(travelGate(fresh, fixtureFor(fresh, 'tournament', 'stadium'), NOW, true), 'Reise gestartet.');
  assert.equal(repairAbandonedTournamentJourney(fresh, NOW), false);
  assert.ok(reload(fresh).travel.journey && reload(fresh).squadLock);
  // A league away match on its way.
  let league = squad();
  for (let i = 0; i < 4 && !fixtureFor(league, 'season').away; i++) league = { ...league, seasonMode: { ...league.seasonMode, matchday: league.seasonMode.matchday + 1 } };
  const fixture = fixtureFor(league, 'season');
  assert.ok(fixture.away);
  assert.equal(travelGate(league, fixture, NOW, true), 'Reise gestartet.');
  assert.equal(repairAbandonedTournamentJourney(league, NOW), false);
  assert.ok(reload(league).travel.journey && reload(league).squadLock);
  // The round of a finished run whose journey was already consumed (match played) stays as it is.
  const played = oldAbandon(departed(), NOW);
  played.travel.journey!.consumed = true;
  assert.equal(repairAbandonedTournamentJourney(played, NOW), false);
});

test('giving up ends the run discipline like an elimination', () => {
  const f = waitingRun();
  const [p, q] = f.starXI.lineupIds;
  f.discipline = { ...f.discipline, league: { [q]: 2 }, tournaments: { stadium: { [p]: 1 }, champions: { [q]: 1 } }, bans: [
    { id: 'x', playerId: p, competition: 'tournament:stadium', matches: 1, yellowCards: 0, createdAt: NOW, sourceMatchId: 'm', reason: 'red' },
    { id: 'y', playerId: q, competition: 'league', matches: 1, yellowCards: 3, createdAt: NOW, sourceMatchId: 'm' },
  ] };
  const before = structuredClone(f.discipline);
  const after = abandonTournamentRun(f, NOW)!;
  assert.equal(after.discipline.tournaments.stadium, undefined);
  assert.deepEqual(after.discipline.tournaments.champions, { [q]: 1 });
  assert.deepEqual(after.discipline.league, { [q]: 2 });
  assert.deepEqual(after.discipline.bans.map((b) => b.id), ['y']);
  assert.deepEqual(f.discipline, before, 'the input is not mutated');
  const nextRun = { ...after, cup: { ...after.cup, nextTournamentAt: NOW - 1 } };
  assert.equal(squadBanError(nextRun, competitionFor('tournament', 'stadium')), null);
});
