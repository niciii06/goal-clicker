'use client';
import dynamic from 'next/dynamic';
import type { GameFeatures } from './feature-data';
import { useEffect, useRef, useState } from 'react';
import { HOME_VENUE, REGION_LABELS, journeyView, settleTravel } from './travel-data';
import type { TravelState } from './travel-data';
import { HOME_ADDRESS } from './travel-geography';
const ICONS={walk:'🚶',bike:'🚲',car:'🚗',bus:'🚌',train:'🚆',plane:'✈️'};
const LABELS={walk:'Zu Fuss',bike:'Velo',car:'Auto',bus:'Teambus',train:'Zug',plane:'Flugzeug'};
const TravelMap=dynamic(()=>import('./travel-map').then(module=>module.TravelMap), {
 ssr:false,
 loading:()=> <div className="travel-map-wrap" role="status" aria-label="Reisekarte wird geladen">Reisekarte wird geladen …</div>,
});
export function durationLabel(seconds:number,precise=false) {
 const total=Math.ceil(seconds);if(total<60)return `${total} s`;
 const minutes=precise?Math.floor(total/60):Math.round(total/60),suffix=precise&&total%60?` ${total%60} s`:'';
 return (minutes>=60?`${Math.floor(minutes/60)} h ${minutes%60} min`:`${minutes} min`)+suffix;
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
 return <section className={`travel-panel${view.arrived?' arrived':''}`} aria-label="Auswärtsreise"><div className="travel-heading"><div><p className="eyebrow">FC AZB / AUSWÄRTS / {REGION_LABELS[journey.fixture.region]}</p><h4>{view.arrived?'Am Stadion angekommen!':`Auf dem Weg zu ${journey.fixture.opponent}`}</h4><small>{venue.city}, {venue.country} · {journey.fixture.mode==='season'?'Saisonspiel':'Turnier'}</small></div><strong className="travel-countdown">{view.arrived?'✓':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}</strong></div>
 <div ref={mapRef} style={{scrollMarginBlock:24}}><TravelMap key={journey.id} journey={journey} now={now} progress={view.progress} /></div>
 <div className="travel-details"><div><small>ABFAHRT</small><strong>{HOME_VENUE.stadium}, Bern</strong><span>{HOME_ADDRESS}</span></div><div><small>ZIEL</small><strong>{venue.stadium}</strong><span>{venue.city}, {venue.country}</span></div><div><small>REISE</small><strong>{activeMode==='wait'?'⌛ Umstieg / Warten':`${ICONS[activeMode]} ${LABELS[activeMode]}`}</strong><span>{Math.round(journey.km).toLocaleString('de-CH')} km Luftlinie · {durationLabel((journey.endsAt-journey.startedAt)/1000,true)} im Spiel</span></div></div>
 {journey.plan&&<div className="travel-itinerary"><p><strong>{view.stage?.segment.label}</strong>{view.stage?.next&&<small>Danach: {view.stage.next.label}</small>}</p><p>Geschätzte reale Reise: <b>{durationLabel(journey.plan.realSeconds)}</b> · Zeitbeschleunigung: {journey.plan.acceleration}× · Fortschritt: {Math.floor(view.progress*100)} %</p><ol>{journey.plan.segments.map((s,i)=><li key={s.id} aria-current={i===view.stage?.index?'step':undefined}>{s.mode==='wait'?'⌛':ICONS[s.mode]} {s.label} · {durationLabel(s.realSeconds)}{s.geometry==='approximate'?' · Routenverlauf geschätzt':''}{s.geometry==='great-circle'?' · Geografische Flugnäherung':''}</li>)}</ol></div>}
 <progress max="1" value={view.progress} aria-label="Reisefortschritt" /><small className="travel-route-note">{journey.plan?(view.stage?.segment.geometry==='approximate'?'Routenverlauf geschätzt':view.stage?.segment.geometry==='rail'?'OSM-Bahnkorridor · Fahrzeit geschätzt':view.stage?.segment.geometry==='road'?'OSM-Strassenroute · Busfahrzeit geschätzt':view.stage?.segment.geometry==='great-circle'?'Geografische Flugnäherung · kein bestätigter Flugplan':'Warten am Umsteigepunkt'):'Laufende Reise aus früherem Spielstand · ursprüngliche Ankunftszeit bleibt erhalten'} · Stadionzufahrten und Bahnhofszugänge näherungsweise. Kartenkacheln benötigen Internet. {venue.verification==='municipality'?'Zielstandort näherungsweise (Gemeinde); präzise Platzprüfung ausstehend.':venue.verification==='pitch-fallback'?`Reales Fussballfeld als Ausweichstandort${venue.registeredStadium?`; regulärer Heimplatz: ${venue.registeredStadium}`:''}.`:''}</small>
 <div className="travel-events" aria-live="polite">{view.events.length?view.events.map(e=><p key={e.id}>{e.text} <b>{e.delta?`${e.delta>0?'+':''}${e.delta/1000} s`:'Nur fürs Protokoll'}</b></p>):<p>Die Mannschaft ist unterwegs. Die Fans warten schon.</p>}</div>
 {view.arrived?<button className="mode-primary travel-start" disabled={busy} onClick={onStart}>Match starten</button>:<small>Du kannst andere Bereiche öffnen. Die Reise läuft weiter.</small>}</section>;
}
export function TravelStatsPanel({travel,now,clubName}:{travel:TravelState;now:number;clubName?:string}) {
 const stats=settleTravel(travel,now).stats,most=Object.values(stats.opponents).sort((a,b)=>b.trips-a.trips)[0];
 return <section className="club-passport" aria-label="Clubpass"><div className="club-passport-heading"><div><p className="eyebrow">CLUBPASS / {clubName?clubName.toLocaleUpperCase('de-CH'):'FC AZB'}</p><h4>Wo dein Club schon gespielt hat.</h4></div><span>{stats.trips} {stats.trips===1?'REISE':'REISEN'}</span></div><div className="club-passport-stats"><span><b>{stats.trips}</b> Auswärtsreisen</span><span><b>{Math.round(stats.km).toLocaleString('de-CH')}</b> km Luftlinie</span><span><b>{stats.countries.length}</b> besuchte Länder</span></div>{stats.countries.length>0&&<small>{stats.countries.join(' · ')}</small>}{stats.furthest&&<small>Weiteste Reise: {stats.furthest.opponent} · {Math.round(stats.furthest.km).toLocaleString('de-CH')} km</small>}{most&&<small>Meistbesucht: {most.name} · {most.trips} Reisen</small>}{!stats.trips&&<small>Die erste Auswärtsreise füllt deinen Clubpass.</small>}</section>;
}
