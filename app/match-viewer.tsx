"use client";

import { useEffect, useState, useRef } from "react";
import { getCupMatchMinute, getCupRegularDurationMs, getCupPlayerMatchRating, getStarFormation, getStarXIPlayer, getStarXIPositions, CUP_STRATEGIES, canStarXIPlayerFillSlot, STAR_XI_MAX_SUBSTITUTIONS } from "./feature-data";
import { createMatchBroadcast, matchFitness, broadcastSeed } from './match-broadcast';
import type { BroadcastKind, BroadcastEvent } from './match-broadcast';
import { MatchPitchCanvas } from './match-pitch-canvas';
import type { CupState, GameFeatures, StarPosition } from "./feature-data";

type Team = "club" | "opponent";
type Phase = "live" | "fitness" | "ratings" | "statistics" | "tactics" | "substitutions" | "highlights";
export type Actor = { id: string; label: string; shirt: string; team: Team; role: StarPosition; x: number; y: number; goalkeeper: boolean; rating: number | null };
export type MatchEvent = { id: string; kind: "goal" | "card" | "injury" | "penalty" | BroadcastKind; at: number; minute: number; side: Team; player: string; playerId: string | null; outcome?: string; direction?: string; keeperDirection?: string; action?: BroadcastEvent; assistId?:string; style?:string };
export type Replay = { event: MatchEvent; startedAt: number };

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
const smooth = (x: number) => { const v = clamp(x, 0, 1); return v * v * (3 - 2 * v); };
const hash = (text: string) => { let x = 2166136261; for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 16777619); return (x >>> 0) / 4294967295; };

export function eventLabel(event:MatchEvent) {
 const labels:Record<string,string>={goal:'Tor',card:'Rote Karte',injury:'Verletzung',penalty:'Penalty','build-up':'Spielaufbau',counter:'Konter',wide:'Flügelangriff',combination:'Doppelpass',shot:'Torschuss',corner:'Ecke','free-kick':'Freistoss','throw-in':'Einwurf',yellow:'Gelbe Karte',substitution:'Wechsel'};
 return labels[event.kind]??'Spielereignis';
}
function goalStyle(cup:CupState,id:string|null,eventId:string) {
 const saved=cup.matchEvents.find(e=>e.id===eventId)?.pattern;
 return saved??'low-shot';
}
function renderBroadcastAction(actors:Actor[],event:BroadcastEvent,age:number,clubRight:boolean) {
 const right=event.side==='club'?clubRight:!clubRight, forward=(x:number)=>right?x:105-x;
 const attacking=actors.filter(p=>p.team===event.side&&!p.goalkeeper),defending=actors.filter(p=>p.team!==event.side&&!p.goalkeeper);
 const taker=actors.find(p=>p.id===event.playerId)??attacking.at(-1),receiver=attacking.filter(p=>p.id!==taker?.id).at(-1),keeper=actors.find(p=>p.id===event.keeperId)??actors.find(p=>p.team!==event.side&&p.goalkeeper);
 const l=event.lane;
 let ball={x:forward(70),y:l},height=0,keeperDive:string|undefined,status='Spielaufbau',ballOwnerId:string|undefined;
 if(event.kind==='substitution')return {ball:{x:52.5,y:34},height:0,status:'Spielerwechsel',keeperDive,ballOwnerId:undefined};
 if(event.kind==='yellow')return {ball:{x:forward(60),y:l},height:0,status:`Gelbe Karte · ${event.player}`,keeperDive,ballOwnerId:undefined};
 if(event.kind==='throw-in') {
  const side=event.seed<.5?1:67,start={x:forward(62),y:side},finish={x:forward(64),y:side<34?14:54};
  if(taker){taker.x=start.x;taker.y=start.y;}if(receiver){receiver.x=finish.x;receiver.y=finish.y;}
  const t=clamp((age-1)/1.5,0,1);ball={x:mix(start.x,finish.x,t),y:mix(start.y,finish.y,t)};height=Math.sin(t*Math.PI)*2;status='Einwurf';
 } else if(event.kind==='corner'||event.kind==='free-kick'||event.kind==='shot') {
  const start=event.kind==='corner'?{x:forward(104),y:event.seed<.5?1:67}:{x:forward(event.kind==='free-kick'?77:71),y:l};
  const shooter=event.kind==='corner'?receiver:taker;
  const header={x:forward(91),y:32};
  if(taker){taker.x=start.x;taker.y=start.y;}if(event.kind==='corner'&&receiver){receiver.x=header.x;receiver.y=header.y;}
  defending.slice(0,event.kind==='free-kick'?3:5).forEach((p,i)=>{p.x=forward(event.kind==='free-kick'?83:92);p.y=event.kind==='free-kick'?29+i*2.6:25+i*4;});
  const shotStart=event.kind==='corner'?header:start;
  const finish={x:forward(event.outcome==='save'?102:event.outcome==='blocked'?86:108),y:event.outcome==='wide'?22:event.outcome==='blocked'?l:30.8+event.seed*6};
  if(age<2.7&&event.kind==='corner'){
    const t=clamp((age-.8)/1.9,0,1);ball={x:mix(start.x,header.x,t),y:mix(start.y,header.y,t)};height=Math.sin(t*Math.PI)*4;status='Ecke · Flanke';
  }else {
    const t=clamp((age-(event.kind==='corner'?2.7:1.2))/1.2,0,1);ball={x:mix(shotStart.x,finish.x,t),y:mix(shotStart.y,finish.y,t)};
    height=event.kind==='free-kick'?Math.sin(t*Math.PI)*2:0;
    status=t<1?event.kind==='corner'?'Kopfball!':event.kind==='free-kick'?'Freistoss!':'Distanzschuss!':event.outcome==='save'?'Parade!':event.outcome==='blocked'?'Geblockt!':'Knapp vorbei!';
    if(keeper&&event.outcome==='save'){keeper.x=finish.x;keeper.y=mix(34,finish.y,t);keeperDive=keeper.id;}
    if(t>=1&&event.outcome==='save'&&keeper){
      ball={x:keeper.x,y:keeper.y};ballOwnerId=keeper.id;
      if(age>6.5){const outlet=defending.find(p=>p.role==='IV')??defending[0];if(outlet){outlet.x=forward(81);outlet.y=42;const pass=clamp((age-6.5)/2,0,1);ball={x:mix(keeper.x,outlet.x,pass),y:mix(keeper.y,outlet.y,pass)};ballOwnerId=pass>=1?outlet.id:undefined;status='Torwart · Spieleröffnung';}}
    }
  }
  if(shooter&&event.kind!=='corner'){shooter.x=shotStart.x;shooter.y=shotStart.y;}
  if(event.outcome==='blocked'&&age>5){const defender=defending.find(p=>p.role==='IV')??defending[0];if(defender){defender.x=finish.x;defender.y=finish.y;const clearing=clamp((age-5)/2.5,0,1);ball={x:mix(finish.x,52.5,clearing),y:mix(finish.y,15,clearing)};height=Math.sin(clearing*Math.PI)*3;status='Abwehr · Klärung';ballOwnerId=undefined;}}

 } else {
  const start={x:forward(event.kind==='counter'?36:51),y:l},finish={x:forward(event.kind==='counter'?77:event.kind==='wide'?76:67),y:event.kind==='wide'?10:l+4};
  if(taker){taker.x=mix(start.x,finish.x,smooth(age/8));taker.y=mix(start.y,finish.y,smooth(age/8));}
  if(receiver){receiver.x=finish.x+ (right?3:-3);receiver.y=finish.y+9;}
  const t=clamp((age-3)/2,0,1);ball=age<3&&taker?{x:taker.x+(right?.8:-.8),y:taker.y}:receiver?{x:mix(taker?.x??start.x,receiver.x,t),y:mix(taker?.y??start.y,receiver.y,t)}:finish;
  if(event.kind==='wide')height=Math.sin(t*Math.PI)*3;
  ballOwnerId=age<3?taker?.id:age>=5?receiver?.id:undefined;
  if(event.kind==='combination'&&taker&&receiver){
    const phase=age<2?clamp(age/2,0,1):age<4?1-clamp((age-2)/2,0,1):clamp((age-4)/2,0,1);
    ball={x:mix(taker.x,receiver.x,phase),y:mix(taker.y,receiver.y,phase)};ballOwnerId=age>=6?receiver.id:undefined;
  }
  status=event.kind==='counter'?'Konter · Steilpass':event.kind==='wide'?'Flügelangriff · Flanke':event.kind==='combination'?'Doppelpass':'Kontrollierter Aufbau';
 }
 return {ball,height,status,keeperDive,ballOwnerId};
}

export function getViewerEvents(cup: CupState): MatchEvent[] {
  return [
    ...(cup.broadcast?.events ?? []).map(e=>({id:e.id,kind:e.kind,at:e.at,minute:e.minute,side:e.side,player:e.player,playerId:e.playerId,outcome:e.outcome,action:e,style:e.style})),
    ...cup.matchEvents.map((e) => ({ id: e.id, kind: "goal" as const, at: e.createdAt, minute: e.minute, side: e.side === "home" ? "club" as const : "opponent" as const, player: e.scorer, playerId: e.scorerId, assistId: Object.keys(e.ratingImpacts).find(id => id!==e.scorerId && e.ratingImpacts[id]>0), style: goalStyle(cup,e.scorerId,e.id) })),
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
      y: goalkeeper ? 34 : 5 + slot.x * 0.58, goalkeeper, rating: getCupPlayerMatchRating(cup, id, minute) }];
  });
  const broadcast=cup.broadcast??createMatchBroadcast(cup);
  const visitors = getStarFormation(broadcast.opponentFormation).slots.map((slot, i) => {
    const forward = 12 + (100 - slot.y) / 100 * 68, goalkeeper = slot.position === "TW", player=broadcast.opponentXI[i];
    const scored=cup.matchEvents.filter(e=>e.side==='away'&&e.scorer===player.name&&e.minute<=minute).length;
    return { id: player.id, label: player.name, shirt: String(player.number), team: "opponent" as const, role: slot.position,
      x: goalkeeper ? (clubRight ? 102 : 3) : clubRight ? 105-forward : forward,
      y: goalkeeper ? 34 : 5 + slot.x * 0.58, goalkeeper, rating:Math.round(Math.min(10,6.4+(player.rating-70)*.005+scored*.6)*10)/10 };
  });
  return [...active, ...visitors];
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
export function getVisualFrame(features: GameFeatures, wallNow: number, replay?: Replay) {
  const cup = features.cup;
  const at = cup.matchPaused || !cup.active ? cup.lastTickAt : Math.min(wallNow,cup.matchEndsAt);
  const minute = replay ? replay.event.minute : getCupMatchMinute(cup,at);
  const clubRight = clubAttacksRight(minute,Boolean(cup.fixture?.away));
  const base = baseActors(features,cup,minute,clubRight,Boolean(replay) || !cup.active);
  const elapsed = Math.max(0,((replay ? replay.event.at : at)-cup.matchStartedAt)/1000);
  const cycle = Math.floor(elapsed/48), local = elapsed%48, nodeIndex = Math.floor(local/6), t = local%6/6;
  const possession: Team = cycle%2 === 0 ? "club" : "opponent";
  const strategy = possession === "club" ? cup.strategyId : cup.opponentStrategyId;
  const right = possession === "club" ? clubRight : !clubRight;
  const seed = (cup.careerMatchId ?? String(cup.matchStartedAt)) + ":" + cycle;
  const from = possessionNode(nodeIndex,right,strategy,seed), to = possessionNode(nodeIndex+1,right,strategy,seed);
  const defendingStrategy=possession==='club'?cup.opponentStrategyId:cup.strategyId;
  const start = separateTargets(targetsAtNode(base,possession,from,strategy,defendingStrategy)), end = separateTargets(targetsAtNode(base,possession,to,strategy,defendingStrategy));
  const actorAt = (index:number,phase:number) => ({...start[index],x:mix(start[index].x,end[index].x,smooth(phase)),y:mix(start[index].y,end[index].y,smooth(phase))});
  const actors = base.map((_,i) => actorAt(i,t));
  const passer = closestCarrier(base,possession,from), receiver = closestCarrier(base,possession,to);
  const pi = actors.findIndex(p => p.id === passer?.id), ri = actors.findIndex(p => p.id === receiver?.id);
  let ball = {x:52.5,y:34};
  let height = 0;
  let ballOwnerId=pi===ri||t<.2?passer?.id:t>=.75?receiver?.id:undefined;
  if (pi >= 0 && ri >= 0) {
    if (pi === ri || t < .2) ball={x:actors[pi].x+(right ? .8 : -.8),y:actors[pi].y+.35};
    else if (t < .75) {
      const a=actorAt(pi,.2),b=actorAt(ri,.75),progress=(t-.2)/.55;
      ball={x:mix(a.x+(right ? .8 : -.8),b.x+(right ? .8 : -.8),progress),y:mix(a.y+.35,b.y+.35,progress)};
      if (Math.hypot(a.x-b.x,a.y-b.y)>25 || nodeIndex === 4) height=Math.sin(progress*Math.PI)*2;
    } else ball={x:actors[ri].x+(right ? .8 : -.8),y:actors[ri].y+.35};
  }
  const recent = replay?.event ?? getViewerEvents(cup).filter(e => e.at<=at && wallNow-e.at<(e.action?10000:8000)).at(-1);
  const age = replay ? Math.max(0,(wallNow-replay.startedAt)/1000) : recent ? (wallNow-recent.at)/1000 : Infinity;
  let status = cup.matchPaused ? "Verletzungspause" : nodeIndex<2 ? "Spielaufbau" : nodeIndex<5 ? strategy==="konter" ? "Schneller Konter" : "Passkombination" : "Ballzirkulation";
  const directionY = (direction?:string) => direction === "left" ? 31.4 : direction === "right" ? 36.6 : 34;
  let keeperDive: string | undefined;
  if (recent && age<6.5 && (recent.kind === "goal" || recent.kind === "penalty")) {
    const goalRight=recent.side === "club" ? clubRight : !clubRight;
    const scored=recent.kind === "goal" || recent.outcome === "goal";
    const scorer=actors.find(p => p.id===recent.playerId) ?? actors.find(p => p.team===recent.side && p.role==="ST");
    const keeper=actors.find(p => p.team!==recent.side && p.goalkeeper);
    const penalty=recent.kind==="penalty"||recent.style==="penalty";
    const longRange=recent.style==='long-range';
    const headed=recent.style==='header'||recent.style==='corner';
    const freeKick=recent.style==='free-kick';
    const source={x:goalRight ? penalty ? 94 : headed ? 91 : freeKick ? 77 : longRange ? 72 : 83 : penalty ? 11 : headed ? 14 : freeKick ? 28 : longRange ? 33 : 22,y:penalty ? 34 : 29+(hash(recent.id)*10)};
    const finish={x:goalRight ? scored ? 106 : recent.outcome==="save" ? 101.5 : 108 : scored ? -1 : recent.outcome==="save" ? 3.5 : -3,
      y:scored || recent.outcome==="save" ? directionY(recent.direction) : 23};
    const lead=replay&&recent.kind==='goal'&&!penalty?3:0;
    const shotProgress=clamp((age-lead)/1.35,0,1);
    ball={x:mix(source.x,finish.x,shotProgress),y:mix(source.y,finish.y,shotProgress)};height=0;
    if (scorer) {scorer.x=source.x+(goalRight ? -.8 : .8);scorer.y=source.y;}
    const assist=actors.find(p=>p.id===recent.assistId);
    if(assist){assist.x=goalRight?74:31;assist.y=recent.style==='cross'||recent.style==='header'?12:42;}
    if(recent.style==='header'||recent.style==='cross')height=Math.sin(shotProgress*Math.PI)*2;
    if(age<lead){
      const origin={x:goalRight?recent.style==='corner'?104:recent.style==='one-on-one'?64:69:recent.style==='corner'?1:recent.style==='one-on-one'?41:36,y:recent.style==='corner'?1:recent.style==='header'||recent.style==='cross'?10:44};
      const t=smooth(age/lead);ball={x:mix(origin.x,source.x,t),y:mix(origin.y,source.y,t)};
      height=headed||recent.style==='cross'?Math.sin(t*Math.PI)*4:0;
      if(recent.style==='one-on-one'&&scorer){scorer.x=ball.x;scorer.y=ball.y;ball.x+=goalRight?.8:-.8;}
      if(assist){assist.x=origin.x;assist.y=origin.y;}
      if(freeKick)actors.filter(p=>p.team!==recent.side&&!p.goalkeeper).slice(0,3).forEach((p,i)=>{p.x=goalRight?84:21;p.y=28+i*3;});
    }
    if(recent.kind==='goal'&&!replay){ball=finish;status='TOOOR!';}
    if (keeper) {
      keeper.x=goalRight ? 102 : 3;keeper.y=mix(34,recent.outcome==="save" ? finish.y : directionY(recent.keeperDirection),shotProgress);keeperDive=keeper.id;
      if (!penalty) keeper.y=mix(34,scored ? 37 : finish.y,shotProgress);
    }
    status=recent.kind==='goal'&&!replay ? "TOOOR!" : age<lead ? recent.style==='corner'?"Ecke · Flanke":freeKick?"Freistoss":recent.style==='one-on-one'?"Allein aufs Tor!":"Angriff · Zuspiel" : age<lead+1.35 ? replay ? "Torschuss" : scored ? "Tor bestätigt · Szene" : "Penalty · Szene" : scored ? "TOOOR!" : recent.outcome==="save" ? "Gehalten!" : "Vorbei!";
    if (age>lead+1.35 && scored && scorer) {
      actors.filter(p=>p.team===recent.side && !p.goalkeeper && p.id!==scorer.id).sort((a,b)=>Math.hypot(a.x-scorer.x,a.y-scorer.y)-Math.hypot(b.x-scorer.x,b.y-scorer.y)).slice(0,3).forEach((p,i)=>{
        const t=smooth((age-lead-1.35)/4);p.x=mix(p.x,scorer.x-3*(goalRight ? 1 : -1),t);p.y=mix(p.y,scorer.y+(i-1)*4,t);
      });
    }
  } else if (recent?.action && age<10) {
    const scene=renderBroadcastAction(actors,recent.action,age,clubRight);
    ball=scene.ball;height=scene.height;status=scene.status;keeperDive=scene.keeperDive;ballOwnerId=scene.ballOwnerId;
  } else if (recent && age<6.5) {status=recent.kind==="card" ? "Rote Karte" : "Spielunterbruch";}
  else if (recent && recent.kind === "goal" && age >= 6.5 && age < 8) {ball={x:52.5,y:34};status="Wiederanpfiff";}
  else if (cup.phase === "penalties") {ball={x:clubRight ? 94 : 11,y:34};status="Elfmeterschiessen";}
  const periodTransition=!replay && ((minute===46 || minute===91 || minute===106) && Math.floor(elapsed)%4<2);
  if (!replay && (elapsed<2 || periodTransition)) {ball={x:52.5,y:34};status=elapsed<2 ? "Anpfiff" : "Seitenwechsel";}
  return {actors,ball,height,minute,status,recent,age,keeperDive,ballOwnerId};
}

export function LiveMatchViewer({ features, now, clubName, clubColor, disabled=false, onTactic, onSubstitute }: { features: GameFeatures; now: number; clubName: string; clubColor: string; disabled?:boolean; onTactic?:(id:GameFeatures["cup"]["strategyId"])=>void; onSubstitute?:(id:string,slot:number)=>void }) {
  const [tab, setTab] = useState<Phase>("live");
  const [clock, setClock] = useState(now);
  const [replay, setReplay] = useState<Replay>();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [camera,setCamera]=useState<"full"|"follow"|"highlights">("full");
  const [fps,setFps]=useState(0);
  const [selectedPlayer,setSelectedPlayer]=useState<string>();
  const [expanded,setExpanded]=useState(false);
  const [subSlot,setSubSlot]=useState(0);
  const [subId,setSubId]=useState("");
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
  const activeReplay = replay && clock - replay.startedAt < 10000 ? replay : undefined;
  const frame = getVisualFrame(features, clock, activeReplay);
  const history = getViewerEvents(cup).filter((event) => event.at <= clock);
  const effectiveClock = cup.matchPaused ? cup.lastTickAt : Math.min(clock,cup.matchEndsAt);
  const regular = getCupRegularDurationMs(cup);
  const halfTimeTransition = !activeReplay && cup.active && [regular/2,regular,regular+regular/6].some(boundary => Math.abs(effectiveClock-cup.matchStartedAt-boundary)<1350);
  const visiting = Boolean(cup.fixture?.away);
  const home = visiting ? cup.opponent : clubName;
  const away = visiting ? clubName : cup.opponent;
  const homeScore = visiting ? cup.awayScore : cup.homeScore;
  const awayScore = visiting ? cup.homeScore : cup.awayScore;
  const phases: { id: Phase; label: string }[] = [
    { id: "live", label: "LIVE" }, { id: "fitness", label: "FITNESS" }, { id: "ratings", label: "NOTEN" },
    { id: "statistics", label: "STATISTIK" }, { id: "tactics", label: "TAKTIK" }, { id: "substitutions", label: "WECHSEL" }, { id: "highlights", label: "HIGHLIGHTS" },
  ];
  const colours = { club: clubColor || "#17875f", opponent: clubColor.toLowerCase() === "#e85d04" ? "#79b8ff" : "#ffc857" };
  return <section ref={viewerRef} className={`gc-match-viewer${expanded?" expanded":""}`} role={expanded?"dialog":undefined} aria-modal={expanded?true:undefined} aria-label="Animierte 2D-Live-Spielansicht">
    <div className="gc-viewer-tools"><span>{cup.mode==="season"?"SAISON":"POKAL"} · {cup.fixture?.venue.stadium??cup.opponent}</span><button type="button" onClick={()=>setExpanded(x=>!x)}>{expanded?"Ansicht schliessen":"Grosse Spielansicht"}</button></div>
    <div className="gc-viewer-scoreboard"><div><small>HEIM</small><strong><span className="gc-team-badge">{visiting?home.slice(0,2).toUpperCase():features.club.badge}</span> {home}</strong></div><div className="gc-viewer-score"><span>{homeScore} : {awayScore}</span><small>{!cup.active ? "ABPFIFF" : cup.matchPaused ? "PAUSIERT" : cup.phase === "penalties" ? "ELFMETERSCHIESSEN" : cup.phase === "extra-time" ? "VERLÄNGERUNG" : "LIVE"} · {getCupMatchMinute(cup,effectiveClock)}′{activeReplay ? ` · Replay ${frame.minute}′` : ""}</small></div><div><small>AUSWÄRTS</small><strong>{away} <span className="gc-team-badge">{visiting?features.club.badge:away.slice(0,2).toUpperCase()}</span></strong></div></div>
    {frame.recent && <div className="gc-viewer-caption" role="status"><time>{frame.recent.minute}′</time><strong>{eventLabel(frame.recent)} · {frame.recent.player}</strong>{frame.recent.assistId&&<span>Vorlage: {getStarXIPlayer(frame.recent.assistId)?.name}</span>}</div>}
    <div className="gc-viewer-main">
      <MatchTeamList features={features} actors={frame.actors.filter(p=>p.team===(visiting?'opponent':'club'))} minute={frame.minute} title={home} onSelect={setSelectedPlayer} />
      <div className="gc-viewer-pitch-shell">
        <div className="gc-viewer-pitch-head"><span><i className="gc-live-dot" /> {activeReplay ? "WIEDERHOLUNG" : frame.status}</span><span>{getStarFormation(features.starXI.formationId).label} · 2D</span></div>
        {frame.recent && !activeReplay && frame.age < .3 && <div className="gc-viewer-half-time"><strong>{frame.recent.kind === "goal" ? "TOR BESTÄTIGT" : frame.recent.kind === "penalty" ? "PENALTY" : "SPIELUNTERBRUCH"}</strong></div>}
        {halfTimeTransition && <div className="gc-viewer-half-time"><strong>{cup.phase === "extra-time" ? "VERLÄNGERUNG" : "HALBZEIT"}</strong><span>Seitenwechsel</span></div>}
        <MatchPitchCanvas features={features} now={now} replay={activeReplay} colours={colours} camera={camera} reducedMotion={reducedMotion} onSelect={setSelectedPlayer} onFps={setFps} />
        <div className="gc-viewer-cameras" role="group" aria-label="Kamera"><button type="button" aria-pressed={camera==='full'} onClick={()=>setCamera('full')}>Ganzes Feld</button><button type="button" aria-pressed={camera==='follow'} onClick={()=>setCamera('follow')}>Ball verfolgen</button><button type="button" aria-pressed={camera==='highlights'} onClick={()=>setCamera('highlights')}>Highlight-Kamera</button><small>{fps>0?`${fps} FPS`:''}</small></div>
        <div className="gc-viewer-legend"><span><i style={{ background: colours.club }} />{clubName}</span><span><i style={{ background: colours.opponent }} />{cup.opponent}</span><span>Live-Spielansicht</span></div>
        {activeReplay && <button type="button" className="gc-viewer-replay-exit" onClick={() => setReplay(undefined)}>Wiederholung beenden</button>}
      </div>
      <MatchTeamList features={features} actors={frame.actors.filter(p=>p.team===(visiting?'club':'opponent'))} minute={frame.minute} title={away} onSelect={setSelectedPlayer} />
    </div>
    {selectedPlayer && <div className="gc-viewer-player-detail"><strong>{frame.actors.find(p=>p.id===selectedPlayer)?.label??getStarXIPlayer(selectedPlayer)?.name}</strong><span>Fitness {Math.round(matchFitness(cup,selectedPlayer,frame.minute))}% · Note {frame.actors.find(p=>p.id===selectedPlayer)?.rating?.toFixed(1)??'–'}</span><button type="button" onClick={()=>setSelectedPlayer(undefined)}>Schliessen</button></div>}
    <div className="gc-viewer-tabs" role="tablist" aria-label="Spielansichten">{phases.map((item) => <button type="button" role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? "selected" : ""} onClick={() => { setTab(item.id); if (item.id !== "highlights") setReplay(undefined); }}>{item.label}</button>)}</div>
    <div className="gc-viewer-tab-panel" role="tabpanel">
      {tab === "live" && <div className="gc-viewer-events">{history.length ? history.slice(-5).reverse().map((e) => <div key={e.id}><time>{e.minute}′</time><span>{eventLabel(e)} · {e.player}</span></div>) : <span>Die Partie läuft. Tore, Karten und Wechsel erscheinen hier live.</span>}</div>}
      {tab === "ratings" && <div className="gc-viewer-player-list">{frame.actors.filter((p) => p.team === "club").sort((a,b) => (b.rating ?? 0) - (a.rating ?? 0)).map((p) => <div key={p.id}><span>{p.label} <small>{p.role}</small></span><strong>{p.rating === null ? "–" : p.rating.toFixed(1)}</strong></div>)}</div>}
      {tab === "fitness" && <><p>Fitness wird mit der Match-Uhr gespeichert. Einsatzzeit, Position, Taktik und vorhandene Ausdauerattribute bestimmen die Belastung.</p><div className="gc-viewer-player-list">{frame.actors.filter((p) => p.team === "club").map((p) => <div key={p.id}><span>{p.label}</span><progress max={100} value={matchFitness(cup,p.id,frame.minute)} aria-label={`Fitness von ${p.label}`} /></div>)}</div></>}
      {tab === "statistics" && <MatchStatistics features={features} clubName={clubName} />}
      {tab === "tactics" && <div className="gc-viewer-tactics"><p>Dein Plan: <strong>{CUP_STRATEGIES.find(s=>s.id===cup.strategyId)?.label}</strong> · Gegner: {CUP_STRATEGIES.find(s=>s.id===cup.opponentStrategyId)?.label}</p>{CUP_STRATEGIES.map(strategy=><button type="button" key={strategy.id} disabled={disabled||!cup.active||cup.phase==='penalties'||!onTactic} aria-pressed={cup.strategyId===strategy.id} onClick={()=>onTactic?.(strategy.id)}><strong>{strategy.label}</strong><small>{strategy.description}</small></button>)}</div>}
      {tab === "substitutions" && <div className="gc-viewer-substitutions"><p>{cup.substitutionsUsed} / {STAR_XI_MAX_SUBSTITUTIONS} Wechsel · Neu eingewechselte Spieler starten frisch.</p><label>Spieler auf dem Feld<select value={subSlot} onChange={e=>{setSubSlot(Number(e.target.value));setSubId('');}}>{features.starXI.lineupIds.map((id,i)=>getStarXIPlayer(id)&&!cup.sentOffPlayerIds.includes(id)?<option key={i} value={i}>{getStarXIPlayer(id)?.name} · {features.starXI.formationPositions[i]} · {Math.round(matchFitness(cup,id,frame.minute))}%</option>:null)}</select></label><label>Ersatzspieler<select value={subId} onChange={e=>setSubId(e.target.value)}><option value="">Bankspieler wählen</option>{features.starXI.benchIds.filter(id=>id&&!cup.playerExitedAt[id]&&!cup.sentOffPlayerIds.includes(id)&&!cup.injuredPlayerIds[id]&&canStarXIPlayerFillSlot(id,subSlot,features.starXI.formationPositions)).map(id=><option key={id} value={id}>{getStarXIPlayer(id)?.name} · {getStarXIPositions(getStarXIPlayer(id)!).join('/')}</option>)}</select></label><button type="button" disabled={disabled||!cup.active||cup.phase==='penalties'||!subId||cup.substitutionsUsed>=STAR_XI_MAX_SUBSTITUTIONS||!onSubstitute} onClick={()=>{onSubstitute?.(subId,subSlot);setSubId('');}}>Jetzt einwechseln</button></div>}
      {tab === "highlights" && <div className="gc-viewer-events">{history.length ? history.slice().reverse().map((event) => <button key={event.id} type="button" onClick={() => setReplay({ event, startedAt: clock })}><time>{event.minute}′</time><span>{eventLabel(event)} · {event.player}</span><b>▶</b></button>) : <p>Noch keine offiziellen Highlights vorhanden.</p>}{activeReplay && <small>Rekonstruierte Szene aus den gespeicherten Match-Ereignissen; keine echte Videoaufnahme.</small>}</div>}
    </div>
  </section>;
}

function MatchTeamList({features,actors,minute,title,onSelect}:{features:GameFeatures;actors:Actor[];minute:number;title:string;onSelect:(id:string)=>void}) {
 const cup=features.cup,captain=actors.filter(p=>!p.goalkeeper).sort((a,b)=>Number(a.shirt)-Number(b.shirt))[0]?.id;
 return <aside className="gc-team-list" aria-label={`Aufstellung ${title}`}><h4>{title}</h4>{actors.map(p=><button key={p.id} type="button" onClick={()=>onSelect(p.id)}><b>{p.shirt}</b><span><strong>{p.label}{p.id===captain?' ©':''}</strong><small>{p.role}{cup.matchEvents.some(e=>e.scorerId===p.id)?' ⚽':''}{cup.broadcast?.events.some(e=>e.kind==='yellow'&&e.playerId===p.id)?' 🟨':''}</small><progress value={matchFitness(cup,p.id,minute)} max={100} aria-label={`Fitness ${p.label}`} /></span><em>{p.rating?.toFixed(1)??'–'}</em></button>)}{actors.some(p=>p.team==='club')&&cup.cardEvents.map(e=><small className="gc-dismissed" key={e.id}>🟥 {e.player} · {e.minute}′</small>)}</aside>;
}
function MatchStatistics({features,clubName}:{features:GameFeatures;clubName:string}) {
 const c=features.cup,b=c.broadcast,a=b?.clubStats,o=b?.opponentStats;
 const goals=c.matchEvents,ownGoals=goals.filter(e=>e.side==='home'),otherGoals=goals.filter(e=>e.side==='away');
 const total=(a?.possessionSeconds??0)+(o?.possessionSeconds??0),own=total?Math.round((a!.possessionSeconds/total)*100):50;
 const rows:[string,string|number,string|number][]=[['Tore',c.homeScore,c.awayScore],['Ballbesitz',`${own}%`,`${100-own}%`],['Schüsse',(a?.shots??0)+ownGoals.length,(o?.shots??0)+otherGoals.length],['Aufs Tor',(a?.onTarget??0)+ownGoals.length,(o?.onTarget??0)+otherGoals.length],['Paraden',a?.saves??0,o?.saves??0],['Ecken',(a?.corners??0)+ownGoals.filter(e=>e.pattern==='corner').length,(o?.corners??0)+otherGoals.filter(e=>e.pattern==='corner').length],['Freistösse',(a?.freeKicks??0)+ownGoals.filter(e=>e.pattern==='free-kick').length,(o?.freeKicks??0)+otherGoals.filter(e=>e.pattern==='free-kick').length],['Gelbe Karten',a?.yellowCards??0,o?.yellowCards??0],['Rote Karten',c.cardEvents.filter(e=>e.side==='home').length,c.cardEvents.filter(e=>e.side==='away').length]];
 return <table className="gc-match-statistics"><thead><tr><th>{clubName}</th><th>Statistik</th><th>{c.opponent}</th></tr></thead><tbody>{rows.map(([label,club,opponent])=><tr key={label}><td>{club}</td><th>{label}</th><td>{opponent}</td></tr>)}</tbody></table>;
}
