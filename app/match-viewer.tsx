"use client";
import { chooseBallAction, restartPoint } from "./football-rules";

import { useEffect, useState, useRef } from "react";
import { getCupMatchMinute, getCupRegularDurationMs, getCupPlayerMatchRating, getStarFormation, getStarXIPlayer, STAR_XI_MAX_SUBSTITUTIONS } from "./feature-data";
import { matchColours } from './match-colours';
import { createMatchBroadcast } from './match-broadcast';
import type { BroadcastKind, BroadcastEvent } from './match-broadcast';
import { goalLabel, goalAssistId } from './match-goals';
import { MatchSubstitutions } from './match-substitutions';
import { MatchPitchCanvas } from './match-pitch-canvas';
import type { CupState, GameFeatures, StarPosition } from "./feature-data";

type Team = "club" | "opponent";
type Phase = "live" | "team" | "statistics";
export type Actor = { id: string; label: string; shirt: string; team: Team; role: StarPosition; x: number; y: number; goalkeeper: boolean; rating: number | null };
export type MatchEvent = { id: string; kind: "goal" | "card" | "injury" | "penalty" | BroadcastKind; at: number; minute: number; side: Team; player: string; playerId: string | null; outcome?: string; direction?: string; keeperDirection?: string; action?: BroadcastEvent; assistId?:string; style?:string };
type VisualPass={fromId:string;toId:string;progress:number};
export type Replay = { event: MatchEvent; startedAt: number };

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
const smooth = (x: number) => { const v = clamp(x, 0, 1); return v * v * (3 - 2 * v); };
const hash = (text: string) => { let x = 2166136261; for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 16777619); return (x >>> 0) / 4294967295; };

export function eventLabel(event:MatchEvent) {
 const labels:Record<string,string>={goal:'Tor',card:'Rote Karte',injury:'Verletzung',penalty:'Penalty','build-up':'Spielaufbau',counter:'Konter',wide:'Flügelangriff',combination:'Doppelpass',shot:'Torschuss',corner:'Ecke','free-kick':'Freistoss','throw-in':'Einwurf',yellow:'Gelbe Karte',substitution:'Wechsel',offside:'Abseits · indirekter Freistoss'};
 return labels[event.kind]??'Spielereignis';
}
function goalStyle(cup:CupState,id:string|null,eventId:string) {
 const saved=cup.matchEvents.find(e=>e.id===eventId)?.pattern;
 return saved??'low-shot';
}
function renderBroadcastAction(actors:Actor[],event:BroadcastEvent,age:number,clubRight:boolean) {
 const right=event.side==='club'?clubRight:!clubRight;
 const taker=actors.find(p=>p.id===event.playerId)??actors.find(p=>p.team===event.side&&!p.goalkeeper);
 const keeper=actors.find(p=>p.team!==event.side&&p.goalkeeper);
 const restart=event.kind==='corner'?'corner':event.kind==='throw-in'?'throw-in':event.kind==='free-kick'?'free-kick':undefined;
 const origin=event.kind==='offside'&&event.passSnapshot?event.passSnapshot.receiver:restart?restartPoint(restart,right,event.lane):{x:taker?.x??52.5,y:taker?.y??34};
 let ball={...origin},height=0,status=eventLabel({...event,action:event}),keeperDive:string|undefined,ballOwnerId=taker?.id;
 if(event.kind==='offside'){return {ball:{...origin},height:0,status:'Abseits · indirekter Freistoss',keeperDive:undefined,ballOwnerId:undefined};}
 if(event.outcome){
  const finish={x:right?(event.outcome==='save'?102:event.outcome==='blocked'?Math.min(96,origin.x+9):108):(event.outcome==='save'?3:event.outcome==='blocked'?Math.max(9,origin.x-9):-3),y:event.outcome==='wide'?24:30.8+event.seed*6};
  const t=clamp((age-.25)/.75,0,1);ball={x:mix(origin.x,finish.x,t),y:mix(origin.y,finish.y,t)};ballOwnerId=t===0?taker?.id:undefined;
  status=t<1?'Torschuss':event.outcome==='save'?'Parade!':event.outcome==='blocked'?'Geblockt!':'Vorbei!';
  if(keeper&&event.outcome==='save'){keeper.y=mix(keeper.y,finish.y,t);keeperDive=keeper.id;if(t===1){ballOwnerId=keeper.id;ball={x:keeper.x,y:keeper.y};}}
 }
 return {ball,height,status,keeperDive,ballOwnerId};
}

export function getViewerEvents(cup: CupState): MatchEvent[] {
  return [
    ...(cup.broadcast?.events ?? []).map(e=>({id:e.id,kind:e.kind,at:e.at,minute:e.minute,side:e.side,player:e.player,playerId:e.playerId,outcome:e.outcome,action:e,style:e.style})),
    ...cup.matchEvents.map((e) => ({ id: e.id, kind: "goal" as const, at: e.createdAt, minute: e.minute, side: e.side === "home" ? "club" as const : "opponent" as const, player: e.scorer, playerId: e.scorerId, assistId: goalAssistId(e), style: goalStyle(cup,e.scorerId,e.id) })),
    ...cup.cardEvents.map((e) => ({ id: e.id, kind: "card" as const, at: e.createdAt, minute: e.minute, side: e.side === "home" ? "club" as const : "opponent" as const, player: e.player, playerId: e.playerId })),
    ...cup.injuryEvents.map((e) => ({ id: e.id, kind: "injury" as const, at: e.createdAt, minute: e.minute, side: "club" as const, player: e.player, playerId: e.playerId })),
    ...cup.penaltyEvents.map((e) => ({ id: e.id, kind: "penalty" as const, at: e.createdAt, minute: 120, side: e.side === "home" ? "club" as const : "opponent" as const, player: e.player, playerId: e.playerId, outcome: e.outcome, direction: e.direction, keeperDirection: e.keeperDirection })),
  ].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

export function clubAttacksRight(minute: number, away: boolean) {
  const firstHalfOfPeriod = minute <= 45 || (minute > 90 && minute <= 105);
  return firstHalfOfPeriod !== away;
}

export function baseActors(features: GameFeatures, cup: CupState, minute: number, clubRight: boolean, replay = false): Actor[] {
  const formation = getStarFormation(cup.broadcast?.clubFormation ?? features.starXI.formationId);
  const roster = replay ? [...new Set([...cup.originalLineupIds, ...Object.keys(cup.playerEnteredAt)])]
    .filter(id => id && (cup.playerEnteredAt[id] ?? 1) <= minute && (cup.playerExitedAt[id] ?? 121) > minute) : features.starXI.lineupIds;
  const occupied = new Set<number>();
  const active = roster.flatMap((id, i) => {
    const p = getStarXIPlayer(id);
    if(p?.benchOnly)return [];
    if (!p || !replay && (cup.sentOffPlayerIds.includes(id) || (cup.playerExitedAt[id] ?? 121) <= minute)) return [];
    let slotIndex = replay ? (cup.broadcast?.slots[id] ?? cup.originalLineupIds.indexOf(id)) : i;
    const role = cup.playerMatchPositions[id] ?? features.starXI.formationPositions[i] ?? p.position;
    if (slotIndex < 0) slotIndex = formation.slots.findIndex((slot,index) => slot.position === role && !occupied.has(index));
    if (slotIndex < 0) slotIndex = formation.slots.findIndex((_,index) => !occupied.has(index));
    const slot = formation.slots[slotIndex];
    if (!slot) return [];
    occupied.add(slotIndex);
    const forward = 12 + (100 - slot.y) / 100 * 68;
    const goalkeeper = role === "TW";
    return [{ id, label: p.name, shirt: String(cup.broadcast?.shirtNumbers[id] ?? slotIndex + 1), team: "club" as const, role,
      x: goalkeeper ? (clubRight ? 3 : 102) : clubRight ? forward : 105-forward,
      y: goalkeeper ? 34 : clubRight?5+slot.x*.58:63-slot.x*.58, goalkeeper, rating: getCupPlayerMatchRating(cup, id, minute) }];
  });
  const broadcast=cup.broadcast??createMatchBroadcast(cup);
  const visitors = getStarFormation(broadcast.opponentFormation).slots.map((slot, i) => {
    const forward = 12 + (100 - slot.y) / 100 * 68, goalkeeper = slot.position === "TW", player=broadcast.opponentXI[i];
    if(cup.cardEvents.some(e=>e.side==='away'&&e.minute<=minute&&(e.playerId===player.id||e.player===player.name)))return null;
    const scored=cup.matchEvents.filter(e=>e.side==='away'&&e.scorer===player.name&&e.minute<=minute).length;
    return { id: player.id, label: player.name, shirt: String(player.number), team: "opponent" as const, role: slot.position,
      x: goalkeeper ? (clubRight ? 102 : 3) : clubRight ? 105-forward : forward,
      y: goalkeeper ? 34 : clubRight?63-slot.x*.58:5+slot.x*.58, goalkeeper, rating:Math.round(Math.min(10,6.4+(player.rating-70)*.005+scored*.6)*10)/10 };
  });
  return [...active, ...visitors.filter(p=>p!==null)];
}

// A shared endpoint at midfield makes every possession transition continuous.
// Each node is assigned to a real active actor; passes start and finish at their feet.
function possessionNode(index: number, right: boolean, strategy: string, seed: string) {
  const nodes = strategy === "konter" ? [[52.5,34],[36,30],[53,25],[69,17],[80,25],[82,39],[67,45],[56,37],[52.5,34]]
    : strategy === "ballbesitz" ? [[52.5,34],[35,31],[42,43],[51,29],[64,19],[74,32],[68,45],[57,40],[52.5,34]]
    : [[52.5,34],[39,29],[53,18],[67,14],[79,22],[82,38],[70,51],[58,39],[52.5,34]];
  const [x,y] = nodes[index];
  return {x: right ? x : 105-x, y: index === 0 || index === 8 ? 34 : clamp(y + (hash(seed+":"+index)-.5)*5,8,60)};
}
function closestCarrier(base: Actor[], team: Team, node: {x:number;y:number}) {
  return base.filter(p => p.team === team && !p.goalkeeper).sort((a,b) => Math.hypot(a.x-node.x,a.y-node.y)-Math.hypot(b.x-node.x,b.y-node.y) || a.id.localeCompare(b.id))[0];
}
function targetsAtNode(base: Actor[], team: Team, node: {x:number;y:number}, strategy: string, defensiveStrategy = strategy) {
  if (node.x === 52.5 && node.y === 34) {
    const club = closestCarrier(base,"club",node), opponent = closestCarrier(base,"opponent",node);
    return base.map(p => p.id === club?.id || p.id === opponent?.id ? {...p,x:52.5,y:34} : {...p});
  }
  const carrier = closestCarrier(base,team,node);
  const presser = base.filter(p => p.team !== team && !p.goalkeeper).sort((a,b) => Math.hypot(a.x-node.x,a.y-node.y)-Math.hypot(b.x-node.x,b.y-node.y))[0];
  return base.map(p => {
    if (p.goalkeeper) return {...p, x:p.x+(p.x<52?1:-1)*Math.max(0,8-Math.abs(node.x-p.x)*.12), y:clamp(34+(node.y-34)*.22,29,39)};
    if (p.id === carrier?.id) return {...p,...node};
    const press = defensiveStrategy === "angriff" ? .25 : defensiveStrategy === "konter" ? .09 : .14;
    let x = p.x + (node.x-52.5)*(p.team === team ? .27 : press);
    let y = p.y + (node.y-34)*.12;
    if (p.id === presser?.id) {x=mix(x,node.x,.4);y=mix(y,node.y,.4);}
    return {...p,x:clamp(x,6,99),y:clamp(y,4,64)};
  });
}
function separateTargets(actors: Actor[]) {
  actors.forEach((p,i)=>actors.slice(i+1).forEach(q=>{
    const dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);
    if(d<3.9 && d>.001 && !p.goalkeeper && !q.goalkeeper) {
      const n=(3.9-d)/2;p.x=clamp(p.x-dx/d*n,3,102);p.y=clamp(p.y-dy/d*n,3,65);
      q.x=clamp(q.x+dx/d*n,3,102);q.y=clamp(q.y+dy/d*n,3,65);
    }
  }));
  return actors;
}
function openPlay(features:GameFeatures,at:number,minute:number,clubRight:boolean,replaying=false) {
 const cup=features.cup,base=baseActors(features,cup,minute,clubRight,replaying);
  const elapsed = Math.max(0,(at-cup.matchStartedAt)/1000);
  const stepSeconds=getCupRegularDurationMs(cup)/90000*.375;
  const cycleSeconds=stepSeconds*8;
  const cycle=Math.floor(elapsed/cycleSeconds),local=elapsed%cycleSeconds,nodeIndex=Math.min(7,Math.floor(local/stepSeconds)),t=local%stepSeconds/stepSeconds;
  const possession: Team = cycle%2 === 0 ? "club" : "opponent";
  const strategy = 'ballbesitz';
  const right = possession === "club" ? clubRight : !clubRight;
  const seed = (cup.careerMatchId ?? String(cup.matchStartedAt)) + ":" + cycle;
  const from = possessionNode(nodeIndex,right,strategy,seed), to = possessionNode(nodeIndex+1,right,strategy,seed);
  const defendingStrategy='ballbesitz';
  const start = separateTargets(targetsAtNode(base,possession,from,strategy,defendingStrategy)), end = separateTargets(targetsAtNode(base,possession,to,strategy,defendingStrategy));
  const actorAt = (index:number,phase:number) => ({...start[index],x:mix(start[index].x,end[index].x,smooth(phase)),y:mix(start[index].y,end[index].y,smooth(phase))});
  const actors = base.map((_,i) => actorAt(i,t));
  const passer = closestCarrier(base,possession,from);
  const decisionPlayers=actors.filter(p=>p.team===possession&&!p.goalkeeper).map(p=>{const card=getStarXIPlayer(p.id)??getStarXIPlayer(cup.broadcast?.opponentXI.find(q=>q.id===p.id)?.sourceId??'');return {...p,passing:card?.originalAttributes?.stats.shortPassing?.value??card?.rating??70,finishing:card?.originalAttributes?.stats.finishing?.value??card?.rating??70,control:card?.originalAttributes?.stats.ballControl?.value??70,stamina:cup.broadcast?.fitness[p.id]??100};});
  const carrier=decisionPlayers.find(p=>p.id===passer?.id);
  const decision=carrier?chooseBallAction(carrier,decisionPlayers,actors.filter(p=>p.team!==possession),right):undefined;
  const receiver=closestCarrier(base,possession,to);
  const release=decision?.kind==='pass'?.15:.2;
  const arrival=decision?.kind==='shield'?.85:.75;
  const pi = actors.findIndex(p => p.id === passer?.id), ri = actors.findIndex(p => p.id === receiver?.id);
  let ball = {x:52.5,y:34};
  let pass:VisualPass|undefined;
  let height = 0;
  let ballOwnerId=pi===ri||t<release?passer?.id:t>=arrival?receiver?.id:undefined;
  if (pi >= 0 && ri >= 0) {
    if (pi === ri || t < release) ball={x:actors[pi].x+(right ? .8 : -.8),y:actors[pi].y+.35};
    else if (t < arrival) {
      const a=actorAt(pi,release),b=actorAt(ri,arrival),progress=(t-release)/(arrival-release);
      pass={fromId:actors[pi].id,toId:actors[ri].id,progress};
      ball={x:mix(a.x+(right ? .8 : -.8),b.x+(right ? .8 : -.8),progress),y:mix(a.y+.35,b.y+.35,progress)};
      if (Math.hypot(a.x-b.x,a.y-b.y)>25 || nodeIndex === 4) height=Math.sin(progress*Math.PI)*2;
    } else ball={x:actors[ri].x+(right ? .8 : -.8),y:actors[ri].y+.35};
  }
 return {actors,ball,height,ballOwnerId,pass,elapsed,nodeIndex,strategy};
}
export function getVisualFrame(features: GameFeatures, wallNow: number, replay?: Replay) {
  const cup = features.cup;
  const frozen=cup.timedPause;
  const visualAt=frozen?frozen.kind==='goal'?Math.min(wallNow,frozen.startsAt):frozen.frozenAt:wallNow;
  const at = cup.matchPaused || !cup.active ? cup.lastTickAt : Math.min(visualAt,cup.matchEndsAt);
  const minute = replay ? replay.event.minute : getCupMatchMinute(cup,at);
  const clubRight = clubAttacksRight(minute,Boolean(cup.fixture?.away));
  const open=openPlay(features,replay?replay.event.at:at,minute,clubRight,Boolean(replay)||!cup.active);
  const {actors,elapsed,nodeIndex,strategy}=open;
  let {ball,height,ballOwnerId,pass}=open;
  let shotFlight:{fromId:string;progress:number}|undefined;
  const visibleEvents=getViewerEvents(cup).filter(e=>e.at<=at&&at-e.at<(e.action?1500:3000));
  const recent=replay?.event??visibleEvents.filter(e=>e.kind==='goal'&&at-e.at<2000).at(-1)??visibleEvents.at(-1);
  const age = replay ? Math.max(0,(wallNow-replay.startedAt)/1000) : recent ? (at-recent.at)/1000 : Infinity;
  let status = cup.matchPaused ? "Verletzungspause" : nodeIndex<2 ? "Spielaufbau" : nodeIndex<5 ? strategy==="konter" ? "Schneller Konter" : "Passkombination" : "Ballzirkulation";
  const directionY = (direction?:string) => direction === "left" ? 31.4 : direction === "right" ? 36.6 : 34;
  let keeperDive: string | undefined;
  if (recent && age<(replay?6.5:2) && (recent.kind === "goal" || recent.kind === "penalty")) {
    const goalRight=recent.side === "club" ? clubRight : !clubRight;
    const scored=recent.kind === "goal" || recent.outcome === "goal";
    const scorer=actors.find(p => p.id===recent.playerId) ?? actors.find(p => p.team===recent.side && p.role==="ST");
    const keeper=actors.find(p => p.team!==recent.side && p.goalkeeper);
    const penalty=recent.kind==="penalty"||recent.style==="penalty";
    const originFrame=openPlay(features,recent.at,minute,clubRight,Boolean(replay));
    const originActor=originFrame.actors.find(p=>p.id===scorer?.id)??scorer;
    const source={x:penalty?(goalRight?94:11):(originActor?.x??(goalRight?80:25)),y:penalty?34:(originActor?.y??34)};
    const finish={x:goalRight ? scored ? 106 : recent.outcome==="save" ? 101.5 : 108 : scored ? -1 : recent.outcome==="save" ? 3.5 : -3,
      y:scored || recent.outcome==="save" ? directionY(recent.direction) : 23};
    const assist=originFrame.actors.find(p=>p.id===recent.assistId);
    const lead=recent.kind==='goal'&&!penalty&&assist?(replay?3:.4):0;
    const shotProgress=clamp((age-lead)/.75,0,1);
    ball={x:mix(source.x,finish.x,shotProgress),y:mix(source.y,finish.y,shotProgress)};height=0;pass=undefined;shotFlight=scorer?{fromId:scorer.id,progress:shotProgress}:undefined;
    if (scorer) {scorer.x=source.x+(goalRight ? -.8 : .8);scorer.y=source.y;}
    if(recent.style==='header'||recent.style==='cross')height=Math.sin(shotProgress*Math.PI)*2;
    if(age<lead&&assist){
      const t=smooth(age/lead);ball={x:mix(assist.x,source.x,t),y:mix(assist.y,source.y,t)};ballOwnerId=t===0?assist.id:undefined;pass=scorer?{fromId:assist.id,toId:scorer.id,progress:t}:undefined;shotFlight=undefined;
    }else ballOwnerId=shotProgress===0?scorer?.id:undefined;
    if (keeper) {
      keeper.x=goalRight ? 102 : 3;keeper.y=mix(34,recent.outcome==="save" ? finish.y : directionY(recent.keeperDirection),shotProgress);keeperDive=keeper.id;
      if (!penalty) keeper.y=mix(34,scored ? 37 : finish.y,shotProgress);
    }
    status=age<lead?'Angriff · Zuspiel':shotProgress<1?'Torschuss':scored?'TOOOR!':recent.outcome==='save'?'Gehalten!':'Vorbei!';

  } else if (recent?.action && (recent.action.outcome||recent.action.kind==='offside') && age<(replay?10:1.5)) {
    const scene=renderBroadcastAction(actors,recent.action,age,clubRight);
    ball=scene.ball;height=scene.height;status=scene.status;keeperDive=scene.keeperDive;ballOwnerId=scene.ballOwnerId;pass=undefined;shotFlight={fromId:recent.action.playerId,progress:clamp((age-.25)/.75,0,1)};
  } else if (recent && age<1.5) {status=recent.action?eventLabel(recent):recent.kind==="card" ? "Rote Karte" : "Spielunterbruch";}
  else if (recent && recent.kind === "goal" && age >= 2 && age < 3) {ball={x:52.5,y:34};status="Wiederanpfiff";}
  else if (cup.phase === "penalties") {ball={x:clubRight ? 94 : 11,y:34};status="Elfmeterschiessen";}
  const periodTransition=!replay && ((minute===46 || minute===91 || minute===106) && Math.floor(elapsed)%4<2);
  if(!replay&&(elapsed<1.5||periodTransition||status==='Wiederanpfiff'||cup.restartAt!==undefined&&wallNow>=cup.restartAt&&wallNow<cup.restartAt+1500)){
    const kickoffSide:Team=cup.restartAt!==undefined&&wallNow<cup.restartAt+1500?(cup.restartSide??'club'):status==='Wiederanpfiff'&&recent?.kind==='goal'?(recent.side==='club'?'opponent':'club'):'club';
    const anchors=baseActors(features,cup,minute,clubRight);
    const taker=anchors.filter(p=>p.team===kickoffSide&&!p.goalkeeper).sort((a,b)=>Math.abs(a.x-52.5)-Math.abs(b.x-52.5))[0];
    actors.splice(0,actors.length,...anchors.map(p=>{const right=p.team==='club'?clubRight:!clubRight;return {...p,x:p.goalkeeper?p.x:right?Math.min(49,p.x*.61):Math.max(56,105-(105-p.x)*.61),y:p.id===taker?.id?34:p.y};}));
    const carrier=actors.find(p=>p.id===taker?.id);if(carrier)carrier.x=52.5;
    ball={x:52.5,y:34};ballOwnerId=taker?.id;pass=undefined;shotFlight=undefined;status=elapsed<1.5?'Anpfiff':status==='Wiederanpfiff'?'Wiederanpfiff':'Seitenwechsel';
  }
  return {actors,ball,height,minute,status,recent,age,keeperDive,ballOwnerId,pass,shotFlight};
}

export function LiveMatchViewer({ features, now, clubName, clubColor, disabled=false, onSubstitute }: { features: GameFeatures; now: number; clubName: string; clubColor: string; disabled?:boolean; onSubstitute?:(changes:{playerId:string;slot:number}[])=>void }) {
  const [tab, setTab] = useState<Phase>("live");
  const [clock, setClock] = useState(now);
  const [replay, setReplay] = useState<Replay>();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [camera,setCamera]=useState<"full"|"follow"|"highlights">("full");
  const [fps,setFps]=useState(0);
  const [selectedPlayer,setSelectedPlayer]=useState<string>();
  const [expanded,setExpanded]=useState(false);
  const [subOpen,setSubOpen]=useState(false);
  const viewerRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!expanded)return;
    const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    const elements=()=>Array.from(viewerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),a[href]')??[]);
    elements()[0]?.focus();
    const key=(e:globalThis.KeyboardEvent)=>{if(e.key==='Escape')setExpanded(false);if(e.key==='Tab'){const list=elements(),first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
    window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=overflow;previous?.focus();};
  },[expanded]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(media.matches);
    change(); media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const offset = now - Date.now();
    let animation = 0, previous = 0;
    const tick = (timestamp: number) => {
      if (timestamp - previous >= (reducedMotion ? 1000 : 250) && document.visibilityState === "visible") {
        setClock(Date.now() + offset);
        previous = timestamp;
      }
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [now, reducedMotion]);
  const cup = features.cup;
  useEffect(()=>{
    const pause=features.cup.timedPause;if(!pause)return;
    const offset=now-Date.now();
    const timers=[pause.startsAt,pause.endsAt].map(at=>window.setTimeout(()=>setClock(Date.now()+offset),Math.max(0,at-now)));
    return()=>timers.forEach(clearTimeout);
  },[features.cup.timedPause?.id,features.cup.timedPause?.startsAt,features.cup.timedPause?.endsAt,now]);
  const activeReplay = replay && clock - replay.startedAt < 10000 ? replay : undefined;
  const frame = getVisualFrame(features, clock, activeReplay);
  const history = getViewerEvents(cup).filter((event) => event.at <= clock);
  const effectiveClock = cup.timedPause?.frozenAt ?? (cup.matchPaused ? cup.lastTickAt : Math.min(clock,cup.matchEndsAt));
  const regular = getCupRegularDurationMs(cup);
  const halfTimeTransition = !activeReplay && cup.active && [regular/2,regular,regular+regular/6].some(boundary => Math.abs(effectiveClock-cup.matchStartedAt-boundary)<1350);
  const visiting = Boolean(cup.fixture?.away);
  const home = visiting ? cup.opponent : clubName;
  const away = visiting ? clubName : cup.opponent;
  const scoreClock=cup.timedPause?.kind==='goal'?Math.min(clock,cup.timedPause.startsAt):effectiveClock;
  const visibleGoals=cup.matchEvents.filter(e=>e.createdAt+(goalAssistId(e)?1150:750)<=scoreClock);
  const waitingGoals=cup.matchEvents.filter(e=>e.createdAt+(goalAssistId(e)?1150:750)>scoreClock);
  const ownScore=cup.homeScore-waitingGoals.filter(e=>e.side==='home').length;
  const otherScore=cup.awayScore-waitingGoals.filter(e=>e.side==='away').length;
  const homeScore=visiting?otherScore:ownScore,awayScore=visiting?ownScore:otherScore;
  const scorers=(side:'home'|'away')=><div className="gc-score-scorers">{visibleGoals.filter(e=>e.side===side).map(e=><span key={e.id}>{goalLabel(e)}</span>)}</div>;
  const phases: { id: Phase; label: string }[] = [{id:'live',label:'MATCH'},{id:'team',label:'TEAM'},{id:'statistics',label:'STATISTIK'}];
  const colours = matchColours(cup.opponent,clubColor,visiting);
  const pause=cup.timedPause;
  const timedOverlay=!activeReplay&&pause&&clock>=pause.startsAt&&clock<pause.endsAt;
  const goal=pause?.kind==='goal'?cup.matchEvents.find(e=>e.id===pause.id):undefined;
  return <section ref={viewerRef} className={`gc-match-viewer ${tab === "team" ? "team-open" : "pitch-focus"}${expanded?" expanded":""}`} role={expanded?"dialog":undefined} aria-modal={expanded?true:undefined} aria-label="Animierte 2D-Live-Spielansicht">
    <div className="gc-viewer-tools"><span>{cup.mode==="season"?"SAISON":"POKAL"} · {cup.fixture?.venue.stadium??cup.opponent}</span><button type="button" onClick={()=>setExpanded(x=>!x)}>{expanded?"Ansicht schliessen":"Grosse Spielansicht"}</button></div>
    <div className="gc-viewer-scoreboard"><div><small>HEIM</small><strong><span className="gc-team-badge">{visiting?home.slice(0,2).toUpperCase():features.club.badge}</span> {home}</strong>{scorers(visiting?'away':'home')}</div><div className="gc-viewer-score"><span>{homeScore} : {awayScore}</span><small>{!cup.active ? "ABPFIFF" : cup.matchPaused ? "PAUSIERT" : cup.phase === "penalties" ? "ELFMETERSCHIESSEN" : cup.phase === "extra-time" ? "VERLÄNGERUNG" : "LIVE"} · {getCupMatchMinute(cup,effectiveClock)}′{activeReplay ? ` · Replay ${frame.minute}′` : ""}</small></div><div><small>AUSWÄRTS</small><strong>{away} <span className="gc-team-badge">{visiting?features.club.badge:away.slice(0,2).toUpperCase()}</span></strong>{scorers(visiting?'home':'away')}</div></div>
    {frame.recent && <div className="gc-viewer-caption" role="status"><time>{frame.recent.minute}′</time><strong>{eventLabel(frame.recent)} · {frame.recent.player}</strong>{frame.recent.assistId&&<span>Vorlage: {getStarXIPlayer(frame.recent.assistId)?.name}</span>}</div>}
    <div className="gc-viewer-main">
      <div className="gc-viewer-pitch-shell">
        <div className="gc-viewer-pitch-head"><span><i className="gc-live-dot" /> {activeReplay ? "WIEDERHOLUNG" : frame.status}</span><span>{getStarFormation(features.starXI.formationId).label} · 2D</span></div>
        {!cup.timedPause && halfTimeTransition && <div className="gc-viewer-half-time"><strong>{cup.phase === "extra-time" ? "VERLÄNGERUNG" : "HALBZEIT"}</strong><span>Seitenwechsel</span></div>}
        {timedOverlay && <div className={`gc-timed-overlay ${pause.kind}`} role="status" style={{borderColor:goal?.side==='away'?colours.opponent:colours.club}}><span>{pause.kind==='halftime'?'HALBZEIT':'⚽ TOR!'}</span><strong>{clubName} {cup.homeScore} : {cup.awayScore} {cup.opponent}</strong>{goal?<><b>{goal.side==='home'?clubName:cup.opponent}</b><span>{goal.scorer} · {goal.minute}′</span>{goal.assistName&&<small>Vorlage: {goal.assistName}</small>}</>:<><MatchStatistics features={features} clubName={clubName}/><small>Zweite Halbzeit in {Math.max(1,Math.ceil((pause.endsAt-clock)/1000))} s</small></>}</div>}
        <MatchPitchCanvas features={features} now={now} replay={activeReplay} colours={colours} camera={camera} reducedMotion={reducedMotion} onSelect={setSelectedPlayer} onFps={setFps} />
        <div className="gc-viewer-cameras" role="group" aria-label="Kamera"><button type="button" aria-pressed={camera==='full'} onClick={()=>setCamera('full')}>Ganzes Feld</button><button type="button" aria-pressed={camera==='follow'} onClick={()=>setCamera('follow')}>Ball verfolgen</button><button type="button" aria-pressed={camera==='highlights'} onClick={()=>setCamera('highlights')}>Highlight-Kamera</button><small>{fps>0?`${fps} FPS`:''}</small></div>
        <div className="gc-viewer-legend"><span><i style={{ background: colours.club }} />{clubName}</span><span><i style={{ background: colours.opponent }} />{cup.opponent}</span><span>Live-Spielansicht</span></div>
        {activeReplay && <button type="button" className="gc-viewer-replay-exit" onClick={() => setReplay(undefined)}>Wiederholung beenden</button>}
      </div>
    </div>
    {selectedPlayer && <div className="gc-viewer-player-detail"><strong>{frame.actors.find(p=>p.id===selectedPlayer)?.label??getStarXIPlayer(selectedPlayer)?.name}</strong><span>Note {frame.actors.find(p=>p.id===selectedPlayer)?.rating?.toFixed(1)??'–'}</span><button type="button" onClick={()=>setSelectedPlayer(undefined)}>Schliessen</button></div>}
    <button type="button" className="mode-secondary match-sub-button" disabled={disabled||!onSubstitute||cup.phase==='penalties'||cup.substitutionsUsed>=STAR_XI_MAX_SUBSTITUTIONS} onClick={()=>setSubOpen(true)}>Wechseln</button>{subOpen&&<MatchSubstitutions features={features} disabled={disabled} onConfirm={changes=>onSubstitute?.(changes)} onClose={()=>setSubOpen(false)}/>} <div className="gc-viewer-tabs" role="tablist" aria-label="Spielansichten">{phases.map((item) => <button type="button" role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? "selected" : ""} onClick={() => { setTab(item.id); if (item.id !== "live") setReplay(undefined); }}>{item.label}</button>)}</div>
    <div className="gc-viewer-tab-panel" role="tabpanel">
      {tab === "live" && <div className="gc-viewer-events">{history.length ? history.slice().reverse().map(event=><button key={event.id} type="button" onClick={()=>setReplay({event,startedAt:clock})}><time>{event.minute}′</time><span>{eventLabel(event)} · {event.player}</span><b>▶</b></button>) : <span>Die Partie läuft. Tore, Karten, Verletzungen und Wechsel erscheinen hier.</span>}</div>}
      {tab === "statistics" && <MatchStatistics features={features} clubName={clubName} />}
      {tab === "team" && <div className="gc-viewer-tactics"><p>Formation {getStarFormation(features.starXI.formationId).label} · {cup.substitutionsUsed}/5 Wechsel · {cup.subWindowsUsed??0}/3 Fenster</p>{cup.pendingSubstitutions&&<p>Wechselpaket wartet auf den nächsten Unterbruch.</p>}</div>}


    </div>
  </section>;
}

function MatchStatistics({features,clubName}:{features:GameFeatures;clubName:string}) {
 const c=features.cup,b=c.broadcast,a=b?.clubStats,o=b?.opponentStats;
 const goals=c.matchEvents,ownGoals=goals.filter(e=>e.side==='home'),otherGoals=goals.filter(e=>e.side==='away');
 const total=(a?.possessionSeconds??0)+(o?.possessionSeconds??0),own=total?Math.round((a!.possessionSeconds/total)*100):50;
 const rows:[string,string|number,string|number][]=[['Tore',c.homeScore,c.awayScore],['Ballbesitz',`${own}%`,`${100-own}%`],['Schüsse',(a?.shots??0)+ownGoals.length,(o?.shots??0)+otherGoals.length],['Aufs Tor',(a?.onTarget??0)+ownGoals.length,(o?.onTarget??0)+otherGoals.length],['Paraden',a?.saves??0,o?.saves??0],['Ecken',(a?.corners??0)+ownGoals.filter(e=>e.pattern==='corner').length,(o?.corners??0)+otherGoals.filter(e=>e.pattern==='corner').length],['Freistösse',(a?.freeKicks??0)+ownGoals.filter(e=>e.pattern==='free-kick').length,(o?.freeKicks??0)+otherGoals.filter(e=>e.pattern==='free-kick').length],['Abseits',a?.offsides??0,o?.offsides??0],['Gelbe Karten',a?.yellowCards??0,o?.yellowCards??0],['Rote Karten',c.cardEvents.filter(e=>e.side==='home').length,c.cardEvents.filter(e=>e.side==='away').length]];
 return <table className="gc-match-statistics"><thead><tr><th>{clubName}</th><th>Statistik</th><th>{c.opponent}</th></tr></thead><tbody>{rows.map(([label,club,opponent])=><tr key={label}><td>{club}</td><th>{label}</th><td>{opponent}</td></tr>)}</tbody></table>;
}
