'use client';
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Journey } from './travel-data';
import { cameraCenter, cameraReducer, fitRoutes, initialCamera, projectRoutes, suggestedZoom, vehicleAt } from './travel-map-geometry';
import type { MapPoint, VehicleState } from './travel-map-geometry';
const ICONS={walk:'🚶',bike:'🚲',car:'🚗',bus:'🚌',train:'🚆',plane:'✈️'};
const VIEW={width:800,height:340,cx:400,cy:170};
/** Map props arrive about every 100 ms; between them the vehicle is extrapolated for at most this long. */
const MAX_EXTRAPOLATION_MS=250;

function vehicleTransforms(vehicle:VehicleState,scale:number){
 const lift=vehicle.mode==='plane'?vehicle.altitude:0;
 return {
  body:`translate(${vehicle.point.x*scale},${vehicle.point.y*scale})`,
  arrow:`rotate(${vehicle.bearing})`,
  // The emoji plane points north-east; its size grows a little with the visual altitude.
  icon:vehicle.mode==='plane'?`rotate(${vehicle.bearing-45}) scale(${.82+lift*.3})`:'',
  shadow:`translate(${lift*7},${lift*9}) scale(${1-lift*.25})`,
 };
}

export function TravelMap({journey,now,progress}:{journey:Journey;now:number;progress:number}) {
 const routes=useMemo(()=>projectRoutes(journey),[journey]);
 const fit=useMemo(()=>fitRoutes(routes),[routes]);
 const vehicle=vehicleAt(routes,journey,now,progress);
 const [camera,dispatch]=useReducer(cameraReducer,undefined,()=>initialCamera(suggestedZoom(vehicle.mode,fit.zoom),vehicle.point));
 const [anchor,setAnchor]=useState<MapPoint>(vehicle.point),[failed,setFailed]=useState(false);
 const scale=256*2**camera.zoom,n=2**camera.zoom;
 const svg=useRef<SVGSVGElement>(null),world=useRef<SVGGElement>(null),body=useRef<SVGGElement>(null),arrow=useRef<SVGPathElement>(null),icon=useRef<SVGTextElement>(null),shadow=useRef<SVGGElement>(null);
 const live=useRef({journey,routes,progress,camera,scale,anchor,vehicle,propNow:now,propAt:0,shown:now});
 // A new vehicle type suggests its own zoom, but never overrides a zoom level the user picked.
 const mode=vehicle.mode,stageIndex=vehicle.index;
 useEffect(()=>{dispatch({type:'suggest',zoom:suggestedZoom(mode,fit.zoom)});},[mode,stageIndex,fit.zoom]);

 // Vehicle and camera transforms are written straight to the SVG, by the animation loop and
 // after every render. React never owns them, so a re-render cannot reset or rewind the camera,
 // and programmatic camera moves never reach the interaction handlers.
 const apply=useRef((timestamp:number)=>{
  const state=live.current,propAt=state.propAt||timestamp;
  const time=Math.max(state.shown,state.propNow+Math.min(MAX_EXTRAPOLATION_MS,Math.max(0,timestamp-propAt)));state.shown=time;
  const current=vehicleAt(state.routes,state.journey,time,state.progress);state.vehicle=current;
  const t=vehicleTransforms(current,state.scale);
  body.current?.setAttribute('transform',t.body);arrow.current?.setAttribute('transform',t.arrow);shadow.current?.setAttribute('transform',t.shadow);
  if(icon.current){if(t.icon)icon.current.setAttribute('transform',t.icon);else icon.current.removeAttribute('transform');}
  const c=cameraCenter(state.camera,current.point);
  world.current?.setAttribute('transform',`translate(${VIEW.cx-c.x*state.scale},${VIEW.cy-c.y*state.scale})`);
  // Load new tiles before the followed vehicle leaves the area that is already covered.
  if(state.camera.follow&&Math.hypot(c.x-state.anchor.x,c.y-state.anchor.y)*state.scale>96){state.anchor=c;setAnchor(c);}
 });
 useLayoutEffect(()=>{
  const state=live.current;if(state.propNow!==now){state.propNow=now;state.propAt=performance.now();}
  Object.assign(state,{journey,routes,progress,camera,scale,anchor});apply.current(performance.now());
 });
 useEffect(()=>{
  let request=0;
  const frame=(timestamp:number)=>{apply.current(timestamp);request=requestAnimationFrame(frame);};
  request=requestAnimationFrame(frame);
  return()=>cancelAnimationFrame(request);
 },[]);

 // Pointer input: one pointer pans (and ends following), two pointers pinch-zoom (and keep following).
 const pointers=useRef(new Map<number,{x:number;y:number}>()),pan=useRef<{x:number;y:number;center:MapPoint;moved:boolean}|null>(null),pinch=useRef(0);
 const displayedCenter=()=>cameraCenter(live.current.camera,live.current.vehicle.point);
 const startPan=(p:{x:number;y:number})=>{pan.current={x:p.x,y:p.y,center:displayedCenter(),moved:false};};
 const spread=()=>{const [a,b]=[...pointers.current.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;};
 useEffect(()=>{
  const el=svg.current;if(!el)return;let accumulated=0,lastStep=0;
  // Native, non-passive listener: the page must not scroll while the wheel zooms the map.
  const wheel=(event:WheelEvent)=>{
   event.preventDefault();
   accumulated+=event.deltaY*(event.deltaMode===1?40:event.deltaMode===2?400:1);
   const at=performance.now();
   if(Math.abs(accumulated)>=60&&at-lastStep>110){dispatch({type:'zoom',delta:accumulated<0?1:-1});accumulated=0;lastStep=at;}
  };
  el.addEventListener('wheel',wheel,{passive:false});
  return()=>el.removeEventListener('wheel',wheel);
 },[]);

 const tileCenter=camera.follow?anchor:camera.center;
 const tiles=[];
 const x0=Math.floor((tileCenter.x*scale-VIEW.cx-160)/256),x1=Math.floor((tileCenter.x*scale+VIEW.cx+160)/256);
 const y0=Math.floor((tileCenter.y*scale-VIEW.cy-160)/256),y1=Math.floor((tileCenter.y*scale+VIEW.cy+160)/256);
 for(let x=x0;x<=x1;x++)for(let y=Math.max(0,y0);y<=Math.min(n-1,y1);y++)tiles.push({x,y});
 const lines=useMemo(()=>routes.map(r=>({...r,svgPoints:r.projected.map(p=>`${(p.x*scale).toFixed(1)},${(p.y*scale).toFixed(1)}`).join(' ')})),[routes,scale]);
 const start=routes[0].projected[0],end=routes.at(-1)!.projected.at(-1)!;
 const activeIcon=vehicle.mode==='wait'?'⌛':ICONS[vehicle.mode];

 return <div className="travel-map-wrap"><svg ref={svg} className="travel-map" viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="img" aria-label={`Reisekarte von Bern nach ${journey.fixture.venue.city}`}
  onPointerDown={e=>{pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});e.currentTarget.setPointerCapture(e.pointerId);if(pointers.current.size===1)startPan({x:e.clientX,y:e.clientY});else{pan.current=null;pinch.current=spread();}}}
  onPointerMove={e=>{
   if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pointers.current.size>=2){const distance=spread();if(pinch.current>0&&distance>0){const ratio=distance/pinch.current;if(ratio>1.45||ratio<1/1.45){dispatch({type:'zoom',delta:ratio>1?1:-1});pinch.current=distance;}}return;}
   const p=pan.current;if(!p)return;
   const dx=e.clientX-p.x,dy=e.clientY-p.y;if(!p.moved&&Math.hypot(dx,dy)<5)return;p.moved=true;
   const factor=VIEW.width/e.currentTarget.getBoundingClientRect().width;
   dispatch({type:'pan',center:{x:p.center.x-dx*factor/live.current.scale,y:p.center.y-dy*factor/live.current.scale}});
  }}
  onPointerUp={e=>{pointers.current.delete(e.pointerId);const rest=[...pointers.current.values()][0];if(rest)startPan(rest);else pan.current=null;pinch.current=0;}}
  onPointerCancel={e=>{pointers.current.delete(e.pointerId);pan.current=null;pinch.current=0;}}>
  <rect width={VIEW.width} height={VIEW.height} fill="#dce8ee" />
  <g ref={world}>
   {tiles.map(tile=><image key={`${camera.zoom}-${tile.x}-${tile.y}`} x={tile.x*256} y={tile.y*256} width="256" height="256" href={`https://tile.openstreetmap.org/${camera.zoom}/${((tile.x%n)+n)%n}/${tile.y}.png`} onError={()=>setFailed(true)} />)}
   {lines.filter(r=>r.mode!=='wait').map(r=><g key={r.id}><polyline points={r.svgPoints} fill="none" stroke="white" strokeWidth="7" strokeLinejoin="round" /><polyline points={r.svgPoints} fill="none" stroke={r.mode==='train'?'#7c3aed':r.mode==='plane'?'#b45309':'#0071e3'} strokeWidth="3" strokeLinejoin="round" strokeDasharray={r.geometry==='approximate'?'3 7':r.mode==='plane'?'9 6':r.mode==='train'?'12 3':undefined} /></g>)}
   {lines.slice(0,-1).filter(r=>r.mode!=='wait').map(r=>{const p=r.projected.at(-1)!;return <circle key={r.id} cx={p.x*scale} cy={p.y*scale} r="5" fill="white" stroke="#334155" strokeWidth="2"><title>{r.name??'Umstieg'}</title></circle>;})}
   <circle cx={start.x*scale} cy={start.y*scale} r="8" fill="#16845b" stroke="white" strokeWidth="3" /><circle cx={end.x*scale} cy={end.y*scale} r="8" fill="#c69214" stroke="white" strokeWidth="3" />
   <g ref={body}>
    {vehicle.mode==='plane'&&<g ref={shadow}><ellipse rx="15" ry="6" fill="rgba(15,23,42,.22)" /></g>}
    <circle r="23" fill="white" stroke="#0071e3" strokeWidth="2" />
    {vehicle.mode!=='wait'&&<path ref={arrow} d="M -4 -27 L 0 -35 L 4 -27 Z" fill="#0071e3" />}
    <text ref={icon} textAnchor="middle" dominantBaseline="central" fontSize="27">{activeIcon}</text>
   </g>
  </g>
 </svg><div className="travel-map-controls"><button type="button" aria-label="Karte vergrössern" onClick={()=>dispatch({type:'zoom',delta:1})}>+</button><button type="button" aria-label="Karte verkleinern" onClick={()=>dispatch({type:'zoom',delta:-1})}>−</button><button type="button" onClick={()=>dispatch({type:'fit',zoom:fit.zoom,center:fit.center})}>Route</button><button type="button" aria-pressed={camera.follow} onClick={()=>dispatch(camera.follow?{type:'unfollow',vehicle:live.current.vehicle.point}:{type:'follow',vehicle:live.current.vehicle.point})}>Folgen {camera.follow?'✓':''}</button></div><small className="travel-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · FOSSGIS / Overpass · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Kartenfehler melden</a></small>{failed&&<small className="travel-map-fallback">Kartenkacheln nicht verfügbar. Route und Reise laufen weiter.</small>}</div>;
}
