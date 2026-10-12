import { getDb } from '../../../db';
import { normalizeGameFeatures, getTournament } from '../../feature-data';
import { createJourney, eligibilityError, fixtureFor } from '../../travel-data';
import type { Journey } from '../../travel-data';
// Solo saves remain browser-local; this ledger makes elapsed travel server-authoritative.
// Player IDs are existing opaque capabilities, matching the shared-world API architecture.
export async function POST(request: Request) {
 try {
  const p=await request.json() as {playerId?:unknown;action?:unknown;fixtureId?:unknown;features?:unknown;mode?:unknown;tournamentId?:string};
  if(typeof p.playerId!=='string'||p.playerId.length<8||p.playerId.length>80)return Response.json({error:'Spieler-ID fehlt.'},{status:400});
  const db=getDb(), now=Date.now();
  if(p.action==='status') {
   if(typeof p.fixtureId!=='string'||p.fixtureId.length>240)return Response.json({error:'Partie fehlt.'},{status:400});
   const journey=await db.getSoloJourney(p.playerId,p.fixtureId);
   return Response.json({journey,serverNow:now},{headers:{'cache-control':'no-store'}});
  }
  const f=normalizeGameFeatures(p.features),mode=p.mode==='season'?'season':'tournament',t=getTournament(p.tournamentId||'stadium');
  if(!t)return Response.json({error:'Unbekanntes Turnier.'},{status:409});
  const error=eligibilityError(f,mode,t.id,now);if(error)return Response.json({error},{status:409});
  const fixture=fixtureFor(f,mode,t.id);
  if(!fixture.away)return Response.json({error:'Das ist ein Heimspiel.'},{status:409});
  let journey=await db.getSoloJourney(p.playerId,fixture.id) as Journey|null;
  if(p.action==='depart') {
   if(!journey)journey=await db.putSoloJourney(p.playerId,fixture.id,createJourney(fixture,now));
  } else if(p.action==='start') {
   if(!journey||journey.endsAt>now)return Response.json({error:'Die Mannschaft ist noch nicht angekommen.'},{status:409});
   journey={...journey,consumed:true};await db.consumeSoloJourney(p.playerId,fixture.id,journey);
  } else return Response.json({error:'Unbekannte Reiseaktion.'},{status:400});
  return Response.json({journey,serverNow:now},{headers:{'cache-control':'no-store'}});
 } catch {return Response.json({error:'Die Reise konnte nicht synchronisiert werden. Bitte erneut versuchen.'},{status:503});}
}
