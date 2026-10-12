"use client";

import { useEffect, useState } from "react";
import { getCupMatchMinute, getCupRegularDurationMs, getCupPlayerMatchRating, getStarFormation, getStarXIPlayer } from "./feature-data";
import type { CupState, GameFeatures, StarPosition } from "./feature-data";

type Team = "club" | "opponent";
type Phase = "live" | "fitness" | "ratings" | "statistics" | "tactics" | "substitutions" | "highlights";
export type Actor = { id: string; label: string; shirt: string; team: Team; role: StarPosition; x: number; y: number; goalkeeper: boolean; rating: number | null };
export type MatchEvent = { id: string; kind: "goal" | "card" | "injury" | "penalty"; at: number; minute: number; side: Team; player: string; playerId: string | null; outcome?: string; direction?: string; keeperDirection?: string };
export type Replay = { event: MatchEvent; startedAt: number };

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
const smooth = (x: number) => { const v = clamp(x, 0, 1); return v * v * (3 - 2 * v); };
const hash = (text: string) => { let x = 2166136261; for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 16777619); return (x >>> 0) / 4294967295; };

export function getViewerEvents(cup: CupState): MatchEvent[] {
  return [
    ...cup.matchEvents.map((e) => ({ id: e.id, kind: "goal" as const, at: e.createdAt, minute: e.minute, side: e.side === "home" ? "club" as const : "opponent" as const, player: e.scorer, playerId: e.scorerId })),
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
  const formation = getStarFormation(features.starXI.formationId);
  const roster = replay ? [...new Set([...cup.originalLineupIds, ...Object.keys(cup.playerEnteredAt)])]
    .filter(id => id && (cup.playerEnteredAt[id] ?? 1) <= minute && (cup.playerExitedAt[id] ?? 121) > minute) : features.starXI.lineupIds;
  const occupied = new Set<number>();
  const active = roster.flatMap((id, i) => {
    const p = getStarXIPlayer(id);
    if (!p || !replay && (cup.sentOffPlayerIds.includes(id) || (cup.playerExitedAt[id] ?? 121) <= minute)) return [];
    let slotIndex = replay ? cup.originalLineupIds.indexOf(id) : i;
    const role = cup.playerMatchPositions[id] ?? features.starXI.formationPositions[i] ?? p.position;
    if (slotIndex < 0) slotIndex = formation.slots.findIndex((slot,index) => slot.position === role && !occupied.has(index));
    if (slotIndex < 0) slotIndex = formation.slots.findIndex((_,index) => !occupied.has(index));
    const slot = formation.slots[slotIndex];
    if (!slot) return [];
    occupied.add(slotIndex);
    const forward = 12 + (100 - slot.y) / 100 * 68;
    const goalkeeper = role === "TW";
    return [{ id, label: p.name, shirt: String(slotIndex + 1), team: "club" as const, role,
      x: goalkeeper ? (clubRight ? 3 : 102) : clubRight ? forward : 105-forward,
      y: goalkeeper ? 34 : 5 + slot.x * 0.58, goalkeeper, rating: getCupPlayerMatchRating(cup, id, minute) }];
  });
  // Opponent IDs in CupState identify clubs, not a roster. Display positional markers honestly.
  const visitors = getStarFormation("433").slots.map((slot, i) => {
    const forward = 12 + (100 - slot.y) / 100 * 68, goalkeeper = slot.position === "TW";
    return { id: "opponent-" + i, label: "Gegner " + slot.position, shirt: String(i + 1), team: "opponent" as const, role: slot.position,
      x: goalkeeper ? (clubRight ? 102 : 3) : clubRight ? 105-forward : forward,
      y: goalkeeper ? 34 : 5 + slot.x * 0.58, goalkeeper, rating: null };
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
function targetsAtNode(base: Actor[], team: Team, node: {x:number;y:number}, strategy: string) {
  if (node.x === 52.5 && node.y === 34) {
    const club = closestCarrier(base,"club",node), opponent = closestCarrier(base,"opponent",node);
    return base.map(p => p.id === club?.id || p.id === opponent?.id ? {...p,x:52.5,y:34} : {...p});
  }
  const carrier = closestCarrier(base,team,node);
  const presser = base.filter(p => p.team !== team && !p.goalkeeper).sort((a,b) => Math.hypot(a.x-node.x,a.y-node.y)-Math.hypot(b.x-node.x,b.y-node.y))[0];
  return base.map(p => {
    if (p.goalkeeper) return {...p, x:p.x, y:clamp(34+(node.y-34)*.22,29,39)};
    if (p.id === carrier?.id) return {...p,...node};
    const press = strategy === "angriff" ? .25 : strategy === "konter" ? .09 : .14;
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
  const start = separateTargets(targetsAtNode(base,possession,from,strategy)), end = separateTargets(targetsAtNode(base,possession,to,strategy));
  const actorAt = (index:number,phase:number) => ({...start[index],x:mix(start[index].x,end[index].x,smooth(phase)),y:mix(start[index].y,end[index].y,smooth(phase))});
  const actors = base.map((_,i) => actorAt(i,t));
  const passer = closestCarrier(base,possession,from), receiver = closestCarrier(base,possession,to);
  const pi = actors.findIndex(p => p.id === passer?.id), ri = actors.findIndex(p => p.id === receiver?.id);
  let ball = {x:52.5,y:34};
  let height = 0;
  if (pi >= 0 && ri >= 0) {
    if (pi === ri || t < .2) ball={x:actors[pi].x+(right ? .8 : -.8),y:actors[pi].y+.35};
    else if (t < .75) {
      const a=actorAt(pi,.2),b=actorAt(ri,.75),progress=(t-.2)/.55;
      ball={x:mix(a.x+(right ? .8 : -.8),b.x+(right ? .8 : -.8),progress),y:mix(a.y+.35,b.y+.35,progress)};
      if (Math.hypot(a.x-b.x,a.y-b.y)>25 || nodeIndex === 4) height=Math.sin(progress*Math.PI)*2;
    } else ball={x:actors[ri].x+(right ? .8 : -.8),y:actors[ri].y+.35};
  }
  const recent = replay?.event ?? getViewerEvents(cup).filter(e => e.at<=at && wallNow-e.at<8000).at(-1);
  const age = replay ? Math.max(0,(wallNow-replay.startedAt)/1000) : recent ? (wallNow-recent.at)/1000 : Infinity;
  let status = cup.matchPaused ? "Verletzungspause" : nodeIndex<2 ? "Spielaufbau" : nodeIndex<5 ? strategy==="konter" ? "Schneller Konter" : "Passkombination" : "Ballzirkulation";
  const directionY = (direction?:string) => direction === "left" ? 31.4 : direction === "right" ? 36.6 : 34;
  let keeperDive: string | undefined;
  if (recent && age<6.5 && (recent.kind === "goal" || recent.kind === "penalty")) {
    const goalRight=recent.side === "club" ? clubRight : !clubRight;
    const scored=recent.kind === "goal" || recent.outcome === "goal";
    const scorer=actors.find(p => p.id===recent.playerId) ?? actors.find(p => p.team===recent.side && p.role==="ST");
    const keeper=actors.find(p => p.team!==recent.side && p.goalkeeper);
    const penalty=recent.kind==="penalty";
    const source={x:goalRight ? penalty ? 94 : 83 : penalty ? 11 : 22,y:penalty ? 34 : 29+(hash(recent.id)*10)};
    const finish={x:goalRight ? scored ? 106 : recent.outcome==="save" ? 101.5 : 108 : scored ? -1 : recent.outcome==="save" ? 3.5 : -3,
      y:scored || recent.outcome==="save" ? directionY(recent.direction) : 23};
    const shotProgress=clamp(age/1.35,0,1);
    ball={x:mix(source.x,finish.x,shotProgress),y:mix(source.y,finish.y,shotProgress)};height=0;
    if (scorer) {scorer.x=source.x+(goalRight ? -.8 : .8);scorer.y=source.y;}
    if (keeper) {
      keeper.x=goalRight ? 102 : 3;keeper.y=mix(34,directionY(recent.keeperDirection),shotProgress);keeperDive=keeper.id;
      if (!penalty) keeper.y=mix(34,scored ? 37 : finish.y,shotProgress);
    }
    status=age<1.35 ? replay ? "Torschuss" : scored ? "Tor bestätigt · Szene" : "Penalty · Szene" : scored ? "TOOOR!" : recent.outcome==="save" ? "Gehalten!" : "Vorbei!";
    if (age>1.35 && scored && scorer) {
      actors.filter(p=>p.team===recent.side && !p.goalkeeper && p.id!==scorer.id).sort((a,b)=>Math.hypot(a.x-scorer.x,a.y-scorer.y)-Math.hypot(b.x-scorer.x,b.y-scorer.y)).slice(0,3).forEach((p,i)=>{
        const t=smooth((age-1.35)/4);p.x=mix(p.x,scorer.x-3*(goalRight ? 1 : -1),t);p.y=mix(p.y,scorer.y+(i-1)*4,t);
      });
    }
  } else if (recent && age<6.5) {status=recent.kind==="card" ? "Rote Karte" : "Spielunterbruch";}
  else if (recent && recent.kind === "goal" && age >= 6.5 && age < 8) {ball={x:52.5,y:34};status="Wiederanpfiff";}
  else if (cup.phase === "penalties") {ball={x:clubRight ? 94 : 11,y:34};status="Elfmeterschiessen";}
  const periodTransition=!replay && ((minute===46 || minute===91 || minute===106) && Math.floor(elapsed)%4<2);
  if (!replay && (elapsed<2 || periodTransition)) {ball={x:52.5,y:34};status=elapsed<2 ? "Anpfiff" : "Seitenwechsel";}
  return {actors,ball,height,minute,status,recent,age,keeperDive};
}

export function LiveMatchViewer({ features, now, clubName, clubColor }: { features: GameFeatures; now: number; clubName: string; clubColor: string }) {
  const [tab, setTab] = useState<Phase>("live");
  const [clock, setClock] = useState(now);
  const [replay, setReplay] = useState<Replay>();
  const [reducedMotion, setReducedMotion] = useState(false);
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
      if (timestamp - previous >= (reducedMotion ? 1000 : 33) && document.visibilityState === "visible") {
        setClock(Date.now() + offset);
        previous = timestamp;
      }
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [now, reducedMotion]);
  const cup = features.cup;
  const activeReplay = replay && clock - replay.startedAt < 6500 ? replay : undefined;
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
  return <section className="gc-match-viewer" aria-label="Animierte 2D-Live-Spielansicht">
    <div className="gc-viewer-scoreboard"><div><small>HEIM</small><strong>{home}</strong></div><div className="gc-viewer-score"><span>{homeScore} : {awayScore}</span><small>{!cup.active ? "ABPFIFF" : cup.matchPaused ? "PAUSIERT" : cup.phase === "penalties" ? "ELFMETERSCHIESSEN" : cup.phase === "extra-time" ? "VERLÄNGERUNG" : "LIVE"} · {getCupMatchMinute(cup,effectiveClock)}′{activeReplay ? ` · Replay ${frame.minute}′` : ""}</small></div><div><small>AUSWÄRTS</small><strong>{away}</strong></div></div>
    <div className="gc-viewer-main">
      <div className="gc-viewer-pitch-shell">
        <div className="gc-viewer-pitch-head"><span><i className="gc-live-dot" /> {activeReplay ? "WIEDERHOLUNG" : frame.status}</span><span>{getStarFormation(features.starXI.formationId).label} · 2D</span></div>
        {frame.recent && !activeReplay && frame.age < .3 && <div className="gc-viewer-half-time"><strong>{frame.recent.kind === "goal" ? "TOR BESTÄTIGT" : frame.recent.kind === "penalty" ? "PENALTY" : "SPIELUNTERBRUCH"}</strong></div>}
        {halfTimeTransition && <div className="gc-viewer-half-time"><strong>{cup.phase === "extra-time" ? "VERLÄNGERUNG" : "HALBZEIT"}</strong><span>Seitenwechsel</span></div>}
        <svg className="gc-viewer-pitch" viewBox="-3 -3 111 74" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Taktische Draufsicht mit animierten Spielern, Ball und Spielfeld">
          <defs><pattern id="gc-grass" width="15" height="68" patternUnits="userSpaceOnUse"><rect width="15" height="68" fill="#207c4d"/><rect width="7.5" height="68" fill="#247f50"/></pattern></defs>
          <rect x="0" y="0" width="105" height="68" rx="1" fill="url(#gc-grass)" stroke="#d1f1da" strokeWidth=".65"/>
          <g fill="none" stroke="#d3f3df" strokeWidth=".38" opacity=".9">
            <path d="M 52.5 0 V 68"/><circle cx="52.5" cy="34" r="9.15"/><circle cx="52.5" cy="34" r=".5" fill="#d3f3df"/>
            <path d="M 0 13.8 H 16.5 V 54.2 H 0 M 105 13.8 H 88.5 V 54.2 H 105"/>
            <path d="M 0 24.8 H 5.5 V 43.2 H 0 M 105 24.8 H 99.5 V 43.2 H 105"/>
            <path d="M 16.5 26 A 9.15 9.15 0 0 1 16.5 42 M 88.5 26 A 9.15 9.15 0 0 0 88.5 42"/>
            <path d="M 1 0 A 1 1 0 0 1 0 1 M 104 0 A 1 1 0 0 0 105 1 M 0 67 A 1 1 0 0 1 1 68 M 104 68 A 1 1 0 0 1 105 67"/><circle cx="11" cy="34" r=".4" fill="#d3f3df"/><circle cx="94" cy="34" r=".4" fill="#d3f3df"/>
          </g>
          <path d="M 0 30 H -2 V 38 H 0 M 105 30 H 107 V 38 H 105" fill="none" stroke="white" strokeWidth=".75"/>
          {frame.actors.map((p) => <g key={p.id} transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`}>
            <title>{p.label} · {p.role}</title>{frame.keeperDive === p.id && <ellipse rx="3" ry="1.25" fill="#a6e4ff" opacity=".45" />}<circle r="2.13" fill={p.team === "club" ? colours.club : colours.opponent} stroke="#f5faf6" strokeWidth=".48"/>
            <text y=".68" fontSize="2.12" fontWeight="800" textAnchor="middle" fill={p.team === "club" ? "white" : "#09221b"} stroke={p.team === "club" ? "#09221b" : "none"} strokeWidth=".13" paintOrder="stroke">{p.goalkeeper ? "TW" : p.shirt}</text>
          </g>)}
          <circle cx={frame.ball.x} cy={frame.ball.y} r={1.12+frame.height*.17} fill="#fff" stroke="#172725" strokeWidth=".36"/>
          <circle cx={frame.ball.x - .24} cy={frame.ball.y - .22} r=".21" fill="#192a28"/>
        </svg>
        <div className="gc-viewer-legend"><span><i style={{ background: colours.club }} />{clubName}</span><span><i style={{ background: colours.opponent }} />{cup.opponent}</span><span>Gegneraufstellung: Positionsmarker</span></div>
        {activeReplay && <button type="button" className="gc-viewer-replay-exit" onClick={() => setReplay(undefined)}>Wiederholung beenden</button>}
      </div>
    </div>
    <div className="gc-viewer-tabs" role="tablist" aria-label="Spielansichten">{phases.map((item) => <button type="button" role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? "selected" : ""} onClick={() => { setTab(item.id); if (item.id !== "highlights") setReplay(undefined); }}>{item.label}</button>)}</div>
    <div className="gc-viewer-tab-panel" role="tabpanel">
      {tab === "live" && <div className="gc-viewer-events">{history.length ? history.slice(-5).reverse().map((e) => <div key={e.id}><time>{e.minute}′</time><span>{e.kind === "goal" ? "Tor" : e.kind === "card" ? "Rote Karte" : e.kind === "injury" ? "Verletzung" : "Penalty"} · {e.player}</span></div>) : <span>Die Partie läuft. Tore, Karten und Wechsel erscheinen hier live.</span>}</div>}
      {tab === "ratings" && <div className="gc-viewer-player-list">{frame.actors.filter((p) => p.team === "club").sort((a,b) => (b.rating ?? 0) - (a.rating ?? 0)).map((p) => <div key={p.id}><span>{p.label} <small>{p.role}</small></span><strong>{p.rating === null ? "–" : p.rating.toFixed(1)}</strong></div>)}</div>}
      {tab === "fitness" && <><p>Geschätzte Belastung anhand von Einsatzzeit und Taktik. Kein zusätzlicher Einfluss auf das Ergebnis.</p><div className="gc-viewer-player-list">{frame.actors.filter((p) => p.team === "club").map((p) => <div key={p.id}><span>{p.label}</span><progress max={100} value={Math.max(25,100-Math.max(0,frame.minute-(cup.playerEnteredAt[p.id] ?? 1))*(p.goalkeeper ? .16 : cup.strategyId === "angriff" ? .65 : .45))} aria-label={`Geschätzte Fitness von ${p.label}`} /></div>)}</div></>}
      {tab === "statistics" && <div className="gc-viewer-stat-grid"><div><span>Tore Club</span><b>{cup.homeScore}</b></div><div><span>Tore Gegner</span><b>{cup.awayScore}</b></div><div><span>Rote Karten</span><b>{cup.cardEvents.length}</b></div><div><span>Wechsel</span><b>{cup.substitutionsUsed}</b></div></div>}
      {tab === "tactics" && <p>Taktik: <strong>{cup.strategyId === "angriff" ? "Offensivpressing" : cup.strategyId === "konter" ? "Schneller Konter" : "Ballbesitz"}</strong>. Die bestehenden Taktikbuttons unter dem Spielfeld bleiben für Änderungen zuständig. <a href="#gc-live-tactics">Taktik ändern</a></p>}
      {tab === "substitutions" && <p>{cup.substitutionsUsed} Wechsel durchgeführt. Wähle unten in deiner Startelf einen Spieler und anschliessend einen passenden Bankspieler. <a href="#gc-live-bench">Zur Wechselbank</a></p>}
      {tab === "highlights" && <div className="gc-viewer-events">{history.length ? history.slice().reverse().map((event) => <button key={event.id} type="button" onClick={() => setReplay({ event, startedAt: clock })}><time>{event.minute}′</time><span>{event.kind === "goal" ? "Tor" : event.kind === "card" ? "Rote Karte" : event.kind === "injury" ? "Verletzung" : "Penalty"} · {event.player}</span><b>▶</b></button>) : <p>Noch keine offiziellen Highlights vorhanden.</p>}{activeReplay && <small>Rekonstruierte Szene aus den gespeicherten Match-Ereignissen; keine echte Videoaufnahme.</small>}</div>}
    </div>
  </section>;
}
