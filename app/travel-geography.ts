import SWISS_CLUBS from './swiss-clubs.json';
import STADIUM_AUDIT from './stadium-audit.json';
/** Persistent grounds: verified address anchors, documented municipality fallbacks,
 * retained international stadium anchors, and explicitly fictional Bern grounds.
 * Ground routes are schematic; they are never presented as turn-by-turn directions. */
export type GeoPoint = { lat: number; lon: number };
export type Venue = GeoPoint & { id: string; stadium: string; city: string; country: string; source: string; canton?: string; address?: string; postalCode?: string; verification?: 'stadium'|'municipality'|'fictional'|'pitch-fallback'; registeredStadium?:string; coordinateSource?:string; coordinateNote?: string };
const venue = (id: string, stadium: string, city: string, country: string, lat: number, lon: number): Venue => ({ id, stadium, city, country, lat, lon, verification:'stadium', coordinateNote:'Bestehender gerundeter Stadionanker aus OpenStreetMap; vor diesem Update gespeichert.', source: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}` });
export const HOME_VENUE = venue('home-buempliz45', 'Heimstadion Bümplizstrasse 45', 'Bern', 'Schweiz', 46.94689, 7.39373);
export const HOME_ADDRESS = 'Bümplizstrasse 45, 3027 Bern';
export const VENUES: Record<string, Venue> = Object.fromEntries([
  HOME_VENUE,
  venue('wembley', 'Wembley Stadium', 'London', 'England', 51.5560, -0.2795),
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
for(const record of STADIUM_AUDIT.international){
 if(!('lat' in record)||!('lon' in record)||!record.venueId||!VENUES[record.venueId])continue;
 const saved=VENUES[record.venueId];VENUES[record.venueId]={...saved,lat:record.lat!,lon:record.lon!,verification:record.status==='local-pitch-fallback'?'pitch-fallback':'stadium',coordinateSource:record.source,coordinateNote:'2026-10-16: Mittelpunkt eines kartierten Fussballfelds in OpenStreetMap.'};
}
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
for(const club of FICTIONAL){const record=STADIUM_AUDIT.fictional.find(r=>r.venueId===club.venue.id);if(record)club.venue={...club.venue,registeredStadium:club.venue.stadium,stadium:record.osmName||'Fussballplatz Bern',lat:record.lat,lon:record.lon,verification:'pitch-fallback',source:record.source,coordinateSource:record.source,coordinateNote:'Fiktiver Club auf einem realen kartierten Fussballfeld.'};}
/**
 * The world league: real clubs under their official names. The IDs are the stable ones of older saves (they were
 * minted when these clubs still had parody names, so "real-madreto" is today's Real Madrid CF); only the names changed.
 * The grounds stay the audited catalogue venues. LEGACY_POOLS keeps the old parody names so a saved table or journey
 * that still carries one resolves to the same ground.
 */
const WORLD_CLUBS=[['world-real-madreto','Real Madrid CF','madrid'],['world-fc-barceloneta','FC Barcelona','barcelona'],['world-liverpuhl-fc','Liverpool FC','liverpool'],['world-manchester-cite','Manchester City','city'],['world-bayern-muenchan','FC Bayern München','munich']] as const;
const WORLD = WORLD_CLUBS.map(([id,name,key]):SeasonClub=>({id,name,league:1,venue:VENUES[key]}));
const BASE_CLUBS: SeasonClub[] = [...FICTIONAL,...SWISS_CLUBS as SeasonClub[],...WORLD];
/** The first club of a league lends its audited ground to a fictional sixth club (ground sharing, no new geodata). */
const groundOfLeague=(league:number)=>BASE_CLUBS.find(c=>c.league===league)!.venue;
const fictionalSixth=(league:number,name:string):SeasonClub=>({id:`extra-${league}-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-+$/,'')}`,name,league,fictional:true,venue:groundOfLeague(league)});
/**
 * The sixth club of every league except the lowest (where the own club starts). Real clubs only where the catalogue
 * already holds their audited stadium (Grasshopper Club at the Letzigrund, FC Winterthur at the Schützenwiese);
 * the others are explicitly fictional and share the audited ground of a club of their league, so every ground and
 * every route stays source backed. Placed after the original clubs, so the original five of a league keep their slots.
 */
/**
 * FC Heimberg replaces the fictional sixth club of Liga 12 in the Bern world (real club rule, docs/real-club-catalog.md).
 * The id stays the one of the old club, so saved league assignments, tables and lastAiMoves remain valid.
 * Ground: main pitch of the Sportanlage Waldgarten (natural grass 96 x 61 m, floodlights, FVBJ ground listing; club address
 * Schützenstrasse 73, 3627 Heimberg). The point is the centre of the OpenStreetMap soccer pitch way 93077552 (6232 m²
 * including the run-off). The public vehicle access is the Schützenstrasse, about 55 m from the centre.
 */
const HEIMBERG_VENUE: Venue = {
 id:'venue-fc-heimberg',stadium:'Sportanlage Waldgarten',city:'Heimberg',country:'Schweiz',canton:'BE',lat:46.7908374,lon:7.5979965,
 source:'https://www.fcheimberg.ch/verein/',verification:'stadium',registeredStadium:'Sportanlage Waldgarten',address:'Schützenstrasse 73',postalCode:'3627',
 coordinateSource:'https://www.openstreetmap.org/way/93077552',coordinateNote:'Mittelpunkt des Hauptplatzes (Naturrasen 96 × 61 m, Flutlicht), in OpenStreetMap als Fussballfeld kartiert.',
};
const HEIMBERG:SeasonClub={id:'extra-12-fc-worblental-rangers',name:'FC Heimberg',league:12,venue:HEIMBERG_VENUE};
/**
 * FC Stettlen 08 replaces the fictional sixth club of Liga 11 in the Bern world. The club's own page (Spieltag): home games
 * are played "auf dem Naturrasen beim Schulhaus in Walkringen" (the training pitch in Stettlen is another place). The only
 * soccer pitch of Walkringen is OpenStreetMap way 318117223, 45 m from the school area Dornistrasse 10, 3512 Walkringen
 * (swisstopo). Point: centre of that pitch. Public vehicle access: school road next to the pitch (Dornistrasse 126 m).
 */
const STETTLEN_VENUE: Venue = {
 id:'venue-fc-stettlen-08',stadium:'Sportplatz Schulhaus Walkringen',city:'Walkringen',country:'Schweiz',canton:'BE',lat:46.9496329,lon:7.6190465,
 source:'https://www.fcstettlen08.ch/teams/aktive',verification:'stadium',registeredStadium:'Naturrasen beim Schulhaus Walkringen',address:'Dornistrasse 10',postalCode:'3512',
 coordinateSource:'https://www.openstreetmap.org/way/318117223',coordinateNote:'Mittelpunkt des einzigen kartierten Fussballfelds von Walkringen beim Schulhaus (Heimspielfeld laut Club).',
};
const STETTLEN:SeasonClub={id:'extra-11-fc-g-rbetal-kickers',name:'FC Stettlen 08',league:11,venue:STETTLEN_VENUE};
/**
 * FC Oberdiessbach (Sportanlage Leimen, Helisbühlstrasse) replaces the fictional sixth club of Liga 9 in the Bern world.
 * FVBJ ground listing: main field natural grass 100 x 64 m, synthetic field 90 x 57.6 m. The two OpenStreetMap pitches of
 * the site (way 208125381 grass 106.5 x 69.4 m, way 208125372 artificial turf 95.6 x 63.5 m) are each about 6 m larger in both
 * directions, the run-off the map includes. Point: centre of the grass pitch.
 */
const OBERDIESSBACH_VENUE: Venue = {
 id:'venue-fc-oberdiessbach',stadium:'Sportanlage Leimen',city:'Oberdiessbach',country:'Schweiz',canton:'BE',lat:46.8321558,lon:7.6161992,
 source:'https://fcoberdiessbach.ch/',verification:'stadium',registeredStadium:'Sportanlage Leimen',address:'Helisbühlstrasse',postalCode:'3672',
 coordinateSource:'https://www.openstreetmap.org/way/208125381',coordinateNote:'Mittelpunkt des Hauptplatzes (Naturrasen 100 × 64 m laut FVBJ Anlageneintrag), in OpenStreetMap als Fussballfeld kartiert.',
};
const OBERDIESSBACH:SeasonClub={id:'extra-9-fc-seeland-hechte',name:'FC Oberdiessbach',league:9,venue:OBERDIESSBACH_VENUE};
/**
 * FC Grosshöchstetten-Schlosswil (Arniacher) replaces the fictional sixth club of Liga 10 in the Bern world. FVBJ ground
 * listing: main field 100 x 64 m. The only OpenStreetMap pitch at the field name Arniacher (swisstopo, 95 m away) is way
 * 185813961 (107.0 x 70.9 m, grass), larger by the same run-off as at Leimen. Point: centre of that pitch.
 */
const GROSSHOECHSTETTEN_VENUE: Venue = {
 id:'venue-fc-grosshoechstetten-schlosswil',stadium:'Sportanlage Arniacher',city:'Grosshöchstetten',country:'Schweiz',canton:'BE',lat:46.9112538,lon:7.6317333,
 source:'https://matchcenter.fvbj-afbj.ch/default.aspx?a=sa&lng=1&oid=6&sa=680958&v=543772',verification:'stadium',registeredStadium:'Sportanlage Arniacher',postalCode:'3506',
 coordinateSource:'https://www.openstreetmap.org/way/185813961',coordinateNote:'Mittelpunkt des einzigen kartierten Fussballfelds beim Flurnamen Arniacher (Hauptplatz 100 × 64 m laut FVBJ Anlageneintrag).',
};
const GROSSHOECHSTETTEN:SeasonClub={id:'extra-10-fc-emmental-k-sekicker',name:'FC Grosshöchstetten-Schlosswil',league:10,venue:GROSSHOECHSTETTEN_VENUE};
/** Names of clubs that were replaced by a real club: a saved table or journey that still carries the old name keeps its old ground until the season ends. */
const REPLACED_CLUB_GROUNDS:Record<string,()=>Venue>={'FC Worblental Rangers':()=>groundOfLeague(12),'FC Gürbetal Kickers':()=>groundOfLeague(11),'FC Seeland Hechte':()=>groundOfLeague(9),'FC Emmental Käsekicker':()=>groundOfLeague(10)};
const EXTRA_CLUBS: SeasonClub[] = [
 {id:'world-paris-saint-german',name:'Paris Saint-Germain',league:1,venue:VENUES.paris},
 {id:'extra-2-grasshopper',name:'Grasshopper Club Zürich',league:2,venue:VENUES.zurich},
 {id:'extra-3-winterthur',name:'FC Winterthur',league:3,venue:VENUES.winterthur},
 fictionalSixth(4,'FC Alpenfestung'),fictionalSixth(5,'FC Gotthard Murmeltiere'),fictionalSixth(6,'FC Léman Mouettes'),fictionalSixth(7,'FC Zürisee Böötler'),
 fictionalSixth(8,'FC Röstigraben United'),OBERDIESSBACH,GROSSHOECHSTETTEN,STETTLEN,
 HEIMBERG,fictionalSixth(13,'SC Marzili Bern'),fictionalSixth(14,'FC Aarefüchse Bern'),
];
export const SEASON_CLUBS: SeasonClub[] = [...BASE_CLUBS,...EXTRA_CLUBS];
/** Which league (division) each AI club plays in this world; see defaultAiLeagues for clubs that are not listed. */
export type AiLeagues=Record<string,number>;
/** Every league has six members: five AI clubs where the own club plays, six AI clubs everywhere else. */
export const LEAGUE_MEMBERS=6;
/**
 * The league of every AI club in a world that never changed a league: the catalogue leagues, except that the sixth
 * club of the own club's league (it takes a seat there) plays in the lowest league, which has no own club then.
 */
export function defaultAiLeagues(playerDivision:number,catalog:readonly SeasonClub[]=SEASON_CLUBS):AiLeagues {
 const own=Math.max(1,Math.min(15,Math.floor(playerDivision)));
 const map:AiLeagues={};
 for(const club of catalog)map[club.id]=16-club.league;
 // The sixth club of a league is its last one in catalogue order (the extra clubs come after the original five).
 if(own!==1){const sixth=catalog===SEASON_CLUBS?EXTRA_CLUBS.find(c=>16-c.league===own):catalog.filter(c=>16-c.league===own).at(LEAGUE_MEMBERS-1);if(sixth)map[sixth.id]=1;}
 return map;
}
/** The AI clubs of a division in stable catalogue order (the original clubs first, so their slots and ratings stay). */
/** `catalog`: the clubs of the world (app/home-cities.ts worldCatalog); the Bern catalogue when none is given. */
export function seasonClubsOf(division:number,aiLeagues?:AiLeagues,catalog:readonly SeasonClub[]=SEASON_CLUBS) {
 const map=aiLeagues??defaultAiLeagues(division,catalog);
 return catalog.filter(c=>map[c.id]===division);
}
export function seasonGeography(division:number,index:number,aiLeagues?:AiLeagues,catalog:readonly SeasonClub[]=SEASON_CLUBS,home?:HomeRegion) {
 const d=Math.max(1,Math.min(15,Math.floor(division))), i=Math.max(0,Math.min(4,index));
 const club=seasonClubsOf(d,aiLeagues,catalog)[i];
 if(!club)throw new Error(`Fehlender Club in Liga ${16-d}`);
 return {...club,region:classifyDestination(club.venue,false,home)};
}
export function regionForDivision(division:number) { return DIVISION_REGIONS[Math.max(0,Math.min(14,division-1))]; }
export function venueForClubName(name:string,division:number,index:number,catalog:readonly SeasonClub[]=SEASON_CLUBS):Venue {
 const current=catalog.find(c=>c.name===name)??SEASON_CLUBS.find(c=>c.name===name);if(current)return current.venue;
 const legacy=LEGACY_POOLS.flat().find(([n])=>n===name);if(legacy)return VENUES[legacy[1]];
 const replaced=REPLACED_CLUB_GROUNDS[name];if(replaced)return replaced();
 return seasonGeography(division,index,undefined,catalog).venue;
}
/** Most specific location wins; category 13 is explicitly configured neutral elite venues only.
 * Neighbour countries up to 650 km; farther central Europe uses category 11.
 * Switzerland: Bern <=5/15/40 km, BE canton, adjacent cantons, language region.
 * Unclassified CH venues use category 9. Intercontinental >=9000 km uses 15. */
/**
 * A home city other than Bern (app/home-cities.ts): its venue, city name, the cantons of its own region, the
 * neighbouring cantons and its language. Without it the Bern rules below apply unchanged.
 */
export type HomeRegion={venue:Venue;city:string;cantons:readonly string[];neighbours:readonly string[];language:'de'|'fr'};
const FRENCH_OR_ITALIAN_CANTONS=['VD','GE','VS','TI','NE','JU','FR'];
export function classifyDestination(v:Venue,eliteNeutral=false,home?:HomeRegion) {
 const km=distanceKm(home?.venue??HOME_VENUE,v), ch=['Schweiz','Switzerland','CH'].includes(v.country);
 if(ch&&home){
  // The same steps as for Bern, measured from the chosen home: own city, own region, neighbours, language region.
  if(v.city===home.city)return km<=5?0:1;
  if(home.cantons.includes(v.canton??'')){if(km<=15)return 2;if(km<=40)return 3;return 4;}
  if(home.neighbours.includes(v.canton??'')&&km<=90)return 5;
  const otherLanguage=home.language==='de'?FRENCH_OR_ITALIAN_CANTONS.includes(v.canton??'')||['Genf','Genève','Sion','Lausanne','Lugano'].includes(v.city):!FRENCH_OR_ITALIAN_CANTONS.includes(v.canton??'')&&!['Genf','Genève','Sion','Lausanne','Lugano'].includes(v.city);
  if(v.canton||['Zürich','Basel','Winterthur','Luzern','St. Gallen','Genf','Sion','Lausanne','Lugano','Bern','Thun','Biel'].includes(v.city))return otherLanguage?7:6;
  return 8;
 }
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
 const rad=Math.PI/180, km=distanceKm(a,b), d=km/6371;
 if (d<1e-6) return [a,b];
 // Geodesic great circle with one waypoint at least every ~40 km, so long flights curve smoothly.
 const steps=Math.max(64,Math.min(512,Math.ceil(km/40)));
 return Array.from({length:steps+1},(_,i)=>{
  const t=i/steps, x=Math.sin((1-t)*d)/Math.sin(d), y=Math.sin(t*d)/Math.sin(d);
  const vx=x*Math.cos(a.lat*rad)*Math.cos(a.lon*rad)+y*Math.cos(b.lat*rad)*Math.cos(b.lon*rad);
  const vy=x*Math.cos(a.lat*rad)*Math.sin(a.lon*rad)+y*Math.cos(b.lat*rad)*Math.sin(b.lon*rad);
  const vz=x*Math.sin(a.lat*rad)+y*Math.sin(b.lat*rad);
  return {lat:Math.atan2(vz,Math.sqrt(vx*vx+vy*vy))/rad,lon:Math.atan2(vy,vx)/rad};
 });
}

/** Resolve future fixtures only. Historical fixtures and active journeys retain their snapshots. */
export function currentVenue(saved:Venue):Venue {
 return SEASON_CLUBS.find(c=>c.venue.id===saved.id)?.venue??VENUES[saved.id]??saved;
}
