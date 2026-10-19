import { readInteractiveFrame } from './interactive-frame-data';
import { getStarFormation, getStarXIPlayer, getCupRegularDurationMs } from './feature-data';
import type { CupState, CupStrategyId, StarPosition, StarXIPlayer } from './feature-data';
import { createMatchBroadcast } from './match-broadcast';
import { attackedGoal, carrierOptions, chooseOption, decisionTemperature, flightSeconds, inBox, insidePitch, laneThreats, movePlayersToward, PITCH, progressOf, roleOf, runSpeed, shapeTargets, SIM_SECONDS_PER_VISUAL_SECOND, xFromProgress } from './match-ai';
import type { CarrierOption, PassStyle, SetPiece } from './match-ai';

export type SimPoint = { x:number; y:number };
export type SimPlayer = SimPoint & { id:string; name:string; role:StarPosition; slot:number; side:'club'|'opponent'; number:number; rating:number; passing:number; shooting:number; pace:number; defending:number; keeping:number; control:number; stamina:number; fitness:number; active:boolean; anchor:SimPoint };
export type SimCheckpoint = { time:number; rng:number; sequence:number; players:SimPlayer[]; ball:SimPoint; owner:string; possession:'club'|'opponent'; lastPass?:{id:string;to:string;time:number}; chain:number; restart:boolean; direction:number;
 /** Dead ball awarded to the side in possession; `setPieceReady` once the taker stands at the ball. */
 setPiece?:SetPiece; setPieceReady?:boolean; setPieceSpot?:SimPoint;
 /** Players already cautioned in this match: a second yellow card is a red card. */
 booked?:string[] };
/** One authoritative play. The ball moves from `from` to `to` during [start,end]; `after.ball` always equals `to`.
 * For fouls and cards (`foul`, `yellow`, `red`, `injury`) `actor` is the fouled ball carrier and `target` the offender. */
export type SimAction = { id:string; kind:'pass'|'carry'|'cross'|'interception'|'tackle'|'shot'|'restart'|'red'|'yellow'|'injury'|'foul'; start:number; end:number; side:'club'|'opponent'; actor:string; target?:string; from:SimPoint; to:SimPoint; outcome:'success'|'lost'|'save'|'wide'|'blocked'|'goal'; assist?:string; style?:PassStyle|'dribble'|'hold'|'save'|'parry'; setPiece?:SetPiece; note?:string; before:SimCheckpoint; after:SimCheckpoint };
export type InteractiveMatch = { version:2; id:string; seed:number; time:number; committed:SimCheckpoint; buffer:SimAction[]; recent:SimAction[]; generation:number; status:'running'|'editing'|'halftime'|'completed'; halftimeDone:boolean; pauseRequested:boolean; clubFormation:string; opponentFormation:string; strategy:CupStrategyId; opponentStrategy:CupStrategyId };
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const dist=(a:SimPoint,b:SimPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=(p:SimPoint):SimPoint=>({x:p.x,y:p.y});
/** Game seconds between a goal and the following kickoff (about three real seconds in a league match). */
export const GOAL_CELEBRATION_SECONDS=90;
function seedHash(s:string){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0||1;}
function random(c:SimCheckpoint){let n=c.rng;n^=n<<13;n^=n>>>17;n^=n<<5;c.rng=n>>>0||1;return c.rng/4294967296;}
// A card's attribute profile relative to its rating, applied to the effective match rating:
// form, milestone bonuses and the opponent's strength move every attribute, the profile stays.
function attribute(p:StarXIPlayer|undefined,key:string,base:number){const stats=p?.originalAttributes?.stats as Record<string,{value:number}>|undefined;const n=stats?.[key]?.value;return clamp(typeof n==='number'&&Number.isFinite(n)&&p?base+(n-p.rating)*.8:base,1,99);}
function player(id:string,name:string,role:StarPosition,slot:number,side:SimPlayer['side'],number:number,rating:number,source:StarXIPlayer|undefined,formation:string,direction:number,bonus=0):SimPlayer {
 const s=getStarFormation(formation).slots[slot];const x=role==='TW'?3:12+(100-s.y)*.68,y=role==='TW'?34:5+s.x*.58;
 const right=(side==='club'?direction:-direction)>0,anchor={x:right?x:105-x,y:right?y:68-y};
 const base=clamp(rating+bonus*3,1,99);
 return {id,name,role,slot,side,number,rating:base,passing:attribute(source,'shortPassing',base),shooting:attribute(source,'finishing',base),pace:attribute(source,'sprintSpeed',base),defending:attribute(source,'standingTackle',base),keeping:attribute(source,'gkReflexes',base),control:attribute(source,'dribbling',base),stamina:attribute(source,'stamina',base),fitness:100,active:true,anchor,...anchor};
}
function kickoff(c:SimCheckpoint,side:SimPlayer['side']) {
 c.possession=side;c.lastPass=undefined;c.chain=0;c.ball={x:52.5,y:34};c.restart=true;c.setPiece=undefined;c.setPieceReady=false;c.setPieceSpot=undefined;
 for(const p of c.players){const right=(p.side==='club'?c.direction:-c.direction)>0;p.x=p.role==='TW'?p.anchor.x:right?Math.min(48,p.anchor.x*.65):Math.max(57,105-(105-p.anchor.x)*.65);p.y=p.anchor.y;}
 const taker=c.players.filter(p=>p.active&&p.side===side&&p.role!=='TW').sort((a,b)=>Math.abs(a.x-52.5)-Math.abs(b.x-52.5))[0];
 if(taker){taker.x=52.5;taker.y=34;c.owner=taker.id;}
}
export function createInteractiveMatch(cup:CupState,ids:readonly string[],formation:string):InteractiveMatch {
 const b=cup.broadcast??createMatchBroadcast(cup),id=cup.careerMatchId??`${cup.matchStartedAt}:${cup.opponent}`,seed=seedHash(id),direction=cup.fixture?.away?-1:1;
 const players=[...ids.flatMap((id,i)=>{const p=getStarXIPlayer(id);return p?[player(id,p.name,getStarFormation(formation).slots[i].position,i,'club',i+1,p.rating,p,formation,direction,cup.careerBonuses?.[id])]:[];}),...b.opponentXI.map(p=>player(p.id,p.name,p.position,p.slot,'opponent',p.number,cup.opponentRating,getStarXIPlayer(p.sourceId),b.opponentFormation,direction))];
 const c:SimCheckpoint={time:0,rng:seed,sequence:0,players,ball:{x:52.5,y:34},owner:'',possession:'club',chain:0,restart:true,direction};kickoff(c,'club');
 const sim:InteractiveMatch={version:2,id,seed,time:0,committed:c,buffer:[],recent:[],generation:0,status:'running',halftimeDone:false,pauseRequested:false,clubFormation:formation,opponentFormation:b.opponentFormation,strategy:cup.strategyId,opponentStrategy:cup.opponentStrategyId};refill(sim);return sim;
}
function choose<T>(c:SimCheckpoint,items:T[],weight:(p:T)=>number){const weights=items.map(p=>Math.max(.01,weight(p)));let n=random(c)*weights.reduce((a,b)=>a+b,0);return items[weights.findIndex(w=>(n-=w)<=0)]??items[items.length-1];}
const simSeconds=(visualSeconds:number)=>Math.max(6,Math.round(visualSeconds*SIM_SECONDS_PER_VISUAL_SECOND));
const other=(side:SimPlayer['side'])=>side==='club'?'opponent' as const:'club' as const;
const activeOf=(c:SimCheckpoint,side?:SimPlayer['side'])=>c.players.filter(p=>p.active&&(!side||p.side===side));
const keeperOf=(c:SimCheckpoint,side:SimPlayer['side'])=>activeOf(c,side).find(p=>roleOf(p)==='keeper');
/** Box a goalkeeper may handle in: the one his own side defends. */
const ownBox=(c:SimCheckpoint,p:SimPlayer,at:SimPoint)=>inBox(c,other(p.side),at);
function fatigue(c:SimCheckpoint,duration:number,busy:ReadonlySet<string>){
 for(const p of c.players){if(!p.active)continue;p.fitness=clamp(p.fitness-duration/60*(roleOf(p)==='keeper'?.13:busy.has(p.id)?.5:.4)*clamp(1+(70-p.stamina)/200,.85,1.35),15,100);}
}
/** Whoever reaches a loose ball first; a goalkeeper only inside his own penalty area. */
function collector(c:SimCheckpoint,at:SimPoint,exclude?:string){
 let best:SimPlayer|undefined,time=Infinity;
 for(const p of activeOf(c)){if(p.id===exclude||(roleOf(p)==='keeper'&&!ownBox(c,p,at)))continue;const t=dist(p,at)/runSpeed(p);if(t<time){time=t;best=p;}}
 return best??activeOf(c).find(p=>p.id!==exclude)!;
}
/** Screen seconds a player needs to run to a point. */
const runTime=(p:SimPlayer,at:SimPoint)=>dist(p,at)/runSpeed(p);
type Award={setPiece:SetPiece;side:SimPlayer['side'];ball:SimPoint;spot:SimPoint;taker:SimPlayer};
/** Dead ball after the ball crossed a line, last touched by `lastTouch`. */
function outOfPlay(c:SimCheckpoint,lastTouch:SimPlayer['side'],from:SimPoint,aim:SimPoint):Award{
 // Point where the path leaves the pitch.
 let t=1;const dx=aim.x-from.x,dy=aim.y-from.y;
 if(aim.x<0)t=Math.min(t,(0-from.x)/dx);if(aim.x>PITCH.length)t=Math.min(t,(PITCH.length-from.x)/dx);
 if(aim.y<0)t=Math.min(t,(0-from.y)/dy);if(aim.y>PITCH.width)t=Math.min(t,(PITCH.width-from.y)/dy);
 const ball={x:clamp(from.x+dx*t,0,PITCH.length),y:clamp(from.y+dy*t,0,PITCH.width)};
 const side=other(lastTouch);
 if(ball.y<=.01||ball.y>=PITCH.width-.01){const spot={x:clamp(ball.x,1,104),y:ball.y<=.01?0:PITCH.width};return {setPiece:'throw-in',side,ball,spot,taker:nearestTaker(c,side,spot)};}
 // End line: behind the goal attacked by the last touching side means a goal kick, else a corner.
 const attackedByLastTouch=attackedGoal(c,lastTouch).x===(ball.x<=.01?0:PITCH.length);
 if(attackedByLastTouch){const goalX=ball.x<=.01?0:PITCH.length,spot={x:goalX===0?5.5:PITCH.length-5.5,y:PITCH.goalY+(ball.y<PITCH.goalY?-9:9)};return {setPiece:'goal-kick',side,ball,spot,taker:keeperOf(c,side)??nearestTaker(c,side,spot)};}
 const spot={x:ball.x<=.01?0:PITCH.length,y:ball.y<PITCH.goalY?0:PITCH.width};
 return {setPiece:'corner',side,ball,spot,taker:nearestTaker(c,side,spot,true)};
}
function nearestTaker(c:SimCheckpoint,side:SimPlayer['side'],spot:SimPoint,preferWide=false){
 const candidates=activeOf(c,side).filter(p=>roleOf(p)!=='keeper');
 return candidates.sort((a,b)=>dist(a,spot)-(preferWide&&roleOf(a)==='wide'?6:0)-(dist(b,spot)-(preferWide&&roleOf(b)==='wide'?6:0)))[0]??activeOf(c,side)[0];
}
function award(c:SimCheckpoint,a:Award){c.setPiece=a.setPiece;c.setPieceReady=false;c.setPieceSpot={...a.spot};c.possession=a.side;c.owner=a.taker.id;c.ball={...a.ball};c.lastPass=undefined;c.chain=0;}
type Play={kind:SimAction['kind'];outcome:SimAction['outcome'];to:SimPoint;duration:number;target?:SimPlayer;assist?:string;style?:SimAction['style'];setPiece?:SetPiece;note?:string;offsideId?:string;fixed:Set<string>;celebration?:boolean};
/** Kick-off at the start of a half or after a goal (with the celebration in front of it). */
function kickoffPlay(c:SimCheckpoint,actor:SimPlayer):Play{
 c.restart=false;c.setPiece=undefined;c.setPieceReady=false;c.setPieceSpot=undefined;
 if(dist(c.ball,{x:52.5,y:34})>35){kickoff(c,c.possession);c.restart=false;return {kind:'restart',outcome:'success',to:{x:52.5,y:34},duration:GOAL_CELEBRATION_SECONDS,fixed:new Set(c.players.map(p=>p.id)),celebration:true};}
 const mates=activeOf(c,actor.side).filter(p=>p.id!==actor.id&&roleOf(p)!=='keeper').sort((a,b)=>dist(a,actor)-dist(b,actor));
 const target=mates[0];if(!target)return {kind:'restart',outcome:'success',to:point(actor),duration:18,fixed:new Set([actor.id])};
 const to=point(target);c.owner=target.id;c.lastPass={id:actor.id,to:target.id,time:c.time};
 return {kind:'restart',outcome:'success',to,target,duration:simSeconds(flightSeconds(dist(c.ball,to),'short')+.6),style:'short',fixed:new Set([actor.id,target.id])};
}
/** The taker walks to the dead ball while both teams take their positions. */
function setPieceSetup(c:SimCheckpoint,actor:SimPlayer):Play{
 const spot=c.setPieceSpot?{...c.setPieceSpot}:c.setPiece==='penalty'?{x:xFromProgress(c,actor.side,PITCH.length-11),y:PITCH.goalY}:{...c.ball};
 const fixed=new Set([actor.id]),visual=c.setPiece==='throw-in'?1.1:1.6,duration=simSeconds(visual);
 const targets=shapeTargets({...c,ball:spot},actor,fixed);
 if(c.setPiece==='corner'||c.setPiece==='penalty'||(c.setPiece==='free-kick'&&progressOf(c,actor.side,spot.x)>70)){
  // Attackers attack the box, defenders mark goal side; nobody but the taker stands at the ball.
  const box=(side:SimPlayer['side'],i:number,n:number)=>({x:xFromProgress(c,actor.side,PITCH.length-(side===actor.side?8.5:6.5)-(i%2)*2.5),y:PITCH.goalY-9+18*(n>1?i/(n-1):.5)});
  const runners=activeOf(c,actor.side).filter(p=>p.id!==actor.id&&['centre-back','striker','attacking-mid','midfield'].includes(roleOf(p))).slice(0,5);
  runners.forEach((p,i)=>targets.set(p.id,c.setPiece==='penalty'?{x:xFromProgress(c,actor.side,PITCH.length-20),y:PITCH.goalY-8+i*4}:box(actor.side,i,runners.length)));
  const markers=activeOf(c,other(actor.side)).filter(p=>roleOf(p)!=='keeper').sort((a,b)=>progressOf(c,actor.side,b.x)-progressOf(c,actor.side,a.x)).slice(0,6);
  markers.forEach((p,i)=>targets.set(p.id,c.setPiece==='penalty'?{x:xFromProgress(c,actor.side,PITCH.length-21),y:PITCH.goalY-10+i*4}:box(other(actor.side),i,markers.length)));
 }
 movePlayersToward(c,targets,visual,fixed);
 const taker=c.players.find(p=>p.id===actor.id)!;taker.x=spot.x;taker.y=spot.y;
 c.ball={...spot};c.setPieceReady=true;c.setPieceSpot=undefined;
 return {kind:'restart',outcome:'success',to:{...spot},duration,setPiece:c.setPiece,style:'hold',fixed};
}
function resolveShot(c:SimCheckpoint,actor:SimPlayer,quality:number,penalty:boolean):Play{
 const goal=attackedGoal(c,actor.side),keeper=keeperOf(c,other(actor.side)),distance=dist(c.ball,goal);
 const duration=simSeconds(.25+distance/27),visual=duration/SIM_SECONDS_PER_VISUAL_SECOND,goalX=goal.x>52.5?PITCH.length-.4:.4;
 const roll=random(c),fixed=new Set([actor.id]);
 const assist=c.lastPass?.to===actor.id&&c.time-c.lastPass.time<=70&&c.lastPass.id!==actor.id?c.lastPass.id:undefined;
 c.lastPass=undefined;c.chain=0;c.setPiece=undefined;c.setPieceReady=false;c.setPieceSpot=undefined;
 const onTarget=penalty?.9:clamp(quality*1.6+.24,.24,.86);
 const blockers=penalty?[]:activeOf(c,other(actor.side)).filter(p=>roleOf(p)!=='keeper'&&dist(p,c.ball)<10&&Math.abs(Math.atan2(p.y-c.ball.y,p.x-c.ball.x)-Math.atan2(goal.y-c.ball.y,goal.x-c.ball.x))<.35);
 const blockChance=blockers.length?.16:.03;
 if(roll<quality){
  const to={x:goalX,y:PITCH.goalY+(random(c)-.5)*6.2};
  c.restart=true;c.possession=other(actor.side);c.owner=(keeper??activeOf(c,other(actor.side))[0]).id;c.ball=to;
  moveOffBall(c,actor,visual,fixed);
  return {kind:'shot',outcome:'goal',to,duration,assist,target:keeper,fixed,style:penalty?'short':undefined};
 }
 if(roll<onTarget&&keeper){
  // A dive covers a few metres from where the keeper stands.
  const save={x:goal.x>52.5?PITCH.length-1.3:1.3,y:clamp(PITCH.goalY+(random(c)-.5)*6.6,Math.max(PITCH.goalY-3.4,keeper.y-2.6),Math.min(PITCH.goalY+3.4,keeper.y+2.6))};
  keeper.x=save.x;keeper.y=save.y;fixed.add(keeper.id);
  const hold=random(c),held=.42+keeper.keeping/400;
  if(hold<held){c.possession=keeper.side;c.owner=keeper.id;c.ball=save;moveOffBall(c,keeper,visual,fixed);return {kind:'shot',outcome:'save',to:save,duration,target:keeper,fixed,style:'save'};}
  if(hold<held+.28){c.ball=save;award(c,{setPiece:'corner',side:actor.side,ball:save,spot:{x:goal.x,y:save.y<PITCH.goalY?0:PITCH.width},taker:nearestTaker(c,actor.side,{x:goal.x,y:save.y<PITCH.goalY?0:PITCH.width},true)});c.ball=save;moveOffBall(c,actor,visual,fixed);return {kind:'shot',outcome:'save',to:save,duration,target:keeper,fixed,style:'parry',setPiece:'corner'};}
  // Parried into play: the rebound belongs to whoever is quickest, possibly the shooter's team mates.
  const rebound=insidePitch({x:save.x+(goal.x>52.5?-1:1)*(5+random(c)*6),y:save.y+(random(c)-.5)*14},2);
  const first=collector(c,rebound,keeper.id),reach=Math.max(visual,runTime(first,rebound));first.x=rebound.x;first.y=rebound.y;fixed.add(first.id);
  c.possession=first.side;c.owner=first.id;c.ball=rebound;moveOffBall(c,first,reach,fixed);
  return {kind:'shot',outcome:'save',to:rebound,duration:simSeconds(reach),target:keeper,fixed,style:'parry'};
 }
 if(roll<onTarget+blockChance&&blockers.length){
  const blocker=blockers.sort((a,b)=>dist(a,c.ball)-dist(b,c.ball))[0],at=insidePitch({x:blocker.x+(c.ball.x-blocker.x)*.3,y:blocker.y+(c.ball.y-blocker.y)*.3});
  blocker.x=at.x;blocker.y=at.y;fixed.add(blocker.id);c.ball=at;
  if(random(c)<.4){award(c,{setPiece:'corner',side:actor.side,ball:at,spot:{x:goal.x,y:at.y<PITCH.goalY?0:PITCH.width},taker:nearestTaker(c,actor.side,{x:goal.x,y:at.y<PITCH.goalY?0:PITCH.width},true)});c.ball=at;moveOffBall(c,actor,visual,fixed);return {kind:'shot',outcome:'blocked',to:at,duration,target:blocker,fixed,setPiece:'corner'};}
  c.possession=blocker.side;c.owner=blocker.id;moveOffBall(c,blocker,visual,fixed);
  return {kind:'shot',outcome:'blocked',to:at,duration,target:blocker,fixed};
 }
 // Off target: over the line beside the posts, goal kick.
 const sideOfGoal=random(c)<.5?-1:1,to={x:goal.x,y:clamp(PITCH.goalY+sideOfGoal*(PITCH.postHalf+.8+random(c)*9),0,PITCH.width)};
 const kick=outOfPlay(c,actor.side,c.ball,{x:goal.x+(goal.x>52.5?1:-1),y:to.y});
 award(c,kick);moveOffBall(c,kick.taker,visual,fixed);
 return {kind:'shot',outcome:'wide',to:kick.ball,duration,target:kick.taker,fixed,setPiece:'goal-kick'};
}
/** Everybody without a fixed role in the play moves with the new situation in mind. */
function moveOffBall(c:SimCheckpoint,carrier:SimPlayer,visualSeconds:number,fixed:ReadonlySet<string>){
 const live=c.players.find(p=>p.id===carrier.id)??carrier;
 movePlayersToward(c,shapeTargets(c,live,fixed),visualSeconds,fixed);
}
function resolvePass(c:SimCheckpoint,actor:SimPlayer,option:Extract<CarrierOption,{kind:'pass'}>):Play{
 const flight=flightSeconds(option.distance,option.style),fixed=new Set([actor.id]);
 let duration=simSeconds(flight),visual=duration/SIM_SECONDS_PER_VISUAL_SECOND;
 const kind:SimAction['kind']=option.style==='cross'?'cross':'pass';
 c.setPiece=undefined;c.setPieceReady=false;c.setPieceSpot=undefined;
 const target=c.players.find(p=>p.id===option.target.id)!;
 if(random(c)<option.success){
  // The ball rolls on until the receiver gets there: nobody covers more ground than his pace allows.
  visual=Math.max(flight,runTime(target,option.point));duration=simSeconds(visual);
  target.x=option.point.x;target.y=option.point.y;fixed.add(target.id);
  c.ball={...option.point};c.owner=target.id;c.possession=target.side;c.lastPass={id:actor.id,to:target.id,time:c.time+duration};c.chain++;
  moveOffBall(c,target,visual,fixed);
  return {kind,outcome:'success',to:{...option.point},duration,target,style:option.style,fixed};
 }
 if(option.offside){
  // Flag up: indirect free kick for the defenders where the receiver stood.
  const spot=insidePitch({x:target.x,y:target.y}),taker=nearestTaker(c,other(actor.side),spot);
  award(c,{setPiece:'free-kick',side:other(actor.side),ball:{...c.ball},spot,taker});
  moveOffBall(c,taker,.8,fixed);
  return {kind:'pass',outcome:'lost',to:{...c.ball},duration:simSeconds(.8),target:taker,style:option.style,setPiece:'free-kick',note:'offside',offsideId:target.id,fixed};
 }
 const threats=laneThreats(c,actor.side,c.ball,option.point,option.style);
 if(threats.length&&random(c)<.55+.45*(1-option.lane)){
  const threat=choose(c,threats,t=>t.risk),interceptor=c.players.find(p=>p.id===threat.player.id)!,at=insidePitch(threat.point);
  const share=clamp(Math.max(dist(c.ball,at)/Math.max(1,option.distance),runTime(interceptor,at)/visual),.25,1.6);
  interceptor.x=at.x;interceptor.y=at.y;fixed.add(interceptor.id);
  c.ball=at;c.owner=interceptor.id;c.possession=interceptor.side;c.lastPass=undefined;c.chain=0;
  moveOffBall(c,interceptor,visual*share,fixed);
  return {kind:'interception',outcome:'lost',to:at,duration:Math.max(6,Math.round(duration*share)),target:interceptor,style:option.style,fixed};
 }
 // Misplaced: the ball lands off target and is either collected or runs out of play.
 const error=(1.5+option.distance*.12)*(1.3-actor.passing/100)*(.6+random(c)*.8),angle=random(c)*Math.PI*2;
 const landing={x:option.point.x+Math.cos(angle)*error,y:option.point.y+Math.sin(angle)*error};
 if(landing.x<0||landing.x>PITCH.length||landing.y<0||landing.y>PITCH.width){
  const out=outOfPlay(c,actor.side,c.ball,landing);award(c,out);moveOffBall(c,out.taker,visual,fixed);
  return {kind,outcome:'lost',to:out.ball,duration,target:out.taker,style:option.style,setPiece:out.setPiece,fixed};
 }
 const first=collector(c,landing,actor.id);
 visual=Math.max(flight,runTime(first,landing));duration=simSeconds(visual);
 first.x=landing.x;first.y=landing.y;fixed.add(first.id);
 c.ball={...landing};c.owner=first.id;c.possession=first.side;
 if(first.side===actor.side)c.lastPass={id:actor.id,to:first.id,time:c.time+duration};else{c.lastPass=undefined;c.chain=0;}
 moveOffBall(c,first,visual,fixed);
 return {kind,outcome:first.side===actor.side?'success':'lost',to:{...landing},duration,target:first,style:option.style,fixed};
}
/** A dribble. A defender in the way can win the ball cleanly or foul; fouls can bring cards. */
function resolveCarry(c:SimCheckpoint,actor:SimPlayer,option:Extract<CarrierOption,{kind:'carry'}>,remaining:number):Play{
 const carrier=c.players.find(p=>p.id===actor.id)!,length=dist(carrier,option.point);
 const duration=Math.min(remaining,simSeconds(length/(runSpeed(carrier)*.85)+.15)),visual=duration/SIM_SECONDS_PER_VISUAL_SECOND,fixed=new Set([actor.id]);
 if(random(c)<option.success||!option.challenger){
  carrier.x=option.point.x;carrier.y=option.point.y;c.ball={...option.point};c.chain++;
  moveOffBall(c,carrier,visual,fixed);
  return {kind:'carry',outcome:'success',to:{...option.point},duration,style:'dribble',fixed};
 }
 const challenger=c.players.find(p=>p.id===option.challenger!.id)!;
 const t=clamp(((challenger.x-carrier.x)*(option.point.x-carrier.x)+(challenger.y-carrier.y)*(option.point.y-carrier.y))/Math.max(1,length*length),.15,1);
 const contact=insidePitch({x:carrier.x+(option.point.x-carrier.x)*t,y:carrier.y+(option.point.y-carrier.y)*t});
 const contactDuration=Math.max(6,Math.round(duration*t));
 carrier.x=contact.x;carrier.y=contact.y;challenger.x=contact.x+(challenger.x>contact.x?.9:-.9);challenger.y=contact.y;fixed.add(challenger.id);
 c.ball={...contact};
 const foulChance=.24*(1.4-challenger.defending/100);
 if(random(c)<foulChance){
  const booked=c.booked??=[];const cardRoll=random(c);
  let kind:SimAction['kind']='foul',note='Foulspiel';
  if(cardRoll<.016){kind='red';note='Grobes Foulspiel';}
  else if(cardRoll<.3){if(booked.includes(challenger.id)){kind='red';note='Gelb-Rote Karte';}else{kind='yellow';note='Unsportliches Foulspiel';booked.push(challenger.id);}}
  if(kind==='red')challenger.active=false;
  const injured=carrier.side==='club'&&kind!=='red'&&random(c)<.045;
  if(injured){kind='injury';note='Muskelverletzung nach Foul';carrier.active=false;}
  const penalty=inBox(c,carrier.side,contact);
  const awarded=carrier.side,spot=penalty?{x:xFromProgress(c,awarded,PITCH.length-11),y:PITCH.goalY}:contact;
  const shooters=activeOf(c,awarded).filter(p=>roleOf(p)!=='keeper');
  const taker=penalty?shooters.sort((a,b)=>b.shooting-a.shooting)[0]:carrier.active?carrier:nearestTaker(c,awarded,spot);
  award(c,{setPiece:penalty?'penalty':'free-kick',side:awarded,ball:{...contact},spot,taker:taker??carrier});
  moveOffBall(c,taker??carrier,contactDuration/SIM_SECONDS_PER_VISUAL_SECOND,fixed);
  return {kind,outcome:'success',to:{...contact},duration:contactDuration,target:challenger,setPiece:penalty?'penalty':'free-kick',note,fixed};
 }
 c.owner=challenger.id;c.possession=challenger.side;c.lastPass=undefined;c.chain=0;
 moveOffBall(c,challenger,contactDuration/SIM_SECONDS_PER_VISUAL_SECOND,fixed);
 return {kind:'tackle',outcome:'lost',to:{...contact},duration:contactDuration,target:challenger,fixed};
}
function prepare(sim:InteractiveMatch,start:SimCheckpoint):SimAction {
 const before=structuredClone(start),c=structuredClone(start);
 let actor=activeOf(c).find(p=>p.id===c.owner)??activeOf(c,c.possession)[0];
 if(!actor)throw new Error('Kein aktiver Ballbesitzer');
 c.owner=actor.id;c.possession=actor.side;
 const boundary=c.time<2700?2700:c.time<5400?5400:7200,remaining=Math.max(1,boundary-c.time);
 let play:Play;
 if(c.restart)play=kickoffPlay(c,actor);
 else if(c.setPiece&&!c.setPieceReady)play=setPieceSetup(c,actor);
 else {
  const setPiece=c.setPiece&&c.setPieceReady?c.setPiece:undefined;
  const option=chooseOption(carrierOptions(c,actor,setPiece),decisionTemperature(actor),random(c));
  const planned=option.kind==='shot'?simSeconds(.25+dist(c.ball,attackedGoal(c,actor.side))/27):option.kind==='pass'?simSeconds(flightSeconds(option.distance,option.style)):option.kind==='carry'?simSeconds(dist(actor,option.point)/(runSpeed(actor)*.85)+.15):simSeconds(1);
  if(planned>remaining){
   // Too little time before the whistle for this play: the carrier shields the ball instead.
   const fixed=new Set([actor.id]);moveOffBall(c,actor,remaining/SIM_SECONDS_PER_VISUAL_SECOND,fixed);
   play={kind:'carry',outcome:'success',to:point(actor),duration:remaining,style:'hold',fixed};
  } else if(option.kind==='shot')play=resolveShot(c,actor,option.quality,setPiece==='penalty');
  else if(option.kind==='pass')play=resolvePass(c,actor,option);
  else if(option.kind==='carry')play=resolveCarry(c,actor,option,remaining);
  else {const fixed=new Set([actor.id]);c.setPiece=undefined;c.setPieceReady=false;c.setPieceSpot=undefined;moveOffBall(c,actor,1,fixed);play={kind:'carry',outcome:'success',to:point(actor),duration:simSeconds(1),style:'hold',fixed};}
 }
 const duration=Math.max(1,Math.min(play.duration,remaining));
 fatigue(c,play.celebration?Math.min(duration,18):duration,play.fixed);
 // Possession and ball always end where the play put them: the next play starts from here.
 c.ball={x:clamp(play.to.x,0,PITCH.length),y:clamp(play.to.y,0,PITCH.width)};
 const id=`${sim.id}:a${c.sequence++}`,end=c.time+duration;c.time=end;
 if(!activeOf(c).some(p=>p.id===c.owner))c.owner=(activeOf(c,c.possession).find(p=>roleOf(p)!=='keeper')??activeOf(c)[0]).id;
 actor=before.players.find(p=>p.id===actor.id)??actor;
 return {id,kind:play.kind,start:before.time,end,side:actor.side,actor:actor.id,target:play.target?.id,from:point(before.ball),to:point(c.ball),outcome:play.outcome,assist:play.assist,style:play.style,setPiece:play.setPiece,note:play.offsideId?`offside:${play.offsideId}`:play.note,before,after:c};
}
export function refill(sim:InteractiveMatch){let tail=sim.buffer.at(-1)?.after??sim.committed;while(tail.time<Math.min(sim.time+75,sim.time<2700?2700:sim.time<5400?5400:7200)){const action=prepare(sim,tail);sim.buffer.push(action);tail=action.after;}}
export function advanceInteractive(cup:CupState,now:number):CupState {
 const next=structuredClone(cup),sim=next.simulation!;
 if(sim.status!=='running'||next.matchPaused)return next;
 const limit=next.phase==='extra-time'?7200:5400,secondsPerMs=5400/getCupRegularDurationMs(next);
 const target=Math.max(sim.time,Math.min(limit,(Math.min(now,next.matchEndsAt)-next.matchStartedAt)*secondsPerMs));
 next.broadcast??=createMatchBroadcast(next);
 for(let guard=0;guard<1000;guard++){
  refill(sim);const a=sim.buffer[0];if(!a||a.end>target)break;
  sim.buffer.shift();sim.committed=a.after;sim.time=a.end;sim.recent.push(a);sim.recent=sim.recent.slice(-12);
  const at=next.matchStartedAt+a.end/secondsPerMs,minute=Math.max(1,Math.min(120,Math.ceil(a.end/60))),actor=a.before.players.find(p=>p.id===a.actor)!;
  const stats=a.side==='club'?next.broadcast.clubStats:next.broadcast.opponentStats,other=a.side==='club'?next.broadcast.opponentStats:next.broadcast.clubStats;
  stats.possessionSeconds+=(a.kind==='restart'?Math.min(a.end-a.start,18):a.end-a.start)/15;
  if(a.kind==='shot'){
   stats.shots++;if(a.outcome==='goal'||a.outcome==='save')stats.onTarget++;if(a.outcome==='save')other.saves++;
   if(a.outcome==='goal'){
    if(a.side==='club')next.homeScore++;else next.awayScore++;
    const assist=a.assist?a.before.players.find(p=>p.id===a.assist&&p.active&&p.side===a.side):undefined;
    const ratingImpacts:Record<string,number>=a.side==='club'?{[actor.id]:.7,...(assist?{[assist.id]:.25}:{})}:{};
    const goal={id:a.id,side:a.side==='club'?'home' as const:'away' as const,scorerId:actor.id,scorer:actor.name,minute,createdAt:at,homeScore:next.homeScore,awayScore:next.awayScore,ratingImpacts,assistId:assist?.id??null,assistName:assist?.name,pattern:'low-shot' as const};
    next.matchEvents.push(goal);next.lastGoal=goal;if(a.side==='club')next.allTimeScorers[actor.id]=(next.allTimeScorers[actor.id]??0)+1;
   }else next.broadcast.events.push({id:a.id,kind:'shot',side:a.side,minute,at,playerId:actor.id,player:actor.name,outcome:a.outcome as 'save'|'wide'|'blocked',keeperId:a.outcome==='save'?a.target:undefined,style:'ground',lane:a.to.y,seed:0});
  }
  // Fouls and cards: the actor is the fouled carrier, the target the offender.
  const offender=a.target?a.before.players.find(p=>p.id===a.target):undefined;
  if(offender&&(a.kind==='yellow'||(a.kind==='red'&&a.note==='Gelb-Rote Karte'))){
   const own=offender.side==='club'?next.broadcast.clubStats:next.broadcast.opponentStats;own.yellowCards++;
   next.broadcast.events.push({id:a.kind==='yellow'?a.id:`${a.id}:second-yellow`,kind:'yellow',side:offender.side,minute,at,playerId:offender.id,player:offender.name,style:'ground',lane:offender.y,seed:0});
  }
  if(offender&&a.kind==='red'){
   next.cardEvents.push({id:a.id,side:offender.side==='club'?'home':'away',playerId:offender.id,player:offender.name,reason:a.note??'Grobes Foulspiel',card:'red',minute,createdAt:at,homeScore:next.homeScore,awayScore:next.awayScore});
   if(offender.side==='club'){next.sentOffPlayerIds.push(offender.id);next.suspendedPlayerIds.push(offender.id);next.playerExitedAt[offender.id]=minute;}
  }
  // Dead balls for the side that restarts the game.
  if(a.setPiece&&a.kind!=='restart'){
   const awarded=a.after.possession,taker=a.after.players.find(p=>p.id===a.after.owner),own=awarded==='club'?next.broadcast.clubStats:next.broadcast.opponentStats;
   const offsideId=a.note?.startsWith('offside:')?a.note.slice(8):undefined,offsidePlayer=offsideId?a.before.players.find(p=>p.id===offsideId):undefined;
   if(offsidePlayer){const offending=offsidePlayer.side==='club'?next.broadcast.clubStats:next.broadcast.opponentStats;offending.offsides=(offending.offsides??0)+1;next.broadcast.events.push({id:`${a.id}:offside`,kind:'offside',side:offsidePlayer.side,minute,at,playerId:offsidePlayer.id,player:offsidePlayer.name,style:'through',lane:offsidePlayer.y,seed:0});}
   else if(taker&&a.setPiece==='corner'){own.corners++;next.broadcast.events.push({id:`${a.id}:corner`,kind:'corner',side:awarded,minute,at,playerId:taker.id,player:taker.name,style:'cross',lane:a.to.y,seed:0});}
   else if(taker&&(a.setPiece==='free-kick'||a.setPiece==='penalty')){own.freeKicks++;next.broadcast.events.push({id:`${a.id}:free-kick`,kind:'free-kick',side:awarded,minute,at,playerId:taker.id,player:taker.name,style:a.setPiece==='penalty'?'penalty':'ground',lane:a.to.y,seed:0});}
   else if(a.setPiece==='throw-in')own.throwIns++;
  }
  if(a.kind==='injury'){
   const injury={id:a.id,playerId:actor.id,player:actor.name,reason:'Muskelverletzung',matches:1+(sim.committed.rng%3),minute,createdAt:at,homeScore:next.homeScore,awayScore:next.awayScore};
   next.injuryEvents.push(injury);next.lastInjury=injury;next.injuredPlayerIds[actor.id]=injury.matches;next.playerExitedAt[actor.id]=minute;
   sim.status='editing';next.matchPaused=true;next.lastResult=`${actor.name} ist verletzt. Wechsel prüfen oder ohne Ersatz weiterspielen.`;sim.buffer=[];
  }
  next.broadcast.fitness=Object.fromEntries(sim.committed.players.map(p=>[p.id,p.fitness]));next.broadcast.fitnessMinute=minute;
  if(a.end===2700&&!sim.halftimeDone){sim.halftimeDone=true;sim.status='halftime';
   // Copy first: the finished play keeps its own end state, the second half starts from a new one.
   sim.committed=structuredClone(sim.committed);
   for(const p of sim.committed.players){p.anchor={x:105-p.anchor.x,y:68-p.anchor.y};}sim.committed.direction*=-1;kickoff(sim.committed,'opponent');sim.buffer=[];
   next.matchPaused=true;next.lastResult='Halbzeit. Wechsel prüfen, danach weiterspielen.';break;
  }
  if(next.matchPaused)break;
  if(sim.pauseRequested){sim.pauseRequested=false;sim.status='editing';next.matchPaused=true;sim.buffer=[];break;}
 }
 if(!next.matchPaused)sim.time=target;
 next.lastTickAt=next.matchStartedAt+sim.time/secondsPerMs;
 refill(sim);return next;
}
export function invalidateInteractive(cup:CupState){if(cup.simulation){cup.simulation.buffer=[];cup.simulation.generation++;refill(cup.simulation);}return cup;}
export function resumeInteractive(cup:CupState){if(cup.simulation){cup.simulation.status='running';cup.simulation.pauseRequested=false;invalidateInteractive(cup);}return cup;}
export function normalizeInteractive(value:unknown):InteractiveMatch|undefined {
 if(!value||typeof value!=='object')return undefined;const s=value as InteractiveMatch;
 const validPoint=(p:SimPoint)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=105&&p.y>=0&&p.y<=68;
 if(s.version!==2||typeof s.id!=='string'||!Number.isFinite(s.seed)||!Number.isFinite(s.time)||s.time<0||s.time>7200||!s.committed||!Number.isFinite(s.committed.rng)||!Number.isFinite(s.committed.sequence)||!Number.isFinite(s.committed.time)||s.committed.time>s.time||!validPoint(s.committed.ball)||!Array.isArray(s.committed.players)||s.committed.players.length>22||s.committed.players.length<2||!['running','editing','halftime','completed'].includes(s.status))return undefined;
 const ids=new Set();for(const p of s.committed.players){if(!p||typeof p.id!=='string'||ids.has(p.id)||!validPoint(p)||!validPoint(p.anchor)||!Number.isInteger(p.slot)||p.slot<0||p.slot>10||!['club','opponent'].includes(p.side)||![p.rating,p.fitness,p.passing,p.shooting,p.pace,p.defending,p.keeping,p.control,p.stamina].every(Number.isFinite))return undefined;ids.add(p.id);}
 if(!s.committed.players.some(p=>p.id===s.committed.owner&&p.active))return undefined;
 const SET_PIECES=['throw-in','goal-kick','corner','free-kick','penalty'];
 if(s.committed.setPiece!==undefined&&!SET_PIECES.includes(s.committed.setPiece)){delete s.committed.setPiece;delete s.committed.setPieceReady;delete s.committed.setPieceSpot;}
 if(s.committed.setPieceSpot!==undefined&&!validPoint(s.committed.setPieceSpot))delete s.committed.setPieceSpot;
 if(s.committed.booked!==undefined&&(!Array.isArray(s.committed.booked)||!s.committed.booked.every(id=>typeof id==='string')))s.committed.booked=[];
 // Speculation is rebuilt from the committed RNG checkpoint. Never accept saved prepared outcomes.
 const validCheckpoint=(c:SimCheckpoint)=>c&&Number.isFinite(c.time)&&validPoint(c.ball)&&Array.isArray(c.players)&&c.players.length<=22&&c.players.every(p=>p&&typeof p.id==='string'&&validPoint(p));
 const recent=(Array.isArray(s.recent)?s.recent:[]).slice(-12).filter(a=>a&&typeof a.id==='string'&&Number.isFinite(a.start)&&Number.isFinite(a.end)&&a.start>=0&&a.start<a.end&&a.end<=s.committed.time&&validPoint(a.from)&&validPoint(a.to)&&validCheckpoint(a.before)&&validCheckpoint(a.after)&&a.before.time===a.start&&a.after.time===a.end);
 const result={...s,buffer:[],recent,generation:Number(s.generation)||0};
 delete (result as InteractiveMatch & {quick?:boolean}).quick; // Migrate the removed public fast-forward mode.
 refill(result);return result;
}
export function interactiveFrame(cup:CupState,now:number) {
 const s=cup.simulation!,scale=5400/getCupRegularDurationMs(cup),earliest=s.recent[0]?.start??s.committed.time,latest=cup.matchPaused||!cup.active?s.time:s.buffer.at(-1)?.end??s.time;
 const time=clamp((now-cup.matchStartedAt)*scale,earliest,latest);
 return readInteractiveFrame(s,time);
}
