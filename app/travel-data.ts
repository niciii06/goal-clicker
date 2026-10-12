import { getSeasonModeNextOpponent, getTournament, getTournamentOpponentSchedule, getStarXISelection, getOpenTransferSquadVacancies, getStarXIRating } from './feature-data';
import type { GameFeatures, TournamentId } from './feature-data';
import { HOME_VENUE, REGION_LABELS, distanceKm, seasonGeography, tournamentVenue } from './travel-geography';
import type { Venue } from './travel-geography';
export type TravelFixture = { id: string; mode: 'season'|'tournament'; tournamentId: TournamentId; opponentId: string; opponent: string; away: boolean; region: number; venue: Venue; schedule: string[] };
export type TravelEvent = { id: string; text: string; at: number; delta: number };
export type Journey = { id: string; fixture: TravelFixture; startedAt: number; baseMs: number; endsAt: number; transport: 'bus'|'train'|'plane'; km: number; events: TravelEvent[]; consumed: boolean; counted?: boolean };
export type TravelStats = { trips: number; km: number; countries: string[]; furthest: { opponent: string; km: number } | null; opponents: Record<string,{name:string;trips:number}> };
export type TravelState = { journey: Journey|null; stats: TravelStats };
export const emptyTravel = (): TravelState => ({journey:null,stats:{trips:0,km:0,countries:[],furthest:null,opponents:{}}});
export function normalizeTravel(value: unknown): TravelState {
 const src=value && typeof value==='object' ? value as TravelState : emptyTravel();
 const j=src.journey;
 const valid=Boolean(j && typeof j.id==='string' && j.fixture && typeof j.fixture.id==='string' && j.fixture.venue && Number.isFinite(j.fixture.venue.lat) && Math.abs(j.fixture.venue.lat)<=85 && Number.isFinite(j.fixture.venue.lon) && Math.abs(j.fixture.venue.lon)<=180 && typeof j.fixture.opponent==='string' && typeof j.fixture.venue.city==='string' && ['bus','train','plane'].includes(j.transport) && Number.isFinite(j.startedAt) && Number.isFinite(j.baseMs) && j.baseMs>=10000 && j.baseMs<=180000 && Number.isFinite(j.endsAt) && j.endsAt>=j.startedAt+10000 && j.endsAt<=j.startedAt+180000 && Array.isArray(j.events) && j.events.length<=2 && j.events.every(e=>Number.isFinite(e.at)&&e.at>=0&&Number.isFinite(e.delta)&&Math.abs(e.delta)<=15000));
 const s=src.stats, n=(v:unknown)=>Math.max(0,Number.isFinite(Number(v))?Number(v):0);
 return {journey: valid ? structuredClone(j) : null, stats: s ? {trips:Math.floor(n(s.trips)),km:n(s.km),countries:Array.isArray(s.countries)?[...new Set(s.countries.filter(c=>typeof c==='string').slice(0,80))]:[],furthest:s.furthest&&typeof s.furthest.opponent==='string'?{opponent:s.furthest.opponent.slice(0,100),km:n(s.furthest.km)}:null,opponents:Object.fromEntries(Object.entries(s.opponents||{}).slice(0,200).filter(([,v])=>v&&typeof v.name==='string').map(([k,v])=>[k,{name:v.name.slice(0,100),trips:Math.floor(n(v.trips))}]))} : emptyTravel().stats};
}
export function fixtureFor(features: GameFeatures, mode: 'season'|'tournament', tournamentId: TournamentId='stadium'): TravelFixture {
 if (mode==='season') {
  const s=features.seasonMode, o=getSeasonModeNextOpponent(s,features.club.name), index=Number(o.id.split('-').at(-1))-1, geo=seasonGeography(s.division,index);
  return {id:`season:${s.prestigeCount}:${features.career.seasonNumber}:${s.division}:${s.matchday}:${s.history.at(-1)?.id||'initial'}`,mode,tournamentId:'stadium',opponentId:o.id,opponent:o.name,away:s.matchday%2===1,region:geo.region,venue:geo.venue,schedule:[]};
 }
 const c=features.cup, t=getTournament(tournamentId)!;
 const id=`cup:${t.id}:${c.pendingNextRound?c.matchStartedAt:c.nextTournamentAt}:${c.pendingNextRound?c.round:0}:${Object.values(c.trophies).reduce((a,b)=>a+b,0)}`;
 const previous=features.travel.journey?.fixture;
 const schedule=c.pendingNextRound ? c.opponentIds : previous?.id===id ? previous.schedule : getTournamentOpponentSchedule(t,seededRandom(id));
 const round=c.pendingNextRound?c.round:0, o=t.opponents.find(o=>o.id===schedule[round]) ?? t.opponents[0];
 return {id,mode,tournamentId:t.id,opponentId:o.id,opponent:o.name,away:round%2===0,region:t.id==='stadium'?3:t.id==='champions'?6:9,venue:tournamentVenue(o.id),schedule:[...schedule]};
}
function seededRandom(seed:string) { let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return ()=>{n+=0x6D2B79F5;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;}; }
export const TRAVEL_RANGES = [[10,20],[20,35],[35,50],[45,60],[60,90],[75,110],[90,130],[110,150],[130,170],[150,180]] as const;
export function travelTiming(fixture: TravelFixture) {
 const km=distanceKm(HOME_VENUE,fixture.venue), transport=km<80?'bus':km<700?'train':'plane';
 const [min,max]=TRAVEL_RANGES[Math.max(0,Math.min(9,fixture.region))];
 const span=[5,150,300,400,900,1200,3000,3500,12000,17000][fixture.region];
 const seconds=Math.min(180,Math.max(10,Math.round(min+(max-min)*Math.min(1,km/span)+(transport==='bus'?0:transport==='train'?1:2))));
 return {km,transport:transport as Journey['transport'],baseMs:seconds*1000};
}
const EVENTS: readonly {id:string;text:string;delta:number;modes:readonly Journey['transport'][]}[] = [
 {id:'bundesrat',text:'Der Bundesrat hat den Teambus zugeparkt.',delta:8,modes:['bus']},
 {id:'pass',text:'Silvuz hat seinen Reisepass vergessen.',delta:12,modes:['plane']},
 {id:'shortcut',text:'Der Busfahrer kennt eine Abkürzung.',delta:-10,modes:['bus']},
 {id:'fabrizio',text:'Fabrizio Romario sitzt plötzlich im Gepäckraum.',delta:0,modes:['bus','train','plane']},
 {id:'mikeboy',text:'Mikeboy Jr. schläft im Gepäckfach.',delta:0,modes:['bus','train','plane']},
 {id:'olten',text:'Die Mannschaft nimmt versehentlich den Zug nach Olten.',delta:15,modes:['train']},
 {id:'pilot',text:'Der Pilot ist YB-Fan und gibt Vollgas.',delta:-10,modes:['plane']},
 {id:'kebab',text:'Die Mannschaft bestellt 47 Döner am Flughafen.',delta:5,modes:['plane']},
 {id:'walking',text:'Der Trainer hat Google Maps auf Fussweg gestellt.',delta:8,modes:['bus','train']},
 {id:'var',text:'Das Flughafenpersonal verlangt einen VAR-Check beim Boarding.',delta:0,modes:['plane']},
 {id:'ticket',text:'Di Santo diskutiert mit dem Kontrolleur über seine 100 OVR.',delta:5,modes:['train']},
 {id:'green',text:'Alle Ampeln sind grün. Der Chauffeur fühlt sich wie Messi.',delta:-5,modes:['bus']},
 {id:'snacks',text:'Silvuz hat sämtliche Snacks schon vor der Abfahrt gegessen.',delta:0,modes:['bus','train','plane']},
 {id:'express',text:'Der Lokführer erklärt den Zug spontan zum AZB-Express.',delta:-8,modes:['train']},
];
export function createJourney(fixture: TravelFixture, now: number, random=Math.random): Journey {
 const timing=travelTiming(fixture), events:TravelEvent[]=[], pool=EVENTS.filter(e=>e.modes.includes(timing.transport));
 let end=timing.baseMs;
 if(random()<.5) {
  const count=random()<.15?2:1;
  for(let i=0;i<count;i++) {
   const e=pool.splice(Math.min(pool.length-1,Math.floor(random()*pool.length)),1)[0];
   const at=Math.round(timing.baseMs*(i===0?.3:.6));
   if(at>=end-1000)break;
   const next=Math.max(at+1000,10000,Math.min(180000,end+e.delta*1000));
   events.push({id:e.id,text:e.text,at,delta:next-end});end=next;
  }
 }
 return {id:fixture.id,fixture,startedAt:now,baseMs:timing.baseMs,endsAt:now+end,transport:timing.transport,km:timing.km,events,consumed:false};
}
export function journeyView(j: Journey, now:number) {
 const elapsed=Math.max(0,now-j.startedAt);let end=j.baseMs,start=0,progress=0;
 for(const e of j.events){if(elapsed<e.at)break;progress+=(1-progress)*(e.at-start)/Math.max(1,end-start);start=e.at;end+=e.delta;}
 progress=Math.max(0,Math.min(1,progress+(1-progress)*(elapsed-start)/Math.max(1,end-start)));
 return {arrived:now>=j.endsAt,progress,remaining:Math.max(0,j.startedAt+end-now),events:j.events.filter(e=>elapsed>=e.at)};
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
  features.travel.journey=createJourney(fixture,now);return 'Reise gestartet.';
 }
 if(current.consumed)return 'Diese Partie wurde bereits gestartet.';
 if(now<current.endsAt)return 'Die Mannschaft ist noch unterwegs.';
 return null;
}
export function consumeTravel(features:GameFeatures,fixture:TravelFixture) { if(features.travel.journey?.fixture.id===fixture.id)features.travel.journey.consumed=true; }
export {HOME_VENUE,REGION_LABELS};
