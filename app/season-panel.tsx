"use client";

import { useEffect, useRef, useState } from "react";

import { getSeasonModeDivisionLabel, getSeasonSchedule, SEASON_MODE_DIVISION_COUNT, SEASON_MODE_MATCHES_PER_SEASON, SEASON_PROMOTION_PLACES, SEASON_RELEGATION_PLACES, sortSeasonTable } from "./feature-data";
import type { GameFeatures, SeasonResult, SeasonScheduleMatch, SeasonTableRow } from "./feature-data";
import { getStarXIPlayer } from "./feature-data";
import { formMatchLabel, formMatches, promotionOutlook, seasonTopScorers } from "./qol/season-insights";
import { t } from "./i18n/runtime";

/** `mode`: how the tip was opened. Hover and focus come and go by themselves, a tap stays until the next tap or a tap elsewhere. */
type FormTip = { key: string; text: string; left: number; top: number; mode: "hover" | "focus" | "tap" };

/**
 * The league table. Columns: # Club Sp S U N Tore +/- Form Pkt (points last). Every form box (S, U, N) names its match
 * on hover, keyboard focus or tap. The tip sits outside the horizontally scrolling table, so it is never cut off.
 */
function StandingsTable({ table, results, division, caption }: { table: readonly SeasonTableRow[]; results: readonly SeasonResult[]; division: number; caption: string }) {
  const rows = sortSeasonTable(table, results), top = division >= SEASON_MODE_DIVISION_COUNT;
  const nameOf = (teamId: string) => table.find((team) => team.id === teamId)?.name ?? t("seasonPanel.unknown");
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
  function show(button: HTMLElement, key: string, text: string, mode: FormTip["mode"]) {
    const shell = shellRef.current;
    if (!shell) return;
    const box = button.getBoundingClientRect(), outer = shell.getBoundingClientRect();
    const half = Math.min(120, outer.width / 2);
    setTip({ key, text, mode, left: Math.min(Math.max(box.left + box.width / 2 - outer.left, half), outer.width - half), top: box.top - outer.top });
  }
  return <div className="season-hub-table-shell" ref={shellRef}>
    <div className="season-hub-table-wrap">
    <table className="season-hub-table">
      <caption>{caption}</caption>
      <thead><tr><th scope="col">#</th><th scope="col">{t("seasonPanel.club")}</th><th scope="col" title={t("seasonPanel.played")}>Sp</th><th scope="col" title={t("seasonPanel.wins")}>S</th><th scope="col" title={t("seasonPanel.draws")}>U</th><th scope="col" title={t("seasonPanel.losses")}>N</th><th scope="col">{t("seasonPanel.goals")}</th><th scope="col" title={t("seasonPanel.goalDiff")}>+/-</th><th scope="col" className="season-form-head">{t("seasonPanel.form")}</th><th scope="col" title={t("seasonPanel.points")}>{t("seasonPanel.pts")}</th></tr></thead>
      <tbody>{rows.map((team, index) => {
        const zone = top ? (index === 0 ? "hall-of-fame" : index >= rows.length - SEASON_RELEGATION_PLACES ? "relegation" : "") : index < SEASON_PROMOTION_PLACES ? "promotion" : index >= rows.length - SEASON_RELEGATION_PLACES && division > 1 ? "relegation" : "";
        const diff = team.goalsFor - team.goalsAgainst;
        const form = formMatches(team.id, results);
        return <tr key={team.id} className={`${zone}${team.id === "club" ? " club" : ""}`}>
          <td>{index + 1}</td><th scope="row">{team.name}</th><td>{team.played}</td><td>{team.wins}</td><td>{team.draws}</td><td>{team.losses}</td><td>{team.goalsFor}:{team.goalsAgainst}</td><td>{diff > 0 ? `+${diff}` : diff}</td>
          <td className="season-form" role="group" aria-label={form.length ? t("seasonPanel.formOf", { name: team.name }) : t("seasonPanel.formOfNone", { name: team.name })}>{form.map((match) => {
            const key = `${team.id}:${match.matchday}`, text = formMatchLabel(match, nameOf);
            return <button type="button" key={key} className={`season-form-chip form-${match.letter}`} aria-label={`${match.letter === "S" ? "Sieg" : match.letter === "U" ? t("seasonPanel.draws") : "Niederlage"}: ${text}`} aria-describedby={tip?.key === key ? "season-form-tip" : undefined}
              onPointerEnter={(event) => { if (event.pointerType === "mouse") show(event.currentTarget, key, text, "hover"); }} onPointerLeave={(event) => { if (event.pointerType === "mouse") setTip((current) => current?.key === key && current.mode === "hover" ? null : current); }}
              onFocus={(event) => show(event.currentTarget, key, text, "focus")} onBlur={() => setTip((current) => current?.key === key ? null : current)}
              onClick={(event) => { if (tip?.key === key && tip.mode === "tap") setTip(null); else show(event.currentTarget, key, text, "tap"); }}>{match.letter}</button>;
          })}</td>
          <td><b>{team.points}</b></td>
        </tr>;
      })}</tbody>
    </table>
    </div>
    {tip && <div id="season-form-tip" role="tooltip" className="season-form-tip" style={{ left: tip.left, top: tip.top }}>{tip.text}</div>}
    <p className="season-hub-legend"><span className={top ? "hall-of-fame" : "promotion"}>{top ? t("seasonPanel.place1Hof") : t("seasonPanel.placesUp", { places: placesLabel(1, SEASON_PROMOTION_PLACES) })}</span>{division > 1 && <span className="relegation">{t("seasonPanel.placesDown", { places: placesLabel(rows.length - SEASON_RELEGATION_PLACES + 1, rows.length) })}</span>}<small className="season-hub-tie-break">{t("seasonPanel.tiebreak")}</small></p>
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
/** "1" for a single place, t("seasonPanel.fiveSix") for a range of places. */
const placesLabel = (first: number, last: number) => (first === last ? `${first}` : t("seasonPanel.firstAndLast", { first, last }));

/** The clubs that changed league after the last season, the own club included: one goes up and one goes down at every boundary. */
function AiMovesList({ moves }: { moves: NonNullable<GameFeatures["seasonMode"]["lastAiMoves"]> }) {
  const up = moves.filter((move) => move.to > move.from), down = moves.filter((move) => move.to < move.from);
  const league = (division: number) => t("seasonPanel.league", { league: 16 - division });
  const list = (items: typeof moves, label: string) => <div><h5>{label} ({items.length})</h5><ul>{items.map((move) => <li key={move.clubId}><span>{move.name}{move.clubId === "club" ? " (du)" : ""}</span><small>{league(move.from)} → {league(move.to)}</small></li>)}</ul></div>;
  return <details className="season-hub-last season-ai-moves"><summary>{t("seasonPanel.upDown")}</summary><div className="season-ai-moves-grid">{list(up, t("seasonPanel.promoted"))}{list(down, t("seasonPanel.relegated"))}</div></details>;
}

export function SeasonPanel({ features, action }: { features: GameFeatures; /** Q46: start the next match or Prestige right here. */ action?: { label: string; disabled: boolean; note?: string; onClick: () => void } }) {
  const season = features.seasonMode, schedule = getSeasonSchedule(season);
  const next = schedule.filter((day) => !day.played);
  const opponentRating = (id: string) => season.table.find((team) => team.id === id)?.rating;
  // The season awards already count on to the next season; the Hall of Fame season is the one before.
  const seasonLabel = season.hallOfFame ? Math.max(1, features.career.seasonNumber - 1) : features.career.seasonNumber;
  const showLastSeason = season.matchday === 0 && season.lastMatchAt > 0 && season.lastTable.some((team) => team.played > 0) && !season.hallOfFame;
  return <div className="feature-panel season-hub">
    <div className="feature-panel-heading"><div><p className="eyebrow">{t("seasonPanel.seasonCaps")} {seasonLabel} / {getSeasonModeDivisionLabel(season.division, season.homeCity).toUpperCase()}</p><h3>{season.hallOfFame ? t("seasonPanel.hofReached") : t("seasonPanel.matchdayOf", { matchday: season.matchday + 1, total: SEASON_MODE_MATCHES_PER_SEASON })}</h3></div></div>
    {action && <div className="season-hub-action"><button type="button" className="mode-primary" disabled={action.disabled} onClick={action.onClick}>{action.label}</button>{action.note && <small>{action.note}</small>}</div>}
    {!season.hallOfFame && season.table.some((team) => team.played > 0) && <p className="season-hub-outlook" role="status">{promotionOutlook(season.table, season.results ?? [], season.division)}</p>}
    <StandingsTable table={season.table} results={season.results ?? []} division={season.division} caption={t("seasonPanel.table")} />
    {seasonTopScorers(features.career.seasonPlayers).length > 0 && <section className="season-hub-section" aria-label={t("seasonPanel.scorersLabel")}><h4>{t("seasonPanel.scorersTitle")}</h4><ol className="season-hub-scorers">{seasonTopScorers(features.career.seasonPlayers).map((entry) => <li key={entry.playerId}><strong>{getStarXIPlayer(entry.playerId)?.name ?? t("seasonPanel.player")}</strong><span>{entry.goals} {entry.goals === 1 ? t("seasonPanel.goal") : t("seasonPanel.goals")} · {entry.assists} Vorl. · {entry.appearances} Sp.</span></li>)}</ol></section>}
    {showLastSeason && <details className="season-hub-last"><summary>{t("seasonPanel.finalTable")}</summary><StandingsTable table={season.lastTable} results={season.lastResults ?? []} division={Math.max(1, season.division - (season.history.at(-1)?.seasonOutcome === "promoted" ? 1 : season.history.at(-1)?.seasonOutcome === "relegated" ? -1 : 0))} caption={t("seasonPanel.lastSeason")} /></details>}
    {showLastSeason && (season.lastAiMoves?.length ?? 0) > 0 && <AiMovesList moves={season.lastAiMoves!} />}
    <section className="season-hub-section" aria-label={t("seasonPanel.nextMatches")}>
      <h4>{t("seasonPanel.nextMatches")}</h4>
      {next.length && !season.hallOfFame ? <ol className="season-hub-next">{next.map((day, index) => {
        const match = day.matches.find((m) => m.club)!, home = match.homeId === "club", opponentId = home ? match.awayId : match.homeId;
        return <li key={day.matchday} className={index === 0 ? "upcoming" : undefined}>
          <span className="season-hub-day">{t("seasonPanel.matchday")} {day.matchday}</span>
          <strong>{home ? match.away : match.home}</strong>
          <span className={`season-hub-venue ${home ? "home" : "away"}`}>{home ? t("seasonPanel.home") : t("seasonPanel.away")}</span>
          <span className="season-hub-rating">{opponentRating(opponentId) ? `${opponentRating(opponentId)} OVR` : ""}</span>
        </li>;
      })}</ol> : <p className="season-hub-empty">{season.hallOfFame ? t("seasonPanel.seasonDone") : t("seasonPanel.allPlayed")}</p>}
    </section>
    <section className="season-hub-section" aria-label={t("seasonPanel.allMatchdays")}>
      <h4>{t("seasonPanel.allMatchdays")}</h4>
      {/* Only the next and the last played matchday start open (Q50); the others are one tap away. */}
      <div className="season-hub-days">{schedule.map((day) => { const next = !day.played && day.matchday === season.matchday + 1; const last = day.played && day.matchday === season.matchday; return <details key={day.matchday} className={`season-hub-day-card${next ? " next" : ""}`} open={next || last || undefined} aria-current={next ? "step" : undefined}>
        <summary><span>{t("seasonPanel.matchday")} {day.matchday}</span><small>{day.played ? "gespielt" : next ? t("seasonPanel.nextMatch") : "offen"}</small></summary>
        <ul>{day.matches.map((match) => <MatchLine key={`${match.homeId}-${match.awayId}`} match={match} />)}</ul>
      </details>; })}</div>
    </section>
  </div>;
}
