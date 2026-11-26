"use client";
// The trophy room of the «Club» tab, moved out of game-app.tsx (Notion: Monolithische UI schrittweise modularisieren,
// step 3): one card per tournament with its trophy count, display only.
import { memo } from "react";
import type { CSSProperties } from "react";
import { TOURNAMENTS } from "./feature-data";
import type { TournamentId } from "./features/types";
import { dataText } from "./i18n/data-text";
import { t } from "./i18n/runtime";

export const TrophyRoom = memo(function TrophyRoom({ trophies }: { trophies: Readonly<Record<TournamentId, number>> }) {
  const total = TOURNAMENTS.reduce((sum, tournament) => sum + trophies[tournament.id], 0);
  return <section className="trophy-room" aria-label={t("club.cupsWon")}>
    <div className="trophy-room-heading"><div><p className="eyebrow">{t("club.trophyRoom")}</p><h4>{t("club.yourCups")}</h4></div><span>{total} {t("club.total")}</span></div>
    <div className="trophy-grid">{TOURNAMENTS.map((tournament) => { const count = trophies[tournament.id]; return <article className={`trophy-card${count > 0 ? " earned" : " locked"}`} key={`trophy-${tournament.id}`} style={{ "--trophy-accent": tournament.accent } as CSSProperties}>
      <span className="trophy-icon" aria-hidden="true">{tournament.trophyIcon}</span>
      <div><strong>{dataText(tournament.trophyName)}</strong><small>{count > 0 ? t("club.timesWon", { count }) : t("club.roundsToCup", { rounds: tournament.rounds })}</small></div>
      <b>{count}</b>
    </article>; })}</div>
  </section>;
});
