import test from 'node:test';import assert from 'node:assert/strict';
import cache from '../app/travel-route-cache.json';
import {SEASON_CLUBS,VENUES,tournamentVenue} from '../app/travel-geography.ts';
import {initialGameFeatures,normalizeSeasonModeState} from '../app/feature-data.ts';
import {createJourney,fixtureFor,normalizeTravel} from '../app/travel-data.ts';
import {planJourney} from '../app/journey-routing.ts';
import {cachedLegPoints} from '../app/journey-routing.ts';
const km=(a:{lat:number;lon:number},b:{lat:number;lon:number})=>{const r=(d:number)=>d*Math.PI/180,x=Math.sin(r(b.lat-a.lat)/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(r(b.lon-a.lon)/2)**2;return 12742*Math.asin(Math.sqrt(x));};
// Independent reference: OSM stadium centre (way 32485183), Papiermühlestrasse 71, Bern.
const WANKDORF_REFERENCE={lat:46.96308,lon:7.46484};
test('the Wankdorf anchor lies on the stadium, not in the nearby forest or at the city centre',()=>{
 assert.ok(km(VENUES.bern,WANKDORF_REFERENCE)<.1,'anchor within 100 m of the stadium centre');
 assert.ok(km(VENUES.bern,{lat:46.948,lon:7.4474})>2,'not the city centre');
});
test('every saved road route into Bern ends within 100 m of the Wankdorf anchor or is not a route to Wankdorf',()=>{
 const routes=((cache as { routes?: unknown }).routes??cache) as Record<string,{points:{lat:number;lon:number}[]}>;
 const toWankdorf=Object.entries(routes).filter(([key])=>key.startsWith('bus:')&&km(routes[key].points.at(-1)!,VENUES.bern)<.1);
 assert.ok(toWankdorf.length>=1);
 for(const [,route] of toWankdorf)assert.ok(km(route.points.at(-1)!,VENUES.bern)<.1);
});
test('a leg to the audited anchor still gets the cached road course although the cache key holds the older anchor',()=>{
 const from={lat:46.94689,lon:7.39373};
 const leg=cachedLegPoints({mode:'bus',from,to:{lat:VENUES.bern.lat,lon:VENUES.bern.lon}});
 assert.ok(leg&&leg.geometry==='road'&&leg.points.length>=3);
 assert.ok(km(leg.points.at(-1)!,VENUES.bern)<.001,'the drawn leg ends exactly on the marker');
});

// The season club BSC Young Boys plays in the same stadium as the tournament anchor. Its own audit request failed, so the
// season venue stayed at the municipality centre of Bern (46.954559, 7.420685), 3.5 km from the Wankdorf with a 29 point road.
const OLD_YB_MUNICIPALITY={lat:46.954559,lon:7.420685};
const YB_ID='bsc-young-boys',YB_VENUE_ID='venue-bsc-young-boys';
function seasonAwayAtYoungBoys(){
 const f=initialGameFeatures();f.seasonMode=normalizeSeasonModeState({division:14,highestDivision:14},'FC Goal');
 // A normal season game: an away match of the generated table against BSC Young Boys.
 for(let matchday=0;matchday<10;matchday++){f.seasonMode.matchday=matchday;const fx=fixtureFor(f,'season');if(fx.away&&f.seasonMode.table.find(row=>row.id===fx.opponentId)?.clubId===YB_ID)return{f,fx,matchday};}
 throw new Error('no away game against BSC Young Boys in the generated season');
}
const lastRoadPoint=(plan:ReturnType<typeof planJourney>)=>plan.segments.filter(s=>s.geometry==='road').at(-1)!.points.at(-1)!;
test('the season club BSC Young Boys sits on the audited Wankdorf and keeps its club id, venue id and every other field',()=>{
 const club=SEASON_CLUBS.find(c=>c.id===YB_ID)!;
 assert.equal(club.venue.id,YB_VENUE_ID);assert.equal(club.venue.stadium,'Stadion Wankdorf');
 assert.ok(km(club.venue,VENUES.bern)<.001,'same ground as the tournament anchor');
 assert.ok(km(club.venue,WANKDORF_REFERENCE)<.1);assert.ok(km(club.venue,OLD_YB_MUNICIPALITY)>3,'no longer the municipality centre');
 assert.equal(club.venue.verification,'stadium');assert.doesNotMatch(club.venue.coordinateNote??'',/Approximate municipality/);
 assert.equal((club.venue as {coordinateLabel?:string}).coordinateLabel,undefined,'no stale municipality label');
 // Stable keys: the catalogue still has 89 clubs and unique club and venue ids; only this one venue moved.
 assert.equal(SEASON_CLUBS.length,89);assert.equal(new Set(SEASON_CLUBS.map(c=>c.id)).size,89);
 assert.equal(SEASON_CLUBS.filter(c=>c.venue.id===YB_VENUE_ID).length,1);
});
test('a real generated away game at BSC Young Boys and the tournament plan end at the same stadium road end',()=>{
 const {fx}=seasonAwayAtYoungBoys();
 assert.equal(fx.venue.id,YB_VENUE_ID);assert.ok(km(fx.venue,VENUES.bern)<.001);
 const season=planJourney(fx.venue),tournament=planJourney(tournamentVenue('stadium-bsc-young-burs'));
 assert.deepEqual(season.segments.map(s=>[s.geometry,s.points.length]),tournament.segments.map(s=>[s.geometry,s.points.length]),'same road and the same short estimated connector');
 assert.equal(season.segments.filter(s=>s.geometry==='road').reduce((n,s)=>n+s.points.length,0),75);
 assert.ok(km(lastRoadPoint(season),VENUES.bern)<.1,'the road ends within 100 m of the stadium');
 assert.ok(km(season.segments.at(-1)!.points.at(-1)!,fx.venue)<.001,'the drawn route ends exactly on the marker');
 // Before: the road ended at the municipality centre.
 const old=planJourney({...fx.venue,...OLD_YB_MUNICIPALITY});
 assert.ok(km(lastRoadPoint(old),VENUES.bern)>3,'the old season route ended more than 3 km from the stadium');
});
test('the season fixture and the tournament use one ground; other clubs and home games are not touched',()=>{
 const {f,matchday}=seasonAwayAtYoungBoys();
 f.seasonMode.matchday=matchday;const season=fixtureFor(f,'season');
 assert.ok(km(season.venue,tournamentVenue('stadium-bsc-young-burs'))<.001);
 // Another away game keeps its own venue (Basel is still the audited or municipality point of its own record, not Wankdorf).
 f.seasonMode.matchday=3;const basel=fixtureFor(f,'season');assert.equal(basel.venue.id,'venue-fc-basel');assert.ok(km(basel.venue,VENUES.bern)>50);
 f.seasonMode.matchday=2;assert.equal(fixtureFor(f,'season').away,false,'a home game is still the home ground');
});
test('a journey already under way keeps the old venue copy; stored plans and fixtures are not moved',()=>{
 const {f,fx,matchday}=seasonAwayAtYoungBoys();
 const oldVenue={...fx.venue,...OLD_YB_MUNICIPALITY,verification:'municipality' as const};
 const journey=createJourney({...fx,venue:oldVenue},1000,()=>.9,f);f.travel.journey=journey;f.seasonMode.matchday=matchday;
 const snapshot=structuredClone(journey);
 const again=fixtureFor(f,'season');
 assert.equal(again.id,fx.id);assert.equal(again.venue.lat,OLD_YB_MUNICIPALITY.lat);assert.equal(again.venue.lon,OLD_YB_MUNICIPALITY.lon,'the underway journey fixture keeps its stored venue');
 assert.deepEqual(normalizeTravel(f.travel).journey,snapshot,'the stored journey (plan, times, fixture) is unchanged by normalisation');
 assert.ok(km(lastRoadPoint(journey.plan as ReturnType<typeof planJourney>),VENUES.bern)>3,'its stored route still ends where it was planned');
 // A journey that is finished or not started gets the corrected venue; the id is the same either way.
 f.travel.journey=null;assert.ok(km(fixtureFor(f,'season').venue,VENUES.bern)<.001);
 assert.equal(fixtureFor(f,'season').venue.id,YB_VENUE_ID);
});
