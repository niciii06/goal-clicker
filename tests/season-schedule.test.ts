import assert from 'node:assert/strict';
import test from 'node:test';
import { getSeasonSchedule, initialSeasonMode, normalizeSeasonModeState, playSeasonModeMatch, SEASON_MODE_MATCHES_PER_SEASON, startSeasonPrestige } from '../app/feature-data.ts';
import type { SeasonModeState } from '../app/feature-data.ts';

function seeded(seed = 11) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

test('every matchday has three matches with all six clubs, and every pairing meets twice a season', () => {
  const schedule = getSeasonSchedule(initialSeasonMode('FC Test'));
  assert.equal(schedule.length, SEASON_MODE_MATCHES_PER_SEASON);
  const meetings = new Map<string, number>();
  for (const day of schedule) {
    assert.equal(day.matches.length, 3);
    const ids = day.matches.flatMap((m) => [m.homeId, m.awayId]);
    assert.equal(new Set(ids).size, 6, `matchday ${day.matchday}`);
    assert.equal(day.matches.filter((m) => m.club).length, 1);
    assert.ok(day.matches.find((m) => m.club)!.homeId === 'club' || day.matches.find((m) => m.club)!.awayId === 'club');
    for (const m of day.matches) { const key = [m.homeId, m.awayId].sort().join('|'); meetings.set(key, (meetings.get(key) ?? 0) + 1); }
  }
  assert.equal(meetings.size, 15);
  assert.ok([...meetings.values()].every((n) => n === 2));
});

test('the stored results of a season add up to the table', () => {
  let state: SeasonModeState = initialSeasonMode('FC Test');
  const random = seeded();
  for (let day = 0; day < SEASON_MODE_MATCHES_PER_SEASON - 1; day++) state = playSeasonModeMatch(state, 60, 'FC Test', 1000 + day, random).state;
  assert.equal(state.results?.length, (SEASON_MODE_MATCHES_PER_SEASON - 1) * 3);
  const points = new Map<string, number>(), goals = new Map<string, number>();
  for (const r of state.results!) {
    goals.set(r.homeId, (goals.get(r.homeId) ?? 0) + r.homeScore); goals.set(r.awayId, (goals.get(r.awayId) ?? 0) + r.awayScore);
    const [home, away] = r.homeScore > r.awayScore ? [3, 0] : r.homeScore < r.awayScore ? [0, 3] : [1, 1];
    points.set(r.homeId, (points.get(r.homeId) ?? 0) + home); points.set(r.awayId, (points.get(r.awayId) ?? 0) + away);
  }
  for (const team of state.table) { assert.equal(team.points, points.get(team.id) ?? 0, team.name); assert.equal(team.goalsFor, goals.get(team.id) ?? 0, team.name); }
  // The schedule shows exactly those scores for the played matchdays, and none for the open one.
  const schedule = getSeasonSchedule(state);
  assert.ok(schedule.slice(0, -1).every((day) => day.played && day.matches.every((m) => m.homeScore !== undefined)));
  assert.ok(schedule.at(-1)!.matches.every((m) => m.homeScore === undefined));
  // They survive a reload, and the next season starts without results.
  assert.deepEqual(normalizeSeasonModeState(JSON.parse(JSON.stringify(state)), 'FC Test').results, state.results);
  const next = playSeasonModeMatch(state, 60, 'FC Test', 5000, random).state;
  assert.equal(next.matchday, 0);
  assert.deepEqual(next.results, []);
});

test('a save from before results were stored still shows the club scores of this season', () => {
  let state: SeasonModeState = initialSeasonMode('FC Test');
  const random = seeded(5);
  for (let day = 0; day < 3; day++) state = playSeasonModeMatch(state, 60, 'FC Test', 1000 + day, random).state;
  const legacy = { ...state, results: [] };
  const schedule = getSeasonSchedule(legacy);
  for (let day = 0; day < 3; day++) {
    const club = schedule[day].matches.find((m) => m.club)!, entry = state.history.find((h) => h.matchday === day + 1)!;
    const ours = club.homeId === 'club' ? [club.homeScore, club.awayScore] : [club.awayScore, club.homeScore];
    assert.deepEqual(ours, [entry.clubScore, entry.opponentScore]);
  }
});

test('a prestige season starts without the results of the season before', () => {
  let state: SeasonModeState = initialSeasonMode('FC Test');
  const random = seeded(5);
  for (let day = 0; day < 4; day++) state = playSeasonModeMatch(state, 90, 'FC Test', 1000 + day, random).state;
  assert.ok((state.results ?? []).length > 0);
  const prestige = startSeasonPrestige({ ...state, hallOfFame: true }, 'FC Test', 9000);
  assert.deepEqual(prestige.results, []);
  assert.ok(getSeasonSchedule(prestige).every((day) => day.matches.every((match) => match.homeScore === undefined && match.awayScore === undefined)));
});
