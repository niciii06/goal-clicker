'use client';
import { useEffect, useRef } from 'react';
import { getVisualFrame } from './match-viewer';
import type { Actor, Replay } from './match-viewer';
import type { GameFeatures } from './feature-data';
import { getCupRegularDurationMs, getStarXIPlayer } from './feature-data';
import { matchFitness } from './match-broadcast';
export type CameraMode='full'|'follow'|'highlights';
type Body={x:number;y:number;vx:number;vy:number};
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

// Bounded velocities, acceleration and local separation for all 22 actors. This controls
// rendering only: score, events, fitness and the official match clock are never mutated.
export class MatchMotion {
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
export function drawFootballPitch(ctx:CanvasRenderingContext2D) {
 ctx.fillStyle='#16432e';ctx.fillRect(-4,-4,113,76);
 for(let i=0;i<14;i++){ctx.fillStyle=i%2?'#287f4c':'#237648';ctx.fillRect(i*7.5,0,7.5,68);}
 ctx.strokeStyle='#d5eddb';ctx.lineWidth=.32;ctx.strokeRect(0,0,105,68);
 ctx.beginPath();ctx.moveTo(52.5,0);ctx.lineTo(52.5,68);ctx.stroke();
 const circle=(x:number,y:number,r:number)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();};circle(52.5,34,9.15);
 for(const x of [0,105]){
  ctx.strokeRect(x===0?0:88.5,13.84,16.5,40.32);ctx.strokeRect(x===0?0:99.5,24.84,5.5,18.32);
  circle(x===0?11:94,34,.35);ctx.beginPath();ctx.arc(x===0?11:94,34,9.15,x===0?-.92:Math.PI-.92,x===0?.92:Math.PI+.92);ctx.stroke();
  ctx.strokeStyle='#f4fbf5';ctx.lineWidth=.45;ctx.strokeRect(x===0?-2:105,30.34,2,7.32);ctx.lineWidth=.32;ctx.strokeStyle='#d5eddb';
  for(let net=.5;net<2;net+=.5){ctx.beginPath();ctx.moveTo(x===0?-net:105+net,30.34);ctx.lineTo(x===0?-net:105+net,37.66);ctx.stroke();}
 }
 for(const [x,y,start] of [[0,0,0],[105,0,Math.PI/2],[105,68,Math.PI],[0,68,Math.PI*1.5]]){ctx.beginPath();ctx.arc(x,y,1,start,start+Math.PI/2);ctx.stroke();}
 ctx.fillStyle='#d5eddb';ctx.beginPath();ctx.arc(52.5,34,.38,0,Math.PI*2);ctx.fill();
}
export function drawMatchFrame(ctx:CanvasRenderingContext2D,frame:ReturnType<typeof getVisualFrame>,actors:Actor[],colours:{club:string;opponent:string},cup:GameFeatures['cup']) {
 drawFootballPitch(ctx);
   for(const p of actors){
    const keeper=p.goalkeeper;ctx.fillStyle=keeper?p.team==='club'?'#c684f4':'#74d0ed':colours[p.team];ctx.strokeStyle='#effff3';ctx.lineWidth=.35;
    ctx.beginPath();ctx.ellipse(p.x,p.y,frame.keeperDive===p.id?2.65:1.65,frame.keeperDive===p.id?.9:1.65,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.font='bold 1.9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=.18;ctx.strokeStyle='#071b12';ctx.strokeText(p.shirt,p.x,p.y+.08);ctx.fillStyle='white';ctx.fillText(p.shirt,p.x,p.y+.08);
    if(cup.broadcast?.events.some(e=>e.kind==='yellow'&&e.playerId===p.id&&e.minute<=frame.minute)){ctx.fillStyle='#ffe449';ctx.fillRect(p.x+1.2,p.y-2.8,.9,1.4);}
   }
   let ball={...frame.ball};
   if(frame.ballOwnerId&&!frame.pass&&!frame.shotFlight){const owner=actors.find(p=>p.id===frame.ballOwnerId),ideal=frame.actors.find(p=>p.id===frame.ballOwnerId);if(owner&&ideal){ball.x+=owner.x-ideal.x;ball.y+=owner.y-ideal.y;}}
   if(frame.pass){const a=actors.find(p=>p.id===frame.pass!.fromId),b=actors.find(p=>p.id===frame.pass!.toId);if(a&&b)ball={x:a.x+(b.x-a.x)*frame.pass.progress,y:a.y+(b.y-a.y)*frame.pass.progress};}
   if(frame.shotFlight){const a=actors.find(p=>p.id===frame.shotFlight!.fromId),ideal=frame.actors.find(p=>p.id===frame.shotFlight!.fromId);if(a&&ideal){ball.x+=(a.x-ideal.x)*(1-frame.shotFlight.progress);ball.y+=(a.y-ideal.y)*(1-frame.shotFlight.progress);}}
   ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(ball.x,ball.y+.8,1.1,.5,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#fff';ctx.strokeStyle='#132319';ctx.lineWidth=.23;ctx.beginPath();ctx.arc(ball.x,ball.y-frame.height*.7,.75+frame.height*.06,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#132319';ctx.beginPath();ctx.arc(ball.x-.15,ball.y-frame.height*.7-.12,.19,0,Math.PI*2);ctx.fill();

}
export function MatchPitchCanvas({features,now,replay,colours,camera,reducedMotion,onSelect,onFps}:{features:GameFeatures;now:number;replay?:Replay;colours:{club:string;opponent:string};camera:CameraMode;reducedMotion:boolean;onSelect:(id:string)=>void;onFps:(fps:number)=>void}) {
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({features,now,replay,colours,camera,reducedMotion,onSelect,onFps});
 latest.current={features,now,replay,colours,camera,reducedMotion,onSelect,onFps};
 const displayed=useRef<Actor[]>([]),view=useRef({x:52.5,y:34,zoom:1}),motion=useRef(new MatchMotion());
 useEffect(()=>{
  const el=canvas.current;if(!el)return;
  const ctx=el.getContext('2d');if(!ctx)return;
  let request=0,previous=0,lastDraw=0,sampleAt=0,frames=0,stopped=false;
  const render=(timestamp:number)=>{
   if(stopped||document.visibilityState!=='visible')return;
   const data=latest.current;
   if(timestamp-lastDraw<(data.reducedMotion?1000:15)){request=requestAnimationFrame(render);return;}
   const wall=Date.now()+offset.current;
   const frame=getVisualFrame(data.features,wall,data.replay),dt=clamp((timestamp-previous)/1000,.001,.06);previous=timestamp;lastDraw=timestamp;
   const key=frame.recent&&frame.age<10?frame.recent.id:`period:${frame.minute<=45?0:frame.minute<=90?1:frame.minute<=105?2:3}`;
   const actors=data.reducedMotion?frame.actors:motion.current.step(frame.actors,data.features.cup.matchPaused?0:dt,data.features.cup,frame.minute,key);
   displayed.current=actors;
   const bounds=el.getBoundingClientRect(),dpi=Math.min(window.devicePixelRatio||1,2),width=Math.max(1,Math.round(bounds.width*dpi)),height=Math.max(1,Math.round(bounds.height*dpi));
   if(el.width!==width||el.height!==height){el.width=width;el.height=height;}
   const zoom=data.camera==='full'?1:data.camera==='follow'?1.35:frame.recent?1.35:1;
   view.current.zoom+=(zoom-view.current.zoom)*Math.min(1,dt*3);
   view.current.x+=(clamp(frame.ball.x,38,67)-view.current.x)*Math.min(1,dt*2);view.current.y+=(clamp(frame.ball.y,24,44)-view.current.y)*Math.min(1,dt*2);
   const scale=Math.min(width/113,height/76)*view.current.zoom;
   const center=data.camera==='full'?{x:52.5,y:34}:view.current;
   ctx.setTransform(scale,0,0,scale,width/2-center.x*scale,height/2-center.y*scale);
   drawMatchFrame(ctx,frame,actors,data.colours,data.features.cup);
   ctx.setTransform(1,0,0,1,0,0);
   frames++;if(timestamp-sampleAt>=1000){data.onFps(Math.round(frames*1000/(timestamp-sampleAt)));frames=0;sampleAt=timestamp;}
   request=requestAnimationFrame(render);
  };
  const visibility=()=>{cancelAnimationFrame(request);if(document.visibilityState==='visible'){previous=performance.now();request=requestAnimationFrame(render);}};
  document.addEventListener('visibilitychange',visibility);request=requestAnimationFrame(render);
  return()=>{stopped=true;cancelAnimationFrame(request);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 const offset=useRef(now-Date.now());useEffect(()=>{offset.current=now-Date.now();},[now]);
 const select=(event:React.PointerEvent<HTMLCanvasElement>)=>{
  const el=canvas.current;if(!el)return;const b=el.getBoundingClientRect(),z=view.current.zoom,scale=Math.min(b.width/113,b.height/76)*z,center=camera==='full'?{x:52.5,y:34}:view.current;
  const x=(event.clientX-b.left-b.width/2)/scale+center.x,y=(event.clientY-b.top-b.height/2)/scale+center.y;
  const p=displayed.current.find(p=>Math.hypot(p.x-x,p.y-y)<3.2);if(p)onSelect(p.id);
 };
 return <canvas ref={canvas} className="gc-viewer-pitch" role="img" aria-label="Live Fussballfeld mit 22 bewegten Spielern und Ball; Spieler antippen für Details" onPointerDown={select}><svg viewBox="-3 -3 111 74" aria-label="Fussballfeld"><rect width="105" height="68" fill="#237648"/><path d="M52.5 0V68" stroke="white"/></svg></canvas>;
}
