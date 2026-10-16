import { getCupMatchMinute, getCupRegularDurationMs, getStarFormation, getStarXIPlayer, STAR_XI_PLAYERS, STAR_FORMATIONS } from './feature-data';
import type { CupState, StarPosition, StarXIPlayer } from './feature-data';

export type GoalPattern = 'one-on-one'|'low-shot'|'long-range'|'header'|'cross'|'rebound'|'corner'|'free-kick'|'penalty';
export function chooseGoalPattern(id:string,role:StarPosition):GoalPattern {
 const patterns:GoalPattern[]=role==='IV'?['header','corner']:role==='ZDM'||role==='ZM'||role==='ZOM'?['long-range','low-shot','free-kick','rebound']:['one-on-one','cross','low-shot','rebound','header','penalty'];
 return patterns[Math.floor(broadcastSeed(id)*patterns.length)];
}
export type BroadcastSide = 'club' | 'opponent';
export type BroadcastKind = 'build-up' | 'counter' | 'wide' | 'combination' | 'shot' | 'corner' | 'free-kick' | 'throw-in' | 'yellow' | 'substitution';
export type ShotOutcome = 'save' | 'wide' | 'blocked';
export type MatchRosterPlayer = { id:string; sourceId:string; name:string; position:StarPosition; number:number; rating:number; slot:number };
export type BroadcastEvent = { id:string; kind:BroadcastKind; side:BroadcastSide; minute:number; at:number; playerId:string; player:string; secondaryId?:string; keeperId?:string; outcome?:ShotOutcome; style:'ground'|'lofted'|'through'|'cross'|'header'|'long-range'|'one-touch'|'penalty'|'clearance'; lane:number; seed:number };
export type BroadcastStatistics = { shots:number; onTarget:number; saves:number; corners:number; freeKicks:number; throwIns:number; yellowCards:number; possessionSeconds:number };
export type MatchBroadcast = { version:1; clubFormation:string; opponentFormation:string; opponentXI:MatchRosterPlayer[]; slots:Record<string,number>; shirtNumbers:Record<string,number>; fitness:Record<string,number>; fitnessMinute:number; events:BroadcastEvent[]; processedScene:number; possessionSecond:number; clubStats:BroadcastStatistics; opponentStats:BroadcastStatistics };
export const emptyMatchStats = ():BroadcastStatistics=>({shots:0,onTarget:0,saves:0,corners:0,freeKicks:0,throwIns:0,yellowCards:0,possessionSeconds:0});
export const broadcastSeed=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return ((h^(h>>>16))>>>0)/4294967296;};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

const rosterCache=new Map<string,{formation:string;players:MatchRosterPlayer[]}>();

// Goal Clicker clubs are fictional game clubs. Generate their game XI from existing card data;
// this is never presented as a real-world club roster or used to override team strength.
export function createMatchBroadcast(cup:CupState):MatchBroadcast {
 const seed=cup.careerMatchId??`${cup.careerRatingSeed??cup.matchStartedAt}:${cup.opponent}`;
 const formation=STAR_FORMATIONS[Math.floor(broadcastSeed(seed+':formation')*STAR_FORMATIONS.length)];
 const cached=rosterCache.get(seed+':'+cup.opponentRating);
 const used=new Set<string>();
 const opponentXI=cached?cached.players.map(p=>({...p})):formation.slots.map((slot,i)=>{
  const candidates=STAR_XI_PLAYERS.filter(p=>!p.isCustom && p.positions.includes(slot.position)&&!used.has(p.id)).sort((a,b)=>Math.abs(a.rating-cup.opponentRating)-Math.abs(b.rating-cup.opponentRating)||a.id.localeCompare(b.id)).slice(0,12);
  const player=candidates[Math.floor(broadcastSeed(seed+':player:'+i)*candidates.length)]??STAR_XI_PLAYERS.find(p=>p.positions.includes(slot.position)&&!used.has(p.id))!;
  used.add(player.id);
  return {id:`opponent-${i}`,sourceId:player.id,name:player.name,position:slot.position,number:i+1,rating:player.rating,slot:i};
 });
 if(!cached){if(rosterCache.size>=32)rosterCache.delete(rosterCache.keys().next().value!);rosterCache.set(seed+':'+cup.opponentRating,{formation:formation.id,players:opponentXI.map(p=>({...p}))});}
 const original=cup.originalLineupIds.length?cup.originalLineupIds:Object.keys(cup.playerEnteredAt);
 const roles=original.map(id=>cup.playerMatchPositions[id]);
 const clubFormation=STAR_FORMATIONS.find(f=>roles.length===11&&f.slots.every((s,i)=>s.position===roles[i]))?.id??'433';
 return {version:1,clubFormation,opponentFormation:formation.id,opponentXI,
  slots:Object.fromEntries(original.map((id,i)=>[id,i])),shirtNumbers:Object.fromEntries([...original,...cup.originalBenchIds].filter(Boolean).map((id,i)=>[id,i+1])),
  fitness:Object.fromEntries([...original,...opponentXI.map(p=>p.id)].filter(Boolean).map(id=>[id,100])),fitnessMinute:1,events:[],processedScene:0,possessionSecond:0,clubStats:emptyMatchStats(),opponentStats:emptyMatchStats()};
}
export function matchFitness(cup:CupState,id:string,minute:number) {
 const b=cup.broadcast;
 if(b?.fitness[id]!==undefined)return clamp(b.fitness[id],0,100);
 const role=cup.playerMatchPositions[id]??getStarXIPlayer(id)?.position??'ZM';
 const entered=cup.playerEnteredAt[id]??1, end=cup.playerExitedAt[id]??minute;
 return clamp(100-Math.max(0,Math.min(minute,end)-entered)*(role==='TW'?.13:.43),25,100);
}
export function addBroadcastSubstitution(cup:CupState,outgoing:string,incoming:string,minute:number):MatchBroadcast {
 const b=structuredClone(cup.broadcast??createMatchBroadcast(cup));
 b.slots[incoming]=b.slots[outgoing]??Math.max(0,cup.originalLineupIds.indexOf(outgoing));
 b.shirtNumbers[incoming]??=Math.max(11,...Object.values(b.shirtNumbers))+1;b.fitness[incoming]=100;
 const id=`sub:${cup.careerMatchId??cup.matchStartedAt}:${outgoing}:${incoming}:${minute}`;
 if(!b.events.some(e=>e.id===id))b.events.push({id,kind:'substitution',side:'club',minute,at:cup.matchStartedAt+(minute-1)*getCupRegularDurationMs(cup)/90,playerId:incoming,player:getStarXIPlayer(incoming)?.name??incoming,secondaryId:outgoing,style:'ground',lane:34,seed:broadcastSeed(id)});
 return b;
}
export function advanceMatchBroadcast(cup:CupState,clubPlayers:readonly StarXIPlayer[]):MatchBroadcast {
 const b=structuredClone(cup.broadcast??createMatchBroadcast(cup));
 const minute=getCupMatchMinute(cup,cup.lastTickAt),delta=Math.max(0,minute-b.fitnessMinute);
 const members=[...clubPlayers.map(p=>({id:p.id,role:cup.playerMatchPositions[p.id]??p.position,source:p})),...b.opponentXI.map(p=>({id:p.id,role:p.position,source:getStarXIPlayer(p.sourceId)}))];
 for(const p of members) {
  if((cup.playerExitedAt[p.id]??121)<=b.fitnessMinute||cup.sentOffPlayerIds.includes(p.id))continue;
  const entered=cup.playerEnteredAt[p.id]??1,end=cup.playerExitedAt[p.id]??minute;
  const playedDelta=Math.max(0,Math.min(minute,end)-Math.max(b.fitnessMinute,entered));
  const strategy='ballbesitz';
  const raw=p.source?.originalAttributes?.stats?.stamina?.value;
  const stamina=typeof raw==='number'?raw:p.source?.rating??70;
  const workload=(p.role==='TW'?.13:['LV','RV','LAV','RAV','LF','RF','LM','RM'].includes(p.role)?.49:.4)*(1+(70-stamina)/200);
  b.fitness[p.id]=clamp((b.fitness[p.id]??100)-playedDelta*workload,15,100);
 }
 b.fitnessMinute=Math.max(b.fitnessMinute,minute);
 const regular=getCupRegularDurationMs(cup),elapsed=Math.max(0,cup.lastTickAt-cup.matchStartedAt),sceneCount=Math.floor(elapsed/(regular/30));
 const seed=cup.careerMatchId??`${cup.careerRatingSeed??cup.matchStartedAt}:${cup.opponent}`;
 // The extra stream is deterministic and never consumes the scoring simulator's random source.
 for(let index=b.processedScene+1;index<=Math.min(sceneCount,40);index++) {
  const id=`action:${seed}:${index}`,roll=broadcastSeed(id),at=cup.matchStartedAt+index*(regular/30),m=getCupMatchMinute({...cup,matchPaused:false,active:true},at);
  const side:BroadcastSide=broadcastSeed(id+':team')<.5?'club':'opponent';
  const historyPlayers=Object.keys(cup.playerEnteredAt).map(id=>getStarXIPlayer(id)).filter((p):p is StarXIPlayer=>Boolean(p)).map(p=>({...p,position:cup.playerMatchPositions[p.id]??p.position}));
  const participants=side==='club'?(historyPlayers.length?historyPlayers:clubPlayers).filter(p=>(cup.playerEnteredAt[p.id]??1)<=m&&(cup.playerExitedAt[p.id]??121)>m&&!cup.cardEvents.some(e=>e.playerId===p.id&&e.minute<=m)):b.opponentXI.filter(p=>!cup.cardEvents.some(e=>e.side==='away'&&e.playerId===p.id&&e.minute<=m)).map(p=>({id:p.id,name:p.name,position:p.position}));
  if(!participants.length)continue;
  const primary:BroadcastKind=roll<.04?'corner':roll<.07?'free-kick':roll<.10?'throw-in':roll<.13?'yellow':roll<.4?'shot':roll<.60?'counter':roll<.72?'wide':roll<.86?'combination':'build-up';
  const attackers=participants.filter(p=>p.position!=='TW');
  const preferred=attackers.filter(p=>(primary==='corner'||primary==='wide'||primary==='throw-in')?['LF','RF','LM','RM','LV','RV','LAV','RAV'].includes(p.position ?? ''):(primary==='shot'||primary==='counter')?['ST','MS','ZOM','ZM','LF','RF'].includes(p.position ?? ''):primary==='free-kick'?['ZM','ZOM','LF','RF'].includes(p.position ?? ''):true);
  const selection=preferred.length?preferred:attackers;
  const player=selection[Math.floor(broadcastSeed(id+':player')*selection.length)]??participants[0];
  const stats=side==='club'?b.clubStats:b.opponentStats;
  if(primary==='yellow'&&b.events.filter(e=>e.kind==='yellow'&&e.playerId===player.id).length>=2)continue;
  let outcome:ShotOutcome=broadcastSeed(id+':shot')<.6?'save':broadcastSeed(id+':shot')<.88?'wide':'blocked';
  const shooting=primary==='shot'||primary==='corner'||primary==='free-kick';
  const keeper=side==='club'?b.opponentXI.find(p=>p.position==='TW'):historyPlayers.find(p=>p.position==='TW'&&(cup.playerEnteredAt[p.id]??1)<=m&&(cup.playerExitedAt[p.id]??121)>m);
  if(outcome==='save'&&!keeper)outcome='blocked';
  const event:BroadcastEvent={id,kind:primary,side,minute:m,at,playerId:player.id,player:player.name,style:primary==='corner'?'header':primary==='wide'?'cross':primary==='counter'?'through':primary==='free-kick'?'lofted':primary==='shot'?'long-range':primary==='combination'?'one-touch':'ground',lane:24+broadcastSeed(id+':lane')*20,seed:roll,...(shooting?{outcome,keeperId:keeper?.id}:{})};
  b.events.push(event);
  if(primary==='corner')stats.corners++;if(primary==='free-kick')stats.freeKicks++;if(primary==='throw-in')stats.throwIns++;if(primary==='yellow')stats.yellowCards++;
  if(shooting){stats.shots++;if(outcome==='save'){stats.onTarget++;(side==='club'?b.opponentStats:b.clubStats).saves++;}}
 }
 b.processedScene=Math.max(b.processedScene,Math.min(sceneCount,40));
 // Use the same chronological action ownership as the presentation, independent of FPS.
 const seconds=Math.floor(elapsed/1000);
 for(let second=b.possessionSecond??0;second<seconds;second++){
  const time=cup.matchStartedAt+second*1000;
  const action=b.events.filter(e=>e.at<=time&&time-e.at<regular/240&&e.kind!=='yellow'&&e.kind!=='substitution').at(-1);
  let side=action?.side??(Math.floor(second/(regular/30000))%2===0?'club':'opponent');
  if(action?.outcome&&action.outcome!=='wide'&&time-action.at>regular/360)side=side==='club'?'opponent':'club';
  (side==='club'?b.clubStats:b.opponentStats).possessionSeconds++;
 }
 b.possessionSecond=Math.max(b.possessionSecond??0,seconds);
 b.events=b.events.slice(-180);
 void delta;
 return b;
}
export function normalizeMatchBroadcast(value:unknown):MatchBroadcast|undefined {
 if(!value||typeof value!=='object')return undefined;
 const v=value as MatchBroadcast;
 if(v.version!==1||!Array.isArray(v.opponentXI)||v.opponentXI.length!==11||!STAR_FORMATIONS.some(f=>f.id===v.opponentFormation))return undefined;
 if(!v.opponentXI.every((p,i)=>p&&typeof p.name==='string'&&p.id===`opponent-${i}`&&getStarXIPlayer(p.sourceId)&&Number.isFinite(p.number)&&Number.isFinite(p.rating)&&Number.isInteger(p.slot)&&p.slot===i))return undefined;
 const record=(x:unknown,min:number,max:number)=>Object.fromEntries(Object.entries(x&&typeof x==='object'?x:{}).filter(([id,n])=>(getStarXIPlayer(id)||/^opponent-([0-9]|10)$/.test(id))&&Number.isFinite(n)).map(([id,n])=>[id,clamp(Number(n),min,max)]));
 const stats=(x:BroadcastStatistics)=>Object.fromEntries(Object.keys(emptyMatchStats()).map(k=>[k,clamp(Number(x?.[k as keyof BroadcastStatistics])||0,0,10000)])) as BroadcastStatistics;
 const kinds:BroadcastKind[]=['build-up','counter','wide','combination','shot','corner','free-kick','throw-in','yellow','substitution'];
 const events=(Array.isArray(v.events)?v.events:[]).filter(e=>e&&typeof e.id==='string'&&kinds.includes(e.kind)&&['club','opponent'].includes(e.side)&&Number.isFinite(e.at)&&e.at>0&&Number.isFinite(e.minute)&&e.minute>=1&&e.minute<=120&&Number.isFinite(e.lane)&&Number.isFinite(e.seed)&&typeof e.playerId==='string'&&typeof e.player==='string'&&(!e.outcome||['save','wide','blocked'].includes(e.outcome))).slice(-180).map(e=>({...e,id:e.id.slice(0,220),player:e.player.slice(0,100),lane:clamp(e.lane,1,67)}));
 return {version:1,clubFormation:STAR_FORMATIONS.some(f=>f.id===v.clubFormation)?v.clubFormation:'433',opponentFormation:v.opponentFormation,opponentXI:v.opponentXI.map(p=>({...p,name:p.name.slice(0,100)})),slots:record(v.slots,0,10),shirtNumbers:record(v.shirtNumbers,1,99),fitness:record(v.fitness,0,100),fitnessMinute:clamp(Number(v.fitnessMinute)||1,1,120),events:[...new Map(events.map(e=>[e.id,e])).values()],processedScene:clamp(Number(v.processedScene)||0,0,40),possessionSecond:clamp(Number(v.possessionSecond)||0,0,480),clubStats:stats(v.clubStats),opponentStats:stats(v.opponentStats)};
}

export function recordedActionRating(cup:CupState,id:string,minute:number){
 const entered=cup.playerEnteredAt[id]??1,end=Math.min(minute,cup.playerExitedAt[id]??minute);let value=0;
 for(const e of cup.broadcast?.events??[]){if(e.minute<entered||e.minute>end)continue;
  if(e.keeperId===id&&e.outcome==='save')value+=.07;
  if(e.playerId!==id)continue;
  if(e.kind==='yellow')value-=.08;
  else if(e.outcome==='wide'||e.outcome==='blocked')value-=.05;
  else if(['counter','combination','build-up','wide'].includes(e.kind))value+=.025;
 }
 return clamp(value,-.4,.4);
}
