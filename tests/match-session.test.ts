import test from 'node:test';
import { getWalkoutPresentation } from '../app/walkout-data';
import assert from 'node:assert/strict';
import { initialGameFeatures, setBestStarXI, STAR_XI_PLAYERS, TOURNAMENTS, getStarXIPlayer, getStarXIPositions, setStarXIStarter, setStarXIBenchPlayer, normalizeGameFeatures, lockMatchSquad, releaseMatchSquad, resolveTransferInsiderEvent, beginCupMatch, getStarXISelection, drawRandomStarXICustomCard, STAR_XI_RANDOM_CUSTOM_CARD_COST, getCupPlayerMatchRating, canStarXIPlayerFillSlot, getUnavailableStarXIPlayerIds } from '../app/feature-data.ts';
import { fixtureFor } from '../app/travel-data.ts';
import { createInteractiveMatch, advanceInteractive } from '../app/interactive-match.ts';
import { queueMatchChanges, advanceCupMatch, getCupRegularDurationMs, getCupPenaltyStep, getPenaltyPlayers, getPenaltyWinner, resolveCupPenalty } from '../app/feature-data.ts';
import { draftMatch, validateMatchDraft } from '../app/match-commands.ts';
import { getMissedMatchEvents, matchRanWhileAway, missedMatchCaughtUp, summarizeMissedMatch, MATCH_RAN_WHILE_AWAY } from '../app/match-missed.ts';
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
 const f=ready(),p=getStarXIPlayer('star-pfuschi')!;assert.equal(p.position,null);assert.deepEqual(getStarXIPositions(p),[]);assert.equal(p.rating,80);
 assert.ok(Object.values(p.originalAttributes!.stats).every(s=>s.value===1));
 for(let i=0;i<11;i++)assert.equal(canStarXIPlayerFillSlot(p.id,i),false);
 f.starXI=setStarXIBenchPlayer(f.starXI,0,p.id);assert.equal(f.starXI.benchIds[0],p.id);
 assert.ok(!setBestStarXI(f.starXI).lineupIds.includes(p.id));
 f.cup=beginCupMatch(f.cup,1000,'stadium',getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds));
 assert.equal(getCupPlayerMatchRating(f.cup,p.id,90),null);assert.ok(!baseActors(f,f.cup,1,true).some(a=>a.id===p.id));
 const di=getStarXIPlayer('star-di-certo')!;assert.equal(di.rating,80);assert.equal(di.potential,100);assert.deepEqual(getStarXIPositions(di),['LV','RV']);assert.equal(di.countryCode,'CH');
 const look=getWalkoutPresentation(di);assert.equal(look.countryCode,'CH');assert.equal(look.glasses,true);assert.equal(look.cap,'backwards');
 // Both remain reachable in the existing custom-card draw, with no automatic grant.
 for(const id of [p.id,di.id]){let found=false;for(const rarity of [.01,.5])for(let i=0;i<200;i++){const rolls=[rarity,(i+.5)/200];const result=drawRandomStarXICustomCard({...initialGameFeatures().starXI,fragments:STAR_XI_RANDOM_CUSTOM_CARD_COST},()=>rolls.shift() ?? 0);if(result.player?.id===id)found=true;}assert.ok(found);}
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

// Match rules: penalty shoot-out, injured starters, second yellow cards.
function seeded(seed:number){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function shootout(){
 const f=ready(),home=getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds);
 f.cup=beginCupMatch(f.cup,1000,'stadium',home,f.starXI.formationPositions);
 f.cup={...f.cup,phase:'penalties',penaltyTurn:'home',homeScore:1,awayScore:1};
 return {f,home};
}
const DIRECTIONS=['left','center','right'] as const;
test('penalties alternate, end early in the best of five and are never drawn',()=>{
 let early=0,sudden=0;
 const {f,home}=shootout();
 for(let seed=1;seed<=400;seed++){
  const random=seeded(seed);let cup=f.cup,turn:'home'|'away'='home',finished=false;
  for(let i=0;i<80&&!finished;i++){
   assert.equal(cup.penaltyTurn,turn);
   assert.equal(getCupPenaltyStep(cup),i);
   const result=resolveCupPenalty(cup,80,DIRECTIONS[i%3],2000+i,random,home,f.starXI.formationPositions);
   cup=result.cup;turn=turn==='home'?'away':'home';
   if('finished' in result&&result.finished){
    finished=true;
    const {penaltyHomeScore:h,penaltyAwayScore:a,penaltyHomeTaken:ht,penaltyAwayTaken:at}=cup;
    assert.notEqual(h,a,'a shoot-out never ends level');
    assert.equal(result.won,h>a);
    if(ht>5||at>5){sudden++;assert.equal(ht,at,'sudden death is decided only after both sides kicked');}
    else {assert.ok(ht-at===0||ht-at===1);if(ht<5||at<5)early++;}
   }
  }
  assert.ok(finished);
 }
 assert.ok(early>0&&sudden>0);
});
test('the best of five ends once a side cannot catch up; sudden death needs the same number of attempts',()=>{
 assert.equal(getPenaltyWinner(3,0,3,3),true);
 assert.equal(getPenaltyWinner(3,0,3,2),null);
 assert.equal(getPenaltyWinner(0,3,3,3),false);
 assert.equal(getPenaltyWinner(4,2,4,4),true);
 assert.equal(getPenaltyWinner(5,4,5,4),null);
 assert.equal(getPenaltyWinner(5,4,5,5),true);
 assert.equal(getPenaltyWinner(6,5,6,5),null,'the opponent still kicks after a goal in sudden death');
 assert.equal(getPenaltyWinner(6,5,6,6),true);
 assert.equal(getPenaltyWinner(5,6,6,6),false);
 assert.equal(getPenaltyWinner(6,6,6,6),null);
 assert.equal(getPenaltyWinner(7,6,7,6),null);
 // Equal strength from 5:5: sudden death is a coin flip (20 000 runs).
 const random=seeded(7);let wins=0;
 for(let run=0;run<20000;run++){
  let h=5,a=5,ht=5,at=5,winner:boolean|null=null;
  while(winner===null){if(ht===at){ht++;if(random()<.75)h++;}else{at++;if(random()<.75)a++;}winner=getPenaltyWinner(h,a,ht,at);}
  if(winner)wins++;
 }
 assert.ok(Math.abs(wins/20000-.5)<.02,`sudden death win rate ${wins/20000}`);
});
test('a full sudden death from 5:5 through the game rules is not decided before the opponent kicks',()=>{
 const random=seeded(11);let wins=0,homeKicks=0,homeGoals=0,awayKicks=0,awayGoals=0;
 const {f,home}=shootout();
 // A strong opponent, nearly as good at the spot as the club (about 76 % against 78 % per kick).
 f.cup.opponentRating=99;
 for(let run=0;run<20000;run++){
  let cup={...f.cup,penaltyHomeScore:5,penaltyAwayScore:5,penaltyHomeTaken:5,penaltyAwayTaken:5};
  for(let i=0;;i++){
   const result=resolveCupPenalty(cup,80,DIRECTIONS[Math.floor(random()*3)],2000+i,random,home,f.starXI.formationPositions);
   cup=result.cup;
   const event=cup.penaltyEvents[cup.penaltyEvents.length-1];
   if(event.side==='home'){homeKicks++;if(event.outcome==='goal')homeGoals++;}else{awayKicks++;if(event.outcome==='goal')awayGoals++;}
   if('finished' in result&&result.finished){assert.equal(cup.penaltyHomeTaken,cup.penaltyAwayTaken);if(result.won)wins++;break;}
  }
 }
 // A fair round is won by the club with p(1-q) / (p(1-q) + q(1-p)); before the fix it won far more often.
 const p=homeGoals/homeKicks,q=awayGoals/awayKicks,fair=p*(1-q)/(p*(1-q)+q*(1-p));
 assert.ok(Math.abs(wins/20000-fair)<.015,`club win rate ${wins/20000}, fair ${fair}`);
});
test('sent-off and departed players never take a penalty; the keeper is the active player in goal',()=>{
 const {f,home}=shootout();
 const keeperId=home.find(p=>f.cup.playerMatchPositions[p.id]==='TW')!.id;
 const ranked=getPenaltyPlayers(f.cup,home,f.starXI.formationPositions);
 assert.equal(ranked.length,11);
 // Positions come from the match, not from the array index: a shorter list keeps every role.
 for(const {player,position} of getPenaltyPlayers(f.cup,home.slice(1),f.starXI.formationPositions))assert.equal(position,f.cup.playerMatchPositions[player.id]);
 const shooters=[...home].filter(p=>p.id!==keeperId).sort((a,b)=>b.rating-a.rating);
 const sentOff=[keeperId,shooters[0].id],injured=shooters[1].id;
 const keeperName=getStarXIPlayer(keeperId)!.name;
 const cupBase={...f.cup,sentOffPlayerIds:sentOff,playerExitedAt:{...f.cup.playerExitedAt,[injured]:70,[keeperId]:60,[shooters[0].id]:30}};
 assert.deepEqual(getPenaltyPlayers(cupBase,home,f.starXI.formationPositions).map(p=>p.player.id).filter(id=>[...sentOff,injured].includes(id)),[]);
 let saves=0;
 for(let seed=1;seed<=200;seed++){
  const random=seeded(seed);let cup=cupBase;
  for(let i=0;i<60;i++){
   const result=resolveCupPenalty(cup,80,DIRECTIONS[i%3],2000+i,random,home,f.starXI.formationPositions);
   cup=result.cup;
   const event=cup.penaltyEvents[cup.penaltyEvents.length-1];
   if(event.side==='home')assert.ok(!event.playerId||![...sentOff,injured].includes(event.playerId));
   else if(event.outcome==='save'){saves++;assert.ok(!(result.cup.penaltyMessage).includes(keeperName));}
   if('finished' in result&&result.finished)break;
  }
 }
 assert.ok(saves>0);
});
test('a double tap in the solo shoot-out is aimed at a step that is already taken',()=>{
 const {f,home}=shootout();
 const step=getCupPenaltyStep(f.cup);
 const after=resolveCupPenalty(f.cup,80,'left',2000,seeded(1),home,f.starXI.formationPositions).cup;
 assert.notEqual(getCupPenaltyStep(after),step);
});
test('an injured starter left in his slot does not block other changes',()=>{
 const f=ready(),home=getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds);
 f.cup=beginCupMatch(f.cup,1000,'stadium',home,f.starXI.formationPositions);
 const injured=f.starXI.lineupIds[5];
 f.cup.playerExitedAt[injured]=30;f.cup.injuredPlayerIds[injured]=2;f.cup.substitutionsUsed=5;
 assert.equal(validateMatchDraft(f,draftMatch(f)),'');
 // He still cannot move to another slot.
 const swapped=draftMatch(f);[swapped.lineup[5],swapped.lineup[6]]=[swapped.lineup[6],swapped.lineup[5]];
 assert.notEqual(validateMatchDraft(f,swapped),'');
});
test('a second yellow card sends a player off once, even when older cards have left the card list',()=>{
 const f=ready(),home=getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds);
 f.cup=beginCupMatch(f.cup,1000,'stadium',home,f.starXI.formationPositions);
 const now=f.cup.matchStartedAt+5000,player=home[4];
 let cup={...f.cup,lastTickAt:now};
 cup=advanceCupMatch(cup,80,now,()=>.99,home,f.starXI.formationPositions).cup;
 const yellow=(id:string,minute:number)=>({id,kind:'yellow' as const,side:'club' as const,minute,at:cup.matchStartedAt+minute*100,playerId:player.id,player:player.name,style:'ground' as const,lane:34,seed:0});
 cup.broadcast={...cup.broadcast!,events:[...cup.broadcast!.events,yellow('y1',1),yellow('y2',2)]};
 cup=advanceCupMatch(cup,80,now,()=>.99,home,f.starXI.formationPositions).cup;
 assert.deepEqual(cup.sentOffPlayerIds,[player.id]);
 // Twelve later cards push the second yellow out of the trimmed card list.
 cup.cardEvents=Array.from({length:12},(_,i)=>({...cup.cardEvents[0],id:`other-${i}`,side:'away' as const,playerId:`opponent-${i}`}));
 cup=advanceCupMatch(cup,80,now,()=>.99,home,f.starXI.formationPositions).cup;
 assert.deepEqual(cup.sentOffPlayerIds,[player.id]);
 assert.equal(cup.suspendedPlayerIds.filter(id=>id===player.id).length,1);
 assert.ok(!cup.cardEvents.some(e=>e.playerId===player.id));
});
test('substitutions in a simulated match take their minute from the play time, not the wall clock',()=>{
 const f=ready(),home=getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds);
 f.cup=beginCupMatch(f.cup,1000,'stadium',home,f.starXI.formationPositions);
 f.cup.simulation=createInteractiveMatch(f.cup,f.starXI.lineupIds,f.starXI.formationId);
 f.cup.simulation.time=1800;f.cup.matchPaused=true;
 const slot=f.starXI.lineupIds.findIndex((id,i)=>f.starXI.benchIds.some(b=>b&&canStarXIPlayerFillSlot(b,i,f.starXI.formationPositions)));
 const incoming=f.starXI.benchIds.find(b=>b&&canStarXIPlayerFillSlot(b,slot,f.starXI.formationPositions))!;
 const outgoing=f.starXI.lineupIds[slot];
 // The wall clock says minute 80 or so; the play itself is in minute 30.
 assert.equal(queueMatchChanges(f,[{playerId:incoming,slot}],f.cup.matchStartedAt+getCupRegularDurationMs(f.cup)*.9),'');
 assert.equal(f.cup.playerEnteredAt[incoming],30);
 assert.equal(f.cup.playerExitedAt[outgoing],30);
});
test('a match that ran on while the app was closed lists exactly the scenes that were missed',()=>{
 const f=ready(),home=getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds);
 f.cup=beginCupMatch(f.cup,1000,'stadium',home,f.starXI.formationPositions);
 f.cup.simulation=createInteractiveMatch(f.cup,f.starXI.lineupIds,f.starXI.formationId);
 assert.equal(matchRanWhileAway(f.cup),true);
 const regular=getCupRegularDurationMs(f.cup),since=f.cup.matchStartedAt+regular*.05,until=f.cup.matchStartedAt+regular*.48;
 const saved=advanceInteractive(f.cup,since);
 const back=advanceInteractive(saved,until);
 assert.equal(missedMatchCaughtUp(saved,until),false);
 assert.equal(missedMatchCaughtUp(back,until),true);
 const missed=getMissedMatchEvents(back,since,until);
 assert.ok(missed.every(e=>e.at>since&&e.at<=until));
 assert.equal(missed.filter(e=>e.id.startsWith('goal:')).length,back.matchEvents.filter(g=>g.createdAt>since).length);
 assert.equal(missed.filter(e=>e.id.startsWith('yellow:')).length,(back.broadcast?.events??[]).filter(e=>e.kind==='yellow'&&e.at>since).length);
 assert.ok(summarizeMissedMatch(back,since,until).startsWith(MATCH_RAN_WHILE_AWAY));
 // Known scenes read as short lines in match order, the rest is counted.
 const cup={...back,matchPaused:false,homeScore:2,awayScore:1,opponent:'FC Test',matchEvents:[
  {id:'g1',side:'home' as const,scorerId:null,scorer:'Muster',minute:30,createdAt:until-3000,homeScore:2,awayScore:1,ratingImpacts:{}},
  {id:'g0',side:'away' as const,scorerId:null,scorer:'Gast',minute:12,createdAt:until-9000,homeScore:1,awayScore:1,ratingImpacts:{}},
  {id:'old',side:'home' as const,scorerId:null,scorer:'Früh',minute:2,createdAt:since-1,homeScore:1,awayScore:0,ratingImpacts:{}}],
  cardEvents:[{id:'r1',side:'home' as const,playerId:'x',player:'Rot',reason:'Foul',card:'red' as const,minute:20,createdAt:until-6000,homeScore:1,awayScore:1}],
  injuryEvents:[{id:'i1',playerId:'y',player:'Pech',reason:'Muskel',matches:1,minute:25,createdAt:until-4000,homeScore:1,awayScore:1}],
  broadcast:{...back.broadcast!,events:[]}};
 const text=summarizeMissedMatch(cup,since,until);
 assert.equal(text,`${MATCH_RAN_WHILE_AWAY} Was du verpasst hast: 12′ Gegentor durch Gast (1:1) · 20′ Rote Karte für Rot · 25′ Pech verletzt sich · 30′ Tor durch Muster (2:1). Stand jetzt: 2:1.`);
 assert.ok(summarizeMissedMatch(cup,since,until,2).includes('· und 2 weitere.'));
 assert.ok(summarizeMissedMatch({...cup,active:false},since,until).endsWith('Schlusspfiff: 2:1 gegen FC Test.'));
 // A paused or old-engine match did not run on: the old message stays honest there.
 assert.equal(matchRanWhileAway({...f.cup,matchPaused:true}),false);
 assert.equal(matchRanWhileAway({...f.cup,simulation:undefined}),false);
});
