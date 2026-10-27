"use client";

import { useEffect, useState } from "react";
import type { LeaderboardSort } from "../db";
import type { LeaderboardEntry } from "./leaderboard-api";
import { formatNumber } from "./game/format";

const SORTS: { id: LeaderboardSort; label: string }[] = [
  { id: "goals", label: "Tore" },
  { id: "league", label: "Liga" },
  { id: "trophies", label: "Trophäen" },
];

function value(entry: LeaderboardEntry, sort: LeaderboardSort) {
  if (sort === "league") return `Liga ${entry.bestLeague}`;
  if (sort === "trophies") return `${entry.trophies} ${entry.trophies === 1 ? "Trophäe" : "Trophäen"}`;
  return `${formatNumber(entry.totalGoals)} Tore`;
}

/** The best co-op worlds; loads when the tab opens and again for each sort. */
export function LeaderboardPanel({ playerId }: { playerId: string }) {
  const [sort, setSort] = useState<LeaderboardSort>("goals");
  const [state, setState] = useState<{ sort: LeaderboardSort; entries: LeaderboardEntry[] } | { sort: LeaderboardSort; error: string } | null>(null);

  useEffect(() => {
    if (!playerId) return;
    const controller = new AbortController();
    void fetch(`/api/leaderboard?${new URLSearchParams({ sort, playerId })}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { entries?: LeaderboardEntry[]; error?: string };
        setState(response.ok && data.entries ? { sort, entries: data.entries } : { sort, error: data.error ?? "Die Rangliste ist gerade nicht erreichbar." });
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ sort, error: error instanceof Error && error.name === "TypeError" ? "Keine Verbindung." : "Die Rangliste ist gerade nicht erreichbar." }); });
    return () => controller.abort();
  }, [playerId, sort]);

  const current = state?.sort === sort ? state : null;
  return <div className="feature-panel leaderboard-panel">
    <div className="feature-panel-heading"><div><p className="eyebrow">KOOP WELTEN / RANGLISTE</p><h3>Die besten Welten.</h3></div></div>
    <p className="leaderboard-note">Hier zählen nur Koop Welten, weil der Server ihre Tore, Ligen und Trophäen selbst berechnet.</p>
    <div className="leaderboard-sorts" role="radiogroup" aria-label="Rangliste sortieren nach">
      {SORTS.map((option) => <button key={option.id} type="button" role="radio" aria-checked={sort === option.id} className={sort === option.id ? "active" : ""} onClick={() => setSort(option.id)}>{option.label}</button>)}
    </div>
    {!current && <p className="leaderboard-empty" aria-live="polite">Rangliste wird geladen …</p>}
    {current && "error" in current && <p className="leaderboard-empty" role="alert">{current.error}</p>}
    {current && "entries" in current && (current.entries.length ? <ol className="leaderboard-list">
      {current.entries.map((entry) => <li key={`${entry.rank}-${entry.roomName}`} className={entry.mine ? "mine" : ""}>
        <b className="leaderboard-rank">{entry.rank}</b>
        <span><strong>{entry.roomName}{entry.mine && <em> · Deine Welt</em>}</strong><small>{entry.players.join(", ")}</small></span>
        <b className="leaderboard-value">{value(entry, sort)}</b>
      </li>)}
    </ol> : <p className="leaderboard-empty">Noch keine Welt hat Tore gesammelt. Starte eine Koop Welt und hol dir Platz 1.</p>)}
  </div>;
}
