// League roadmap: rewards per tier generated from the unlock tables, so it names every upgrade, pack, cup and formation.
// Kept apart from season-progression.ts, which stays free of catalogue imports (the co-op server and plain node tests load it).
import { UPGRADES } from "./game/upgrades";
import { STAR_FORMATIONS, TOURNAMENTS } from "./features/catalog";
import { FORMATION_UNLOCK_SEASONS, PACK_UNLOCK_SEASONS, SEASON_TIERS, TOURNAMENT_UNLOCK_SEASONS, UPGRADE_UNLOCK_SEASONS, type SeasonMilestone } from "./season-progression";

// Pack labels live in feature-data, which imports season-progression; tests/ui-fixes.test.ts keeps them equal.
export const PACK_NAMES: Record<string, string> = { scrap: "Schrott-Pack", regional: "Regional-Pack", scout: "Scout Pack", profi: "Profi-Pack", elite: "Elite Pack", weltklasse: "Weltklasse-Pack", legend: "Legenden Pack", special: "Spezialkarten-Pack" };

function idsAt(table: Record<string, number>, tier: number) {
  return Object.keys(table).filter((id) => table[id] === tier);
}

export function getSeasonRewards(tier: number, extras: readonly string[] = []) {
  const upgrades = idsAt(UPGRADE_UNLOCK_SEASONS, tier).map((id) => UPGRADES.find((upgrade) => upgrade.id === id)?.name ?? id);
  const packs = idsAt(PACK_UNLOCK_SEASONS, tier).map((id) => PACK_NAMES[id] ?? id);
  const cups = idsAt(TOURNAMENT_UNLOCK_SEASONS, tier).map((id) => TOURNAMENTS.find((tournament) => tournament.id === id)?.label ?? id);
  const formations = idsAt(FORMATION_UNLOCK_SEASONS, tier);
  const formationText = tier === 1 ? `${formations.length} Formationen`
    : formations.length === 1 ? `Formation ${STAR_FORMATIONS.find((formation) => formation.id === formations[0])?.label ?? formations[0]}`
    : `${formations.length} neue Formationen`;
  const upgradeText = tier === 1 ? [`${upgrades.length} Basis Upgrades`] : upgrades;
  return [...upgradeText, ...packs, ...cups, ...(formations.length ? [formationText] : []), ...extras];
}

export const SEASON_MILESTONES: readonly SeasonMilestone[] = SEASON_TIERS.map((text, index) => ({ season: index + 1, title: text.title, description: text.description, rewards: getSeasonRewards(index + 1, text.extras) }));

export function getSeasonMilestone(season: number) {
  const normalized = Math.max(1, Math.floor(season));
  return SEASON_MILESTONES.find((milestone) => milestone.season === normalized) ?? SEASON_MILESTONES[SEASON_MILESTONES.length - 1];
}
