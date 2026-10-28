import { competitionFor, squadBanError } from './discipline';
import { pronounText } from './player-pronouns';
import { addHistory, getSeasonModeNextOpponent, getTournament, getTournamentOpponentSchedule, getStarXISelection, getOpenTransferSquadVacancies, getStarXIRating, getEligibleEventPlayers, TOURNAMENTS, lockMatchSquad } from './feature-data';
import type { GameFeatures, TournamentId } from './feature-data';
import { HOME_VENUE, REGION_LABELS, distanceKm, seasonGeography, tournamentVenue, classifyDestination, VENUES, currentVenue } from './travel-geography';
import type { Venue } from './travel-geography';
import { planJourney, gameSeconds, segmentAt, journeyClock } from './journey-routing';
export { journeyClock };
import type { JourneyPlan } from './journey-routing';
export type TravelFixture = { id: string; mode: 'season'|'tournament'; tournamentId: TournamentId; opponentId: string; opponent: string; away: boolean; neutral?: boolean; region: number; venue: Venue; schedule: string[] };
// `delta` changes the arrival in game ms (a jam adds, a fast driver saves); `fine` costs that many seconds of passive income on arrival.
export type TravelEvent = { id: string; text: string; template?: string; playerId?:string; at: number; delta: number; fine?: number };
export type Journey = { squadLock?: GameFeatures['squadLock']; plan?: JourneyPlan; origin?: Venue; id: string; fixture: TravelFixture; startedAt: number; baseMs: number; endsAt: number; transport: 'walk'|'bike'|'car'|'bus'|'train'|'plane'; km: number; events: TravelEvent[]; consumed: boolean; counted?: boolean; finesPaid?: boolean };
export type TravelStats = { recentEvents?: string[]; trips: number; km: number; countries: string[]; furthest: { opponent: string; km: number } | null; opponents: Record<string,{name:string;trips:number}> };
export type TravelState = { journey: Journey|null; stats: TravelStats };
export const emptyTravel = (): TravelState => ({journey:null,stats:{trips:0,km:0,countries:[],furthest:null,opponents:{}}});
export function normalizeTravel(value: unknown): TravelState {
 // A broken journey in an imported or damaged save must not stop the whole game from loading.
 try { return normalizeTravelUnchecked(value); } catch { return emptyTravel(); }
}
function normalizeTravelUnchecked(value: unknown): TravelState {
 const src=value && typeof value==='object' ? value as TravelState : emptyTravel();
 const j=src.journey;
 const valid=Boolean(j && typeof j.id==='string' && j.fixture && typeof j.fixture.id==='string' && j.fixture.venue && Number.isFinite(j.fixture.venue.lat) && Math.abs(j.fixture.venue.lat)<=85 && Number.isFinite(j.fixture.venue.lon) && Math.abs(j.fixture.venue.lon)<=180 && typeof j.fixture.opponent==='string' && typeof j.fixture.venue.city==='string' && ['walk','bike','car','bus','train','plane'].includes(j.transport) && Number.isFinite(j.startedAt) && Number.isFinite(j.baseMs) && j.baseMs>0 && Number.isFinite(j.endsAt) && j.endsAt>j.startedAt && Array.isArray(j.events) && j.events.length<=2 && j.events.every(e=>Boolean(e)&&typeof e==='object'&&Number.isFinite(e.at)&&e.at>=0&&Number.isFinite(e.delta)&&Math.abs(e.delta)<=Math.max(15000,j.baseMs*MAX_EVENT_SHARE)&&(e.fine===undefined||Number.isFinite(e.fine)&&e.fine>=0&&e.fine<=MAX_EVENT_FINE_SECONDS)));
 const planValid=!j?.plan || validPlan(j.plan,j.baseMs)&&Math.abs(j.endsAt-j.startedAt-j.baseMs-j.events.reduce((total,e)=>total+e.delta,0))<2;
 const s=src.stats, n=(v:unknown)=>Math.max(0,Number.isFinite(Number(v))?Number(v):0);
 return {journey: valid && planValid ? structuredClone(j) : null, stats: s ? {recentEvents:Array.isArray(s.recentEvents)?s.recentEvents.filter(e=>typeof e==='string').slice(-8):[],trips:Math.floor(n(s.trips)),km:n(s.km),countries:Array.isArray(s.countries)?[...new Set(s.countries.filter(c=>typeof c==='string').slice(0,80))]:[],furthest:s.furthest&&typeof s.furthest.opponent==='string'?{opponent:s.furthest.opponent.slice(0,100),km:n(s.furthest.km)}:null,opponents:Object.fromEntries(Object.entries(s.opponents||{}).slice(0,200).filter(([,v])=>v&&typeof v.name==='string').map(([k,v])=>[k,{name:v.name.slice(0,100),trips:Math.floor(n(v.trips))}]))} : emptyTravel().stats};
}
export function fixtureFor(features: GameFeatures, mode: 'season'|'tournament', tournamentId: TournamentId='stadium'): TravelFixture {
 if (mode==='season') {
  const s=features.seasonMode, o=getSeasonModeNextOpponent(s,features.club.name), index=Number(o.id.split('-').at(-1))-1, geo=seasonGeography(s.division,index), saved=s.fixtures?.[s.matchday], away=saved?.away??s.matchday%2===1, venue=away?(saved?.venue??s.table.find(t=>t.id===o.id)?.venue??geo.venue):HOME_VENUE;
  return {id:`season:${s.prestigeCount}:${features.career.seasonNumber}:${s.division}:${s.matchday}:${s.history.at(-1)?.id||'initial'}`,mode,tournamentId:'stadium',opponentId:o.id,opponent:o.name,away,region:away?classifyDestination(venue):0,venue:features.travel.journey&&!features.travel.journey.consumed&&features.travel.journey.fixture.mode==='season'&&features.travel.journey.fixture.id===`season:${s.prestigeCount}:${features.career.seasonNumber}:${s.division}:${s.matchday}:${s.history.at(-1)?.id||'initial'}`?features.travel.journey.fixture.venue:currentVenue(venue),schedule:[]};
 }
 const c=features.cup, t=getTournament(tournamentId)!;
 const id=`cup:${t.id}:${c.pendingNextRound?c.matchStartedAt:c.nextTournamentAt}:${c.pendingNextRound?c.round:0}:${Object.values(c.trophies).reduce((a,b)=>a+b,0)}`;
 const previous=features.travel.journey?.fixture;
 // A started journey keeps its draw; otherwise each tournament run draws from its own stored seed.
 const pendingJourney=previous?.id===id&&!features.travel.journey?.consumed;
 const schedule=c.pendingNextRound ? c.opponentIds : pendingJourney ? previous.schedule : getTournamentOpponentSchedule(t,seededRandom(`${id}:${c.drawSeed??0}`));
 const round=c.pendingNextRound?c.round:0, o=t.opponents.find(o=>o.id===schedule[round]) ?? t.opponents[0];
 const highest = [...TOURNAMENTS].sort((a,b)=>b.minimumRating-a.minimumRating)[0];
 const neutral = t.id===highest.id && round===t.rounds-1;
 const away=true,venue=neutral?VENUES.wembley:tournamentVenue(o.id);
 return {id,mode,tournamentId:t.id,opponentId:o.id,opponent:o.name,away,neutral,region:away?classifyDestination(venue):0,venue:previous?.id===id&&!features.travel.journey?.consumed?previous.venue:currentVenue(venue),schedule:[...schedule]};
}
function seededRandom(seed:string) { let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return ()=>{n+=0x6D2B79F5;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;}; }
// Retained export for historical consumers; these ranges no longer affect timing.
export const TRAVEL_RANGES = [[5,10],[10,20],[15,25],[20,30],[20,35],[30,45],[35,50],[40,55],[45,60],[60,90],[75,110],[90,130],[110,150],[130,170],[150,180]] as const;
function validPlan(plan:JourneyPlan,baseMs:number) {
 if(plan.version!==2||!Number.isFinite(plan.acceleration)||plan.acceleration<=0||!Number.isFinite(plan.realSeconds)||plan.realSeconds<=0||!Array.isArray(plan.segments)||!plan.segments.length||plan.segments.length>32)return false;
 if(!plan.segments.every(s=>s&&['bus','train','plane','wait'].includes(s.mode)&&['road','rail','great-circle','approximate','stationary'].includes(s.geometry)&&typeof s.label==='string'&&typeof s.source==='string'&&Number.isFinite(s.realSeconds)&&s.realSeconds>0&&Number.isFinite(s.distanceKm)&&s.distanceKm>=0&&s.from&&s.to&&Array.isArray(s.points)&&s.points.length>=2&&s.points.length<=50000&&s.points.every(p=>p&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180)))return false;
 const total=plan.segments.reduce((n,s)=>n+s.realSeconds,0);
 return Math.abs(total-plan.realSeconds)<.01 && Math.abs(gameSeconds(total,plan.acceleration)*1000-baseMs)<2;
}
export function travelTiming(fixture:TravelFixture) {
 const km=fixture.away?distanceKm(HOME_VENUE,fixture.venue):0;
 const category=classifyDestination(fixture.venue,fixture.region===12);
 if(!fixture.away)return {km,transport:'bus' as Journey['transport'],baseMs:0,category,plan:undefined};
 const plan=planJourney(fixture.venue);
 const transport:Journey['transport']=plan.segments.some(s=>s.mode==='plane')?'plane':plan.segments.some(s=>s.mode==='train')?'train':'bus';
 return {km,transport,baseMs:Math.round(gameSeconds(plan.realSeconds,plan.acceleration)*1000),category,plan};
}
/** Longest delay or saving one event may cause, as a share of the planned trip. */
const MAX_EVENT_SHARE=.4;
const MAX_EVENT_FINE_SECONDS=300;
// `share` moves the arrival by that part of the planned trip (negative is earlier); `fine` is paid on arrival.
const EVENTS: readonly {id:string;text:string;share:number;fine?:number;modes:readonly Journey['transport'][];phase?:'airport'|'station'|'arrival'}[] = [
 {id:'shoelace',text:'Die Mannschaft bindet synchron die Schuhe.',share:0,modes:['walk','bike','car']},
 {id:'route',text:'Der Trainer erklärt den kürzesten Weg zur taktischen Meisterleistung.',share:0,modes:['walk','bike','car']},
 {id:'bundesrat',text:'Der Bundesrat hat den Teambus zugeparkt.',share:.08,modes:['bus']},
 {id:'pass',phase:'airport',text:'{player} hat den Reisepass vergessen.',share:.12,modes:['plane']},
 {id:'shortcut',text:'Der Busfahrer kennt eine Abkürzung.',share:-.1,modes:['bus']},
 {id:'mikeboy',text:'{player} schläft im Gepäckfach.',share:0,modes:['bus','train','plane']},
 {id:'olten',text:'Die Mannschaft nimmt versehentlich den Zug nach Olten.',share:.15,modes:['train']},
 {id:'pilot',text:'Der Pilot ist YB-Fan und gibt Vollgas.',share:-.08,modes:['plane']},
 {id:'kebab',phase:'airport',text:'Die Mannschaft bestellt 47 Döner am Flughafen.',share:.05,modes:['plane']},
 {id:'walking',text:'Der Trainer hat Google Maps auf Fussweg gestellt.',share:.08,modes:['bus','train']},
 {id:'var',phase:'airport',text:'Das Flughafenpersonal verlangt einen VAR-Check beim Boarding.',share:0,modes:['plane']},
 {id:'ticket',text:'{player} diskutiert mit dem Kontrolleur über die Taktik.',share:.04,modes:['train']},
 {id:'green',text:'Alle Ampeln sind grün. Der Chauffeur fühlt sich wie ein Rennfahrer.',share:-.05,modes:['bus']},
 {id:'snacks',text:'{player} hat sämtliche Snacks schon vor der Abfahrt gegessen.',share:0,modes:['bus','train','plane']},
 {id:'express',text:'Der Lokführer erklärt den Zug spontan zum AZB-Express.',share:-.08,modes:['train']},
 {id:'roadworks',text:'Eine Baustelle zwingt den Teambus auf eine kleine Umleitung.',share:.06,modes:['bus','car']},
 {id:'exit',text:'Der Chauffeur nimmt fast die falsche Ausfahrt. Der Trainer rettet die Route.',share:0,modes:['bus','car']},
 {id:'playlist',text:'{player} verteidigt {seine} Playlist gegen den Rest der Mannschaft.',share:0,modes:['bus','train','plane']},
 {id:'headphones',text:'{player} merkt, dass die Kopfhörer noch zuhause liegen.',share:0,modes:['bus','train','plane']},
 {id:'crowded',text:'Der Zug ist voll. Die Mannschaft verteilt sich auf zwei Wagen.',share:0,modes:['train']},
 {id:'platform',text:'Gleisänderung: Die Mannschaft wechselt rechtzeitig das Perron.',share:0,modes:['train'],phase:'station'},
 {id:'connection',text:'Der Anschlusszug wartet bereits. Alle finden ihren Wagen.',share:0,modes:['train'],phase:'station'},
 {id:'security',text:'Bei der Sicherheitskontrolle bildet sich eine kurze Schlange.',share:.04,modes:['plane'],phase:'airport'},
 {id:'gate',text:'Gateänderung: Die Mannschaft folgt der neuen Anzeige.',share:0,modes:['plane'],phase:'airport'},
 {id:'baggage',text:'{player} verwechselt kurz {seine} Tasche mit dem Materialkoffer.',share:0,modes:['plane'],phase:'airport'},
 {id:'parking',text:'Der Ordner zeigt dem Teambus den richtigen Stadionparkplatz.',share:0,modes:['bus','car','train','plane'],phase:'arrival'},
 {id:'fans',text:'Ein paar Fans begrüssen die Mannschaft vor dem Stadion.',share:0,modes:['bus','car','train','plane'],phase:'arrival'},
 {id:'entrance',text:'Der Trainer findet nach kurzer Suche den Spielereingang.',share:0,modes:['bus','car','train','plane'],phase:'arrival'},
 {id:'jam',text:'Stau vor dem Tunnel. Die Mannschaft steht und spielt Karten.',share:.2,modes:['bus','car']},
 {id:'breakdown',text:'Reifenpanne! Der Teambus wartet am Pannenstreifen auf den Pannendienst.',share:.25,modes:['bus']},
 {id:'speeding',text:'Der Busfahrer fährt deutlich zu schnell. Ihr seid früher da, aber die Radarfalle hat geblitzt: Busse.',share:-.15,fine:60,modes:['bus','car']},
 {id:'police',text:'Polizeikontrolle an der Grenze. Alle Pässe werden einzeln geprüft.',share:.1,modes:['bus','car']},
 {id:'signal',text:'Stellwerkstörung: Der Zug steht auf offener Strecke.',share:.18,modes:['train']},
 {id:'fare-dodger',text:'{player} hat kein gültiges Billett und kassiert eine Busse.',share:0,fine:20,modes:['train']},
 {id:'storm',text:'Gewitter über den Alpen: Der Flieger nimmt einen Umweg.',share:.15,modes:['plane']},
 {id:'tailwind',text:'Starker Rückenwind: Der Pilot meldet eine frühere Ankunft.',share:-.1,modes:['plane']},
 {id:'boarding',text:'Verspätetes Boarding: Die Crew ist noch nicht an Bord.',share:.12,modes:['plane'],phase:'airport'},
 {id:'no-parking',text:'Der Teambus steht im Halteverbot. Die Polizei verteilt eine Parkbusse.',share:0,fine:20,modes:['bus','car'],phase:'arrival'},
];
export function createJourney(fixture:TravelFixture,now:number,random=Math.random,features?:GameFeatures):Journey {
 if(!fixture.away)throw new Error('Für Heimspiele ist keine Reise nötig.');
 const timing=travelTiming(fixture),events:TravelEvent[]=[],players=features?getEligibleEventPlayers(features):[];
 const recent=features?.travel.stats.recentEvents??[];
 if(random()<TRAVEL_EVENT_CHANCE){const count=timing.baseMs>30000&&random()<TRAVEL_SECOND_EVENT_CHANCE?2:1;for(let i=0;i<count;i++){
  const at=Math.round(timing.baseMs*(i===0?.3:.9)),stage=timing.plan?segmentAt(timing.plan,at/1000):null;
  const mode=stage?.segment.mode==='wait'?timing.transport:stage?.segment.mode??timing.transport;
  const phase=stage?.segment.mode==='wait'?(timing.transport==='plane'?'airport':'station'):stage&&stage.index===(timing.plan?.segments.length??0)-1&&stage.fraction>.6?'arrival':undefined;
  const candidates=EVENTS.filter(e=>e.modes.includes(mode as Journey['transport'])&&(!e.phase||e.phase===phase)&&(!e.text.includes('{player}')||players.length)&&!events.some(v=>v.id===e.id));
  const fresh=candidates.filter(e=>!recent.includes(e.id)),pool=fresh.length?fresh:candidates;if(!pool.length)continue;
  const e=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
  const player=players.length?players[Math.min(players.length-1,Math.floor(random()*players.length))]:null;
  const delta=Math.round(timing.baseMs*Math.max(-MAX_EVENT_SHARE,Math.min(MAX_EVENT_SHARE,e.share)));
  events.push({id:e.id,template:e.text,playerId:player?.id,text:pronounText(e.text.replace('{player}',player?.name??'Die Mannschaft'),player),at,delta,...(e.fine?{fine:e.fine}:{})});
 }}
 return {squadLock:features?{fixtureId:fixture.id,playerIds:[...new Set([...features.starXI.lineupIds,...features.starXI.benchIds].filter(Boolean))],startedAt:now,transferRemaining:Math.max(0,features.transferSaga.nextAt-now),eventRemaining:Math.max(0,features.nextEventAt-now),varRemaining:Math.max(0,features.nextVarAt-now),offerRemaining:features.transferSaga.pendingOffer?Math.max(0,features.transferSaga.pendingOffer.expiresAt-now):0}:undefined,plan:timing.plan,id:fixture.id,origin:HOME_VENUE,fixture:{...fixture,region:timing.category},startedAt:now,baseMs:timing.baseMs,endsAt:now+timing.baseMs+events.reduce((total,e)=>total+e.delta,0),transport:timing.transport,km:timing.km,events,consumed:false};
}
export const TRAVEL_EVENT_CHANCE=.7;
export const TRAVEL_SECOND_EVENT_CHANCE=.3;

export function journeyView(j: Journey, now:number,features?:GameFeatures) {
 const elapsed=Math.max(0,now-j.startedAt);let end=j.baseMs,start=0,progress=0;
 for(const e of j.events){if(elapsed<e.at)break;progress+=(1-progress)*(e.at-start)/Math.max(1,end-start);start=e.at;end+=e.delta;}
 progress=Math.max(0,Math.min(1,progress+(1-progress)*(elapsed-start)/Math.max(1,end-start)));
 const clock=j.plan?(now>=j.endsAt?j.baseMs:journeyClock(j,now)):elapsed;
 if(j.plan){progress=Math.max(0,Math.min(1,clock/j.baseMs));end=j.endsAt-j.startedAt;}
 return {stage:j.plan?segmentAt(j.plan,clock/1000):null,arrived:now>=j.endsAt,progress,remaining:Math.max(0,j.startedAt+end-now),events:j.events.filter(e=>clock>=e.at).map(e=>{
  const template=e.template??EVENTS.find(def=>def.id===e.id)?.text;
  if(!template||!features)return e;
  if(!template.includes('{player}'))return {...e,text:pronounText(template,null)};
  const players=getEligibleEventPlayers(features),player=players.find(p=>p.id===e.playerId)??players[0];
  return {...e,text:player?pronounText(template.replace('{player}',player.name),player):'Die Mannschaft bespricht die Taktik.'};
 })};
}
export function settleTravel(state: TravelState, now:number): TravelState {
 const j=state.journey;if(!j||j.consumed||now<j.endsAt)return state;
 // counted marker is stored on the journey independently of match consumption.
 const marked=j as Journey & {counted?:boolean};if(marked.counted)return state;
 const stats=structuredClone(state.stats);stats.recentEvents=[...(stats.recentEvents??[]),...j.events.map(e=>e.id)].slice(-8);stats.trips++;stats.km+=j.km;
 if(!stats.countries.includes(j.fixture.venue.country))stats.countries.push(j.fixture.venue.country);
 if(!stats.furthest||j.km>stats.furthest.km)stats.furthest={opponent:j.fixture.opponent,km:j.km};
 const o=stats.opponents[`${j.fixture.venue.id}:${j.fixture.opponent}`]||{name:j.fixture.opponent,trips:0};stats.opponents[`${j.fixture.venue.id}:${j.fixture.opponent}`]={name:o.name,trips:o.trips+1};
 return {journey:{...j,counted:true} as Journey,stats};
}
/** Fines of an arrived journey, once: the seconds of passive income to pay and the journey marked as paid. */
export function collectTravelFines(state: TravelState, now:number): { travel: TravelState; fineSeconds: number } {
 const j=state.journey;
 if(!j||now<j.endsAt||j.finesPaid)return {travel:state,fineSeconds:0};
 const fineSeconds=j.events.reduce((total,e)=>total+(e.fine??0),0);
 if(!fineSeconds)return {travel:state,fineSeconds:0};
 return {travel:{...state,journey:{...j,finesPaid:true}},fineSeconds};
}
/** A fine in goals: the fined seconds of passive income, at least 5 goals per fined second. */
export function travelFineGoals(fineSeconds:number,passivePerSecond:number) {
 return Math.floor(fineSeconds*Math.max(5,Number.isFinite(passivePerSecond)?passivePerSecond:0));
}
/** Charges the fines of an arrived journey once: returns the goals to take (never more than `goals`) and logs it. */
export function payTravelFines(features:GameFeatures,goals:number,passivePerSecond:number,now:number) {
 const {travel,fineSeconds}=collectTravelFines(features.travel,now);
 if(!fineSeconds)return 0;
 features.travel=travel;
 const fine=Math.min(Math.max(0,goals),travelFineGoals(fineSeconds,passivePerSecond));
 addHistory(features,{title:'Reisebusse bezahlt',detail:`Unterwegs gab es eine Busse: -${fine.toLocaleString('de-CH')} Tore.`,tone:'negative'},now);
 return fine;
}
export function eligibilityError(features:GameFeatures,mode:'season'|'tournament',tournamentId:TournamentId,now:number) {
 if(features.cup.active)return 'Es läuft bereits ein Match.';
 if(mode==='season'&&(features.seasonMode.hallOfFame||features.cup.pendingNextRound))return 'Zuerst die laufende Saison oder Turnierrunde abschliessen.';
 if(mode==='tournament'&&features.cup.pendingNextRound&&features.cup.tournamentId!==tournamentId)return 'Zuerst die aktuelle Turnierrunde abschliessen.';
 if(mode==='tournament'&&!features.cup.pendingNextRound&&features.cup.nextTournamentAt>now)return 'Das Turnier ist noch in der Pause.';
 if(getOpenTransferSquadVacancies(features).length)return 'Schliesse zuerst die Kaderlücke.';
 if(getStarXISelection(features.starXI.ownedIds,features.starXI.lineupIds).length<11)return 'Vervollständige zuerst die Startelf.';
 if(features.cup.suspendedPlayerIds.some(id=>features.starXI.lineupIds.includes(id)||features.starXI.benchIds.includes(id)))return 'Ersetze zuerst die gesperrten Spieler.';
 const banned=squadBanError(features,competitionFor(mode,tournamentId));if(banned)return banned;
 if([...features.starXI.lineupIds,...features.starXI.benchIds].some(id=>Number(features.cup.injuredPlayerIds[id])>0))return 'Ersetze zuerst die verletzten Spieler.';
 if(mode==='tournament'&&getStarXIRating(features.starXI.ownedIds,features.starXI.lineupIds)<getTournament(tournamentId)!.minimumRating)return 'Die Teamstärke reicht für dieses Turnier noch nicht.';
 return null;
}
export function travelGate(features:GameFeatures,fixture:TravelFixture,now:number,depart=false) {
 features.travel=settleTravel(features.travel,now);
 const current=features.travel.journey;
 if(current&&!current.consumed&&current.fixture.id!==fixture.id)return 'Schliesse zuerst die bereits begonnene Auswärtsreise ab.';
 if(!fixture.away)return null;
 if(!current||current.fixture.id!==fixture.id) {
  if(!depart)return 'Reise zuerst zum Auswärtsspiel.';
  lockMatchSquad(features,fixture.id,now);features.travel.journey=createJourney(fixture,now,Math.random,features);return 'Reise gestartet.';
 }
 if(current.consumed)return 'Diese Partie wurde bereits gestartet.';
 if(now<current.endsAt)return 'Die Mannschaft ist noch unterwegs.';
 return null;
}
export function consumeTravel(features:GameFeatures,fixture:TravelFixture) {
 // Kick-off: whoever stands in the lineup and on the bench now is the matchday squad.
 if(features.squadLock)features.squadLock={...features.squadLock,playerIds:[...new Set([...features.starXI.lineupIds,...features.starXI.benchIds].filter(Boolean))]}; features.cup.careerMatchId=`career:${fixture.id}`; features.cup.fixture={id:fixture.id,away:fixture.away,neutral:fixture.neutral,venue:fixture.venue,opponentId:fixture.opponentId}; if(features.travel.journey?.fixture.id===fixture.id)features.travel.journey.consumed=true; }
export {HOME_VENUE,REGION_LABELS};
