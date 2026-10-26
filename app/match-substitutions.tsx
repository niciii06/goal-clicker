'use client';
import { useEffect, useRef, useState } from 'react';
import { matchChangeError, getCupMatchMinute, getCupPlayerMatchRating, getStarFormation, getStarXIPlayer, STAR_XI_BENCH_SIZE, STAR_XI_MAX_SUBSTITUTIONS } from './feature-data';
import type { GameFeatures, MatchChange } from './feature-data';
import { matchBenchPreview } from './match-commands';
import { resolveSquadTap, SquadBenchCard, SquadBenchPanel, SquadBenchSlot, SquadPitchPanel, SquadPitchSlot, useSquadDrag } from './squad-board';
import type { SquadPick } from './squad-board';
import type { SquadDragSource, SquadDropTarget } from './game/types';

export function substitutionError(features:GameFeatures,id:string,slot:number) {
 return matchChangeError(features,[{playerId:id,slot}]);
}
/** Slot based changes of a draft lineup, the format the queued live substitutions use. */
export function lineupChanges(features:GameFeatures,lineup:readonly string[]):MatchChange[] {
 return lineup.flatMap((playerId,slot)=>playerId&&playerId!==features.starXI.lineupIds[slot]?[{playerId,slot}]:[]);
}
/** Lineup after dropping a card; the bench always follows from the lineup through matchBenchPreview. */
export function moveInMatchLineup(lineup:readonly string[],bench:readonly string[],source:SquadDragSource,target:SquadDropTarget):string[]|null {
 const next=[...lineup];
 if(target.area==='lineup'){
  if(source.area==='bench'){if(!bench.includes(source.playerId)||next[target.index]===source.playerId)return null;next[target.index]=source.playerId;return next;}
  if(source.area!=='lineup'||source.index===null||source.index===target.index)return null;
  [next[source.index],next[target.index]]=[next[target.index],next[source.index]];return next;
 }
 if(source.area!=='lineup'||source.index===null||!bench[target.index])return null;
 next[source.index]=bench[target.index];return next;
}

type EditorProps={features:GameFeatures;title:string;intro:string;disabled:boolean;initialSlot?:number|null;validate:(lineup:string[])=>string;confirmBlocked?:boolean;confirmLabel:(changes:number)=>string;onConfirm:(lineup:string[])=>void;onCancel:()=>void};

/** The squad board from the "Kader" tab, in a match: same cards, drag and drop and milestone ratings. */
export function MatchSquadEditor({features:f,title,intro,disabled,initialSlot=null,validate,confirmBlocked=false,confirmLabel,onConfirm,onCancel}:EditorProps) {
 const panel=useRef<HTMLDivElement>(null),applying=useRef(false);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;panel.current?.scrollIntoView({block:'start'});panel.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>{previous?.focus();};},[]);
 const [lineup,setLineup]=useState(()=>[...f.starXI.lineupIds]),[past,setPast]=useState<string[][]>([]);
 const [selectedSlot,setSelectedSlot]=useState<number|null>(initialSlot),[selectedBench,setSelectedBench]=useState<number|null>(null),[message,setMessage]=useState('');
 const formation=getStarFormation(f.starXI.formationId),positions=f.starXI.formationPositions,bench=matchBenchPreview(f,lineup);
 const incoming=lineup.filter(id=>id&&!f.starXI.lineupIds.includes(id)),outgoing=f.starXI.lineupIds.filter(id=>id&&!lineup.includes(id)&&!f.cup.sentOffPlayerIds.includes(id));
 const changed=lineup.some((id,i)=>id!==f.starXI.lineupIds[i]),error=validate(lineup);
 const minute=f.cup.simulation?Math.max(1,Math.ceil(f.cup.simulation.time/60)):getCupMatchMinute(f.cup,f.cup.lastTickAt);
 const fitness=(id:string)=>{const p=f.cup.simulation?.committed.players.find(x=>x.id===id);return p?`${Math.round(p.fitness)}% Fitness`:'';};
 const canDrop=(source:SquadDragSource,target:SquadDropTarget)=>{const next=moveInMatchLineup(lineup,bench,source,target);return Boolean(next)&&!validate(next!);};
 const apply=(source:SquadDragSource,target:SquadDropTarget)=>{
  const next=moveInMatchLineup(lineup,bench,source,target);if(!next)return;
  const reason=validate(next);setSelectedSlot(null);setSelectedBench(null);
  if(reason){setMessage(reason);return;}
  setPast(p=>[...p,lineup]);setLineup(next);setMessage('');
 };
 const benchSource=(index:number):SquadDragSource=>({playerId:bench[index],area:'bench',index});
 const slotSource=(index:number):SquadDragSource=>({playerId:lineup[index],area:'lineup',index});
 const picked=():SquadPick|null=>selectedSlot!==null?{source:slotSource(selectedSlot),target:{area:'lineup',index:selectedSlot}}:selectedBench!==null&&bench[selectedBench]?{source:benchSource(selectedBench),target:{area:'bench',index:selectedBench}}:null;
 const drag=useSquadDrag({canDrop,onDrop:apply,onBlocked:()=>setMessage('Dieser Wechsel ist wegen Position oder Spielstatus nicht möglich.'),locked:source=>disabled||source.area==='reserve',picked:()=>picked()?.source??null});
 // First tap picks a player, the second swaps or substitutes; see resolveSquadTap.
 const tap=(tapped:SquadPick)=>{
  const result=resolveSquadTap(picked(),tapped,canDrop);
  if('move' in result){apply(...result.move);return;}
  setSelectedSlot(result.pick?.target?.area==='lineup'?result.pick.target.index:null);
  setSelectedBench(result.pick?.target?.area==='bench'?result.pick.target.index:null);setMessage('');
 };
 const chooseSlot=(index:number)=>tap({source:slotSource(index),target:{area:'lineup',index}});
 const chooseBench=(index:number)=>tap({source:benchSource(index),target:{area:'bench',index}});
 const remove=(id:string)=>{const slot=lineup.indexOf(id),out=outgoing[incoming.indexOf(id)];if(slot<0||!out)return;const next=[...lineup];next[slot]=out;setPast(p=>[...p,lineup]);setLineup(next);setMessage(validate(next));};
 const position=selectedSlot!==null?positions[selectedSlot]:null;
 return <div ref={panel} onKeyDown={e=>{if(e.key==='Escape')onCancel();}} className="gc-sub-panel gc-squad-substitutions" role="region" aria-label={title}>
  <div className="gc-sub-heading"><h3>{title}</h3><span>{STAR_XI_MAX_SUBSTITUTIONS-f.cup.substitutionsUsed-incoming.length} Wechsel übrig</span><button type="button" onClick={onCancel}>Schliessen</button></div>
  <div className="starxi-lineup-heading"><span>DEINE ELF / {formation.label}</span><small>{intro}</small></div>
  <div className="starxi-squad-layout">
   <SquadPitchPanel status={selectedSlot===null?'Spieler wählen':`Platz ${selectedSlot+1} · ${position}`} controls={<div className="starxi-formation-picker"><span><strong>FORMATION</strong><small>Während des Spiels fest · {f.cup.substitutionsUsed} von {STAR_XI_MAX_SUBSTITUTIONS} Wechseln genutzt</small></span><div className="starxi-formation-fixed">{formation.label}</div></div>} help={`Live Wechsel: Bankspieler auf den passenden Feldspieler ziehen oder zwei Spieler nacheinander antippen, um sie zu tauschen. Maximal ${STAR_XI_MAX_SUBSTITUTIONS} Wechsel, ${f.cup.substitutionsUsed} bereits genutzt.`}>{formation.slots.map((slot,index)=>{
    const id=lineup[index],player=getStarXIPlayer(id)??null,dismissed=f.cup.sentOffPlayerIds.includes(id);
    const detail=[id&&!f.starXI.lineupIds.includes(id)?'NEU':'',fitness(id)].filter(Boolean).join(' · ');
    return <SquadPitchSlot key={`${formation.id}-${index}`} features={f} drag={drag} index={index} position={positions[index]} x={slot.x} y={slot.y} player={player} selected={selectedSlot===index} liveRating={player?getCupPlayerMatchRating(f.cup,player.id,minute):null} draggable={!disabled&&!dismissed} disabled={disabled||!player||dismissed} touchDrag detail={detail} onClick={()=>chooseSlot(index)}/>;
   })}</SquadPitchPanel>
   <div className="starxi-squad-side">
    <SquadBenchPanel count={bench.filter(Boolean).length} size={STAR_XI_BENCH_SIZE}>{Array.from({length:STAR_XI_BENCH_SIZE},(_,index)=>{
     const player=getStarXIPlayer(bench[index]);
     if(!player)return <SquadBenchSlot key={`bank-empty-${index}`} drag={drag} index={index} selected={false} disabled onClick={()=>{}}/>;
     const leaving=outgoing.includes(player.id),subbedOut=Boolean(f.cup.playerExitedAt[player.id]);
     const fits=selectedSlot!==null&&canDrop(benchSource(index),{area:'lineup',index:selectedSlot});
     const status=subbedOut?'Bereits ausgewechselt':leaving?'Wird ausgewechselt':selectedSlot!==null?fits?'Nur für dieses Spiel einwechseln':`Passt nicht auf ${position}`:'Auf einen Feldspieler ziehen';
     return <SquadBenchCard key={player.id} features={f} drag={drag} index={index} player={player} selected={selectedBench===index} incompatible={selectedSlot!==null&&!fits} liveRating={getCupPlayerMatchRating(f.cup,player.id,minute)} status={[status,fitness(player.id)].filter(Boolean).join(' · ')} draggable={!disabled&&!subbedOut} disabled={disabled} touchDrag onClick={()=>chooseBench(index)}/>;
    })}</SquadBenchPanel>
   </div>
  </div>
  <div className="gc-sub-confirm" aria-live="polite">
   {incoming.map((id,i)=><span key={id}>{getStarXIPlayer(outgoing[i])?.name} → {getStarXIPlayer(id)?.name} <button type="button" disabled={disabled} onClick={()=>remove(id)}>Entfernen</button></span>)}
   {changed&&!incoming.length&&<span>Positionsänderung geplant</span>}
   {!changed&&<strong>Zwei Spieler antippen oder eine Karte ziehen</strong>}
   <small>{message||error}</small>
   <button type="button" disabled={!past.length||disabled} onClick={()=>{setLineup(past.at(-1)!);setPast(p=>p.slice(0,-1));setMessage('');}}>Rückgängig</button>
   <button type="button" onClick={onCancel}>Abbrechen</button>
   <button type="button" disabled={disabled||!changed||Boolean(error)||confirmBlocked} onClick={()=>{const reason=validate(lineup);if(reason){setMessage(reason);return;}if(applying.current)return;applying.current=true;onConfirm(lineup);}}>{confirmLabel(incoming.length)}</button>
  </div>
 </div>;
}

/** Live substitutions outside the interactive simulation: queued until the next stoppage. */
export function MatchSubstitutions({features,disabled,onConfirm,onClose}:{features:GameFeatures;disabled:boolean;onConfirm:(changes:{playerId:string;slot:number}[])=>void;onClose:()=>void}) {
 const injurySlot=features.starXI.lineupIds.indexOf(features.cup.lastInjury?.playerId??'');
 const validate=(lineup:string[])=>{const changes=lineupChanges(features,lineup);return changes.length?matchChangeError(features,changes):'';};
 return <MatchSquadEditor features={features} title="Wechseln" intro="Tippe einen Spieler an und dann den, mit dem er tauschen soll, oder ziehe die Karte direkt hin. Alle vorgemerkten Wechsel gemeinsam bestätigen." disabled={disabled} initialSlot={injurySlot>=0?injurySlot:null} validate={validate} confirmBlocked={Boolean(features.cup.pendingSubstitutions)} confirmLabel={n=>`${n} Wechsel bestätigen`} onConfirm={lineup=>{onConfirm(lineupChanges(features,lineup));onClose();}} onCancel={onClose}/>;
}
