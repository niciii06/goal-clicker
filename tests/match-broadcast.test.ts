import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {initialGameFeatures,beginSeasonCupMatch,STAR_XI_PLAYERS,setBestStarXI,getStarXISelection,advanceCupMatch,normalizeGameFeatures,applyCupSubstitution,getStarXIPlayer,STAR_FORMATIONS} from '../app/feature-data.ts';
import {advanceMatchBroadcast,createMatchBroadcast,normalizeMatchBroadcast,matchFitness,chooseGoalPattern} from '../app/match-broadcast.ts';
import type {BroadcastEvent} from '../app/match-broadcast.ts';
import {getVisualFrame,getViewerEvents,baseActors,LiveMatchViewer} from '../app/match-viewer.tsx';
import {MatchMotion,drawFootballPitch} from '../app/match-pitch-canvas.tsx';

function fixture() {
 const f=initialGameFeatures(1000000);f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.map(p=>p.id)});
 f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,1000000,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions,f.starXI.lineupIds,f.starXI.benchIds);
 return f;
}
const players=(f:ReturnType<typeof fixture>)=>getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds);

test('opponent game XI has eleven unique real card identities and eligible primary or secondary positions',()=>{
 const f=fixture(),b=createMatchBroadcast(f.cup),formation=STAR_FORMATIONS.find(x=>x.id===b.opponentFormation)!;
 assert.equal(b.opponentXI.length,11);assert.equal(new Set(b.opponentXI.map(p=>p.sourceId)).size,11);
 b.opponentXI.forEach((p,i)=>{const source=getStarXIPlayer(p.sourceId)!;assert.ok(source.positions.includes(formation.slots[i].position));assert.equal(p.name,source.name);assert.equal(p.rating,source.rating);});
 assert.deepEqual(createMatchBroadcast(JSON.parse(JSON.stringify(f.cup))),b);
});

test('authoritative added actions and their statistics survive JSON roundtrip and replaying the same tick is idempotent',()=>{
 const f=fixture();f.cup.lastTickAt=f.cup.matchEndsAt;f.cup.broadcast=advanceMatchBroadcast(f.cup,players(f));
 const b=f.cup.broadcast,copy=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
 assert.deepEqual(copy.cup.broadcast,b);
 assert.deepEqual(advanceMatchBroadcast(copy.cup,players(copy)),b);
 assert.equal(new Set(b.events.map(e=>e.id)).size,b.events.length);
 assert.equal(b.clubStats.possessionSeconds+b.opponentStats.possessionSeconds,360);
 assert.equal(b.clubStats.corners,b.events.filter(e=>e.side==='club'&&e.kind==='corner').length);
 assert.equal(b.opponentStats.saves,b.events.filter(e=>e.side==='club'&&e.outcome==='save').length);
 assert.ok(b.clubStats.onTarget<=b.clubStats.shots);
});

test('broadcast uses no match RNG, rendering and replays cannot fabricate goals or mutate state',()=>{
 const f=fixture();let calls=0;
 const result=advanceCupMatch(f.cup,80,1030000,()=>{calls++;return .5;},players(f),f.starXI.formationPositions);
 assert.equal(calls,120);assert.equal(result.cup.homeScore,0);assert.equal(result.cup.awayScore,0);
 f.cup=result.cup;const before=JSON.stringify(f);
 for(let t=1030000;t<1032000;t+=16)getVisualFrame(f,t);
 for(const event of getViewerEvents(f.cup))getVisualFrame(f,1062000,{event,startedAt:1060000});
 assert.equal(JSON.stringify(f),before);
});

test('fitness is saved, decreases by role and workload, stays frozen when paused and is independent of tick cadence',()=>{
 const f=fixture(),p=players(f),id=p.find(x=>x.position!=='TW')!.id;
 const bulk={...f.cup,lastTickAt:1180000};bulk.broadcast=advanceMatchBroadcast(bulk,p);
 let small={...f.cup};for(let t=1004000;t<=1180000;t+=4000){small={...small,lastTickAt:t};small.broadcast=advanceMatchBroadcast(small,p);}
 assert.ok(Math.abs(bulk.broadcast.fitness[id]-small.broadcast!.fitness[id])<1e-9);
 assert.ok(matchFitness(bulk,id,46)<100);
 const aggressive={...f.cup,strategyId:'angriff' as const,lastTickAt:1180000};aggressive.broadcast=advanceMatchBroadcast(aggressive,p);
 const possession={...f.cup,strategyId:'ballbesitz' as const,lastTickAt:1180000};possession.broadcast=advanceMatchBroadcast(possession,p);
 assert.ok(aggressive.broadcast.fitness[id]<possession.broadcast.fitness[id]);
 const paused={...bulk,matchPaused:true};assert.deepEqual(advanceCupMatch(paused,80,1400000,()=>.5,p).cup.broadcast,bulk.broadcast);
});

test('a substitution keeps historic slot identity and gives the incoming player 100 fitness',()=>{
 const f=fixture();f.cup.broadcast=createMatchBroadcast(f.cup);const out=f.starXI.lineupIds[3],incoming=f.starXI.benchIds.find(id=>id&&id!==out)!;
 f.cup.broadcast.fitness[out]=45;const sub=applyCupSubstitution(f.cup,out,incoming,60).cup;
 assert.equal(sub.broadcast!.slots[incoming],3);assert.equal(sub.broadcast!.clubFormation,f.starXI.formationId);assert.equal(sub.broadcast!.fitness[incoming],100);
 assert.ok(sub.broadcast!.events.some(e=>e.kind==='substitution'&&e.secondaryId===out));
 sub.playerExitedAt[out]=60;sub.playerEnteredAt[incoming]=60;sub.playerMatchPositions[incoming]=sub.playerMatchPositions[out];
 f.cup=sub;f.starXI.lineupIds[3]=incoming;
 assert.equal(baseActors(f,f.cup,30,true,true).find(p=>p.id===out)?.shirt,String(f.cup.broadcast!.shirtNumbers[out]));
 assert.ok(!baseActors(f,f.cup,30,true,true).some(p=>p.id===incoming));
});

test('corner, free-kick and normal shot animations never enter the goal for unsuccessful outcomes',()=>{
 for(const kind of ['corner','free-kick','shot'] as const)for(const outcome of ['save','wide','blocked'] as const){
  const f=fixture();f.cup.broadcast=createMatchBroadcast(f.cup);
  const e:BroadcastEvent={id:`${kind}-${outcome}`,kind,side:'club',minute:20,at:1080000,playerId:f.starXI.lineupIds[10],player:'Player',outcome,style:kind==='corner'?'header':'long-range',lane:30,seed:.3};
  f.cup.broadcast.events=[e];const event=getViewerEvents(f.cup)[0];
  const frame=getVisualFrame(f,1098000,{event,startedAt:1090000});
  const net=(frame.ball.x>105||frame.ball.x<0)&&frame.ball.y>=30&&frame.ball.y<=38;
  assert.equal(net,false);assert.ok(frame.actors.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  if(outcome==='save')assert.ok(frame.status.includes('Parade')||frame.status.includes('Spieleröffnung'));
 }
});

test('future added action events are hidden from both live pitch and chronological highlight presentation',()=>{
 const f=fixture();f.cup.lastTickAt=1096000;f.cup.broadcast=advanceMatchBroadcast(f.cup,players(f));
 const frame=getVisualFrame(f,1006000);assert.equal(frame.recent,undefined);
 assert.equal(getViewerEvents(f.cup).filter(e=>e.at<=1006000).length,0);
});

test('all planned goal types are valid saved metadata and normalize without altering official scores',()=>{
 const f=fixture();f.cup.lastTickAt=1001000;
 for(const role of ['ST','IV','ZM'] as const)for(let i=0;i<100;i++){
  const pattern=chooseGoalPattern(`goal-${i}`,role);assert.ok(['one-on-one','low-shot','long-range','header','cross','rebound','corner','free-kick','penalty'].includes(pattern));
 }
 f.cup.matchEvents=[{id:'g',side:'home',scorerId:f.starXI.lineupIds[10],scorer:'Player',minute:1,createdAt:1001000,homeScore:1,awayScore:0,ratingImpacts:{},pattern:'corner'}];f.cup.homeScore=1;
 const n=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));assert.equal(n.cup.matchEvents[0].pattern,'corner');assert.equal(n.cup.homeScore,1);
});

test('motion has bounded acceleration and speeds, removes departed actors and never modifies authoritative state',()=>{
 const f=fixture();f.cup.broadcast=createMatchBroadcast(f.cup);const frame=getVisualFrame(f,1020000),motion=new MatchMotion(),before=JSON.stringify(f);
 let previous=motion.step(frame.actors,1/60,f.cup,6,'normal');
 for(let i=0;i<180;i++){
  const target=frame.actors.map(p=>({...p,x:Math.min(102,p.x+40)}));const next=motion.step(target,1/60,f.cup,6,'normal');
  next.forEach((p,j)=>assert.ok(Math.hypot(p.x-previous[j].x,p.y-previous[j].y)<=12/60));previous=next;
 }
 motion.step(frame.actors.slice(1),1/60,f.cup,6,'normal');assert.ok(!motion.bodies.has(frame.actors[0].id));assert.equal(JSON.stringify(f),before);
});

test('compact viewer exposes three tabs, canvas, cameras and one substitution entry point',()=>{
 const f=fixture();f.cup.broadcast=createMatchBroadcast(f.cup);
 const html=renderToStaticMarkup(createElement(LiveMatchViewer,{features:f,now:1030000,clubName:'Testclub',clubColor:'#0071e3',onTactic:()=>{},onSubstitute:()=>{}}));
 assert.ok(html.includes('<canvas'));assert.ok(html.includes('Grosse Spielansicht'));assert.ok(html.includes('Ball verfolgen'));assert.ok(html.includes('Highlight-Kamera'));assert.equal((html.match(/role="tab"/g)??[]).length,3);assert.ok(html.includes('MATCH'));assert.ok(html.includes('TEAM'));assert.ok(html.includes('STATISTIK'));assert.ok(html.includes('Wechseln'));assert.equal((html.match(/gc-team-list/g)??[]).length,0);
});

test('pitch geometry draws both goals, penalty areas and centre circle through a canvas context',()=>{
 const calls:string[]=[];
 const ctx=new Proxy({},{set:()=>true,get:(_,key)=>()=>calls.push(String(key))}) as CanvasRenderingContext2D;
 drawFootballPitch(ctx);assert.ok(calls.filter(x=>x==='strokeRect').length>=7);assert.ok(calls.includes('arc'));assert.ok(calls.includes('stroke'));
});

test('malformed broadcasts fail closed without breaking legacy saves',()=>{
 assert.equal(normalizeMatchBroadcast({version:1,opponentXI:[]}),undefined);
 const f=fixture(),b=createMatchBroadcast(f.cup);b.opponentXI[0].sourceId='invalid';assert.equal(normalizeMatchBroadcast(b),undefined);
 assert.equal(normalizeGameFeatures({...f,cup:{...f.cup,broadcast:{version:1,opponentXI:[]}}}).cup.broadcast,undefined);
});
