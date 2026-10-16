import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGameFeatures, beginCupMatch, beginSeasonCupMatch, advanceCupMatch, getCupMatchMinute, normalizeGameFeatures, getCupRegularDurationMs, getCupMatchStrength, setBestStarXI, STAR_XI_PLAYERS, getStarXISelection } from '../app/feature-data.ts';
import { getVisualFrame } from '../app/match-viewer.tsx';
import { matchColours } from '../app/match-colours.ts';
const start=1000000;
test('new match duration is 3–4 minutes for leagues and 4–5 for cups',()=>{
 const f=initialGameFeatures(start),league=beginSeasonCupMatch(f.cup,f.seasonMode,start);assert.equal(getCupRegularDurationMs(league),210000);
 for(const id of ['stadium','champions','world'] as const){const c=beginCupMatch(f.cup,start,id);assert.ok(getCupRegularDurationMs(c)>=240000&&getCupRegularDurationMs(c)<=300000);}
});
test('goal pauses all simulation for exactly four display seconds after visible goal-line crossing',()=>{
 const f=initialGameFeatures(start);f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.map(p=>p.id)});f.cup=beginCupMatch(f.cup,start,'stadium',getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds));
 // Discipline and injury draws fail; the goal draw succeeds.
 let calls=0;let c=advanceCupMatch(f.cup,90,start+1000,()=>++calls%4===0?0:.5,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions).cup;assert.ok(c.timedPause);assert.equal(c.timedPause!.kind,'goal');
 const pause=c.timedPause!;assert.equal(pause.endsAt-pause.startsAt,4000);
 f.cup=c;const frame=getVisualFrame(f,pause.startsAt);assert.ok(frame.ball.x<0||frame.ball.x>105);
 const minute=getCupMatchMinute(c,pause.frozenAt);assert.equal(getCupMatchMinute(c,pause.endsAt-1),minute);
 const frozen=JSON.stringify(c);c=advanceCupMatch(c,90,pause.endsAt-1,()=>{throw Error('RNG must be frozen');}).cup;assert.equal(JSON.stringify(c),frozen);
 const restored=normalizeGameFeatures({...f,cup:c}).cup;assert.deepEqual(restored.timedPause,pause);
 const resumed=advanceCupMatch(restored,90,pause.endsAt,()=>.5).cup;assert.equal(resumed.timedPause,undefined);assert.equal(resumed.matchEvents.length,1);assert.equal(resumed.restartSide,'opponent');
 assert.equal(resumed.matchEvents[0].createdAt,c.matchEvents[0].createdAt);
});
test('halftime lasts ten seconds at minute 45, survives reload, and restarts only once',()=>{
 let c=beginCupMatch(initialGameFeatures(start).cup,start,'stadium');const half=start+getCupRegularDurationMs(c)/2;
 c=advanceCupMatch(c,80,half,()=>.5).cup;const pause=c.timedPause!;assert.equal(pause.kind,'halftime');assert.equal(pause.endsAt-pause.startsAt,10000);assert.equal(getCupMatchMinute(c,pause.endsAt-1),45);
 const n=normalizeGameFeatures({...initialGameFeatures(start),cup:c}).cup;assert.deepEqual(n.timedPause,pause);
 assert.equal(advanceCupMatch(n,80,pause.endsAt-1,()=>{throw Error('paused');}).cup,n);
 c=advanceCupMatch(n,80,pause.endsAt,()=>.5).cup;assert.equal(c.timedPause,undefined);assert.equal(c.halftimeTaken,true);assert.equal(getCupMatchMinute(c,pause.endsAt),46);
 assert.equal(advanceCupMatch(c,80,pause.endsAt+1000,()=>.5).cup.timedPause,undefined);
});
test('legacy strategy fields do not influence strength and clashing away kits change without changing home colours',()=>{
 const c=beginCupMatch(initialGameFeatures(start).cup,start,'stadium');const before=getCupMatchStrength(c,85);c.strategyId='angriff';c.opponentStrategyId='konter';assert.deepEqual(getCupMatchStrength(c,85).teamStrength,before.teamStrength);assert.equal(before.teamStrength,85);
 const colours=matchColours('Real Madreto','#ffffff',true);assert.equal(colours.opponent,'#ffffff');assert.notEqual(colours.club,'#ffffff');
});
