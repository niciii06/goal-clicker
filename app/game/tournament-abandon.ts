// "Turnier aufgeben" (Q51): a tournament run that waits for its next round blocks league matches and Prestige.
// Giving it up ends the run like an elimination: the usual break before the next tournament, loans that belong to
// the run come back, the run's yellow card count and unserved bans expire, no trophy and no reward pack.
// Nothing else changes. Once the squad has set off for the next round ("Reise antreten") the run can no longer be
// given up: the journey and its squad lock belong to that round and are only released by playing it.
import type { GameFeatures } from "../feature-data";
import { TOURNAMENT_COOLDOWN_MS, addHistory, finishActiveTransferLoans, getTournament } from "../feature-data";
import { endTournamentRunDiscipline } from "../discipline";

/** Why the waiting run cannot be given up right now, or null when it can. */
export function abandonTournamentBlockReason(features: GameFeatures): string | null {
  if (features.cup.active) return "Während eines Spiels kannst du kein Turnier aufgeben.";
  if (!features.cup.pendingNextRound) return "Es wartet kein Turnierlauf, der aufgegeben werden kann.";
  const journey = features.travel.journey;
  if ((journey && !journey.consumed) || features.squadLock) return "Die Mannschaft ist schon zur nächsten Runde unterwegs. Spiele diese Runde, danach kannst du aufgeben.";
  return null;
}

export function canAbandonTournament(features: GameFeatures) {
  return abandonTournamentBlockReason(features) === null;
}

/** The features after giving up, or null when no run waits or it cannot be given up. */
export function abandonTournamentRun(value: GameFeatures, now: number): GameFeatures | null {
  if (!canAbandonTournament(value)) return null;
  const tournamentId = value.cup.tournamentId;
  const label = getTournament(tournamentId)?.label ?? "Turnier";
  const round = value.cup.round;
  const runId = `${tournamentId}:${value.cup.matchStartedAt}`;
  let features: GameFeatures = { ...value, cup: { ...value.cup, pendingNextRound: false, round: 0, nextTournamentAt: now + TOURNAMENT_COOLDOWN_MS, lastResult: `${label} nach Runde ${round} aufgegeben.` } };
  features = finishActiveTransferLoans(features, now).features;
  // Like an elimination: the run's yellow cards and its unserved bans end with it.
  const discipline = structuredClone(features.discipline);
  endTournamentRunDiscipline(discipline, tournamentId);
  features = { ...features, discipline };
  if (!features.completedTournamentRuns.includes(runId)) features.completedTournamentRuns = [...features.completedTournamentRuns, runId];
  addHistory(features, { title: `${label} aufgegeben`, detail: `Nach Runde ${round}. Das nächste Turnier ist nach der üblichen Pause wieder offen.`, tone: "neutral" }, now);
  return features;
}
