import { TravelMap } from '../app/travel-map.tsx';
import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameFeatures, normalizeGameFeatures, setBestStarXI, STAR_XI_PLAYERS, TOURNAMENTS, beginCupMatch, getStarXISelection } from '../app/feature-data.ts';
import { createJourney, fixtureFor, journeyView, travelGate, consumeTravel, emptyTravel, normalizeTravel, settleTravel, eligibilityError, travelTiming, journeyClock, payTravelFines, travelFineGoals } from '../app/travel-data.ts';
import { HOME_VENUE, REGION_LABELS, DIVISION_REGIONS, seasonGeography, tournamentVenue, distanceKm, routePoints, VENUES } from '../app/travel-geography.ts';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { TravelPanel, TravelStatsPanel } from '../app/travel-panel.tsx';
function ready() { const f=initialGameFeatures();f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.map(p=>p.id)});return f; }
const now=1900000000000;
test('15 existing divisions cover ten monotonic regions, Bern to worldwide',()=>{
 assert.equal(DIVISION_REGIONS.length,15);assert.equal(REGION_LABELS.length,15);assert.deepEqual([...DIVISION_REGIONS].sort((a,b)=>a-b),[...DIVISION_REGIONS]);
 for(let d=1;d<=15;d++)for(let i=0;i<5;i++){const geo=seasonGeography(d,i);assert.ok(geo.id);assert.ok(geo.venue.source);if(d<=2)assert.equal(geo.venue.city,'Bern');if(d<15)assert.equal(geo.venue.country,'Schweiz');}
 assert.equal(HOME_VENUE.stadium,'Heimstadion Bümplizstrasse 45');assert.ok(Math.abs(HOME_VENUE.lat-46.94689)<.00001);assert.ok(Math.abs(HOME_VENUE.lon-7.39373)<.00001);
});
test('all tournament opponents have explicit geographical anchors',()=>{
 for(const t of TOURNAMENTS)for(const o of t.opponents){const v=tournamentVenue(o.id);assert.ok(v.city);assert.ok(Number.isFinite(v.lat));assert.ok(Number.isFinite(v.lon));}
 assert.throws(()=>tournamentVenue('not-a-real-club'));
});
test('season alternates home and away every matchday and faces each opponent at both venues',()=>{
 const f=ready(),home:string[]=[],away:string[]=[];
 for(let day=0;day<10;day++){f.seasonMode.matchday=day;const fixture=fixtureFor(f,'season');assert.equal(fixture.away,day%2===1);(fixture.away?away:home).push(fixture.opponentId);}
 assert.deepEqual([...home].sort(),[...away].sort());
});
test('away gate persists once, survives reload, waits for manual start and cannot be bypassed',()=>{
 const f=ready();f.seasonMode.matchday=5;const fixture=fixtureFor(f,'season');
 assert.equal(travelGate(f,fixture,now),'Reise zuerst zum Auswärtsspiel.');assert.equal(travelGate(f,fixture,now,true),'Reise gestartet.');
 const saved=JSON.stringify(f.travel);assert.equal(travelGate(f,fixture,now+1,true),'Die Mannschaft ist noch unterwegs.');assert.equal(JSON.stringify(f.travel),saved);
 const restored=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
 const arrival=restored.travel.journey!.endsAt;
 assert.equal(travelGate(restored,fixture,arrival),null);assert.equal(restored.cup.active,false);assert.equal(restored.travel.journey!.consumed,false);
 const other=fixtureFor(restored,'tournament');assert.match(travelGate(restored,other,arrival,true)!,/zuerst/);
 consumeTravel(restored,fixture);assert.equal(travelGate(restored,fixture,arrival+1),'Diese Partie wurde bereits gestartet.');
});
test('home game has no journey, old active matches and saves retain all data',()=>{
 const f=ready(),fixture=fixtureFor(f,'season');assert.equal(travelGate(f,fixture,now),null);assert.equal(f.travel.journey,null);
 const legacy=JSON.parse(JSON.stringify(f));delete legacy.travel;legacy.cup.active=true;legacy.cup.matchStartedAt=now;legacy.cup.matchEndsAt=now+180000;
 const normalized=normalizeGameFeatures(legacy);assert.equal(normalized.cup.active,true);assert.equal(normalized.travel.journey,null);assert.deepEqual(normalized.starXI.ownedIds,f.starXI.ownedIds);
});
test('duration calculation uses uncapped door-to-door timing and selects transport correctly',()=>{
 const f=ready(),fixture=fixtureFor(f,'season');
 assert.equal(travelTiming(fixture).baseMs,0);assert.ok(['bus','train'].includes(travelTiming({...fixture,away:true,region:3,venue:VENUES.zurich}).transport));assert.equal(travelTiming({...fixture,away:true,region:9,venue:VENUES.tokyo}).transport,'plane');
 assert.ok(travelTiming({...fixture,away:true,region:9,venue:VENUES.london}).baseMs<travelTiming({...fixture,away:true,region:9,venue:VENUES.tokyo}).baseMs);
 for(let d=1;d<=15;d++)for(let i=0;i<5;i++){f.seasonMode.division=d;f.seasonMode.matchday=i+5;const fx={...fixtureFor(f,'season'),away:true};for(let r=0;r<100;r++){let seed=r+1;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const j=createJourney(fx,now,random);assert.ok(j.endsAt-now>0);assert.equal(j.baseMs,Math.round(j.plan!.realSeconds/60*1000));assert.equal(j.endsAt,j.startedAt+j.baseMs+j.events.reduce((a,e)=>a+e.delta,0));assert.equal(new Set(j.events.map(e=>e.id)).size,j.events.length);}}
});
test('event progress is continuous, monotonic and countdown follows adjustments',()=>{
 const fixture={...fixtureFor(ready(),'season'),away:true,region:9,venue:VENUES.sydney};
 for(const value of [0,.1,.2,.3,.49,.5,.9]){
  const j=createJourney(fixture,now,()=>value);let last=0;
  for(let ms=0;ms<=j.baseMs;ms+=Math.max(1,Math.floor(j.baseMs/1000))){const v=journeyView(j,now+ms);assert.ok(v.progress>=last-1e-9);assert.ok(v.remaining>=0);last=v.progress;}
  for(const e of j.events){assert.ok(Math.abs(journeyView(j,now+e.at-1).progress-journeyView(j,now+e.at).progress)<.001);}
  assert.equal(journeyView(j,j.endsAt).arrived,true);assert.equal(journeyView(j,j.endsAt).progress,1);assert.equal(journeyView(j,j.endsAt).remaining,0);
 }
});
test('random events occur around 70 percent and never mutate football state',()=>{
 const f=ready(),football=JSON.stringify({starXI:f.starXI,career:f.career,cup:f.cup}),fixture={...fixtureFor(f,'season'),away:true};let events=0,seed=39;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<10000;i++)if(createJourney(fixture,now,random).events.length)events++;
 assert.ok(events>6700&&events<7300);assert.equal(JSON.stringify({starXI:f.starXI,career:f.career,cup:f.cup}),football);
});
test('trip statistics count arrival once and survive refresh',()=>{
 const state=emptyTravel();state.journey=createJourney(fixtureFor(ready(),'tournament'),now,()=>.9);
 assert.equal(settleTravel(state,now).stats.trips,0);const arrived=settleTravel(state,state.journey.endsAt);assert.equal(arrived.stats.trips,1);
 const restored=normalizeTravel(JSON.parse(JSON.stringify(arrived)));assert.equal(settleTravel(restored,now+180000).stats.trips,1);assert.ok(restored.stats.furthest);assert.equal(restored.stats.countries.length,1);
});
test('tournament plan is stable, real opponent matches travelled destination and all subsequent rounds remain away',()=>{
 const f=ready(),fixture=fixtureFor(f,'tournament','champions');assert.deepEqual(fixtureFor(f,'tournament','champions'),fixture);
 f.travel.journey=createJourney(fixture,now,()=>.9);
 const cup=beginCupMatch(f.cup,now+180000,'champions',getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions,f.starXI.lineupIds,f.starXI.benchIds,()=>.8,fixture.schedule);
 assert.equal(cup.opponent,fixture.opponent);f.cup={...cup,active:false,pendingNextRound:true,round:1};assert.equal(fixtureFor(f,'tournament','champions').away,true);
 f.cup.round=2;assert.equal(fixtureFor(f,'tournament','champions').away,true);
});
test('lineup, cooldown, red card and active match validation remain enforced',()=>{
 const f=ready();assert.equal(eligibilityError(f,'season','stadium',now),null);
 f.cup.active=true;assert.match(eligibilityError(f,'season','stadium',now)!,/läuft/);f.cup.active=false;
 f.cup.nextTournamentAt=now+100;assert.match(eligibilityError(f,'tournament','stadium',now)!,/Pause/);f.cup.nextTournamentAt=0;
 f.cup.suspendedPlayerIds=[f.starXI.lineupIds[0]];assert.match(eligibilityError(f,'season','stadium',now)!,/gesperrt/);f.cup.suspendedPlayerIds=[];
 f.starXI.lineupIds[0]='';assert.match(eligibilityError(f,'season','stadium',now)!,/Startelf/);
});
test('map, controls, event area, arrival and manual-start button render in German',()=>{
 const travel=emptyTravel();travel.journey=createJourney(fixtureFor(ready(),'tournament'),now,()=>0);
 const during=renderToStaticMarkup(createElement(TravelPanel,{travel,serverNow:()=>now,onStart:()=>{},busy:false}));
 const map=renderToStaticMarkup(createElement(TravelMap,{journey:travel.journey!,now,progress:0}));
 assert.match(map,/tile.openstreetmap.org/);assert.match(during,/Bümplizstrasse 45/);assert.match(map,/OpenStreetMap/);assert.match(map,/Folgen/);assert.match(during,/Reisekarte wird geladen/);assert.doesNotMatch(during,/>Match starten</);
 const arrived=renderToStaticMarkup(createElement(TravelPanel,{travel,serverNow:()=>travel.journey!.endsAt,onStart:()=>{},busy:false}));assert.match(arrived,/Am Stadion angekommen!/);assert.match(arrived,/>Match starten</);
 const stats=renderToStaticMarkup(createElement(TravelStatsPanel,{travel,now:travel.journey.endsAt}));assert.match(stats,/Auswärtsreisen/);
});
test('flight geometry follows great circle and ends at the correct stadium',()=>{
 const route=routePoints(HOME_VENUE,VENUES.tokyo,true);assert.ok(route.length>=65);assert.ok(route.slice(1).every((p,i)=>distanceKm(route[i],p)<=45));assert.ok(distanceKm(route[0],HOME_VENUE)<.0001);assert.ok(distanceKm(route.at(-1)!,VENUES.tokyo)<.0001);
 assert.ok(route.every(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)));assert.equal(REGION_LABELS.length,15);
});

test('a jam stops the team and arrives later, a fast driver arrives earlier, both survive a reload',()=>{
 const base=createJourney({...fixtureFor(ready(),'season'),away:true,venue:VENUES.miami},now,()=>.99);
 const jam={...base,events:[{id:'jam',text:'Stau',at:base.baseMs*.3,delta:base.baseMs*.2}],endsAt:base.startedAt+base.baseMs*1.2};
 assert.ok(normalizeTravel({journey:jam,stats:emptyTravel().stats}).journey,'a delayed journey stays valid');
 // Before the jam the clock runs normally, during it the team stands, afterwards it continues.
 assert.equal(journeyClock(jam,now+base.baseMs*.2),base.baseMs*.2);
 assert.equal(journeyClock(jam,now+base.baseMs*.35),base.baseMs*.3);
 assert.equal(journeyClock(jam,now+base.baseMs*.45),base.baseMs*.3);
 assert.equal(Math.round(journeyClock(jam,now+base.baseMs*.6)),Math.round(base.baseMs*.4));
 assert.equal(journeyView(jam,jam.endsAt-1).arrived,false);
 assert.equal(journeyView(jam,jam.endsAt).progress,1);
 const fast={...base,events:[{id:'speeding',text:'Raser',at:base.baseMs*.3,delta:-base.baseMs*.14,fine:60}],endsAt:base.startedAt+base.baseMs*.86};
 assert.ok(normalizeTravel({journey:fast,stats:emptyTravel().stats}).journey);
 assert.ok(Math.abs(journeyClock(fast,fast.endsAt-1)-base.baseMs)<base.baseMs*.001,'the saving ends exactly at the arrival');
 // The clock moves forward without jumps, so the vehicle on the map never teleports.
 let previous=0;for(let t=now;t<=jam.endsAt;t+=base.baseMs/400){const clock=journeyClock(jam,t);assert.ok(clock>=previous&&clock-previous<=base.baseMs/400+1);previous=clock;}
 // A journey whose arrival does not match its events is rejected.
 assert.equal(normalizeTravel({journey:{...jam,endsAt:base.startedAt+base.baseMs},stats:emptyTravel().stats}).journey,null);
});
test('new journeys move the arrival by their events, sized to the trip',()=>{
 const f=ready(),fixture={...fixtureFor(f,'season'),away:true,venue:VENUES.miami};let seed=7,delayed=0,faster=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<500;i++){const j=createJourney(fixture,now,random,f);
  assert.equal(j.endsAt,j.startedAt+j.baseMs+j.events.reduce((total,e)=>total+e.delta,0));
  for(const e of j.events)assert.ok(Math.abs(e.delta)<=j.baseMs*.4);
  const total=j.endsAt-j.startedAt-j.baseMs;if(total>0)delayed++;if(total<0)faster++;
  assert.ok(normalizeTravel({journey:j,stats:f.travel.stats}).journey);}
 assert.ok(delayed>0&&faster>0,`${delayed} delayed, ${faster} faster`);
});
test('travel fines are paid once on arrival and scale with the passive income',()=>{
 const f=ready(),base=createJourney({...fixtureFor(f,'season'),away:true,venue:VENUES.miami},now,()=>.99,f);
 f.travel.journey={...base,events:[{id:'speeding',text:'Raser',at:0,delta:0,fine:60},{id:'no-parking',text:'Parkbusse',at:base.baseMs*.9,delta:0,fine:20}],endsAt:base.startedAt+base.baseMs};
 assert.equal(payTravelFines(f,1e9,100,f.travel.journey.endsAt-1),0,'nothing before arrival');
 assert.equal(payTravelFines(f,1e9,100,f.travel.journey.endsAt),8000);
 assert.equal(f.travel.journey.finesPaid,true);
 assert.equal(payTravelFines(f,1e9,100,f.travel.journey.endsAt+1000),0,'only once');
 assert.equal(f.history.at(-1)?.title,'Reisebusse bezahlt');
 // Early on a fined second costs at least five goals, and a fine never takes more than the club has.
 assert.equal(travelFineGoals(60,0),300);
 const poor=ready();poor.travel.journey={...f.travel.journey,finesPaid:false};
 assert.equal(payTravelFines(poor,120,100,poor.travel.journey.endsAt),120);
});
