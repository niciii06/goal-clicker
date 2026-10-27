import { createJourney, fixtureFor } from '../app/travel-data.ts';
import { SEASON_CLUBS } from '../app/travel-geography.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import { initialGameFeatures, normalizeGameFeatures, resolveTransferInsiderEvent, setBestStarXI, STAR_XI_PLAYERS, TRANSFER_OFFER_DURATION_MS } from '../app/feature-data.ts';
import { beginSeasonCupMatch, getStarXISelection, getStarXIPlayer } from '../app/feature-data';
import { draftMatch } from '../app/match-commands';
import { prepareCareerMatch } from '../app/career-data';
import { getReachedLeague } from '../app/season-progression.ts';
import { emptyPlayerStats, getAlbumGroups } from '../app/career-data.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import type { GameFeatures } from '../app/feature-data.ts';
type TestResponse = { room: { game: { features: GameFeatures } }; error?: string };
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { installLightRoomMocks } from './helpers/light-room-mock.ts';

const { GoalClickerDatabase }=await import('../db/index.ts');
const { POST,GET }=await import('../app/api/multiplayer/route.ts');
let row: RoomRow;
GoalClickerDatabase.prototype.getRoom=async code=>code===row.code?structuredClone(row):null;
GoalClickerDatabase.prototype.updateRoom=async(code,values:RoomUpdate,conditions={})=>{
  if(code!==row.code||conditions.sharedStateVersion!==undefined&&conditions.sharedStateVersion!==row.sharedStateVersion||conditions.lastPassiveAt!==undefined&&conditions.lastPassiveAt!==row.lastPassiveAt)return null;
  row={...row,...values};return structuredClone(row);
};
installLightRoomMocks(GoalClickerDatabase);
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
 const player=f.starXI.lineupIds[1];f.career.players[player]={...emptyPlayerStats(),recent:[8,8,8,8,8],appearances:25};f.career.milestoneCards[player]=['loyal'];f.seasonMode.matchday=9;f.career.seasonMatches=9;if(fixtureFor(f,'season').away)f.travel.journey=createJourney(fixtureFor(f,'season'),Date.now()-180000,()=>.9);setup(f);
 const started=await action('cup-start',{mode:'season'});assert.equal(started.status,200,JSON.stringify(started.data));
 let current=started.data.room.game.features;assert.ok(current.cup.careerMatchId);assert.ok((current.cup.careerBonuses?.[player] ?? 0)>0);
 delete current.cup.simulation; // Legacy save: isolate existing reward/progression checks.
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
 const saved=JSON.parse(row.sharedFeaturesJson);assert.equal(saved.starXI.ownedIds.length,1);assert.equal(saved.starPackReveal.packId,'scrap');assert.ok(saved.starPackReveal.player.rating<=69);assert.equal(saved.starPackReveal.player.countryCode,'IN');
 const fail=await action('star-pack',{packId:'scrap'});assert.notEqual(fail.status,200);assert.equal(row.sharedCoins,0);assert.equal(JSON.parse(row.sharedFeaturesJson).starXI.ownedIds.length,1);
});
test('API random scrap purchases allow duplicates and persist a playable team for a season game',async()=>{
 setup();row.sharedCoins=7500*500;
 let purchases=0;
 while(purchases<500){
  const result=await action('star-pack',{packId:'scrap'});assert.equal(result.status,200,JSON.stringify(result.data));purchases++;
  assert.equal(row.sharedCoins,7500*(500-purchases));
  const saved=result.data.room.game.features;
  assert.ok(saved.starXI.ownedIds.length<=purchases);
  if(saved.starXI.lineupIds.filter(Boolean).length===11)break;
 }
 let f=normalizeGameFeatures(JSON.parse(row.sharedFeaturesJson));assert.equal(f.starXI.lineupIds.filter(Boolean).length,11);
 // Existing away-travel requirement is preserved; complete that same journey.
 if(fixtureFor(f,'season').away)f.travel.journey=createJourney(fixtureFor(f,'season'),Date.now()-180000,()=>.9);row.sharedFeaturesJson=JSON.stringify(f);
 const started=await action('cup-start',{mode:'season'});assert.equal(started.status,200,JSON.stringify(started.data));assert.equal(started.data.room.game.features.cup.active,true);
 f=started.data.room.game.features;delete f.cup.simulation; // Legacy in-progress save compatibility.
 f.cup.homeScore=1;f.cup.awayScore=0;f.cup.lastTickAt=f.cup.matchEndsAt;f.cup.matchStartedAt=Date.now()-180001;f.cup.matchEndsAt=Date.now()-1;row.sharedFeaturesJson=JSON.stringify(f);
 const finished=await action('cup-tick');assert.equal(finished.status,200);assert.equal(finished.data.room.game.features.cup.active,false);assert.equal(finished.data.room.game.features.career.reports.length,1);
 const again=await action('cup-tick');assert.equal(again.data.room.game.features.career.reports.length,1);
});

test('API interactive edits validate atomically and normal completion is persisted once',async()=>{
 const f=initialGameFeatures();f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.map(p=>p.id)});const start=Date.now()-14000;
 f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,start,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions,f.starXI.lineupIds,f.starXI.benchIds);prepareCareerMatch(f);setup(f);
 assert.equal((await action('cup-edit')).status,200);let current=JSON.parse(row.sharedFeaturesJson) as GameFeatures;current.cup.matchStartedAt-=4000;current.cup.matchEndsAt-=4000;row.sharedFeaturesJson=JSON.stringify(current);
 assert.equal((await action('cup-tick')).status,200);current=JSON.parse(row.sharedFeaturesJson);assert.ok(current.cup.matchPaused);
 const d=draftMatch(current),bad={...d,lineup:[...d.lineup]};bad.lineup[1]=bad.lineup[0];assert.equal((await action('cup-batch',{draft:bad})).status,409);assert.equal(JSON.parse(row.sharedFeaturesJson).cup.substitutionsUsed,0);
 let count=0;for(let slot=0;slot<11&&count<2;slot++){const id=current.starXI.benchIds.find(id=>id&&!d.lineup.includes(id)&&getStarXIPlayer(id)?.positions.includes(current.starXI.formationPositions[slot]));if(id){d.lineup[slot]=id;count++;}}
 (d as typeof d&{strategy?:string}).strategy='angriff';assert.equal(count,2);const confirmed=await action('cup-batch',{draft:d});assert.equal(confirmed.status,200,JSON.stringify(confirmed.data));assert.equal(confirmed.data.room.game.features.cup.substitutionsUsed,2);assert.equal(confirmed.data.room.game.features.cup.strategyId,current.cup.strategyId,'a legacy strategy field is ignored');
 assert.equal((await action('star-lineup',{lineupIndex:0,starPlayerId:d.lineup[0]})).status,409);
 const removed=await action('cup-quick');assert.notEqual(removed.status,200);assert.ok(JSON.parse(row.sharedFeaturesJson).cup.active);
 let finished=await action('cup-tick');
 for(let i=0;i<20&&finished.data.room.game.features.cup.active;i++){
  if(finished.data.room.game.features.cup.matchPaused)assert.equal((await action('cup-resume')).status,200);
  const saved=JSON.parse(row.sharedFeaturesJson) as GameFeatures;saved.cup.matchStartedAt-=400000;saved.cup.matchEndsAt-=400000;saved.cup.lastTickAt-=400000;row.sharedFeaturesJson=JSON.stringify(saved);
  finished=await action('cup-tick');assert.equal(finished.status,200,JSON.stringify(finished.data));
 }
 assert.equal(finished.data.room.game.features.cup.active,false);assert.equal(finished.data.room.game.features.career.reports.length,1);
 const again=await action('cup-tick');assert.equal(again.status,200);assert.equal(again.data.room.game.features.career.reports.length,1);assert.equal(again.data.room.game.features.cup.homeScore,finished.data.room.game.features.cup.homeScore);
});
test('API season home match pays the ticket income once and records it on the report',async()=>{
 let f=initialGameFeatures();f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.filter(p=>p.rating<90).slice(0,40).map(p=>p.id)});f=normalizeGameFeatures(f);
 assert.equal(fixtureFor(f,'season').away,false);
 setup(f);
 const started=await action('cup-start',{mode:'season'});assert.equal(started.status,200,JSON.stringify(started.data));
 f=started.data.room.game.features;delete f.cup.simulation;
 f.cup.homeScore=2;f.cup.awayScore=1;f.cup.lastTickAt=f.cup.matchEndsAt;f.cup.matchStartedAt=Date.now()-180001;f.cup.matchEndsAt=Date.now()-1;row.sharedFeaturesJson=JSON.stringify(f);
 const before=row.sharedCoins;
 const finished=await action('cup-tick');assert.equal(finished.status,200,JSON.stringify(finished.data));
 const tickets=finished.data.room.game.features.career.reports.at(-1)?.tickets;
 assert.ok(tickets&&tickets.attendance>0&&tickets.income>0,JSON.stringify(tickets));
 // Passive income may add a little between the requests, the takings arrive in full.
 assert.ok(row.sharedCoins-before>=tickets.income,`${row.sharedCoins-before} < ${tickets.income}`);
 assert.ok(finished.data.room.game.features.history.some(e=>e.title==='Ticketeinnahmen'));
 const coins=row.sharedCoins;
 const again=await action('cup-tick');assert.equal(again.status,200);
 assert.ok(row.sharedCoins-coins<tickets.income);
 assert.equal(again.data.room.game.features.history.filter(e=>e.title==='Ticketeinnahmen').length,1);
});
function offerFeatures(now=Date.now()) {
 let f=initialGameFeatures(now);f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.slice(0,60).map(p=>p.id)});f=normalizeGameFeatures(f);
 const values=[0.31,0,0,0,0];let index=0;
 return resolveTransferInsiderEvent(f,()=>values[index++]??0.5,now).features;
}
test('API sale offers are answered once by whoever is first in the world',async()=>{
 const f=offerFeatures();const offer=f.transferSaga.pendingOffer!;assert.ok(offer.fee>0);
 setup(f);const before=row.sharedCoins;
 const sold=await action('transfer-accept');assert.equal(sold.status,200,JSON.stringify(sold.data));
 const saved=sold.data.room.game.features;
 assert.equal(saved.transferSaga.pendingOffer,null);
 assert.equal(saved.starXI.ownedIds.includes(offer.playerId!),false);
 assert.ok(row.sharedCoins-before>=offer.fee);
 const late=await action('transfer-decline',{},'guest-player-123');assert.equal(late.status,409);
 assert.equal(JSON.parse(row.sharedFeaturesJson).transferSaga.unhappy.length,0);
});
test('API keeping the player makes him unhappy, and an unanswered offer runs out',async()=>{
 setup(offerFeatures());
 const kept=await action('transfer-decline',{},'guest-player-123');assert.equal(kept.status,200,JSON.stringify(kept.data));
 assert.equal(kept.data.room.game.features.transferSaga.unhappy.length,1);
 assert.equal(kept.data.room.game.features.transferSaga.latestEvent?.outcome,'declined');
 const f=offerFeatures(Date.now()-TRANSFER_OFFER_DURATION_MS-1000);setup(f);
 const expired=await action('transfer-insider-event');assert.equal(expired.status,200);
 assert.equal(expired.data.room.game.features.transferSaga.pendingOffer,null);
 assert.equal(expired.data.room.game.features.transferSaga.latestEvent?.headline,'Angebot verfallen');
 setup(offerFeatures());const open=await action('transfer-insider-event');
 assert.ok(open.data.room.game.features.transferSaga.pendingOffer,'an open offer stays open');
});
test('API saves keep the leaderboard columns of the world up to date',async()=>{
 let f=initialGameFeatures();f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.slice(0,40).map(p=>p.id)});f=normalizeGameFeatures(f);
 f.cup.trophies={stadium:2,champions:1,world:1};f.seasonMode.highestDivision=6;f.transferSaga.nextAt=1;
 setup(f);row.sharedSeasons=5;
 const saved=await action('transfer-insider-event');assert.equal(saved.status,200,JSON.stringify(saved.data));
 assert.equal(row.sharedTrophies,4);
 assert.equal(row.sharedBestLeague,getReachedLeague(5,6));
 assert.ok(row.sharedBestLeague<15);
});
test('API charges travel fines once after the team has arrived',async()=>{
 let f=initialGameFeatures();f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.slice(0,40).map(p=>p.id)});f=normalizeGameFeatures(f);
 const fixture={...fixtureFor(f,'season'),away:true,venue:SEASON_CLUBS.find(c=>c.name==='BSC Young Boys')!.venue};
 const journey=createJourney(fixture,Date.now()-600000,()=>.99,f);
 // Without the squad lock of the journey, so a Fabrizio rumour saves the world here.
 f.travel.journey={...journey,squadLock:undefined,events:[{id:'speeding',text:'Raser',at:0,delta:0,fine:60}],endsAt:journey.startedAt+journey.baseMs};
 f.transferSaga.nextAt=1;setup(f);row.sharedCoins=1e6;
 const first=await action('transfer-insider-event');assert.equal(first.status,200,JSON.stringify(first.data));
 assert.equal(first.data.room.game.features.travel.journey?.finesPaid,true);
 assert.equal(row.sharedCoins,1e6-300);
 assert.ok(first.data.room.game.features.history.some(e=>e.title==='Reisebusse bezahlt'));
 const coins=row.sharedCoins;row.sharedFeaturesJson=JSON.stringify({...JSON.parse(row.sharedFeaturesJson),transferSaga:{...JSON.parse(row.sharedFeaturesJson).transferSaga,nextAt:1}});
 await action('transfer-insider-event');assert.equal(row.sharedCoins,coins,'paid only once');
});
