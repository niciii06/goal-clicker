import { HOME_VENUE, distanceKm, routePoints } from './travel-geography';
import type { GeoPoint, Venue } from './travel-geography';
import ROUTES from './travel-route-cache.json';

export const TRAVEL_CONFIG = { acceleration: 60, version: 2 } as const;
export type Hub = GeoPoint & { id: string; name: string };
export type Segment = {
 id: string; mode: 'bus'|'train'|'plane'|'wait'; label: string;
 from: Hub; to: Hub; points: GeoPoint[]; realSeconds: number; distanceKm: number;
 geometry: 'road'|'rail'|'great-circle'|'approximate'|'stationary'; source: string;
};
export type JourneyPlan = { version: 2; acceleration: number; segments: Segment[]; realSeconds: number };
type CachedRoute = { points: GeoPoint[]; seconds: number; km: number; source: string; geometry: 'road'|'rail'|'approximate' };
const cachedRoutes = ROUTES as Record<string,CachedRoute>;
export const STATIONS: Record<string,Hub> = {
 bern:{id:'rail-bern',name:'Bahnhof Bern',lat:46.949,lon:7.439},
 zurich:{id:'rail-zurich',name:'Zürich HB',lat:47.3782,lon:8.5402},
 geneva:{id:'rail-geneva',name:'Genève Cornavin',lat:46.2102,lon:6.1423},
 lausanne:{id:'rail-lausanne',name:'Bahnhof Lausanne',lat:46.5168,lon:6.629},
 basel:{id:'rail-basel',name:'Basel SBB',lat:47.547,lon:7.59},
 luzern:{id:'rail-luzern',name:'Bahnhof Luzern',lat:47.05,lon:8.31},
 stgallen:{id:'rail-stgallen',name:'Bahnhof St. Gallen',lat:47.423,lon:9.37},
 winterthur:{id:'rail-winterthur',name:'Bahnhof Winterthur',lat:47.5,lon:8.724},
 lugano:{id:'rail-lugano',name:'Bahnhof Lugano',lat:46.005,lon:8.947},
 sion:{id:'rail-sion',name:'Bahnhof Sion',lat:46.228,lon:7.359},
 thun:{id:'rail-thun',name:'Bahnhof Thun',lat:46.755,lon:7.63},
 biel:{id:'rail-biel',name:'Bahnhof Biel',lat:47.132,lon:7.243},
};
export const AIRPORTS: Record<string,Hub> = {
 ZRH:{id:'airport-ZRH',name:'Zürich Flughafen (ZRH)',lat:47.458,lon:8.555},
 GVA:{id:'airport-GVA',name:'Genève Aéroport (GVA)',lat:46.238,lon:6.109},
 BCN:{id:'airport-BCN',name:'Barcelona El Prat (BCN)',lat:41.297,lon:2.078},
 MAD:{id:'airport-MAD',name:'Madrid Barajas (MAD)',lat:40.472,lon:-3.561},
 LHR:{id:'airport-LHR',name:'London Heathrow (LHR)',lat:51.47,lon:-.454},
 MAN:{id:'airport-MAN',name:'Manchester Airport (MAN)',lat:53.354,lon:-2.275},
 CDG:{id:'airport-CDG',name:'Paris Charles de Gaulle (CDG)',lat:49.01,lon:2.548},
 MUC:{id:'airport-MUC',name:'München Flughafen (MUC)',lat:48.354,lon:11.786},
 MXP:{id:'airport-MXP',name:'Milano Malpensa (MXP)',lat:45.63,lon:8.728},
 VIE:{id:'airport-VIE',name:'Wien Flughafen (VIE)',lat:48.11,lon:16.57},
 AMS:{id:'airport-AMS',name:'Amsterdam Schiphol (AMS)',lat:52.309,lon:4.764},
 LIS:{id:'airport-LIS',name:'Lisboa Airport (LIS)',lat:38.774,lon:-9.134},
 OPO:{id:'airport-OPO',name:'Porto Airport (OPO)',lat:41.248,lon:-8.681},
 NAP:{id:'airport-NAP',name:'Napoli Airport (NAP)',lat:40.886,lon:14.291},
 IST:{id:'airport-IST',name:'Istanbul Airport (IST)',lat:41.275,lon:28.752},
 MIA:{id:'airport-MIA',name:'Miami International (MIA)',lat:25.796,lon:-80.287},
 HND:{id:'airport-HND',name:'Tokyo Haneda (HND)',lat:35.549,lon:139.78},
 GIG:{id:'airport-GIG',name:'Rio Galeão (GIG)',lat:-22.81,lon:-43.25},
 SIN:{id:'airport-SIN',name:'Singapore Changi (SIN)',lat:1.364,lon:103.992},
 SYD:{id:'airport-SYD',name:'Sydney Airport (SYD)',lat:-33.94,lon:151.175},
};
const AIRPORT_FOR_VENUE: Record<string,string> = {barcelona:'BCN',madrid:'MAD',atletico:'MAD',london:'LHR',chelsea:'LHR',tottenham:'LHR',manchester:'MAN',city:'MAN',liverpool:'MAN',paris:'CDG',munich:'MUC',milan:'MXP',turin:'MXP',vienna:'VIE',amsterdam:'AMS',eindhoven:'AMS',lisbon:'LIS',porto:'OPO',naples:'NAP',istanbul:'IST',miami:'MIA',tokyo:'HND',rio:'GIG',sydney:'SYD',dortmund:'AMS',leverkusen:'AMS',leipzig:'MUC',monaco:'MXP'};
export const asHub = (v:Venue):Hub => ({id:v.id,name:v.stadium,lat:v.lat,lon:v.lon});
export const routeKey = (a:GeoPoint,b:GeoPoint,mode:'bus'|'train') => `${mode}:${a.lat.toFixed(5)},${a.lon.toFixed(5)}:${b.lat.toFixed(5)},${b.lon.toFixed(5)}`;
export const gameSeconds = (realSeconds:number,acceleration:number=TRAVEL_CONFIG.acceleration) => realSeconds/acceleration;
export function pathLength(points:GeoPoint[]) { return points.slice(1).reduce((n,p,i)=>n+distanceKm(points[i],p),0); }
export function interpolatePath(points:GeoPoint[],fraction:number):{point:GeoPoint;bearing:number} {
 const distances=points.slice(1).map((p,i)=>distanceKm(points[i],p));
 let remaining=distances.reduce((n,d)=>n+d,0)*Math.max(0,Math.min(1,fraction));
 for(let i=0;i<distances.length;i++){
  if(remaining<=distances[i]||i===distances.length-1){
   const t=distances[i]>0?remaining/distances[i]:0,a=points[i],b=points[i+1];
   const dl=((b.lon-a.lon+540)%360)-180;
   return {point:{lat:a.lat+(b.lat-a.lat)*t,lon:((a.lon+dl*t+540)%360)-180},bearing:Math.atan2(dl*Math.cos(a.lat*Math.PI/180),b.lat-a.lat)*180/Math.PI};
  }
  remaining-=distances[i];
 }
 return {point:points[0],bearing:0};
}
function ground(from:Hub,to:Hub,mode:'bus'|'train',label:string):Segment {
 const key=routeKey(from,to,mode),cache=cachedRoutes[key],direct=distanceKm(from,to);
 const km=cache?.km??direct*(mode==='bus'?1.3:1.2);
 // Urban bus: 25 km/h, regional roads: 55, motorway: 75. IC rail: 95 km/h,
 // including intermediate stops; no unsupported high-speed assumption.
 const seconds=cache?cache.seconds*(mode==='bus'?1.12:1)+(mode==='bus'?180:0):(km/(mode==='bus'?(direct<15?25:direct<80?55:75):95)*3600+(mode==='bus'?180:600));
 return {id:key,mode,label,from,to,points:cache?.points??[from,to],realSeconds:seconds,distanceKm:km,geometry:cache?.geometry??'approximate',source:cache?.source??'Geschätzte Verbindung, keine geprüfte Streckengeometrie'};
}
function wait(at:Hub,minutes:number,label:string):Segment { return {id:`wait:${at.id}:${label}`,mode:'wait',label,from:at,to:at,points:[at,at],realSeconds:minutes*60,distanceKm:0,geometry:'stationary',source:'Dokumentierte Zeitannahme, kein veröffentlichter Fahrplan'}; }
function flight(from:Hub,to:Hub):Segment {
 const km=distanceKm(from,to),seconds=km/(km<2000?700:850)*3600+1800;
 return {id:`flight:${from.id}:${to.id}`,mode:'plane',label:`Flug ${from.name} → ${to.name}`,from,to,points:routePoints(from,to,true),realSeconds:seconds,distanceKm:km,geometry:'great-circle',source:'Geografische Näherung und geschätzte Flugzeit; kein bestätigter Flugplan'};
}
function plan(input:Segment[]):JourneyPlan {
 const segments=input.flatMap(s=>{
  if(s.mode!=='bus'||s.geometry!=='approximate'||cachedRoutes[s.id])return [s];
  const candidates=Object.entries(cachedRoutes).filter(([key,r])=>key.startsWith('bus:')&&r.geometry==='road'&&r.points.length>=3&&distanceKm(r.points[0],s.from)<.001&&distanceKm(r.points.at(-1)!,s.to)<3).sort((a,b)=>distanceKm(a[1].points.at(-1)!,s.to)-distanceKm(b[1].points.at(-1)!,s.to));
  const cached=candidates[0];if(!cached)return [s];
  const [key,route]=cached,point=route.points.at(-1)!,hub={...point,id:`route-end:${key}`,name:'Ende der geprüften Strassenroute'};
  const road:Segment={...s,id:`road:${key}`,to:hub,points:route.points.map(p=>({...p})),realSeconds:route.seconds*1.12,distanceKm:route.km,geometry:'road',source:route.source};
  const connection=ground(hub,s.to,'bus',`${s.label} · Routenverlauf geschätzt`);
  return [road,connection];
 });
 return {version:2,acceleration:TRAVEL_CONFIG.acceleration,segments,realSeconds:segments.reduce((n,s)=>n+s.realSeconds,0)};
}
export function planJourney(destination:Venue):JourneyPlan {
 const start=asHub(HOME_VENUE),end=asHub(destination),km=distanceKm(start,end);
 const road=plan([ground(start,end,'bus',`Teambus nach ${destination.city}`)]);
 if(km<80)return road;
 const station=Object.values(STATIONS).sort((a,b)=>distanceKm(a,end)-distanceKm(b,end))[0];
 const rail=distanceKm(station,end)<35?plan([ground(start,STATIONS.bern,'bus','Teambus zum Bahnhof Bern'),wait(STATIONS.bern,15,'Einsteigen und Warten auf den Zug'),ground(STATIONS.bern,station,'train',`Intercity nach ${station.name}`),wait(station,10,'Umsteigen zum Teambus'),ground(station,end,'bus',`Teambus zum ${destination.stadium}`)]):null;
 const domestic=['Schweiz','Switzerland','CH'].includes(destination.country);
 if(domestic)return rail&&rail.realSeconds<road.realSeconds?rail:road;
 if(km<700&&!['England','Schottland','Irland','Wales'].includes(destination.country))return road;
 const nearestAirport=Object.values(AIRPORTS).filter(a=>!['airport-SIN','airport-ZRH','airport-GVA'].includes(a.id)).sort((a,b)=>distanceKm(a,end)-distanceKm(b,end))[0];
 const airport=AIRPORTS[AIRPORT_FOR_VENUE[destination.id]]??(distanceKm(nearestAirport,end)<400?nearestAirport:undefined);
 // Unknown generated grounds use road estimates locally; across oceans they need
 // explicit airport metadata before a commercially plausible air itinerary exists.
 if(!airport)return road;
 const airCandidates=[AIRPORTS.ZRH,AIRPORTS.GVA].map(departure=>{
  const segments=[ground(start,departure,'bus',`Teambus zum ${departure.name}`),wait(departure,120,'Check-in, Sicherheitskontrolle und Boarding')];
  if(airport.id==='airport-SYD')segments.push(flight(departure,AIRPORTS.SIN),wait(AIRPORTS.SIN,120,'Umsteigen in Singapore'),flight(AIRPORTS.SIN,airport));
  else segments.push(flight(departure,airport));
  segments.push(wait(airport,60,'Aussteigen, Einreise und Gepäck'),ground(airport,end,'bus',`Teambus zum ${destination.stadium}`));
  return plan(segments);
 });
 // Zurich is the configured long-haul hub. European alternatives compare total
 // estimated door-to-door time; the hub graph is an estimate, never a timetable.
 const air=km>3500?airCandidates[0]:airCandidates.sort((a,b)=>a.realSeconds-b.realSeconds)[0];
 return km<1600&&!['England','Schottland','Irland','Wales'].includes(destination.country)&&road.realSeconds<air.realSeconds?road:air;
}
export function segmentAt(plan:JourneyPlan,elapsedGameSeconds:number) {
 let elapsed=Math.max(0,elapsedGameSeconds)*plan.acceleration;
 for(let i=0;i<plan.segments.length;i++){
  const segment=plan.segments[i];
  if(elapsed<segment.realSeconds||i===plan.segments.length-1)return {segment,index:i,fraction:Math.max(0,Math.min(1,elapsed/segment.realSeconds)),next:plan.segments[i+1]};
  elapsed-=segment.realSeconds;
 }
 return null;
}
