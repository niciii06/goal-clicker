import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameFeatures, STAR_XI_PLAYERS, STAR_FORMATIONS, setBestStarXI, beginSeasonCupMatch, getStarXISelection, advanceCupMatch, normalizeGameFeatures, resumeCupMatch, getStarXIPlayer, pauseGameFeatureTimers, getCupRegularDurationMs } from '../app/feature-data';
import { prepareCareerMatch, recordCareerMatch } from '../app/career-data';
import { createInteractiveMatch, advanceInteractive, interactiveFrame } from '../app/interactive-match';
import { requestMatchEdit, confirmMatchDraft, draftMatch } from '../app/match-commands';
import { getVisualFrame, LiveMatchViewer } from '../app/match-viewer';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
function fixture(seed=1,formation='433'){
 const f=initialGameFeatures(1000000+seed);f.starXI=setBestStarXI({...f.starXI,formationId:formation as typeof f.starXI.formationId,ownedIds:STAR_XI_PLAYERS.map(p=>p.id)});
 f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,1000000+seed,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions,f.starXI.lineupIds,f.starXI.benchIds);prepareCareerMatch(f);return f;
}
function complete(f:ReturnType<typeof fixture>,step=360000,render=false){
 let iterations=0;
 while(f.cup.active&&iterations++<1000){if(f.cup.matchPaused)f.cup=resumeCupMatch(f.cup,f.cup.lastTickAt);const now=Math.min(f.cup.matchEndsAt,f.cup.lastTickAt+step);
  if(render){const snapshot=JSON.stringify(f.cup);getVisualFrame(f,now);assert.equal(JSON.stringify(f.cup),snapshot);}
  const result=advanceCupMatch(f.cup,85,now,()=>{throw Error('Unseeded RNG consumed');},getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions);f.cup=result.cup;
 }
 assert.ok(!f.cup.active,'valid endpoint');return f;
}
const summary=(f:ReturnType<typeof fixture>)=>({goals:f.cup.matchEvents.map(e=>[e.id,e.scorerId,e.assistId,e.minute]),score:[f.cup.homeScore,f.cup.awayScore],stats:f.cup.broadcast?.clubStats,other:f.cup.broadcast?.opponentStats,checkpoint:f.cup.simulation?.committed});
test('100 complete matches: valid actors, score/event parity, variation, bounds and statistics',()=>{
 let goals=0,draws=0,zeros=0,shots=0,onTarget=0;const scores=new Set(),kinds=new Set();
 for(let i=1;i<=100;i++){const f=fixture(i,STAR_FORMATIONS[i%STAR_FORMATIONS.length].id);f.cup.opponentRating=[65,90,99][i%3];f.cup.simulation=createInteractiveMatch(f.cup,f.starXI.lineupIds,f.starXI.formationId);complete(f);const c=f.cup;goals+=c.homeScore+c.awayScore;draws+=Number(c.homeScore===c.awayScore);zeros+=Number(c.homeScore+c.awayScore===0);scores.add(`${c.homeScore}:${c.awayScore}`);
  assert.equal(c.homeScore,c.matchEvents.filter(e=>e.side==='home').length);assert.equal(c.awayScore,c.matchEvents.filter(e=>e.side==='away').length);assert.equal(new Set(c.matchEvents.map(e=>e.id)).size,c.matchEvents.length);
  for(const e of c.matchEvents){assert.ok(e.scorerId);assert.ok(c.simulation!.committed.players.some(p=>p.id===e.scorerId));if(e.assistId)assert.notEqual(e.assistId,e.scorerId);}
  const p=c.simulation!.committed.players;assert.equal(new Set(p.map(p=>p.id)).size,p.length);p.forEach(p=>{assert.ok(p.x>=0&&p.x<=105&&p.y>=0&&p.y<=68);assert.ok(Number.isFinite(p.fitness));});
  for(const stats of [c.broadcast!.clubStats,c.broadcast!.opponentStats]){shots+=stats.shots;onTarget+=stats.onTarget;Object.values(stats).forEach(n=>assert.ok(Number.isFinite(n)&&n>=0));assert.ok(stats.onTarget<=stats.shots);}
  c.simulation!.recent.forEach(a=>kinds.add(a.kind));
 }
 assert.ok(scores.size>4,'different seeds vary');console.log('Interactive 100-match batch',JSON.stringify({goals,meanGoals:goals/100,draws,zeros,shots,onTarget,scorelines:scores.size,endingActionKinds:[...kinds]}));
});
test('seed/checkpoint replay: normal, headless, different step sizes and renderer agree',()=>{
 for(let seed=101;seed<=106;seed++){
  const template=fixture(seed),normal=complete(structuredClone(template),1000,true),fast=structuredClone(template);complete(fast);assert.deepEqual(summary(normal),summary(fast));
  const different=complete(structuredClone(template),713);assert.deepEqual(summary(normal),summary(different));
 }
});
test('speculation never changes score/statistics or leaks goals into the UI',()=>{
 const f=fixture(201),before=JSON.stringify(f.cup),frame=interactiveFrame(f.cup,f.cup.matchStartedAt+2000);assert.ok(frame.action);assert.equal(f.cup.homeScore,0);assert.equal(f.cup.matchEvents.length,0);assert.equal(JSON.stringify(f.cup),before);
 const html=renderToStaticMarkup(createElement(LiveMatchViewer,{features:f,now:f.cup.matchStartedAt+2000,clubName:'Test',clubColor:'#17875f'}));assert.equal((html.match(/gc-viewer-scoreboard/g)??[]).length,1);assert.ok(html.includes('0 : 0'));assert.ok(!html.includes('TOR!'));
});
test('reload checkpoint, editing pause, hidden tab and halftime preserve progress',()=>{
 const f=fixture(300);f.cup=advanceInteractive(f.cup,f.cup.matchStartedAt+45000);const reload=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
 assert.deepEqual(summary(complete(structuredClone(f))),summary(complete(reload)));
 const hidden=fixture(301);hidden.cup=advanceInteractive(hidden.cup,hidden.cup.matchEndsAt+900000);assert.equal(hidden.cup.simulation!.time,2700);assert.equal(hidden.cup.simulation!.status,'halftime');assert.ok(hidden.cup.matchPaused);
 const before=hidden.cup.simulation!.time,normalized=normalizeGameFeatures(JSON.parse(JSON.stringify(hidden)));assert.ok(normalized.cup.matchPaused);assert.equal(advanceInteractive(normalized.cup,Date.now()).simulation!.time,before);
 const running=fixture(302);assert.equal(pauseGameFeatureTimers(running,10000).cup.matchStartedAt,running.cup.matchStartedAt);
});
test('atomic multiple substitutions, cancellation and tactical invalidation',()=>{
 let f=fixture(401);const unchanged=JSON.stringify(f);const draft=draftMatch(f);draft.lineup.reverse();assert.equal(JSON.stringify(f),unchanged);
 f=requestMatchEdit(f,f.cup.matchStartedAt+14000);f.cup=advanceInteractive(f.cup,f.cup.matchStartedAt+18000);assert.ok(f.cup.matchPaused);assert.equal(f.cup.simulation!.status,'editing');
 const d=draftMatch(f),out:string[]=[];
 for(let slot=0;slot<11&&out.length<2;slot++){const incoming=f.starXI.benchIds.find(id=>id&&!d.lineup.includes(id)&&getStarXIPlayer(id)?.positions.includes(f.starXI.formationPositions[slot]));if(incoming){out.push(d.lineup[slot]);d.lineup[slot]=incoming;}}
 assert.equal(out.length,2);assert.equal('strategy' in d,false);const bad={...d,lineup:[...d.lineup]};bad.lineup[1]=bad.lineup[0];const snapshot=JSON.stringify(f);assert.ok(confirmMatchDraft(f,bad,f.cup.lastTickAt+9000).error);assert.equal(JSON.stringify(f),snapshot);
 const result=confirmMatchDraft(f,d,f.cup.lastTickAt+9000);assert.equal(result.error,'');assert.equal(result.features.cup.substitutionsUsed,2);assert.equal(result.features.cup.strategyId,f.cup.strategyId);assert.ok(result.features.cup.simulation!.generation>0);
 f=result.features;const minute=Math.ceil(f.cup.simulation!.time/60);complete(f);for(const a of f.cup.simulation!.recent)assert.ok(!out.includes(a.actor));for(const e of f.cup.matchEvents.filter(e=>e.minute>minute))assert.ok(!out.includes(e.scorerId!));assert.equal(f.cup.broadcast!.events.filter(e=>e.kind==='substitution').length,2);
});
test('completion/retries and career finalization are idempotent',()=>{
 const f=complete(fixture(500));const original=JSON.stringify(f.cup);assert.equal(JSON.stringify(advanceCupMatch(f.cup,90,f.cup.matchEndsAt+10000).cup),original);
 recordCareerMatch(f,f.cup.lastTickAt);const once=JSON.stringify(f.career);recordCareerMatch(f,f.cup.lastTickAt+1000);assert.equal(JSON.stringify(f.career),once);
 const reloaded=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));assert.equal(reloaded.cup.active,false);assert.equal(reloaded.cup.homeScore,f.cup.homeScore);
});
test('legacy running matches retain their engine and timing',()=>{const f=fixture(600);delete f.cup.simulation;const restored=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));assert.equal(restored.cup.simulation,undefined);assert.ok(advanceCupMatch(restored.cup,80,restored.cup.matchStartedAt+1000,()=>.5).cup.lastTickAt>restored.cup.lastTickAt);});

test('paired strength scenarios favour better squads in both directions',()=>{
 const results=[];
 for(const pair of [[90,90],[90,65],[65,90]]){let forGoals=0,against=0,wins=0,draws=0,zeros=0,shots=0;for(let seed=701;seed<=800;seed++){
  const f=fixture(seed);f.cup.opponentRating=pair[1];f.cup.strategyId=f.cup.opponentStrategyId='ballbesitz';f.cup.simulation=createInteractiveMatch(f.cup,f.starXI.lineupIds,f.starXI.formationId);
  for(const p of f.cup.simulation.committed.players){const rating=p.side==='club'?pair[0]:pair[1];p.rating=p.passing=p.shooting=p.pace=p.defending=p.keeping=p.control=rating;}
  f.cup.simulation.buffer=[];complete(f);forGoals+=f.cup.homeScore;against+=f.cup.awayScore;wins+=Number(f.cup.homeScore>f.cup.awayScore);draws+=Number(f.cup.homeScore===f.cup.awayScore);zeros+=Number(f.cup.homeScore+f.cup.awayScore===0);shots+=f.cup.broadcast!.clubStats.shots+f.cup.broadcast!.opponentStats.shots;
 }results.push({pair,forGoals,against,wins,draws,zeros,shots});}
 console.log('Paired strength batch (300 matches)',JSON.stringify(results));assert.ok(results[1].forGoals>results[2].forGoals);assert.ok(results[1].wins>results[2].wins);assert.ok(results[2].against>results[1].against);
});

test('a two-second stalled frame resumes smoothly instead of skipping 30 game seconds',async()=>{
 const {MatchPlaybackClock}=await import('../app/match-playback-clock');const clock=new MatchPlaybackClock();
 assert.equal(clock.step(0,180,0,600),180);
 const before=clock.step(1000/60,180.25,0,600),after=clock.step(2016.67,210.25,0,600);
 assert.ok(after-before<=.91,`${after-before} game seconds jumped`);
 let last=after;for(let i=1;i<=180;i++){const current=clock.step(2016.67+i*1000/60,210.25+i*.25,0,600);assert.ok(current>=last);assert.ok(current-last<=.31);last=current;}
 assert.ok(last>after,'play resumes');assert.ok(210.25+180*.25-last<210.25-after,'backlog decreases');
 assert.equal(clock.step(6000,0,0,600),last,'late/stale clock update cannot rewind');
 clock.reset();assert.equal(clock.step(10000,600,500,700),600,'return from hidden tab reconciles directly');
});
test('sparse authoritative updates keep ticker minutes consecutive and never rewind',async()=>{
 const {MatchPlaybackClock}=await import('../app/match-playback-clock');const clock=new MatchPlaybackClock();let latest=600,lastMinute=1,changes=0;
 for(let frame=0;frame<60*36;frame++){
  const timestamp=frame*1000/60;
  if(frame===60*9)latest=1200; // A delayed update from minute 3 to minute 6 must not dictate the display minute.
  const t=clock.step(timestamp,180+timestamp*.015,0,latest),minute=Math.ceil(t/60);
  if(frame===0)lastMinute=minute;
  assert.ok(minute>=lastMinute);assert.ok(minute-lastMinute<=1);if(minute!==lastMinute)changes++;lastMinute=minute;
 }
 assert.ok(changes>=8);
});
test('committed action history survives normalization for continuous delayed playback',()=>{
 const f=fixture(901);f.cup=advanceInteractive(f.cup,f.cup.matchStartedAt+22000);
 const delayed=f.cup.lastTickAt-2000,before=interactiveFrame(f.cup,delayed),restored=normalizeGameFeatures(JSON.parse(JSON.stringify(f))),after=interactiveFrame(restored.cup,delayed);
 assert.deepEqual(after.ball,before.ball);assert.deepEqual(after.players,before.players);assert.equal(after.action?.id,before.action?.id);
 const state=JSON.stringify(f.cup),end=interactiveFrame(f.cup,f.cup.matchStartedAt+4000);
 assert.ok(f.cup.simulation!.buffer.at(-1)!.end-f.cup.simulation!.time>=75,'buffer covers at least five seconds');assert.equal(JSON.stringify(f.cup),state);assert.ok(end.players.length>0);
});
test('live match controls contain no quick simulation control',()=>{
 const f=fixture(902),html=renderToStaticMarkup(createElement(LiveMatchViewer,{features:f,now:f.cup.matchStartedAt,clubName:'Test',clubColor:'#17875f'}));
 assert.ok(!html.includes('Schnell simulieren'));assert.ok(html.includes('Live Ticker'));assert.ok(html.includes('>Wechsel<'));assert.ok(!html.includes('Taktik'));assert.ok(!html.includes('Offensivpressing'));
 const legacy=JSON.parse(JSON.stringify(f));legacy.cup.simulation.quick=true;assert.equal('quick' in normalizeGameFeatures(legacy).cup.simulation!,false);
});

test('ordinary 15/30/60 FPS keeps the same displayed match time',async()=>{
 const {MatchPlaybackClock}=await import('../app/match-playback-clock');
 for(const fps of [15,30,60]){const clock=new MatchPlaybackClock();clock.step(0,0,0,5400);let time=0;for(let frame=1;frame<=fps*20;frame++)time=clock.step(frame*1000/fps,frame*15/fps,0,5400);assert.ok(Math.abs(time-300)<.001,`${fps} FPS: ${time}`);}
});

test('independent renderer interpolates the same prepared actions without mutating the match',async()=>{
 const {IndependentMatchRenderer}=await import('../app/match-renderer-core');const f=fixture(1001),renderer=new IndependentMatchRenderer(),before=JSON.stringify(f.cup);
 renderer.sync({simulation:f.cup.simulation!,startedAt:f.cup.matchStartedAt,regularDuration:getCupRegularDurationMs(f.cup),paused:false,active:true,wallNow:f.cup.matchStartedAt,monotonicAt:0,colours:{club:'#17875f',opponent:'#ffc857'},yellowCards:[],width:640,height:448,reducedMotion:false});
 for(let i=0;i<90;i++){const at=i*1000/30,frame=renderer.frame(at)!,reference=interactiveFrame(f.cup,f.cup.matchStartedAt+at);assert.ok(Math.hypot(frame.ball.x-reference.ball.x,frame.ball.y-reference.ball.y)<1e-8);assert.equal(frame.actors.length,reference.players.length);frame.actors.forEach((p,index)=>{assert.ok(Math.hypot(p.x-reference.players[index].x,p.y-reference.players[index].y)<1e-8);});}
 assert.equal(JSON.stringify(f.cup),before);
});
test('worker drawing continues through a real one-second main-thread stall',async()=>{
 const {Worker}=await import('node:worker_threads');const {createRequire}=await import('node:module');const {performance}=await import('node:perf_hooks');const {pathToFileURL}=await import('node:url');
 const require=createRequire(import.meta.url),f=fixture(1002);
 const worker=new Worker(`
  const {parentPort,workerData}=require('node:worker_threads');
  let frames=0,lastBall;
  const ctx=new Proxy({}, {get:(_,key)=>key==='fillRect'?((x)=>{if(x===-4)frames++;}):key==='arc'?((x,y,r)=>{if(r>=.74&&r<1)lastBall={x,y};}):(()=>{}),set:()=>true});
  globalThis.postMessage=m=>parentPort.postMessage(m);
  (async()=>{const {register}=await import(workerData.registerApi);register();await import(workerData.entry);
   parentPort.on('message',m=>{if(m.kind==='inspect'){parentPort.postMessage({kind:'inspection',frames,lastBall});return;}if(m.kind==='init')m.canvas={width:320,height:224,getContext:()=>ctx};globalThis.onmessage({data:m});});
   parentPort.postMessage({kind:'loaded'});
  })().catch(e=>{parentPort.postMessage({kind:'failed',error:String(e)});});
 `,{eval:true,workerData:{registerApi:pathToFileURL(require.resolve('tsx/esm/api')).href,entry:new URL('../app/match-render.worker.ts',import.meta.url).href}});
 const next=(kind:string)=>new Promise<Record<string,unknown>>((resolve,reject)=>{const timeout=setTimeout(()=>{worker.off('message',listener);reject(Error('Worker response timed out'));},5000);const listener=(m:Record<string,unknown>)=>{if(m.kind==='failed'){clearTimeout(timeout);worker.off('message',listener);reject(Error(String(m.error)));}else if(m.kind===kind){clearTimeout(timeout);worker.off('message',listener);resolve(m);}};worker.on('message',listener);});
 try{
  await next('loaded');const ready=next('ready');worker.postMessage({kind:'init',snapshot:{simulation:f.cup.simulation,startedAt:f.cup.matchStartedAt,regularDuration:360000,paused:false,active:true,wallNow:f.cup.matchStartedAt,monotonicAt:performance.timeOrigin+performance.now(),colours:{club:'#17875f',opponent:'#ffc857'},yellowCards:[],width:320,height:224,reducedMotion:false}});await ready;
  let reply=next('inspection');worker.postMessage({kind:'inspect'});const before=await reply;
  const start=performance.now();while(performance.now()-start<1100){ /* Deliberately block only the test's main thread. */ }
  reply=next('inspection');worker.postMessage({kind:'inspect'});const after=await reply;
  const advanced=Number(after.frames)-Number(before.frames);assert.ok(advanced>=10,`${advanced} independently drawn frames`);assert.notDeepEqual(after.lastBall,before.lastBall);
  console.log('Worker stall test:',advanced,'frames drawn while main thread was blocked for 1.1 seconds');
 }finally{await worker.terminate();}
});
