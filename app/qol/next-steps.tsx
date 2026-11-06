"use client";

import type { OpenAction } from "./status";

const ACTION_ICONS: Record<OpenAction["id"], string> = { daily: "🎁", packs: "📦", album: "📒", journey: "🚌", press: "🎙️", weekly: "🎯", offer: "📱", prestige: "⭐", minigame: "🎮", tournament: "🏆" };

/** "Nächste Schritte" on Home: one chip per open action, each opens the place where it is done. */
export function NextStepsStrip({ actions, onOpen }: { actions: readonly OpenAction[]; onOpen: (action: OpenAction) => void }) {
  if (!actions.length) return null;
  return <nav className="next-steps" aria-label="Nächste Schritte">
    <span className="next-steps-label">NÄCHSTE SCHRITTE</span>
    <div className="next-steps-chips">{actions.map((action) => <button type="button" key={action.id} className={`next-step-chip ${action.id}`} onClick={() => onOpen(action)}><span aria-hidden="true">{ACTION_ICONS[action.id]}</span>{action.label}</button>)}</div>
  </nav>;
}
