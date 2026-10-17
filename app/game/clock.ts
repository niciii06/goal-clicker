// Monotonic session clock and the server synchronised travel clock.


export let travelClock: {server:number;monotonic:number}|null=null;

export function syncTravelClock(serverNow:unknown) { if(typeof serverNow==='number'&&Number.isFinite(serverNow)) travelClock={server:serverNow,monotonic:performance.now()}; }

export function getTravelTime() { return travelClock?travelClock.server+performance.now()-travelClock.monotonic:Date.now(); }

export let sessionClock:{wall:number;monotonic:number}|null=null;

export function getCurrentTime() {
  if(typeof window==='undefined')return Date.now();
  sessionClock??={wall:Date.now(),monotonic:performance.now()};
  return sessionClock.wall+performance.now()-sessionClock.monotonic;
}
