"use client";

import type { UpgradeGain } from "./economy-hints";
import { formatEta, paybackLabel, secondsUntilAffordable } from "./economy-hints";
import type { SavingsGoal } from "./prefs";

/** Small gains keep one decimal ("+0,4 pro s"); bigger ones use the game's number format. */
export function formatGain(value: number, format: (value: number) => string) {
  if (value <= 0) return "0";
  if (value < 10) return (Math.round(value * 10) / 10).toLocaleString("de-CH");
  return format(value);
}

/** Under an upgrade: what the next level adds, its payback, "Bester Wert", the time still to save and the pin. */
export function UpgradeHints({ gain, best, goals, passivePerSecond, pinned, onPin, format }: {
  gain: UpgradeGain; best: boolean; goals: number; passivePerSecond: number; pinned: boolean; onPin: () => void; format: (value: number) => string;
}) {
  const gainText = gain.passiveGain > 0 ? `+${formatGain(gain.passiveGain, format)} pro s` : gain.clickGain > 0 ? `+${formatGain(gain.clickGain, format)} pro Klick` : "";
  const missing = Number.isFinite(gain.cost) ? gain.cost - goals : 0;
  const eta = missing > 0 ? formatEta(secondsUntilAffordable(gain.cost, goals, passivePerSecond)) : "";
  return <span className="upgrade-hints">
    {best && <b className="best-value-chip">Bester Wert</b>}
    {gainText && <span>{gainText}{gain.paybackSeconds !== null ? ` · ${paybackLabel(gain)}` : ""}</span>}
    {missing > 0 && <span className="upgrade-savings">noch {format(missing)}{eta ? ` · ${eta}` : ""}</span>}
    {Number.isFinite(gain.cost) && <button type="button" className={`savings-pin${pinned ? " active" : ""}`} aria-pressed={pinned} onClick={onPin}>{pinned ? "Sparziel ✓" : "Als Sparziel"}</button>}
  </span>;
}

/** The pinned savings goal under the balance: progress bar, missing amount and estimate. */
export function SavingsGoalBar({ goal, label, cost, goals, passivePerSecond, onOpen, onClear, format }: {
  goal: SavingsGoal; label: string; cost: number; goals: number; passivePerSecond: number; onOpen: () => void; onClear: () => void; format: (value: number) => string;
}) {
  if (!Number.isFinite(cost) || cost <= 0) return null;
  const share = Math.max(0, Math.min(1, goals / cost));
  const reached = goals >= cost;
  const eta = formatEta(secondsUntilAffordable(cost, goals, passivePerSecond));
  return <div className={`savings-goal${reached ? " reached" : ""}`} role="group" aria-label={`Sparziel ${label}`}>
    <button type="button" className="savings-goal-main" onClick={onOpen}>
      <span><small>SPARZIEL · {goal.kind === "pack" ? "PACK" : "UPGRADE"}</small><strong>{label}</strong></span>
      <span className="savings-goal-track" aria-hidden="true"><i style={{ width: `${Math.round(share * 100)}%` }} /></span>
      <em>{reached ? "Erreicht · jetzt kaufen" : `${Math.floor(share * 100)} % · noch ${format(cost - goals)}${eta ? ` · ${eta}` : ""}`}</em>
    </button>
    <button type="button" className="savings-goal-clear" onClick={onClear} aria-label="Sparziel entfernen">×</button>
  </div>;
}
