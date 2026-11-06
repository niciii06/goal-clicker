// Club chronicle and record hall (decision of 6 November 2026): totals, records, season archive, dated titles, Hall
// of Fame tables and the all-time player table, written once per match on the existing paths, history only.
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { installLightRoomMocks } from './helpers/light-room-mock.ts';
import { SEASON_MODE_DIVISION_COUNT, STAR_XI_PLAYERS, applySeasonPrestige, beginSeasonCupMatch, cardPackRating, completeTournamentRun, getStarXISelection, initialGameFeatures, normalizeGameFeatures, recordSeasonModeMatch, setBestStarXI } from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';
import { emptyPlayerStats, prepareCareerMatch, recordCareerMatch } from '../app/career-data.ts';
import { recordTicketIncome } from '../app/ticket-income.ts';
import { CHRONICLE_SEASON_LIMIT, normalizeChronicle } from '../app/club-chronicle.ts';
import { AllTimePlayerTable, CareerArea, ClubChroniclePanel } from '../app/career-panels.tsx';

const START = Date.UTC(2026, 10, 9, 12);
function club(now = START) {
  const f = initialGameFeatures(now);
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => cardPackRating(p) < 95).slice(0, 60).map((p) => p.id) });
  return normalizeGameFeatures(f);
}
/** Plays one season match to the final whistle with the given score; returns the scorer. */
function play(f: GameFeatures, home: number, away: number, now: number) {
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, now, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  const scorer = f.starXI.lineupIds.find((id) => id && STAR_XI_PLAYERS.find((p) => p.id === id)?.position !== 'TW')!;
  f.cup.homeScore = home; f.cup.awayScore = away;
  f.cup.matchEvents = [
    ...Array.from({ length: home }, (_, i) => ({ id: `h-${now}-${i}`, side: 'home' as const, scorerId: scorer, scorer: 'Spieler', minute: 10 + i, createdAt: now + i, homeScore: i + 1, awayScore: 0, ratingImpacts: { [scorer]: .7 } })),
    ...Array.from({ length: away }, (_, i) => ({ id: `a-${now}-${i}`, side: 'away' as const, scorerId: 'opp', scorer: 'Gegner', minute: 60 + i, createdAt: now + 100 + i, homeScore: home, awayScore: i + 1, ratingImpacts: {} })),
  ];
  f.cup.active = false;
  const result = recordSeasonModeMatch(f.seasonMode, home, away, f.club.name, now, () => .99, f.cup.opponentIds[0]);
  recordCareerMatch(f, now, result.entry);
  f.seasonMode = result.state;
  return { scorer, entry: result.entry! };
}

test('every match counts once in the totals, records and streaks', () => {
  const f = club();
  play(f, 3, 0, START);
  play(f, 1, 1, START + 1000);
  const { entry } = play(f, 0, 2, START + 2000);
  play(f, 5, 1, START + 3000);
  const { totals, records } = f.chronicle;
  assert.deepEqual({ matches: totals.matches, wins: totals.wins, draws: totals.draws, losses: totals.losses, goalsFor: totals.goalsFor, goalsAgainst: totals.goalsAgainst, leagueWins: totals.leagueWins, cleanSheets: totals.cleanSheets }, { matches: 4, wins: 2, draws: 1, losses: 1, goalsFor: 9, goalsAgainst: 4, leagueWins: 2, cleanSheets: 1 });
  assert.equal(records.biggestWin?.score, '5:1');
  assert.equal(records.biggestWin?.value, 4);
  assert.equal(records.mostGoals?.value, 5);
  assert.equal(records.unbeaten.best, 2);
  assert.equal(records.unbeaten.current, 1);
  assert.equal(records.winning.best, 1);
  // The same match recorded again (a retry, a second tab) changes nothing.
  const before = structuredClone(f.chronicle);
  f.cup.matchStartedAt = START + 3000; f.cup.careerMatchId = f.career.reports.at(-1)!.id;
  recordCareerMatch(f, START + 4000, entry);
  assert.deepEqual(f.chronicle, before);
});

test('a finished season gets one archive row with place, points and top scorer, first place a dated title', () => {
  const f = club();
  f.seasonMode = { ...f.seasonMode, division: 4, highestDivision: 4, matchday: 9, table: f.seasonMode.table.map((row) => row.id === 'club' ? { ...row, played: 9, wins: 9, points: 27, goalsFor: 20 } : row) };
  f.career.seasonMatches = 9;
  const scorerId = f.starXI.lineupIds.find((id) => id && STAR_XI_PLAYERS.find((p) => p.id === id)?.position !== 'TW')!;
  f.career.seasonPlayers[scorerId] = { ...emptyPlayerStats(), appearances: 9, minutes: 810, goals: 11, ratingTotal: 72, ratedMatches: 9 };
  const { entry } = play(f, 2, 0, START);
  assert.equal(entry.completedSeason, true);
  assert.ok(entry.finalTable, 'the completing entry carries the final table');
  const [row] = f.chronicle.seasons;
  assert.equal(f.chronicle.seasons.length, 1);
  assert.equal(row.place, 1);
  assert.equal(row.points, 30);
  assert.equal(row.wins, 10);
  assert.equal(row.division, 4);
  assert.equal(row.outcome, 'promoted');
  assert.equal(row.prestige, 0);
  assert.equal(row.topScorer?.playerId, scorerId);
  assert.equal(row.topScorer?.goals, 13);
  assert.deepEqual(f.chronicle.titles.map((t) => [t.kind, t.label, t.at]), [['league', 'Meister Liga 12', START]]);
  // The stored season history stays compact: the final table is not saved with it.
  const saved = normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
  assert.ok(saved.seasonMode.history.every((h) => !('finalTable' in h)));
  assert.deepEqual(saved.chronicle, f.chronicle);
});

test('the Hall of Fame season archives its final table once per run, Prestige keeps the chronicle (history only)', () => {
  const f = club();
  f.seasonMode = { ...f.seasonMode, division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, matchday: 9, table: f.seasonMode.table.map((row) => row.id === 'club' ? { ...row, played: 9, wins: 9, points: 27 } : row) };
  play(f, 1, 0, START);
  assert.equal(f.seasonMode.hallOfFame, true);
  assert.equal(f.chronicle.hallOfFame.length, 1);
  assert.equal(f.chronicle.hallOfFame[0].prestige, 0);
  assert.equal(f.chronicle.hallOfFame[0].rows.length, 6);
  assert.equal(f.chronicle.hallOfFame[0].rows[0].club, true);
  assert.ok(f.chronicle.titles.some((t) => t.kind === 'hall-of-fame'));
  const prestige = applySeasonPrestige(f, f.starXI.ownedIds.find((id) => !STAR_XI_PLAYERS.find((p) => p.id === id)?.isCustom)!, START + 5000, 'chronicle-1');
  assert.equal(prestige.error, '');
  assert.equal(prestige.features.chronicle.hallOfFame.length, 1, 'not archived a second time');
  assert.deepEqual(prestige.features.chronicle.seasons, f.chronicle.seasons);
  assert.deepEqual(prestige.features.chronicle.totals, f.chronicle.totals);
  assert.equal(prestige.features.seasonMode.prestigeCount, 1);
});

test('a Hall of Fame reached before the chronicle existed is archived from the shown table at Prestige', () => {
  const f = club();
  f.seasonMode = { ...f.seasonMode, division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, hallOfFame: true, prestigeCount: 2, lastTable: f.seasonMode.table.map((row) => row.id === 'club' ? { ...row, points: 25 } : row) };
  const old = JSON.parse(JSON.stringify(f)); delete old.chronicle;
  const loaded = normalizeGameFeatures(old);
  assert.equal(loaded.chronicle.hallOfFame.length, 0);
  const result = applySeasonPrestige(loaded, loaded.starXI.ownedIds.find((id) => !STAR_XI_PLAYERS.find((p) => p.id === id)?.isCustom)!, START, 'chronicle-2');
  assert.equal(result.error, '');
  assert.equal(result.features.chronicle.hallOfFame.length, 1);
  assert.equal(result.features.chronicle.hallOfFame[0].prestige, 2);
  assert.equal(result.features.chronicle.hallOfFame[0].rows.find((r) => r.club)?.points, 25);
});

test('a won tournament is a dated title, once per run; ticket crowds set the record', () => {
  const f = club();
  f.cup.matchStartedAt = START;
  const summary = { tournamentId: 'champions' as const, tournamentWon: true, completedRound: 4, opponent: 'Real', homeScore: 2, awayScore: 1, tieBreak: null };
  let next = completeTournamentRun(f, summary as Parameters<typeof completeTournamentRun>[1], START + 10, () => .5);
  next = completeTournamentRun(next, summary as Parameters<typeof completeTournamentRun>[1], START + 20, () => .5);
  const titles = next.chronicle.titles.filter((t) => t.kind === 'tournament');
  assert.equal(titles.length, 1);
  assert.equal(titles[0].tournamentId, 'champions');
  assert.equal(titles[0].at, START + 10);
  recordTicketIncome(next, { attendance: 12000, capacity: 20000, income: 50 }, START + 30);
  recordTicketIncome(next, { attendance: 9000, capacity: 20000, income: 50 }, START + 40);
  assert.equal(next.chronicle.records.recordCrowd?.value, 12000);
});

test('old saves derive records from the last reports and archive rows from season awards, nothing invented', () => {
  const f = club();
  play(f, 4, 0, START);
  const raw = JSON.parse(JSON.stringify(f));
  raw.career.reports[0].tickets = { attendance: 8000, capacity: 10000, income: 1 };
  raw.career.awards = [{ id: 'a1', division: 3, seasonNumber: 2, matchesTracked: 10, createdAt: START - 1000, best: { playerId: f.career.reports[0].players[0].playerId, value: 'Ø 7.5' }, scorer: { playerId: f.career.reports[0].players[0].playerId, value: '9 Tore' }, joker: null, disappointment: null }];
  delete raw.chronicle;
  raw.schemaVersion = 8;
  const loaded = normalizeGameFeatures(raw);
  assert.equal(loaded.chronicle.records.biggestWin?.score, '4:0');
  assert.equal(loaded.chronicle.records.recordCrowd?.value, 8000);
  assert.equal(loaded.chronicle.totals.matches, 0, 'totals start with the chronicle, they are not guessed');
  assert.equal(loaded.chronicle.records.unbeaten.best, 0);
  assert.equal(loaded.chronicle.seasons.length, 1);
  assert.equal(loaded.chronicle.seasons[0].place, null);
  assert.equal(loaded.chronicle.seasons[0].topScorer?.goals, 9);
  assert.equal(loaded.chronicle.titles.length, 0);
  // A save with garbage in the chronicle still loads.
  assert.deepEqual(normalizeGameFeatures({ ...raw, chronicle: { totals: { wins: 'x' }, seasons: [null, { division: 0 }], titles: [{ kind: 'nope', label: 1 }] } }).chronicle.seasons, []);
});

test('the archive stays compact: at most 200 seasons', () => {
  const seasons = Array.from({ length: 260 }, (_, i) => ({ id: `s${i}`, season: i + 1, prestige: 0, division: 1, place: 3, points: 15, wins: 4, draws: 3, losses: 3, goalsFor: 12, goalsAgainst: 10, outcome: 'stayed', topScorer: null, bestPlayerId: null, at: i }));
  const chronicle = normalizeChronicle({ seasons });
  assert.equal(chronicle.seasons.length, CHRONICLE_SEASON_LIMIT);
  assert.equal(chronicle.seasons[0].id, 's60');
});

test('chronicle and all-time table render; the table sorts by every column and lists every player who played', () => {
  const f = club();
  play(f, 3, 0, START);
  play(f, 2, 2, START + 1000);
  const html = renderToStaticMarkup(React.createElement(ClubChroniclePanel, { features: f }));
  for (const text of ['CLUBCHRONIK / BILANZ', 'Höchster Sieg', '3:0', 'Zuschauerrekord', 'SAISONARCHIV', 'HALL OF FAME', 'EWIGE SPIELERTABELLE', 'Nach Tore sortieren']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /[–—]/);
  const table = renderToStaticMarkup(React.createElement(AllTimePlayerTable, { features: f }));
  const played = Object.values(f.career.players).filter((s) => s.appearances > 0).length;
  assert.equal((table.match(/<tr class="in-squad">|<tr class="">/g) ?? []).length, played);
  assert.match(table, /aria-sort="descending"/);
  const area = renderToStaticMarkup(React.createElement(CareerArea, { features: f }));
  assert.match(area, /Chronik und Rekorde/);
  assert.match(area, /aria-pressed="true"[^>]*>Spieler und Form/);
});

// Co-op: the season match path of the server writes the same chronicle.
let row: RoomRow;
const { GoalClickerDatabase } = await import('../db/index.ts');
const { POST } = await import('../app/api/multiplayer/route.ts');
GoalClickerDatabase.prototype.getRoom = async (code) => code === row.code ? structuredClone(row) : null;
GoalClickerDatabase.prototype.updateRoom = async (code, values: RoomUpdate, conditions = {}) => {
  if (code !== row.code || conditions.sharedStateVersion !== undefined && conditions.sharedStateVersion !== row.sharedStateVersion || conditions.lastPassiveAt !== undefined && conditions.lastPassiveAt !== row.lastPassiveAt) return null;
  row = { ...row, ...values };
  return structuredClone(row);
};
installLightRoomMocks(GoalClickerDatabase);
async function action(name: string, extra: Record<string, unknown> = {}) {
  const response = await POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: name, code: 'ARCHIV', playerId: 'host-player-123', protocol: MULTIPLAYER_PROTOCOL_VERSION, ...extra }) }));
  return { status: response.status, data: await response.json() as { room: { game: { features: GameFeatures } }; error?: string } };
}

test('co-op: a finished league match on the server enters the chronicle once', async () => {
  const f = club(Date.now());
  const now = new Date().toISOString();
  const defaults = Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([key, col]) => [key, col.default ?? null]));
  row = { ...defaults, code: 'ARCHIV', hostPlayerId: 'host-player-123', hostName: 'Nicolas', guestPlayerId: 'guest-player-123', guestName: 'Silvan', hostLastSeenAt: now, guestLastSeenAt: now, lastPassiveAt: now, updatedAt: now, sharedFeaturesJson: JSON.stringify(f) } as RoomRow;
  const started = await action('cup-start', { mode: 'season' });
  assert.equal(started.status, 200, started.data.error);
  const current = started.data.room.game.features;
  delete current.cup.simulation;
  current.cup.homeScore = 3; current.cup.awayScore = 0; current.cup.lastTickAt = current.cup.matchEndsAt; current.cup.matchStartedAt = Date.now() - 180001; current.cup.matchEndsAt = Date.now() - 1;
  row.sharedFeaturesJson = JSON.stringify(current);
  const finished = await action('cup-tick');
  assert.equal(finished.status, 200, finished.data.error);
  const chronicle = finished.data.room.game.features.chronicle;
  assert.equal(chronicle.totals.matches, 1);
  assert.equal(chronicle.totals.leagueWins, 1);
  assert.equal(chronicle.records.biggestWin?.score, '3:0');
  const again = await action('cup-tick');
  assert.equal(again.data.room.game.features.chronicle.totals.matches, 1);
});
