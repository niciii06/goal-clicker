// Owner decision 6 (2026-11-06): a red card suspends for the next match of the same competition, like the yellow
// card bans. Older saves keep their suspension without a competition, served by the next match of any competition.
import assert from 'node:assert/strict';
import test from 'node:test';
import { beginCupMatch, beginSeasonCupMatch, getBestXIUnavailablePlayerIds, getStarXISelection, getUnavailableStarXIPlayerIds, initialGameFeatures, normalizeGameFeatures, setBestStarXI, STAR_XI_PLAYERS } from '../app/feature-data';
import type { GameFeatures, TournamentId } from '../app/feature-data';
import { competitionFor, getBannedPlayerIds, processMatchDiscipline, squadBanError, suspensionLabel } from '../app/discipline';
import { recordCareerMatch } from '../app/career-data';
import { eligibilityError } from '../app/travel-data';
import { createMatchBroadcast } from '../app/match-broadcast';

const ready = () => { const f = initialGameFeatures(1000); f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.filter(p => !p.retired).slice(0, 400).map(p => p.id) }); return f; };
let counter = 0;
/** A finished match in which `red` was sent off (the engine puts him into both lists, as interactive-match.ts does). */
function finishMatch(f: GameFeatures, competition: { mode: 'season' } | { mode: 'tournament'; tournamentId: TournamentId; continues: boolean }, red: string[] = [], played = f.starXI.lineupIds.filter(Boolean)) {
  const id = `red-match-${++counter}`;
  f.cup.mode = competition.mode;
  if (competition.mode === 'tournament') { f.cup.tournamentId = competition.tournamentId; f.cup.pendingNextRound = competition.continues; } else { f.cup.pendingNextRound = false; f.cup.tournamentId = 'stadium'; }
  f.cup.active = false;
  f.cup.matchStartedAt = 1000 + counter;
  f.cup.careerMatchId = id;
  f.cup.playerEnteredAt = Object.fromEntries(played.map(p => [p, 1]));
  f.cup.sentOffPlayerIds = [...red];
  f.cup.suspendedPlayerIds = [...f.cup.suspendedPlayerIds, ...red];
  f.cup.broadcast = { ...createMatchBroadcast(f.cup), events: [] };
  return id;
}
const squadOf = (f: GameFeatures) => [...f.starXI.lineupIds, ...f.starXI.benchIds];

test('a league red card bans for the next league match only, not for a tournament', () => {
  const f = ready(), player = f.starXI.lineupIds[5];
  const id = finishMatch(f, { mode: 'season' }, [player]);
  const bans = processMatchDiscipline(f, id, 5000);
  assert.deepEqual(bans.map(b => [b.playerId, b.competition, b.reason, b.matches]), [[player, 'league', 'red', 1]]);
  assert.equal(suspensionLabel(bans[0]), 'Gesperrt: 1 Spiel (Rote Karte) · Liga');
  assert.deepEqual(f.cup.suspendedPlayerIds, [], 'the competition ban replaces the old any-match suspension');
  assert.deepEqual(getBannedPlayerIds(f, 'league'), [player]);
  assert.deepEqual(getBannedPlayerIds(f, 'tournament:stadium'), []);
  assert.ok(!getUnavailableStarXIPlayerIds(f).includes(player), 'not blocked for every competition');
  // Back in the squad: a tournament may start, the league match may not.
  assert.equal(squadBanError(f, competitionFor('tournament', 'stadium')), null);
  assert.equal(eligibilityError(f, 'tournament', 'stadium', 10000), null);
  assert.match(squadBanError(f, 'league') ?? '', /nach einer Roten Karte/);
  assert.match(eligibilityError(f, 'season', 'stadium', 10000) ?? '', /Roten Karte/);
  // Processing the same match again changes nothing.
  assert.deepEqual(processMatchDiscipline(f, id, 5001), []);
  assert.equal(f.discipline.bans.length, 1);
});

test('the league red card is served by the next league match, a tournament match in between does not serve it', () => {
  const f = ready(), player = f.starXI.lineupIds[5];
  processMatchDiscipline(f, finishMatch(f, { mode: 'season' }, [player]), 5000);
  const others = f.starXI.lineupIds.filter(id => id && id !== player);
  // He plays a whole tournament run in between.
  processMatchDiscipline(f, finishMatch(f, { mode: 'tournament', tournamentId: 'stadium', continues: false }, [], [...others.slice(0, 10), player]), 6000);
  assert.deepEqual(getBannedPlayerIds(f, 'league'), [player], 'still banned for the league');
  processMatchDiscipline(f, finishMatch(f, { mode: 'season' }, [], others), 7000);
  assert.deepEqual(getBannedPlayerIds(f, 'league'), [], 'served by the next league match');
});

test('a tournament red card bans for the next match of that run; the league stays open', () => {
  const f = ready(), player = f.starXI.lineupIds[2];
  processMatchDiscipline(f, finishMatch(f, { mode: 'tournament', tournamentId: 'champions', continues: true }, [player]), 5000);
  assert.deepEqual(getBannedPlayerIds(f, 'tournament:champions'), [player]);
  assert.deepEqual(getBannedPlayerIds(f, 'league'), []);
  assert.deepEqual(getBannedPlayerIds(f, 'tournament:stadium'), []);
  assert.ok(getBestXIUnavailablePlayerIds(f).includes(player), 'Beste Startelf leaves him out for the pending round');
  assert.equal(squadBanError(f, 'league'), null);
  // Like the yellow card bans, an unserved ban ends with the run.
  processMatchDiscipline(f, finishMatch(f, { mode: 'tournament', tournamentId: 'champions', continues: false }, [], f.starXI.lineupIds.filter(id => id && id !== player)), 6000);
  assert.deepEqual(getBannedPlayerIds(f, 'tournament:champions'), []);
});

test('recordCareerMatch turns a red card into a competition ban and keeps him out of the next league squad', () => {
  const f = ready(), player = f.starXI.lineupIds[7];
  finishMatch(f, { mode: 'season' }, [player]);
  recordCareerMatch(f, 9000);
  assert.ok(!squadOf(f).includes(player), 'out of the eleven and the bench for the next league match');
  assert.deepEqual(getBannedPlayerIds(f, 'league'), [player]);
  assert.match(JSON.stringify(f.history.slice(-5)), /Rotsperre/);
  const restored = normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
  assert.deepEqual(restored.discipline.bans.map(b => b.reason), ['red']);
  assert.deepEqual(getBannedPlayerIds(restored, 'league'), [player]);
});

test('old saves: a red card suspension without competition is served by the next match of any competition, as before', () => {
  for (const next of ['season', 'tournament'] as const) {
    const f = ready(), player = f.starXI.lineupIds[4];
    // A save from before: the red card only sits in cup.suspendedPlayerIds, no ban in the discipline record.
    const saved = JSON.parse(JSON.stringify({ ...f, cup: { ...f.cup, active: false, suspendedPlayerIds: [player] } }));
    const restored = normalizeGameFeatures(saved);
    assert.deepEqual(restored.cup.suspendedPlayerIds, [player], 'kept through loading');
    assert.ok(getUnavailableStarXIPlayerIds(restored).includes(player), 'blocked for every competition');
    assert.ok(!squadOf(restored).includes(player));
    assert.deepEqual(getBannedPlayerIds(restored, 'league'), []);
    assert.deepEqual(getBannedPlayerIds(restored, 'tournament:stadium'), []);
    const players = getStarXISelection(restored.starXI.ownedIds, restored.starXI.lineupIds);
    const cup = next === 'season'
      ? beginSeasonCupMatch(restored.cup, restored.seasonMode, 50_000, players, restored.starXI.formationPositions, restored.starXI.lineupIds, restored.starXI.benchIds)
      : beginCupMatch(restored.cup, 50_000, 'stadium', players, restored.starXI.formationPositions, restored.starXI.lineupIds, restored.starXI.benchIds);
    assert.deepEqual(cup.suspendedPlayerIds, [], `served by the next ${next} match`);
    // Finishing that match leaves no ban behind for him in any competition.
    restored.cup = { ...cup, active: false, sentOffPlayerIds: [] };
    processMatchDiscipline(restored, `legacy-${next}`, 60_000);
    assert.equal(restored.discipline.bans.filter(b => b.playerId === player).length, 0);
  }
});

test('bans saved before red card bans load as yellow card bans', () => {
  const f = ready(), player = f.starXI.lineupIds[1];
  const saved = JSON.parse(JSON.stringify(f));
  saved.discipline.bans = [{ id: 'old', playerId: player, competition: 'league', matches: 1, yellowCards: 3, createdAt: 1, sourceMatchId: 'm' }];
  const restored = normalizeGameFeatures(saved);
  assert.equal(restored.discipline.bans[0].reason, undefined);
  assert.equal(suspensionLabel(restored.discipline.bans[0]), 'Gesperrt: 1 Spiel (3 Gelbe Karten) · Liga');
  assert.match(squadBanError({ ...restored, starXI: { ...restored.starXI, lineupIds: [player, ...restored.starXI.lineupIds.slice(1)] } }, 'league') ?? '', /nach Gelben Karten/);
});
