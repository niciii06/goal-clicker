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

export type ReserveEntry = { id: string; name: string; positions: readonly StarPosition[]; rating: number; compatible?: boolean };

export function filterAndSortReserve<T extends ReserveEntry>(entries: readonly T[], options: { search: string; ratingFilter: string; positionFilter: string; preferCompatible?: boolean }) {
  const search = options.search.trim().toLocaleLowerCase("de-CH");
  return entries
    .filter((entry) => matchesReserveRating(entry.rating, options.ratingFilter)
      && matchesReservePosition(entry.positions, options.positionFilter)
      && (!search || `${entry.name} ${entry.positions.join(" ")} ${entry.rating}`.toLocaleLowerCase("de-CH").includes(search)))
    .sort((first, second) => {
      if (options.preferCompatible && Boolean(first.compatible) !== Boolean(second.compatible)) return first.compatible ? -1 : 1;
      return second.rating - first.rating || first.name.localeCompare(second.name);
    });
}
