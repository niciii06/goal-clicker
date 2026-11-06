// Squad helpers that keep the player's own choices: fill only the gaps (injury, ban, loan, empty place), compare
// two line ups, and preview what a move or a formation does to the team rating. The rules of who may play where
// are those of feature-data (canStarXIPlayerFillSlot, getStarXIRating); nothing here changes them.
import type { GameFeatures, StarFormationId, StarXIEvaluationContext, StarXIState } from "../feature-data";
import { STAR_FORMATIONS, STAR_XI_BENCH_SIZE, STAR_XI_SQUAD_SIZE, canStarXIPlayerFillSlot, getBestStarXIBenchSelection, getBestXIUnavailablePlayerIds, getStarXIPlayer, getStarXIRating, getStarXISelectionRating, normalizeStarXIState, removeStarXIPlayersFromSquad, setBestStarXI, setStarXIFormation } from "../feature-data";
import { getBannedPlayerIds, nextCompetition } from "../discipline";

export type GapReason = "verletzt" | "gesperrt" | "verliehen" | "frei";
export type GapReplacement = { slot: number; area: "lineup" | "bench"; inId: string; outId: string | null; reason: GapReason };

/** Why a player cannot play the coming match, or null when he can. */
export function unavailabilityReason(features: GameFeatures, playerId: string): GapReason | null {
  if (features.transferSaga.loans.some((loan) => loan.playerId === playerId)) return "verliehen";
  if (Number(features.cup.injuredPlayerIds?.[playerId]) > 0) return "verletzt";
  if (features.cup.suspendedPlayerIds.includes(playerId) || getBannedPlayerIds(features, nextCompetition(features)).includes(playerId)) return "gesperrt";
  return null;
}

/**
 * Fills the empty and unavailable places of the line up and the bench. A lineup gap takes the strongest fitting
 * bench player first (his bench place is then filled too), then the strongest fitting reserve player; everyone
 * else stays where the player put him. Returns the new state and what changed.
 */
export function fillStarXIGaps(features: GameFeatures, context: StarXIEvaluationContext = {}) {
  const blocked = getBestXIUnavailablePlayerIds(features);
  const blockedSet = new Set(blocked);
  const original = normalizeStarXIState(features.starXI);
  const state = removeStarXIPlayersFromSquad(original, blocked);
  if (state.lockedPlayerIds) return { starXI: original, replacements: [] as GapReplacement[] };
  const score = (id: string) => { const player = getStarXIPlayer(id); return player ? getStarXISelectionRating(player, context) : -Infinity; };
  const reasonFor = (id: string | null) => id ? unavailabilityReason(features, id) ?? "gesperrt" : "frei";
  const replacements: GapReplacement[] = [];
  const lineupIds = [...state.lineupIds], benchIds = [...state.benchIds];
  const used = () => new Set([...lineupIds, ...benchIds].filter(Boolean));
  const reserve = () => { const taken = used(); return state.ownedIds.filter((id) => !taken.has(id) && !blockedSet.has(id) && getStarXIPlayer(id) && !getStarXIPlayer(id)!.benchOnly); };
  for (let slot = 0; slot < STAR_XI_SQUAD_SIZE; slot += 1) {
    if (lineupIds[slot]) continue;
    // An injured or suspended player already left the lineup after the match; the kick off lineup still names him.
    const kickoffId = features.cup.originalLineupIds?.[slot];
    const outId = original.lineupIds[slot] || (kickoffId && !state.lineupIds.includes(kickoffId) && unavailabilityReason(features, kickoffId) ? kickoffId : null);
    const fits = (id: string) => canStarXIPlayerFillSlot(id, slot, state.formationPositions);
    const fromBench = benchIds.map((id, index) => ({ id, index })).filter((entry) => entry.id && fits(entry.id)).sort((a, b) => score(b.id) - score(a.id))[0];
    if (fromBench) {
      lineupIds[slot] = fromBench.id;
      benchIds[fromBench.index] = "";
      replacements.push({ slot, area: "lineup", inId: fromBench.id, outId, reason: reasonFor(outId) });
      continue;
    }
    const fromReserve = reserve().filter(fits).sort((a, b) => score(b) - score(a))[0];
    if (fromReserve) {
      lineupIds[slot] = fromReserve;
      replacements.push({ slot, area: "lineup", inId: fromReserve, outId, reason: reasonFor(outId) });
    }
  }
  for (let slot = 0; slot < STAR_XI_BENCH_SIZE; slot += 1) {
    if (benchIds[slot]) continue;
    const outId = original.benchIds[slot] && !lineupIds.includes(original.benchIds[slot]) ? original.benchIds[slot] : null;
    const pick = reserve().filter((id) => state.formationPositions.some((_, index) => canStarXIPlayerFillSlot(id, index, state.formationPositions))).sort((a, b) => score(b) - score(a))[0];
    if (!pick) break;
    benchIds[slot] = pick;
    replacements.push({ slot, area: "bench", inId: pick, outId, reason: reasonFor(outId) });
  }
  return { starXI: { ...state, lineupIds, benchIds }, replacements };
}

/** "Sommer ersetzt Kobel (verletzt)" for the lineup changes of a fill; bench refills are counted. */
export function describeReplacements(replacements: readonly GapReplacement[]) {
  const lines = replacements.filter((entry) => entry.area === "lineup").map((entry) => {
    const incoming = getStarXIPlayer(entry.inId)?.name ?? "Spieler";
    const outgoing = entry.outId ? getStarXIPlayer(entry.outId)?.name : null;
    return outgoing ? `${incoming} ersetzt ${outgoing} (${entry.reason})` : `${incoming} besetzt einen freien Platz`;
  });
  const bench = replacements.filter((entry) => entry.area === "bench").length;
  if (bench) lines.push(bench === 1 ? "1 Bankplatz besetzt" : `${bench} Bankplätze besetzt`);
  return lines;
}

export type LineupChange = { slot: number; position: string; inId: string; outId: string };
/** The lineup places that differ between two states, for the preview of "Beste Startelf". */
export function lineupChanges(before: StarXIState, after: StarXIState): LineupChange[] {
  const changes: LineupChange[] = [];
  for (let slot = 0; slot < STAR_XI_SQUAD_SIZE; slot += 1) {
    const outId = before.lineupIds[slot] ?? "", inId = after.lineupIds[slot] ?? "";
    if (outId !== inId) changes.push({ slot, position: String(after.formationPositions[slot] ?? ""), inId, outId });
  }
  return changes;
}

export function benchChangeCount(before: StarXIState, after: StarXIState) {
  const old = new Set(before.benchIds.filter(Boolean));
  return after.benchIds.filter((id) => id && !old.has(id)).length;
}

export function lineupRating(state: Pick<StarXIState, "ownedIds" | "lineupIds">) {
  return getStarXIRating(state.ownedIds, state.lineupIds);
}

/** The team rating a lineup would have after putting `playerId` on `slot` (a swap when he already plays). */
export function ratingAfterLineupMove(state: StarXIState, playerId: string, slot: number) {
  const lineupIds = [...state.lineupIds];
  const from = lineupIds.indexOf(playerId);
  const displaced = lineupIds[slot] ?? "";
  lineupIds[slot] = playerId;
  if (from >= 0) lineupIds[from] = displaced;
  return getStarXIRating(state.ownedIds, lineupIds);
}

/** "+2 OVR", "−1 OVR" or "± 0 OVR". */
export function formatRatingDelta(delta: number) {
  return delta > 0 ? `+${delta} OVR` : delta < 0 ? `−${Math.abs(delta)} OVR` : "± 0 OVR";
}

/** A lineup or bench player goes to an empty bench place (his lineup place stays open); null when not possible. */
export function movePlayerToEmptyBench(state: StarXIState, playerId: string, benchIndex: number): StarXIState | null {
  const next = normalizeStarXIState(state);
  if (!Number.isInteger(benchIndex) || benchIndex < 0 || benchIndex >= STAR_XI_BENCH_SIZE || next.benchIds[benchIndex] || !next.ownedIds.includes(playerId)) return null;
  const lineupIndex = next.lineupIds.indexOf(playerId), oldBench = next.benchIds.indexOf(playerId);
  if (lineupIndex < 0 && oldBench < 0) return null;
  const lineupIds = [...next.lineupIds], benchIds = [...next.benchIds];
  if (lineupIndex >= 0) lineupIds[lineupIndex] = "";
  if (oldBench >= 0) benchIds[oldBench] = "";
  benchIds[benchIndex] = playerId;
  return { ...next, lineupIds, benchIds };
}

/** A lineup or bench player goes back to the reserve; his place stays open. null when he has no place. */
export function movePlayerToReserve(state: StarXIState, playerId: string): StarXIState | null {
  const next = normalizeStarXIState(state);
  if (!next.lineupIds.includes(playerId) && !next.benchIds.includes(playerId)) return null;
  return { ...next, lineupIds: next.lineupIds.map((id) => id === playerId ? "" : id), benchIds: next.benchIds.map((id) => id === playerId ? "" : id) };
}

/** The best bench for the current eleven (the lineup itself stays exactly as it is). */
export function withBestBench(features: GameFeatures, context: StarXIEvaluationContext = {}): StarXIState {
  const blocked = getBestXIUnavailablePlayerIds(features);
  const state = removeStarXIPlayersFromSquad(normalizeStarXIState(features.starXI), blocked, false);
  const benchIds = getBestStarXIBenchSelection(state.ownedIds, state.lineupIds, state.formationPositions, blocked, context);
  return { ...state, benchIds };
}

/** The best team rating every formation reaches with the available players (for the formation picker). */
export function bestRatingPerFormation(features: GameFeatures, formationIds: readonly StarFormationId[] = STAR_FORMATIONS.map((formation) => formation.id), context: StarXIEvaluationContext = {}) {
  const blocked = getBestXIUnavailablePlayerIds(features);
  const result: Partial<Record<StarFormationId, number>> = {};
  for (const id of formationIds) {
    const formed = setStarXIFormation(features.starXI, id, blocked);
    const best = setBestStarXI(formed, blocked, context);
    result[id] = lineupRating(best);
  }
  return result;
}
