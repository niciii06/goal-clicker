"use client";
import { useEffect, useRef, useState, type AnimationEvent } from "react";
import { useReducedMotion } from "./use-reduced-motion";
import { WalkoutFigure, walkoutFigureClasses, walkoutFigureStyle } from "./walkout-figure";
import type { WalkoutPresentation } from "./walkout-data";

/** Where the walk of the stage timeline (star-avatar-walk-late) shows the player and where he arrives. */
const APPEAR_AT = 0.47;
const ARRIVE_AT = 0.72;
const CELEBRATE_AFTER_S = 0.5;

/**
 * The player of a walkout: a rigged 3D character walking out of the tunnel (walkout-3d.ts, loaded on demand).
 * The wrap keeps the stage animation that unlocks the continue button; until the 3D scene is ready, or on
 * devices without WebGL, it shows the drawn figure instead.
 */
export function WalkoutAvatar({ presentation, rating, label, durationMs, elapsedMs, onAnimationEnd }: { presentation: WalkoutPresentation; rating: number; label: string; durationMs: number; elapsedMs: number; onAnimationEnd?: (event: AnimationEvent<HTMLDivElement>) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const reducedMotion = useReducedMotion();
  // The stage clock: fixed when the walkout mounts, like the CSS animations it runs beside.
  const clockRef = useRef<{ mountedAt: number; elapsedMs: number } | null>(null);
  const lookKey = `${JSON.stringify(presentation)}|${rating}`;

  useEffect(() => {
    let disposed = false;
    let scene: { dispose: () => void } | null = null;
    const canvas = canvasRef.current;
    clockRef.current ??= { mountedAt: performance.now(), elapsedMs };
    const clock = clockRef.current;
    if (!canvas) return;
    import("./walkout-3d")
      .then(async ({ createWalkout3D }) => {
        if (disposed) return;
        const stageSeconds = (clock.elapsedMs + performance.now() - clock.mountedAt) / 1000;
        const appearAt = (durationMs * APPEAR_AT) / 1000 - stageSeconds;
        const arriveAt = (durationMs * ARRIVE_AT) / 1000 - stageSeconds;
        const created = await createWalkout3D(canvas, presentation, rating, { appearAt, arriveAt, celebrateAt: arriveAt + CELEBRATE_AFTER_S }, reducedMotion);
        if (disposed) { created.dispose(); return; }
        scene = created;
        setReady(true);
      })
      .catch(() => { /* No WebGL or the models did not load: the drawn figure stays. */ });
    return () => {
      disposed = true;
      scene?.dispose();
      setReady(false);
    };
    // Only a new player restarts the scene; the countdown re-renders every second with fresh but equal props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey, reducedMotion]);

  return <>
    <canvas ref={canvasRef} className={`star-walkout-3d${ready ? " ready" : ""}`} aria-hidden="true" />
    <div className={`star-walkout-avatar-wrap ${walkoutFigureClasses(presentation)}${ready ? " is-3d" : ""}`} style={walkoutFigureStyle(presentation)} role="img" aria-label={label} onAnimationEnd={onAnimationEnd}>
      {!ready && <WalkoutFigure presentation={presentation} rating={rating} />}
    </div>
  </>;
}
