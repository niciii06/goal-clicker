import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { initialGameFeatures } from '../app/feature-data.ts';
import { getPressConference } from '../app/press-conference.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { installLightRoomMocks } from './helpers/light-room-mock.ts';
const { GoalClickerDatabase }=await import('../db/index.ts');
const { POST }=await import('../app/api/multiplayer/route.ts');

let row:RoomRow;
GoalClickerDatabase.prototype.getRoom=async code=>code===row.code?structuredClone(row):null;
GoalClickerDatabase.prototype.updateRoom=async(code,values:RoomUpdate,conditions={})=>{
 if(code!==row.code)return null;
 if(conditions.sharedStateVersion!==undefined&&conditions.sharedStateVersion!==row.sharedStateVersion)return null;
 if(conditions.lastPassiveAt!==undefined&&conditions.lastPassiveAt!==row.lastPassiveAt)return null;
 row={...row,...values};return structuredClone(row);
};
GoalClickerDatabase.prototype.applyClick=async(code,role,amount,clickCount)=>{row={...row,sharedCoins:row.sharedCoins+amount,sharedTotalGoals:row.sharedTotalGoals+amount};void role;void clickCount;return structuredClone(row) as never;};

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

test('a top combo click batch is accepted by the server but larger amounts stay capped',async()=>{
 setup();
 const before=row.sharedCoins;
 assert.equal((await action('click',{amount:4,clickCount:1})).status,200);
 assert.equal(row.sharedCoins-before,4);
 const capped=row.sharedCoins;
 assert.equal((await action('click',{amount:1000,clickCount:1})).status,200);
 // x2 combo, x1.1 streak and x2 critical hit.
 assert.ok(row.sharedCoins-capped<=4.4,`gained ${row.sharedCoins-capped}`);
});
