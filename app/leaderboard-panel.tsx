"use client";

import { useEffect, useState } from "react";
import type { LeaderboardSort } from "../db";
import type { LeaderboardEntry } from "./leaderboard-api";
import { formatNumber } from "./game/format";
import { t } from "./i18n/runtime";

// Built when shown (not at import), so the labels follow the current language.
const sorts = (): { id: LeaderboardSort; label: string }[] => [
  { id: "goals", label: t("leaderboard.goals") },
  { id: "league", label: t("leaderboard.league") },
  { id: "trophies", label: t("leaderboard.trophies") },
];

function value(entry: LeaderboardEntry, sort: LeaderboardSort) {
  if (sort === "league") return t("leaderboard.leagueN", { bestLeague: entry.bestLeague });
  if (sort === "trophies") return t("leaderboard.trophyCount", { count: entry.trophies });
  return t("leaderboard.totalGoals", { totalGoals: formatNumber(entry.totalGoals) });
}

/** The best co-op worlds; loads when the tab opens and again for each sort. */
export function LeaderboardPanel({ playerId }: { playerId: string }) {
  const [sort, setSort] = useState<LeaderboardSort>("goals");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ sort: LeaderboardSort; entries: LeaderboardEntry[] } | { sort: LeaderboardSort; error: string } | null>(null);

  useEffect(() => {
    if (!playerId) return;
    const controller = new AbortController();
    void fetch(`/api/leaderboard?${new URLSearchParams({ sort, playerId })}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { entries?: LeaderboardEntry[]; error?: string };
        setState(response.ok && data.entries ? { sort, entries: data.entries } : { sort, error: data.error ?? t("leaderboard.unreachable") });
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ sort, error: error instanceof Error && error.name === "TypeError" ? t("leaderboard.offline") : t("leaderboard.unreachable") }); });
    return () => controller.abort();
  }, [playerId, sort, attempt]);

  const current = state?.sort === sort ? state : null;
  const retry = () => { setState(null); setAttempt((value) => value + 1); };
  return <div className="feature-panel leaderboard-panel">
    <div className="feature-panel-heading"><div><p className="eyebrow">{t("leaderboard.eyebrow")}</p><h3>{t("leaderboard.bestWorlds")}</h3></div></div>
    <p className="leaderboard-note">{t("leaderboard.onlyCoop")}</p>
    <div className="leaderboard-sorts" role="radiogroup" aria-label={t("leaderboard.sortBy")}>
      {sorts().map((option) => <button key={option.id} type="button" role="radio" aria-checked={sort === option.id} className={sort === option.id ? "active" : ""} onClick={() => setSort(option.id)}>{option.label}</button>)}
    </div>
    {!playerId && <p className="leaderboard-empty">{t("leaderboard.noProfile")}</p>}
    {playerId && !current && <p className="leaderboard-empty" aria-live="polite">{t("leaderboard.loading")}</p>}
    {current && "error" in current && <div className="leaderboard-empty" role="alert"><p>{current.error}</p><button type="button" className="mode-secondary" onClick={retry}>{t("leaderboard.retry")}</button></div>}
    {current && "entries" in current && (current.entries.length ? <ol className="leaderboard-list">
      {current.entries.map((entry) => <li key={`${entry.rank}-${entry.roomName}`} className={entry.mine ? "mine" : ""}>
        <b className="leaderboard-rank">{entry.rank}</b>
        <span><strong>{entry.roomName}{entry.mine && <em> {t("leaderboard.yourWorld")}</em>}</strong><small>{entry.players.join(", ")}</small></span>
        <b className="leaderboard-value">{value(entry, sort)}</b>
      </li>)}
    </ol> : <p className="leaderboard-empty">{t("leaderboard.empty")}</p>)}
  </div>;
}
