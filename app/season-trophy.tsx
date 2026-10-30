"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "./confirm-dialog";
import { GOAL_CONFETTI, GOLD_CONFETTI } from "./game/constants";
import { SEASON_MODE_DIVISION_COUNT, getSeasonModeDivisionLabel, sortSeasonTable } from "./feature-data";
import type { SeasonMatchHistoryEntry, SeasonTableRow } from "./feature-data";

export type SeasonTitle = { id: string; division: number; club: SeasonTableRow; runnerUpPoints: number };

/** The league title of a finished season: the club ended first in the final table. Null for any other place. */
export function getSeasonTitle(entry: SeasonMatchHistoryEntry | null, finalTable: readonly SeasonTableRow[]): SeasonTitle | null {
  if (!entry?.completedSeason) return null;
  const rows = sortSeasonTable(finalTable);
  if (rows[0]?.id !== "club") return null;
  return { id: entry.id, division: entry.division, club: rows[0], runnerUpPoints: rows[1]?.points ?? 0 };
}

/** The trophy celebration after a league title; in Liga 1 the title also opens the Hall of Fame. */
export function SeasonTrophyCelebration({ title, clubName, onClose }: { title: SeasonTitle; clubName: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef, onClose);
  const hallOfFame = title.division >= SEASON_MODE_DIVISION_COUNT;
  const { club } = title;
  const lead = club.points - title.runnerUpPoints;
  return createPortal(<div className={`season-trophy${hallOfFame ? " hall-of-fame" : ""}`} role="presentation">
    <div className="season-trophy-rays" aria-hidden="true" />
    <div className="season-trophy-confetti" aria-hidden="true">{GOAL_CONFETTI.map((particle, index) => <i key={index} style={{ left: particle.left, animationDelay: `${700 + index * 35}ms`, animationDuration: particle.duration, background: GOLD_CONFETTI[index % GOLD_CONFETTI.length] }} />)}</div>
    <div ref={dialogRef} className="season-trophy-card" role="dialog" aria-modal="true" aria-labelledby="season-trophy-title" aria-describedby="season-trophy-detail">
      <svg className="season-trophy-cup" viewBox="0 0 120 140" aria-hidden="true">
        <defs>
          <linearGradient id="season-trophy-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff4bd" /><stop offset=".45" stopColor="#f6c94c" /><stop offset="1" stopColor="#b8820f" /></linearGradient>
          <linearGradient id="season-trophy-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
          <clipPath id="season-trophy-body"><path d="M28 14h64v26c0 22-14 38-32 40-18-2-32-18-32-40z" /></clipPath>
        </defs>
        <path d="M28 22H12c0 20 9 31 22 32M92 22h16c0 20-9 31-22 32" fill="none" stroke="url(#season-trophy-gold)" strokeWidth="7" strokeLinecap="round" />
        <path d="M28 14h64v26c0 22-14 38-32 40-18-2-32-18-32-40z" fill="url(#season-trophy-gold)" />
        <rect className="season-trophy-shine" x="-40" y="0" width="34" height="90" fill="url(#season-trophy-shine)" clipPath="url(#season-trophy-body)" transform="skewX(-18)" />
        <path d="M60 30l4.4 9 9.9 1.4-7.2 7 1.7 9.8L60 52.6l-8.8 4.6 1.7-9.8-7.2-7 9.9-1.4z" fill="#fff8d6" opacity=".9" />
        <path d="M53 80h14l3 20H50z" fill="url(#season-trophy-gold)" />
        <rect x="38" y="100" width="44" height="10" rx="3" fill="url(#season-trophy-gold)" />
        <rect x="30" y="110" width="60" height="18" rx="4" fill="#2b2110" />
        <rect x="40" y="115" width="40" height="8" rx="2" fill="url(#season-trophy-gold)" opacity=".9" />
      </svg>
      <p className="season-trophy-eyebrow">{hallOfFame ? "HALL OF FAME · MEISTER" : "MEISTER"} · {getSeasonModeDivisionLabel(title.division).toUpperCase()}</p>
      <h2 id="season-trophy-title">{clubName} holt den Titel!</h2>
      <p id="season-trophy-detail">{club.points} {club.points === 1 ? "Punkt" : "Punkte"} · {club.wins} {club.wins === 1 ? "Sieg" : "Siege"}, {club.draws} Remis, {club.losses} {club.losses === 1 ? "Niederlage" : "Niederlagen"} · {club.goalsFor}:{club.goalsAgainst} Tore{lead > 0 ? ` · ${lead} ${lead === 1 ? "Punkt" : "Punkte"} Vorsprung` : ""}</p>
      <p className="season-trophy-note">{hallOfFame ? "Meister der Weltliga: Dein Club steht für immer in der Hall of Fame." : "Platz 1 bringt den Aufstieg: Nächste Saison spielt dein Club eine Liga höher."}</p>
      <button type="button" className="season-trophy-close" onClick={onClose}>Weiter</button>
    </div>
  </div>, document.body);
}
