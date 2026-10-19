import { getStarFormation, getStarXIPlayer, canStarXIPlayerFillSlot, STAR_XI_MAX_SUBSTITUTIONS, resumeCupMatch } from './feature-data';
import type { GameFeatures } from './feature-data';
import { advanceInteractive, invalidateInteractive } from './interactive-match';
import { competitionOfCup, getBannedPlayerIds } from './discipline';
import { addBroadcastSubstitution } from './match-broadcast';
// The selectable match tactics were removed: a draft carries only lineup and formation.
export type MatchDraft={lineup:string[];formation:string};
export function draftMatch(f:GameFeatures):MatchDraft{return {lineup:[...f.starXI.lineupIds],formation:f.starXI.formationId};}
export function validateMatchDraft(f:GameFeatures,d:MatchDraft):string {
 const c=f.cup;if(!c.active||c.phase==='penalties')return 'Gerade sind keine Änderungen möglich.';
 const form=getStarFormation(d.formation);if(d.formation!==f.starXI.formationId)return 'Die Formation bleibt während der Partie bestehen; passende Positionen können getauscht werden.';
 if(form.id!==d.formation||d.lineup.length!==11)return 'Aufstellung ungültig.';
 const ids=d.lineup.filter(Boolean);if(new Set(ids).size!==ids.length)return 'Ein Spieler ist mehrfach aufgestellt.';
 const banned=new Set(getBannedPlayerIds(f,competitionOfCup(c)));if(d.lineup.some(id=>banned.has(id)&&!f.starXI.lineupIds.includes(id)))return 'Ein gesperrter Spieler darf nicht eingewechselt werden.';
 let changes=0;
 for(let i=0;i<11;i++){
  const id=d.lineup[i],old=f.starXI.lineupIds[i];
  if(c.sentOffPlayerIds.includes(old)){if(id!==old)return 'Nach einer Roten Karte bleibt der Platz leer.';continue;}
  if(!getStarXIPlayer(id)||!f.starXI.ownedIds.includes(id))return 'Ein Spieler ist nicht verfügbar.';
  if(!canStarXIPlayerFillSlot(id,i,form.slots.map(s=>s.position)))return `${getStarXIPlayer(id)?.name} passt nicht auf ${form.slots[i].position}.`;
  if(c.sentOffPlayerIds.includes(id)||c.suspendedPlayerIds.includes(id)||c.playerExitedAt[id]||c.injuredPlayerIds[id])return 'Ein Spieler ist nicht spielberechtigt.';
  if(!f.starXI.lineupIds.includes(id)){if(!f.starXI.benchIds.includes(id))return 'Neue Spieler müssen von der Bank kommen.';changes++;}
 }
 if(c.substitutionsUsed+changes>STAR_XI_MAX_SUBSTITUTIONS)return 'Zu viele Wechsel geplant.';
 return '';
}
export function requestMatchEdit(f:GameFeatures,now:number):GameFeatures {
 if(!f.cup.active||f.cup.phase==='penalties'||f.cup.matchPaused)return f;
 const next=structuredClone(f);
 if(next.cup.simulation){next.cup=advanceInteractive(next.cup,now);if(!next.cup.matchPaused)next.cup.simulation!.pauseRequested=true;}
 else {next.cup.matchPaused=true;next.cup.lastTickAt=now;}
 return next;
}
export function confirmMatchDraft(f:GameFeatures,d:MatchDraft,now:number):{features:GameFeatures;error:string} {
 const error=validateMatchDraft(f,d);if(error)return {features:f,error};
 if(!f.cup.matchPaused)return {features:f,error:'Der laufende Spielzug wird noch abgeschlossen.'};
 const next=structuredClone(f),c=next.cup,minute=Math.max(1,Math.min(120,Math.ceil((c.simulation?.time??0)/60)));
 const incoming=d.lineup.filter(id=>id&&!f.starXI.lineupIds.includes(id)),outgoing=f.starXI.lineupIds.filter(id=>id&&!d.lineup.includes(id)&&!c.sentOffPlayerIds.includes(id));
 const form=getStarFormation(d.formation);
 incoming.forEach((id,i)=>{const out=outgoing[i];c.broadcast=addBroadcastSubstitution(c,out,id,minute);c.playerExitedAt[out]=minute;c.playerEnteredAt[id]=minute;c.allTimeAppearances[id]=(c.allTimeAppearances[id]??0)+1;});
 next.starXI.lineupIds=[...d.lineup];next.starXI.formationId=form.id;next.starXI.formationPositions=form.slots.map(s=>s.position);
 next.starXI.benchIds=next.starXI.benchIds.map(id=>{const index=incoming.indexOf(id);return index>=0?outgoing[index]:id;});
 c.substitutionsUsed+=incoming.length;c.lastInjury=null;
 d.lineup.forEach((id,i)=>{c.playerMatchPositions[id]=form.slots[i].position;if(c.broadcast)c.broadcast.slots[id]=i;});
 if(c.broadcast)c.broadcast.clubFormation=form.id;
 if(c.simulation){
  const sim=c.simulation,checkpoint=sim.committed;
  // Transfer the outgoing slot's position to the incoming player at this safe boundary.
  outgoing.forEach((out,i)=>{const old=checkpoint.players.find(p=>p.id===out),source=getStarXIPlayer(incoming[i]);if(old&&source){old.active=false;checkpoint.players=checkpoint.players.filter(p=>p.id!==out);checkpoint.players.push({...old,id:source.id,name:source.name,rating:source.rating,passing:source.originalAttributes?.stats?.shortPassing?.value??source.rating,shooting:source.originalAttributes?.stats?.finishing?.value??source.rating,pace:source.originalAttributes?.stats?.sprintSpeed?.value??source.rating,control:source.originalAttributes?.stats?.dribbling?.value??source.rating,defending:source.originalAttributes?.stats?.standingTackle?.value??source.rating,keeping:source.originalAttributes?.stats?.gkReflexes?.value??source.rating,stamina:source.originalAttributes?.stats?.stamina?.value??source.rating,fitness:100,active:true});if(checkpoint.owner===out)checkpoint.owner=source.id;}});
  d.lineup.forEach((id,i)=>{const p=checkpoint.players.find(p=>p.id===id);if(!p)return;const slot=form.slots[i],right=checkpoint.direction>0,x=p.role==='TW'?3:12+(100-slot.y)*.68,y=p.role==='TW'?34:5+slot.x*.58;p.role=slot.position;p.slot=i;p.anchor={x:right?x:105-x,y:right?y:68-y};});
  if(checkpoint.lastPass&&outgoing.includes(checkpoint.lastPass.id))checkpoint.lastPass=undefined;
  sim.clubFormation=form.id;invalidateInteractive(c);
 }
 next.cup=resumeCupMatch(c,now);return {features:next,error:''};
}
