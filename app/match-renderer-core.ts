import type { InteractiveMatch } from './interactive-match';
import type { Actor } from './match-viewer';
import { ballHeight, playLabel, readInteractiveFrame } from './interactive-frame-data';
import { MatchPlaybackClock } from './match-playback-clock';
import type { Ambience } from './stadium-ambience';
export type RenderSnapshot={ambience?:Ambience;simulation:InteractiveMatch;startedAt:number;regularDuration:number;paused:boolean;active:boolean;wallNow:number;monotonicAt:number;colours:{club:string;opponent:string};yellowCards:{playerId:string;minute:number}[];width:number;height:number;reducedMotion:boolean};
/** No React, catalog lookups, scoring, storage or network work lives in this renderer. */
export class IndependentMatchRenderer {
 snapshot?:RenderSnapshot;private clock=new MatchPlaybackClock();
 sync(snapshot:RenderSnapshot){if(this.snapshot?.simulation.id!==snapshot.simulation.id)this.clock.reset();this.snapshot=snapshot;}
 reset(){this.clock.reset();}
 frame(monotonicNow:number){
  const p=this.snapshot;if(!p)return undefined;const s=p.simulation,scale=5400/p.regularDuration;
  const target=p.paused?s.time:(p.wallNow+monotonicNow-p.monotonicAt-p.startedAt)*scale;
  const earliest=s.recent[0]?.start??s.committed.time,latest=p.paused||!p.active?s.time:s.buffer.at(-1)?.end??s.time;
  if(p.reducedMotion)this.clock.reset();
  const time=Math.min(latest,this.clock.step(monotonicNow,target,earliest,latest,scale*1000)),f=readInteractiveFrame(s,time);
  const a=f.action,travelling=a&&['pass','cross','shot','interception','restart'].includes(a.kind);
  const actors:Actor[]=f.players.map(p=>({id:p.id,label:p.name,shirt:String(p.number),team:p.side,role:p.role,x:p.x,y:p.y,goalkeeper:p.role==='TW',rating:null}));
  return {actors,ball:f.ball,height:ballHeight(a,f.progress),minute:Math.max(1,Math.min(120,Math.ceil(time/60))),wallTime:p.startedAt+time/scale,status:playLabel(a),recent:undefined,age:Infinity,keeperDive:a?.kind==='shot'&&a.outcome==='save'&&f.progress>.55?a.target:undefined,ballOwnerId:travelling?undefined:a?.actor,pass:undefined,shotFlight:undefined,celebration:f.celebration};
 }
}
