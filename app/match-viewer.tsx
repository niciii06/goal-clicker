"use client";
import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
import { PREF_KEYS, readPref, writePref } from './qol/prefs';
import { getCupMatchMinute, getCupRegularDurationMs, getStarFormation, getStarXIPlayer, STAR_XI_MAX_SUBSTITUTIONS } from './feature-data';
import type { GameFeatures } from './feature-data';
import { matchColours } from './match-colours';
import { goalLabel, goalAssistId } from './match-goals';
import { MatchSubstitutions } from './match-substitutions';
import { InteractiveMatchPanel } from "./interactive-match-panel";
import { useInjuryAutoOpen } from "./match-injury";
import { useReducedMotion } from './use-reduced-motion';
import type { InteractivePanelProps } from "./interactive-match-panel";
import { getVisualFrame, getViewerEvents, eventLabel } from './match-visual-frame';
import type { Replay } from './match-visual-frame';
import { t } from './i18n/runtime';
import { eventText } from './i18n/data-text';
export { getVisualFrame, getViewerEvents, eventLabel, clubAttacksRight, baseActors } from './match-visual-frame';
export type { Actor, Replay, MatchEvent } from './match-visual-frame';
type Phase = 'live' | 'team' | 'statistics';
const MatchPitchCanvas=dynamic(()=>import('./match-pitch-canvas').then(module=>module.MatchPitchCanvas), {
 ssr:false,
 // A canvas never draws its children, so the placeholder is a plain element with the pitch as SVG.
 loading:()=> <div className="gc-viewer-pitch gc-viewer-pitch-placeholder" role="img" aria-label={t("viewer.loading")}><svg viewBox="-3 -3 111 74" aria-hidden="true" focusable="false" style={{display:'block',width:'100%',height:'100%'}}><rect width="105" height="68" fill="#237648"/><path d="M52.5 0V68" stroke="white"/></svg></div>,
});
export function LegacyLiveMatchViewer({ features, now, clubName, clubColor, disabled=false, onSubstitute }: { features: GameFeatures; now: number; clubName: string; clubColor: string; disabled?:boolean; onSubstitute?:(changes:{playerId:string;slot:number}[])=>void }) {
  const [tab, setTab] = useState<Phase>("live");
  const [clock, setClock] = useState(now);
  const [replay, setReplay] = useState<Replay>();
  const reducedMotion = useReducedMotion();
  // The camera stays as chosen on this device (Q54).
  const [camera,setCameraState]=useState<"full"|"follow"|"highlights">(()=>{const saved=readPref(PREF_KEYS.viewer);return saved==='follow'||saved==='highlights'?saved:'full';});
  const setCamera=(next:"full"|"follow"|"highlights")=>{setCameraState(next);writePref(PREF_KEYS.viewer,next);};
  const [fps,setFps]=useState(0);
  const [selectedPlayer,setSelectedPlayer]=useState<string>();
  const [expanded,setExpanded]=useState(false);
  const [subOpen,setSubOpen]=useState(false);
  // An own player's injury opens the substitutions by themselves once, when substituting is possible (app/match-injury.ts).
  const canSubstitute=!disabled&&Boolean(onSubstitute)&&features.cup.phase!=='penalties'&&features.cup.substitutionsUsed<STAR_XI_MAX_SUBSTITUTIONS;
  useInjuryAutoOpen(features,()=>{if(canSubstitute)setSubOpen(true);},()=>setSubOpen(false));
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
  },[features.cup.timedPause,now]);
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
  const phases: { id: Phase; label: string }[] = [{id:'live',label:'MATCH'},{id:'team',label:'TEAM'},{id:'statistics',label:t("viewer.statsCaps")}];
  const colours = matchColours(cup.opponent,clubColor,visiting);
  const pause=cup.timedPause;
  const timedOverlay=!activeReplay&&pause&&clock>=pause.startsAt&&clock<pause.endsAt;
  const goal=pause?.kind==='goal'?cup.matchEvents.find(e=>e.id===pause.id):undefined;
  return <section ref={viewerRef} className={`gc-match-viewer ${tab === "team" ? "team-open" : "pitch-focus"}${expanded?" expanded":""}`} role={expanded?"dialog":undefined} aria-modal={expanded?true:undefined} aria-label={t("viewer.label")}>
    <div className="gc-viewer-tools"><span>{cup.mode==="season"?t("viewer.season"):t("viewer.cup")} · {cup.fixture?.venue.stadium??cup.opponent}</span><button type="button" onClick={()=>setExpanded(x=>!x)}>{expanded?t("viewer.closeView"):t("viewer.bigView")}</button></div>
    <div className="gc-viewer-scoreboard"><div><small>{t("viewer.homeCaps")}</small><strong><span className="gc-team-badge">{visiting?home.slice(0,2).toUpperCase():features.club.badge}</span> {home}</strong>{scorers(visiting?'away':'home')}</div><div className="gc-viewer-score"><span>{homeScore} : {awayScore}</span><small>{!cup.active ? t("viewer.fullTime") : cup.matchPaused ? t("viewer.paused") : cup.phase === "penalties" ? t("viewer.shootout") : cup.phase === "extra-time" ? t("viewer.extraTime") : "LIVE"} · {getCupMatchMinute(cup,effectiveClock)}′{activeReplay ? ` · Replay ${frame.minute}′` : ""}</small></div><div><small>{t("viewer.awayCaps")}</small><strong>{away} <span className="gc-team-badge">{visiting?features.club.badge:away.slice(0,2).toUpperCase()}</span></strong>{scorers(visiting?'home':'away')}</div></div>
    {frame.recent && <div className="gc-viewer-caption" role="status"><time>{frame.recent.minute}′</time><strong>{eventText(eventLabel(frame.recent))} · {frame.recent.player}</strong>{frame.recent.assistId&&<span>{t("viewer.assist")} {getStarXIPlayer(frame.recent.assistId)?.name}</span>}</div>}
    <div className="gc-viewer-main">
      <div className="gc-viewer-pitch-shell">
        <div className="gc-viewer-pitch-head"><span><i className="gc-live-dot" /> {activeReplay ? t("viewer.replayCaps") : frame.status}</span><span>{getStarFormation(features.starXI.formationId).label} · 2D</span></div>
        {!cup.timedPause && halfTimeTransition && <div className="gc-viewer-half-time"><strong>{cup.phase === "extra-time" ? t("viewer.extraTime") : t("viewer.halftime")}</strong><span>{t("viewer.sidesSwitch")}</span></div>}
        {timedOverlay && <div className={`gc-timed-overlay ${pause.kind}`} role="status" style={{borderColor:goal?.side==='away'?colours.opponent:colours.club}}><span>{pause.kind==='halftime'?t("viewer.halftime"):t("viewer.goal")}</span><strong>{home} {visiting?cup.awayScore:cup.homeScore} : {visiting?cup.homeScore:cup.awayScore} {away}</strong>{goal?<><b>{goal.side==='home'?clubName:cup.opponent}</b><span>{goal.scorer} · {goal.minute}′</span>{goal.assistName&&<small>{t("viewer.assist")} {goal.assistName}</small>}</>:<><MatchStatistics features={features} clubName={clubName}/><small>{t("viewer.secondHalfIn")} {Math.max(1,Math.ceil((pause.endsAt-clock)/1000))} s</small></>}</div>}
        <MatchPitchCanvas features={features} now={now} replay={activeReplay} colours={colours} camera={camera} reducedMotion={reducedMotion} onSelect={setSelectedPlayer} onFps={setFps} />
        <div className="gc-viewer-cameras" role="group" aria-label={t("viewer.camera")}><button type="button" aria-pressed={camera==='full'} onClick={()=>setCamera('full')}>{t("viewer.wholePitch")}</button><button type="button" aria-pressed={camera==='follow'} onClick={()=>setCamera('follow')}>{t("viewer.followBall")}</button><button type="button" aria-pressed={camera==='highlights'} onClick={()=>setCamera('highlights')}>{t("viewer.highlightCam")}</button><small>{fps>0?`${fps} FPS`:''}</small></div>
        <div className="gc-viewer-legend"><span><i style={{ background: colours.club }} />{clubName}</span><span><i style={{ background: colours.opponent }} />{cup.opponent}</span><span>{t("viewer.liveView")}</span></div>
        {activeReplay && <button type="button" className="gc-viewer-replay-exit" onClick={() => setReplay(undefined)}>{t("viewer.endReplay")}</button>}
      </div>
    </div>
    {selectedPlayer && <div className="gc-viewer-player-detail"><strong>{frame.actors.find(p=>p.id===selectedPlayer)?.label??getStarXIPlayer(selectedPlayer)?.name}</strong><span>{t("viewer.rating")} {frame.actors.find(p=>p.id===selectedPlayer)?.rating?.toFixed(1)??'–'}</span><button type="button" onClick={()=>setSelectedPlayer(undefined)}>{t("viewer.close")}</button></div>}
    <button type="button" className="mode-secondary match-sub-button" disabled={disabled||!onSubstitute||cup.phase==='penalties'||cup.substitutionsUsed>=STAR_XI_MAX_SUBSTITUTIONS} onClick={()=>setSubOpen(true)}>{t("viewer.substitute")}</button>{subOpen&&<MatchSubstitutions features={features} disabled={disabled} onConfirm={changes=>onSubstitute?.(changes)} onClose={()=>setSubOpen(false)}/>} <div className="gc-viewer-tabs" role="tablist" aria-label={t("viewer.views")}>{phases.map((item) => <button type="button" role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? "selected" : ""} onClick={() => { setTab(item.id); if (item.id !== "live") setReplay(undefined); }}>{item.label}</button>)}</div>
    <div className="gc-viewer-tab-panel" role="tabpanel">
      {tab === "live" && <div className="gc-viewer-events">{history.length ? history.slice().reverse().map(event=><button key={event.id} type="button" onClick={()=>setReplay({event,startedAt:clock})}><time>{event.minute}′</time><span>{eventText(eventLabel(event))} · {event.player}</span><b>▶</b></button>) : <span>{t("viewer.running")}</span>}</div>}
      {tab === "statistics" && <MatchStatistics features={features} clubName={clubName} />}
      {tab === "team" && <div className="gc-viewer-tactics"><p>{t("viewer.formation")} {getStarFormation(features.starXI.formationId).label} · {t("viewer.subsAndWindows", { used: cup.substitutionsUsed, windows: cup.subWindowsUsed??0 })}</p>{cup.pendingSubstitutions&&<p>{t("viewer.subsWaiting")}</p>}</div>}


    </div>
  </section>;
}

export function MatchStatistics({features,clubName}:{features:GameFeatures;clubName:string}) {
 const c=features.cup,b=c.broadcast,a=b?.clubStats,o=b?.opponentStats;
 const goals=c.matchEvents,ownGoals=goals.filter(e=>e.side==='home'),otherGoals=goals.filter(e=>e.side==='away');
 const total=(a?.possessionSeconds??0)+(o?.possessionSeconds??0),own=total?Math.round((a!.possessionSeconds/total)*100):50;
 const simulated=Boolean(c.simulation||c.interactiveResult),extra=simulated?0:1;
 const xg=(stats?:{xg?:number})=>(stats?.xg??0).toFixed(1);
 // Expected goals only exist for the interactive simulation, which knows the chance of every shot.
 const rows:[string,string|number,string|number][]=[[t("viewer.goals"),c.homeScore,c.awayScore],...(simulated?[['xG',xg(a),xg(o)] as [string,string,string]]:[]),[t("viewer.possession"),`${own}%`,`${100-own}%`],[t("viewer.shots"),(a?.shots??0)+ownGoals.length*extra,(o?.shots??0)+otherGoals.length*extra],[t("viewer.onTarget"),(a?.onTarget??0)+ownGoals.length*extra,(o?.onTarget??0)+otherGoals.length*extra],[t("viewer.saves"),a?.saves??0,o?.saves??0],[t("viewer.corners"),(a?.corners??0)+ownGoals.filter(e=>e.pattern==='corner').length,(o?.corners??0)+otherGoals.filter(e=>e.pattern==='corner').length],[t("viewer.freeKicks"),(a?.freeKicks??0)+ownGoals.filter(e=>e.pattern==='free-kick').length,(o?.freeKicks??0)+otherGoals.filter(e=>e.pattern==='free-kick').length],[t("viewer.offside"),a?.offsides??0,o?.offsides??0],[t("viewer.yellowCards"),a?.yellowCards??0,o?.yellowCards??0],[t("viewer.redCards"),c.cardEvents.filter(e=>e.side==='home').length,c.cardEvents.filter(e=>e.side==='away').length]];
 // Like the scoreboard: the home team on the left, the away team on the right.
 const away=Boolean(c.fixture?.away);
 return <table className="gc-match-statistics"><thead><tr><th>{away?c.opponent:clubName}</th><th>{t("viewer.stats")}</th><th>{away?clubName:c.opponent}</th></tr></thead><tbody>{rows.map(([label,club,opponent])=><tr key={label}><td>{away?opponent:club}</td><th>{label}</th><td>{away?club:opponent}</td></tr>)}</tbody></table>;
}

export function LiveMatchViewer(props:InteractivePanelProps & {onSubstitute?:(changes:{playerId:string;slot:number}[])=>void}){return props.features.cup.simulation?<InteractiveMatchPanel {...props}/>:<LegacyLiveMatchViewer {...props}/>;}
