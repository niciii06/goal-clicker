import { createJourney, fixtureFor } from '../app/travel-data.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import { initialGameFeatures, normalizeGameFeatures, setBestStarXI, STAR_XI_PLAYERS } from '../app/feature-data.ts';
import { emptyPlayerStats, getAlbumGroups } from '../app/career-data.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import type { GameFeatures } from '../app/feature-data.ts';
type TestResponse = { room: { game: { features: GameFeatures } }; error?: string };
import type { RoomRow, RoomUpdate } from '../db/index.ts';

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === 'cloudflare:workers') return { shortCircuit: true, url: 'data:text/javascript,export const env = globalThis.__SITES_TEST_ENV__ ?? {};' }; return nextResolve(specifier, context); } });
(globalThis as typeof globalThis & {__SITES_TEST_ENV__:unknown}).__SITES_TEST_ENV__={DB:{}};
const { GoalClickerDatabase }=await import('../db/index.ts');
const { POST,GET }=await import('../app/api/multiplayer/route.ts');
let row: RoomRow;
GoalClickerDatabase.prototype.getRoom=async code=>code===row.code?structuredClone(row):null;
GoalClickerDatabase.prototype.updateRoom=async(code,values:RoomUpdate,conditions={})=>{
  if(code!==row.code||conditions.sharedStateVersion!==undefined&&conditions.sharedStateVersion!==row.sharedStateVersion||conditions.lastPassiveAt!==undefined&&conditions.lastPassiveAt!==row.lastPassiveAt)return null;
  row={...row,...values};return structuredClone(row);
};
function setup(features=initialGameFeatures()) {
 const now=new Date().toISOString();
 const defaults=Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([key,col])=>[key,col.default??null]));
 row={...defaults,code:'CAREER',hostPlayerId:'host-player-123',hostName:'Nicolas',guestPlayerId:'guest-player-123',guestName:'Silvan',hostLastSeenAt:now,guestLastSeenAt:now,lastPassiveAt:now,updatedAt:now,sharedFeaturesJson:JSON.stringify(features)} as RoomRow;
}
async function action(action:string,extra:Record<string,unknown>={},playerId='host-player-123') {
 const response=await POST(new Request('http://localhost/api/multiplayer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,code:'CAREER',playerId,protocol:MULTIPLAYER_PROTOCOL_VERSION,...extra})}));
 return {status:response.status,data:await response.json() as TestResponse};
}
test('API protects career state from obsolete clients and unknown players',async()=>{
 setup();const previous=row.sharedFeaturesJson;
 const old=await action('album-claim',{groupId:'custom',protocol:2});assert.equal(old.status,426);assert.equal(row.sharedFeaturesJson,previous);
 const unauthorized=await action('album-claim',{groupId:'custom'},'not-a-member-123');assert.equal(unauthorized.status,403);assert.equal(row.sharedFeaturesJson,previous);
});
test('API album reward is persisted once and visible to both room members',async()=>{
 const f=initialGameFeatures(),nation=getAlbumGroups(f.career).find(g=>g.id.startsWith('nation-')&&g.total===1)!;
 f.starXI.ownedIds=[STAR_XI_PLAYERS.find(p=>p.countryCode===nation.id.slice(7))!.id];setup(f);
 const claimed=await action('album-claim',{groupId:nation.id});assert.equal(claimed.status,200);assert.equal(claimed.data.room.game.features.starXI.fragments,500);
 const again=await action('album-claim',{groupId:nation.id},'guest-player-123');assert.equal(again.status,409);assert.equal(JSON.parse(row.sharedFeaturesJson).starXI.fragments,500);
 const response=await GET(new Request(`http://localhost/api/multiplayer?code=CAREER&playerId=guest-player-123&protocol=${MULTIPLAYER_PROTOCOL_VERSION}`));assert.equal(response.status,200);
 const viewed=await response.json() as TestResponse;assert.equal(viewed.room.game.features.starXI.fragments,500);assert.ok(viewed.room.game.features.career.claimedAlbumRewards.includes(nation.id));
});
test('API kickoff snapshots form and special bonuses, tick finishes with awards and derby reward only once',async()=>{
 let f=initialGameFeatures();f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.map(p=>p.id)});f=normalizeGameFeatures(f);
 const player=f.starXI.lineupIds[1];f.career.players[player]={...emptyPlayerStats(),recent:[8,8,8,8,8],appearances:25};f.career.milestoneCards[player]=['loyal'];f.seasonMode.matchday=9;f.career.seasonMatches=9;f.travel.journey=createJourney(fixtureFor(f,'season'),Date.now()-180000,()=>.9);setup(f);
 const started=await action('cup-start',{mode:'season'});assert.equal(started.status,200,JSON.stringify(started.data));
 let current=started.data.room.game.features;assert.ok(current.cup.careerMatchId);assert.ok((current.cup.careerBonuses?.[player] ?? 0)>0);
 current.cup.homeScore=2;current.cup.awayScore=0;current.cup.lastTickAt=current.cup.matchEndsAt;current.cup.matchStartedAt=Date.now()-180001;current.cup.matchEndsAt=Date.now()-1;
 current.career.rivals[`rival:${current.cup.opponent.toLocaleLowerCase('de-CH')}`]={opponent:current.cup.opponent,played:3,wins:2,draws:0,losses:1,goalsFor:3,goalsAgainst:2,closeGames:3,active:true,lastResults:['1:0'],lastPlayedAt:1};
 row.sharedFeaturesJson=JSON.stringify(current);
 const finished=await action('cup-tick');assert.equal(finished.status,200,JSON.stringify(finished.data));current=finished.data.room.game.features;
 assert.equal(current.cup.active,false);assert.equal(current.career.reports.length,1);assert.equal(current.career.awards.length,1);assert.equal(current.career.awards[0].matchesTracked,10);assert.equal(current.starXI.fragments,400);
 const after=await action('cup-tick');assert.equal(after.status,200);assert.equal(after.data.room.game.features.career.reports.length,1);assert.equal(after.data.room.game.features.starXI.fragments,400);
});
test('API concurrent collection claims cannot pay twice',async()=>{
 const f=initialGameFeatures(),nation=getAlbumGroups(f.career).find(g=>g.id.startsWith('nation-')&&g.total===1)!;f.starXI.ownedIds=[STAR_XI_PLAYERS.find(p=>p.countryCode===nation.id.slice(7))!.id];setup(f);
 const results=await Promise.all([action('album-claim',{groupId:nation.id}),action('album-claim',{groupId:nation.id},'guest-player-123')]);
 assert.ok(results.some(r=>r.status===200));assert.equal(JSON.parse(row.sharedFeaturesJson).starXI.fragments,500);assert.equal(JSON.parse(row.sharedFeaturesJson).career.claimedAlbumRewards.filter((id:string)=>id===nation.id).length,1);
});
test('API bulk claim collects all complete groups once, including concurrent individual claims',async()=>{
 const f=initialGameFeatures();f.starXI.ownedIds=STAR_XI_PLAYERS.filter(p=>p.countryCode==='CH'||p.isCustom).map(p=>p.id);setup(f);
 const normalized=normalizeGameFeatures(f),groups=getAlbumGroups(normalized.career).filter(g=>!g.claimed&&g.collected===g.total);
 assert.ok(groups.length>1);const expected=groups.reduce((sum,g)=>sum+g.reward,0);
 const results=await Promise.all([action('album-claim',{groupId:'all'}),action('album-claim',{groupId:groups[0].id},'guest-player-123')]);
 assert.ok(results.some(r=>r.status===200));
 const saved=JSON.parse(row.sharedFeaturesJson);assert.equal(saved.starXI.fragments,expected);
 assert.equal(saved.career.claimedAlbumRewards.length,groups.length);
 const again=await action('album-claim',{groupId:'all'});assert.equal(again.status,409);assert.equal(JSON.parse(row.sharedFeaturesJson).starXI.fragments,expected);
});

test('API scrap purchases charge exactly once under concurrent requests, persist cards and reject outdated clients',async()=>{
 setup();row.sharedCoins=7500;
 const old=await action('star-pack',{packId:'scrap',protocol:4});assert.equal(old.status,426);assert.equal(row.sharedCoins,7500);
 const results=await Promise.all([action('star-pack',{packId:'scrap'}),action('star-pack',{packId:'scrap'},'guest-player-123')]);
 assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(row.sharedCoins,0);
 const saved=JSON.parse(row.sharedFeaturesJson);assert.equal(saved.starXI.ownedIds.length,1);assert.equal(saved.starPackReveal.packId,'scrap');assert.ok(saved.starPackReveal.player.rating<=64);
 const fail=await action('star-pack',{packId:'scrap'});assert.notEqual(fail.status,200);assert.equal(row.sharedCoins,0);assert.equal(JSON.parse(row.sharedFeaturesJson).starXI.ownedIds.length,1);
});
test('API fresh weak eleven can actually start and finish a season game after eleven saved purchases',async()=>{
 setup();row.sharedCoins=82500;
 for(let i=0;i<11;i++) {const result=await action('star-pack',{packId:'scrap'});assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(row.sharedCoins,82500-(i+1)*7500);assert.equal(result.data.room.game.features.starXI.ownedIds.length,i+1);}
 let f=normalizeGameFeatures(JSON.parse(row.sharedFeaturesJson));assert.equal(f.starXI.lineupIds.filter(Boolean).length,11);
 // Existing away-travel requirement is preserved; complete that same journey.
 f.travel.journey=createJourney(fixtureFor(f,'season'),Date.now()-180000,()=>.9);row.sharedFeaturesJson=JSON.stringify(f);
 const started=await action('cup-start',{mode:'season'});assert.equal(started.status,200,JSON.stringify(started.data));assert.equal(started.data.room.game.features.cup.active,true);
 f=started.data.room.game.features;f.cup.homeScore=1;f.cup.awayScore=0;f.cup.lastTickAt=f.cup.matchEndsAt;f.cup.matchStartedAt=Date.now()-180001;f.cup.matchEndsAt=Date.now()-1;row.sharedFeaturesJson=JSON.stringify(f);
 const finished=await action('cup-tick');assert.equal(finished.status,200);assert.equal(finished.data.room.game.features.cup.active,false);assert.equal(finished.data.room.game.features.career.reports.length,1);
 const again=await action('cup-tick');assert.equal(again.data.room.game.features.career.reports.length,1);
});
