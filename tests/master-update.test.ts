import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameFeatures, normalizeGameFeatures, normalizeSeasonModeState, recordSeasonModeMatch, getEligibleEventPlayers, setBestStarXI, STAR_XI_PLAYERS, STAR_PACKS, REWARD_PACKS, getRewardPackOdds, openStarPack, openEarnedPack, completeTournamentRun, seasonBackgroundPairings, getTournamentRewardPack, beginSeasonCupMatch } from '../app/feature-data.ts';
import { SEASON_CLUBS, classifyDestination, HOME_VENUE, VENUES, seasonGeography, distanceKm } from '../app/travel-geography.ts';
import { fixtureFor, createJourney, TRAVEL_RANGES, journeyView, normalizeTravel, travelTiming, consumeTravel } from '../app/travel-data.ts';
function random(seed=849){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function ready(){const f=initialGameFeatures();f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.map(p=>p.id)});return f;}
test('75 distinct opponents populate exactly fifteen six-team leagues, local to international',()=>{
 assert.equal(SEASON_CLUBS.length,75);assert.equal(new Set(SEASON_CLUBS.map(c=>c.id)).size,75);assert.equal(new Set(SEASON_CLUBS.map(c=>c.name)).size,75);
 for(let d=1;d<=15;d++){const s=normalizeSeasonModeState({division:d});assert.equal(s.table.length,6);for(let i=0;i<5;i++){const c=seasonGeography(d,i);assert.equal(c.league,16-d);if(d===1)assert.ok(c.fictional);else if(d<15)assert.equal(c.venue.country,'Schweiz');else assert.notEqual(c.venue.country,'Schweiz');assert.ok(c.venue.source);assert.ok(Number.isFinite(c.venue.lat)&&Math.abs(c.venue.lat)<85);}}
 assert.ok(SEASON_CLUBS.some(c=>c.league===1&&c.name.includes('Barcelon')));assert.ok(SEASON_CLUBS.some(c=>c.league===1&&c.name.includes('Madreto')));
});
test('full ten-match round robin has balanced return fixtures and every pair meets twice',()=>{
 const f=ready(),counts=new Map<string,number>();
 for(let day=0;day<10;day++){f.seasonMode.matchday=day;const fx=fixtureFor(f,'season');assert.equal(fx.away,day%2===1);assert.equal(fx.venue.id,fx.away?f.seasonMode.table.find(t=>t.id===fx.opponentId)!.venue!.id:HOME_VENUE.id);
  for(const pair of [['club',fx.opponentId],...seasonBackgroundPairings(day)]){const key=pair.sort().join(':');counts.set(key,(counts.get(key)??0)+1);}
 }
 assert.equal(counts.size,15);assert.ok([...counts.values()].every(n=>n===2));
 let s=f.seasonMode;s.matchday=0;for(let i=0;i<10;i++)s=recordSeasonModeMatch(s,2,1,'FC Test',1000+i,()=>.5).state;assert.ok(s.lastTable.every(t=>t.played===10));
});
test('legacy active standings, completed results, players and travel snapshots survive repeated normalization',()=>{
 const f=ready();f.seasonMode.matchday=3;f.seasonMode.table[1].name='Bayern Münchan';f.seasonMode.table[1].points=7;f.seasonMode.table[1].played=3;delete f.seasonMode.table[1].venue;delete f.seasonMode.fixtures;
 f.seasonMode.history=[{id:'legacy',division:1,matchday:1,opponent:'Old Team',opponentRating:57,clubScore:2,opponentScore:1,outcome:'win',completedSeason:false,seasonOutcome:null,createdAt:1}];
 const n=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));assert.equal(n.seasonMode.table[1].points,7);assert.equal(n.seasonMode.table[1].name,'Bayern Münchan');assert.equal(n.seasonMode.table[1].venue!.city,'München');assert.deepEqual(n.seasonMode.history,f.seasonMode.history);assert.deepEqual(n.starXI.ownedIds,f.starXI.ownedIds);assert.deepEqual(normalizeGameFeatures(n),n);
});
test('fifteen unchanged tiers, geographic classification, deterministic duration, zero home wait',()=>{
 assert.deepEqual(TRAVEL_RANGES,[[5,10],[10,20],[15,25],[20,30],[20,35],[30,45],[35,50],[40,55],[45,60],[60,90],[75,110],[90,130],[110,150],[130,170],[150,180]]);
 const f=ready();for(const c of SEASON_CLUBS){const fx={...fixtureFor(f,'season'),away:true,venue:c.venue,region:classifyDestination(c.venue)};const t=travelTiming(fx);assert.ok(t.baseMs>0);assert.equal(t.baseMs,Math.round(t.plan!.realSeconds/60*1000));assert.deepEqual(travelTiming(fx),t);const j=createJourney(fx,1000,random(),f);assert.equal(j.endsAt,j.startedAt+t.baseMs+j.events.reduce((total,e)=>total+e.delta,0));assert.ok(normalizeTravel({journey:j,stats:f.travel.stats}).journey);}
 assert.equal(travelTiming(fixtureFor(f,'season')).baseMs,0);assert.throws(()=>createJourney(fixtureFor(f,'season'),0));
 assert.equal(classifyDestination(VENUES.tokyo),14);assert.equal(classifyDestination(VENUES.miami),13);assert.equal(classifyDestination(VENUES.barcelona),11);assert.equal(classifyDestination(VENUES.madrid,true),12);
 assert.equal(distanceKm(HOME_VENUE,HOME_VENUE),0);
});
test('events exclude collection reserves, sold, loaned and unavailable players; update after squad edits',()=>{
 const f=ready(),before=getEligibleEventPlayers(f);assert.ok(before.length>=11);const sold=before[0].id,loaned=before[1].id,injured=before[2].id;
 f.starXI.ownedIds=f.starXI.ownedIds.filter(id=>id!==sold);f.transferSaga.loans=[{playerId:loaned,club:'Test',status:'active',tournamentId:'stadium',createdAt:1}];f.cup.injuredPlayerIds[injured]=1;
 const allowed=getEligibleEventPlayers(f);assert.ok(!allowed.some(p=>[sold,loaned,injured].includes(p.id)));assert.ok(allowed.every(p=>f.starXI.lineupIds.includes(p.id)||f.starXI.benchIds.includes(p.id)));
 assert.ok(getEligibleEventPlayers(f,'TW').every(p=>p.positions.includes('TW')));
 const fx={...fixtureFor(f,'season'),away:true,venue:VENUES.miami};const j=createJourney(fx,1000,()=>0,f);j.events=[{id:'snacks',text:before[0].name,template:'{player} isst die Snacks.',at:0,delta:0}];const rendered=journeyView(j,1001,f);assert.ok(!rendered.events[0].text.includes(before[0].name));
});
test('six reward distributions total100%, simulations match configured chances and increasing means',()=>{
 const rng=random();let prior=0;
 for(const pack of REWARD_PACKS){assert.ok(Math.abs(pack.odds.reduce((s,o)=>s+o.chance,0)-1)<1e-12);const groups=getRewardPackOdds(pack.id as `reward-${1|2|3|4|5|6}`),counts=groups.map(()=>0);let total=0;const n=100000;
  for(let i=0;i<n;i++){const o=openStarPack(pack.id,[],rng);assert.ok(!o.player.isCustom&&o.player.cardType!=='icon'&&o.player.cardType!=='legendary');assert.deepEqual(o.player,STAR_XI_PLAYERS.find(p=>p.id===o.player.id));total+=o.player.rating;counts[groups.findIndex(g=>o.player.rating>=g.minRating&&o.player.rating<=g.maxRating)]++;}
  groups.forEach((g,i)=>assert.ok(Math.abs(counts[i]/n-g.chance)<Math.max(.001,6*Math.sqrt(g.chance*(1-g.chance)/n)),`${pack.id} ${g.label}`));assert.ok(total/n>prior);prior=total/n;console.log(`${pack.id}: mean ${prior.toFixed(3)}, counts ${counts.join(',')}`);
 }
 const only=STAR_XI_PLAYERS.filter(p=>!p.isCustom&&p.rating>=80&&p.rating<=85);assert.equal(getRewardPackOdds('reward-6',only)[0].chance,1);
 assert.deepEqual(STAR_PACKS.map(p=>p.id),['scrap','regional','scout','profi','elite','weltklasse','legend']);assert.deepEqual(STAR_PACKS.map(p=>p.price),[15000,1000000,15000000,100000000,1500000000,10000000000,20000000000]);
});
test('completion and reward openings persist exactly once, replay gives separate valid rewards',()=>{
 let f=ready();f.cup.matchStartedAt=1000;f.cup.mode='tournament';const summary={tournamentId:'stadium' as const,tournamentWon:true,completedRound:3,opponent:'Test',homeScore:1,awayScore:0,tieBreak:false};
 f=completeTournamentRun(f,summary,2000,()=>.9);assert.equal(f.earnedPacks.length,1);assert.equal(f.earnedPacks[0].packId,getTournamentRewardPack('stadium').id);assert.equal(f.goalBoost.multiplier,1);
 f=completeTournamentRun(normalizeGameFeatures(f),summary,2001);assert.equal(f.earnedPacks.length,1);const id=f.earnedPacks[0].id;
 assert.ok(openEarnedPack(f,id,3000,random()));const fragments=f.starXI.fragments;assert.equal(openEarnedPack(normalizeGameFeatures(f),id,3001),null);assert.equal(f.starXI.fragments,fragments);
 f.cup.matchStartedAt=4000;f=completeTournamentRun(f,summary,5000);assert.equal(f.earnedPacks.length,2);assert.equal(f.completedTournamentRuns.length,2);
});
test('match stores actual home-away venue while internal scores retain club ownership semantics',()=>{
 const f=ready();f.seasonMode.matchday=1;const fx=fixtureFor(f,'season');f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,1000);consumeTravel(f,fx);assert.ok(f.cup.fixture!.away);assert.equal(f.cup.fixture!.venue.id,fx.venue.id);assert.deepEqual(normalizeGameFeatures(f).cup.fixture,f.cup.fixture);
});
