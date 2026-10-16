import type { InteractiveMatch } from './interactive-match';

const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function readInteractiveFrame(s:InteractiveMatch,time:number) {
 const a=s.recent.find(a=>a.start<=time&&a.end>=time)??s.buffer.find(a=>a.start<=time&&a.end>=time)??s.recent.at(-1);
 const c=a?.before??s.committed,t=a?clamp((time-a.start)/(a.end-a.start),0,1):0;
 const players=c.players.filter(p=>p.active).map(p=>{const end=a?.after.players.find(q=>q.id===p.id)??p;return {...p,x:p.x+(end.x-p.x)*t,y:p.y+(end.y-p.y)*t};});
 const ball=a?{x:a.from.x+(a.to.x-a.from.x)*t,y:a.from.y+(a.to.y-a.from.y)*t}:s.committed.ball;
 return {players,ball,action:a,time,progress:t};
}
