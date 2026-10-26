import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomSeatRole, RoomUpdate } from '../db/index.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
const { GoalClickerDatabase }=await import('../db/index.ts');
const { POST }=await import('../app/api/multiplayer/route.ts');

const SEAT_COLUMNS: Record<RoomSeatRole, 'hostPlayerId'|'guestPlayerId'|'player3PlayerId'|'player4PlayerId'>={host:'hostPlayerId',guest:'guestPlayerId',player3:'player3PlayerId',player4:'player4PlayerId'};
let row:RoomRow;
GoalClickerDatabase.prototype.getRoom=async code=>code===row.code?structuredClone(row):null;
GoalClickerDatabase.prototype.updateRoom=async(code,values:RoomUpdate,conditions={})=>{
 if(code!==row.code)return null;
 if(conditions.sharedStateVersion!==undefined&&conditions.sharedStateVersion!==row.sharedStateVersion)return null;
 if(conditions.lastPassiveAt!==undefined&&conditions.lastPassiveAt!==row.lastPassiveAt)return null;
 if(conditions.seat&&(row[SEAT_COLUMNS[conditions.seat.role]]??null)!==conditions.seat.playerId)return null;
 row={...row,...values};return structuredClone(row);
};

function setup(overrides:Partial<RoomRow>={}){
 const iso=new Date().toISOString();
 const defaults=Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([k,c])=>[k,c.default??null]));
 row={...defaults,code:'SECURE',hostPlayerId:'host-player-123',hostName:'Nicolas',guestPlayerId:'guest-player-123',guestName:'Silvan',hostLastSeenAt:iso,guestLastSeenAt:iso,lastPassiveAt:iso,updatedAt:iso,...overrides} as RoomRow;
}
async function send(body:string){const r=await POST(new Request('http://localhost/api/multiplayer',{method:'POST',headers:{'content-type':'application/json'},body}));return{status:r.status,data:await r.json() as {role?:string;error?:string}};}
function action(action:string,extra:Record<string,unknown>={},playerId='host-player-123'){return send(JSON.stringify({action,code:'SECURE',playerId,protocol:MULTIPLAYER_PROTOCOL_VERSION,...extra}));}

test('joining with the name of an online host is rejected and keeps the seat',async()=>{
 setup();
 const r=await action('join',{nickname:'Nicolas',preferredRole:'host'},'intruder-player-1');
 assert.equal(r.status,409);
 assert.equal(row.hostPlayerId,'host-player-123');
});

test('joining with the name of an offline host reclaims the host seat',async()=>{
 setup({hostLastSeenAt:'1970-01-01T00:00:00.000Z'});
 const r=await action('join',{nickname:'Nicolas'},'new-device-player-1');
 assert.equal(r.status,200);
 assert.equal(r.data.role,'host');
 assert.equal(row.hostPlayerId,'new-device-player-1');
});

test('only the host may reset the shared game',async()=>{
 setup();
 const r=await action('reset',{},'guest-player-123');
 assert.equal(r.status,403);
});

test('minigame rewards are capped per minigame',async t=>{
 const clock=Date.now();t.mock.method(Date,'now',()=>clock);
 setup({lastPassiveAt:new Date(clock).toISOString()});
 const before=row.sharedCoins;
 const r=await action('minigame',{minigameId:'penalty',reward:1000000});
 assert.equal(r.status,200);
 assert.ok(row.sharedCoins-before<=1000,`gained ${row.sharedCoins-before}`);
});

test('oversized request bodies are rejected with 413',async()=>{
 setup();
 const r=await action('join',{nickname:'Nicolas',padding:'x'.repeat(70*1024)},'big-player-123');
 assert.equal(r.status,413);
});

test('two concurrent joins fill both free seats without overwriting each other',async()=>{
 setup();
 const [first,second]=await Promise.all([action('join',{nickname:'Lara'},'third-player-123'),action('join',{nickname:'Mia'},'fourth-player-123')]);
 assert.equal(first.status,200);assert.equal(second.status,200);
 assert.deepEqual([first.data.role,second.data.role].sort(),['player3','player4']);
 assert.deepEqual([row.player3PlayerId,row.player4PlayerId].sort(),['fourth-player-123','third-player-123']);
});

test('with accounts a seat is never handed over by name; without accounts an offline seat can be reclaimed', async () => {
 const { nameRecoveryAllowed } = await import('../app/auth/player.ts');
 assert.equal(nameRecoveryAllowed('some-account-id'), false, 'a signed-in player needs the account that owns the seat');
 assert.equal(nameRecoveryAllowed(null), true, 'without accounts a new device has no other way back in');
});
