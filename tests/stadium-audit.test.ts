import test from 'node:test';import assert from 'node:assert/strict';
import audit from '../app/stadium-audit.json';
import {SEASON_CLUBS,VENUES,currentVenue} from '../app/travel-geography.ts';
import {initialGameFeatures,setBestStarXI,STAR_XI_PLAYERS} from '../app/feature-data.ts';
import {fixtureFor,createJourney,normalizeTravel} from '../app/travel-data.ts';
import {planJourney} from '../app/journey-routing.ts';
test('ground corrections have source-backed full-sized football fields and keep stable IDs',()=>{
 for(const r of [...audit.swiss,...audit.international,...audit.fictional]){
  if(!('lat' in r))continue;
  assert.ok(r.source?.startsWith('https://www.openstreetmap.org/way/'));assert.ok(r.pitchAreaSquareMetres!>=3500);
  const venue=SEASON_CLUBS.find(c=>c.venue.id===r.venueId)?.venue??VENUES[r.venueId!];assert.ok(venue);
  assert.equal(venue.lat,r.lat);assert.equal(venue.lon,r.lon);
  if(r.status==='local-pitch-fallback')assert.equal(venue.verification,'pitch-fallback');
 }
 assert.ok(audit.swiss.some(r=>'error' in r)); // Rate-limited entries are explicitly unresolved.
});
test('existing journey snapshots survive correction; new fixtures use updated ground coordinates',()=>{
 const f=initialGameFeatures();f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.map(p=>p.id)});f.seasonMode.matchday=1;
 const fx=fixtureFor(f,'season'),old={...fx,venue:{...fx.venue,lat:fx.venue.lat+.0003}};
 const j=createJourney(old,1000,()=>.9,f);f.travel.journey=j;
 assert.equal(fixtureFor(f,'season').venue.lat,old.venue.lat);assert.deepEqual(normalizeTravel(f.travel).journey,j);
 assert.equal(currentVenue({...fx.venue,lat:1}).lat,fx.venue.lat);
});
test('corrected road endpoints keep cached infrastructure and explicitly estimated final connections',()=>{
 const p=planJourney(VENUES.bern);assert.ok(p.segments.some(s=>s.geometry==='road'&&s.points.length>10));
 assert.ok(p.segments.some(s=>s.geometry==='approximate'));
 assert.equal(p.realSeconds,p.segments.reduce((n,s)=>n+s.realSeconds,0));
});
