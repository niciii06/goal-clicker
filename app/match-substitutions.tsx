'use client';
import { useEffect, useRef, useState } from 'react';
import { canStarXIPlayerFillSlot, getStarFormation, getStarXIPlayer, getStarXIPositions, STAR_XI_MAX_SUBSTITUTIONS } from './feature-data';
import type { GameFeatures } from './feature-data';
import { CareerPlayerBadge } from './career-panels';
export function substitutionError(features:GameFeatures,id:string,slot:number) {
 const c=features.cup,out=features.starXI.lineupIds[slot];
 if(!c.active||c.phase==='penalties')return 'Zurzeit ist kein Wechsel möglich.';
 if(c.substitutionsUsed>=STAR_XI_MAX_SUBSTITUTIONS)return 'Alle Wechsel sind aufgebraucht.';
 if(!out||c.sentOffPlayerIds.includes(out))return 'Ein des Feldes verwiesener Spieler kann nicht ersetzt werden.';
 if(!features.starXI.benchIds.includes(id)||features.starXI.lineupIds.includes(id))return 'Wähle einen Spieler von der Bank.';
 if(c.playerExitedAt[id]||c.sentOffPlayerIds.includes(id)||c.injuredPlayerIds[id]||c.suspendedPlayerIds.includes(id))return 'Dieser Spieler ist nicht spielberechtigt.';
 if(!canStarXIPlayerFillSlot(id,slot,features.starXI.formationPositions))return 'Die Position passt nicht.';
 return '';
}
export function MatchSubstitutions({features,disabled,onConfirm,onClose}:{features:GameFeatures;disabled:boolean;onConfirm:(id:string,slot:number)=>void;onClose:()=>void}) {
 const panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;panel.current?.scrollIntoView({block:'start'});panel.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>{previous?.focus();};},[]);
 const injurySlot=features.starXI.lineupIds.indexOf(features.cup.lastInjury?.playerId??'');
 const [slot,setSlot]=useState(injurySlot>=0?injurySlot:0),[incoming,setIncoming]=useState(''),[message,setMessage]=useState('');
 const applying=useRef(false),suppressClick=useRef(false),drag=useRef<{id:string;x:number;y:number}|null>(null);
 const formation=getStarFormation(features.starXI.formationId),error=incoming?substitutionError(features,incoming,slot):'';
 const stage=(id:string,index:number)=>{setSlot(index);setIncoming(id);setMessage(substitutionError(features,id,index));};
 return <div ref={panel} onKeyDown={e=>{if(e.key==='Escape')onClose();}} className="gc-sub-panel gc-viewer-substitutions" role="region" aria-label="Spielerwechsel mit Karten">
  <div className="gc-sub-heading"><h3>Wechseln</h3><span>{STAR_XI_MAX_SUBSTITUTIONS-features.cup.substitutionsUsed} Wechsel übrig</span><button type="button" onClick={onClose}>Schliessen</button></div>
  <p>Feldspieler wählen, dann Bankkarte. Du kannst die Bankkarte auch auf den Feldspieler ziehen. Das Spiel läuft weiter.</p>
  <div className="starxi-pitch gc-sub-pitch" aria-label={`Startelf ${formation.label}`}>{formation.slots.map((position,index)=>{const id=features.starXI.lineupIds[index],p=getStarXIPlayer(id);return <button key={index} type="button" data-sub-slot={index} className={`starxi-pitch-slot ${slot===index?'selected':''}`} style={{left:`${position.x}%`,top:`${position.y}%`}} aria-pressed={slot===index} aria-label={`${position.position}: ${p?.name??'Leer'}`} disabled={!p||features.cup.sentOffPlayerIds.includes(id)} onClick={()=>{setSlot(index);setMessage('');}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();stage(e.dataTransfer.getData('text/plain'),index);}}><span className="starxi-slot-position">{position.position}</span><strong>{p?.name??'Leer'}</strong><small>OVR {p?.rating??'–'}</small>{p&&<CareerPlayerBadge features={features} player={p} compact/>}</button>;})}</div>
  <h4>Bank</h4><div className="gc-sub-bank">{features.starXI.benchIds.filter(Boolean).map(id=>{const p=getStarXIPlayer(id);if(!p)return null;const reason=substitutionError(features,id,slot);return <button key={id} type="button" className={`starxi-player-card bank ${id===incoming?'selected':''} ${reason?'incompatible':''}`} aria-pressed={id===incoming} aria-label={`${p.name}, ${getStarXIPositions(p).join('/')}${reason?`, ${reason}`:''}`} draggable={!disabled} onDragStart={e=>e.dataTransfer.setData('text/plain',id)} onPointerDown={e=>{if(e.pointerType==='touch'){drag.current={id,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}}} onPointerUp={e=>{const source=drag.current;drag.current=null;if(!source||Math.hypot(e.clientX-source.x,e.clientY-source.y)<12)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-sub-slot]');if(target){suppressClick.current=true;setTimeout(()=>{suppressClick.current=false;},0);e.preventDefault();stage(source.id,Number(target.getAttribute('data-sub-slot')));}}} onPointerCancel={()=>{drag.current=null;}} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}stage(id,slot);}} disabled={disabled}><span>{getStarXIPositions(p).join('/')}</span><div><strong>{p.name}</strong><CareerPlayerBadge features={features} player={p}/><small>{reason||'Passt auf die gewählte Position'}</small></div><b>{p.rating}</b></button>;})}</div>
  <div className="gc-sub-confirm" aria-live="polite"><strong>{incoming?`${getStarXIPlayer(features.starXI.lineupIds[slot])?.name} → ${getStarXIPlayer(incoming)?.name}`:'Wähle eine Bankkarte'}</strong><small>{message||error}</small><button type="button" onClick={onClose}>Abbrechen</button><button type="button" disabled={disabled||!incoming||Boolean(error)} onClick={()=>{const failure=substitutionError(features,incoming,slot);if(failure){setMessage(failure);return;}if(applying.current)return;applying.current=true;onConfirm(incoming,slot);onClose();}}>Wechsel bestätigen</button></div>
 </div>;
}
