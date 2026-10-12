import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { initialGameFeatures, setBestStarXI, STAR_XI_PLAYERS } from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';
import { fixtureFor } from '../app/travel-data.ts';
import type { Journey } from '../app/travel-data.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
registerHooks({resolve(specifier,context,next){if(specifier==='cloudflare:workers')return{shortCircuit:true,url:'data:text/javascript,export const env=globalThis.__TRAVEL_ENV__??{};'};return next(specifier,context);}});
(globalThis as typeof globalThis & {__TRAVEL_ENV__:unknown}).__TRAVEL_ENV__={DB:{}};
const { GoalClickerDatabase }=await import('../db/index.ts');
const {POST,GET}=await import('../app/api/multiplayer/route.ts');
const solo=await import('../app/api/travel/route.ts');
let row:RoomRow;
GoalClickerDatabase.prototype.getRoom=async code=>code===row.code?structuredClone(row):null;
GoalClickerDatabase.prototype.updateRoom=async(code,values:RoomUpdate,conditions={})=>{
 if(code!==row.code||conditions.sharedStateVersion!==undefined&&conditions.sharedStateVersion!==row.sharedStateVersion||conditions.lastPassiveAt!==undefined&&conditions.lastPassiveAt!==row.lastPassiveAt)return null;
 row={...row,...values};return structuredClone(row);
};
const ledger=new Map<string,Journey>();
GoalClickerDatabase.prototype.getSoloJourney=async(owner,id)=>structuredClone(ledger.get(`${owner}:${id}`)||null);
GoalClickerDatabase.prototype.putSoloJourney=async(owner,id,raw)=>{const key=`${owner}:${id}`;if(!ledger.has(key))ledger.set(key,structuredClone(raw as Journey));return structuredClone(ledger.get(key));};
GoalClickerDatabase.prototype.consumeSoloJourney=async(owner,id,raw)=>{ledger.set(`${owner}:${id}`,structuredClone(raw as Journey));};
function setup(day=5){const f=initialGameFeatures();f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.map(p=>p.id)});f.seasonMode.matchday=day;const iso=new Date().toISOString();const defaults=Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([k,c])=>[k,c.default??null]));row={...defaults,code:'TRAVEL',hostPlayerId:'host-player-123',hostName:'Nicolas',guestPlayerId:'guest-player-123',guestName:'Silvan',hostLastSeenAt:iso,guestLastSeenAt:iso,lastPassiveAt:iso,updatedAt:iso,sharedFeaturesJson:JSON.stringify(f),sharedSeasons:14} as RoomRow;return f;}
async function action(action:string,extra:Record<string,unknown>={},playerId='host-player-123'){const r=await POST(new Request('http://localhost/api/multiplayer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,code:'TRAVEL',playerId,protocol:MULTIPLAYER_PROTOCOL_VERSION,...extra})}));return{status:r.status,data:await r.json() as {room?:{game:{features:GameFeatures}};serverNow?:number;error?:string}};}
async function soloAction(action:string,extra:Record<string,unknown>={}){const r=await solo.POST(new Request('http://localhost/api/travel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,playerId:'solo-player-123',...extra})}));return{status:r.status,data:await r.json() as {journey:Journey;serverNow:number;error?:string}};}
test('server home match starts immediately at Bümplizstrasse 45 and no journey',async()=>{setup(0);const r=await action('cup-start',{mode:'season'});assert.equal(r.status,200);assert.equal(r.data.room!.game.features.cup.active,true);assert.equal(r.data.room!.game.features.travel.journey,null);});
test('shared server full departure → arrival → manual match start, duplicate clicks and alternate session',async t=>{
 setup();let clock=Date.now();t.mock.method(Date,'now',()=>clock);
 assert.equal((await action('cup-start',{mode:'season'})).status,409);
 const concurrent=await Promise.all([action('travel-start',{mode:'season'}),action('travel-start',{mode:'season'},'guest-player-123')]);assert.ok(concurrent.some(r=>r.status===200));
 const j=JSON.parse(row.sharedFeaturesJson).travel.journey as Journey;assert.equal(j.fixture.venue.city,'Bern');assert.equal(JSON.parse(row.sharedFeaturesJson).cup.active,false);
 const again=await action('travel-start',{mode:'season'},'guest-player-123');assert.equal(again.status,200);assert.deepEqual(again.data.room!.game.features.travel.journey,j);
 assert.equal((await action('cup-start',{mode:'season'})).status,409);
 const football=JSON.stringify(JSON.parse(row.sharedFeaturesJson).career);clock=j.endsAt+1;
 const viewed=await GET(new Request(`http://localhost/api/multiplayer?code=TRAVEL&playerId=guest-player-123&protocol=${MULTIPLAYER_PROTOCOL_VERSION}`));const restored=await viewed.json() as {room:{game:{features:GameFeatures}}};assert.equal(restored.room.game.features.cup.active,false);assert.equal(restored.room.game.features.travel.stats.trips,1);assert.equal(JSON.stringify(restored.room.game.features.career),football);
 const starts=await Promise.all([action('cup-start',{mode:'season'}),action('cup-start',{mode:'season'},'guest-player-123')]);assert.ok(starts.some(r=>r.status===200));const f=JSON.parse(row.sharedFeaturesJson);assert.equal(f.cup.active,true);assert.equal(f.travel.journey.consumed,true);assert.equal(f.travel.stats.trips,1);assert.equal(f.cup.opponent,j.fixture.opponent);
 assert.equal((await action('cup-start',{mode:'season'})).status,409);assert.equal(JSON.parse(row.sharedFeaturesJson).travel.stats.trips,1);
});
test('server cannot bypass journey using alternative season action or another competition',async()=>{
 setup();await action('travel-start',{mode:'season'});assert.equal((await action('season-match')).status,409);assert.equal((await action('cup-start',{tournamentId:'stadium'})).status,409);assert.equal(JSON.parse(row.sharedFeaturesJson).cup.active,false);
});
test('server revalidates red cards after arrival, preserves readiness for corrected lineup',async t=>{
 setup();let clock=Date.now();t.mock.method(Date,'now',()=>clock);await action('travel-start',{mode:'season'});const f=JSON.parse(row.sharedFeaturesJson);clock=f.travel.journey.endsAt+1;f.cup.suspendedPlayerIds=[f.starXI.lineupIds[0]];row.sharedFeaturesJson=JSON.stringify(f);
 assert.equal((await action('cup-start',{mode:'season'})).status,409);assert.equal(JSON.parse(row.sharedFeaturesJson).travel.journey.consumed,false);
});
test('tournament away destination matches persisted opponent schedule and retains cooldown rules',async t=>{
 setup(0);let clock=Date.now();t.mock.method(Date,'now',()=>clock);const started=await action('travel-start',{mode:'tournament',tournamentId:'world'});assert.equal(started.status,200);const j=started.data.room!.game.features.travel.journey!;clock=j.endsAt+1;
 const kickoff=await action('cup-start',{tournamentId:'world'});assert.equal(kickoff.status,200);assert.equal(kickoff.data.room!.game.features.cup.opponent,j.fixture.opponent);
 setup(0);const f=JSON.parse(row.sharedFeaturesJson);f.cup.nextTournamentAt=clock+300000;row.sharedFeaturesJson=JSON.stringify(f);assert.equal((await action('travel-start',{mode:'tournament',tournamentId:'stadium'})).status,409);
});
test('solo server timestamps reject fabricated arrival and local clock, reopens same receipt',async t=>{
 ledger.clear();const f=setup();let clock=Date.now();t.mock.method(Date,'now',()=>clock);
 const responses=await Promise.all([soloAction('depart',{features:f,mode:'season'}),soloAction('depart',{features:f,mode:'season'})]);assert.ok(responses.every(r=>r.status===200));assert.equal(ledger.size,1);assert.deepEqual(responses[0].data.journey,responses[1].data.journey);
 const j=responses[0].data.journey;f.travel.journey={...j,endsAt:clock-1};assert.equal((await soloAction('start',{features:f,mode:'season'})).status,409);
 const reopened=await soloAction('status',{fixtureId:j.fixture.id});assert.deepEqual(reopened.data.journey,j);assert.equal(reopened.data.serverNow,clock);
 clock=j.endsAt+1;const arrived=await soloAction('status',{fixtureId:j.fixture.id});assert.equal(arrived.data.journey.consumed,false);
 const kickoff=await soloAction('start',{features:f,mode:'season'});assert.equal(kickoff.status,200);assert.equal(kickoff.data.journey.consumed,true);assert.equal(ledger.size,1);
});
test('unregistered shared player and incomplete solo lineup cannot depart',async()=>{
 const f=setup();assert.equal((await action('travel-start',{mode:'season'},'stranger-12345')).status,403);f.starXI.ownedIds=[];f.starXI.lineupIds=[];
 assert.equal((await soloAction('depart',{features:f,mode:'season'})).status,409);assert.equal(fixtureFor(f,'season').away,true);
});

test('server season alternates home/away across all ten matchdays',async t=>{
 let clock=Date.now();t.mock.method(Date,'now',()=>clock);
 for(let day=0;day<10;day++){
  setup(day);
  const first=await action('cup-start',{mode:'season'});
  if(day%2===0){assert.equal(first.status,200,`home matchday ${day+1}`);assert.equal(first.data.room!.game.features.travel.journey,null);}
  else {
   assert.equal(first.status,409,`away matchday ${day+1} needs travel`);
   const departure=await action('travel-start',{mode:'season'});assert.equal(departure.status,200);
   assert.equal(departure.data.room!.game.features.cup.active,false);
   clock=departure.data.room!.game.features.travel.journey!.endsAt+1;
   assert.equal((await action('cup-start',{mode:'season'})).status,200);
  }
 }
});
