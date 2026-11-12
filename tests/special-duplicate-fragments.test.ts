// Owner decision (12 Nov 2026): every duplicate special card pays exactly 25,000 fragments, bought or free, solo or co-op.
// All other card types keep their own compensation rules; the pack price, the equal chances and stored results stay.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import { SPECIAL_CARD_DUPLICATE_FRAGMENTS, SPECIAL_CARD_PACK, STAR_XI_CUSTOM_PLAYERS, STAR_XI_PLAYERS, getStarXIFragmentCompensation, getStarXIPlayer, initialGameFeatures, normalizeGameFeatures, openEarnedPack, purchaseSpecialCardPack } from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { installLightRoomMocks } from './helpers/light-room-mock.ts';
const {GoalClickerDatabase}=await import('../db/index.ts');
const solo=await import('../app/api/rewards/route.ts');
const shared=await import('../app/api/multiplayer/route.ts');
const ledger=new Map<string,unknown>();let row:RoomRow;
GoalClickerDatabase.prototype.getSoloJourney=async(o,id)=>structuredClone(ledger.get(`${o}:${id}`)??null);
GoalClickerDatabase.prototype.putSoloJourney=async(o,id,v)=>{const key=`${o}:${id}`;if(!ledger.has(key))ledger.set(key,structuredClone(v));return structuredClone(ledger.get(key));};
GoalClickerDatabase.prototype.getRoom=async code=>code===row.code?structuredClone(row):null;
GoalClickerDatabase.prototype.updateRoom=async(code,values:RoomUpdate,conditions={})=>{if(code!==row.code||conditions.sharedStateVersion!==undefined&&conditions.sharedStateVersion!==row.sharedStateVersion||conditions.lastPassiveAt!==undefined&&conditions.lastPassiveAt!==row.lastPassiveAt)return null;row={...row,...values};return structuredClone(row);};
installLightRoomMocks(GoalClickerDatabase);
async function request(f:GameFeatures,id='world:123456',playerId='reward-owner-123'){const r=await solo.POST(new Request('http://localhost/api/rewards',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({playerId,rewardId:id,features:f})}));return{status:r.status,data:await r.json()};}
function setup(f:GameFeatures){const iso=new Date().toISOString(),defaults=Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([k,c])=>[k,c.default??null]));row={...defaults,code:'REWARD',hostPlayerId:'host-12345678',hostName:'Nicolas',guestPlayerId:'guest-12345678',guestName:'Silvan',hostLastSeenAt:iso,guestLastSeenAt:iso,lastPassiveAt:iso,updatedAt:iso,sharedFeaturesJson:JSON.stringify(f),sharedSeasons:14} as RoomRow;}
async function action(action:string,extra={},playerId='host-12345678'){const r=await shared.POST(new Request('http://localhost/api/multiplayer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,code:'REWARD',playerId,protocol:MULTIPLAYER_PROTOCOL_VERSION,...extra})}));return{status:r.status,data:await r.json() as {room?:{game:{features:GameFeatures}}}};}

const allSpecialIds = STAR_XI_CUSTOM_PLAYERS.map((player) => player.id);
/** A world that owns every special card (so every draw is a duplicate), in Liga 3 where the pack opens. */
function allOwned(fragments = 100000) {
  const f = initialGameFeatures();
  f.starXI.ownedIds = [...new Set([...f.starXI.ownedIds, ...allSpecialIds])];
  f.starXI.fragments = fragments;
  f.seasonMode.highestDivision = 13;
  f.earnedPacks = [];
  return f;
}
const saved = () => JSON.parse(row.sharedFeaturesJson) as GameFeatures;

test('the amount is fixed: 25,000 for every special card, other card types keep their rating based rules', () => {
  assert.equal(SPECIAL_CARD_DUPLICATE_FRAGMENTS, 25000);
  for (const player of STAR_XI_CUSTOM_PLAYERS) assert.equal(getStarXIFragmentCompensation(player), 25000, player.id);
  const others = STAR_XI_PLAYERS.filter((player) => !player.isCustom);
  const icon = others.find((player) => player.cardType === 'icon')!, normal = others.find((player) => !player.cardType && player.rating === 70)!, base = others.find((player) => player.cardType === 'base')!;
  assert.equal(getStarXIFragmentCompensation(icon), Math.max(1, Math.min(34, (icon.packRating ?? icon.rating) - 66)) * 75);
  assert.equal(getStarXIFragmentCompensation(normal), Math.max(1, Math.min(34, normal.rating - 66)) * 15);
  assert.equal(getStarXIFragmentCompensation(base), Math.max(1, Math.min(34, (base.packRating ?? base.rating) - 66)) * 15);
  assert.ok(others.every((player) => getStarXIFragmentCompensation(player) < 25000));
  assert.equal(SPECIAL_CARD_PACK.price, 50000);
});

test('solo, bought: every duplicate special pack costs 50,000 and pays back 25,000, whatever the card', () => {
  for (const [index, player] of STAR_XI_CUSTOM_PLAYERS.entries()) {
    const f = allOwned();
    const result = purchaseSpecialCardPack(f, `buy-${index}`, { random: () => (index + 0.5) / STAR_XI_CUSTOM_PLAYERS.length, now: 1000 });
    assert.ok(result.ok && result.reveal.player.id === player.id);
    assert.equal(result.reveal.duplicate, true);
    assert.equal(result.reveal.fragmentCompensation, 25000);
    assert.equal(f.starXI.fragments, 100000 - 50000 + 25000);
    assert.equal(f.starXI.ownedIds.filter((id) => id === player.id).length, 1, 'no second inventory entry');
    // The same purchase ID again changes nothing (double click, network retry).
    const snapshot = JSON.stringify(f);
    assert.equal(purchaseSpecialCardPack(f, `buy-${index}`, { random: () => 0, now: 1001 }).ok, false);
    assert.equal(JSON.stringify(f), snapshot);
  }
  // A new card pays nothing back.
  const fresh = allOwned();
  fresh.starXI.ownedIds = fresh.starXI.ownedIds.filter((id) => id !== STAR_XI_CUSTOM_PLAYERS[0].id);
  const first = purchaseSpecialCardPack(fresh, 'new-1', { random: () => 0, now: 1 });
  assert.ok(first.ok && !first.reveal.duplicate && first.reveal.fragmentCompensation === 0);
  assert.equal(fresh.starXI.fragments, 50000);
});

test('solo, free: a duplicate from the gift pack pays 25,000 once, a repeated opening pays nothing again', () => {
  const f = allOwned(0);
  f.earnedPacks = [{ id: 'daily-solo-1', packId: 'special', earnedAt: 1 }];
  const reveal = openEarnedPack(f, 'daily-solo-1', 2, () => 0.5)!;
  assert.equal(reveal.duplicate, true);
  assert.equal(reveal.fragmentCompensation, 25000);
  assert.equal(f.starXI.fragments, 25000, 'free: nothing is paid for the pack');
  assert.equal(openEarnedPack(f, 'daily-solo-1', 3, () => 0.5), null);
  assert.equal(f.starXI.fragments, 25000, 'no double credit');
  const reloaded = normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
  assert.equal(reloaded.starXI.fragments, 25000);
  assert.equal(reloaded.earnedPacks[0].opening?.fragmentCompensation, 25000);
  assert.equal(openEarnedPack(reloaded, 'daily-solo-1', 4, () => 0.5), null);
});

test('solo server receipt (free pack): the server draw carries the 25,000, a second request returns the same receipt', async () => {
  ledger.clear();
  const f = allOwned(0);
  f.earnedPacks = [{ id: 'daily-solo-9', packId: 'special', earnedAt: 1 }];
  const first = await request(f, 'daily-solo-9');
  assert.equal(first.status, 200);
  const opening = (first.data as { opening: { duplicate: boolean; fragmentCompensation: number; player: { isCustom?: boolean } } }).opening;
  assert.equal(opening.duplicate, true);
  assert.equal(opening.fragmentCompensation, 25000);
  assert.ok(opening.player.isCustom);
  const second = await request(f, 'daily-solo-9');
  assert.deepEqual(second.data, first.data);
  assert.equal(ledger.size, 1);
  // The client applies the receipt: it pays once.
  const reveal = openEarnedPack(f, 'daily-solo-9', 2, Math.random, (first.data as { opening: never }).opening)!;
  assert.equal(reveal.fragmentCompensation, 25000);
  assert.equal(f.starXI.fragments, 25000);
});

test('co-op, bought: the server charges 50,000 and credits 25,000 for a duplicate, once per purchase ID', async () => {
  const f = allOwned();
  setup(f);
  const first = await action('special-pack', { purchaseId: 'coop-buy-1' });
  assert.equal(first.status, 200);
  assert.equal(saved().starXI.fragments, 100000 - 50000 + 25000);
  const again = await action('special-pack', { purchaseId: 'coop-buy-1' });
  assert.equal(again.status, 409);
  assert.equal(saved().starXI.fragments, 75000, 'a repeated request charges and credits nothing');
  // The other member sends the same purchase ID at the same time: still one settlement.
  const both = await Promise.all([action('special-pack', { purchaseId: 'coop-buy-2' }), action('special-pack', { purchaseId: 'coop-buy-2' }, 'guest-12345678')]);
  assert.equal(both.filter((result) => result.status === 200).length, 1);
  assert.equal(saved().starXI.fragments, 75000 - 50000 + 25000);
  // Not enough fragments: nothing happens.
  setup(allOwned(49999));
  assert.notEqual((await action('special-pack', { purchaseId: 'coop-poor' })).status, 200);
  assert.equal(saved().starXI.fragments, 49999);
});

test('co-op, bought with an old client: the legacy action pays the same 25,000', async () => {
  setup(allOwned());
  assert.equal((await action('star-custom-buy')).status, 200);
  assert.equal(saved().starXI.fragments, 75000);
});

test('co-op, free: opening a gift special pack pays 25,000 for a duplicate once, even if both members tap', async () => {
  const f = allOwned(0);
  f.earnedPacks = [{ id: 'world:777', packId: 'special', earnedAt: 1 }];
  setup(f);
  const results = await Promise.all([action('reward-pack', { rewardId: 'world:777' }), action('reward-pack', { rewardId: 'world:777' }, 'guest-12345678')]);
  assert.ok(results.every((result) => result.status === 200 || result.status === 409), results.map((result) => result.status).join());
  const after = saved();
  assert.equal(after.starXI.fragments, 25000, 'credited exactly once');
  assert.equal(after.earnedPacks.find((pack) => pack.id === 'world:777')?.opening?.fragmentCompensation, 25000);
  await action('reward-pack', { rewardId: 'world:777' });
  assert.equal(saved().starXI.fragments, 25000, 'a third tap pays nothing');
});

test('stored results and saves stay as they are: an old opened pack keeps its amount, other cards keep theirs', () => {
  const f = initialGameFeatures();
  const player = getStarXIPlayer(STAR_XI_CUSTOM_PLAYERS[0].id)!;
  // A pack opened before the change paid 600; that result is stored and is never recalculated.
  f.earnedPacks = [{ id: 'old-1', packId: 'special', earnedAt: 1, opening: { packId: 'legend', packName: SPECIAL_CARD_PACK.label, player, duplicate: true, fragmentCompensation: 600, source: 'custom-draw' } }];
  f.starXI.fragments = 12345;
  const reloaded = normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
  assert.equal(reloaded.earnedPacks[0].opening?.fragmentCompensation, 600);
  assert.equal(reloaded.starXI.fragments, 12345);
  assert.equal(openEarnedPack(reloaded, 'old-1', 5), null);
  assert.equal(reloaded.starXI.fragments, 12345);
  // A duplicate regular card still pays by its rating step.
  const normal = STAR_XI_PLAYERS.find((candidate) => !candidate.isCustom && !candidate.cardType && candidate.rating === 70)!;
  assert.equal(getStarXIFragmentCompensation(normal), 4 * 15);
});
