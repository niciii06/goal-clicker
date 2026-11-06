// Render isolation for the goal counter (audit P09). The passive tick runs five times per second; instead of
// committing every tick to the App state (a full App render each time), ticks collect here and reach the state
// about once per second or right before any other game update, so nothing is earned differently. The counter
// on screen subscribes to this store and still moves with every tick.
import type { GameState } from "./types";

type Listener = () => void;

/** The same three totals one passive tick has always raised. */
export function addPassiveGoals<T extends Pick<GameState, "goals" | "seasonGoals" | "totalGoals">>(game: T, amount: number): T {
  if (!amount) return game;
  return { ...game, goals: game.goals + amount, seasonGoals: game.seasonGoals + amount, totalGoals: game.totalGoals + amount };
}

export type PassiveGoalsStore = ReturnType<typeof createPassiveGoalsStore>;

export function createPassiveGoalsStore(initialGoals = 0) {
  let pending = 0;
  let display = initialGoals;
  const listeners = new Set<Listener>();
  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    /** The exact current goals of the local club (state plus ticks not committed yet). */
    getDisplay: () => display,
    setDisplay(goals: number) {
      if (goals === display) return;
      display = goals;
      for (const listener of listeners) listener();
    },
    /** Passive goals earned but not yet in the React state. */
    getPending: () => pending,
    addPending(amount: number) { pending += amount; },
    /** Hands the uncommitted goals to the caller, who must add them to the state. */
    takePending() {
      const amount = pending;
      pending = 0;
      return amount;
    },
  };
}
