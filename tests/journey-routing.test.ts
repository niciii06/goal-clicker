import assert from 'node:assert/strict';
import test from 'node:test';
import { gameSeconds, planJourney, segmentAt, interpolatePath } from '../app/journey-routing.ts';
import { HOME_VENUE, VENUES, distanceKm } from '../app/travel-geography.ts';
import { createJourney, emptyTravel, normalizeTravel, journeyView, settleTravel } from '../app/travel-data.ts';
import type { TravelFixture } from '../app/travel-data.ts';
const fixture=(venue=VENUES.sydney):TravelFixture=>({id:'test:journey',mode:'season',tournamentId:'stadium',opponentId:'test',opponent:'Test',away:true,region:14,venue,schedule:[]});
test('universal acceleration preserves a 48:1 ratio and has no tier cap',()=>{
 assert.equal(gameSeconds(1800),30);assert.equal(gameSeconds(24*3600),1440);assert.equal(gameSeconds(24*3600)/gameSeconds(1800),48);
 const a=createJourney(fixture(VENUES.bern),1000,()=>.9),b=createJourney(fixture(),1000,()=>.9);
 assert.ok(b.baseMs>180000);assert.ok(b.baseMs>a.baseMs*20);
 assert.equal(a.origin!.id,HOME_VENUE.id);assert.equal(b.plan!.acceleration,60);
});
test('Sydney itinerary contains real airport anchors, connecting flight, overhead and final bus',()=>{
 const plan=planJourney(VENUES.sydney),modes=plan.segments.map(s=>s.mode);
 assert.deepEqual(modes,['bus','wait','plane','wait','plane','wait','bus']);
 assert.equal(plan.segments[0].from.id,HOME_VENUE.id);assert.equal(plan.segments[2].to.id,'airport-SIN');assert.equal(plan.segments[4].to.id,'airport-SYD');assert.equal(plan.segments.at(-1)!.to.id,VENUES.sydney.id);
 assert.equal(plan.realSeconds,plan.segments.reduce((n,s)=>n+s.realSeconds,0));assert.ok(plan.realSeconds>20*3600);
 for(let i=1;i<plan.segments.length;i++)assert.ok(distanceKm(plan.segments[i-1].to,plan.segments[i].from)<.0001);
});
test('local games use bus only and Barcelona has ground transfers',()=>{
 assert.ok(planJourney(VENUES.bern).segments.every(s=>s.mode==='bus'));
 const p=planJourney(VENUES.barcelona);assert.equal(p.segments[0].mode,'bus');assert.equal(p.segments.at(-1)!.mode,'bus');assert.ok(p.segments.some(s=>s.mode==='plane'));
});
test('timeline waits at transfer hubs, follows segment duration, reloads and settles once',()=>{
 const j=createJourney(fixture(),1000,()=>.9),plan=j.plan!;
 const firstEnd=plan.segments[0].realSeconds/60;
 assert.equal(segmentAt(plan,firstEnd+.01)!.segment.mode,'wait');
 const arrivalWait=segmentAt(plan,firstEnd+.01)!;
 assert.ok(distanceKm(interpolatePath(arrivalWait.segment.points,arrivalWait.fraction).point,arrivalWait.segment.from)<.000001);
 const saved=normalizeTravel({journey:JSON.parse(JSON.stringify(j)),stats:emptyTravel().stats});
 assert.equal(saved.journey!.endsAt,j.endsAt);assert.deepEqual(saved.journey!.plan,j.plan);
 assert.ok(journeyView(j,j.startedAt+j.baseMs/2).progress>.49);assert.equal(journeyView(j,j.endsAt).remaining,0);
 const settled=settleTravel(saved,j.endsAt);assert.equal(settleTravel(settled,j.endsAt+10000).stats.trips,1);
});
test('legacy active trip keeps its timestamp and receives no longer replacement plan',()=>{
 const j=createJourney(fixture(VENUES.bern),1000,()=>.9);delete j.plan;j.baseMs=45000;j.endsAt=j.startedAt+j.baseMs;
 const restored=normalizeTravel({journey:j,stats:emptyTravel().stats});assert.equal(restored.journey!.endsAt,46000);assert.equal(restored.journey!.plan,undefined);
});
test('distance interpolation handles uneven vertices and the international date line',()=>{
 const uneven=[{lat:0,lon:0},{lat:0,lon:1},{lat:0,lon:10}];assert.ok(Math.abs(interpolatePath(uneven,.5).point.lon-5)<.001);
 const crossing=[{lat:0,lon:179},{lat:0,lon:-179}];assert.equal(Math.abs(interpolatePath(crossing,.5).point.lon),180);
});
test('malformed route plans cannot become active save data',()=>{
 const j=createJourney(fixture(),1000,()=>.9);j.plan!.acceleration=0;assert.equal(normalizeTravel({journey:j,stats:emptyTravel().stats}).journey,null);
});
test('unsupported ground geometry stays explicitly approximate with independent estimated duration',()=>{
 const a=planJourney({...VENUES.bern,id:'uncached-A',lat:47.7,lon:11.9,country:'Deutschland'});
 const b=planJourney({...VENUES.bern,id:'uncached-B',lat:48.9,lon:11.9,country:'Deutschland'});
 assert.ok(a.segments.some(s=>s.geometry==='approximate'));assert.notEqual(a.realSeconds,b.realSeconds);
});
test('cached Bern roads have bends and retained endpoint coordinates',()=>{
 const p=planJourney(VENUES.bern),s=p.segments[0];assert.equal(s.geometry,'road');assert.ok(s.points.length>10);
 assert.ok(distanceKm(s.points[0],HOME_VENUE)<.001);assert.ok(distanceKm(p.segments.at(-1)!.points.at(-1)!,VENUES.bern)<.001);
 if(p.segments.length>1)assert.equal(p.segments.at(-1)!.geometry,'approximate');
});
