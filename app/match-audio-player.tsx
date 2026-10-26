'use client';
import { useEffect, useRef } from 'react';
import { getCupRegularDurationMs } from './feature-data';
import type { GameFeatures } from './feature-data';
import { crowdSize, gameAudioContext, homeTeamOf, legacyCues, simulationCues, StadiumAudio } from './match-audio';
import type { SoundCue } from './match-audio';
import { matchStadium } from './match-stadium';

/** Match time in seconds as the pitch shows it (0 to 5400 for the regular time). */
function presentedTime(cup: GameFeatures['cup'], wall: number) {
  const sim = cup.simulation;
  if (!sim) return 0;
  if (cup.matchPaused) return sim.time;
  const scale = 5400 / getCupRegularDurationMs(cup), end = sim.buffer.at(-1)?.end ?? sim.time;
  return Math.max(0, Math.min(end, (wall - cup.matchStartedAt) * scale));
}

/**
 * Plays the stadium while a match runs: crowd, whistles, cheers and chants follow what the pitch shows.
 * Renders nothing. `sound` is the game's sound switch.
 */
export function MatchAudio({ features, now, sound }: { features: GameFeatures; now: number; sound: boolean }) {
  const latest = useRef({ features, offset: 0, sound });
  useEffect(() => { latest.current = { features, offset: now - Date.now(), sound }; }, [features, now, sound]);
  // The key stays the same when the match ends, so the final whistle still plays before the sound stops.
  const cup = features.cup, matchKey = cup.matchStartedAt ? `${cup.careerMatchId ?? ''}:${cup.matchStartedAt}` : '';

  useEffect(() => {
    if (!matchKey || !latest.current.features.cup.active) return;
    const ctx = gameAudioContext();
    if (!ctx) return;
    const engine = new StadiumAudio(ctx, crowdSize(matchStadium(latest.current.features).attendance));
    void engine.start();
    // Browsers keep audio muted until a tap; resume on the next one.
    const unlock = () => { if (ctx.state === 'suspended') void ctx.resume().catch(() => {}); };
    document.addEventListener('pointerdown', unlock);
    const startCup = latest.current.features.cup;
    let lastTime = presentedTime(startCup, Date.now() + latest.current.offset), lastWall = Date.now() + latest.current.offset;
    let kicked = lastTime > 1, half = lastTime >= 2700, secondHalf = lastTime > 2701, ended = false, lastEventAt = Date.now(), nextChantAt = Date.now() + 25000 + Math.random() * 30000;
    let stopTimer: number | undefined;
    const tick = () => {
      const { features: f, offset, sound: on } = latest.current, c = f.cup, wall = Date.now() + offset;
      engine.setEnabled(on && document.visibilityState === 'visible');
      const cues: SoundCue[] = [];
      if (!c.active || (c.careerMatchId ?? '') !== (startCup.careerMatchId ?? '') || c.matchStartedAt !== startCup.matchStartedAt) {
        if (!ended && !c.active && c.matchStartedAt === startCup.matchStartedAt) cues.push({ kind: 'fulltime' });
        if (!ended) { ended = true; stopTimer = window.setTimeout(() => engine.stop(), 7000); }
      } else if (c.simulation) {
        const time = presentedTime(c, wall), sim = c.simulation;
        if (!kicked && time > .5) { kicked = true; cues.push({ kind: 'kickoff' }); }
        if (!half && time >= 2700) { half = true; cues.push({ kind: 'halftime' }); }
        if (half && !secondHalf && time > 2701 && !c.matchPaused) { secondHalf = true; cues.push({ kind: 'kickoff' }); }
        if (time > lastTime) cues.push(...simulationCues([...sim.recent, ...sim.buffer], lastTime, time, homeTeamOf(c)));
        const current = [...sim.recent, ...sim.buffer].find((a) => a.start <= time && a.end > time);
        if (current) engine.setIntensity(1 - Math.min(1, Math.min(current.to.x, 105 - current.to.x) / 35));
        lastTime = Math.max(lastTime, time);
      } else {
        if (!kicked) { kicked = true; if (wall - c.matchStartedAt < 4000) cues.push({ kind: 'kickoff' }); }
        const pause = c.timedPause;
        if (!half && pause?.kind === 'halftime' && wall >= pause.startsAt) { half = true; cues.push({ kind: 'halftime' }); }
        if (half && !secondHalf && pause?.kind === 'halftime' && wall >= pause.endsAt) { secondHalf = true; cues.push({ kind: 'kickoff' }); }
        cues.push(...legacyCues(c, lastWall, wall));
      }
      lastWall = wall;
      for (const cue of cues) engine.cue(cue);
      if (cues.some((cue) => cue.kind !== 'foul')) lastEventAt = Date.now();
      // The home end sings now and then when nothing else happens.
      if (!ended && Date.now() > nextChantAt) {
        if (Date.now() - lastEventAt > 8000 && !c.matchPaused) engine.chant();
        nextChantAt = Date.now() + 35000 + Math.random() * 45000;
      }
    };
    const timer = window.setInterval(tick, 150);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('pointerdown', unlock);
      if (stopTimer !== undefined) window.clearTimeout(stopTimer);
      engine.stop();
    };
  }, [matchKey]);
  return null;
}
