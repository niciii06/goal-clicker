'use client';
import { useMatchPresentation } from './use-match-presentation';
import { clubIsOnLeft, readInteractiveFrame } from './interactive-frame-data';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameFeatures } from './feature-data';
import { getCupRegularDurationMs, getStarXIPlayer } from './feature-data';
import { MatchPitchCanvas } from './match-pitch-canvas';
import { getViewerEvents, eventLabel, MatchStatistics } from './match-viewer';
import { goalLabel } from './match-goals';
import { matchStadium } from './match-stadium';
import { stadiumLabel } from './stadium-profiles';
import { validateMatchDraft } from './match-commands';
import { MatchSquadEditor } from './match-substitutions';
import type { MatchDraft } from './match-commands';
import { useReducedMotion } from './use-reduced-motion';
import { readPref, writePref } from './qol/prefs';
import { t } from './i18n/runtime';
import { eventText } from './i18n/data-text';
import { useInjuryAutoOpen } from './match-injury';
import type { PendingInjury } from './match-injury';

// The chosen view (pitch, ticker, statistics) stays on this device (Q54).
const INTERACTIVE_VIEW_KEY = 'goal-clicker-interactive-view';
export type InteractivePanelProps={features:GameFeatures;now:number;clubName:string;clubColor:string;disabled?:boolean;onEdit?:()=>void;onBatch?:(draft:MatchDraft)=>void;onResume?:()=>void};
export function InteractiveMatchPanel({features,now,clubName,clubColor,disabled,onEdit,onBatch,onResume}:InteractivePanelProps){
 const [view,setViewState]=useState<'pitch'|'ticker'|'stats'>(()=>{const saved=readPref(INTERACTIVE_VIEW_KEY);return saved==='ticker'||saved==='stats'?saved:'pitch';}),[editing,setEditing]=useState(features.cup.simulation?.status==='editing');
 const setView=(next:'pitch'|'ticker'|'stats')=>{setViewState(next);writePref(INTERACTIVE_VIEW_KEY,next);};
 // An own player's injury opens the substitutions by itself, once per injury (app/match-injury.ts).
 const injury=useInjuryAutoOpen(features,()=>setEditing(true),()=>setEditing(false));
 const reducedMotion=useReducedMotion();
 const c=features.cup,s=c.simulation!,away=c.fixture?.away;
 const {wall,minute}=useMatchPresentation(c,now),events=getViewerEvents(c);
 // The half time card covers the whole stadium while both teams change ends underneath it.
 const halftime=useLingering(s.status==='halftime'&&c.matchPaused,450);
 const extraPause=c.phase==='extra-time'&&s.status==='halftime',pauseTitle=extraPause?(s.time>=6300?t("live.etHalftime"):t("live.beforeEt")):t("live.halftimeBreak");
 const status=s.status==='halftime'?(extraPause?(s.time>=6300?t("live.etHalftimeCaps"):t("live.etCaps")):t("live.halftimeCaps")):s.status==='editing'?t("live.pausedCaps"):s.pauseRequested?t("live.completingMove"):c.phase==='penalties'?t("live.shootoutCaps"):'LIVE';
 // The two labels under the pitch stand on the side where that team plays: the club is on the right in an away game and after the teams changed ends
 // (the same frame the pitch draws decides). The colour dot is the kit colour of the pitch.
 const legendClub={key:'club',name:clubName,colour:clubColor||'#17875f'},legendOpponent={key:'opponent',name:c.opponent,colour:clubColor==='#ffc857'?'#3e75dd':'#ffc857'};
 const presentedTime=Math.max(0,(wall.current-c.matchStartedAt)*(5400/getCupRegularDurationMs(c))),legendTeams=clubIsOnLeft(readInteractiveFrame(s,presentedTime))?[legendClub,legendOpponent]:[legendOpponent,legendClub];
 // The scorer zone of the scoreboard has a fixed height (two lines), so a goal never makes the scoreboard taller: the newest goals come first, older ones scroll.
 const scorers=(side:'home'|'away')=>c.matchEvents.filter(e=>e.side===side).map(e=><span key={e.id}>{goalLabel(e)}</span>).reverse();
 const scorerZone=(side:'home'|'away',team:string)=>{const list=scorers(side);return <div className="gc-score-scorers" {...(list.length?{role:'group','aria-label':t("live.scorersOf",{team})}:{})} {...(list.length>2?{tabIndex:0}:{})}>{list}</div>;};
 // Live ticker: newest first. Only the presentation is reversed (the event log and the replay keep their order); a status line above the list is not an event.
 const tickerEvents=events.slice().reverse();
 const tickerRef=useRef<HTMLDivElement>(null),tickerHeight=useRef(0);
 // New events arrive on top. While the player reads further down, the list keeps its place (scroll anchoring is off in the CSS, so every browser behaves the same).
 useLayoutEffect(()=>{const el=tickerRef.current;if(!el){tickerHeight.current=0;return;}const grown=el.scrollHeight-tickerHeight.current;if(tickerHeight.current&&grown>0&&el.scrollTop>4)el.scrollTop+=grown;tickerHeight.current=el.scrollHeight;},[tickerEvents.length,view]);
 return <section className="gc-match-viewer gc-interactive-match" aria-label={t("live.simulation")}>
  <div className="gc-viewer-scoreboard"><div><small>{t("live.homeCaps")}</small><strong title={away?c.opponent:clubName}>{away?c.opponent:clubName}</strong>{scorerZone(away?'away':'home',away?c.opponent:clubName)}</div><div className="gc-viewer-score"><span>{away?c.awayScore:c.homeScore} : {away?c.homeScore:c.awayScore}</span><small>{status} · {minute}′</small></div><div><small>{t("live.awayCaps")}</small><strong title={away?clubName:c.opponent}>{away?clubName:c.opponent}</strong>{scorerZone(away?'home':'away',away?clubName:c.opponent)}</div></div>
  {c.phase!=='penalties'&&view==='pitch'&&<div className="gc-viewer-pitch-shell">{halftime.visible&&<HalftimeOverlay features={features} clubName={clubName} leaving={halftime.leaving} disabled={disabled} onSubstitutions={()=>{setEditing(true);onEdit?.();}} onResume={()=>{setEditing(false);onResume?.();}}/>}<MatchPitchCanvas features={features} now={now} playbackWall={wall} colours={{club:clubColor||'#17875f',opponent:clubColor==='#ffc857'?'#3e75dd':'#ffc857'}} camera="full" reducedMotion={reducedMotion} onSelect={()=>{}} onFps={()=>{}}/><div className="gc-viewer-legend">{legendTeams.map(team=><span key={team.key} className={team===legendTeams[0]?'gc-legend-left':'gc-legend-right'} title={team.name}><i style={{background:team.colour}} aria-hidden="true"/>{team.name}</span>)}<span className="gc-stadium-label">{stadiumLabel(matchStadium(features))}</span></div></div>}
  {view==='ticker'&&<><div className="gc-ticker-status" aria-hidden="true">{status} · {minute}′</div><div ref={tickerRef} className="gc-viewer-events gc-interactive-ticker" role="log" aria-label={t("live.ticker")}>{events.length?tickerEvents.map(e=><div key={e.id}><time>{e.minute}′</time><span>{eventText(eventLabel(e))} · {e.player}{e.assistId?` (${getStarXIPlayer(e.assistId)?.name??c.simulation?.committed.players.find(p=>p.id===e.assistId)?.name??''})`:''}{e.kind==='shot'?` · ${e.outcome==='save'?'Gehalten':e.outcome==='blocked'?'Geblockt':'Vorbei'}`:''}</span></div>):<p>{t("live.kickoff")}</p>}</div></>}
  {view==='stats'&&<MatchStatistics features={features} clubName={clubName}/>}
  {events.at(-1)&&now-events.at(-1)!.at<3500&&<div className="gc-viewer-caption" role="status"><time>{events.at(-1)!.minute}′</time><strong>{eventText(eventLabel(events.at(-1)!))} · {events.at(-1)!.player}</strong></div>}
  {c.matchPaused&&!(s.status==='halftime'&&view==='pitch'&&c.phase!=='penalties')&&<div className="gc-interactive-pause" role="status"><strong>{s.status==='halftime'?pauseTitle:t("live.paused")}</strong><button type="button" disabled={disabled} onClick={()=>{setEditing(false);onResume?.();}}>{t("live.continue")}</button></div>}
  <div className="gc-interactive-controls"><button type="button" disabled={disabled||c.phase==='penalties'} onClick={()=>{setEditing(true);onEdit?.();}}>{t("live.subs")}</button><button type="button" aria-pressed={view==='pitch'} onClick={()=>setView('pitch')}>2D</button><button type="button" aria-pressed={view==='ticker'} onClick={()=>setView('ticker')}>{t("live.ticker")}</button><button type="button" aria-pressed={view==='stats'} onClick={()=>setView('stats')}>{t("live.stats")}</button></div>
  {editing&&(c.matchPaused?<BatchEditor key={s.committed.sequence} features={features} injury={injury} disabled={Boolean(disabled)} onConfirm={d=>{onBatch?.(d);setEditing(false);}} onCancel={()=>{setEditing(false);onResume?.();}}/>:<p role="status">{t("live.finishingMove")}</p>)}
 </section>;
}
function BatchEditor({features:f,injury,disabled,onConfirm,onCancel}:{features:GameFeatures;injury:PendingInjury|null;disabled:boolean;onConfirm:(d:MatchDraft)=>void;onCancel:()=>void}){
 const formation=f.starXI.formationId;
 // After an injury the injured player's place is already chosen; closing plays on without a substitution.
 const intro=injury?t("live.injuryIntro",{player:injury.player,place:injury.slot+1,position:f.starXI.formationPositions[injury.slot]??''}):t("live.editIntro");
 return <MatchSquadEditor features={f} title={injury?t("live.injuryTitle"):t("live.editLineup")} intro={intro} initialSlot={injury?.slot??null} cancelLabel={injury?t("live.playOnWithoutSub"):t("subs.cancel")} disabled={disabled} validate={lineup=>validateMatchDraft(f,{lineup,formation})} confirmLabel={()=>t("live.confirmAll")} onConfirm={lineup=>onConfirm({lineup,formation})} onCancel={onCancel}/>;
}

/** Keeps an element mounted for its exit animation after `visible` turns false. */
function useLingering(visible:boolean,ms:number){
 const [state,setState]=useState({visible,leaving:false});
 if(visible&&(!state.visible||state.leaving))setState({visible:true,leaving:false});
 else if(!visible&&state.visible&&!state.leaving)setState({visible:true,leaving:true});
 useEffect(()=>{if(!state.leaving)return;const timer=window.setTimeout(()=>setState({visible:false,leaving:false}),ms);return()=>window.clearTimeout(timer);},[state.leaving,ms]);
 return state;
}
function HalftimeOverlay({features,clubName,leaving,disabled,onSubstitutions,onResume}:{features:GameFeatures;clubName:string;leaving:boolean;disabled?:boolean;onSubstitutions:()=>void;onResume:()=>void}){
 const c=features.cup,away=Boolean(c.fixture?.away),home=away?c.opponent:clubName,guest=away?clubName:c.opponent;
 // The same break card is used at 45′, before extra time (90′) and at the extra-time break (105′).
 const extra=c.phase==='extra-time',secondExtra=extra&&(c.simulation?.time??0)>=6300;
 const kicker=!extra?t("live.halftime45"):secondExtra?t("live.etHalftime105"):t("live.drawEt"),resumeLabel=!extra?t("live.secondHalf"):secondExtra?t("live.etSecondHalf"):t("live.startEt");
 const homeGoals=away?c.awayScore:c.homeScore,guestGoals=away?c.homeScore:c.awayScore;
 const scorers=c.matchEvents.map(e=><span key={e.id}>{goalLabel(e)}</span>);
 return <div className={`gc-halftime-cover${leaving?' leaving':''}`} role="dialog" aria-modal="false" aria-label={extra?t("live.etBreak"):t("live.halftime")}>
  <div className="gc-halftime-card">
   <span className="gc-halftime-kicker">{kicker}</span>
   <div className="gc-halftime-score"><strong>{home}</strong><b>{homeGoals} : {guestGoals}</b><strong>{guest}</strong></div>
   {scorers.length>0&&<div className="gc-halftime-scorers">{scorers}</div>}
   <MatchStatistics features={features} clubName={clubName}/>
   <p>{t("live.switchSides")}</p>
   {!leaving&&<div className="gc-halftime-actions"><button type="button" disabled={disabled} onClick={onSubstitutions}>{t("live.subs")}</button><button type="button" className="primary" disabled={disabled} onClick={onResume}>{resumeLabel}</button></div>}
  </div>
 </div>;
}
