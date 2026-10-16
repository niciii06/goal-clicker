import assert from 'node:assert/strict';
import { initialGameFeatures, STAR_XI_PLAYERS, setBestStarXI, beginCupMatch, beginSeasonCupMatch, advanceCupMatch, getStarXISelection, resumeCupMatch, resolveCupPenalty, normalizeGameFeatures } from '../../app/feature-data';
import type { TournamentId } from '../../app/feature-data';
import { MatchPresentation, MAX_BALL_SPEED_METRES_PER_SECOND } from '../../app/match-motion';

export type PhysicsSample={at:number;ball:{x:number;y:number};stoppage:string|null};
export function assertContinuous(previous:PhysicsSample,current:PhysicsSample) {
 const seconds=(current.at-previous.at)/1000;
 assert.ok(seconds>0,'frames must have strictly increasing timestamps');
 assert.ok(Number.isFinite(current.ball.x)&&Number.isFinite(current.ball.y),'ball coordinates must be finite');
 const distance=Math.hypot(current.ball.x-previous.ball.x,current.ball.y-previous.ball.y);
 if(!previous.stoppage&&!current.stoppage) {
  assert.ok(distance<=MAX_BALL_SPEED_METRES_PER_SECOND*seconds+1e-7,
   `ball discontinuity at ${current.at}: ${distance} m / ${seconds} s exceeds ${MAX_BALL_SPEED_METRES_PER_SECOND} m/s`);
 }
 return {distance,seconds,checked:!previous.stoppage&&!current.stoppage};
}
const deadBalls=new Set(['corner','free-kick','throw-in','goal-kick','offside','penalty']);
export function verifyFullMatchPhysics(onFrame?:(match:string,sample:PhysicsSample)=>void) {
 const profiles:[string,TournamentId|'season',number,number][]=[
  ['league-60fps','season',60,101],['stadium-30fps','stadium',30,202],
  ['champions-variable','champions',30,303],['world-60fps','world',60,404],
 ];
 return profiles.map(([name,mode,fps,initialSeed])=>{
  const start=1_000_000;let features=initialGameFeatures(start);
  features.starXI=setBestStarXI({...features.starXI,ownedIds:STAR_XI_PLAYERS.map(player=>player.id)});
  const players=()=>getStarXISelection(features.starXI.ownedIds,features.starXI.lineupIds);
  let seed=initialSeed;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  features.cup=mode==='season'
   ?beginSeasonCupMatch(features.cup,features.seasonMode,start,players(),features.starXI.formationPositions,features.starXI.lineupIds,features.starXI.benchIds)
   :beginCupMatch(features.cup,start,mode,players(),features.starXI.formationPositions,features.starXI.lineupIds,features.starXI.benchIds,random);
  let motion=new MatchPresentation(),previous:PhysicsSample|undefined;
  let now=start,lastTick=start,frames=0,checked=0,excluded=0,maxSpeed=0,maxDelta=0;
  let reloads=0,halftimes=0,goalPauses=0,lastPause='',penaltyAt=0;
  const reasons:Record<string,number>={};
  while(features.cup.active) {
   assert.ok(now-start<1_200_000,`${name}: full match must terminate within audit horizon`);
   if(now-lastTick>=250) {
    if(features.cup.matchPaused) features.cup=resumeCupMatch(features.cup,now);
    else if(features.cup.phase==='penalties') {
     if(now-penaltyAt>=2000){features.cup=resolveCupPenalty(features.cup,85,'center',now,random,players(),features.starXI.formationPositions).cup;penaltyAt=now;}
    } else features.cup=advanceCupMatch(features.cup,85,now,random,players(),features.starXI.formationPositions).cup;
    lastTick=now;
   }
   const pause=features.cup.timedPause;
   if(pause&&pause.id!==lastPause){lastPause=pause.id;if(pause.kind==='halftime')halftimes++;else goalPauses++;}
   // Reconnect during a real pause. Preserve the previous sample: no continuity gap is hidden.
   if(pause&&now>=pause.startsAt&&reloads<1){features=normalizeGameFeatures(JSON.parse(JSON.stringify(features)));motion=new MatchPresentation();reloads++;}
   const dt=previous?(now-previous.at)/1000:1/fps;
   const output=motion.step(features,now,dt);
   let stoppage:string|null=output.restart?'kickoff':output.paused?'pause':null;
   if(!stoppage&&features.cup.phase==='penalties')stoppage='penalty';
   if(!stoppage&&output.frame.recent&&deadBalls.has(output.frame.recent.kind)&&output.frame.age<1.5)stoppage=output.frame.recent.kind;
   const sample={at:now,ball:output.ball,stoppage};
   onFrame?.(name,sample);
   if(previous){const result=assertContinuous(previous,sample);if(result.checked){checked++;maxSpeed=Math.max(maxSpeed,result.distance/result.seconds);maxDelta=Math.max(maxDelta,result.distance);}else excluded++;}
   if(stoppage)reasons[stoppage]=(reasons[stoppage]??0)+1;
   previous=sample;frames++;
   // Explicit dropped frames exercise the production dt clamp without exemptions.
   now+=name==='champions-variable'&&frames%137===0?200:1000/fps;
  }
  assert.ok(checked>frames*.5,`${name}: active play must dominate coverage`);
  assert.equal(halftimes,1,`${name}: complete regulation must include halftime exactly once`);
  assert.equal(reloads,1,`${name}: serialized pause must be exercised`);
  return {name,seed:initialSeed,fps,frames,checked,excluded,maxSpeedMetresPerSecond:maxSpeed,maxDeltaMetres:maxDelta,
   simulatedSeconds:(now-start)/1000,halftimes,goalPauses,reloads,reasons,completed:!features.cup.active};
 });
}
