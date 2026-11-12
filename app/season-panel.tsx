"use client";

import { useEffect, useRef, useState } from "react";

import { getSeasonModeDivisionLabel, getSeasonSchedule, SEASON_MODE_DIVISION_COUNT, SEASON_MODE_MATCHES_PER_SEASON, sortSeasonTable } from "./feature-data";
import type { GameFeatures, SeasonResult, SeasonScheduleMatch, SeasonTableRow } from "./feature-data";
import { getStarXIPlayer } from "./feature-data";
import { formMatchLabel, formMatches, promotionOutlook, seasonTopScorers } from "./qol/season-insights";

type FormTip = { key: string; text: string; left: number; top: number };

/**
 * The league table. Columns: # Club Sp S U N Tore +/- Form Pkt (points last). Every form box (S, U, N) names its match
 * on hover, keyboard focus or tap. The tip sits outside the horizontally scrolling table, so it is never cut off.
 */
function StandingsTable({ table, results, division, caption }: { table: readonly SeasonTableRow[]; results: readonly SeasonResult[]; division: number; caption: string }) {
  const rows = sortSeasonTable(table, results), top = division >= SEASON_MODE_DIVISION_COUNT;
  const nameOf = (teamId: string) => table.find((team) => team.id === teamId)?.name ?? "Unbekannt";
  const shellRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<FormTip | null>(null);
  useEffect(() => {
    if (!tip) return;
    const close = (event: Event) => { if (event.type !== "pointerdown" || !(event.target as Element | null)?.closest?.(".season-form-chip")) setTip(null); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setTip(null); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", onKey); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [tip]);
  function show(button: HTMLElement, key: string, text: string) {
    const shell = shellRef.current;
    if (!shell) return;
    const box = button.getBoundingClientRect(), outer = shell.getBoundingClientRect();
    const half = Math.min(120, outer.width / 2);
    setTip({ key, text, left: Math.min(Math.max(box.left + box.width / 2 - outer.left, half), outer.width - half), top: box.top - outer.top });
  }
  return <div className="season-hub-table-shell" ref={shellRef}>
    <div className="season-hub-table-wrap">
    <table className="season-hub-table">
      <caption>{caption}</caption>
      <thead><tr><th scope="col">#</th><th scope="col">Club</th><th scope="col" title="Spiele">Sp</th><th scope="col" title="Siege">S</th><th scope="col" title="Unentschieden">U</th><th scope="col" title="Niederlagen">N</th><th scope="col">Tore</th><th scope="col" title="Tordifferenz">+/-</th><th scope="col" className="season-form-head">Form</th><th scope="col" title="Punkte">Pkt</th></tr></thead>
      <tbody>{rows.map((team, index) => {
        const zone = top ? (index === 0 ? "hall-of-fame" : index >= rows.length - 2 ? "relegation" : "") : index < 2 ? "promotion" : index >= rows.length - 2 && division > 1 ? "relegation" : "";
        const diff = team.goalsFor - team.goalsAgainst;
        const form = formMatches(team.id, results);
        return <tr key={team.id} className={`${zone}${team.id === "club" ? " club" : ""}`}>
          <td>{index + 1}</td><th scope="row">{team.name}</th><td>{team.played}</td><td>{team.wins}</td><td>{team.draws}</td><td>{team.losses}</td><td>{team.goalsFor}:{team.goalsAgainst}</td><td>{diff > 0 ? `+${diff}` : diff}</td>
          <td className="season-form" role="group" aria-label={form.length ? `Form von ${team.name}` : `Form von ${team.name}: noch keine Spiele`}>{form.map((match) => {
            const key = `${team.id}:${match.matchday}`, text = formMatchLabel(match, nameOf);
            return <button type="button" key={key} className={`season-form-chip form-${match.letter}`} aria-label={`${match.letter === "S" ? "Sieg" : match.letter === "U" ? "Unentschieden" : "Niederlage"}: ${text}`} aria-describedby={tip?.key === key ? "season-form-tip" : undefined}
              onMouseEnter={(event) => show(event.currentTarget, key, text)} onMouseLeave={() => setTip((current) => current?.key === key ? null : current)}
              onFocus={(event) => show(event.currentTarget, key, text)} onBlur={() => setTip((current) => current?.key === key ? null : current)}
              onClick={(event) => { if (tip?.key === key) setTip(null); else show(event.currentTarget, key, text); }}>{match.letter}</button>;
          })}</td>
          <td><b>{team.points}</b></td>
        </tr>;
      })}</tbody>
    </table>
    </div>
    {tip && <div id="season-form-tip" role="tooltip" className="season-form-tip" style={{ left: tip.left, top: tip.top }}>{tip.text}</div>}
    <p className="season-hub-legend"><span className={top ? "hall-of-fame" : "promotion"}>{top ? "Platz 1: Hall of Fame" : "Platz 1 und 2: Aufstieg"}</span>{division > 1 && <span className="relegation">Platz 5 und 6: Abstieg</span>}<small className="season-hub-tie-break">Bei gleich vielen Punkten zählen Tordifferenz, erzielte Tore und danach die direkten Begegnungen.</small></p>
  </div>;
}

function MatchLine({ match }: { match: SeasonScheduleMatch }) {
  const played = match.homeScore !== undefined && match.awayScore !== undefined;
  return <li className={match.club ? "club" : undefined}>
    <span className={match.homeId === "club" ? "own" : undefined}>{match.home}</span>
    <b>{played ? `${match.homeScore}:${match.awayScore}` : "–:–"}</b>
    <span className={match.awayId === "club" ? "own" : undefined}>{match.away}</span>
  </li>;
}

/** Season tab: the table, the club's remaining matches and every matchday of the league. */
export function SeasonPanel({ features, action }: { features: GameFeatures; /** Q46: start the next match or Prestige right here. */ action?: { label: string; disabled: boolean; note?: string; onClick: () => void } }) {
  const season = features.seasonMode, schedule = getSeasonSchedule(season);
  const next = schedule.filter((day) => !day.played);
  const opponentRating = (id: string) => season.table.find((team) => team.id === id)?.rating;
  // The season awards already count on to the next season; the Hall of Fame season is the one before.
  const seasonLabel = season.hallOfFame ? Math.max(1, features.career.seasonNumber - 1) : features.career.seasonNumber;
  const showLastSeason = season.matchday === 0 && season.lastMatchAt > 0 && season.lastTable.some((team) => team.played > 0) && !season.hallOfFame;
  return <div className="feature-panel season-hub">
    <div className="feature-panel-heading"><div><p className="eyebrow">SAISON {seasonLabel} / {getSeasonModeDivisionLabel(season.division).toUpperCase()}</p><h3>{season.hallOfFame ? "Hall of Fame erreicht." : `Spieltag ${season.matchday + 1} von ${SEASON_MODE_MATCHES_PER_SEASON}`}</h3></div></div>
    {action && <div className="season-hub-action"><button type="button" className="mode-primary" disabled={action.disabled} onClick={action.onClick}>{action.label}</button>{action.note && <small>{action.note}</small>}</div>}
    {!season.hallOfFame && season.table.some((team) => team.played > 0) && <p className="season-hub-outlook" role="status">{promotionOutlook(season.table, season.results ?? [], season.division)}</p>}
    <StandingsTable table={season.table} results={season.results ?? []} division={season.division} caption="Tabelle" />
    {seasonTopScorers(features.career.seasonPlayers).length > 0 && <section className="season-hub-section" aria-label="Torschützen der Saison"><h4>Torschützen dieser Saison</h4><ol className="season-hub-scorers">{seasonTopScorers(features.career.seasonPlayers).map((entry) => <li key={entry.playerId}><strong>{getStarXIPlayer(entry.playerId)?.name ?? "Spieler"}</strong><span>{entry.goals} {entry.goals === 1 ? "Tor" : "Tore"} · {entry.assists} Vorl. · {entry.appearances} Sp.</span></li>)}</ol></section>}
    {showLastSeason && <details className="season-hub-last"><summary>Abschlusstabelle der letzten Saison</summary><StandingsTable table={season.lastTable} results={season.lastResults ?? []} division={Math.max(1, season.division - (season.history.at(-1)?.seasonOutcome === "promoted" ? 1 : season.history.at(-1)?.seasonOutcome === "relegated" ? -1 : 0))} caption="Letzte Saison" /></details>}
    <section className="season-hub-section" aria-label="Deine nächsten Spiele">
      <h4>Deine nächsten Spiele</h4>
      {next.length && !season.hallOfFame ? <ol className="season-hub-next">{next.map((day, index) => {
        const match = day.matches.find((m) => m.club)!, home = match.homeId === "club", opponentId = home ? match.awayId : match.homeId;
        return <li key={day.matchday} className={index === 0 ? "upcoming" : undefined}>
          <span className="season-hub-day">Spieltag {day.matchday}</span>
          <strong>{home ? match.away : match.home}</strong>
          <span className={`season-hub-venue ${home ? "home" : "away"}`}>{home ? "Heim" : "Auswärts"}</span>
          <span className="season-hub-rating">{opponentRating(opponentId) ? `${opponentRating(opponentId)} OVR` : ""}</span>
        </li>;
      })}</ol> : <p className="season-hub-empty">{season.hallOfFame ? "Die Saison ist abgeschlossen. Starte Prestige im Reiter Spiele." : "Alle Spiele dieser Saison sind gespielt."}</p>}
    </section>
    <section className="season-hub-section" aria-label="Alle Spieltage">
      <h4>Alle Spieltage</h4>
      {/* Only the next and the last played matchday start open (Q50); the others are one tap away. */}
      <div className="season-hub-days">{schedule.map((day) => { const next = !day.played && day.matchday === season.matchday + 1; const last = day.played && day.matchday === season.matchday; return <details key={day.matchday} className={`season-hub-day-card${next ? " next" : ""}`} open={next || last || undefined} aria-current={next ? "step" : undefined}>
        <summary><span>Spieltag {day.matchday}</span><small>{day.played ? "gespielt" : next ? "Nächstes Spiel" : "offen"}</small></summary>
        <ul>{day.matches.map((match) => <MatchLine key={`${match.homeId}-${match.awayId}`} match={match} />)}</ul>
      </details>; })}</div>
    </section>
  </div>;
}
