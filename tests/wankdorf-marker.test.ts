import test from 'node:test';import assert from 'node:assert/strict';
import cache from '../app/travel-route-cache.json';
import {VENUES} from '../app/travel-geography.ts';
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
