// History filters (Q62, Q69): by topic and, in a shared world, by the member who did it.
import type { MatchHistoryEntry } from "../feature-data";

export type HistoryTopic = "all" | "matches" | "packs" | "squad" | "club";
export const HISTORY_TOPICS: { id: HistoryTopic; label: string }[] = [{ id: "all", label: "Alle" }, { id: "matches", label: "Spiele" }, { id: "packs", label: "Packs" }, { id: "squad", label: "Kader" }, { id: "club", label: "Club" }];

const MATCH_WORDS = /Saisonspiel|Pokal|Turnier|Runde|Elfmeter|Gazette|Verletzung|Partie|Trophäe|eingewechselt/;
const PACK_WORDS = /Pack|Star XI gezogen|in die Star XI|Doppelter|Sammelalbum|Spezialkarte|Prämie|Wochenziel/;
const SQUAD_WORDS = /Formation|Startelf|Bank|Kader|Lücken/;

export function historyTopic(entry: Pick<MatchHistoryEntry, "title" | "kind">): Exclude<HistoryTopic, "all"> {
  if (entry.kind === "squad") return "squad";
  if (entry.kind === "upgrade") return "club";
  if (MATCH_WORDS.test(entry.title)) return "matches";
  if (PACK_WORDS.test(entry.title)) return "packs";
  if (SQUAD_WORDS.test(entry.title)) return "squad";
  return "club";
}

export function filterHistory<T extends Pick<MatchHistoryEntry, "title" | "kind" | "actor">>(entries: readonly T[], topic: HistoryTopic, actor: string) {
  return entries.filter((entry) => (topic === "all" || historyTopic(entry) === topic) && (!actor || entry.actor === actor));
}

export function historyActors(entries: readonly Pick<MatchHistoryEntry, "actor">[]) {
  return [...new Set(entries.map((entry) => entry.actor).filter((actor): actor is string => Boolean(actor)))].sort((a, b) => a.localeCompare(b, "de-CH"));
}
