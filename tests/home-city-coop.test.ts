// Co-op home city (stadium Phase 1): one city per world. The host chooses it before the world's first league match;
// afterwards it changes only with a Prestige, whose vote carries the city, so every online member agrees to both.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { SEASON_MODE_DIVISION_COUNT, STAR_XI_PLAYERS, getPrestigeKeepCandidates, initialGameFeatures, normalizeGameFeatures, setBestStarXI } from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { installLightRoomMocks } from './helpers/light-room-mock.ts';
const { GoalClickerDatabase } = await import('../db/index.ts');
const { GET, POST, clearRoomCacheForTests } = await import('../app/api/multiplayer/route.ts');

let row: RoomRow;
GoalClickerDatabase.prototype.getRoom = async (code) => code === row.code ? structuredClone(row) : null;
GoalClickerDatabase.prototype.updateRoom = async (code, values: RoomUpdate, conditions = {}) => {
  if (code !== row.code) return null;
  if (conditions.sharedStateVersion !== undefined && conditions.sharedStateVersion !== row.sharedStateVersion) return null;
  if (conditions.lastPassiveAt !== undefined && conditions.lastPassiveAt !== row.lastPassiveAt) return null;
  row = { ...row, ...values }; return structuredClone(row);
};
installLightRoomMocks(GoalClickerDatabase);
const HOST = 'host-player-123', GUEST = 'guest-player-123';
const OFFLINE = () => new Date(Date.now() - 10 * 60_000).toISOString();

function setup(features: GameFeatures, guestOnline = true) {
  const iso = new Date().toISOString();
  const defaults = Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([key, column]) => [key, column.default ?? null]));
  row = { ...defaults, code: 'HOMEC1', roomName: 'Testwelt', hostPlayerId: HOST, hostName: 'Nicolas', guestPlayerId: GUEST, guestName: 'Silvan', hostLastSeenAt: iso, guestLastSeenAt: guestOnline ? iso : OFFLINE(), lastPassiveAt: iso, updatedAt: iso, sharedCoins: 5_000_000, sharedFeaturesJson: JSON.stringify(features) } as RoomRow;
  clearRoomCacheForTests();
}
type Answer = { error?: string; prestigeVote?: string; room?: { prestigeVote: { homeCity?: string } | null } };
async function post(action: string, extra: Record<string, unknown> = {}, playerId = HOST) {
  const response = await POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, code: 'HOMEC1', playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION, ...extra }) }));
  return { status: response.status, data: await response.json() as Answer };
}
async function get(playerId: string) {
  const response = await GET(new Request(`http://localhost/api/multiplayer?code=HOMEC1&playerId=${playerId}&protocol=${MULTIPLAYER_PROTOCOL_VERSION}`));
  return await response.json() as Answer;
}
const world = () => normalizeGameFeatures(JSON.parse(row.sharedFeaturesJson));

const SPECIALS = ['star-goat-nicu', 'star-maetthu', 'star-pfuschi', 'star-champ-simu'];
const NORMALS = STAR_XI_PLAYERS.filter((player) => !player.isCustom && !player.retired && !player.id.startsWith('scrap-')).slice(0, 24).map((player) => player.id);
function hallOfFame(): GameFeatures {
  const features = initialGameFeatures(1_000_000);
  features.starterSquadGranted = true;
  features.starXI = setBestStarXI({ ...features.starXI, ownedIds: [...SPECIALS, ...NORMALS] }, []);
  features.seasonMode = { ...features.seasonMode, division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, hallOfFame: true, prestigeCount: 0 };
  return normalizeGameFeatures(features);
}

test('the host chooses the city of a new world; members cannot, and after the first league match nobody can', async () => {
  setup(initialGameFeatures(1_000));
  assert.equal((await post('home-city', { city: 'basel' }, GUEST)).status, 403);
  assert.equal(world().seasonMode.homeCity, undefined, 'an old or new world without a choice is Bern');
  assert.equal((await post('home-city', { city: 'paris' })).status, 400);
  const chosen = await post('home-city', { city: 'basel' });
  assert.equal(chosen.status, 200, chosen.data.error);
  assert.equal(world().seasonMode.homeCity, 'basel');
  assert.ok(world().seasonMode.table.filter((r) => r.id !== 'club').every((r) => r.clubId!.startsWith('bs-')), 'the whole world plays the Basel leagues');
  const played = world();
  played.seasonMode = { ...played.seasonMode, matchday: 1, history: [{ id: 'm1', division: 1, matchday: 1, opponent: 'X', opponentRating: 40, clubScore: 1, opponentScore: 0, outcome: 'win', completedSeason: false, seasonOutcome: null, createdAt: 1 }] };
  setup(played);
  const late = await post('home-city', { city: 'geneve' });
  assert.equal(late.status, 409);
  assert.match(late.data.error ?? '', /Prestige/);
  assert.equal(world().seasonMode.homeCity, 'basel');
});

test('a world Prestige carries the chosen city in its vote; the city changes only once every online member agreed', async () => {
  setup(hallOfFame());
  const keep = getPrestigeKeepCandidates(world())[0].id;
  const proposal = await post('season-prestige', { requestId: 'city-vote', keepNormalId: keep, homeCity: 'geneve', expectedPrestigeCount: 0 });
  assert.equal(proposal.data.prestigeVote, 'pending');
  assert.equal(world().seasonMode.homeCity, undefined, 'nothing changes before the vote');
  assert.equal((await get(GUEST)).room!.prestigeVote!.homeCity, 'geneve', 'the member sees the city it votes on');
  const approved = await post('prestige-vote', { voteId: 'city-vote', decision: 'approve' }, GUEST);
  assert.equal(approved.status, 200, approved.data.error);
  assert.equal(world().seasonMode.prestigeCount, 1);
  assert.equal(world().seasonMode.homeCity, 'geneve');
  assert.ok(world().seasonMode.table.filter((r) => r.id !== 'club').every((r) => r.clubId!.startsWith('ge-')));
});

test('alone online, a Prestige with a city starts at once; without a city the world keeps its own', async () => {
  setup(hallOfFame(), false);
  const keep = getPrestigeKeepCandidates(world())[0].id;
  const started = await post('season-prestige', { requestId: 'solo-city', keepNormalId: keep, homeCity: 'zurich', expectedPrestigeCount: 0 });
  assert.equal(started.status, 200, started.data.error);
  assert.equal(world().seasonMode.homeCity, 'zurich');
  const again = world();
  again.seasonMode = { ...again.seasonMode, division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, hallOfFame: true };
  setup(normalizeGameFeatures(again), false);
  const kept = await post('season-prestige', { requestId: 'no-city', keepNormalId: getPrestigeKeepCandidates(world())[0].id, expectedPrestigeCount: 1 });
  assert.equal(kept.status, 200, kept.data.error);
  assert.equal(world().seasonMode.prestigeCount, 2);
  assert.equal(world().seasonMode.homeCity, 'zurich');
});
