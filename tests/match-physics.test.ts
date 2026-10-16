import assert from 'node:assert/strict';
import test from 'node:test';
import canonical from '../app/travel-route-cache.json';
import chunked from '../app/travel-route-cache';
import { assertContinuous, verifyFullMatchPhysics } from '../scripts/qa/match-physics-audit';

test('full league and all cup matches preserve production ball continuity through pauses and reloads',()=>{
 const results=verifyFullMatchPhysics();
 assert.ok(results.reduce((sum,result)=>sum+result.checked,0)>40_000);
 assert.ok(results.every(result=>result.completed&&result.maxSpeedMetresPerSecond<=55.00001));
 assert.ok(results.reduce((sum,result)=>sum+result.goalPauses,0)>0);
 console.log('Full-match ball continuity:',JSON.stringify(results));
});
test('continuity verifier rejects an active-play teleport but permits a whistled restart',()=>{
 const before={at:1000,ball:{x:10,y:34},stoppage:null};
 const after={at:1016,ball:{x:90,y:34},stoppage:null};
 assert.throws(()=>assertContinuous(before,after),/ball discontinuity/);
 assert.doesNotThrow(()=>assertContinuous(before,{...after,stoppage:'kickoff'}));
 assert.throws(()=>assertContinuous(before,{...after,ball:{x:NaN,y:34}}),/finite/);
});
test('chunked route data exactly preserves canonical infrastructure geometry and metadata',()=>{
 assert.deepEqual(chunked,canonical);
 assert.deepEqual(Object.keys(chunked),Object.keys(canonical));
});
