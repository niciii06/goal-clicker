/** Presentation-only clock. A delayed frame must not skip straight to a new play.
 * Outcomes and the authoritative match clock never depend on this clock. */
export class MatchPlaybackClock {
 private playhead:number|undefined;
 private previous:number|undefined;
 reset(){this.playhead=undefined;this.previous=undefined;}
 step(timestamp:number,target:number,earliest:number,latest:number,speed=15):number {
  const bounded=Math.max(earliest,Math.min(latest,target));
  if(this.playhead===undefined||this.previous===undefined){this.playhead=bounded;this.previous=timestamp;return bounded;}
  const elapsed=Math.max(0,timestamp-this.previous)/1000;this.previous=timestamp;
  // Limit the first frame after a main-thread stall, then catch up gradually.
  const budget=(elapsed>.25?.05:elapsed)*speed;
  const lag=Math.max(0,bounded-this.playhead),rate=lag>3?1.2:1;
  this.playhead=Math.max(this.playhead,earliest,Math.min(bounded,this.playhead+budget*rate));
  return this.playhead;
 }
}
