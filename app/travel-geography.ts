import SWISS_CLUBS from './swiss-clubs.json';
/** Persistent grounds: verified address anchors, documented municipality fallbacks,
 * retained international stadium anchors, and explicitly fictional Bern grounds.
 * Ground routes are schematic; they are never presented as turn-by-turn directions. */
export type GeoPoint = { lat: number; lon: number };
export type Venue = GeoPoint & { id: string; stadium: string; city: string; country: string; source: string; canton?: string; address?: string; postalCode?: string; verification?: 'stadium'|'municipality'|'fictional'; coordinateNote?: string };
const venue = (id: string, stadium: string, city: string, country: string, lat: number, lon: number): Venue => ({ id, stadium, city, country, lat, lon, verification:'stadium', coordinateNote:'Bestehender gerundeter Stadionanker aus OpenStreetMap; vor diesem Update gespeichert.', source: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}` });
export const HOME_VENUE = venue('home-buempliz45', 'Heimstadion Bümplizstrasse 45', 'Bern', 'Schweiz', 46.94689, 7.39373);
export const HOME_ADDRESS = 'Bümplizstrasse 45, 3027 Bern';
export const VENUES: Record<string, Venue> = Object.fromEntries([
  HOME_VENUE,
  venue('bern', 'Stadion Wankdorf', 'Bern', 'Schweiz', 46.96278, 7.465),
  venue('thun', 'Arena Thun', 'Thun', 'Schweiz', 46.74472, 7.60556),
  venue('biel', 'Tissot Arena', 'Biel', 'Schweiz', 47.1575, 7.2833),
  venue('geneva', 'Stade de Genève', 'Genf', 'Schweiz', 46.1778, 6.1275),
  venue('sion', 'Stade de Tourbillon', 'Sion', 'Schweiz', 46.2333, 7.3739),
  venue('winterthur', 'Schützenwiese', 'Winterthur', 'Schweiz', 47.5003, 8.7186),
  venue('luzern', 'Swissporarena', 'Luzern', 'Schweiz', 47.0333, 8.3058),
  venue('stgallen', 'Kybunpark', 'St. Gallen', 'Schweiz', 47.4083, 9.305),
  venue('lausanne', 'Stade de la Tuilière', 'Lausanne', 'Schweiz', 46.5453, 6.6231),
  venue('zurich', 'Letzigrund', 'Zürich', 'Schweiz', 47.3828, 8.5044),
  venue('lugano', 'Stadio Cornaredo', 'Lugano', 'Schweiz', 46.0236, 8.9617),
  venue('basel', 'St. Jakob-Park', 'Basel', 'Schweiz', 47.5416, 7.6202),
  venue('munich', 'Allianz Arena', 'München', 'Deutschland', 48.21889, 11.62472),
  venue('milan', 'San Siro', 'Mailand', 'Italien', 45.47806, 9.12389),
  venue('paris', 'Parc des Princes', 'Paris', 'Frankreich', 48.8414, 2.253),
  venue('vienna', 'Ernst-Happel-Stadion', 'Wien', 'Österreich', 48.2072, 16.4206),
  venue('dortmund', 'Westfalenstadion', 'Dortmund', 'Deutschland', 51.4926, 7.4519),
  venue('leipzig', 'Red Bull Arena', 'Leipzig', 'Deutschland', 51.3458, 12.3483),
  venue('naples', 'Stadio Diego Armando Maradona', 'Neapel', 'Italien', 40.8279, 14.193),
  venue('turin', 'Juventus Stadium', 'Turin', 'Italien', 45.1096, 7.6413),
  venue('monaco', 'Stade Louis II', 'Monaco', 'Monaco', 43.7275, 7.4156),
  venue('london', 'Emirates Stadium', 'London', 'England', 51.5549, -0.1084),
  venue('chelsea', 'Stamford Bridge', 'London', 'England', 51.4817, -0.191),
  venue('tottenham', 'Tottenham Hotspur Stadium', 'London', 'England', 51.6043, -0.0664),
  venue('lisbon', 'Estádio da Luz', 'Lissabon', 'Portugal', 38.7527, -9.1848),
  venue('porto', 'Estádio do Dragão', 'Porto', 'Portugal', 41.1617, -8.5839),
  venue('amsterdam', 'Johan Cruijff Arena', 'Amsterdam', 'Niederlande', 52.3142, 4.9419),
  venue('eindhoven', 'Philips Stadion', 'Eindhoven', 'Niederlande', 51.4417, 5.4674),
  venue('barcelona', 'Camp Nou', 'Barcelona', 'Spanien', 41.3809, 2.1228),
  venue('madrid', 'Santiago Bernabéu', 'Madrid', 'Spanien', 40.4531, -3.6883),
  venue('atletico', 'Metropolitano', 'Madrid', 'Spanien', 40.4362, -3.5995),
  venue('istanbul', 'Ali Sami Yen Spor Kompleksi', 'Istanbul', 'Türkei', 41.1033, 28.9911),
  venue('miami', 'Chase Stadium', 'Fort Lauderdale', 'USA', 26.193, -80.161),
  venue('leverkusen', 'BayArena', 'Leverkusen', 'Deutschland', 51.0382, 7.0022),
  venue('manchester', 'Old Trafford', 'Manchester', 'England', 53.4631, -2.2913),
  venue('city', 'Etihad Stadium', 'Manchester', 'England', 53.4831, -2.2003),
  venue('liverpool', 'Anfield', 'Liverpool', 'England', 53.4308, -2.9608),
  venue('tokyo', 'Japan National Stadium', 'Tokio', 'Japan', 35.6778, 139.7147),
  venue('rio', 'Maracanã', 'Rio de Janeiro', 'Brasilien', -22.9122, -43.2302),
  venue('sydney', 'Stadium Australia', 'Sydney', 'Australien', -33.8472, 151.0633),
].map(v => [v.id, v]));
// Reuse researched venue metadata for the existing tournament anchors, preserving their IDs.
for(const [key,token] of [['lugano','fc-lugano'],['thun','fc-thun'],['stgallen','fc-st-gallen']] as const){const club=SWISS_CLUBS.find(c=>c.id.startsWith(token));if(club)VENUES[key]={...club.venue,id:key} as Venue;}
// Inter Miami moved in 2026; retain its key with the verified new venue and a city fallback.
VENUES.miami={...VENUES.miami,stadium:'Nu Stadium',city:'Miami',lat:25.77417,lon:-80.19361,verification:'municipality',source:'https://www.intermiamicf.com/news/the-heartbeat-of-miami-comes-alive-introducing-nu-stadium-inter-miami-cf-s-new-world-class-home',coordinateNote:'Dokumentierter Stadtanker Miami, keine präzise Stadionkoordinate. Quelle: https://en.wikipedia.org/wiki/Miami'};
export const REGION_LABELS = ['Berner Quartier', 'Stadt Bern', 'Agglomeration Bern', 'Region Bern', 'Kanton Bern', 'Nachbarkantone', 'Deutschschweiz', 'West- und Südschweiz', 'Gesamte Schweiz', 'Nachbarländer', 'Mitteleuropa', 'Europa', 'Europäische Eliteziele', 'International', 'Weltweite Fernziele'] as const;
// Internal divisions remain ascending (1 weakest, 15 strongest) to preserve saves/unlocks.
export const LEAGUE_LABELS = ['Chaosliga','Berner Quartierliga','Berner Stadtliga','Berner Agglomerationsliga','Berner Regionalliga','Kantonsliga Bern','Berner Regionalelite','Schweizer Mittellandliga','Deutschschweizer Liga','Schweizer Amateurliga','Schweizer 1. Liga','Schweizer Entwicklungsliga','Super League II','Super League I','Weltliga'] as const;
export const DIVISION_REGIONS = [0,0,1,2,3,4,4,5,6,8,8,8,8,8,11] as const;
const LEGACY_POOLS: readonly (readonly [string, string][])[] = [
 [['FC Tabellenkeller','bern'],['SV Unentschieden','bern'],['Real Zufall','bern'],['FC Feierabendbier','bern'],['Inter Timeout','bern']],
 [['FC Tabellenkeller Thun','thun'],['SV Unentschieden Biel','biel'],['Real Zufall Bern','bern'],['FC Feierabendbier Thun','thun'],['Inter Timeout Biel','biel']],
 [['FC Steuertrick Zürich','zurich'],['SC Olma-Bratwurst','stgallen'],['FC Feierabendbier Luzern','luzern'],['Inter Timeout Winterthur','winterthur'],['FC Rheinknie Chaoten','basel']],
 [['Servette Genevois','geneva'],['FC Sionais','sion'],['FC Lausanne','lausanne'],['FC Lugano','lugano'],['FC Basilea','basel']],
 [['Bayern Münchan','munich'],['Inter Milano','milan'],['Paris Saint German','paris'],['Rapid Wein','vienna'],['Juventus Turino','turin']],
 [['Borussia Dortmundt','dortmund'],['RB Leipziga','leipzig'],['Ajax Amsterdamo','amsterdam'],['PSV Eindhoven','eindhoven'],['Bayer Leverkusen','leverkusen']],
 [['Benfica Lissabonne','lisbon'],['Porto Alegre','porto'],['Napoli Italiano','naples'],['Chelsea Londra','chelsea'],['Galatasaray','istanbul']],
 [['Real Madreto','madrid'],['FC Barceloneta','barcelona'],['Liverpuhl FC','liverpool'],['Manchester Cité','city'],['Bayern Münchan','munich']],
 [['Inter Miami','miami'],['Real Madreto','madrid'],['FC Sushi Tokio','tokyo'],['Flamengö Rio','rio'],['Sydney Feierabend FC','sydney']],
 [['Galácticos XI','madrid'],['FC Sushi Tokio','tokyo'],['Flamengö Rio','rio'],['Sydney Feierabend FC','sydney'],['Inter Miami','miami']],
];

export type SeasonClub = {id:string;name:string;league:number;venue:Venue;fictional?:boolean};
const FICTIONAL_NAMES = ['FC Tabellenkeller','SV Unentschieden','Real Zufall','FC Feierabendbier','Inter Timeout'];
const FICTIONAL_GROUNDS = ['Stolperacker','Remiswiese','Zufallsrasen','Bierdeckel-Arena','Timeout-Platz'];
const FICTIONAL = FICTIONAL_NAMES.map((name,i):SeasonClub=>({id:`geo-1-${i+1}`,name,league:15,fictional:true,venue:{...HOME_VENUE,id:`chaos-ground-${i+1}`,stadium:FICTIONAL_GROUNDS[i],lat:HOME_VENUE.lat+[.003,-.006,.009,-.003,.006][i],lon:HOME_VENUE.lon+[.009,-.005,.005,-.009,.012][i],verification:'fictional',source:'Fiktives Spielfeld in Bern',coordinateNote:'Absichtlich fiktiver Platz in Bern'}}));
const WORLD_IDS=['world-real-madreto','world-fc-barceloneta','world-liverpuhl-fc','world-manchester-cite','world-bayern-muenchan'];
const WORLD = LEGACY_POOLS[7].map(([name,key],i):SeasonClub=>({id:WORLD_IDS[i],name,league:1,venue:VENUES[key]}));
export const SEASON_CLUBS: SeasonClub[] = [...FICTIONAL,...SWISS_CLUBS as SeasonClub[],...WORLD];
export function seasonGeography(division:number,index:number) {
 const d=Math.max(1,Math.min(15,Math.floor(division))), i=Math.max(0,Math.min(4,index));
 const club=SEASON_CLUBS.filter(c=>c.league===16-d)[i];
 if(!club)throw new Error(`Fehlender Club in Liga ${16-d}`);
 return {...club,region:classifyDestination(club.venue)};
}
export function regionForDivision(division:number) { return DIVISION_REGIONS[Math.max(0,Math.min(14,division-1))]; }
export function venueForClubName(name:string,division:number,index:number):Venue {
 const current=SEASON_CLUBS.find(c=>c.name===name);if(current)return current.venue;
 const legacy=LEGACY_POOLS.flat().find(([n])=>n===name);if(legacy)return VENUES[legacy[1]];
 return seasonGeography(division,index).venue;
}
/** Most specific location wins; category 13 is explicitly configured neutral elite venues only.
 * Neighbour countries up to 650 km; farther central Europe uses category 11.
 * Switzerland: Bern <=5/15/40 km, BE canton, adjacent cantons, language region.
 * Unclassified CH venues use category 9. Intercontinental >=9000 km uses 15. */
export function classifyDestination(v:Venue,eliteNeutral=false) {
 const km=distanceKm(HOME_VENUE,v), ch=['Schweiz','Switzerland','CH'].includes(v.country);
 if(ch){
  if(v.city==='Bern')return km<=5?0:1;
  if(v.canton==='BE'||['Thun','Biel'].includes(v.city)){if(km<=15)return 2;if(km<=40)return 3;return 4;}
  if(['FR','SO','NE','JU','LU','OW','NW','UR','VS','VD'].includes(v.canton??'')&&km<=90)return 5;
  if(['VD','GE','VS','TI','NE','JU','FR'].includes(v.canton??'')||['Genf','Sion','Lausanne','Lugano'].includes(v.city))return 7;
  if(v.canton||['Zürich','Basel','Winterthur','Luzern','St. Gallen'].includes(v.city))return 6;
  return 8;
 }
 const neighbours=['Deutschland','Frankreich','Italien','Österreich','Liechtenstein','Monaco'];
 const central=[...neighbours,'Niederlande','Belgien','Luxemburg','Tschechien','Polen','Slowakei','Ungarn'];
 const european=[...central,'England','Schottland','Wales','Irland','Spanien','Portugal','Türkei','Griechenland','Dänemark','Schweden','Norwegen','Finnland','Rumänien','Kroatien','Serbien','Ukraine','Island'];
 if(eliteNeutral&&european.includes(v.country))return 12;
 if(neighbours.includes(v.country)&&km<=650)return 9;
 if(central.includes(v.country)&&km<=1600)return 10;
 if(european.includes(v.country))return 11;
 return km<9000?13:14;
}
const MATCH_VENUES: readonly [string,string][] = [['servette','geneva'],['sionais','sion'],['thoune','thun'],['winterthure','winterthur'],['luzerne','luzern'],['gallo','stgallen'],['lausanne','lausanne'],['grasshopper','zurich'],['lugano','lugano'],['young-burs','bern'],['zurique','zurich'],['basilea','basel'],['benfica','lisbon'],['ajax','amsterdam'],['porto','porto'],['psv','eindhoven'],['dortmund','dortmund'],['leipzig','leipzig'],['napoli','naples'],['juventus','turin'],['monaco','monaco'],['chelsea','chelsea'],['inter-milano','milan'],['tottenham','tottenham'],['ac-milana','milan'],['barcelon','barcelona'],['atletico','atletico'],['arsenal','london'],['galatasaray','istanbul'],['inter-miami','miami'],['paris','paris'],['leverkusen','leverkusen'],['manchester-united','manchester'],['liverpuhl','liverpool'],['bayern','munich'],['manchester-cite','city'],['real-madreto','madrid'],['galacticos','madrid']];
export function tournamentVenue(id: string): Venue {
 const key = MATCH_VENUES.find(([token]) => id.includes(token))?.[1];
 if (!key) throw new Error(`Unbekannter Stadionanker: ${id}`);
 return VENUES[key];
}
export function distanceKm(a: GeoPoint, b: GeoPoint) {
 const rad = Math.PI/180, dlat=(b.lat-a.lat)*rad, dlon=(b.lon-a.lon)*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
 return 6371*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
export function routePoints(a: GeoPoint, b: GeoPoint, flight: boolean): GeoPoint[] {
 if (!flight) return [a,b];
 const rad=Math.PI/180, d=distanceKm(a,b)/6371;
 if (d<1e-6) return [a,b];
 return Array.from({length:65},(_,i)=>{
  const t=i/64, x=Math.sin((1-t)*d)/Math.sin(d), y=Math.sin(t*d)/Math.sin(d);
  const vx=x*Math.cos(a.lat*rad)*Math.cos(a.lon*rad)+y*Math.cos(b.lat*rad)*Math.cos(b.lon*rad);
  const vy=x*Math.cos(a.lat*rad)*Math.sin(a.lon*rad)+y*Math.cos(b.lat*rad)*Math.sin(b.lon*rad);
  const vz=x*Math.sin(a.lat*rad)+y*Math.sin(b.lat*rad);
  return {lat:Math.atan2(vz,Math.sqrt(vx*vx+vy*vy))/rad,lon:Math.atan2(vy,vx)/rad};
 });
}
