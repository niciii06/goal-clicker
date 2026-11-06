// Filter and sort for the reserve list. Everything runs on the rating the card shows (career rating), not the base rating.
import type { StarPosition } from "../fc26-player-pool";
import { STAR_RATING_FILTERS } from "./constants";

/** FC27 lists LV, RV and ST where the slots say LAV, RAV and MS; both names find the same players. */
const POSITION_EQUIVALENTS: Partial<Record<StarPosition, StarPosition>> = { LAV: "LV", RAV: "RV", MS: "ST" };

export function matchesReservePosition(positions: readonly StarPosition[], filter: string) {
  if (filter === "all") return true;
  const position = filter as StarPosition;
  const equivalent = POSITION_EQUIVALENTS[position];
  return positions.some((item) => item === position || item === equivalent || POSITION_EQUIVALENTS[item] === position);
}

export function matchesReserveRating(rating: number, filterId: string) {
  const filter = STAR_RATING_FILTERS.find((item) => item.id === filterId);
  return !filter || (rating >= filter.min && rating <= filter.max);
}

export type ReserveEntry = { id: string; name: string; positions: readonly StarPosition[]; rating: number; compatible?: boolean;
  /** Card type for the type filter (Q33); order: position in the club's card list, higher is newer (Q32). */
  type?: ReserveCardType; order?: number; form?: number; status?: ReserveStatus; favorite?: boolean; isNew?: boolean };

export type ReserveCardType = "base" | "icon" | "special" | "scrap";
export type ReserveStatus = "available" | "injured" | "banned";
export const RESERVE_SORTS = [{ id: "ovr", label: "OVR" }, { id: "name", label: "Name" }, { id: "new", label: "Neueste" }, { id: "position", label: "Position" }, { id: "form", label: "Form" }] as const;
export const RESERVE_TYPES = [{ id: "all", label: "Alle Typen" }, { id: "base", label: "Basis" }, { id: "icon", label: "Icons" }, { id: "special", label: "Spezial" }, { id: "scrap", label: "Schrott" }] as const;
export const RESERVE_STATUS_FILTERS = [{ id: "all", label: "Alle" }, { id: "available", label: "Verfügbar" }, { id: "injured", label: "Verletzt" }, { id: "banned", label: "Gesperrt" }, { id: "favorite", label: "★ Favoriten" }, { id: "new", label: "Neu" }] as const;
export type ReserveSort = (typeof RESERVE_SORTS)[number]["id"];

/** Type of a card for the filter: scrap cards, the special (custom and legendary) cards, icons and the rest. */
export function reserveCardType(player: { id: string; isCustom?: boolean; cardType?: string }): ReserveCardType {
  if (player.id.startsWith("scrap-")) return "scrap";
  if (player.isCustom || player.cardType === "legendary") return "special";
  return player.cardType === "icon" ? "icon" : "base";
}

/** Short type chip, so equal names stay apart (Q41). Base cards have none. */
export function reserveTypeLabel(type: ReserveCardType) {
  return type === "icon" ? "ICON" : type === "special" ? "SPEZIAL" : type === "scrap" ? "SCHROTT" : "";
}

const POSITION_ORDER = ["TW", "IV", "LV", "LAV", "RV", "RAV", "ZDM", "ZM", "LM", "RM", "ZOM", "LF", "RF", "LW", "RW", "MS", "ST"];
const positionRank = (positions: readonly StarPosition[]) => Math.min(99, ...positions.map((position) => { const index = POSITION_ORDER.indexOf(position); return index < 0 ? 99 : index; }));

export type ReserveFilterOptions = { search: string; ratingFilter: string; positionFilter: string; preferCompatible?: boolean; sort?: string; type?: string; status?: string; onlyCompatible?: boolean };

export function filterAndSortReserve<T extends ReserveEntry>(entries: readonly T[], options: ReserveFilterOptions) {
  const search = options.search.trim().toLocaleLowerCase("de-CH");
  const type = options.type ?? "all", status = options.status ?? "all", sort = options.sort ?? "ovr";
  return entries
    .filter((entry) => matchesReserveRating(entry.rating, options.ratingFilter)
      && matchesReservePosition(entry.positions, options.positionFilter)
      && (type === "all" || entry.type === type)
      && (status === "all" || (status === "favorite" ? entry.favorite : status === "new" ? entry.isNew : (entry.status ?? "available") === status))
      && (!options.onlyCompatible || entry.compatible !== false)
      && (!search || `${entry.name} ${entry.positions.join(" ")} ${entry.rating}`.toLocaleLowerCase("de-CH").includes(search)))
    .sort((first, second) => {
      if (options.preferCompatible && Boolean(first.compatible) !== Boolean(second.compatible)) return first.compatible ? -1 : 1;
      if (sort === "name") return first.name.localeCompare(second.name, "de-CH") || second.rating - first.rating;
      if (sort === "new") return (second.order ?? 0) - (first.order ?? 0) || second.rating - first.rating;
      if (sort === "position") return positionRank(first.positions) - positionRank(second.positions) || second.rating - first.rating || first.name.localeCompare(second.name);
      if (sort === "form") return (second.form ?? 0) - (first.form ?? 0) || second.rating - first.rating || first.name.localeCompare(second.name);
      return second.rating - first.rating || first.name.localeCompare(second.name);
    });
}
