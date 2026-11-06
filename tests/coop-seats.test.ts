// Co-op seat management and Prestige vote (owner decisions 2026-11-06, items 9 and 10): leave a seat, the host
// removes inactive (or, confirmed, active) members, the host seat goes to the most recently active member when the
// host is inactive, and a co-op Prestige needs every online member to agree within PRESTIGE_VOTE_MS.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomSeatRole, RoomUpdate } from '../db/index.ts';
import { SEASON_MODE_DIVISION_COUNT, STAR_XI_PLAYERS, getPrestigeKeepCandidates, initialGameFeatures, normalizeGameFeatures, setBestStarXI } from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { leaderboardEntry } from '../app/leaderboard-api.ts';
import { coopLastActiveLabel, prestigeVoteMessage } from '../app/game/coop.ts';
import { PRESTIGE_VOTE_SECONDS, prestigeVoteSecondsLeft } from '../app/prestige-dialog.tsx';
import { installLightRoomMocks } from './helpers/light-room-mock.ts';

const { GoalClickerDatabase } = await import('../db/index.ts');
const { GET, POST, clearRoomCacheForTests, PRESTIGE_VOTE_MS, SEAT_INACTIVE_DAYS } = await import('../app/api/multiplayer/route.ts');

const SEAT_COLUMNS: Record<RoomSeatRole, 'hostPlayerId' | 'guestPlayerId' | 'player3PlayerId' | 'player4PlayerId'> = { host: 'hostPlayerId', guest: 'guestPlayerId', player3: 'player3PlayerId', player4: 'player4PlayerId' };
let row: RoomRow;
GoalClickerDatabase.prototype.getRoom = async (code) => code === row.code ? structuredClone(row) : null;
GoalClickerDatabase.prototype.updateRoom = async (code, values: RoomUpdate, conditions = {}) => {
  if (code !== row.code) return null;
  if (conditions.sharedStateVersion !== undefined && conditions.sharedStateVersion !== row.sharedStateVersion) return null;
  if (conditions.lastPassiveAt !== undefined && conditions.lastPassiveAt !== row.lastPassiveAt) return null;
  if (conditions.seat && (row[SEAT_COLUMNS[conditions.seat.role]] ?? null) !== conditions.seat.playerId) return null;
  row = { ...row, ...values }; return structuredClone(row);
};
// Like the SQL: books only on the click state it was computed from and only while the seat is still the player's.
GoalClickerDatabase.prototype.applyClick = async (code, role, amount, clickCount, _timestamp, previous = null, next = null, presence = {}, seatPlayerId) => {
  if (code !== row.code) return null;
  const states = JSON.parse(row.clickStateJson || '{}') as Record<string, unknown>;
  if (next && JSON.stringify(states[role] ?? null) !== JSON.stringify(previous)) return null;
  if (seatPlayerId && row[SEAT_COLUMNS[role as RoomSeatRole]] !== seatPlayerId) return null;
  const goals = `${role}Goals` as 'hostGoals', clicks = `${role}Clicks` as 'hostClicks';
  row = { ...row, ...presence, sharedCoins: row.sharedCoins + amount, sharedTotalGoals: row.sharedTotalGoals + amount, sharedSeasonGoals: row.sharedSeasonGoals + amount, sharedStateVersion: row.sharedStateVersion + 1, [goals]: row[goals] + amount, [clicks]: row[clicks] + clickCount, clickStateJson: next ? JSON.stringify({ ...states, [role]: next }) : row.clickStateJson };
  return structuredClone(row) as never;
};
installLightRoomMocks(GoalClickerDatabase);

const HOST = 'host-player-123', GUEST = 'guest-player-123', THIRD = 'third-player-123', FOURTH = 'fourth-player-123';
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const OFFLINE = () => ago(10 * 60_000);

const SPECIALS = ['star-goat-nicu', 'star-maetthu', 'star-pfuschi', 'star-champ-simu'];
const NORMALS = STAR_XI_PLAYERS.filter((player) => !player.isCustom && !player.retired && !player.id.startsWith('scrap-')).slice(0, 24).map((player) => player.id);
function hallOfFame(): GameFeatures {
  const features = initialGameFeatures(1_000_000);
  features.starterSquadGranted = true;
  features.starXI = setBestStarXI({ ...features.starXI, ownedIds: [...SPECIALS, ...NORMALS] }, []);
  features.seasonMode = { ...features.seasonMode, division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, hallOfFame: true, prestigeCount: 0 };
  return normalizeGameFeatures(features);
}

function setup(extra: Partial<RoomRow> = {}, features: GameFeatures = initialGameFeatures()) {
  clearRoomCacheForTests();
  const iso = new Date().toISOString();
  const defaults = Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([key, column]) => [key, column.default ?? null]));
  row = {
    ...defaults, code: 'SEATS1', roomName: 'Testwelt', hostPlayerId: HOST, hostName: 'Nicolas', guestPlayerId: GUEST, guestName: 'Silvan', player3PlayerId: THIRD, player3Name: 'Lara',
    hostLastSeenAt: iso, guestLastSeenAt: iso, player3LastSeenAt: iso, lastPassiveAt: iso, updatedAt: iso,
    sharedCoins: 50_000, sharedTotalGoals: 80_000, sharedSeasonGoals: 60_000,
    hostGoals: 1000, hostClicks: 100, guestGoals: 2000, guestClicks: 200, player3Goals: 3000, player3Clicks: 300,
    clickStateJson: JSON.stringify({ host: { at: 1 }, guest: { at: 2 }, player3: { at: 3 } }),
    sharedFeaturesJson: JSON.stringify(features), ...extra,
  } as RoomRow;
}

type Player = { role: string; name: string | null; occupied: boolean; online: boolean; inactive: boolean; lastActiveAt: number | null };
type Vote = { id: string; proposerName: string; keepName: string | null; keepNormalId: string | null; waitingRoles: string[]; approvedRoles: string[]; viewerMustVote: boolean; viewerIsProposer: boolean; expiresInMs: number };
type Room = { players: Player[]; viewerRole?: string; canDelete?: boolean; playerCount: number; prestigeVote: Vote | null; prestigeVoteResult: { outcome: string; by?: string } | null; game: { clicks: number; features?: GameFeatures } };
type Answer = { room?: Room; role?: string; error?: string; errorCode?: string; duplicate?: boolean; prestigeVote?: string; prestigeVoteResult?: string; left?: string; newHost?: string | null };
async function post(action: string, extra: Record<string, unknown> = {}, playerId = HOST) {
  const response = await POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, code: 'SEATS1', playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION, ...extra }) }));
  return { status: response.status, data: await response.json() as Answer };
}
async function get(playerId: string) {
  const response = await GET(new Request(`http://localhost/api/multiplayer?code=SEATS1&playerId=${playerId}&protocol=${MULTIPLAYER_PROTOCOL_VERSION}`));
  return { status: response.status, data: await response.json() as Answer };
}
const clickState = () => JSON.parse(row.clickStateJson) as Record<string, unknown>;
const features = () => normalizeGameFeatures(JSON.parse(row.sharedFeaturesJson));
const sumClicks = () => row.hostClicks + row.guestClicks + row.player3Clicks + row.player4Clicks;

test('a member leaves the seat: the seat is empty, the world and its click total stay, the member can no longer act', async () => {
  setup();
  const before = { coins: row.sharedCoins, total: row.sharedTotalGoals, upgrades: row.sharedUpgradesJson };
  const left = await post('leave-seat', { actionId: 'leave-1' }, GUEST);
  assert.equal(left.status, 200);
  assert.equal(left.data.left, 'guest');
  assert.equal(row.guestPlayerId, null);
  assert.equal(row.guestName, null);
  assert.equal(row.guestLastSeenAt, null);
  assert.equal(row.guestGoals, 0);
  assert.equal(row.guestClicks, 0);
  assert.equal(clickState().guest, undefined);
  assert.deepEqual(clickState().player3, { at: 3 });
  // The shared counters keep the clicks of the member who left.
  assert.equal(sumClicks(), 400);
  assert.equal(left.data.room?.game.clicks, 600);
  assert.ok(row.sharedCoins >= before.coins && row.sharedTotalGoals >= before.total);
  assert.equal(row.sharedUpgradesJson, before.upgrades);
  assert.equal(row.hostPlayerId, HOST);
  assert.ok(features().history.some((entry) => entry.title === 'Mitspieler gegangen' && entry.detail.includes('Silvan')));
  // Removed: every action and the poll are refused, also a resend of the leave itself.
  assert.equal((await post('leave-seat', { actionId: 'leave-1' }, GUEST)).status, 403);
  assert.equal((await post('daily-claim', {}, GUEST)).status, 403);
  assert.equal((await get(GUEST)).status, 403);
  assert.equal((await post('click', { clickCount: 3 }, GUEST)).status, 403);
  // The others play on; the seat shows as free.
  const view = await get(HOST);
  assert.equal(view.status, 200);
  assert.equal(view.data.room?.players.find((player) => player.role === 'guest')?.occupied, false);
  assert.equal(view.data.room?.playerCount, 2);
  // The leaderboard lists only the members who are still there.
  assert.deepEqual(leaderboardEntry({ ...row, roomName: row.roomName, totalGoals: row.sharedTotalGoals, bestLeague: row.sharedBestLeague, trophies: row.sharedTrophies }, 1, GUEST).players, ['Nicolas', 'Lara']);
  assert.equal(leaderboardEntry({ ...row, roomName: row.roomName, totalGoals: row.sharedTotalGoals, bestLeague: row.sharedBestLeague, trophies: row.sharedTrophies }, 1, GUEST).mine, false);
});

test('a removed member rejoins only with the code and only into a free seat; a page reload does not take a seat back', async () => {
  setup();
  assert.equal((await post('leave-seat', {}, GUEST)).status, 200);
  // The stored room of a reload asks for its old role: refused, the free seat stays free.
  const restore = await post('join', { nickname: 'Silvan', preferredRole: 'guest' }, GUEST);
  assert.equal(restore.status, 403);
  assert.equal(row.guestPlayerId, null);
  // A fourth player takes a free seat, then the code join of the removed member gets the last one.
  assert.equal((await post('join', { nickname: 'Mia' }, FOURTH)).status, 200);
  const rejoin = await post('join', { nickname: 'Silvan' }, GUEST);
  assert.equal(rejoin.status, 200);
  assert.equal(rejoin.data.role, 'player4');
  assert.equal(row.player4PlayerId, GUEST);
  // A full world has no seat for anyone else.
  assert.equal((await post('leave-seat', {}, THIRD)).status, 200);
  assert.equal((await post('join', { nickname: 'Lara' }, THIRD)).status, 200);
  assert.equal((await post('join', { nickname: 'Zoe' }, 'fifth-player-123')).status, 409);
});

test('the host leaves: the most recently active member becomes host, the old host is out', async () => {
  // Lara (player3) was active a minute ago, Silvan (guest) an hour ago: Lara takes over.
  setup({ guestLastSeenAt: ago(60 * 60_000), player3LastSeenAt: ago(60_000) });
  const left = await post('leave-seat', {}, HOST);
  assert.equal(left.status, 200);
  assert.equal(left.data.newHost, 'player3');
  assert.equal(row.hostPlayerId, THIRD);
  assert.equal(row.hostName, 'Lara');
  assert.equal(row.hostClicks, 300);
  assert.equal(row.player3PlayerId, null);
  assert.equal(row.player3Clicks, 0);
  assert.equal(row.guestPlayerId, GUEST);
  assert.deepEqual(clickState().host, { at: 3 });
  assert.equal(clickState().player3, undefined);
  assert.equal(sumClicks() + 100, 600);
  assert.equal((await get(HOST)).status, 403);
  const lara = await get(THIRD);
  assert.equal(lara.data.role, 'host');
  assert.equal(lara.data.room?.canDelete, true);
  assert.ok(features().history.some((entry) => /Lara ist jetzt Host/.test(entry.detail)));
  // The new host may rename and delete the world.
  assert.equal((await post('rename-room', { roomName: 'Laras Welt' }, THIRD)).status, 200);
  assert.equal(row.roomName, 'Laras Welt');
});

test('the last member cannot leave; the world stays unchanged and can be deleted by its host', async () => {
  setup({ guestPlayerId: null, guestName: null, guestLastSeenAt: null, player3PlayerId: null, player3Name: null, player3LastSeenAt: null } as unknown as Partial<RoomRow>);
  const version = row.sharedStateVersion, features = row.sharedFeaturesJson;
  const refused = await post('leave-seat', {}, HOST);
  assert.equal(refused.status, 409);
  assert.match(refused.data.error ?? '', /letzte Mitglied/);
  assert.equal(row.hostPlayerId, HOST);
  assert.equal(row.sharedFeaturesJson, features);
  assert.equal(row.sharedStateVersion, version);
});

test('only the host removes members; an active member only with an explicit confirmation, an inactive one at once', async () => {
  setup({ player3LastSeenAt: ago((SEAT_INACTIVE_DAYS + 1) * DAY) });
  assert.equal((await post('kick', { targetRole: 'player3' }, GUEST)).status, 403);
  assert.equal((await post('kick', { targetRole: 'host' })).status, 400);
  // Silvan was active just now: without force the host is asked to confirm.
  const asked = await post('kick', { targetRole: 'guest' });
  assert.equal(asked.status, 409);
  assert.match(asked.data.error ?? '', /aktiv/);
  assert.equal(row.guestPlayerId, GUEST);
  // Lara has been away for more than a week: shown as inactive, removed without force.
  const view = await get(HOST);
  assert.deepEqual(view.data.room?.players.map((player) => player.inactive), [false, false, true, false]);
  const kicked = await post('kick', { targetRole: 'player3', actionId: 'kick-1' });
  assert.equal(kicked.status, 200);
  assert.equal(row.player3PlayerId, null);
  // The same request again is answered from its receipt and removes nobody else.
  const again = await post('kick', { targetRole: 'player3', actionId: 'kick-1' });
  assert.equal(again.status, 200);
  assert.equal(again.data.duplicate, true);
  assert.equal(row.guestPlayerId, GUEST);
  // With force an active member can be removed too.
  assert.equal((await post('kick', { targetRole: 'guest', force: true })).status, 200);
  assert.equal(row.guestPlayerId, null);
  assert.equal((await post('kick', { targetRole: 'guest', force: true })).status, 409);
  assert.equal((await get(GUEST)).status, 403);
  assert.equal((await get(THIRD)).status, 403);
  assert.equal(sumClicks() + 500, 600);
});

test('a host inactive for days hands the host seat to the most recently active member at their next request', async () => {
  setup({ hostLastSeenAt: ago((SEAT_INACTIVE_DAYS + 1) * DAY), guestLastSeenAt: ago(3 * DAY), player3LastSeenAt: ago(2 * 60_000) });
  // Lara (player3) polls: she is the most recently active member and becomes host. The old host keeps a seat.
  const poll = await get(THIRD);
  assert.equal(poll.status, 200);
  assert.equal(poll.data.role, 'host');
  assert.equal(poll.data.room?.viewerRole, 'host');
  assert.equal(row.hostPlayerId, THIRD);
  assert.equal(row.hostClicks, 300);
  assert.deepEqual(clickState().host, { at: 3 });
  assert.equal(row.player3PlayerId, HOST);
  assert.equal(row.player3Clicks, 100);
  assert.deepEqual(clickState().player3, { at: 1 });
  assert.equal(row.guestPlayerId, GUEST);
  assert.equal(sumClicks(), 600);
  assert.ok(features().history.some((entry) => entry.title === 'Neuer Host'));
  // The old host is still a member, now without host rights; a second request changes nothing more.
  const old = await post('rename-room', { roomName: 'Alt' }, HOST);
  assert.equal(old.status, 403);
  assert.equal(row.hostPlayerId, THIRD);
  assert.equal((await post('rename-room', { roomName: 'Neu' }, THIRD)).status, 200);
});

test('an active host keeps the seat; a member only takes over through a request of their own', async () => {
  setup({ hostLastSeenAt: ago((SEAT_INACTIVE_DAYS - 1) * DAY) });
  await get(GUEST);
  assert.equal(row.hostPlayerId, HOST);
  setup({ hostLastSeenAt: ago((SEAT_INACTIVE_DAYS + 1) * DAY), guestLastSeenAt: ago(2 * 60_000) });
  // The next action of the guest hands the host seat over.
  assert.equal((await post('daily-claim', {}, GUEST)).status, 200);
  assert.equal(row.hostPlayerId, GUEST);
  assert.equal(row.guestPlayerId, HOST);
});

test('a host who closed the app cleanly is not handed over too early; the time before the offline mark counts', async (t) => {
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  setup({ hostLastSeenAt: new Date(clock).toISOString() });
  assert.equal((await post('presence-offline')).status, 200);
  assert.equal(row.hostLastSeenAt, '1970-01-01T00:00:00.000Z');
  clock += 2 * DAY;
  await get(GUEST);
  assert.equal(row.hostPlayerId, HOST);
  clock += SEAT_INACTIVE_DAYS * DAY;
  await get(GUEST);
  assert.equal(row.hostPlayerId, GUEST);
});

test('an offline mark from before the update counts as active on the update day', async (t) => {
  const tracked = Date.parse('2026-11-06T00:00:00.000Z');
  let clock = tracked + DAY;
  t.mock.method(Date, 'now', () => clock);
  setup({ hostLastSeenAt: '1970-01-01T00:00:00.000Z', guestLastSeenAt: new Date(clock).toISOString(), player3LastSeenAt: new Date(clock).toISOString(), lastPassiveAt: new Date(clock).toISOString(), updatedAt: new Date(clock).toISOString() });
  await get(GUEST);
  assert.equal(row.hostPlayerId, HOST);
  clock = tracked + (SEAT_INACTIVE_DAYS + 1) * DAY;
  row = { ...row, guestLastSeenAt: new Date(clock).toISOString() };
  await get(GUEST);
  assert.equal(row.hostPlayerId, GUEST);
});

// ---- Prestige vote ----

function voteRoom(extra: Partial<RoomRow> = {}) {
  setup({ sharedCoins: 5_000_000, player3LastSeenAt: OFFLINE(), ...extra }, hallOfFame());
  return getPrestigeKeepCandidates(features())[0].id;
}

test('with another member online, Prestige becomes a vote: the proposal shows the kept card, the last agreement starts it once', async () => {
  const keep = voteRoom();
  const proposal = await post('season-prestige', { requestId: 'vote-1', keepNormalId: keep, expectedPrestigeCount: 0, actionId: 'p-1' });
  assert.equal(proposal.status, 200);
  assert.equal(proposal.data.prestigeVote, 'pending');
  assert.equal(features().seasonMode.prestigeCount, 0);
  assert.equal(row.sharedCoins >= 5_000_000, true);
  // Every member sees the vote; Lara is offline and is not waited for.
  const guestView = (await get(GUEST)).data.room!.prestigeVote!;
  assert.equal(guestView.proposerName, 'Nicolas');
  assert.equal(guestView.keepNormalId, keep);
  assert.equal(guestView.keepName, STAR_XI_PLAYERS.find((player) => player.id === keep)!.name);
  assert.deepEqual(guestView.waitingRoles, ['guest']);
  assert.deepEqual(guestView.approvedRoles, ['host']);
  assert.equal(guestView.viewerMustVote, true);
  assert.ok(guestView.expiresInMs > 0 && guestView.expiresInMs <= PRESTIGE_VOTE_MS);
  assert.equal((await get(HOST)).data.room!.prestigeVote!.viewerIsProposer, true);
  assert.equal((await get(THIRD)).data.room!.prestigeVote!.viewerMustVote, false);
  // The proposal sent again (lost answer, new action id) opens no second vote.
  const resent = await post('season-prestige', { requestId: 'vote-1', keepNormalId: keep, expectedPrestigeCount: 0 });
  assert.equal(resent.data.prestigeVote, 'pending');
  // Another proposal while this one is open is refused.
  const second = await post('season-prestige', { requestId: 'vote-2', keepNormalId: keep, expectedPrestigeCount: 0 }, GUEST);
  assert.equal(second.status, 409);
  assert.equal(second.data.errorCode, 'PRESTIGE_VOTE_OPEN');
  // The guest agrees: Prestige runs with the proposer's card.
  const approved = await post('prestige-vote', { voteId: 'vote-1', decision: 'approve', actionId: 'a-1' }, GUEST);
  assert.equal(approved.status, 200);
  assert.equal(approved.data.prestigeVoteResult, 'approved');
  assert.equal(features().seasonMode.prestigeCount, 1);
  assert.equal(row.sharedCoins, 0);
  assert.deepEqual([...features().starXI.ownedIds].sort(), [...SPECIALS, keep].sort());
  assert.equal(clickState()._prestigeVote, undefined);
  // Duplicates change nothing: the same answer again, a new agreement, the proposal again.
  assert.equal((await post('prestige-vote', { voteId: 'vote-1', decision: 'approve', actionId: 'a-1' }, GUEST)).data.duplicate, true);
  const late = await post('prestige-vote', { voteId: 'vote-1', decision: 'approve' }, GUEST);
  assert.equal(late.status, 200);
  assert.equal(late.data.prestigeVoteResult, 'approved');
  assert.equal((await post('season-prestige', { requestId: 'vote-1', keepNormalId: keep, expectedPrestigeCount: 0 })).status, 200);
  assert.equal(features().seasonMode.prestigeCount, 1);
  assert.equal(features().history.filter((entry) => /^Prestige \d+ gestartet$/.test(entry.title)).length, 1);
  assert.equal((await get(GUEST)).data.room!.prestigeVoteResult?.outcome, 'approved');
});

test('one decline closes the vote for everyone; the proposer can cancel; nothing is reset', async () => {
  const keep = voteRoom({ player3LastSeenAt: new Date().toISOString() });
  assert.equal((await post('season-prestige', { requestId: 'vote-d', keepNormalId: keep, expectedPrestigeCount: 0 })).data.prestigeVote, 'pending');
  assert.equal((await post('prestige-vote', { voteId: 'vote-d', decision: 'approve' }, GUEST)).data.prestigeVote, 'pending');
  const declined = await post('prestige-vote', { voteId: 'vote-d', decision: 'decline' }, THIRD);
  assert.equal(declined.status, 200);
  assert.equal(declined.data.prestigeVoteResult, 'declined');
  assert.equal(declined.data.room?.prestigeVote, null);
  assert.equal(declined.data.room?.prestigeVoteResult?.by, 'Lara');
  assert.equal(features().seasonMode.prestigeCount, 0);
  assert.equal(row.sharedCoins >= 5_000_000, true);
  // Agreeing after the decline does not reopen it.
  assert.equal((await post('prestige-vote', { voteId: 'vote-d', decision: 'approve' }, GUEST)).data.prestigeVoteResult, 'declined');
  assert.equal(features().seasonMode.prestigeCount, 0);
  // A new proposal, cancelled by the proposer.
  assert.equal((await post('season-prestige', { requestId: 'vote-c', keepNormalId: keep, expectedPrestigeCount: 0 }, GUEST)).data.prestigeVote, 'pending');
  const cancelled = await post('prestige-vote', { voteId: 'vote-c', decision: 'decline' }, GUEST);
  assert.equal(cancelled.data.prestigeVoteResult, 'cancelled');
  assert.equal(features().seasonMode.prestigeCount, 0);
  // An unknown vote is refused.
  assert.equal((await post('prestige-vote', { voteId: 'nope', decision: 'approve' })).status, 409);
});

test('a vote nobody answers expires; the leader closes it and a late agreement does not start Prestige', async (t) => {
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  const keep = voteRoom({ hostLastSeenAt: new Date(clock).toISOString(), guestLastSeenAt: new Date(clock).toISOString(), lastPassiveAt: new Date(clock).toISOString() });
  assert.equal((await post('season-prestige', { requestId: 'vote-e', keepNormalId: keep, expectedPrestigeCount: 0 })).data.prestigeVote, 'pending');
  clock += PRESTIGE_VOTE_MS + 1000;
  row = { ...row, guestLastSeenAt: new Date(clock).toISOString() };
  // The vote is no longer shown, and the leader's tick closes it for good.
  assert.equal((await get(GUEST)).data.room?.prestigeVote, null);
  const tick = await post('tick');
  assert.equal(tick.status, 200);
  assert.equal(clickState()._prestigeVote, undefined);
  assert.equal((clickState()._prestigeVoteResult as { outcome: string }).outcome, 'expired');
  const late = await post('prestige-vote', { voteId: 'vote-e', decision: 'approve' }, GUEST);
  assert.equal(late.data.prestigeVoteResult, 'expired');
  assert.equal(features().seasonMode.prestigeCount, 0);
});

test('offline members never block: alone online Prestige starts at once, and a voter who goes offline no longer holds it up', async (t) => {
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  const iso = () => new Date(clock).toISOString();
  // Alone online: the proposal is the whole vote.
  let keep = voteRoom({ guestLastSeenAt: OFFLINE(), player3LastSeenAt: OFFLINE(), hostLastSeenAt: iso(), lastPassiveAt: iso() });
  const alone = await post('season-prestige', { requestId: 'alone', keepNormalId: keep, expectedPrestigeCount: 0 });
  assert.equal(alone.status, 200);
  assert.equal(alone.data.prestigeVote, undefined);
  assert.equal(features().seasonMode.prestigeCount, 1);
  // Lara and Silvan are online at the proposal; Silvan agrees, Lara closes the app (offline mark).
  keep = voteRoom({ hostLastSeenAt: iso(), guestLastSeenAt: iso(), player3LastSeenAt: iso(), lastPassiveAt: iso() });
  assert.equal((await post('season-prestige', { requestId: 'vote-o', keepNormalId: keep, expectedPrestigeCount: 0 })).data.prestigeVote, 'pending');
  assert.equal((await post('prestige-vote', { voteId: 'vote-o', decision: 'approve' }, GUEST)).data.prestigeVote, 'pending');
  assert.equal((await post('presence-offline', {}, THIRD)).status, 200);
  assert.equal(features().seasonMode.prestigeCount, 0);
  // The next tick of the simulation leader settles the vote: everybody still online agreed.
  clock += 6000;
  const tick = await post('tick');
  assert.equal(tick.status, 200);
  assert.equal(features().seasonMode.prestigeCount, 1);
  assert.equal((clickState()._prestigeVoteResult as { outcome: string }).outcome, 'approved');
});

test('a vote whose proposer leaves is cancelled, and a Prestige that became impossible fails without resetting', async () => {
  const keep = voteRoom({ player3LastSeenAt: new Date().toISOString() });
  assert.equal((await post('season-prestige', { requestId: 'vote-l', keepNormalId: keep, expectedPrestigeCount: 0 }, GUEST)).data.prestigeVote, 'pending');
  assert.equal((await post('leave-seat', {}, GUEST)).status, 200);
  assert.equal((await get(HOST)).data.room?.prestigeVote, null);
  assert.equal((await post('prestige-vote', { voteId: 'vote-l', decision: 'approve' }, THIRD)).data.prestigeVoteResult, 'cancelled');
  assert.equal(features().seasonMode.prestigeCount, 0);
  // The kept card leaves the squad while the vote is open: the vote fails and says why.
  assert.equal((await post('season-prestige', { requestId: 'vote-f', keepNormalId: keep, expectedPrestigeCount: 0 })).data.prestigeVote, 'pending');
  const stored = features();
  stored.starXI.ownedIds = stored.starXI.ownedIds.filter((id) => id !== keep);
  stored.starXI.lineupIds = stored.starXI.lineupIds.map((id) => id === keep ? '' : id);
  stored.starXI.benchIds = stored.starXI.benchIds.map((id) => id === keep ? '' : id);
  row = { ...row, sharedFeaturesJson: JSON.stringify(stored), sharedStateVersion: row.sharedStateVersion + 1 };
  clearRoomCacheForTests();
  const failed = await post('prestige-vote', { voteId: 'vote-f', decision: 'approve' }, THIRD);
  assert.equal(failed.status, 200);
  assert.equal(failed.data.prestigeVoteResult, 'failed');
  assert.equal(features().seasonMode.prestigeCount, 0);
  assert.equal(clickState()._prestigeVote, undefined);
});

test('the client texts: last activity of a member, the end of a vote, the seconds left; the vote window matches the server', () => {
  const now = Date.parse('2026-11-06T12:00:00.000Z');
  assert.equal(coopLastActiveLabel({ occupied: true, online: true, lastActiveAt: now }, now), 'online');
  assert.equal(coopLastActiveLabel({ occupied: true, online: false, lastActiveAt: now - 3 * 60 * 60_000 }, now), 'heute aktiv');
  assert.equal(coopLastActiveLabel({ occupied: true, online: false, lastActiveAt: now - DAY - 1 }, now), 'vor 1 Tag aktiv');
  assert.equal(coopLastActiveLabel({ occupied: true, online: false, lastActiveAt: now - 9 * DAY }, now), 'vor 9 Tagen aktiv');
  assert.equal(coopLastActiveLabel({ occupied: false, online: false, lastActiveAt: null }, now), '');
  assert.match(prestigeVoteMessage({ outcome: 'approved', prestigeCount: 1 }), /Prestige 2 ist gestartet/);
  assert.match(prestigeVoteMessage({ outcome: 'declined', by: 'Lara', prestigeCount: 0 }), /^Lara hat Prestige abgelehnt/);
  assert.match(prestigeVoteMessage({ outcome: 'expired', prestigeCount: 0 }), /abgelaufen/);
  assert.match(prestigeVoteMessage({ outcome: 'failed', reason: 'Eine laufende Partie.', prestigeCount: 0 }), /laufende Partie/);
  for (const outcome of ['approved', 'declined', 'cancelled', 'expired', 'failed']) assert.doesNotMatch(prestigeVoteMessage({ outcome, prestigeCount: 0 }), /[ß–—]/);
  assert.equal(PRESTIGE_VOTE_SECONDS * 1000, PRESTIGE_VOTE_MS);
  assert.equal(prestigeVoteSecondsLeft({ expiresAt: now + 59_100 }, now), 60);
  assert.equal(prestigeVoteSecondsLeft({ expiresAt: now - 5 }, now), 0);
});
