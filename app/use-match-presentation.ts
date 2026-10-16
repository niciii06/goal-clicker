'use client';
import { useEffect, useRef, useState } from 'react';
import type { CupState } from './feature-data';
import { getCupRegularDurationMs } from './feature-data';
import { MatchPlaybackClock } from './match-playback-clock';

/** One persistent presentation clock for both pitch and ticker. No match mutations. */
export function useMatchPresentation(cup:CupState,now:number){
 const latest=useRef({cup,now}),wall=useRef(now) as {current:number;workerActive?:boolean},clock=useRef(new MatchPlaybackClock());
 const [minute,setMinute]=useState(()=>Math.max(1,Math.min(120,Math.ceil((cup.simulation?.time??0)/60))));
 useEffect(()=>{latest.current={cup,now};},[cup,now]);
 useEffect(()=>{
  const anchor={wall:latest.current.now,monotonic:performance.now()};let request=0,lastMinute=-1,wasWorker=false;
  const render=(timestamp:number)=>{
   if(document.visibilityState!=='visible')return;
   const c=latest.current.cup,s=c.simulation;
   if(s){const scale=5400/getCupRegularDurationMs(c),target=c.matchPaused?s.time:(anchor.wall+timestamp-anchor.monotonic-c.matchStartedAt)*scale;
    if(wasWorker&&!wall.workerActive)clock.current.reset();wasWorker=Boolean(wall.workerActive);
    const time=wall.workerActive?Math.max(0,(wall.current-c.matchStartedAt)*scale):clock.current.step(timestamp,target,s.recent[0]?.start??s.committed.time,c.matchPaused||!c.active?s.time:s.buffer.at(-1)?.end??s.time,scale*1000);
    if(!wall.workerActive)wall.current=c.matchStartedAt+time/scale;
    const nextMinute=Math.max(1,Math.min(120,Math.ceil(time/60)));
    if(nextMinute!==lastMinute){lastMinute=nextMinute;setMinute(nextMinute);}
   }
   request=requestAnimationFrame(render);
  };
  const visibility=()=>{cancelAnimationFrame(request);if(document.visibilityState==='visible'){clock.current.reset();request=requestAnimationFrame(render);}};
  document.addEventListener('visibilitychange',visibility);request=requestAnimationFrame(render);
  return()=>{cancelAnimationFrame(request);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 return {wall,minute};
}
