import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { initialGameFeatures } from '../app/feature-data.ts';
import { getPressConference } from '../app/press-conference.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { installLightRoomMocks, lightRow } from './helpers/light-room-mock.ts';
const { GoalClickerDatabase }=await import('../db/index.ts');
const { POST, GET, clearRoomCacheForTests }=await import('../app/api/multiplayer/route.ts');

let row:RoomRow;
GoalClickerDatabase.prototype.getRoom=async code=>code===row.code?structuredClone(row):null;
GoalClickerDatabase.prototype.updateRoom=async(code,values:RoomUpdate,conditions={})=>{
 if(code!==row.code)return null;
 if(conditions.sharedStateVersion!==undefined&&conditions.sharedStateVersion!==row.sharedStateVersion)return null;
 if(conditions.lastPassiveAt!==undefined&&conditions.lastPassiveAt!==row.lastPassiveAt)return null;
 if(values.sharedFeaturesJson!==undefined)fullWrites.count++;
 row={...row,...values};return structuredClone(row);
};
const fullWrites={count:0};
GoalClickerDatabase.prototype.applyClick=async(code,role,amount,clickCount,_timestamp,previous=null,next=null)=>{
 void clickCount;const states=JSON.parse(row.clickStateJson||'{}') as Record<string,unknown>;
 // Same compare and swap as the SQL: the seat's click state must still be the one the amount was computed from.
 if(next&&JSON.stringify(states[role]??null)!==JSON.stringify(previous))return null;
 row={...row,sharedCoins:row.sharedCoins+amount,sharedTotalGoals:row.sharedTotalGoals+amount,clickStateJson:next?JSON.stringify({...states,[role]:next}):row.clickStateJson};return structuredClone(row) as never;};

installLightRoomMocks(GoalClickerDatabase);
function setup(features=initialGameFeatures(Date.now())){
 const iso=new Date().toISOString();
 const defaults=Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([k,c])=>[k,c.default??null]));
 row={...defaults,code:'FEATUR',hostPlayerId:'host-player-123',hostName:'Nicolas',guestPlayerId:'guest-player-123',guestName:'Silvan',hostLastSeenAt:iso,guestLastSeenAt:iso,lastPassiveAt:iso,updatedAt:iso,sharedFeaturesJson:JSON.stringify(features)} as RoomRow;
}
async function action(name:string,extra:Record<string,unknown>={},playerId='host-player-123'){const r=await POST(new Request('http://localhost/api/multiplayer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:name,code:'FEATUR',playerId,protocol:MULTIPLAYER_PROTOCOL_VERSION,...extra})}));return{status:r.status,data:await r.json() as {dailyReward?:{amount:number;dayIndex:number};press?:{reward:number};error?:string}};}

test('each coop player claims the daily reward once per day for the shared world',async t=>{
 const clock=Date.now();t.mock.method(Date,'now',()=>clock);setup();
 const before=row.sharedCoins;
 const first=await action('daily-claim');assert.equal(first.status,200);assert.equal(first.data.dailyReward?.dayIndex,1);
 assert.equal(row.sharedCoins-before,first.data.dailyReward!.amount);
 assert.equal((await action('daily-claim')).status,409);
 assert.equal((await action('daily-claim',{},'guest-player-123')).status,200);
 const features=JSON.parse(row.sharedFeaturesJson);assert.ok(features.dailyRewards.host&&features.dailyRewards.guest);
});

test('the shared press conference is answered once per match and pays a media reward',async t=>{
 const clock=Date.now();t.mock.method(Date,'now',()=>clock);
 const features=initialGameFeatures(clock);
 features.cup={...features.cup,active:false,matchStartedAt:clock-60000,careerMatchId:'coop-match-1',opponent:'FC Tabellenkeller',homeScore:3,awayScore:0};
 setup(features);
 const conference=getPressConference(features.press,features.cup,features.club.name)!;
 const before=row.sharedCoins;
 assert.equal((await action('press-answer',{matchId:'coop-match-1',questionId:conference.question.id,answerIndex:7})).status,409);
 const answered=await action('press-answer',{matchId:'coop-match-1',questionId:conference.question.id,answerIndex:conference.answers[0].index},'guest-player-123');
 assert.equal(answered.status,200);assert.ok(answered.data.press!.reward>0);assert.equal(row.sharedCoins-before,answered.data.press!.reward);
 assert.equal((await action('press-answer',{matchId:'coop-match-1',questionId:conference.question.id,answerIndex:0})).status,409);
 assert.ok(JSON.parse(row.sharedFeaturesJson).press.answered.includes('coop-match-1'));
});

test('the server counts clicks itself: a reported amount is ignored and impossible click rates are refused',async()=>{
 setup();
 const before=row.sharedCoins;
 assert.equal((await action('click',{amount:1000000,clickCount:1})).status,200);
 // One click at the starting click power: at most a critical hit (x2), never the reported million.
 assert.ok(row.sharedCoins-before<=2,`gained ${row.sharedCoins-before}`);
 // A pause saves up 2.5 seconds of clicks (50); right after that the budget is used up.
 assert.equal((await action('click',{clickCount:50})).status,200);
 assert.equal((await action('click',{clickCount:50})).status,429);
});

test('frequent click batches do not rewrite the whole world each time',async t=>{
 let clock=Date.now();t.mock.method(Date,'now',()=>clock);
 setup();row.lastPassiveAt=new Date(clock-100).toISOString();
 fullWrites.count=0;
 for(let i=0;i<10;i++){clock+=100;assert.equal((await action('click',{clickCount:1})).status,200);}
 assert.equal(fullWrites.count,0);
 // Passive income still arrives: after a few seconds a click books it once.
 clock+=6000;
 assert.equal((await action('click',{clickCount:1})).status,200);
 assert.equal(fullWrites.count,1);
});

test('coming back after ten days pays at most the one day of passive income an absence allows',async t=>{
 const clock=Date.now();t.mock.method(Date,'now',()=>clock);
 setup();clearRoomCacheForTests();
 const tenDaysAgo=new Date(clock-10*86_400_000).toISOString();
 Object.assign(row,{sharedUpgradesJson:JSON.stringify({ballboy:1}),hostLastSeenAt:tenDaysAgo,guestLastSeenAt:tenDaysAgo,lastPassiveAt:tenDaysAgo});
 const before=row.sharedTotalGoals;
 const response=await GET(new Request(`http://localhost/api/multiplayer?code=FEATUR&playerId=guest-player-123&featuresKey=${lightRow(row).featuresKey}&protocol=${MULTIPLAYER_PROTOCOL_VERSION}`));
 assert.equal(response.status,200);
 const gained=row.sharedTotalGoals-before;
 // One ball boy earns one goal per second; the grace period after the last presence is one day.
 assert.ok(gained>0&&gained<=86_400*1.01,`gained ${gained}`);
});
