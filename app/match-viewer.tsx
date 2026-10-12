"use client";

import { useEffect, useState } from "react";
import { getCupMatchMinute, getCupRegularDurationMs, getCupPlayerMatchRating, getStarFormation, getStarXIPlayer } from "./feature-data";
import type { CupState, GameFeatures, StarPosition } from "./feature-data";

type Team = "club" | "opponent";
type Phase = "live" | "fitness" | "ratings" | "statistics" | "tactics" | "substitutions" | "highlights";
type Actor = { id: string; label: string; shirt: string; team: Team; role: StarPosition; x: number; y: number; goalkeeper: boolean; rating: number | null };
type MatchEvent = { id: string; kind: "goal" | "card" | "injury" | "penalty"; at: number; minute: number; side: Team; player: string; playerId: string | null; outcome?: string };
type Replay = { event: MatchEvent; startedAt: number };

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
const smooth = (x: number) => { const v = clamp(x, 0, 1); return v * v * (3 - 2 * v); };
const hash = (text: string) => { let x = 2166136261; for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 16777619); return (x >>> 0) / 4294967295; };

export function getViewerEvents(cup: CupState): MatchEvent[] {
  return [
    ...cup.matchEvents.map((e) => ({ id: e.id, kind: "goal" as const, at: e.createdAt, minute: e.minute, side: e.side === "home" ? "club" as const : "opponent" as const, player: e.scorer, playerId: e.scorerId })),
    ...cup.cardEvents.map((e) => ({ id: e.id, kind: "card" as const, at: e.createdAt, minute: e.minute, side: e.side === "home" ? "club" as const : "opponent" as const, player: e.player, playerId: e.playerId })),
    ...cup.injuryEvents.map((e) => ({ id: e.id, kind: "injury" as const, at: e.createdAt, minute: e.minute, side: "club" as const, player: e.player, playerId: e.playerId })),
    ...cup.penaltyEvents.map((e) => ({ id: e.id, kind: "penalty" as const, at: e.createdAt, minute: 120, side: e.side === "home" ? "club" as const : "opponent" as const, player: e.player, playerId: e.playerId, outcome: e.outcome })),
  ].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

function baseActors(features: GameFeatures, cup: CupState, minute: number, clubRight: boolean): Actor[] {
  const formation = getStarFormation(features.starXI.formationId);
  const active = features.starXI.lineupIds.flatMap((id, i) => {
    const p = getStarXIPlayer(id);
    const slot = formation.slots[i];
    if (!p || !slot || cup.sentOffPlayerIds.includes(id) || (cup.playerExitedAt[id] && cup.playerExitedAt[id] <= minute && !cup.playerEnteredAt[id])) return [];
    const progress = (100 - slot.y) / 100;
    const x = clubRight ? 7 + progress * 87 : 98 - progress * 87;
    const role = features.starXI.formationPositions[i] ?? slot.position;
    return [{ id, label: p.name, shirt: String(i + 1), team: "club" as const, role, x, y: 5 + slot.x * 0.58, goalkeeper: role === "TW", rating: getCupPlayerMatchRating(cup, id, minute) }];
  });
  // The authoritative simulator currently records opponent scorers, not an eleven-player roster.
  // Neutral positional labels avoid inventing real opponent player identities or statistics.
  const visitors = getStarFormation("433").slots.map((slot, i) => {
    const progress = (100 - slot.y) / 100;
    return { id: "opponent-" + i, label: "Gegner " + slot.position, shirt: String(i + 1), team: "opponent" as const, role: slot.position,
      x: clubRight ? 98 - progress * 87 : 7 + progress * 87, y: 5 + slot.x * 0.58,
      goalkeeper: slot.position === "TW", rating: null };
  });
  return [...active, ...visitors];
}

function getVisualFrame(features: GameFeatures, wallNow: number, replay?: Replay) {
  const cup = features.cup;
  const minute = replay ? replay.event.minute : getCupMatchMinute(cup, cup.matchPaused ? cup.lastTickAt : wallNow);
  const clubRight = (minute <= 45) !== Boolean(cup.fixture?.away);
  const base = baseActors(features, cup, minute, clubRight);
  const elapsed = Math.max(0, ((cup.matchPaused ? cup.lastTickAt : wallNow) - cup.matchStartedAt) / 1000);
  const turnover = Math.floor(elapsed / 16);
  const possession: Team = turnover % 2 === 0 ? "club" : "opponent";
  const teamRight = possession === "club" ? clubRight : !clubRight;
  const step = Math.floor(elapsed / 4);
  const transition = (elapsed % 4) / 4;
  const attackPhase = step % 4;
  const strategy = features.cup.strategyId;
  const ownBallX = teamRight ? 1 : 104;
  const advance = (progress: number) => mix(ownBallX, teamRight ? 101 : 4, progress);
  const seed = String(cup.matchStartedAt) + cup.opponent;
  const lane = (n: number) => clamp(34 + (hash(seed + ":lane:" + n) - 0.5) * (strategy === "ballbesitz" ? 27 : 43), 10, 58);
  const x0 = advance((attackPhase + 1) / 5);
  const x1 = advance((attackPhase + 2) / 5);
  const y0 = lane(step);
  const y1 = lane(step + 1);
  let ball = { x: mix(x0, x1, smooth(transition)), y: mix(y0, y1, smooth(transition)) };
  const events = getViewerEvents(cup);
  const recent = replay?.event ?? events.filter((e) => e.at <= wallNow && wallNow - e.at < 5200).at(-1);
  const age = replay ? (Date.now() - replay.startedAt) / 1000 : recent ? (wallNow - recent.at) / 1000 : Number.POSITIVE_INFINITY;
  let status = cup.matchPaused ? "Verletzungspause" : possession === "club" ? "Spielaufbau" : "Gegner im Ballbesitz";

  const actors = base.map((p) => {
    if (cup.phase === "penalties" && !replay) {
      if (p.goalkeeper) return { ...p, x: p.x < 52 ? 3 : 102, y: 34 };
      return p;
    }
    if (p.goalkeeper) return { ...p, y: mix(p.y, clamp(ball.y, 23, 45), 0.2) };
    const attacking = p.team === possession;
    const press = attacking ? 0.19 : strategy === "angriff" ? 0.19 : strategy === "konter" ? 0.08 : 0.12;
    const drift = Math.sin(elapsed / 2.8 + p.y / 10 + hash(p.id) * 3.14);
    // Shape is anchored to the selected formation; ball-oriented movement only alters the shape modestly.
    return { ...p, x: clamp(p.x + (ball.x - p.x) * press + drift * 0.75, 3, 102),
      y: clamp(p.y + (ball.y - p.y) * (attacking ? 0.2 : 0.14) + drift * 1.2, 3, 65) };
  });

  if (!replay && cup.phase === "penalties") {
    ball = { x: clubRight ? 94 : 11, y: 34 };
    status = "Elfmeterschiessen";
  } else if (recent && age < 5.2) {
    if (recent.kind === "goal") {
      const goalRight = recent.side === "club" ? clubRight : !clubRight;
      const targetX = goalRight ? 106 : -1;
      ball = { x: mix(goalRight ? 83 : 22, targetX, Math.min(1, age / 1.35)), y: mix(29, 34, Math.min(1, age / 1.35)) };
      status = age < 1.35 ? "Torschuss!" : "TOOOR!";
      const scorer = actors.find((p) => p.id === recent.playerId);
      if (scorer) {
        scorer.x = mix(scorer.x, goalRight ? 84 : 21, 0.65);
        scorer.y = mix(scorer.y, 30, 0.65);
        if (age > 1.35) {
          const progress = smooth((age - 1.35) / 2.1);
          const nearest = actors.filter((p) => p.team === recent.side && p.id !== scorer.id && !p.goalkeeper)
            .sort((a, b) => Math.hypot(a.x - scorer.x, a.y - scorer.y) - Math.hypot(b.x - scorer.x, b.y - scorer.y)).slice(0, 4);
          nearest.forEach((teammate, index) => {
            teammate.x = mix(teammate.x, scorer.x + (index % 2 ? 3 : -3), progress);
            teammate.y = mix(teammate.y, scorer.y + (index < 2 ? -3 : 3), progress);
          });
        }
      }
    } else if (recent.kind === "card") status = "Rote Karte";
    else if (recent.kind === "injury") status = "Spielunterbruch";
    else if (recent.kind === "penalty") {
      status = recent.outcome === "goal" ? "Penalty verwandelt!" : "Penalty nicht verwandelt";
      const goalRight = recent.side === "club" ? clubRight : !clubRight;
      ball = { x: mix(goalRight ? 94 : 11, goalRight ? 106 : -1, Math.min(1, age / 1.2)), y: 34 };
    }
  } else if (cup.phase !== "penalties") {
    const eligible = actors.filter((p) => !p.goalkeeper && p.team === possession);
    const carrier = eligible.reduce<Actor | null>((closest, p) => !closest || Math.hypot(p.x - ball.x, p.y - ball.y) < Math.hypot(closest.x - ball.x, closest.y - ball.y) ? p : closest, null);
    if (carrier) {
      const target = actors.find((p) => p.id === carrier.id);
      if (target) { target.x = mix(target.x, ball.x, 0.7); target.y = mix(target.y, ball.y, 0.7); }
    }
    status = attackPhase === 0 ? "Aufbau" : attackPhase === 1 ? "Mittelfeld" : attackPhase === 2 ? "Angriff" : "Letztes Drittel";
  }
  return { actors, ball, minute, status, recent, age };
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
  const frame = getVisualFrame(features, clock, replay);
  const history = getViewerEvents(cup).filter((event) => event.at <= clock);
  const halfTimeTransition = !replay && cup.phase === "regular" && Math.abs(clock - cup.matchStartedAt - getCupRegularDurationMs(cup) / 2) < 1350;
  const visiting = Boolean(cup.fixture?.away);
  const home = visiting ? cup.opponent : clubName;
  const away = visiting ? clubName : cup.opponent;
  const homeScore = visiting ? cup.awayScore : cup.homeScore;
  const awayScore = visiting ? cup.homeScore : cup.awayScore;
  const phases: { id: Phase; label: string }[] = [
    { id: "live", label: "LIVE" }, { id: "fitness", label: "FITNESS" }, { id: "ratings", label: "NOTEN" },
    { id: "statistics", label: "STATISTIK" }, { id: "tactics", label: "TAKTIK" }, { id: "substitutions", label: "WECHSEL" }, { id: "highlights", label: "HIGHLIGHTS" },
  ];
  const colours = { club: clubColor || "#17875f", opponent: "#ffc857" };
  return <section className="gc-match-viewer" aria-label="Animierte 2D-Live-Spielansicht">
    <div className="gc-viewer-scoreboard"><div><small>HEIM</small><strong>{home}</strong></div><div className="gc-viewer-score"><span>{homeScore} : {awayScore}</span><small>{cup.phase === "penalties" ? "ELFMETERSCHIESSEN" : cup.phase === "extra-time" ? "VERLÄNGERUNG" : "LIVE"} · {frame.minute}′</small></div><div><small>AUSWÄRTS</small><strong>{away}</strong></div></div>
    <div className="gc-viewer-main">
      <div className="gc-viewer-pitch-shell">
        <div className="gc-viewer-pitch-head"><span><i className="gc-live-dot" /> {replay ? "WIEDERHOLUNG" : frame.status}</span><span>{getStarFormation(features.starXI.formationId).label} · 2D</span></div>
        {halfTimeTransition && <div className="gc-viewer-half-time"><strong>HALBZEIT</strong><span>Seitenwechsel</span></div>}
        <svg className="gc-viewer-pitch" viewBox="-3 -3 111 74" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Taktische Draufsicht mit animierten Spielern, Ball und Spielfeld">
          <defs><pattern id="gc-grass" width="15" height="68" patternUnits="userSpaceOnUse"><rect width="15" height="68" fill="#207c4d"/><rect width="7.5" height="68" fill="#247f50"/></pattern></defs>
          <rect x="0" y="0" width="105" height="68" rx="1" fill="url(#gc-grass)" stroke="#d1f1da" strokeWidth=".65"/>
          <g fill="none" stroke="#d3f3df" strokeWidth=".38" opacity=".9">
            <path d="M 52.5 0 V 68"/><circle cx="52.5" cy="34" r="9.15"/><circle cx="52.5" cy="34" r=".5" fill="#d3f3df"/>
            <path d="M 0 13.8 H 16.5 V 54.2 H 0 M 105 13.8 H 88.5 V 54.2 H 105"/>
            <path d="M 0 24.8 H 5.5 V 43.2 H 0 M 105 24.8 H 99.5 V 43.2 H 105"/>
            <path d="M 16.5 26 A 9.15 9.15 0 0 1 16.5 42 M 88.5 26 A 9.15 9.15 0 0 0 88.5 42"/>
            <circle cx="11" cy="34" r=".4" fill="#d3f3df"/><circle cx="94" cy="34" r=".4" fill="#d3f3df"/>
          </g>
          <path d="M 0 30 H -2 V 38 H 0 M 105 30 H 107 V 38 H 105" fill="none" stroke="white" strokeWidth=".75"/>
          {frame.actors.map((p) => <g key={p.id} transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`}>
            <circle r="2.13" fill={p.team === "club" ? colours.club : colours.opponent} stroke="#f5faf6" strokeWidth=".48"/>
            <text y=".68" fontSize="2.12" fontWeight="800" textAnchor="middle" fill={p.team === "club" && ["#1d1d1f","#14221f"].includes(colours.club) ? "white" : "#09221b"}>{p.goalkeeper ? "TW" : p.shirt}</text>
          </g>)}
          <circle cx={frame.ball.x} cy={frame.ball.y} r="1.12" fill="#fff" stroke="#172725" strokeWidth=".36"/>
          <circle cx={frame.ball.x - .24} cy={frame.ball.y - .22} r=".21" fill="#192a28"/>
        </svg>
        <div className="gc-viewer-legend"><span><i style={{ background: colours.club }} />{clubName}</span><span><i style={{ background: colours.opponent }} />{cup.opponent}</span><span>Darstellung · keine zusätzliche Ergebnissimulation</span></div>
        {replay && <button type="button" className="gc-viewer-replay-exit" onClick={() => setReplay(undefined)}>Wiederholung beenden</button>}
      </div>
    </div>
    <div className="gc-viewer-tabs" role="tablist" aria-label="Spielansichten">{phases.map((item) => <button type="button" role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? "selected" : ""} onClick={() => { setTab(item.id); if (item.id !== "highlights") setReplay(undefined); }}>{item.label}</button>)}</div>
    <div className="gc-viewer-tab-panel" role="tabpanel">
      {tab === "live" && <div className="gc-viewer-events">{history.length ? history.slice(-5).reverse().map((e) => <div key={e.id}><time>{e.minute}′</time><span>{e.kind === "goal" ? "Tor" : e.kind === "card" ? "Rote Karte" : e.kind === "injury" ? "Verletzung" : "Penalty"} · {e.player}</span></div>) : <span>Die Partie läuft. Ballbewegungen ohne offiziellen Spielereignis-Eintrag sind rein visuell.</span>}</div>}
      {tab === "ratings" && <div className="gc-viewer-player-list">{frame.actors.filter((p) => p.team === "club").sort((a,b) => (b.rating ?? 0) - (a.rating ?? 0)).map((p) => <div key={p.id}><span>{p.label} <small>{p.role}</small></span><strong>{p.rating === null ? "–" : p.rating.toFixed(1)}</strong></div>)}</div>}
      {tab === "fitness" && <div className="gc-viewer-player-list">{frame.actors.filter((p) => p.team === "club").map((p) => <div key={p.id}><span>{p.label}</span><small>Belastung steigt im Spiel · kein gespeicherter Fitnesswert</small></div>)}</div>}
      {tab === "statistics" && <div className="gc-viewer-stat-grid"><div><span>Tore Club</span><b>{cup.homeScore}</b></div><div><span>Tore Gegner</span><b>{cup.awayScore}</b></div><div><span>Rote Karten</span><b>{cup.cardEvents.length}</b></div><div><span>Wechsel</span><b>{cup.substitutionsUsed}</b></div></div>}
      {tab === "tactics" && <p>Taktik: <strong>{cup.strategyId === "angriff" ? "Offensivpressing" : cup.strategyId === "konter" ? "Schneller Konter" : "Ballbesitz"}</strong>. Die bestehenden Taktikbuttons unter dem Spielfeld bleiben für Änderungen zuständig. <a href="#gc-live-tactics">Taktik ändern</a></p>}
      {tab === "substitutions" && <p>{cup.substitutionsUsed} Wechsel durchgeführt. Wähle unten in deiner Startelf einen Spieler und anschliessend einen passenden Bankspieler. <a href="#gc-live-bench">Zur Wechselbank</a></p>}
      {tab === "highlights" && <div className="gc-viewer-events">{history.length ? history.slice().reverse().map((event) => <button key={event.id} type="button" onClick={() => setReplay({ event, startedAt: Date.now() })}><time>{event.minute}′</time><span>{event.kind === "goal" ? "Tor" : event.kind === "card" ? "Rote Karte" : event.kind === "injury" ? "Verletzung" : "Penalty"} · {event.player}</span><b>▶</b></button>) : <p>Noch keine offiziellen Highlights vorhanden.</p>}{replay && <small>Rekonstruierte Szene aus den gespeicherten Match-Ereignissen; keine echte Videoaufnahme.</small>}</div>}
    </div>
  </section>;
}
