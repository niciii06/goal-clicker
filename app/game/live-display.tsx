"use client";
// Render isolation for the ball (audit P09): the combo meter, the floating numbers and the ball pulse change
// many times per second while clicking and while a combo drains. They live in this small store, so only the
// pieces below re-render instead of the whole App. Markup and texts are unchanged.
import { useSyncExternalStore } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { COMBO_LEVELS } from "./constants";
import { formatComboMultiplier, getComboLevel, getComboProgress } from "./economy";
import { formatNumber } from "./format";
import type { ClickEffect } from "./types";
import { FootballGraphic } from "./ui";
import type { PassiveGoalsStore } from "./live-goals";

type Listener = () => void;
export type ComboDisplay = { count: number; multiplier: number };
export type ComboBurst = { id: number; text: string } | null;
export type ClickFeedbackState = { effects: ClickEffect[]; pulse: boolean; combo: ComboDisplay; burst: ComboBurst };

export type ClickFeedbackStore = ReturnType<typeof createClickFeedbackStore>;

export function createClickFeedbackStore() {
  let state: ClickFeedbackState = { effects: [], pulse: false, combo: { count: 0, multiplier: 1 }, burst: null };
  const listeners = new Set<Listener>();
  const update = (next: Partial<ClickFeedbackState>) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  };
  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    get: () => state,
    setCombo(combo: ComboDisplay) {
      if (combo.count === state.combo.count && combo.multiplier === state.combo.multiplier) return;
      update({ combo });
    },
    setBurst(burst: ComboBurst | ((current: ComboBurst) => ComboBurst)) {
      const next = typeof burst === "function" ? burst(state.burst) : burst;
      if (next !== state.burst) update({ burst: next });
    },
    addEffect(effect: ClickEffect) { update({ effects: [...state.effects, effect] }); },
    removeEffect(id: number) {
      if (state.effects.some((item) => item.id === id)) update({ effects: state.effects.filter((item) => item.id !== id) });
    },
    togglePulse() { update({ pulse: !state.pulse }); },
  };
}

function useFeedback(store: ClickFeedbackStore) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function ClickBallButton({ store, coop, onClick, onKeyDown }: { store: ClickFeedbackStore; coop: boolean; onClick: (event: MouseEvent<HTMLButtonElement>) => void; onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void }) {
  const { pulse, combo } = useFeedback(store);
  const comboLevel = getComboLevel(combo.count);
  return <button type="button" className={`ball-button${pulse ? " hit" : ""}${comboLevel.tier > 1 ? ` combo-${comboLevel.tier}` : ""}`} onClick={onClick} onKeyDown={onKeyDown} aria-label={coop ? "Team-Ball anklicken" : "Fussball anklicken"}><span className="ball-aura" /><FootballGraphic /></button>;
}

export function FloatingClickNumbers({ store }: { store: ClickFeedbackStore }) {
  const { effects } = useFeedback(store);
  return <div className="floating-layer">{effects.map((effect) => <span className={`floating-number${effect.critical ? " critical" : ""}${effect.combo > 1 ? ` combo-${effect.combo}` : ""}`} key={effect.id} style={{ left: effect.x, top: effect.y }}>{effect.critical ? `CRIT! +${formatNumber(effect.amount)}` : `+${formatNumber(effect.amount)}`}</span>)}</div>;
}

export function ComboMeter({ store, paused }: { store: ClickFeedbackStore; paused: boolean }) {
  const { combo, burst } = useFeedback(store);
  const comboLevel = getComboLevel(combo.count);
  const nextComboLevel = COMBO_LEVELS.find((level) => level.clicks > combo.count);
  return <>
    <div className={`combo-meter level-${comboLevel.tier}${combo.count > 1 ? " active" : ""}`}><span className="combo-label">{paused && combo.count > 1 ? `Combo pausiert${combo.multiplier > 1 ? ` · ${formatComboMultiplier(combo.multiplier)}` : ""}` : combo.multiplier > 1 ? `COMBO ${formatComboMultiplier(combo.multiplier)}` : combo.count > 1 ? `${combo.count} Klicks` : "Schnell klicken für Combo"}</span><span className="combo-track"><i style={{ width: `${Math.round(getComboProgress(combo.count) * 100)}%` }} /></span><small>{nextComboLevel ? `Nächste Stufe: ${formatComboMultiplier(nextComboLevel.multiplier)}` : "Maximum erreicht"}</small></div>
    {burst && <div className={`combo-burst${burst.text === "Combo vorbei" ? " ended" : ""}`} key={burst.id} aria-hidden="true">{burst.text}</div>}
  </>;
}

/** The goal counter: follows the store on every passive tick; `fixed` is shown instead (co-op world, test money). */
export function LiveGoalCount({ store, fixed }: { store: PassiveGoalsStore; fixed: string | null }) {
  const goals = useSyncExternalStore(store.subscribe, store.getDisplay, store.getDisplay);
  return <>{fixed ?? formatNumber(goals)}</>;
}
