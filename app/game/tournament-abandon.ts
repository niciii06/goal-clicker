// "Turnier aufgeben" (Q51): a tournament run that waits for its next round blocks league matches and Prestige.
// Giving it up ends the run like an elimination: the usual break before the next tournament, loans that belong to
// the run come back, no trophy and no reward pack. Nothing else changes.
import type { GameFeatures } from "../feature-data";
import { TOURNAMENT_COOLDOWN_MS, addHistory, finishActiveTransferLoans, getTournament } from "../feature-data";

export function canAbandonTournament(features: GameFeatures) {
  return features.cup.pendingNextRound && !features.cup.active;
}

/** The features after giving up, or null when no run waits. */
export function abandonTournamentRun(value: GameFeatures, now: number): GameFeatures | null {
  if (!canAbandonTournament(value)) return null;
  const label = getTournament(value.cup.tournamentId)?.label ?? "Turnier";
  const round = value.cup.round;
  const runId = `${value.cup.tournamentId}:${value.cup.matchStartedAt}`;
  let features: GameFeatures = { ...value, cup: { ...value.cup, pendingNextRound: false, round: 0, nextTournamentAt: now + TOURNAMENT_COOLDOWN_MS, lastResult: `${label} nach Runde ${round} aufgegeben.` } };
  features = finishActiveTransferLoans(features, now).features;
  if (!features.completedTournamentRuns.includes(runId)) features.completedTournamentRuns = [...features.completedTournamentRuns, runId];
  addHistory(features, { title: `${label} aufgegeben`, detail: `Nach Runde ${round}. Das nächste Turnier ist nach der üblichen Pause wieder offen.`, tone: "neutral" }, now);
  return features;
}
