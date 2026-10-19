import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialGameFeatures, normalizeGameFeatures, STAR_XI_PLAYERS, setBestStarXI, getBestXIUnavailablePlayerIds, matchChangeError } from '../app/feature-data';
import type { GameFeatures, TournamentId } from '../app/feature-data';
import { processMatchDiscipline, getBannedPlayerIds, yellowCardStatus, suspensionLabel, squadBanError, competitionFor, LEAGUE_YELLOW_LIMIT, TOURNAMENT_YELLOW_LIMIT } from '../app/discipline';
import { recordCareerMatch } from '../app/career-data';
import { eligibilityError } from '../app/travel-data';
import { validateMatchDraft } from '../app/match-commands';
import { DisciplineTags } from '../app/career-panels';
import { createMatchBroadcast } from '../app/match-broadcast';

const ready = () => { const f = initialGameFeatures(1000); f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.filter(p => !p.retired).slice(0, 400).map(p => p.id) }); return f; };
let matchCounter = 0;
/** A finished match of one competition in which the given players saw one yellow card each. */
function playMatch(f: GameFeatures, competition: { mode: 'season' } | { mode: 'tournament'; tournamentId: TournamentId; continues: boolean }, yellow: string[], played = f.starXI.lineupIds.filter(Boolean)) {
  const id = `match-${++matchCounter}`;
  f.cup.mode = competition.mode;
  if (competition.mode === 'tournament') { f.cup.tournamentId = competition.tournamentId; f.cup.pendingNextRound = competition.continues; } else f.cup.pendingNextRound = false;
  f.cup.active = false;
  f.cup.matchStartedAt = 1000 + matchCounter;
  f.cup.careerMatchId = id;
  f.cup.playerEnteredAt = Object.fromEntries(played.map(p => [p, 1]));
  f.cup.sentOffPlayerIds = [];
  f.cup.broadcast = { ...createMatchBroadcast(f.cup), events: yellow.map((playerId, i) => ({ id: `${id}:y${i}`, kind: 'yellow' as const, side: 'club' as const, minute: 20 + i, at: 0, playerId, player: playerId, style: 'ground' as const, lane: 34, seed: 0 })) };
  return processMatchDiscipline(f, id, 5000 + matchCounter);
}

test('three league yellows suspend for exactly one league match, two do not', () => {
  const f = ready(), player = f.starXI.lineupIds[3];
  playMatch(f, { mode: 'season' }, [player]);
  playMatch(f, { mode: 'season' }, [player]);
  assert.deepEqual(getBannedPlayerIds(f, 'league'), [], 'two yellows: no ban');
  assert.deepEqual(yellowCardStatus(f, player), [{ competition: 'league', label: 'Liga', count: 2, limit: LEAGUE_YELLOW_LIMIT }]);
  const bans = playMatch(f, { mode: 'season' }, [player]);
  assert.equal(bans.length, 1);
  assert.deepEqual(getBannedPlayerIds(f, 'league'), [player]);
  assert.equal(suspensionLabel(bans[0]), 'Gesperrt – 1 Spiel (3 Gelbe Karten) · Liga');
  assert.equal(getBannedPlayerIds(f, 'tournament:stadium').length, 0, 'a league ban does not block tournaments');
  // Served by the next completed league match he does not play.
  playMatch(f, { mode: 'season' }, [], f.starXI.lineupIds.filter(id => id && id !== player));
  assert.deepEqual(getBannedPlayerIds(f, 'league'), []);
  // The fourth and fifth yellows do not re-trigger; the sixth does.
  playMatch(f, { mode: 'season' }, [player]);
  playMatch(f, { mode: 'season' }, [player]);
  assert.equal(getBannedPlayerIds(f, 'league').length, 0);
  assert.equal(playMatch(f, { mode: 'season' }, [player]).length, 1);
});

test('two yellows in one tournament suspend for that tournament only', () => {
  const f = ready(), player = f.starXI.lineupIds[5];
  playMatch(f, { mode: 'tournament', tournamentId: 'stadium', continues: true }, [player]);
  assert.deepEqual(getBannedPlayerIds(f, 'tournament:stadium'), []);
  const bans = playMatch(f, { mode: 'tournament', tournamentId: 'stadium', continues: true }, [player]);
  assert.equal(bans.length, 1);
  assert.equal(bans[0].yellowCards, TOURNAMENT_YELLOW_LIMIT);
  assert.deepEqual(getBannedPlayerIds(f, 'tournament:stadium'), [player]);
  assert.deepEqual(getBannedPlayerIds(f, 'league'), []);
  assert.deepEqual(getBannedPlayerIds(f, 'tournament:champions'), []);
  // A league match in between does not serve the tournament ban.
  playMatch(f, { mode: 'season' }, [], f.starXI.lineupIds.filter(id => id && id !== player));
  assert.deepEqual(getBannedPlayerIds(f, 'tournament:stadium'), [player]);
  playMatch(f, { mode: 'tournament', tournamentId: 'stadium', continues: true }, [], f.starXI.lineupIds.filter(id => id && id !== player));
  assert.deepEqual(getBannedPlayerIds(f, 'tournament:stadium'), [], 'served in the next match of that tournament');
});

test('competitions accumulate separately', () => {
  const f = ready(), a = f.starXI.lineupIds[2];
  playMatch(f, { mode: 'season' }, [a]);
  playMatch(f, { mode: 'season' }, [a]);
  playMatch(f, { mode: 'tournament', tournamentId: 'stadium', continues: true }, [a]);
  playMatch(f, { mode: 'tournament', tournamentId: 'champions', continues: true }, [a]);
  assert.equal(f.discipline.bans.length, 0, 'League 2, Tournament 1: 1, Tournament 2: 1 is no ban');
  playMatch(f, { mode: 'season' }, [a]);
  assert.deepEqual(f.discipline.bans.map(b => b.competition), ['league']);
  playMatch(f, { mode: 'tournament', tournamentId: 'stadium', continues: true }, [a]);
  assert.deepEqual(f.discipline.bans.map(b => b.competition).sort(), ['league', 'tournament:stadium']);
  assert.deepEqual(getBannedPlayerIds(f, 'tournament:champions'), []);
});

test('suspended players cannot start, sit on the bench, come on or be auto picked', () => {
  const f = ready(), player = f.starXI.lineupIds[4];
  for (let i = 0; i < 3; i++) playMatch(f, { mode: 'season' }, [player]);
  assert.match(squadBanError(f, competitionFor('season', 'stadium'))!, /gesperrt/);
  assert.match(eligibilityError(f, 'season', 'stadium', 10000)!, /gesperrt/);
  assert.equal(squadBanError(f, competitionFor('tournament', 'stadium')), null, 'still eligible for tournaments');
  // Bench is blocked too.
  const benchOnly = structuredClone(f);
  benchOnly.starXI.lineupIds[4] = benchOnly.starXI.benchIds[0];
  benchOnly.starXI.benchIds[0] = player;
  assert.match(squadBanError(benchOnly, 'league')!, /gesperrt/);
  // Best Starting XI leaves him out for the next league match.
  assert.ok(getBestXIUnavailablePlayerIds(f).includes(player));
  assert.ok(!setBestStarXI(f.starXI, getBestXIUnavailablePlayerIds(f)).lineupIds.includes(player));
  // Substitutions refuse him in a live league match.
  const live = structuredClone(f);
  live.cup.active = true; live.cup.mode = 'season'; live.cup.phase = 'regular'; live.cup.substitutionsUsed = 0; live.cup.subWindowsUsed = 0;
  live.starXI.lineupIds[4] = live.starXI.benchIds[1];
  live.starXI.benchIds[1] = player;
  // Slot 4 is his own position, so only the suspension can refuse the change.
  assert.match(matchChangeError(live, [{ playerId: player, slot: 4 }]), /nicht spielberechtigt/);
  const draft = { lineup: [...live.starXI.lineupIds], formation: live.starXI.formationId };
  draft.lineup[4] = player;
  assert.match(validateMatchDraft(live, draft), /gesperrter Spieler/);
  const html = renderToStaticMarkup(createElement(DisciplineTags, { features: f, playerId: player }));
  assert.match(html, /Gesperrt – 1 Spiel \(3 Gelbe Karten\)/);
});

test('a new league season resets league yellows, bans still carry over', () => {
  const f = ready(), a = f.starXI.lineupIds[1], b = f.starXI.lineupIds[2];
  playMatch(f, { mode: 'season' }, [a, b]);
  playMatch(f, { mode: 'season' }, [a, b]);
  const id = `match-${++matchCounter}`;
  f.cup.careerMatchId = id;
  f.cup.broadcast = { ...f.cup.broadcast!, events: [{ id: `${id}:y`, kind: 'yellow', side: 'club', minute: 50, at: 0, playerId: a, player: a, style: 'ground', lane: 34, seed: 0 }] };
  processMatchDiscipline(f, id, 9000, { seasonCompleted: true });
  assert.deepEqual(getBannedPlayerIds(f, 'league'), [a], 'the last matchday ban carries into next season');
  assert.deepEqual(f.discipline.league, {}, 'accumulation restarts');
  assert.deepEqual(yellowCardStatus(f, b), []);
});

test('a finished tournament run resets its yellows and drops unserved bans', () => {
  const f = ready(), a = f.starXI.lineupIds[6];
  playMatch(f, { mode: 'tournament', tournamentId: 'world', continues: true }, [a]);
  playMatch(f, { mode: 'tournament', tournamentId: 'world', continues: false }, [a]);
  assert.deepEqual(getBannedPlayerIds(f, 'tournament:world'), [], 'no ban leaks into another competition or edition');
  assert.equal(f.discipline.tournaments.world, undefined);
  assert.deepEqual(getBannedPlayerIds(f, 'league'), []);
});

test('reload, reconnect and repeated processing never create a second ban', () => {
  const f = ready(), a = f.starXI.lineupIds[7];
  playMatch(f, { mode: 'season' }, [a]);
  playMatch(f, { mode: 'season' }, [a]);
  playMatch(f, { mode: 'season' }, [a]);
  const id = f.cup.careerMatchId!;
  const reloaded = normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
  assert.deepEqual(reloaded.discipline, f.discipline);
  assert.deepEqual(processMatchDiscipline(reloaded, id, 99999), []);
  assert.equal(reloaded.discipline.bans.length, 1);
  assert.equal(reloaded.discipline.league[a], 3);
  // recordCareerMatch drives discipline too and is idempotent.
  const before = JSON.stringify(reloaded.discipline);
  recordCareerMatch(reloaded, 99999);
  recordCareerMatch(reloaded, 100000);
  assert.equal(JSON.stringify(reloaded.discipline), before);
  // Old saves without discipline data load with an empty record.
  const legacy = JSON.parse(JSON.stringify(f));
  delete legacy.discipline;
  assert.deepEqual(normalizeGameFeatures(legacy).discipline.bans, []);
});

test('two yellows in one match are a red card and do not count toward accumulation', () => {
  const f = ready(), a = f.starXI.lineupIds[8];
  const id = `match-${++matchCounter}`;
  f.cup.mode = 'season'; f.cup.careerMatchId = id; f.cup.sentOffPlayerIds = [a];
  f.cup.playerEnteredAt = { [a]: 1 };
  f.cup.broadcast = { ...createMatchBroadcast(f.cup), events: [0, 1].map(i => ({ id: `${id}:${i}`, kind: 'yellow' as const, side: 'club' as const, minute: 30 + i, at: 0, playerId: a, player: a, style: 'ground' as const, lane: 34, seed: 0 })) };
  processMatchDiscipline(f, id, 1);
  assert.equal(f.discipline.league[a] ?? 0, 0);
  assert.equal(f.discipline.bans.length, 0);
});
