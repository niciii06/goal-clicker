'use client';
import dynamic from 'next/dynamic';
import type { GameFeatures } from './feature-data';
import { useEffect, useRef, useState } from 'react';
import { HOME_VENUE, journeyView, settleTravel } from './travel-data';
import { regionLabelOf } from './home-cities';
import type { TravelState } from './travel-data';
import { HOME_ADDRESS } from './travel-geography';
import { t } from './i18n/runtime';
const ICONS={walk:'🚶',bike:'🚲',car:'🚗',bus:'🚌',train:'🚆',plane:'✈️'};
const LABELS={walk:t("travel.walk"),bike:t("travel.bike"),car:'Auto',bus:t("travel.teamBus"),train:t("travel.train"),plane:t("travel.plane")};
const TravelMap=dynamic(()=>import('./travel-map').then(module=>module.TravelMap), {
 ssr:false,
 loading:()=> <div className="travel-map-wrap" role="status" aria-label={t("travel.mapLoading")}>{t("travel.mapLoadingDots")}</div>,
});
export function durationLabel(seconds:number,precise=false) {
 const total=Math.ceil(seconds);if(total<60)return `${total} s`;
 const minutes=precise?Math.floor(total/60):Math.round(total/60),suffix=precise&&total%60?` ${total%60} s`:'';
 return (minutes>=60?`${Math.floor(minutes/60)} h ${minutes%60} min`:`${minutes} min`)+suffix;
}
/** t("travel.busesLater") for the event list; events without effect are only for the log.
 * With a journey plan the delay is told in real travel time like the itinerary (16 s in the game at 60× are 16 min). */
export function travelEventEffect(e:{delta:number;fine?:number},acceleration?:number) {
 const label=(ms:number)=>acceleration?durationLabel(ms/1000*acceleration):durationLabel(ms/1000,true);
 const parts=[e.delta>0?t("travel.later", { time: label(e.delta) }):e.delta<0?t("travel.earlier", { time: label(-e.delta) }):'',e.fine?t("travel.busesOnArrival"):''].filter(Boolean);
 return parts.length?parts.join(' · '):t("travel.forTheRecord");
}
export function TravelPanel({travel,serverNow,onStart,busy,features}:{features?:GameFeatures;travel:TravelState;serverNow:()=>number;onStart:()=>void;busy:boolean}) {
 const [now,setNow]=useState(()=>serverNow());
 useEffect(()=>{const update=()=>setNow(serverNow());const timer=window.setInterval(update,100);document.addEventListener('visibilitychange',update);update();return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};},[serverNow]);
 const journey=travel.journey;
 const mapRef=useRef<HTMLDivElement>(null),scrolled=useRef('');
 useEffect(()=>{
  if(!journey||journey.consumed||scrolled.current===journey.id)return;
  const request=requestAnimationFrame(()=>{if(!mapRef.current)return;scrolled.current=journey.id;mapRef.current.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});});
  return()=>cancelAnimationFrame(request);
 },[journey]);
 if(!journey||journey.consumed)return null;
 const view=journeyView(journey,now,features),venue=journey.fixture.venue,seconds=Math.ceil(view.remaining/1000),activeMode=view.stage?.segment.mode??journey.transport;
 return <section className={`travel-panel${view.arrived?' arrived':''}`} aria-label={t("travel.awayTrip")}><div className="travel-heading"><div><p className="eyebrow">{t("travel.eyebrow")} {regionLabelOf(journey.fixture.home,journey.fixture.region)}</p><h4>{view.arrived?t("travel.arrived"):t("travel.onWayTo", { opponent: journey.fixture.opponent })}</h4><small>{venue.city}, {venue.country} · {journey.fixture.mode==='season'?t("travel.seasonMatch"):t("travel.tournament")}</small></div><strong className="travel-countdown">{view.arrived?'✓':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}</strong></div>
 <div ref={mapRef} style={{scrollMarginBlock:24}}><TravelMap key={journey.id} journey={journey} now={now} progress={view.progress} /></div>
 <div className="travel-details"><div><small>{t("travel.departure")}</small><strong>{(journey.origin??HOME_VENUE).stadium}, {(journey.origin??HOME_VENUE).city}</strong><span>{(journey.origin??HOME_VENUE).id===HOME_VENUE.id?HOME_ADDRESS:(journey.origin??HOME_VENUE).registeredStadium??(journey.origin??HOME_VENUE).city}</span></div><div><small>{t("travel.destination")}</small><strong>{venue.stadium}</strong><span>{venue.city}, {venue.country}</span></div><div><small>{t("travel.tripCaps")}</small><strong>{activeMode==='wait'?t("travel.changeWait"):`${ICONS[activeMode]} ${LABELS[activeMode]}`}</strong><span>{Math.round(journey.km).toLocaleString('de-CH')} km Luftlinie · {durationLabel((journey.endsAt-journey.startedAt)/1000,true)} {t("travel.inGame")}</span></div></div>
 {journey.plan&&<div className="travel-itinerary"><p><strong>{view.stage?.segment.label}</strong>{view.stage?.next&&<small>{t("travel.after")} {view.stage.next.label}</small>}</p><p>{t("travel.estimatedReal")} <b>{durationLabel(journey.plan.realSeconds)}</b> {t("travel.timeLapse")} {journey.plan.acceleration}× · Fortschritt: {Math.floor(view.progress*100)} %</p><ol>{journey.plan.segments.map((s,i)=><li key={s.id} aria-current={i===view.stage?.index?'step':undefined}>{s.mode==='wait'?'⌛':ICONS[s.mode]} {s.label} · {durationLabel(s.realSeconds)}{s.geometry==='approximate'?t("travel.routeEstimatedSuffix"):''}{s.geometry==='great-circle'?t("travel.flightApproxSuffix"):''}</li>)}</ol></div>}
 <progress max="1" value={view.progress} aria-label={t("travel.progress")} /><small className="travel-route-note">{journey.plan?(view.stage?.segment.geometry==='approximate'?t("travel.routeEstimated"):view.stage?.segment.geometry==='rail'?t("travel.railCorridor"):view.stage?.segment.geometry==='road'?t("travel.roadRoute"):view.stage?.segment.geometry==='great-circle'?t("travel.flightApprox"):t("travel.waitTransfer")):t("travel.legacyTrip")} · Stadionzufahrten und Bahnhofszugänge näherungsweise. Kartenkacheln benötigen Internet. {venue.verification==='municipality'?'Zielstandort näherungsweise (Gemeinde); präzise Platzprüfung ausstehend.':venue.verification==='pitch-fallback'?`${t("travel.fallbackPitch")}${venue.registeredStadium?t("travel.regularHome", { stadium: venue.registeredStadium }):''}.`:''}</small>
 <div className="travel-events" aria-live="polite">{view.events.length?view.events.map(e=><p key={e.id} className={e.delta>0?'later':e.delta<0?'earlier':undefined}>{e.text} <b>{travelEventEffect(e,journey.plan?.acceleration)}</b></p>):<p>{t("travel.onTheWay")}</p>}</div>
 {view.arrived?<button className="mode-primary travel-start" disabled={busy} onClick={onStart}>{t("travel.startMatch")}</button>:<small>{t("travel.keepsRunning")}</small>}</section>;
}
export function TravelStatsPanel({travel,now,clubName}:{travel:TravelState;now:number;clubName?:string}) {
 const stats=settleTravel(travel,now).stats,most=Object.values(stats.opponents).sort((a,b)=>b.trips-a.trips)[0];
 return <section className="club-passport" aria-label={t("travel.clubPass")}><div className="club-passport-heading"><div><p className="eyebrow">{t("travel.clubPassEyebrow")} {clubName?clubName.toLocaleUpperCase('de-CH'):'FC AZB'}</p><h4>{t("travel.wherePlayed")}</h4></div><span>{stats.trips} {stats.trips===1?t("travel.tripCaps"):t("travel.tripsCaps")}</span></div><div className="club-passport-stats"><span><b>{stats.trips}</b> {t("travel.awayTrips")}</span><span><b>{Math.round(stats.km).toLocaleString('de-CH')}</b> {t("travel.kmLine")}</span><span><b>{stats.countries.length}</b> {t("travel.countriesVisited")}</span></div>{stats.countries.length>0&&<small>{stats.countries.join(' · ')}</small>}{stats.furthest&&<small>{t("travel.longest")} {stats.furthest.opponent} · {Math.round(stats.furthest.km).toLocaleString('de-CH')} km</small>}{most&&<small>{t("travel.mostVisited")} {most.name} · {most.trips} {t("travel.trips")}</small>}{!stats.trips&&<small>{t("travel.firstTrip")}</small>}</section>;
}
