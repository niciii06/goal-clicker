'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { getVisualFrame } from './match-visual-frame';
import type { Actor, Replay } from './match-visual-frame';
import type { GameFeatures } from './feature-data';
import { MatchPresentation, resolvedBall } from './match-motion';
import { InteractivePitchCanvas } from './interactive-pitch-canvas';
export { MatchMotion, BallMotion, resolvedBall, MatchPresentation } from './match-motion';
export type CameraMode='full'|'follow'|'highlights';
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
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
export function drawMatchFrame(ctx:CanvasRenderingContext2D,frame:ReturnType<typeof getVisualFrame>,actors:Actor[],colours:{club:string;opponent:string},cup:GameFeatures['cup'],renderedBall?:{x:number;y:number}) {
 drawFootballPitch(ctx);
   for(const p of actors){
    const keeper=p.goalkeeper;ctx.fillStyle=keeper?p.team==='club'?'#c684f4':'#74d0ed':colours[p.team];ctx.strokeStyle='#effff3';ctx.lineWidth=.35;
    ctx.beginPath();ctx.ellipse(p.x,p.y,frame.keeperDive===p.id?2.65:1.65,frame.keeperDive===p.id?.9:1.65,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.font='bold 1.9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=.18;ctx.strokeStyle='#071b12';ctx.strokeText(p.shirt,p.x,p.y+.08);ctx.fillStyle='white';ctx.fillText(p.shirt,p.x,p.y+.08);
    if(cup.broadcast?.events.some(e=>e.kind==='yellow'&&e.playerId===p.id&&e.minute<=frame.minute)){ctx.fillStyle='#ffe449';ctx.fillRect(p.x+1.2,p.y-2.8,.9,1.4);}
   }
   const ball=renderedBall??resolvedBall(frame,actors);
   ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(ball.x,ball.y+.8,1.1,.5,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#fff';ctx.strokeStyle='#132319';ctx.lineWidth=.23;ctx.beginPath();ctx.arc(ball.x,ball.y-frame.height*.7,.75+frame.height*.06,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#132319';ctx.beginPath();ctx.arc(ball.x-.15,ball.y-frame.height*.7-.12,.19,0,Math.PI*2);ctx.fill();

}
type PitchCanvasProps={features:GameFeatures;now:number;replay?:Replay;colours:{club:string;opponent:string};camera:CameraMode;reducedMotion:boolean;onSelect:(id:string)=>void;onFps:(fps:number)=>void;playbackWall?:{current:number;workerActive?:boolean}};
// Matches with an Interactive Match 2.0 simulation use the Sites worker renderer; legacy fixtures keep the presentation below.
export function MatchPitchCanvas(props:PitchCanvasProps) {
 return props.features.cup.simulation?<InteractivePitchCanvas {...props}/>:<LegacyPitchCanvas {...props}/>;
}
export function LegacyPitchCanvas({features,now,replay,colours,camera,reducedMotion,onSelect,onFps}:PitchCanvasProps) {
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({features,now,replay,colours,camera,reducedMotion,onSelect,onFps});
 const offset=useRef(0);
 useLayoutEffect(()=>{latest.current={features,now,replay,colours,camera,reducedMotion,onSelect,onFps};offset.current=now-Date.now();},[features,now,replay,colours,camera,reducedMotion,onSelect,onFps]);
 const displayed=useRef<Actor[]>([]),view=useRef({x:52.5,y:34,zoom:1});
 useEffect(()=>{
  const el=canvas.current;if(!el)return;
  const ctx=el.getContext('2d');if(!ctx)return;
  let request=0,previous=0,lastDraw=0,sampleAt=0,frames=0,stopped=false;
  const presentation=new MatchPresentation();
  const render=(timestamp:number)=>{
   if(stopped||document.visibilityState!=='visible')return;
   const data=latest.current;
   if(timestamp-lastDraw<(data.reducedMotion?1000:15)){request=requestAnimationFrame(render);return;}
   const wall=Date.now()+offset.current;
   const dt=clamp((timestamp-previous)/1000,.001,.06);previous=timestamp;lastDraw=timestamp;
   const {frame,actors,ball}=presentation.step(data.features,wall,dt,data.replay,data.reducedMotion);
   displayed.current=actors;
   const bounds=el.getBoundingClientRect(),dpi=Math.min(window.devicePixelRatio||1,2),width=Math.max(1,Math.round(bounds.width*dpi)),height=Math.max(1,Math.round(bounds.height*dpi));
   if(el.width!==width||el.height!==height){el.width=width;el.height=height;}
   const zoom=data.camera==='full'?1:data.camera==='follow'?1.35:frame.recent?1.35:1;
   view.current.zoom+=(zoom-view.current.zoom)*Math.min(1,dt*3);
   view.current.x+=(clamp(frame.ball.x,38,67)-view.current.x)*Math.min(1,dt*2);view.current.y+=(clamp(frame.ball.y,24,44)-view.current.y)*Math.min(1,dt*2);
   const scale=Math.min(width/113,height/76)*view.current.zoom;
   const center=data.camera==='full'?{x:52.5,y:34}:view.current;
   ctx.setTransform(scale,0,0,scale,width/2-center.x*scale,height/2-center.y*scale);
   drawMatchFrame(ctx,frame,actors,data.colours,data.features.cup,ball);
   ctx.setTransform(1,0,0,1,0,0);
   frames++;if(timestamp-sampleAt>=1000){data.onFps(Math.round(frames*1000/(timestamp-sampleAt)));frames=0;sampleAt=timestamp;}
   request=requestAnimationFrame(render);
  };
  const visibility=()=>{cancelAnimationFrame(request);if(document.visibilityState==='visible'){previous=performance.now();request=requestAnimationFrame(render);}};
  document.addEventListener('visibilitychange',visibility);request=requestAnimationFrame(render);
  return()=>{stopped=true;cancelAnimationFrame(request);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 const select=(event:React.PointerEvent<HTMLCanvasElement>)=>{
  const el=canvas.current;if(!el)return;const b=el.getBoundingClientRect(),z=view.current.zoom,scale=Math.min(b.width/113,b.height/76)*z,center=camera==='full'?{x:52.5,y:34}:view.current;
  const x=(event.clientX-b.left-b.width/2)/scale+center.x,y=(event.clientY-b.top-b.height/2)/scale+center.y;
  const p=displayed.current.find(p=>Math.hypot(p.x-x,p.y-y)<3.2);if(p)onSelect(p.id);
 };
 return <canvas ref={canvas} className="gc-viewer-pitch" role="img" aria-label="Live Fussballfeld mit 22 bewegten Spielern und Ball; Spieler antippen für Details" onPointerDown={select}><svg viewBox="-3 -3 111 74" aria-label="Fussballfeld"><rect width="105" height="68" fill="#237648"/><path d="M52.5 0V68" stroke="white"/></svg></canvas>;
}
