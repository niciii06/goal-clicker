"use client";

import { getSeasonModeDivisionLabel, getSeasonSchedule, SEASON_MODE_DIVISION_COUNT, SEASON_MODE_MATCHES_PER_SEASON, sortSeasonTable } from "./feature-data";
import type { GameFeatures, SeasonScheduleMatch, SeasonTableRow } from "./feature-data";

function StandingsTable({ table, division, caption }: { table: readonly SeasonTableRow[]; division: number; caption: string }) {
  const rows = sortSeasonTable(table), top = division >= SEASON_MODE_DIVISION_COUNT;
  return <div className="season-hub-table-wrap">
    <table className="season-hub-table">
      <caption>{caption}</caption>
      <thead><tr><th scope="col">#</th><th scope="col">Club</th><th scope="col" title="Spiele">Sp</th><th scope="col" title="Siege">S</th><th scope="col" title="Unentschieden">U</th><th scope="col" title="Niederlagen">N</th><th scope="col">Tore</th><th scope="col" title="Tordifferenz">+/-</th><th scope="col">Pkt</th></tr></thead>
      <tbody>{rows.map((team, index) => {
        const zone = index < 2 ? (top ? "hall-of-fame" : "promotion") : index >= rows.length - 2 && division > 1 ? "relegation" : "";
        const diff = team.goalsFor - team.goalsAgainst;
        return <tr key={team.id} className={`${zone}${team.id === "club" ? " club" : ""}`}>
          <td>{index + 1}</td><th scope="row">{team.name}</th><td>{team.played}</td><td>{team.wins}</td><td>{team.draws}</td><td>{team.losses}</td><td>{team.goalsFor}:{team.goalsAgainst}</td><td>{diff > 0 ? `+${diff}` : diff}</td><td><b>{team.points}</b></td>
        </tr>;
      })}</tbody>
    </table>
    <p className="season-hub-legend"><span className={top ? "hall-of-fame" : "promotion"}>{top ? "Platz 1 und 2: Hall of Fame" : "Platz 1 und 2: Aufstieg"}</span>{division > 1 && <span className="relegation">Platz 5 und 6: Abstieg</span>}</p>
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
export function SeasonPanel({ features }: { features: GameFeatures }) {
  const season = features.seasonMode, schedule = getSeasonSchedule(season);
  const next = schedule.filter((day) => !day.played);
  const opponentRating = (id: string) => season.table.find((team) => team.id === id)?.rating;
  const showLastSeason = season.matchday === 0 && season.lastMatchAt > 0 && season.lastTable.some((team) => team.played > 0) && !season.hallOfFame;
  return <div className="feature-panel season-hub">
    <div className="feature-panel-heading"><div><p className="eyebrow">SAISON {features.career.seasonNumber} / {getSeasonModeDivisionLabel(season.division).toUpperCase()}</p><h3>{season.hallOfFame ? "Hall of Fame erreicht." : `Spieltag ${season.matchday + 1} von ${SEASON_MODE_MATCHES_PER_SEASON}`}</h3></div></div>
    <StandingsTable table={season.table} division={season.division} caption="Tabelle" />
    {showLastSeason && <details className="season-hub-last"><summary>Abschlusstabelle der letzten Saison</summary><StandingsTable table={season.lastTable} division={Math.max(1, season.division - (season.history.at(-1)?.seasonOutcome === "promoted" ? 1 : season.history.at(-1)?.seasonOutcome === "relegated" ? -1 : 0))} caption="Letzte Saison" /></details>}
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
      <div className="season-hub-days">{schedule.map((day) => <details key={day.matchday} className="season-hub-day-card" open={day.matchday === season.matchday || day.matchday === season.matchday + 1}>
        <summary><span>Spieltag {day.matchday}</span><small>{day.played ? "gespielt" : day.matchday === season.matchday + 1 ? "als Nächstes" : "offen"}</small></summary>
        <ul>{day.matches.map((match) => <MatchLine key={`${match.homeId}-${match.awayId}`} match={match} />)}</ul>
      </details>)}</div>
    </section>
  </div>;
}
