import { getSeasonModeNextOpponent, getTournament, getTournamentOpponentSchedule, getStarXISelection, getOpenTransferSquadVacancies, getStarXIRating, getEligibleEventPlayers } from './feature-data';
import type { GameFeatures, TournamentId } from './feature-data';
import { HOME_VENUE, REGION_LABELS, distanceKm, seasonGeography, tournamentVenue, classifyDestination, HOME_ADDRESS } from './travel-geography';
import type { Venue } from './travel-geography';
import { planJourney, gameSeconds, segmentAt } from './journey-routing';
import type { JourneyPlan } from './journey-routing';
export type TravelFixture = { id: string; mode: 'season'|'tournament'; tournamentId: TournamentId; opponentId: string; opponent: string; away: boolean; region: number; venue: Venue; schedule: string[] };
export type TravelEvent = { id: string; text: string; template?: string; playerId?:string; at: number; delta: number };
export type Journey = { plan?: JourneyPlan; origin?: Venue; id: string; fixture: TravelFixture; startedAt: number; baseMs: number; endsAt: number; transport: 'walk'|'bike'|'car'|'bus'|'train'|'plane'; km: number; events: TravelEvent[]; consumed: boolean; counted?: boolean };
export type TravelStats = { trips: number; km: number; countries: string[]; furthest: { opponent: string; km: number } | null; opponents: Record<string,{name:string;trips:number}> };
export type TravelState = { journey: Journey|null; stats: TravelStats };
export const emptyTravel = (): TravelState => ({journey:null,stats:{trips:0,km:0,countries:[],furthest:null,opponents:{}}});
export function normalizeTravel(value: unknown): TravelState {
 const src=value && typeof value==='object' ? value as TravelState : emptyTravel();
 const j=src.journey;
 const valid=Boolean(j && typeof j.id==='string' && j.fixture && typeof j.fixture.id==='string' && j.fixture.venue && Number.isFinite(j.fixture.venue.lat) && Math.abs(j.fixture.venue.lat)<=85 && Number.isFinite(j.fixture.venue.lon) && Math.abs(j.fixture.venue.lon)<=180 && typeof j.fixture.opponent==='string' && typeof j.fixture.venue.city==='string' && ['walk','bike','car','bus','train','plane'].includes(j.transport) && Number.isFinite(j.startedAt) && Number.isFinite(j.baseMs) && j.baseMs>0 && Number.isFinite(j.endsAt) && j.endsAt>j.startedAt && Array.isArray(j.events) && j.events.length<=2 && j.events.every(e=>Number.isFinite(e.at)&&e.at>=0&&Number.isFinite(e.delta)&&Math.abs(e.delta)<=15000));
 const planValid=!j?.plan || validPlan(j.plan,j.baseMs)&&Math.abs(j.endsAt-j.startedAt-j.baseMs)<2;
 const s=src.stats, n=(v:unknown)=>Math.max(0,Number.isFinite(Number(v))?Number(v):0);
 return {journey: valid && planValid ? structuredClone(j) : null, stats: s ? {trips:Math.floor(n(s.trips)),km:n(s.km),countries:Array.isArray(s.countries)?[...new Set(s.countries.filter(c=>typeof c==='string').slice(0,80))]:[],furthest:s.furthest&&typeof s.furthest.opponent==='string'?{opponent:s.furthest.opponent.slice(0,100),km:n(s.furthest.km)}:null,opponents:Object.fromEntries(Object.entries(s.opponents||{}).slice(0,200).filter(([,v])=>v&&typeof v.name==='string').map(([k,v])=>[k,{name:v.name.slice(0,100),trips:Math.floor(n(v.trips))}]))} : emptyTravel().stats};
}
export function fixtureFor(features: GameFeatures, mode: 'season'|'tournament', tournamentId: TournamentId='stadium'): TravelFixture {
 if (mode==='season') {
  const s=features.seasonMode, o=getSeasonModeNextOpponent(s,features.club.name), index=Number(o.id.split('-').at(-1))-1, geo=seasonGeography(s.division,index), saved=s.fixtures?.[s.matchday], away=saved?.away??s.matchday%2===1, venue=away?(saved?.venue??s.table.find(t=>t.id===o.id)?.venue??geo.venue):HOME_VENUE;
  return {id:`season:${s.prestigeCount}:${features.career.seasonNumber}:${s.division}:${s.matchday}:${s.history.at(-1)?.id||'initial'}`,mode,tournamentId:'stadium',opponentId:o.id,opponent:o.name,away,region:away?classifyDestination(venue):0,venue,schedule:[]};
 }
 const c=features.cup, t=getTournament(tournamentId)!;
 const id=`cup:${t.id}:${c.pendingNextRound?c.matchStartedAt:c.nextTournamentAt}:${c.pendingNextRound?c.round:0}:${Object.values(c.trophies).reduce((a,b)=>a+b,0)}`;
 const previous=features.travel.journey?.fixture;
 const schedule=c.pendingNextRound ? c.opponentIds : previous?.id===id ? previous.schedule : getTournamentOpponentSchedule(t,seededRandom(id));
 const round=c.pendingNextRound?c.round:0, o=t.opponents.find(o=>o.id===schedule[round]) ?? t.opponents[0];
 const away=round%2===0,venue=away?tournamentVenue(o.id):HOME_VENUE;
 return {id,mode,tournamentId:t.id,opponentId:o.id,opponent:o.name,away,region:away?classifyDestination(venue):0,venue,schedule:[...schedule]};
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
const EVENTS: readonly {id:string;text:string;delta:number;modes:readonly Journey['transport'][]}[] = [
 {id:'shoelace',text:'Die Mannschaft bindet synchron die Schuhe.',delta:0,modes:['walk','bike','car']},
 {id:'route',text:'Der Trainer erklärt den kürzesten Weg zur taktischen Meisterleistung.',delta:0,modes:['walk','bike','car']},
 {id:'bundesrat',text:'Der Bundesrat hat den Teambus zugeparkt.',delta:8,modes:['bus']},
 {id:'pass',text:'{player} hat den Reisepass vergessen.',delta:12,modes:['plane']},
 {id:'shortcut',text:'Der Busfahrer kennt eine Abkürzung.',delta:-10,modes:['bus']},
 {id:'fabrizio',text:'Fabrizio Romario sitzt plötzlich im Gepäckraum.',delta:0,modes:['bus','train','plane']},
 {id:'mikeboy',text:'{player} schläft im Gepäckfach.',delta:0,modes:['bus','train','plane']},
 {id:'olten',text:'Die Mannschaft nimmt versehentlich den Zug nach Olten.',delta:15,modes:['train']},
 {id:'pilot',text:'Der Pilot ist YB-Fan und gibt Vollgas.',delta:-10,modes:['plane']},
 {id:'kebab',text:'Die Mannschaft bestellt 47 Döner am Flughafen.',delta:5,modes:['plane']},
 {id:'walking',text:'Der Trainer hat Google Maps auf Fussweg gestellt.',delta:8,modes:['bus','train']},
 {id:'var',text:'Das Flughafenpersonal verlangt einen VAR-Check beim Boarding.',delta:0,modes:['plane']},
 {id:'ticket',text:'{player} diskutiert mit dem Kontrolleur über die Taktik.',delta:5,modes:['train']},
 {id:'green',text:'Alle Ampeln sind grün. Der Chauffeur fühlt sich wie ein Rennfahrer.',delta:-5,modes:['bus']},
 {id:'snacks',text:'{player} hat sämtliche Snacks schon vor der Abfahrt gegessen.',delta:0,modes:['bus','train','plane']},
 {id:'express',text:'Der Lokführer erklärt den Zug spontan zum AZB-Express.',delta:-8,modes:['train']},
];
export function createJourney(fixture:TravelFixture,now:number,random=Math.random,features?:GameFeatures):Journey {
 if(!fixture.away)throw new Error('Für Heimspiele ist keine Reise nötig.');
 const timing=travelTiming(fixture),events:TravelEvent[]=[],players=features?getEligibleEventPlayers(features):[];
 const pool=EVENTS.filter(e=>e.modes.includes(timing.transport)&&(!e.text.includes('{player}')||players.length));
 if(random()<.5&&pool.length){const count=random()<.15?2:1;for(let i=0;i<count&&pool.length;i++){
  const e=pool.splice(Math.min(pool.length-1,Math.floor(random()*pool.length)),1)[0];
  const player=players.length?players[Math.min(players.length-1,Math.floor(random()*players.length))]:null;
  events.push({id:e.id,template:e.text,playerId:player?.id,text:e.text.replace('{player}',player?.name??'Die Mannschaft'),at:Math.round(timing.baseMs*(i===0?.3:.6)),delta:0});
 }}
 return {plan:timing.plan,id:fixture.id,origin:HOME_VENUE,fixture:{...fixture,region:timing.category},startedAt:now,baseMs:timing.baseMs,endsAt:now+timing.baseMs,transport:timing.transport,km:timing.km,events,consumed:false};
}
export function journeyView(j: Journey, now:number,features?:GameFeatures) {
 const elapsed=Math.max(0,now-j.startedAt);let end=j.baseMs,start=0,progress=0;
 for(const e of j.events){if(elapsed<e.at)break;progress+=(1-progress)*(e.at-start)/Math.max(1,end-start);start=e.at;end+=e.delta;}
 progress=Math.max(0,Math.min(1,progress+(1-progress)*(elapsed-start)/Math.max(1,end-start)));
 if(j.plan){progress=Math.max(0,Math.min(1,elapsed/(j.endsAt-j.startedAt)));end=j.endsAt-j.startedAt;}
 return {stage:j.plan?segmentAt(j.plan,elapsed/1000):null,arrived:now>=j.endsAt,progress,remaining:Math.max(0,j.startedAt+end-now),events:j.events.filter(e=>elapsed>=e.at).map(e=>{
  const template=e.template??EVENTS.find(def=>def.id===e.id)?.text;
  if(!template||!features)return e;
  if(!template.includes('{player}'))return {...e,text:template};
  const players=getEligibleEventPlayers(features),player=players.find(p=>p.id===e.playerId)??players[0];
  return {...e,text:player?template.replace('{player}',player.name):'Die Mannschaft bespricht die Taktik.'};
 })};
}
export function settleTravel(state: TravelState, now:number): TravelState {
 const j=state.journey;if(!j||j.consumed||now<j.endsAt)return state;
 // counted marker is stored on the journey independently of match consumption.
 const marked=j as Journey & {counted?:boolean};if(marked.counted)return state;
 const stats=structuredClone(state.stats);stats.trips++;stats.km+=j.km;
 if(!stats.countries.includes(j.fixture.venue.country))stats.countries.push(j.fixture.venue.country);
 if(!stats.furthest||j.km>stats.furthest.km)stats.furthest={opponent:j.fixture.opponent,km:j.km};
 const o=stats.opponents[`${j.fixture.venue.id}:${j.fixture.opponent}`]||{name:j.fixture.opponent,trips:0};stats.opponents[`${j.fixture.venue.id}:${j.fixture.opponent}`]={name:o.name,trips:o.trips+1};
 return {journey:{...j,counted:true} as Journey,stats};
}
export function eligibilityError(features:GameFeatures,mode:'season'|'tournament',tournamentId:TournamentId,now:number) {
 if(features.cup.active)return 'Es läuft bereits ein Match.';
 if(mode==='season'&&(features.seasonMode.hallOfFame||features.cup.pendingNextRound))return 'Zuerst die laufende Saison oder Turnierrunde abschliessen.';
 if(mode==='tournament'&&features.cup.pendingNextRound&&features.cup.tournamentId!==tournamentId)return 'Zuerst die aktuelle Turnierrunde abschliessen.';
 if(mode==='tournament'&&!features.cup.pendingNextRound&&features.cup.nextTournamentAt>now)return 'Das Turnier ist noch in der Pause.';
 if(getOpenTransferSquadVacancies(features).length)return 'Schliesse zuerst die Kaderlücke.';
 if(getStarXISelection(features.starXI.ownedIds,features.starXI.lineupIds).length<11)return 'Vervollständige zuerst die Startelf.';
 if(features.cup.suspendedPlayerIds.some(id=>features.starXI.lineupIds.includes(id)||features.starXI.benchIds.includes(id)))return 'Ersetze zuerst die gesperrten Spieler.';
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
  features.travel.journey=createJourney(fixture,now,Math.random,features);return 'Reise gestartet.';
 }
 if(current.consumed)return 'Diese Partie wurde bereits gestartet.';
 if(now<current.endsAt)return 'Die Mannschaft ist noch unterwegs.';
 return null;
}
export function consumeTravel(features:GameFeatures,fixture:TravelFixture) { features.cup.fixture={id:fixture.id,away:fixture.away,venue:fixture.venue,opponentId:fixture.opponentId}; if(features.travel.journey?.fixture.id===fixture.id)features.travel.journey.consumed=true; }
export {HOME_VENUE,REGION_LABELS};
