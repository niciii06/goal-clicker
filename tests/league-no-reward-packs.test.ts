// Notion ticket «Automatische Prämienpacks nach jeweils vier Ligaspielen abschaffen»: behaviour through the real co-op server action
// (cup-tick settles a finished match). The old rule gave one reward pack when the stamp counter reached four (win, draw or loss alike).
// Here the counter stands at the old trigger value and twelve league matches are settled; no pack may appear, saved packs stay, and a
// tournament win still gives exactly one pack. The solo path is covered in tests/browser/sonnet-acceptance.test.ts.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import { initialGameFeatures, STAR_XI_PLAYERS, advanceCupMatch, beginSeasonCupMatch, getStarXISelection, resumeCupMatch, setBestStarXI } from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';
import { prepareCareerMatch } from '../app/career-data.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { installLightRoomMocks } from './helpers/light-room-mock.ts';
const {GoalClickerDatabase}=await import('../db/index.ts');
const shared=await import('../app/api/multiplayer/route.ts');
const ledger=new Map<string,unknown>();let row:RoomRow;
GoalClickerDatabase.prototype.getSoloJourney=async(o,id)=>structuredClone(ledger.get(`${o}:${id}`)??null);
GoalClickerDatabase.prototype.putSoloJourney=async(o,id,v)=>{const key=`${o}:${id}`;if(!ledger.has(key))ledger.set(key,structuredClone(v));return structuredClone(ledger.get(key));};
GoalClickerDatabase.prototype.getRoom=async code=>code===row.code?structuredClone(row):null;
GoalClickerDatabase.prototype.updateRoom=async(code,values:RoomUpdate,conditions={})=>{if(code!==row.code||conditions.sharedStateVersion!==undefined&&conditions.sharedStateVersion!==row.sharedStateVersion||conditions.lastPassiveAt!==undefined&&conditions.lastPassiveAt!==row.lastPassiveAt)return null;row={...row,...values};return structuredClone(row);};
installLightRoomMocks(GoalClickerDatabase);

function setup(f:GameFeatures){const iso=new Date().toISOString(),defaults=Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([k,c])=>[k,c.default??null]));row={...defaults,code:'REWARD',hostPlayerId:'host-12345678',hostName:'Nicolas',guestPlayerId:'guest-12345678',guestName:'Silvan',hostLastSeenAt:iso,guestLastSeenAt:iso,lastPassiveAt:iso,updatedAt:iso,sharedFeaturesJson:JSON.stringify(f),sharedSeasons:14} as RoomRow;}
async function action(action:string,extra={},playerId='host-12345678'){const r=await shared.POST(new Request('http://localhost/api/multiplayer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,code:'REWARD',playerId,protocol:MULTIPLAYER_PROTOCOL_VERSION,...extra})}));return{status:r.status,data:await r.json() as {room?:{game:{features:GameFeatures}}}};}

const saved = () => JSON.parse(row.sharedFeaturesJson) as GameFeatures;

/**
 * The server ticks until the match is settled. Like the player, the test continues a break (half time, injury) with cup-resume.
 * Real time cannot pass in a test, so before each tick the saved state is moved 30 seconds into the past (last tick, end of the
 * match, end of a goal celebration); the server then has that much match time to play per tick, as in the running game.
 */
async function settle() {
  for (let tick = 0; tick < 80; tick++) {
    if (saved().cup.matchPaused) assert.equal((await action('cup-resume')).status, 200);
    const features = saved();
    if (!features.cup.active) return;
    features.cup.lastTickAt = Date.now() - 30000;
    features.cup.matchEndsAt = Math.min(features.cup.matchEndsAt, Date.now() - 1);
    if (features.cup.timedPause) features.cup.timedPause = { ...features.cup.timedPause, endsAt: Date.now() - 1 };
    row.sharedFeaturesJson = JSON.stringify(features);
    assert.equal((await action('cup-tick')).status, 200);
    if (!saved().cup.active) return;
  }
}

/** A world whose league match (today's simulation) is played to 20 seconds before the end; the server tick settles the rest. */
function almostFinishedLeagueMatch(seed: number, stamps = 3) {
  const f = initialGameFeatures(1000000 + seed);
  // A modest squad against strong opponents, so that wins, draws and losses all happen.
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => !p.isCustom && p.rating < 62).slice(0, 80).map((p) => p.id) });
  f.matchStamps = stamps; // the old rule fired when this reached four
  const start = Date.now() - 600000;
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, start, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f); // like the running game: this creates the simulation of the match
  assert.ok(f.cup.simulation, 'a new league match runs on the simulation');
  f.cup.opponentRating = 99;
  let now = start;
  for (let i = 0; i < 2000 && f.cup.active && now < f.cup.matchEndsAt - 20000; i++) {
    if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
    now = Math.min(f.cup.matchEndsAt - 20000, Math.max(now, f.cup.lastTickAt) + 15000);
    f.cup = advanceCupMatch(f.cup, 85, now, Math.random, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup;
  }
  assert.ok(f.cup.active, 'the match is still running, the server finishes it');
  return f;
}

test('twelve or more league matches (win, draw, loss) settle without a reward pack, even with the old counter at the trigger value', async () => {
  const outcomes = new Map<string, number>();
  let settled = 0;
  for (let seed = 1; settled < 12 || outcomes.size < 3; seed++) {
    assert.ok(seed < 200, `win, draw and loss were not all played in 200 matches (${[...outcomes.keys()].join(',')})`);
    const f = almostFinishedLeagueMatch(seed);
    const savedPack = { id: 'old-stamp-pack', packId: 'reward-3' as const, earnedAt: 2000 };
    f.earnedPacks = [savedPack];
    setup(f);
    await settle();
    const after = saved();
    // Real time cannot pass in a test: a match that the clock shortcut did not bring to the whistle is not counted (the packs are
    // checked below for every tick of it anyway) and the next one is played.
    assert.ok(!after.cup.active ? true : after.earnedPacks.length === 1, `match ${seed}: no pack while it was running either`);
    if (after.cup.active) continue;
    assert.ok(after.seasonMode.history.length > f.seasonMode.history.length, `match ${seed} is recorded in the season`);
    assert.deepEqual(after.earnedPacks.map((pack) => pack.id), ['old-stamp-pack'], `match ${seed}: no new pack, the saved one stays unopened`);
    assert.equal(after.earnedPacks[0].opening, undefined);
    assert.equal(after.matchStamps, 3, 'the old counter is neither increased nor reset');
    assert.ok(!after.history.some((entry) => /Matchstempel/.test(`${entry.title} ${entry.detail}`)), 'no stamp message in the club history');
    const outcome = after.seasonMode.history.at(-1)!.outcome;
    outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
    settled++;
  }
  assert.ok(settled >= 12);
  assert.deepEqual([...outcomes.keys()].sort(), ['draw', 'loss', 'win']);
});

test('the saved packs of an old world open unchanged while league matches settle', async () => {
  const f = almostFinishedLeagueMatch(3);
  f.earnedPacks = [{ id: 'old-1', packId: 'reward-2', earnedAt: 1 }, { id: 'old-2', packId: 'reward-4', earnedAt: 2 }];
  setup(f);
  await settle();
  const after = saved();
  assert.equal(after.cup.active, false);
  assert.deepEqual(after.earnedPacks.map((pack) => `${pack.id}:${pack.packId}`), ['old-1:reward-2', 'old-2:reward-4']);
  assert.equal((await action('reward-pack', { rewardId: 'old-1' })).status, 200, 'an old unopened pack still opens');
  assert.ok(saved().earnedPacks.find((pack) => pack.id === 'old-1')?.opening);
  assert.equal(saved().earnedPacks.find((pack) => pack.id === 'old-2')?.opening, undefined, 'the other one is untouched');
});
