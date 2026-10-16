import type { InteractiveMatch, SimAction } from './interactive-match';

const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const ease=(n:number)=>{const v=clamp(n,0,1);return v*v*(3-2*v);};
/** Share of the post-goal restart spent celebrating; the rest walks back to the kickoff positions. */
export const CELEBRATION_SHARE=.62;
export type FrameCelebration={side:'club'|'opponent';scorerId:string;progress:number};

function precedingGoal(s:InteractiveMatch,a:SimAction|undefined){
 if(!a||a.kind!=='restart')return undefined;
 return [...s.recent,...s.buffer].find(g=>g.end===a.start&&g.kind==='shot'&&g.outcome==='goal');
}

export function readInteractiveFrame(s:InteractiveMatch,time:number) {
 const a=s.recent.find(a=>a.start<=time&&a.end>=time)??s.buffer.find(a=>a.start<=time&&a.end>=time)??s.recent.at(-1);
 const c=a?.before??s.committed,t=a?clamp((time-a.start)/(a.end-a.start),0,1):0;
 const goal=precedingGoal(s,a);
 if(a&&goal)return celebrationFrame(a,goal,time,t);
 const players=c.players.filter(p=>p.active).map(p=>{const end=a?.after.players.find(q=>q.id===p.id)??p;return {...p,x:p.x+(end.x-p.x)*t,y:p.y+(end.y-p.y)*t};});
 const ball=a?{x:a.from.x+(a.to.x-a.from.x)*t,y:a.from.y+(a.to.y-a.from.y)*t}:s.committed.ball;
 return {players,ball,action:a,time,progress:t,celebration:undefined as FrameCelebration|undefined};
}

// Rendering only: the scorer runs to the nearest corner flag, team mates pile on, everybody then walks to the kickoff.
function celebrationFrame(a:SimAction,goal:SimAction,time:number,t:number) {
 const scorer=a.before.players.find(p=>p.id===goal.actor);
 const side=goal.side,goalRight=goal.to.x>52.5;
 const corner={x:goalRight?101.2:3.8,y:(scorer?.y??34)<34?3.8:64.2};
 const mates=a.before.players.filter(p=>p.active&&p.side===side&&p.role!=='TW'&&p.id!==goal.actor);
 // Position of a celebrating player at celebration time u (0 to CELEBRATION_SHARE).
 const party=(id:string,from:{x:number;y:number},u:number)=>{
  if(id===goal.actor){const run=ease(u/.38),hop=u>.38&&u<CELEBRATION_SHARE?Math.abs(Math.sin(u*48))*.9:0;return {x:from.x+(corner.x-from.x)*run,y:from.y+(corner.y-from.y)*run-hop};}
  const index=Math.max(0,mates.findIndex(p=>p.id===id)),angle=index*2.4+.6,radius=2.4+(index%3)*1.3;
  const spot={x:clamp(corner.x+Math.cos(angle)*radius*(goalRight?-1:1),1.5,103.5),y:clamp(corner.y+Math.abs(Math.sin(angle))*radius*(corner.y<34?1:-1),1.5,66.5)};
  const delay=Math.min(.16,Math.hypot(from.x-corner.x,from.y-corner.y)/420),run=ease((u-delay)/(.5-delay));
  return {x:from.x+(spot.x-from.x)*run,y:from.y+(spot.y-from.y)*run};
 };
 const back=ease((t-CELEBRATION_SHARE)/(1-CELEBRATION_SHARE));
 const players=a.before.players.filter(p=>p.active).map(p=>{
  const end=a.after.players.find(q=>q.id===p.id)??p;
  if(p.side!==side||p.role==='TW')return {...p,x:p.x+(end.x-p.x)*ease(t),y:p.y+(end.y-p.y)*ease(t)};
  if(t<CELEBRATION_SHARE){const now=party(p.id,p,t);return {...p,x:now.x,y:now.y};}
  const peak=party(p.id,p,CELEBRATION_SHARE);
  return {...p,x:peak.x+(end.x-peak.x)*back,y:peak.y+(end.y-peak.y)*back};
 });
 const ball={x:a.from.x+(a.to.x-a.from.x)*back,y:a.from.y+(a.to.y-a.from.y)*back};
 return {players,ball,action:a,time,progress:t,celebration:{side,scorerId:goal.actor,progress:t} as FrameCelebration|undefined};
}
