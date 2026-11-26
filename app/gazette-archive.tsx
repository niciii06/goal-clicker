"use client";
// The Goal Gazette archive of the «Verlauf» tab, moved out of game-app.tsx (Notion: Monolithische UI schrittweise
// modularisieren, step 3). Stored front pages stay German; headline, strapline and body follow the chosen language
// through localizeText (catalog entries for the headlines, history.gazette* patterns for the generated lines).
import { memo, useMemo } from "react";
import { getTournament } from "./feature-data";
import type { TournamentGazetteIssue } from "./features/types";
import { formatHistoryTime } from "./game/format";
import { dataText } from "./i18n/data-text";
import { localizeText, t } from "./i18n/runtime";

export function gazetteText(issue: Pick<TournamentGazetteIssue, "headline" | "strapline" | "body">) {
  return { headline: localizeText(issue.headline), strapline: localizeText(issue.strapline), body: localizeText(issue.body) };
}

export const GazetteArchive = memo(function GazetteArchive({ issues }: { issues: readonly TournamentGazetteIssue[] }) {
  const recent = useMemo(() => [...issues].reverse(), [issues]);
  if (!recent.length) return null;
  return <section className="gazette-archive">
    <div className="gazette-archive-heading"><div><p className="eyebrow">{t("club.gazetteArchive")}</p><h3>{t("club.frontPages")}</h3></div><span>{recent.length} {t("club.spending")}</span></div>
    <div>{recent.map((issue) => { const text = gazetteText(issue); return <article className={issue.tone} key={`gazette-archive-${issue.id}`}>
      <small>{dataText(getTournament(issue.tournamentId)?.label) || t("club.tournament")} · {formatHistoryTime(issue.createdAt)}</small>
      <strong>{text.headline}</strong><p>{text.strapline}</p>
    </article>; })}</div>
  </section>;
});
