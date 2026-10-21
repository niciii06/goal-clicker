'use client';
import { useMatchPresentation } from './use-match-presentation';
import { useEffect, useState } from 'react';
import type { GameFeatures } from './feature-data';
import { getStarXIPlayer } from './feature-data';
import { MatchPitchCanvas } from './match-pitch-canvas';
import { getViewerEvents, eventLabel, MatchStatistics } from './match-viewer';
import { goalLabel } from './match-goals';
import { matchStadium } from './match-stadium';
import { stadiumLabel } from './stadium-profiles';
import { validateMatchDraft } from './match-commands';
import { MatchSquadEditor } from './match-substitutions';
import type { MatchDraft } from './match-commands';
export type InteractivePanelProps={features:GameFeatures;now:number;clubName:string;clubColor:string;disabled?:boolean;onEdit?:()=>void;onBatch?:(draft:MatchDraft)=>void;onResume?:()=>void};
export function InteractiveMatchPanel({features,now,clubName,clubColor,disabled,onEdit,onBatch,onResume}:InteractivePanelProps){
 const [view,setView]=useState<'pitch'|'ticker'|'stats'>('pitch'),[editing,setEditing]=useState(features.cup.simulation?.status==='editing');
 const c=features.cup,s=c.simulation!,away=c.fixture?.away;
 const {wall,minute}=useMatchPresentation(c,now),events=getViewerEvents(c);
 // The half time card covers the whole stadium while both teams change ends underneath it.
 const halftime=useLingering(s.status==='halftime'&&c.matchPaused,450);
 const status=s.status==='halftime'?'HALBZEIT':s.status==='editing'?'PAUSIERT':s.pauseRequested?'Spielzug wird abgeschlossen':c.phase==='penalties'?'ELFMETERSCHIESSEN':'LIVE';
 const scorers=(side:'home'|'away')=>c.matchEvents.filter(e=>e.side===side).map(e=><span key={e.id}>{goalLabel(e)}</span>);
 return <section className="gc-match-viewer gc-interactive-match" aria-label="Interaktive Matchsimulation">
  <div className="gc-viewer-scoreboard"><div><small>HEIM</small><strong>{away?c.opponent:clubName}</strong><div className="gc-score-scorers">{scorers(away?'away':'home')}</div></div><div className="gc-viewer-score"><span>{away?c.awayScore:c.homeScore} : {away?c.homeScore:c.awayScore}</span><small>{status} · {minute}′</small></div><div><small>AUSWÄRTS</small><strong>{away?clubName:c.opponent}</strong><div className="gc-score-scorers">{scorers(away?'home':'away')}</div></div></div>
  {c.phase!=='penalties'&&view==='pitch'&&<div className="gc-viewer-pitch-shell">{halftime.visible&&<HalftimeOverlay features={features} clubName={clubName} leaving={halftime.leaving} disabled={disabled} onSubstitutions={()=>{setEditing(true);onEdit?.();}} onResume={()=>{setEditing(false);onResume?.();}}/>}<MatchPitchCanvas features={features} now={now} playbackWall={wall} colours={{club:clubColor||'#17875f',opponent:clubColor==='#ffc857'?'#3e75dd':'#ffc857'}} camera="full" reducedMotion={false} onSelect={()=>{}} onFps={()=>{}}/><div className="gc-viewer-legend"><span>{clubName}</span><span>{c.opponent}</span><span className="gc-stadium-label">{stadiumLabel(matchStadium(features))}</span></div></div>}
  {view==='ticker'&&<div className="gc-viewer-events gc-interactive-ticker" role="log" aria-label="Live Ticker">{events.length?events.map(e=><div key={e.id}><time>{e.minute}′</time><span>{eventLabel(e)} · {e.player}{e.assistId?` (${getStarXIPlayer(e.assistId)?.name??c.simulation?.committed.players.find(p=>p.id===e.assistId)?.name??''})`:''}{e.kind==='shot'?` · ${e.outcome==='save'?'Gehalten':e.outcome==='blocked'?'Geblockt':'Vorbei'}`:''}</span></div>):<p>Anpfiff. Die Partie läuft.</p>}<div>{status} · {minute}′</div></div>}
  {view==='stats'&&<MatchStatistics features={features} clubName={clubName}/>}
  {events.at(-1)&&now-events.at(-1)!.at<3500&&<div className="gc-viewer-caption" role="status"><time>{events.at(-1)!.minute}′</time><strong>{eventLabel(events.at(-1)!)} · {events.at(-1)!.player}</strong></div>}
  {c.matchPaused&&!(s.status==='halftime'&&view==='pitch'&&c.phase!=='penalties')&&<div className="gc-interactive-pause" role="status"><strong>{s.status==='halftime'?'Halbzeitpause':'Spiel pausiert'}</strong><button type="button" disabled={disabled} onClick={()=>{setEditing(false);onResume?.();}}>Weiterspielen</button></div>}
  <div className="gc-interactive-controls"><button type="button" disabled={disabled||c.phase==='penalties'} onClick={()=>{setEditing(true);onEdit?.();}}>Wechsel</button><button type="button" aria-pressed={view==='pitch'} onClick={()=>setView('pitch')}>2D</button><button type="button" aria-pressed={view==='ticker'} onClick={()=>setView('ticker')}>Live Ticker</button><button type="button" aria-pressed={view==='stats'} onClick={()=>setView('stats')}>Statistik</button></div>
  {editing&&(c.matchPaused?<BatchEditor key={s.committed.sequence} features={features} disabled={Boolean(disabled)} onConfirm={d=>{onBatch?.(d);setEditing(false);}} onCancel={()=>{setEditing(false);onResume?.();}}/>:<p role="status">Der laufende Pass oder Schuss wird abgeschlossen. Danach öffnet sich die Aufstellung.</p>)}
 </section>;
}
function BatchEditor({features:f,disabled,onConfirm,onCancel}:{features:GameFeatures;disabled:boolean;onConfirm:(d:MatchDraft)=>void;onCancel:()=>void}){
 const formation=f.starXI.formationId;
 return <MatchSquadEditor features={f} title="Aufstellung bearbeiten" intro="Spieler ziehen oder zwei Karten antippen. Alle Änderungen werden gemeinsam bestätigt. Die Partie ist pausiert." disabled={disabled} validate={lineup=>validateMatchDraft(f,{lineup,formation})} confirmLabel={()=>'Alles bestätigen'} onConfirm={lineup=>onConfirm({lineup,formation})} onCancel={onCancel}/>;
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
 const homeGoals=away?c.awayScore:c.homeScore,guestGoals=away?c.homeScore:c.awayScore;
 const scorers=c.matchEvents.map(e=><span key={e.id}>{goalLabel(e)}</span>);
 return <div className={`gc-halftime-cover${leaving?' leaving':''}`} role="dialog" aria-modal="false" aria-label="Halbzeit">
  <div className="gc-halftime-card">
   <span className="gc-halftime-kicker">HALBZEIT · 45′</span>
   <div className="gc-halftime-score"><strong>{home}</strong><b>{homeGoals} : {guestGoals}</b><strong>{guest}</strong></div>
   {scorers.length>0&&<div className="gc-halftime-scorers">{scorers}</div>}
   <MatchStatistics features={features} clubName={clubName}/>
   <p>Die Teams wechseln die Seiten. Wechsel sind ohne Wechselfenster möglich.</p>
   {!leaving&&<div className="gc-halftime-actions"><button type="button" disabled={disabled} onClick={onSubstitutions}>Wechsel</button><button type="button" className="primary" disabled={disabled} onClick={onResume}>Zweite Halbzeit</button></div>}
  </div>
 </div>;
}
