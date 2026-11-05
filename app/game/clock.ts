// Monotonic session clock and the server synchronised travel clock.


export let travelClock: {server:number;monotonic:number}|null=null;

export function syncTravelClock(serverNow:unknown) { if(typeof serverNow==='number'&&Number.isFinite(serverNow)) travelClock={server:serverNow,monotonic:performance.now()}; }

export function getTravelTime() { return travelClock?travelClock.server+performance.now()-travelClock.monotonic:Date.now(); }

/**
 * Milliseconds on a clock that only moves forward and ignores changes of the system clock (performance.now).
 * Only differences between two readings mean something; use it to measure how long a tab was hidden.
 */
export function monotonicNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

/** How long passed between a monotonic reading and now; never negative. */
export function monotonicElapsed(since: number, now = monotonicNow()) {
  return Math.max(0, now - since);
}

export let sessionClock:{wall:number;monotonic:number}|null=null;

export function getCurrentTime() {
  if(typeof window==='undefined')return Date.now();
  sessionClock??={wall:Date.now(),monotonic:performance.now()};
  return sessionClock.wall+performance.now()-sessionClock.monotonic;
}
