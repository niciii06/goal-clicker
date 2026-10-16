import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGameFeatures, setBestStarXI, STAR_XI_PLAYERS, getStarXISelection, beginCupMatch, canStarXIPlayerFillSlot, queueMatchChanges, applyPendingMatchChanges, normalizeGameFeatures } from '../app/feature-data.ts';
function ready(){const f=initialGameFeatures(1000);f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.map(p=>p.id)});f.cup=beginCupMatch(f.cup,1000,'stadium',getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds));return f;}
function changes(f:ReturnType<typeof ready>,count:number){const used=new Set<string>();return f.starXI.lineupIds.flatMap((id,slot)=>{const incoming=f.starXI.benchIds.find(p=>p&&!used.has(p)&&!f.cup.playerExitedAt[p]&&canStarXIPlayerFillSlot(p,slot,f.starXI.formationPositions));if(!incoming)return [];used.add(incoming);return [{playerId:incoming,slot}];}).slice(0,count);}
test('staged batch waits for a stoppage, applies atomically, consumes one window and cannot repeat',()=>{
 const f=ready(),batch=changes(f,2),before=[...f.starXI.lineupIds];assert.equal(batch.length,2);
 assert.equal(queueMatchChanges(f,batch,2000),'');assert.deepEqual(f.starXI.lineupIds,before);assert.equal(f.cup.substitutionsUsed,0);
 const n=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));assert.equal(n.cup.pendingSubstitutions?.changes.length,2);
 n.cup.broadcast={...n.cup.broadcast!}; // An injury is an authoritative valid stoppage.
 delete n.cup.broadcast;n.cup.matchPaused=true;
 applyPendingMatchChanges(n,3000);assert.equal(n.cup.substitutionsUsed,2);assert.equal(n.cup.subWindowsUsed,1);assert.equal(n.cup.pendingSubstitutions,undefined);
 batch.forEach(x=>assert.equal(n.starXI.lineupIds[x.slot],x.playerId));applyPendingMatchChanges(n,4000);assert.equal(n.cup.substitutionsUsed,2);
});
test('limits, duplicate staging, sent-off players and Pfuschi are rejected server-side',()=>{
 const f=ready(),batch=changes(f,2);assert.ok(queueMatchChanges(f,[batch[0],batch[0]],2000));
 f.cup.subWindowsUsed=3;assert.ok(queueMatchChanges(f,batch,2000));f.cup.subWindowsUsed=0;
 f.cup.substitutionsUsed=4;assert.ok(queueMatchChanges(f,batch,2000));f.cup.substitutionsUsed=0;
 f.cup.sentOffPlayerIds=[f.starXI.lineupIds[batch[0].slot]];assert.ok(queueMatchChanges(f,[batch[0]],2000));f.cup.sentOffPlayerIds=[];
 f.starXI.benchIds[0]='star-pfuschi';assert.ok(queueMatchChanges(f,[{playerId:'star-pfuschi',slot:2}],2000));
});
test('halftime changes apply before restart without consuming an in-play window',()=>{
 const f=ready(),batch=changes(f,2);f.cup.subWindowsUsed=3;f.cup.timedPause={kind:'halftime',id:'half',startsAt:2000,endsAt:12000,frozenAt:2000};
 assert.equal(queueMatchChanges(f,batch,3000),'');assert.equal(f.cup.substitutionsUsed,2);assert.equal(f.cup.subWindowsUsed,3);
});
