export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getDb } from '../../../db';
import { resolvePlayer } from '../../auth/player';
import { normalizeGameFeatures, getTournament } from '../../feature-data';
import { createJourney, eligibilityError, fixtureFor } from '../../travel-data';
import type { Journey } from '../../travel-data';
import { MAX_GAME_STATE_BODY_BYTES, readJsonBody, RequestBodyTooLargeError } from '../request-body';
import { rateLimited } from '../rate-limit';
// Solo saves remain browser-local; this ledger makes elapsed travel server-authoritative.
// Player IDs are existing opaque capabilities, matching the shared-world API architecture.
export async function POST(request: Request) {
 try {
  const limited=rateLimited(request,'travel');if(limited)return limited;
  const p=await readJsonBody<{playerId?:unknown;action?:unknown;fixtureId?:unknown;features?:unknown;mode?:unknown;tournamentId?:unknown}>(request,MAX_GAME_STATE_BODY_BYTES);
  if(typeof p.playerId!=='string'||p.playerId.length<8||p.playerId.length>80)return Response.json({error:'Spieler-ID fehlt.'},{status:400});
  // With accounts the game always runs signed in; a signed in player can only act for the account's player ID.
  const auth=await resolvePlayer(request,p.playerId,{loginRequired:true,loginMessage:'Bitte melde dich an.'});if(!auth.ok)return auth.response;
  const db=getDb(), now=Date.now();
  if(p.action==='status') {
   if(typeof p.fixtureId!=='string'||p.fixtureId.length>240)return Response.json({error:'Partie fehlt.'},{status:400});
   const journey=await db.getSoloJourney(p.playerId,p.fixtureId);
   return Response.json({journey,serverNow:now},{headers:{'cache-control':'no-store'}});
  }
  const f=normalizeGameFeatures(p.features),mode=p.mode==='season'?'season':'tournament',t=getTournament(typeof p.tournamentId==='string'&&p.tournamentId?p.tournamentId:'stadium');
  if(!t)return Response.json({error:'Unbekanntes Turnier.'},{status:409});
  const error=eligibilityError(f,mode,t.id,now);if(error)return Response.json({error},{status:409});
  const fixture=fixtureFor(f,mode,t.id);
  if(!fixture.away)return Response.json({error:'Das ist ein Heimspiel.'},{status:409});
  let journey=await db.getSoloJourney(p.playerId,fixture.id) as Journey|null;
  if(p.action==='depart') {
   if(!journey)journey=await db.putSoloJourney(p.playerId,fixture.id,createJourney(fixture,now,Math.random,f));
  } else if(p.action==='start') {
   if(!journey||journey.endsAt>now)return Response.json({error:'Die Mannschaft ist noch nicht angekommen.'},{status:409});
   if(journey.consumed)return Response.json({journey,serverNow:now},{headers:{'cache-control':'no-store'}});
   journey={...journey,consumed:true};
   if(!await db.consumeSoloJourney(p.playerId,fixture.id,journey)){const receipt=await db.getSoloJourney(p.playerId,fixture.id);return Response.json({journey:receipt,serverNow:now},{headers:{'cache-control':'no-store'}});}
  } else return Response.json({error:'Unbekannte Reiseaktion.'},{status:400});
  return Response.json({journey,serverNow:now},{headers:{'cache-control':'no-store'}});
 } catch (error) {if(error instanceof RequestBodyTooLargeError)return Response.json({error:error.message},{status:413});return Response.json({error:'Die Reise konnte nicht synchronisiert werden. Bitte erneut versuchen.'},{status:503});}
}
