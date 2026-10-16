import { readInteractiveFrame } from './interactive-frame-data';
import { getStarFormation, getStarXIPlayer, getCupRegularDurationMs, RED_CARD_CHANCE_PER_SECOND, CUP_INJURY_CHANCE_PER_SECOND } from './feature-data';
import type { CupState, CupStrategyId, StarPosition, StarXIPlayer } from './feature-data';
import { createMatchBroadcast } from './match-broadcast';

export type SimPoint = { x:number; y:number };
export type SimPlayer = SimPoint & { id:string; name:string; role:StarPosition; slot:number; side:'club'|'opponent'; number:number; rating:number; passing:number; shooting:number; pace:number; defending:number; keeping:number; control:number; stamina:number; fitness:number; active:boolean; anchor:SimPoint };
export type SimCheckpoint = { time:number; rng:number; sequence:number; players:SimPlayer[]; ball:SimPoint; owner:string; possession:'club'|'opponent'; lastPass?:{id:string;to:string;time:number}; chain:number; restart:boolean; direction:number };
export type SimAction = { id:string; kind:'pass'|'carry'|'cross'|'interception'|'tackle'|'shot'|'restart'|'red'|'yellow'|'injury'; start:number; end:number; side:'club'|'opponent'; actor:string; target?:string; from:SimPoint; to:SimPoint; outcome:'success'|'lost'|'save'|'wide'|'blocked'|'goal'; assist?:string; before:SimCheckpoint; after:SimCheckpoint };
export type InteractiveMatch = { version:2; id:string; seed:number; time:number; committed:SimCheckpoint; buffer:SimAction[]; recent:SimAction[]; generation:number; status:'running'|'editing'|'halftime'|'completed'; halftimeDone:boolean; pauseRequested:boolean; clubFormation:string; opponentFormation:string; strategy:CupStrategyId; opponentStrategy:CupStrategyId };
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const dist=(a:SimPoint,b:SimPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=(p:SimPoint):SimPoint=>({x:p.x,y:p.y});
/** Game seconds between a goal and the following kickoff (about three real seconds in a league match). */
export const GOAL_CELEBRATION_SECONDS=90;
function seedHash(s:string){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0||1;}
function random(c:SimCheckpoint){let n=c.rng;n^=n<<13;n^=n>>>17;n^=n<<5;c.rng=n>>>0||1;return c.rng/4294967296;}
function attribute(p:StarXIPlayer|undefined,key:string,fallback:number){const stats=p?.originalAttributes?.stats as Record<string,{value:number}>|undefined;const n=stats?.[key]?.value;return clamp(typeof n==='number'&&Number.isFinite(n)?n:fallback,1,99);}
function player(id:string,name:string,role:StarPosition,slot:number,side:SimPlayer['side'],number:number,rating:number,source:StarXIPlayer|undefined,formation:string,direction:number,bonus=0):SimPlayer {
 const s=getStarFormation(formation).slots[slot];const x=role==='TW'?3:12+(100-s.y)*.68,y=role==='TW'?34:5+s.x*.58;
 const right=(side==='club'?direction:-direction)>0,anchor={x:right?x:105-x,y:right?y:68-y};
 const base=clamp(rating+bonus*3,1,99);
 return {id,name,role,slot,side,number,rating:base,passing:attribute(source,'shortPassing',base),shooting:attribute(source,'finishing',base),pace:attribute(source,'sprintSpeed',base),defending:attribute(source,'standingTackle',base),keeping:attribute(source,'gkReflexes',base),control:attribute(source,'dribbling',base),stamina:attribute(source,'stamina',base),fitness:100,active:true,anchor,...anchor};
}
function kickoff(c:SimCheckpoint,side:SimPlayer['side']) {
 c.possession=side;c.lastPass=undefined;c.chain=0;c.ball={x:52.5,y:34};c.restart=true;
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
function movePlayers(c:SimCheckpoint,duration:number,strategy:CupStrategyId,opponentStrategy:CupStrategyId,actor:SimPlayer,target?:SimPlayer) {
 const old=c.players.map(p=>({...p}));
 for(const p of c.players){if(!p.active)continue;const right=(p.side==='club'?c.direction:-c.direction),own=p.side===c.possession,tactic=p.side==='club'?strategy:opponentStrategy;
  let x=p.anchor.x+(own?right*(tactic==='angriff'?12:7):right*-7)+(c.ball.x-52.5)*.27,y=p.anchor.y+(c.ball.y-34)*.24;
  if(p.role==='TW'){x=right>0?3+clamp(c.ball.x/25,0,3):102-clamp((105-c.ball.x)/25,0,3);y=34+(c.ball.y-34)*.12;}
  else if(p.id===actor.id||p.id===target?.id){x=p.x;y=p.y;}
  else if(!own&&dist(p,c.ball)<16){x=(x+c.ball.x)/2;y=(y+c.ball.y)/2;}
  for(const q of old){if(!q.active||q.id===p.id)continue;const d=dist(p,q);if(d>0&&d<4){x+=(p.x-q.x)/d*(4-d);y+=(p.y-q.y)/d*(4-d);}}
  const d=Math.hypot(x-p.x,y-p.y),step=Math.min(d,duration*(.17+p.pace*.002)*(p.role==='TW'?.5:1));
  if(d){p.x=clamp(p.x+(x-p.x)/d*step,1.5,103.5);p.y=clamp(p.y+(y-p.y)/d*step,1.5,66.5);}
  p.fitness=clamp(p.fitness-duration/60*(p.role==='TW'?.13:tactic==='angriff'?.52:.39)*clamp(1+(70-p.stamina)/200,.85,1.35),15,100);
 }
}
function prepare(sim:InteractiveMatch,start:SimCheckpoint):SimAction {
 const before=structuredClone(start),c=structuredClone(start);const active=c.players.filter(p=>p.active);
 let actor=active.find(p=>p.id===c.owner)??active.find(p=>p.side===c.possession)!;
 if(!actor)throw new Error('Kein aktiver Ballbesitzer');
 c.owner=actor.id;c.possession=actor.side;
 const right=(actor.side==='club'?c.direction:-c.direction),progress=right>0?actor.x:105-actor.x,goal={x:right>0?105:0,y:34};
 const tactic=actor.side==='club'?sim.strategy:sim.opponentStrategy;
 const rivals=active.filter(p=>p.side!==actor.side),mates=active.filter(p=>p.side===actor.side&&p.id!==actor.id);
 const pressure=rivals.reduce((n,p)=>n+Math.max(0,1-dist(p,actor)/14),0);
 let kind:SimAction['kind']='pass',outcome:SimAction['outcome']='success',target:SimPlayer|undefined,to=point(actor),assist:string|undefined,celebration=false;
 let duration=18+Math.floor(random(c)*18);
 const roll=random(c);
 if(c.restart){
  kind='restart';duration=18;
  // After a goal the ball lies in the net: allow a realistic celebration before the kickoff.
  if(dist(c.ball,{x:52.5,y:34})>35){duration=GOAL_CELEBRATION_SECONDS;celebration=true;kickoff(c,c.possession);actor=c.players.find(p=>p.id===c.owner)!;to={x:52.5,y:34};}
  else {target=mates.filter(p=>p.role!=='TW').sort((a,b)=>dist(a,actor)-dist(b,actor))[0];to=target?point(target):point(actor);}
  c.restart=false;
 }
 else if(actor.role!=='TW'&&progress>68&&roll<clamp((progress-65)/60+(tactic==='angriff'?.08:0)+c.chain*.009,.06,.6)) {
  kind='shot';duration=12;const keeper=rivals.find(p=>p.role==='TW');
  const distance=dist(actor,goal),angle=clamp(1-Math.abs(actor.y-34)/35,.15,1),quality=clamp((.52-distance*.009)*angle*(.5+actor.shooting/100)*(1-pressure*.12)*(.75+actor.fitness/400)*(1+(actor.rating-(keeper?.keeping??70))*.009),.018,.55);
  const shot=random(c);outcome=shot<quality?'goal':shot<quality+.38?'save':shot<quality+.62?'blocked':'wide';
  to={x:right>0?104:1,y:outcome==='wide'?clamp(21+random(c)*26,20,48):30.5+random(c)*7};
  if(outcome==='goal'&&c.lastPass?.to===actor.id&&c.time-c.lastPass.time<=70&&c.lastPass.id!==actor.id)assist=c.lastPass.id;
  target=outcome==='save'?keeper:choose(c,rivals,p=>p.role==='TW'?3:1/(1+dist(p,goal)));
 } else if(actor.role!=='TW'&&pressure>.5&&roll<.13){kind='tackle';outcome='lost';target=choose(c,rivals,p=>p.defending/(3+dist(p,actor)));to=point(actor);}
 else if(actor.role!=='TW'&&roll<.35){kind='carry';to={x:clamp(actor.x+right*(5+random(c)*10),3,102),y:clamp(actor.y+(random(c)-.5)*12,3,65)};outcome=random(c)<clamp(.04+pressure*.09+(70-actor.control)*.002,.015,.3)?'lost':'success';if(outcome==='lost')target=choose(c,rivals,p=>p.defending/(4+dist(p,to)));}
 else {
  target=choose(c,mates,p=>{const forward=(p.x-actor.x)*right;const d=dist(p,actor),near=rivals.reduce((n,q)=>n+Math.max(0,1-dist(p,q)/12),0);return (p.role==='TW'?.12:1)*Math.exp(clamp(forward*(tactic==='konter'?.055:tactic==='angriff'?.045:.018),-2,2))*(1+Math.abs(p.y-actor.y)*.015)/(1+d*.018+near);});
  if(!target){kind='carry';to={x:clamp(actor.x+right*8,3,102),y:actor.y};}else{
   to=point(target);if(progress>72&&Math.abs(actor.y-34)>15&&(target.x-actor.x)*right>-8){kind='cross';}
   const defensiveSkill=rivals.reduce((n,p)=>n+p.defending,0)/Math.max(1,rivals.length);
   const d=dist(actor,to);const lane=rivals.filter(p=>dist(p,actor)+dist(p,to)<d+3).length;
   if(random(c)>clamp(.91+(actor.passing-70)*.003-d*.002-lane*.06-pressure*.04-(defensiveSkill-70)*.001,.48,.96)){kind='interception';outcome='lost';target=choose(c,rivals,p=>p.defending/(3+dist(p,to)));to=point(target);}
  }
 }
 // Rare red cards belong to the same action stream; the carrier is removed only on commitment.
 const hazard=random(c);
 if(kind!=='restart'&&actor.role!=='TW'&&hazard<duration*RED_CARD_CHANCE_PER_SECOND/30){kind='red';outcome='lost';target=choose(c,rivals,p=>1/(3+dist(p,actor)));to=point(actor);}
 else if(kind!=='restart'&&actor.side==='club'&&actor.role!=='TW'&&hazard<duration*(RED_CARD_CHANCE_PER_SECOND+2*CUP_INJURY_CHANCE_PER_SECOND)/30){kind='injury';outcome='lost';target=choose(c,rivals,p=>1/(3+dist(p,actor)));to=point(actor);}
 else if(kind==='tackle'&&hazard<.18){kind='yellow';}

 const boundary=c.time<2700?2700:c.time<5400?5400:7200;duration=Math.max(1,Math.min(duration,boundary-c.time));
 const id=`${sim.id}:a${c.sequence++}`,end=c.time+duration;
 // The celebration only adds clock time: movement and fitness stay those of a normal 18 second restart.
 movePlayers(c,celebration?Math.min(duration,18):duration,sim.strategy,sim.opponentStrategy,actor,target);
 const liveActor=c.players.find(p=>p.id===actor.id)!;
 if(kind==='carry'){liveActor.x=to.x;liveActor.y=to.y;}
 c.ball=to;c.time=end;c.chain++;
 if(kind==='shot'){
  c.lastPass=undefined;c.chain=0;
  if(outcome==='goal'){c.possession=actor.side==='club'?'opponent':'club';c.owner=target?.id??rivals[0].id;c.restart=true;}
  else {c.owner=target?.id??rivals[0].id;c.possession=target?.side??rivals[0].side;c.ball=point(target??rivals[0]);}
 }else if(outcome==='lost'){
  if(['tackle','red','yellow','injury'].includes(kind)){target!.x=to.x;target!.y=to.y;}
  c.ball=point(target!);c.owner=target!.id;c.possession=target!.side;c.lastPass=undefined;c.chain=0;
  if(kind==='red'||kind==='injury')liveActor.active=false;
 }else if(target){c.owner=target.id;c.lastPass={id:actor.id,to:target.id,time:end};}else{c.owner=actor.id;c.lastPass=undefined;}
 return {id,kind,start:before.time,end,side:actor.side,actor:actor.id,target:target?.id,from:point(before.ball),to,outcome,assist,before,after:c};
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
  if(a.kind==='red'){
   next.cardEvents.push({id:a.id,side:a.side==='club'?'home':'away',playerId:actor.id,player:actor.name,reason:'Grobe Unsportlichkeit',card:'red',minute,createdAt:at,homeScore:next.homeScore,awayScore:next.awayScore});
   if(a.side==='club'){next.sentOffPlayerIds.push(actor.id);next.suspendedPlayerIds.push(actor.id);next.playerExitedAt[actor.id]=minute;}
  }
  if(a.kind==='yellow'){stats.yellowCards++;next.broadcast.events.push({id:a.id,kind:'yellow',side:a.side,minute,at,playerId:actor.id,player:actor.name,style:'ground',lane:actor.y,seed:0});}
  if(a.kind==='injury'){
   const injury={id:a.id,playerId:actor.id,player:actor.name,reason:'Muskelverletzung',matches:1+(sim.committed.rng%3),minute,createdAt:at,homeScore:next.homeScore,awayScore:next.awayScore};
   next.injuryEvents.push(injury);next.lastInjury=injury;next.injuredPlayerIds[actor.id]=injury.matches;next.playerExitedAt[actor.id]=minute;
   sim.status='editing';next.matchPaused=true;next.lastResult=`${actor.name} ist verletzt. Wechsel prüfen oder ohne Ersatz weiterspielen.`;sim.buffer=[];
  }
  next.broadcast.fitness=Object.fromEntries(sim.committed.players.map(p=>[p.id,p.fitness]));next.broadcast.fitnessMinute=minute;
  if(a.end===2700&&!sim.halftimeDone){sim.halftimeDone=true;sim.status='halftime';
   for(const p of sim.committed.players){p.anchor={x:105-p.anchor.x,y:68-p.anchor.y};}sim.committed.direction*=-1;kickoff(sim.committed,'opponent');sim.buffer=[];
   next.matchPaused=true;next.lastResult='Halbzeit. Taktik und Wechsel prüfen, danach weiterspielen.';break;
  }
  if(next.matchPaused)break;
  if(sim.pauseRequested){sim.pauseRequested=false;sim.status='editing';next.matchPaused=true;sim.buffer=[];break;}
 }
 if(!next.matchPaused)sim.time=target;
 next.lastTickAt=next.matchStartedAt+sim.time/secondsPerMs;
 refill(sim);return next;
}
export function invalidateInteractive(cup:CupState){if(cup.simulation){cup.simulation.buffer=[];cup.simulation.generation++;cup.simulation.strategy=cup.strategyId;refill(cup.simulation);}return cup;}
export function resumeInteractive(cup:CupState){if(cup.simulation){cup.simulation.status='running';cup.simulation.pauseRequested=false;invalidateInteractive(cup);}return cup;}
export function normalizeInteractive(value:unknown):InteractiveMatch|undefined {
 if(!value||typeof value!=='object')return undefined;const s=value as InteractiveMatch;
 const validPoint=(p:SimPoint)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=105&&p.y>=0&&p.y<=68;
 if(s.version!==2||typeof s.id!=='string'||!Number.isFinite(s.seed)||!Number.isFinite(s.time)||s.time<0||s.time>7200||!s.committed||!Number.isFinite(s.committed.rng)||!Number.isFinite(s.committed.sequence)||!Number.isFinite(s.committed.time)||s.committed.time>s.time||!validPoint(s.committed.ball)||!Array.isArray(s.committed.players)||s.committed.players.length>22||s.committed.players.length<2||!['running','editing','halftime','completed'].includes(s.status))return undefined;
 const ids=new Set();for(const p of s.committed.players){if(!p||typeof p.id!=='string'||ids.has(p.id)||!validPoint(p)||!validPoint(p.anchor)||!Number.isInteger(p.slot)||p.slot<0||p.slot>10||!['club','opponent'].includes(p.side)||![p.rating,p.fitness,p.passing,p.shooting,p.pace,p.defending,p.keeping,p.control,p.stamina].every(Number.isFinite))return undefined;ids.add(p.id);}
 if(!s.committed.players.some(p=>p.id===s.committed.owner&&p.active))return undefined;
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
