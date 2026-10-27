import assert from 'node:assert/strict';
import test from 'node:test';
import type { LeaderboardRow, LeaderboardSort } from '../db/index.ts';
import { leaderboardResponse } from '../app/leaderboard-api.ts';
import type { LeaderboardApiDeps } from '../app/leaderboard-api.ts';

function row(overrides: Partial<LeaderboardRow>): LeaderboardRow {
  return { hostPlayerId: 'host-player-1', hostName: 'Nicolas', hostLastSeenAt: '', guestPlayerId: null, guestName: null, guestLastSeenAt: '', player3PlayerId: null, player3Name: null, player3LastSeenAt: '', player4PlayerId: null, player4Name: null, player4LastSeenAt: '', roomName: 'Meine Welt', totalGoals: 10, bestLeague: 15, trophies: 0, updatedAt: '', ...overrides };
}

function setup(rows: LeaderboardRow[], allowed = true) {
  const calls: { sort: LeaderboardSort; limit: number }[] = [];
  const deps: LeaderboardApiDeps = {
    resolve: async (_request, playerId) => allowed ? { ok: true, playerId, userId: 'user-1' } : { ok: false, response: Response.json({ error: 'Bitte melde dich an.' }, { status: 401 }) },
    db: () => ({ getLeaderboard: async (sort, limit) => { calls.push({ sort, limit }); return rows; } }),
  };
  const get = (query: string) => leaderboardResponse(new Request(`http://localhost/api/leaderboard?${query}`), deps);
  return { calls, get };
}

test('the leaderboard lists worlds with their players and marks the reader\'s own world', async () => {
  const { calls, get } = setup([
    row({ roomName: 'Torfabrik', totalGoals: 9e9 + 0.7, hostPlayerId: 'someone-else-1', hostName: 'Anna', guestPlayerId: 'reader-player-1', guestName: 'Silvan' }),
    row({ roomName: 'Andere', hostPlayerId: 'someone-else-2', hostName: 'Ben' }),
  ]);
  const response = await get('sort=trophies&playerId=reader-player-1');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /private/);
  assert.deepEqual(calls, [{ sort: 'trophies', limit: 25 }]);
  const body = await response.json() as { sort: string; entries: { rank: number; roomName: string; players: string[]; totalGoals: number; mine: boolean }[] };
  assert.equal(body.sort, 'trophies');
  assert.deepEqual(body.entries.map((entry) => [entry.rank, entry.roomName, entry.players, entry.mine]), [[1, 'Torfabrik', ['Anna', 'Silvan'], true], [2, 'Andere', ['Ben'], false]]);
  assert.equal(body.entries[0].totalGoals, 9e9);
  // World codes would let anyone join, player IDs identify accounts: neither leaves the server.
  const text = JSON.stringify(body);
  assert.doesNotMatch(text, /reader-player-1|someone-else|code/i);
});

test('an unknown sort falls back to goals, and a missing player or login is refused', async () => {
  const { calls, get } = setup([]);
  assert.equal((await get('sort=hack&playerId=reader-player-1')).status, 200);
  assert.equal(calls[0].sort, 'goals');
  assert.equal((await get('sort=goals')).status, 400);
  assert.equal((await setup([], false).get('playerId=reader-player-1')).status, 401);
});

test('a database failure answers 503 without caching', async () => {
  const response = await leaderboardResponse(new Request('http://localhost/api/leaderboard?playerId=reader-player-1'), {
    resolve: async (_request, playerId) => ({ ok: true, playerId, userId: null }),
    db: () => ({ getLeaderboard: async () => { throw new Error('down'); } }),
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
