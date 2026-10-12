/** Geographical anchors are stadium centres (rounded), not invented club locations.
 * Sources: OpenStreetMap / Wikidata stadium records. Fictional clubs share real grounds.
 * Ground routes are schematic; they are never presented as turn-by-turn directions. */
export type GeoPoint = { lat: number; lon: number };
export type Venue = GeoPoint & { id: string; stadium: string; city: string; country: string; source: string };
const venue = (id: string, stadium: string, city: string, country: string, lat: number, lon: number): Venue => ({ id, stadium, city, country, lat, lon, source: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}` });
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
export const REGION_LABELS = ['Stadt Bern', 'Kanton Bern', 'Deutschschweiz', 'Schweiz', 'Nachbarländer', 'Mitteleuropa', 'Europa', 'Europäische Elite', 'International', 'Weltelite'] as const;
// Existing division 1 is the weakest; division 15 is the strongest.
export const DIVISION_REGIONS = [0, 0, 1, 1, 2, 3, 4, 5, 6, 6, 7, 7, 8, 8, 9] as const;
const POOLS: readonly (readonly [string, string][])[] = [
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
export function regionForDivision(division: number) { return DIVISION_REGIONS[Math.max(0, Math.min(14, Math.floor(division)-1))]; }
export function seasonGeography(division: number, index: number) {
 const region = regionForDivision(division), [name, key] = POOLS[region][Math.max(0, Math.min(4,index))];
 return { id: `geo-${division}-${index+1}`, name, region, venue: VENUES[key] };
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
