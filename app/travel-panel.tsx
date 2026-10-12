'use client';
import type { GameFeatures } from './feature-data';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HOME_VENUE, REGION_LABELS, journeyView, settleTravel } from './travel-data';
import type { Journey, TravelState } from './travel-data';
import { routePoints, HOME_ADDRESS } from './travel-geography';
import type { GeoPoint } from './travel-geography';
import { interpolatePath, segmentAt } from './journey-routing';
const project=(p:GeoPoint)=>({x:(p.lon+180)/360,y:(1-Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,p.lat))*Math.PI/360))/Math.PI)/2});
const ICONS={walk:'🚶',bike:'🚲',car:'🚗',bus:'🚌',train:'🚆',plane:'✈️'};
const LABELS={walk:'Zu Fuss',bike:'Velo',car:'Auto',bus:'Teambus',train:'Zug',plane:'Flugzeug'};
function TravelMap({journey,now,progress}:{journey:Journey;now:number;progress:number}) {
 const routes=useMemo(()=>{
  const segments=journey.plan?.segments??[{id:'legacy',mode:journey.transport,geometry:'approximate',points:routePoints(journey.origin??HOME_VENUE,journey.fixture.venue,journey.transport==='plane')}];
  let previous:number|undefined;
  return segments.map(segment=>({...segment,projected:segment.points.map(p=>{
   const value=project(p);if(previous!==undefined)value.x+=Math.round(previous-value.x);previous=value.x;return value;
  })}));
 },[journey]);
 const fit=useMemo(()=>{
  const points=routes.flatMap(r=>r.projected),xs=points.map(p=>p.x),ys=points.map(p=>p.y),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const zoom=Math.max(1,Math.min(15,Math.floor(Math.log2(Math.min(650/Math.max(.00001,maxx-minx)/256,230/Math.max(.00001,maxy-miny)/256)))));
  return {zoom,center:{x:(minx+maxx)/2,y:(miny+maxy)/2}};
 },[routes]);
 const stage=journey.plan?segmentAt(journey.plan,(now-journey.startedAt)/1000):null;
 const active=routes[stage?.index??0],location=interpolatePath(active.points,stage?.fraction??progress),position=project(location.point);
 position.x+=Math.round(active.projected[0].x-position.x);
 const initialZoom=active.mode==='plane'?Math.min(5,fit.zoom+1):active.mode==='train'?10:14;
 const [zoom,setZoom]=useState(initialZoom),[center,setCenter]=useState(fit.center),[follow,setFollow]=useState(true),[failed,setFailed]=useState(false);
 const pointer=useRef<{x:number;y:number;cx:number;cy:number}|null>(null);
 useEffect(()=>{if(follow)setZoom(active.mode==='plane'?Math.min(5,fit.zoom+1):active.mode==='train'?10:14);},[active.id,active.mode,fit.zoom,follow]);
 const c=follow?position:center,scale=256*2**zoom;
 const screen=(p:{x:number;y:number})=>({x:400+(p.x-c.x)*scale,y:170+(p.y-c.y)*scale});
 const vehicle=screen(position),start=screen(routes[0].projected[0]),end=screen(routes.at(-1)!.projected.at(-1)!);
 const tiles=[];const n=2**zoom,x0=Math.floor((c.x*scale-400)/256),y0=Math.floor((c.y*scale-170)/256);
 for(let x=x0;x<=x0+4;x++)for(let y=y0;y<=y0+2;y++)if(y>=0&&y<n)tiles.push({x,y,sx:400+x*256-c.x*scale,sy:170+y*256-c.y*scale});
 const icon=active.mode==='wait'?'⌛':ICONS[active.mode as keyof typeof ICONS];
 return <div className="travel-map-wrap"><svg className="travel-map" viewBox="0 0 800 340" role="img" aria-label={`Reisekarte von Bern nach ${journey.fixture.venue.city}`} onPointerDown={e=>{pointer.current={x:e.clientX,y:e.clientY,cx:c.x,cy:c.y};e.currentTarget.setPointerCapture(e.pointerId);setCenter(c);setFollow(false);}} onPointerMove={e=>{if(pointer.current){const factor=800/e.currentTarget.getBoundingClientRect().width;setCenter({x:pointer.current.cx-(e.clientX-pointer.current.x)*factor/scale,y:Math.max(0,Math.min(1,pointer.current.cy-(e.clientY-pointer.current.y)*factor/scale))});}}} onPointerUp={()=>{pointer.current=null;}} onPointerCancel={()=>{pointer.current=null;}}>
  <rect width="800" height="340" fill="#dce8ee" />
  {tiles.map(tile=><image key={`${zoom}-${tile.x}-${tile.y}`} x={tile.sx} y={tile.sy} width="256" height="256" href={`https://tile.openstreetmap.org/${zoom}/${((tile.x%n)+n)%n}/${tile.y}.png`} onError={()=>setFailed(true)} />)}
  {routes.filter(r=>r.mode!=='wait').map(r=>{
   const points=r.projected.map(p=>{const v=screen(p);return `${v.x},${v.y}`;}).join(' ');
   return <g key={r.id}><polyline points={points} fill="none" stroke="white" strokeWidth="7" /><polyline points={points} fill="none" stroke={r.mode==='train'?'#7c3aed':r.mode==='plane'?'#b45309':'#0071e3'} strokeWidth="3" strokeDasharray={r.geometry==='approximate'?'3 7':r.mode==='plane'?'9 6':r.mode==='train'?'12 3':undefined} /></g>;
  })}
  {routes.slice(0,-1).filter(r=>r.mode!=='wait').map(r=>{const p=screen(r.projected.at(-1)!);return <circle key={r.id} cx={p.x} cy={p.y} r="5" fill="white" stroke="#334155" strokeWidth="2"><title>{'to' in r?r.to.name:'Umstieg'}</title></circle>;})}
  <circle cx={start.x} cy={start.y} r="8" fill="#16845b" stroke="white" strokeWidth="3" /><circle cx={end.x} cy={end.y} r="8" fill="#c69214" stroke="white" strokeWidth="3" />
  <g style={{transition:'transform 100ms linear'}} transform={`translate(${vehicle.x},${vehicle.y})`}><circle r="23" fill="white" stroke="#0071e3" strokeWidth="2" />{active.mode!=='wait'&&<path d="M -4 -27 L 0 -35 L 4 -27 Z" fill="#0071e3" transform={`rotate(${location.bearing})`} />}<text textAnchor="middle" dominantBaseline="central" fontSize="27" transform={active.mode==='plane'?`rotate(${location.bearing-45})`:undefined}>{icon}</text></g>
 </svg><div className="travel-map-controls"><button aria-label="Karte vergrössern" onClick={()=>setZoom(z=>Math.min(17,z+1))}>+</button><button aria-label="Karte verkleinern" onClick={()=>setZoom(z=>Math.max(1,z-1))}>−</button><button onClick={()=>{setFollow(false);setZoom(fit.zoom);setCenter(fit.center);}}>Route</button><button aria-pressed={follow} onClick={()=>{setCenter(position);setFollow(v=>!v);}}>Folgen {follow?'✓':''}</button></div><small className="travel-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · FOSSGIS / Overpass · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Kartenfehler melden</a></small>{failed&&<small className="travel-map-fallback">Kartenkacheln nicht verfügbar. Route und Reise laufen weiter.</small>}</div>;
}
export function durationLabel(seconds:number,precise=false) {
 const total=Math.ceil(seconds);if(total<60)return `${total} s`;
 const minutes=precise?Math.floor(total/60):Math.round(total/60),suffix=precise&&total%60?` ${total%60} s`:'';
 return (minutes>=60?`${Math.floor(minutes/60)} h ${minutes%60} min`:`${minutes} min`)+suffix;
}
export function TravelPanel({travel,serverNow,onStart,busy,features}:{features?:GameFeatures;travel:TravelState;serverNow:()=>number;onStart:()=>void;busy:boolean}) {
 const [now,setNow]=useState(()=>serverNow());
 useEffect(()=>{const update=()=>setNow(serverNow());const timer=window.setInterval(update,100);document.addEventListener('visibilitychange',update);update();return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};},[serverNow]);
 const journey=travel.journey;
 if(!journey||journey.consumed)return null;
 const view=journeyView(journey,now,features),venue=journey.fixture.venue,seconds=Math.ceil(view.remaining/1000),activeMode=view.stage?.segment.mode??journey.transport;
 return <section className={`travel-panel${view.arrived?' arrived':''}`} aria-label="Auswärtsreise"><div className="travel-heading"><div><p className="eyebrow">FC AZB / AUSWÄRTS / {REGION_LABELS[journey.fixture.region]}</p><h4>{view.arrived?'Am Stadion angekommen!':`Auf dem Weg zu ${journey.fixture.opponent}`}</h4><small>{venue.city}, {venue.country} · {journey.fixture.mode==='season'?'Saisonspiel':'Turnier'}</small></div><strong className="travel-countdown">{view.arrived?'✓':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}</strong></div>
 <TravelMap key={journey.id} journey={journey} now={now} progress={view.progress} />
 <div className="travel-details"><div><small>ABFAHRT</small><strong>{HOME_VENUE.stadium}, Bern</strong><span>{HOME_ADDRESS}</span></div><div><small>ZIEL</small><strong>{venue.stadium}</strong><span>{venue.city}, {venue.country}</span></div><div><small>REISE</small><strong>{activeMode==='wait'?'⌛ Umstieg / Warten':`${ICONS[activeMode]} ${LABELS[activeMode]}`}</strong><span>{Math.round(journey.km).toLocaleString('de-CH')} km Luftlinie · {durationLabel((journey.endsAt-journey.startedAt)/1000,true)} im Spiel</span></div></div>
 {journey.plan&&<div className="travel-itinerary"><p><strong>{view.stage?.segment.label}</strong>{view.stage?.next&&<small>Danach: {view.stage.next.label}</small>}</p><p>Geschätzte reale Reise: <b>{durationLabel(journey.plan.realSeconds)}</b> · Zeitbeschleunigung: {journey.plan.acceleration}× · Fortschritt: {Math.floor(view.progress*100)} %</p><ol>{journey.plan.segments.map((s,i)=><li key={s.id} aria-current={i===view.stage?.index?'step':undefined}>{s.mode==='wait'?'⌛':ICONS[s.mode]} {s.label} · {durationLabel(s.realSeconds)}{s.geometry==='approximate'?' · Ungefähre Route':''}{s.geometry==='great-circle'?' · Geografische Flugnäherung':''}</li>)}</ol></div>}
 <progress max="1" value={view.progress} aria-label="Reisefortschritt" /><small className="travel-route-note">{journey.plan?(view.stage?.segment.geometry==='approximate'?'Ungefähre Route':view.stage?.segment.geometry==='rail'?'OSM-Bahnkorridor · Fahrzeit geschätzt':view.stage?.segment.geometry==='road'?'OSM-Strassenroute · Busfahrzeit geschätzt':view.stage?.segment.geometry==='great-circle'?'Geografische Flugnäherung · kein bestätigter Flugplan':'Warten am Umsteigepunkt'):'Laufende Reise aus früherem Spielstand · ursprüngliche Ankunftszeit bleibt erhalten'} · Stadionzufahrten und Bahnhofszugänge näherungsweise. Kartenkacheln benötigen Internet. {venue.verification==='municipality'?'Zielstandort näherungsweise (Gemeinde).':''}</small>
 <div className="travel-events" aria-live="polite">{view.events.length?view.events.map(e=><p key={e.id}>{e.text} <b>{e.delta?`${e.delta>0?'+':''}${e.delta/1000} s`:'Nur fürs Protokoll'}</b></p>):<p>Die Mannschaft ist unterwegs. Die Fans warten schon.</p>}</div>
 {view.arrived?<button className="mode-primary travel-start" disabled={busy} onClick={onStart}>Match starten</button>:<small>Du kannst andere Bereiche öffnen. Die Reise läuft weiter.</small>}</section>;
}
export function TravelStatsPanel({travel,now}:{travel:TravelState;now:number}) {
 const stats=settleTravel(travel,now).stats,most=Object.values(stats.opponents).sort((a,b)=>b.trips-a.trips)[0];
 return <section className="travel-stats"><p className="eyebrow">REISEPASS / FC AZB</p><div><span><b>{stats.trips}</b> Auswärtsreisen</span><span><b>{Math.round(stats.km).toLocaleString('de-CH')}</b> km Luftlinie</span><span><b>{stats.countries.length}</b> besuchte Länder</span></div>{stats.countries.length>0&&<small>{stats.countries.join(' · ')}</small>}{stats.furthest&&<small>Weiteste Reise: {stats.furthest.opponent} · {Math.round(stats.furthest.km).toLocaleString('de-CH')} km</small>}{most&&<small>Meistbesucht: {most.name} · {most.trips} Reisen</small>}</section>;
}
