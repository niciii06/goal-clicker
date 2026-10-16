'use client';
// Sites Interactive Match 2.0 renderer (Web Worker / playback clock). Used for matches with a CupState.simulation.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getVisualFrame } from './match-visual-frame';
import type { Actor, Replay } from './match-visual-frame';
import type { GameFeatures } from './feature-data';
import { getCupRegularDurationMs, getStarXIPlayer } from './feature-data';
import { drawMatchFrame } from './match-canvas-drawing';
import { MatchPlaybackClock } from './match-playback-clock';
import type { RenderSnapshot } from './match-renderer-core';
import { matchFitness } from './match-broadcast';
import type { CameraMode } from './match-pitch-canvas';
import { computeAmbience, STADIUM_VIEW } from './stadium-ambience';
import type { Ambience } from './stadium-ambience';

const ambienceCache=new Map<string,Ambience>();
function ambienceFor(features:GameFeatures){
 const c=features.cup,key=`${c.careerMatchId}:${c.matchStartedAt}:${features.press.fanMood}:${c.fixture?.id??''}`;
 let value=ambienceCache.get(key);if(!value){value=computeAmbience(c,features.press.fanMood,c.simulation?.seed);ambienceCache.clear();ambienceCache.set(key,value);}
 return value;
}
type Body={x:number;y:number;vx:number;vy:number};
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

// Bounded velocities, acceleration and local separation for all 22 actors. This controls
// rendering only: score, events, fitness and the official match clock are never mutated.
class MatchMotion {
 bodies=new Map<string,Body>();scene='';
 step(actors:Actor[],dt:number,cup:GameFeatures['cup'],minute:number,scene:string) {
  const cut=this.scene!==''&&scene.startsWith('period:')&&this.scene.startsWith('period:')&&scene!==this.scene;this.scene=scene;
  const ids=new Set(actors.map(p=>p.id));for(const id of this.bodies.keys())if(!ids.has(id))this.bodies.delete(id);
  return actors.map(p=>{
   let b=this.bodies.get(p.id);if(!b||cut){b={x:p.x,y:p.y,vx:0,vy:0};this.bodies.set(p.id,b);return {...p};}
   const card=getStarXIPlayer(p.id)??getStarXIPlayer(cup.broadcast?.opponentXI.find(q=>q.id===p.id)?.sourceId??'');
   const pace=card?.originalAttributes?.stats?.sprintSpeed?.value??card?.rating??70;
   const timeScale=360000/getCupRegularDurationMs(cup);
   const speed=(p.goalkeeper?5:8+pace*.035)*timeScale*(.65+.35*matchFitness(cup,p.id,minute)/100);
   const dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy),desired=Math.min(speed,d*3);
   let vx=d>0?dx/d*desired:0,vy=d>0?dy/d*desired:0;
   for(const [id,q] of this.bodies){if(id===p.id)continue;const sx=b.x-q.x,sy=b.y-q.y,n=Math.hypot(sx,sy);if(n>.05&&n<2.9){vx+=sx/n*(2.9-n)*.8;vy+=sy/n*(2.9-n)*.8;}}
   const vl=Math.hypot(vx,vy);if(vl>speed){vx*=speed/vl;vy*=speed/vl;}
   const ax=vx-b.vx,ay=vy-b.vy,al=Math.hypot(ax,ay),max=24*timeScale*dt;
   b.vx+=al>max?ax/al*max:ax;b.vy+=al>max?ay/al*max:ay;
   b.x=clamp(b.x+b.vx*dt,1.5,103.5);b.y=clamp(b.y+b.vy*dt,1.5,66.5);
   return {...p,x:b.x,y:b.y};
  });
 }
}

export function InteractivePitchCanvas({features,now,replay,colours,camera,reducedMotion,onSelect,onFps,playbackWall}:{features:GameFeatures;now:number;replay?:Replay;colours:{club:string;opponent:string};camera:CameraMode;reducedMotion:boolean;onSelect:(id:string)=>void;onFps:(fps:number)=>void;playbackWall?:{current:number;workerActive?:boolean}}) {
 const [workerDisabled,setWorkerDisabled]=useState(false),worker=useRef<Worker|null>(null);
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({features,now,replay,colours,camera,reducedMotion,onSelect,onFps,playbackWall});
 useEffect(()=>{latest.current={features,now,replay,colours,camera,reducedMotion,onSelect,onFps,playbackWall};},[features,now,replay,colours,camera,reducedMotion,onSelect,onFps,playbackWall]);
 const clockAnchor=useRef({wall:now,monotonic:0}),playback=useRef(new MatchPlaybackClock());
 useEffect(()=>{clockAnchor.current={wall:latest.current.now,monotonic:performance.now()};},[]);
 const postSnapshot=useCallback((instance:Worker)=>{
  const data=latest.current,c=data.features.cup;if(!c.simulation||!canvas.current)return;
  const bounds=canvas.current.getBoundingClientRect(),dpi=Math.min(window.devicePixelRatio||1,2);
  const snapshot:RenderSnapshot={ambience:ambienceFor(data.features),simulation:c.simulation,startedAt:c.matchStartedAt,regularDuration:getCupRegularDurationMs(c),paused:c.matchPaused,active:c.active,
   wallNow:clockAnchor.current.wall+performance.now()-clockAnchor.current.monotonic,monotonicAt:performance.timeOrigin+performance.now(),colours:data.colours,
   yellowCards:(c.broadcast?.events??[]).filter(e=>e.kind==='yellow').map(e=>({playerId:e.playerId,minute:e.minute})),width:Math.max(1,Math.round(bounds.width*dpi)),height:Math.max(1,Math.round(bounds.height*dpi)),reducedMotion:data.reducedMotion};
  instance.postMessage({kind:'sync',snapshot});return snapshot;
 },[]);
 // Send only state changes. Passive-income/UI renders do not clone the action queue into the worker.
 useEffect(()=>{if(worker.current)postSnapshot(worker.current);},[features.cup,colours.club,colours.opponent,reducedMotion,postSnapshot]);
 const displayed=useRef<Actor[]>([]),view=useRef({x:52.5,y:34,zoom:1}),motion=useRef(new MatchMotion());

 useEffect(()=>{
  const el=canvas.current;if(!el)return;
  const initial=latest.current;
  if(!workerDisabled&&initial.features.cup.simulation&&initial.camera==='full'&&!initial.replay&&typeof Worker!=='undefined'&&typeof el.transferControlToOffscreen==='function'){
   let instance:Worker|undefined,transferred=false,readyTimer:ReturnType<typeof setTimeout>|undefined;
   try{
    instance=new Worker(new URL('./match-render.worker.ts',import.meta.url),{type:'module'});worker.current=instance;
    const fail=()=>{if(instance){instance.onerror=null;instance.onmessage=null;instance.terminate();}worker.current=null;if(latest.current.playbackWall)latest.current.playbackWall.workerActive=false;setWorkerDisabled(true);};
    instance.onerror=fail;
    instance.onmessage=event=>{if(event.data?.kind==='ready'&&readyTimer)clearTimeout(readyTimer);else if(event.data?.kind==='clock'&&latest.current.playbackWall){latest.current.playbackWall.current=event.data.wall;latest.current.playbackWall.workerActive=true;}else if(event.data?.kind==='select')latest.current.onSelect(event.data.id);};
    const snapshot=postSnapshot(instance)!;
    const surface=el.transferControlToOffscreen();transferred=true;instance.postMessage({kind:'init',canvas:surface,snapshot},[surface]);
    readyTimer=setTimeout(fail,4000);
    const resize=()=>{if(instance)postSnapshot(instance);},visibility=()=>instance?.postMessage({kind:'visibility',visible:document.visibilityState==='visible'});
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(resize);observer?.observe(el);window.addEventListener('resize',resize);document.addEventListener('visibilitychange',visibility);visibility();
    return()=>{if(readyTimer)clearTimeout(readyTimer);observer?.disconnect();window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);if(instance){instance.onerror=null;instance.onmessage=null;instance.terminate();}worker.current=null;if(latest.current.playbackWall)latest.current.playbackWall.workerActive=false;};
   }catch{instance?.terminate();worker.current=null;if(transferred){queueMicrotask(()=>setWorkerDisabled(true));return;}}
  }
  const ctx=el.getContext('2d');if(!ctx)return;
  let request=0,previous=0,lastDraw=0,sampleAt=0,frames=0,stopped=false;
  let bounds=el.getBoundingClientRect();
  const resize=()=>{bounds=el.getBoundingClientRect();};
  const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(resize);
  observer?.observe(el);window.addEventListener('resize',resize);
  const render=(timestamp:number)=>{
   if(stopped||document.visibilityState!=='visible')return;
   const data=latest.current;
   if(timestamp-lastDraw<(data.reducedMotion?1000:15)){request=requestAnimationFrame(render);return;}
   let wall=data.playbackWall?.current??clockAnchor.current.wall+timestamp-clockAnchor.current.monotonic;
   const cup=data.features.cup,sim=cup.simulation;
   if(sim&&!data.playbackWall&&cup.phase!=='penalties'&&!data.replay){
    const scale=5400/getCupRegularDurationMs(cup),earliest=sim.recent[0]?.start??sim.committed.time,latestTime=cup.matchPaused||!cup.active?sim.time:sim.buffer.at(-1)?.end??sim.time;
    const target=cup.matchPaused?sim.time:(wall-cup.matchStartedAt)*scale;
    wall=cup.matchStartedAt+playback.current.step(timestamp,target,earliest,latestTime,scale*1000)/scale;
   }
   const frame=getVisualFrame(data.features,wall,data.replay),dt=clamp((timestamp-previous)/1000,.001,.06);previous=timestamp;lastDraw=timestamp;
   const key=frame.recent&&frame.age<10?frame.recent.id:`period:${frame.minute<=45?0:frame.minute<=90?1:frame.minute<=105?2:3}`;
   const actors=data.reducedMotion||data.features.cup.simulation?frame.actors:motion.current.step(frame.actors,data.features.cup.matchPaused?0:dt,data.features.cup,frame.minute,key);
   displayed.current=actors;
   const dpi=Math.min(window.devicePixelRatio||1,2),width=Math.max(1,Math.round(bounds.width*dpi)),height=Math.max(1,Math.round(bounds.height*dpi));
   if(el.width!==width||el.height!==height){el.width=width;el.height=height;}
   const zoom=data.camera==='full'?1:data.camera==='follow'?1.35:frame.recent?1.35:1;
   view.current.zoom+=(zoom-view.current.zoom)*Math.min(1,dt*3);
   view.current.x+=(clamp(frame.ball.x,38,67)-view.current.x)*Math.min(1,dt*2);view.current.y+=(clamp(frame.ball.y,24,44)-view.current.y)*Math.min(1,dt*2);
   const scale=Math.min(width/STADIUM_VIEW.width,height/STADIUM_VIEW.height)*view.current.zoom;
   const center=data.camera==='full'?{x:52.5,y:34}:view.current;
   ctx.setTransform(scale,0,0,scale,width/2-center.x*scale,height/2-center.y*scale);
   drawMatchFrame(ctx,frame,actors,data.colours,data.features.cup,{ambience:ambienceFor(data.features),now:timestamp,celebration:'celebration' in frame?frame.celebration:undefined,animate:!data.reducedMotion});
   ctx.setTransform(1,0,0,1,0,0);
   frames++;if(timestamp-sampleAt>=1000){data.onFps(Math.round(frames*1000/(timestamp-sampleAt)));frames=0;sampleAt=timestamp;}
   request=requestAnimationFrame(render);
  };
  const visibility=()=>{cancelAnimationFrame(request);if(document.visibilityState==='visible'){previous=performance.now();playback.current.reset();request=requestAnimationFrame(render);}};
  document.addEventListener('visibilitychange',visibility);request=requestAnimationFrame(render);
  return()=>{stopped=true;cancelAnimationFrame(request);observer?.disconnect();window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);};
 },[workerDisabled,postSnapshot]);

 const select=(event:React.PointerEvent<HTMLCanvasElement>)=>{
  const el=canvas.current;if(!el)return;const b=el.getBoundingClientRect(),z=view.current.zoom,scale=Math.min(b.width/STADIUM_VIEW.width,b.height/STADIUM_VIEW.height)*z,center=camera==='full'?{x:52.5,y:34}:view.current;
  const x=(event.clientX-b.left-b.width/2)/scale+center.x,y=(event.clientY-b.top-b.height/2)/scale+center.y;
  if(worker.current){worker.current.postMessage({kind:'select',x,y});return;}
  const p=displayed.current.find(p=>Math.hypot(p.x-x,p.y-y)<3.2);if(p)onSelect(p.id);
 };
 return <canvas key={workerDisabled?'main-thread':'worker-capable'} ref={canvas} className="gc-viewer-pitch" role="img" aria-label="Live Fussballfeld mit 22 bewegten Spielern und Ball; Spieler antippen für Details" onPointerDown={select}><svg viewBox="-3 -3 111 74" aria-label="Fussballfeld"><rect width="105" height="68" fill="#237648"/><path d="M52.5 0V68" stroke="white"/></svg></canvas>;
}
