// Seats and receipts of a co-op world as their own module (modularisation of the multiplayer route): pure functions
// over a room row, checked here without a database. The route tests (coop-seats, coop-concurrency) cover the writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { findReceipt, getOccupiedRoomPlayers, hostHandoverDue, nextClickState, readClickState, readDeparted, seatChange } from '../app/api/multiplayer/seats.ts';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-11-26T12:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();
const room = (over: Record<string, unknown> = {}) => ({
  code: 'ABCD', clickStateJson: '{}',
  hostPlayerId: 'h', hostName: 'Host', hostLastSeenAt: iso(now - DAY), hostGoals: 10, hostClicks: 5,
  guestPlayerId: 'g', guestName: 'Gast', guestLastSeenAt: iso(now - 60_000), guestGoals: 20, guestClicks: 7,
  player3PlayerId: 'p3', player3Name: 'Drei', player3LastSeenAt: iso(now - 2 * DAY), player3Goals: 30, player3Clicks: 9,
  player4PlayerId: null, player4Name: null, player4LastSeenAt: null, player4Goals: 0, player4Clicks: 0,
  ...over,
}) as never;

test('a leaving member empties the seat, keeps the shared counters and cannot rejoin by reload', () => {
  const current = room({ clickStateJson: JSON.stringify({ player3: { pending: 1 } }) });
  const change = seatChange(current, { leaving: 'player3' }, now);
  assert.deepEqual({ id: change.columns.player3PlayerId, goals: change.columns.player3Goals, clicks: change.columns.player3Clicks }, { id: null, goals: 0, clicks: 0 });
  const state = JSON.parse(nextClickState(current, null, change.patch));
  assert.deepEqual(readDeparted(state), { goals: 30, clicks: 9 });
  assert.ok(state._removed.p3, 'remembered as removed');
  assert.equal(state.player3, undefined, 'its click state is gone');
});

test('the host hands over to the most recently active member after seven inactive days, never earlier', () => {
  assert.equal(hostHandoverDue(room(), now), null, 'one day inactive');
  const stale = room({ hostLastSeenAt: iso(now - 8 * DAY) });
  assert.equal(hostHandoverDue(stale, now), 'guest');
  const change = seatChange(stale, { leaving: 'host', handover: 'guest' }, now);
  assert.equal(change.columns.hostPlayerId, 'g');
  assert.equal(change.columns.guestPlayerId, null);
  assert.equal(getOccupiedRoomPlayers(stale).length, 3);
});

test('a receipt is found again for the same member only, and at most twelve are kept', () => {
  let current = room();
  for (let index = 0; index < 15; index += 1) current = { ...(current as object), clickStateJson: nextClickState(current, { id: `a${index}`, role: 'guest', action: 'click', at: Date.now() }) } as never;
  assert.equal((readClickState(current)._receipts as unknown[]).length, 12);
  assert.ok(findReceipt(current, 'a14', 'guest'));
  assert.equal(findReceipt(current, 'a14', 'host'), null, 'another member');
  assert.equal(findReceipt(current, 'a0', 'guest'), null, 'dropped as the oldest');
  assert.equal(findReceipt(current, '', 'guest'), null);
});

test('the route imports the seat logic instead of defining it', async () => {
  const route = await readFile(new URL('../app/api/multiplayer/route.ts', import.meta.url), 'utf8');
  assert.match(route, /from "\.\/seats"/);
  assert.doesNotMatch(route, /^(?:export )?(?:function|const) (?:seatChange|hostHandoverDue|nextClickState|COOP_ROLES)\b/m);
});
