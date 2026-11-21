import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import { initialGameFeatures, normalizeGameFeatures, STAR_XI_PLAYERS } from '../app/feature-data.ts';
import { DAILY_REWARD_DAYS, WORLD_DAILY_KEY, claimDailyReward, describeDailyReward, getDailyRewardAmount, getDailyRewardStatus, getPreviousRewardDay, getRewardDay } from '../app/daily-reward.ts';
import type { DailyRewardState } from '../app/daily-reward.ts';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { DailyRewardCard } from '../app/daily-reward-panel.tsx';
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
function ready(){const f=initialGameFeatures();f.earnedPacks=[{id:'world:123456',packId:'reward-6',earnedAt:1}];f.completedTournamentRuns=['world:123456'];return f;}
async function request(f:GameFeatures,id='world:123456',playerId='reward-owner-123'){const r=await solo.POST(new Request('http://localhost/api/rewards',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({playerId,rewardId:id,features:f})}));return{status:r.status,data:await r.json()};}
function setup(f:GameFeatures){const iso=new Date().toISOString(),defaults=Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([k,c])=>[k,c.default??null]));row={...defaults,code:'REWARD',hostPlayerId:'host-12345678',hostName:'Nicolas',guestPlayerId:'guest-12345678',guestName:'Silvan',hostLastSeenAt:iso,guestLastSeenAt:iso,lastPassiveAt:iso,updatedAt:iso,sharedFeaturesJson:JSON.stringify(f),sharedSeasons:14} as RoomRow;}
async function action(action:string,extra={},playerId='host-12345678'){const r=await shared.POST(new Request('http://localhost/api/multiplayer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,code:'REWARD',playerId,protocol:MULTIPLAYER_PROTOCOL_VERSION,...extra})}));return{status:r.status,data:await r.json() as {room?:{game:{features:GameFeatures}}}};}
test('solo reward concurrency, lost responses and retries return one immutable server draw',async()=>{ledger.clear();const f=ready(),responses=await Promise.all([request(f),request(f)]);assert.ok(responses.every(r=>r.status===200));assert.equal(ledger.size,1);assert.deepEqual(responses[0].data,responses[1].data);assert.deepEqual((await request(normalizeGameFeatures(f))).data,responses[0].data);assert.equal(ledger.size,1);});
test('solo reward validates owner, missing entitlement and active game, keeps failed attempts retryable',async()=>{ledger.clear();const f=ready();assert.equal((await request(f,'missing')).status,409);assert.equal((await request(f,'world:123456','x')).status,400);f.cup.active=true;f.cup.matchEndsAt=Date.now()+180000;assert.equal((await request(f)).status,409);assert.equal(ledger.size,0);});
test('shared pack consumption gives one card/compensation under simultaneous different members',async()=>{const f=ready();f.starXI.ownedIds=STAR_XI_PLAYERS.map(p=>p.id);setup(f);const results=await Promise.all([action('reward-pack',{rewardId:'world:123456'}),action('reward-pack',{rewardId:'world:123456'},'guest-12345678')]);assert.equal(results.filter(r=>r.status===200).length,1);const saved=JSON.parse(row.sharedFeaturesJson);assert.ok(saved.earnedPacks[0].opening);assert.equal(saved.starXI.fragments,saved.earnedPacks[0].opening.fragmentCompensation);assert.equal((await action('reward-pack',{rewardId:'world:123456'})).status,409);});
test('reward tiers cannot be purchased for zero currency through regular shop action',async()=>{setup(ready());assert.equal((await action('star-pack',{packId:'reward-6'})).status,400);assert.equal(JSON.parse(row.sharedFeaturesJson).earnedPacks[0].opening,undefined);});
test('server tournament victory grants pack once, keeps trophy, gazette, cooldown and no new multiplier',async()=>{const f=ready();f.earnedPacks=[];f.completedTournamentRuns=[];f.starXI.ownedIds=STAR_XI_PLAYERS.map(p=>p.id);f.cup={...f.cup,active:true,mode:'tournament',tournamentId:'stadium',round:2,homeScore:3,awayScore:0,matchStartedAt:Date.now()-180000,matchEndsAt:Date.now()-1,lastTickAt:Date.now(),opponentIds:['stadium-servette-genevois','stadium-fc-sionais','stadium-fc-thoune']};setup(f);assert.equal((await action('cup-tick')).status,200);const saved=JSON.parse(row.sharedFeaturesJson);assert.equal(saved.cup.active,false);assert.equal(saved.cup.trophies.stadium,1);assert.equal(saved.earnedPacks.length,1);assert.equal(saved.earnedPacks[0].packId,'reward-1');assert.equal(saved.goalBoost.multiplier,1);assert.ok(saved.cup.nextTournamentAt>Date.now());await action('cup-tick');assert.equal(JSON.parse(row.sharedFeaturesJson).earnedPacks.length,1);});
test('a solo receipt is the server\'s own draw, never a card the request names',async()=>{
 ledger.clear();const f=ready();
 // The weakest card of the game can never come out of the top reward pack, so only a copied request could give it.
 const named=STAR_XI_PLAYERS.reduce((low,p)=>p.rating<low.rating?p:low);
 f.earnedPacks[0].opening={packId:'reward-6',packName:'x',player:named,duplicate:false,fragmentCompensation:0};
 const r=await request(f);assert.equal(r.status,200);
 assert.notEqual((r.data as {opening:{player:{id:string}}}).opening.player.id,named.id);
});
test('a long career keeps every unopened pack but only the latest opened ones and finished runs',()=>{
 const f=initialGameFeatures();const player=STAR_XI_PLAYERS[0];
 f.earnedPacks=Array.from({length:400},(_,i)=>({id:`run:${i}`,packId:'reward-2' as const,earnedAt:i,...(i<390?{opening:{packId:'reward-2' as const,packName:'x',player,duplicate:true,fragmentCompensation:1}}:{})}));
 f.completedTournamentRuns=Array.from({length:1000},(_,i)=>`run:${i}`);
 const normalized=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
 assert.equal(normalized.earnedPacks.filter(p=>!p.opening).length,10);
 assert.equal(normalized.earnedPacks.filter(p=>p.opening).length,100);
 assert.equal(normalized.earnedPacks.at(-11)!.id,'run:389');
 assert.equal(normalized.completedTournamentRuns.length,200);
 assert.equal(normalized.completedTournamentRuns.at(-1),'run:999');
});
test('four coop players claiming day seven at once get one special card pack for the world and no goals',async()=>{
 const today=getRewardDay(),f=ready();f.earnedPacks=[];f.dailyRewards={[WORLD_DAILY_KEY]:{day:getPreviousRewardDay(today),streak:6}};setup(f);
 const iso=new Date().toISOString();
 row={...row,player3PlayerId:'player3-12345678',player3Name:'Flurin',player3LastSeenAt:iso,player4PlayerId:'player4-12345678',player4Name:'Gian',player4LastSeenAt:iso};
 const players=['host-12345678','guest-12345678','player3-12345678','player4-12345678'],start=row.sharedCoins;
 const results=await Promise.all(players.map(p=>action('daily-claim',{},p)));
 const winners=results.filter(r=>r.status===200);
 assert.equal(winners.length,1,'exactly one claim succeeds');
 assert.ok(results.filter(r=>r.status!==200).every(r=>r.status===409));
 // A retry of the losers changes nothing any more.
 const retries=await Promise.all(players.map(p=>action('daily-claim',{},p)));
 assert.ok(retries.every(r=>r.status===409));
 // The stored row: one reward on the balance, one special card pack, today claimed for every seat.
 const amount=(winners[0].data as {dailyReward?:{amount:number;dayIndex:number;pack:boolean}}).dailyReward!;
 assert.equal(amount.dayIndex,7);assert.equal(amount.pack,true);
 // Day 7 is the pack only: no goals in the answer and the shared balance is exactly what it was.
 assert.equal(amount.amount,0);
 assert.equal(row.sharedCoins,start);
 const stored=JSON.parse(row.sharedFeaturesJson) as GameFeatures;
 const daily=stored.earnedPacks.filter(p=>p.id.startsWith('daily-'));
 assert.deepEqual(daily.map(p=>[p.id,p.packId]),[[`daily-world-${today}`,'special']]);
 assert.deepEqual(Object.keys(stored.dailyRewards),[WORLD_DAILY_KEY]);
 assert.equal(getDailyRewardStatus(stored.dailyRewards,WORLD_DAILY_KEY).claimedToday,true);
 for(const p of players){const seen=await action('tick',{},p);const features=seen.data.room?.game.features;assert.ok(features,`${p} sees the shared world`);assert.equal(getDailyRewardStatus(features.dailyRewards,WORLD_DAILY_KEY).claimedToday,true);}
});

const formatGoals=(value:number)=>String(Math.round(value));
test('day seven gives the special pack and zero goals whatever the income, every seventh day of the cycle; days one to six are unchanged',()=>{
 const seven=DAILY_REWARD_DAYS[6];
 assert.equal(seven.pack,'special');assert.equal(seven.packOnly,true);
 for(const income of [0,1,1e3,1e9,1e15,Number.MAX_SAFE_INTEGER,Infinity,NaN])assert.equal(getDailyRewardAmount(seven,income,income),0,`income ${income}`);
 // Days one to six: the goals are exactly the old formula (floor or the larger of passive and click income for the minutes).
 const old=(minutes:number,floor:number,passive:number,click:number)=>Math.max(floor,Math.floor(Math.max(passive*minutes*60,click*minutes*40)));
 for(const day of DAILY_REWARD_DAYS.slice(0,6))for(const [passive,click] of [[0,0],[1,1],[500,20],[1e6,1e4],[3e9,5e7]]){
  assert.equal(getDailyRewardAmount(day,passive,click),old(day.minutes,day.floor,passive,click),`day ${day.day} ${passive}/${click}`);
  assert.ok(!day.pack&&!day.packOnly);
 }
 assert.deepEqual(DAILY_REWARD_DAYS.slice(0,6).map(d=>[d.minutes,d.floor]),[[5,500],[10,1200],[15,2500],[20,4000],[30,6500],[45,10000]]);
 // Walk 15 days in a row (two full cycles and the day after): day 7 and 14 are the pack only, the day after is day 1 again with goals.
 let state:DailyRewardState|undefined=undefined;
 const start=Date.UTC(2026,5,10,10,0,0),dayMs=86_400_000,seen:string[]=[];
 for(let i=0;i<15;i++){
  const claim: NonNullable<ReturnType<typeof claimDailyReward>>=claimDailyReward(state,'solo',1e12,1e12,start+i*dayMs)!;
  assert.ok(claim,`day ${i+1} claims`);state=claim.state;
  seen.push(`${claim.dayIndex}:${claim.amount>0?'goals':'none'}:${claim.pack?.packId??'-'}`);
  assert.equal(claimDailyReward(state,'solo',1e12,1e12,start+i*dayMs+3_600_000),null,'once per day');
 }
 assert.deepEqual(seen,[...Array(2)].flatMap(()=>['1:goals:-','2:goals:-','3:goals:-','4:goals:-','5:goals:-','6:goals:-','7:none:special']).concat(['1:goals:-']));
 // A broken streak starts again at day one, also after day seven.
 const broken=claimDailyReward({solo:{day:'2026-06-01',streak:7}},'solo',1e12,1e12,Date.UTC(2026,5,10,10))!;
 assert.equal(broken.dayIndex,1);assert.ok(broken.amount>0);assert.equal(broken.pack,undefined);
});
test('the day seven claim names only the pack: tile, button, toast and history never show goals or a zero',()=>{
 const render=(streakToday:number,claimed=false)=>{const now=Date.UTC(2026,5,10,10),today=getRewardDay(now);
  const state=claimed?{solo:{day:today,streak:streakToday}}:{solo:{day:getPreviousRewardDay(today),streak:streakToday-1}};
  return renderToStaticMarkup(createElement(DailyRewardCard,{state,claimKey:'solo',now,passivePerSecond:1e9,clickPower:1e7,busy:false,coop:false,onClaim:()=>{},format:formatGoals}));};
 const day7=render(7);
 assert.match(day7,/Tag 7 wartet/);
 assert.match(day7,/<span>Spezialpack<\/span>/,'the tile of day seven shows only the pack');
 assert.match(day7,/Prämie abholen · Spezialkarten-Pack<\/button>/);
 const tile=day7.slice(day7.indexOf('Tag 7</small>'),day7.indexOf('</li>',day7.indexOf('Tag 7</small>')));
 assert.doesNotMatch(tile,/Tore|\+|\d{3}/);assert.doesNotMatch(day7.slice(day7.indexOf('<button')),/Tore/);
 // Day six still shows its goals; the pack tile is not mixed into the claim button.
 const day6=render(6);
 assert.match(day6,/Prämie abholen · \+\d+ Tore<\/button>/);assert.doesNotMatch(day6,/Spezialkarten-Pack/);
 assert.match(day6,/<span>\d+<\/span>/);
 assert.equal(describeDailyReward(0,true,formatGoals,' für die ganze Welt'),'Ein Spezialkarten-Pack für die ganze Welt');
 assert.equal(describeDailyReward(0,true,formatGoals,' unter Packs & Album'),'Ein Spezialkarten-Pack unter Packs & Album');
 assert.equal(describeDailyReward(500,false,formatGoals),'+500 Tore');
});
async function worldClaim(streakBefore:number){
 const today=getRewardDay(),f=ready();f.earnedPacks=[];f.dailyRewards={[WORLD_DAILY_KEY]:{day:getPreviousRewardDay(today),streak:streakBefore}};setup(f);
 const start=row.sharedCoins,r=await action('daily-claim');
 return {r,start,stored:JSON.parse(row.sharedFeaturesJson) as GameFeatures,today};
}
test('coop: day six and the first day of the next cycle still book their goals, day fourteen is the pack only; a reload and a retry change nothing',async()=>{
 const six=await worldClaim(5);assert.equal(six.r.status,200);
 const sixData=(six.r.data as {dailyReward:{amount:number;dayIndex:number;pack:boolean}}).dailyReward;
 assert.equal(sixData.dayIndex,6);assert.ok(sixData.amount>=10000);assert.equal(sixData.pack,false);assert.equal(row.sharedCoins-six.start,sixData.amount);
 const one=await worldClaim(7);const oneData=(one.r.data as {dailyReward:{amount:number;dayIndex:number;pack:boolean}}).dailyReward;
 assert.equal(oneData.dayIndex,1);assert.ok(oneData.amount>=500);assert.equal(oneData.pack,false);assert.equal(row.sharedCoins-one.start,oneData.amount);
 assert.equal(one.stored.earnedPacks.filter(p=>p.id.startsWith('daily-')).length,0);
 const fourteen=await worldClaim(13);const data=(fourteen.r.data as {dailyReward:{amount:number;dayIndex:number;pack:boolean}}).dailyReward;
 assert.equal(data.dayIndex,7);assert.equal(data.amount,0);assert.equal(data.pack,true);assert.equal(row.sharedCoins,fourteen.start);
 assert.equal(fourteen.stored.earnedPacks.filter(p=>p.id.startsWith('daily-')).length,1);
 const history=JSON.stringify(fourteen.stored.history??[]);assert.match(history,/Spezialkarten-Pack/);assert.doesNotMatch(history,/Tore/);
 // Reload (a fresh tick) and a retry: still one pack, still the same balance.
 const tick=await action('tick');assert.equal(tick.status,200);
 const retry=await action('daily-claim');assert.equal(retry.status,409);
 assert.equal(row.sharedCoins,fourteen.start);
 assert.equal((JSON.parse(row.sharedFeaturesJson) as GameFeatures).earnedPacks.filter(p=>p.id.startsWith('daily-')).length,1);
});
