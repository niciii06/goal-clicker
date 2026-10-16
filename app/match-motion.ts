import { getVisualFrame } from './match-visual-frame';
import type { Actor, Replay } from './match-visual-frame';
import type { GameFeatures } from './feature-data';
import { getCupRegularDurationMs, getStarXIPlayer } from './feature-data';
import { matchFitness } from './match-broadcast';
export const MAX_BALL_SPEED_METRES_PER_SECOND=55;
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
   const timeScale=Math.min(1.2,360000/getCupRegularDurationMs(cup));
   const speed=Math.min(12,(p.goalkeeper?5:8+pace*.035)*timeScale*(.65+.35*matchFitness(cup,p.id,minute)/100));
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
export function resolvedBall(frame:ReturnType<typeof getVisualFrame>,actors:Actor[]) {
 let ball={...frame.ball};
   if(frame.ballOwnerId&&!frame.pass&&!frame.shotFlight){const owner=actors.find(p=>p.id===frame.ballOwnerId),ideal=frame.actors.find(p=>p.id===frame.ballOwnerId);if(owner&&ideal){ball.x+=owner.x-ideal.x;ball.y+=owner.y-ideal.y;}}
   if(frame.pass){const a=actors.find(p=>p.id===frame.pass!.fromId),b=actors.find(p=>p.id===frame.pass!.toId);if(a&&b)ball={x:a.x+(b.x-a.x)*frame.pass.progress,y:a.y+(b.y-a.y)*frame.pass.progress};}
   if(frame.shotFlight){const a=actors.find(p=>p.id===frame.shotFlight!.fromId),ideal=frame.actors.find(p=>p.id===frame.shotFlight!.fromId);if(a&&ideal){ball.x+=(a.x-ideal.x)*(1-frame.shotFlight.progress);ball.y+=(a.y-ideal.y)*(1-frame.shotFlight.progress);}}
 return ball;
}
export class BallMotion {
 point?: {x:number;y:number};
 step(target:{x:number;y:number},dt:number,restart=false){
  if(!this.point||restart){this.point={...target};return {...target};}
  const delta=Math.max(0,Math.min(.06,dt)),dx=target.x-this.point.x,dy=target.y-this.point.y,d=Math.hypot(dx,dy),distance=Math.min(d,MAX_BALL_SPEED_METRES_PER_SECOND*delta);
  if(d>0){this.point.x+=dx/d*distance;this.point.y+=dy/d*distance;}
  return {...this.point};
 }
}

// The canvas and CLI audit share this exact stateful presentation pipeline.
export class MatchPresentation {
 private actors=new MatchMotion();
 private ball=new BallMotion();
 private restartKey='';
 step(features:GameFeatures,wall:number,dt:number,replay?:Replay,reducedMotion=false) {
  const frame=getVisualFrame(features,wall,replay);
  const pause=features.cup.timedPause;
  const paused=features.cup.matchPaused||Boolean(pause&&wall>=pause.startsAt);
  const delta=paused?0:Math.max(0,Math.min(.06,dt));
  const key=frame.recent&&frame.age<10?frame.recent.id:`period:${frame.minute<=45?0:frame.minute<=90?1:frame.minute<=105?2:3}`;
  const actors=reducedMotion?frame.actors:this.actors.step(frame.actors,delta,features.cup,frame.minute,key);
  const keyRestart=['Anpfiff','Wiederanpfiff','Seitenwechsel'].includes(frame.status)?`${features.cup.restartAt??0}:${frame.status}`:'';
  const restart=Boolean(keyRestart&&keyRestart!==this.restartKey);
  const ball=this.ball.step(resolvedBall(frame,actors),delta,restart);
  this.restartKey=keyRestart;
  return {frame,actors,ball,paused,restart};
 }
}
