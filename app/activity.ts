"use client";
// Whether somebody is actually at this tab. A tab that is hidden, or visible but untouched for AWAY_AFTER_MS,
// sends no background requests at all: no multiplayer ticks, no world list, no journey sync and no periodic cloud
// save. A forgotten open tab would otherwise poll every 1.5 seconds around the clock, which keeps the Neon compute
// awake (it only suspends after 5 minutes without queries) and uses up the free Netlify and Neon budgets within days.
// The first tap, click, key press or scroll brings everything back at once.

/** Without any input for this long a visible tab counts as away. */
export const AWAY_AFTER_MS = 10 * 60_000;

let lastInputAt = Date.now();
let installed = false;
const returnListeners = new Set<() => void>();

function markInput() {
  const wasAway = Date.now() - lastInputAt >= AWAY_AFTER_MS;
  lastInputAt = Date.now();
  if (wasAway) for (const listener of returnListeners) listener();
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  for (const event of ["pointerdown", "keydown", "wheel", "touchstart"] as const) window.addEventListener(event, markInput, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") markInput(); });
}

/** True when the tab is hidden or nobody touched it for AWAY_AFTER_MS. Background requests are skipped then. */
export function isAway(now = Date.now()) {
  install();
  if (typeof document === "undefined") return false;
  return document.visibilityState !== "visible" || now - lastInputAt >= AWAY_AFTER_MS;
}

/** Calls `listener` when the player comes back after being away; returns the unsubscribe function. */
export function onReturn(listener: () => void) {
  install();
  returnListeners.add(listener);
  return () => { returnListeners.delete(listener); };
}

export function markInputForTests(at: number) {
  lastInputAt = at;
}
