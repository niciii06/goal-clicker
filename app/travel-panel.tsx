'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HOME_VENUE, REGION_LABELS, journeyView, settleTravel } from './travel-data';
import type { Journey, TravelState } from './travel-data';
import { routePoints, HOME_ADDRESS } from './travel-geography';
import type { GeoPoint } from './travel-geography';
const project=(p:GeoPoint)=>({x:(p.lon+180)/360,y:(1-Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,p.lat))*Math.PI/360))/Math.PI)/2});
const ICONS={bus:'🚌',train:'🚆',plane:'✈️'};
const LABELS={bus:'Teambus',train:'Zug',plane:'Flugzeug'};
function TravelMap({journey,progress}:{journey:Journey;progress:number}) {
 const points=useMemo(()=>routePoints(HOME_VENUE,journey.fixture.venue,journey.transport==='plane').map(project),[journey]);
 const fit=useMemo(()=>{
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const z=Math.max(1,Math.min(15,Math.floor(Math.log2(Math.min(650/Math.max(.00001,maxx-minx)/256,230/Math.max(.00001,maxy-miny)/256)))));
  return {zoom:z,center:{x:(minx+maxx)/2,y:(miny+maxy)/2}};
 },[points]);
 const [zoom,setZoom]=useState(fit.zoom),[center,setCenter]=useState(fit.center),[follow,setFollow]=useState(true),[failed,setFailed]=useState(false);
 const pointer=useRef<{x:number;y:number;cx:number;cy:number}|null>(null);
 const index=Math.min(points.length-2,Math.floor(progress*(points.length-1))),t=progress*(points.length-1)-index;
 const position={x:points[index].x+(points[index+1].x-points[index].x)*t,y:points[index].y+(points[index+1].y-points[index].y)*t};
 const c=follow&&zoom>fit.zoom?position:center,scale=256*2**zoom;
 const screen=(p:{x:number;y:number})=>({x:400+(p.x-c.x)*scale,y:170+(p.y-c.y)*scale});
 const vehicle=screen(position),start=screen(points[0]),end=screen(points.at(-1)!);
 const tiles=[];const n=2**zoom,x0=Math.floor((c.x*scale-400)/256),y0=Math.floor((c.y*scale-170)/256);
 for(let x=x0;x<=x0+4;x++)for(let y=y0;y<=y0+2;y++)if(y>=0&&y<n)tiles.push({x,y,sx:400+x*256-c.x*scale,sy:170+y*256-c.y*scale});
 return <div className="travel-map-wrap"><svg className="travel-map" viewBox="0 0 800 340" role="img" aria-label={`Reisekarte von Bern nach ${journey.fixture.venue.city}`} onPointerDown={e=>{pointer.current={x:e.clientX,y:e.clientY,cx:c.x,cy:c.y};e.currentTarget.setPointerCapture(e.pointerId);setFollow(false);}} onPointerMove={e=>{if(pointer.current){const factor=800/e.currentTarget.getBoundingClientRect().width;setCenter({x:pointer.current.cx-(e.clientX-pointer.current.x)*factor/scale,y:Math.max(0,Math.min(1,pointer.current.cy-(e.clientY-pointer.current.y)*factor/scale))});}}} onPointerUp={()=>{pointer.current=null;}} onPointerCancel={()=>{pointer.current=null;}}>
  <rect width="800" height="340" fill="#dce8ee" />
  {tiles.map(tile=><image key={`${zoom}-${tile.x}-${tile.y}`} x={tile.sx} y={tile.sy} width="256" height="256" href={`https://tile.openstreetmap.org/${zoom}/${((tile.x%n)+n)%n}/${tile.y}.png`} onError={()=>setFailed(true)} />)}
  <polyline points={points.map(p=>{const s=screen(p);return `${s.x},${s.y}`;}).join(' ')} fill="none" stroke="white" strokeWidth="8" />
  <polyline points={points.map(p=>{const s=screen(p);return `${s.x},${s.y}`;}).join(' ')} fill="none" stroke="#0071e3" strokeWidth="4" strokeDasharray={journey.transport==='plane'?'8 5':undefined} />
  <circle cx={start.x} cy={start.y} r="8" fill="#16845b" stroke="white" strokeWidth="3" /><circle cx={end.x} cy={end.y} r="8" fill="#c69214" stroke="white" strokeWidth="3" />
  <g transform={`translate(${vehicle.x},${vehicle.y})`}><circle r="23" fill="white" stroke="#0071e3" strokeWidth="2" /><text textAnchor="middle" dominantBaseline="central" fontSize="27">{ICONS[journey.transport]}</text></g>
 </svg><div className="travel-map-controls"><button aria-label="Karte vergrössern" onClick={()=>setZoom(z=>Math.min(17,z+1))}>+</button><button aria-label="Karte verkleinern" onClick={()=>setZoom(z=>Math.max(1,z-1))}>−</button><button onClick={()=>{setFollow(false);setZoom(fit.zoom);setCenter(fit.center);}}>Route</button><button aria-pressed={follow} onClick={()=>{setCenter(position);setFollow(v=>!v);}}>Folgen {follow?'✓':''}</button></div><small className="travel-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></small>{failed&&<small className="travel-map-fallback">Kartenkacheln nicht verfügbar. Route und Reise laufen weiter.</small>}</div>;
}
export function TravelPanel({travel,serverNow,onStart,busy}:{travel:TravelState;serverNow:()=>number;onStart:()=>void;busy:boolean}) {
 const [now,setNow]=useState(()=>serverNow());
 useEffect(()=>{const update=()=>setNow(serverNow());const timer=window.setInterval(update,100);document.addEventListener('visibilitychange',update);update();return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};},[serverNow]);
 const journey=travel.journey;
 if(!journey||journey.consumed)return null;
 const view=journeyView(journey,now),venue=journey.fixture.venue,seconds=Math.ceil(view.remaining/1000);
 return <section className={`travel-panel${view.arrived?' arrived':''}`} aria-label="Auswärtsreise"><div className="travel-heading"><div><p className="eyebrow">FC AZB / AUSWÄRTS / {REGION_LABELS[journey.fixture.region]}</p><h4>{view.arrived?'Angekommen!':`Auf dem Weg zu ${journey.fixture.opponent}`}</h4><small>{venue.city}, {venue.country} · {journey.fixture.mode==='season'?'Saisonspiel':'Turnier'}</small></div><strong className="travel-countdown">{view.arrived?'✓':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}</strong></div>
 <TravelMap key={journey.id} journey={journey} progress={view.progress} />
 <div className="travel-details"><div><small>ABFAHRT</small><strong>{HOME_VENUE.stadium}, Bern</strong><span>{HOME_ADDRESS}</span></div><div><small>ZIEL</small><strong>{venue.stadium}</strong><span>{venue.city}, {venue.country}</span></div><div><small>REISE</small><strong>{ICONS[journey.transport]} {LABELS[journey.transport]}</strong><span>{Math.round(journey.km).toLocaleString('de-CH')} km Luftlinie</span></div></div>
 <progress max="1" value={view.progress} aria-label="Reisefortschritt" /><small className="travel-route-note">{journey.transport==='plane'?'Geografische Flugroute':'Schematische Verbindung zwischen den Stadien'} · Kartenkacheln benötigen Internet.</small>
 <div className="travel-events" aria-live="polite">{view.events.length?view.events.map(e=><p key={e.id}>{e.text} <b>{e.delta?`${e.delta>0?'+':''}${e.delta/1000} s`:'Nur fürs Protokoll'}</b></p>):<p>Die Mannschaft ist unterwegs. Die Fans warten schon.</p>}</div>
 {view.arrived?<button className="mode-primary travel-start" disabled={busy} onClick={onStart}>Match starten</button>:<small>Du kannst andere Bereiche öffnen. Die Reise läuft weiter.</small>}</section>;
}
export function TravelStatsPanel({travel,now}:{travel:TravelState;now:number}) {
 const stats=settleTravel(travel,now).stats,most=Object.values(stats.opponents).sort((a,b)=>b.trips-a.trips)[0];
 return <section className="travel-stats"><p className="eyebrow">REISEPASS / FC AZB</p><div><span><b>{stats.trips}</b> Auswärtsreisen</span><span><b>{Math.round(stats.km).toLocaleString('de-CH')}</b> km Luftlinie</span><span><b>{stats.countries.length}</b> besuchte Länder</span></div>{stats.countries.length>0&&<small>{stats.countries.join(' · ')}</small>}{stats.furthest&&<small>Weiteste Reise: {stats.furthest.opponent} · {Math.round(stats.furthest.km).toLocaleString('de-CH')} km</small>}{most&&<small>Meistbesucht: {most.name} · {most.trips} Reisen</small>}</section>;
}
