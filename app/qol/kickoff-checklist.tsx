"use client";

import { t } from "../i18n/runtime";

/** One thing to settle before the next kick off, with the button that settles it when there is one. */
export type KickoffItem = { id: string; text: string; tone?: "block" | "hint"; fix?: { label: string; run: () => void } };

/** t("qol.beforeKickoff"): every blocker at once instead of one toast per attempt (Q25), plus reminders like the press. */
export function KickoffChecklist({ items, busy }: { items: readonly KickoffItem[]; busy: boolean }) {
  if (!items.length) return null;
  return <section className="kickoff-checklist" aria-label={t("qol.beforeKickoff")}>
    <p className="eyebrow">{t("qol.beforeKickoffCaps")}</p>
    <ul>{items.map((item) => <li key={item.id} className={item.tone ?? "block"}>
      <span aria-hidden="true">{item.tone === "hint" ? "💡" : "⚠️"}</span>
      <span className="kickoff-text">{item.text}</span>
      {item.fix && <button type="button" className="mode-secondary" disabled={busy} onClick={item.fix.run}>{item.fix.label}</button>}
    </li>)}</ul>
  </section>;
}
