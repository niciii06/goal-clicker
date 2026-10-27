import test from 'node:test';
import { getWalkoutPresentation } from '../app/walkout-data';
import assert from 'node:assert/strict';
import { initialGameFeatures, setBestStarXI, STAR_XI_PLAYERS, TOURNAMENTS, getStarXIPlayer, getStarXIPositions, setStarXIStarter, setStarXIBenchPlayer, normalizeGameFeatures, lockMatchSquad, releaseMatchSquad, resolveTransferInsiderEvent, beginCupMatch, getStarXISelection, drawRandomStarXICustomCard, getCupPlayerMatchRating, canStarXIPlayerFillSlot, getUnavailableStarXIPlayerIds } from '../app/feature-data.ts';
import { fixtureFor } from '../app/travel-data.ts';
import { baseActors } from '../app/match-viewer.tsx';
function ready(){const f=initialGameFeatures();f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.map(p=>p.id)});return f;}
test('every new cup fixture is away; only highest cup final uses neutral Wembley',()=>{
 const f=ready(),highest=[...TOURNAMENTS].sort((a,b)=>b.minimumRating-a.minimumRating)[0];
 for(const t of TOURNAMENTS)for(let round=0;round<t.rounds;round++){
  f.cup.pendingNextRound=round>0;f.cup.round=round;f.cup.tournamentId=t.id;
  const fx=fixtureFor(f,'tournament',t.id);assert.equal(fx.away,true);
  assert.equal(fx.neutral,t.id===highest.id&&round===t.rounds-1);
  if(fx.neutral){assert.equal(fx.venue.id,'wembley');assert.equal(fx.venue.lon,-.2795);}
 }
 f.seasonMode.matchday=0;assert.equal(fixtureFor(f,'season').away,false);
});
test('Pfuschi is positionless, bench-only, excluded from ratings/automatic XI and cannot substitute',()=>{
 const f=ready(),p=getStarXIPlayer('star-pfuschi')!;assert.equal(p.position,null);assert.deepEqual(getStarXIPositions(p),[]);assert.equal(p.rating,67);
 assert.ok(Object.values(p.originalAttributes!.stats).every(s=>s.value===1));
 for(let i=0;i<11;i++)assert.equal(canStarXIPlayerFillSlot(p.id,i),false);
 f.starXI=setStarXIBenchPlayer(f.starXI,0,p.id);assert.equal(f.starXI.benchIds[0],p.id);
 assert.ok(!setBestStarXI(f.starXI).lineupIds.includes(p.id));
 f.cup=beginCupMatch(f.cup,1000,'stadium',getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds));
 assert.equal(getCupPlayerMatchRating(f.cup,p.id,90),null);assert.ok(!baseActors(f,f.cup,1,true).some(a=>a.id===p.id));
 const di=getStarXIPlayer('star-di-certo')!;assert.equal(di.rating,100);assert.deepEqual(getStarXIPositions(di),['LV','RV']);assert.equal(di.countryCode,'CH');
 const look=getWalkoutPresentation(di);assert.equal(look.countryCode,'CH');assert.equal(look.glasses,true);assert.equal(look.cap,'backwards');
 // Both remain reachable in the existing custom-card draw, with no automatic grant.
 for(const id of [p.id,di.id]){let found=false;for(let i=0;i<STAR_XI_PLAYERS.filter(p=>p.isCustom).length;i++){const n=STAR_XI_PLAYERS.filter(p=>p.isCustom).length;const result=drawRandomStarXICustomCard({...initialGameFeatures().starXI,fragments:25000},()=> (i+.5)/n);if(result.player?.id===id)found=true;}assert.ok(found);}
});
test('timer remainders survive reload on the way; the squad stays open until kick-off and is fixed from then on',()=>{
 const f=ready(),outsider=STAR_XI_PLAYERS.find(p=>!f.starXI.lineupIds.includes(p.id)&&!f.starXI.benchIds.includes(p.id)&&canStarXIPlayerFillSlot(p.id,0,f.starXI.formationPositions))!;
 f.transferSaga.nextAt=9000;f.nextEventAt=7000;f.nextVarAt=8000;lockMatchSquad(f,'fixture',1000);
 const n=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));assert.deepEqual(n.squadLock,f.squadLock);
 // Between cup rounds and on the journey a reserve may still come in.
 assert.equal(n.starXI.lockedPlayerIds,undefined);
 assert.ok(!getUnavailableStarXIPlayerIds(n).includes(outsider.id));
 assert.equal(setStarXIStarter(n.starXI,0,outsider.id).lineupIds[0],outsider.id);
 // Once the match runs, only the squad that kicked off counts.
 const live=normalizeGameFeatures(JSON.parse(JSON.stringify(n)));live.cup.active=true;
 assert.ok(getUnavailableStarXIPlayerIds(live).includes(outsider.id));
 const blocked=resolveTransferInsiderEvent(n,()=>0,100000);assert.equal(blocked.goalDelta,0);assert.equal(blocked.event,null);assert.equal(blocked.features.transferSaga.nextAt,9000);
 releaseMatchSquad(n,20000);assert.equal(n.transferSaga.nextAt,28000);assert.equal(n.nextEventAt,26000);assert.equal(n.squadLock,undefined);
 releaseMatchSquad(n,30000);assert.equal(n.transferSaga.nextAt,28000);
});
test('opponent dismissals persist by roster ID and remove actors without replacement',()=>{
 const f=ready();f.cup=beginCupMatch(f.cup,1000,'stadium',getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds));
 f.cup.cardEvents=[{id:'red',side:'away',playerId:'opponent-2',player:'Defender',reason:'Notbremse',card:'red',minute:1,createdAt:1001,homeScore:0,awayScore:0},{id:'red2',side:'away',playerId:'opponent-3',player:'Defender 2',reason:'grobes Foul',card:'red',minute:1,createdAt:1002,homeScore:0,awayScore:0}];
 const n=normalizeGameFeatures(f);assert.equal(n.cup.cardEvents[0].playerId,'opponent-2');assert.equal(baseActors(n,n.cup,3,true).filter(a=>a.team==='opponent').length,9);
});

test('opponent red cards rebalance every remaining line and survive save reload, including emergency keeper',()=>{
 for(const role of ['IV','midfield','ST','TW']) for(const direction of [true,false]) {
  const f=ready();f.cup=beginCupMatch(f.cup,1000,'stadium',getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds));
  const before=baseActors(f,f.cup,10,direction).filter(p=>p.team==='opponent');
  const dismissed=before.find(p=>role==='midfield'?['ZM','ZDM','ZOM','LM','RM'].includes(p.role):p.role===role);assert.ok(dismissed,`fixture must contain ${role}`);
  f.cup.cardEvents=[{id:'rebalance-red',side:'away',playerId:dismissed.id,player:dismissed.label,reason:'Notbremse',card:'red',minute:10,createdAt:2000,homeScore:0,awayScore:0}];
  const after=baseActors(f,f.cup,11,direction).filter(p=>p.team==='opponent');
  assert.equal(after.length,10);assert.ok(!after.some(p=>p.id===dismissed.id));
  assert.equal(after.filter(p=>p.goalkeeper).length,1);
  assert.equal(after.filter(p=>p.role==='IV').length,4);
  assert.ok(after.some(p=>{const old=before.find(q=>q.id===p.id)!;return old.x!==p.x||old.y!==p.y||old.role!==p.role;}));
  assert.deepEqual(baseActors(f,f.cup,9,direction).filter(p=>p.team==='opponent'),before);
  const restored=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
  assert.deepEqual(baseActors(restored,restored.cup,11,direction).filter(p=>p.team==='opponent'),after);
  f.cup.cardEvents.push({...f.cup.cardEvents[0],id:'second-red',playerId:after.find(p=>!p.goalkeeper)!.id,minute:12});
  const nine=baseActors(f,f.cup,13,direction).filter(p=>p.team==='opponent');
  assert.equal(nine.length,9);assert.equal(nine.filter(p=>p.goalkeeper).length,1);
 }
});
