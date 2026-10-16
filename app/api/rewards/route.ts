export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getDb } from '../../../db';
import { normalizeGameFeatures, openStarPack } from '../../feature-data';
// Reuse the existing insert-once solo receipt ledger with a separate key namespace.
export async function POST(request:Request) {
 try {
  const p=await request.json() as {playerId?:unknown;rewardId?:unknown;features?:unknown};
  if(typeof p.playerId!=='string'||p.playerId.length<8||p.playerId.length>80||typeof p.rewardId!=='string'||p.rewardId.length>240)return Response.json({error:'Ungültige Prämie.'},{status:400});
  const f=normalizeGameFeatures(p.features),earned=f.earnedPacks.find(e=>e.id===p.rewardId);
  if(!earned||f.cup.active)return Response.json({error:'Prämie nicht verfügbar.'},{status:409});
  const db=getDb(),key=`reward:${earned.id}`;
  let receipt=await db.getSoloJourney(p.playerId,key);
  if(!receipt)receipt=await db.putSoloJourney(p.playerId,key,{opening:earned.opening??openStarPack(earned.packId,f.starXI.ownedIds)});
  return Response.json(receipt,{headers:{'cache-control':'no-store'}});
 }catch{return Response.json({error:'Prämie bleibt gespeichert. Bitte erneut versuchen.'},{status:503});}
}
