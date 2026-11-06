// Open actions of a club at a glance: the tab title, the dots in the navigation, the "Nächste Schritte" chips on
// Home, the app icon badge and the return summary all read the same list, so they never disagree.
import type { GameFeatures } from "../feature-data";
import { getCupMatchMinute, getPrestigeBlockReason } from "../feature-data";
import { getDailyRewardStatus, mergeDailyRewardsForWorld, WORLD_DAILY_KEY } from "../daily-reward";
import { getPressConference } from "../press-conference";
import { getAlbumGroups } from "../career-data";
import { getWeeklyGoalViews } from "../weekly-goals";
import { journeyView } from "../travel-data";
import type { RoutedTab } from "../tab-routes";

/** The end of a tournament break is news for half an hour, not forever. */
export const TOURNAMENT_READY_SIGNAL_MS = 30 * 60 * 1000;

export type OpenActionId = "daily" | "packs" | "album" | "journey" | "press" | "weekly" | "offer" | "prestige" | "minigame" | "tournament";
/** `tab`: where the action is done; `section`: the main navigation entry that gets the dot. */
export type OpenAction = { id: OpenActionId; label: string; tab: RoutedTab; section: "home" | "cup" | "season" | "packs" | "club"; count: number };

export type StatusInput = {
  features: GameFeatures;
  now: number;
  /** World of a co-op room: the daily reward is shared by the world. */
  coop?: boolean;
  minigameWins?: number;
  miniGameCooldowns?: Record<string, number>;
  /** Travel clock (server time) for the journey; defaults to `now`. */
  travelNow?: number;
};

/** Album groups that are complete but not claimed yet (the same rule as claimAlbumRewards). */
export function claimableAlbumGroups(features: GameFeatures) {
  const collectedIds = [...new Set([...features.career.collectedIds, ...features.starXI.ownedIds])];
  return getAlbumGroups({ ...features.career, collectedIds }).filter((group) => !group.claimed && group.collected >= group.total);
}

/** A mini game whose cooldown ran out after it was played: ready again. A never played one is not a signal. */
export function readyMiniGames(cooldowns: Record<string, number> | undefined, now: number) {
  return Object.entries(cooldowns ?? {}).filter(([, until]) => Number(until) > 0 && Number(until) <= now).map(([id]) => id);
}

export function getOpenActions(input: StatusInput): OpenAction[] {
  const { features, now } = input;
  const actions: OpenAction[] = [];
  const daily = input.coop ? getDailyRewardStatus(mergeDailyRewardsForWorld(features.dailyRewards), WORLD_DAILY_KEY, now) : getDailyRewardStatus(features.dailyRewards, "solo", now);
  if (daily.available) actions.push({ id: "daily", label: "Tagesprämie bereit", tab: "home", section: "home", count: 1 });
  const unopened = features.earnedPacks.filter((pack) => !pack.opening).length;
  if (unopened) actions.push({ id: "packs", label: unopened === 1 ? "1 Pack zu öffnen" : `${unopened} Packs zu öffnen`, tab: "packs", section: "packs", count: unopened });
  const album = claimableAlbumGroups(features).length;
  if (album) actions.push({ id: "album", label: album === 1 ? "Albumprämie abholen" : `${album} Albumprämien abholen`, tab: "album", section: "packs", count: album });
  const journey = features.travel.journey;
  if (journey && !journey.consumed && journeyView(journey, input.travelNow ?? now).arrived && !features.cup.active) actions.push({ id: "journey", label: "Mannschaft angekommen", tab: "cup", section: "cup", count: 1 });
  if (getPressConference(features.press, features.cup, features.club.name)) actions.push({ id: "press", label: "Pressekonferenz offen", tab: "cup", section: "cup", count: 1 });
  const weekly = getWeeklyGoalViews(features, input.minigameWins).filter((goal) => goal.complete && !goal.claimed).length;
  if (weekly) actions.push({ id: "weekly", label: weekly === 1 ? "Wochenziel abholen" : `${weekly} Wochenziele abholen`, tab: "missions", section: "club", count: weekly });
  if (features.transferSaga.pendingOffer) actions.push({ id: "offer", label: "Angebot von Fabrizio", tab: "fabrizio", section: "club", count: 1 });
  if (features.seasonMode.hallOfFame && !getPrestigeBlockReason(features)) actions.push({ id: "prestige", label: "Prestige bereit", tab: "season", section: "season", count: 1 });
  const cup = features.cup;
  if (!cup.active && !cup.pendingNextRound && cup.nextTournamentAt > 0 && cup.nextTournamentAt <= now && now - cup.nextTournamentAt < TOURNAMENT_READY_SIGNAL_MS && cup.matchStartedAt > 0 && cup.mode !== "season" && !journey) actions.push({ id: "tournament", label: "Turnierpause vorbei", tab: "cup", section: "cup", count: 1 });
  if (readyMiniGames(input.miniGameCooldowns, now).length) actions.push({ id: "minigame", label: "Minigame bereit", tab: "home", section: "home", count: 1 });
  return actions;
}

/** Sections of the main navigation with something to do, for the dots. */
export function sectionBadges(actions: readonly OpenAction[]) {
  const badges: Partial<Record<OpenAction["section"], string[]>> = {};
  for (const action of actions) (badges[action.section] ??= []).push(action.label);
  return badges;
}

/** The number on the app icon of the installed web app: the things that wait for the player, not the mini games. */
export function appBadgeCount(actions: readonly OpenAction[]) {
  return actions.filter((action) => action.id !== "minigame").reduce((sum, action) => sum + action.count, 0);
}

/** The browser tab title: a live match first, then an arrived journey, then a ready reward, else the tab name. */
export function statusTitle(tabTitle: string | undefined, features: GameFeatures, now: number, actions: readonly OpenAction[]) {
  const base = tabTitle ? `${tabTitle} · Goal Clicker` : "Goal Clicker";
  const cup = features.cup;
  if (cup.active) {
    if (cup.phase === "penalties") return `⚽ ${cup.homeScore}:${cup.awayScore} · Elfmeterschiessen ${cup.penaltyHomeScore}:${cup.penaltyAwayScore} · Goal Clicker`;
    return `⚽ ${cup.homeScore}:${cup.awayScore} · ${getCupMatchMinute(cup, now)}′ · Goal Clicker`;
  }
  if (actions.some((action) => action.id === "journey")) return `✓ Angekommen · ${base}`;
  if (actions.some((action) => action.id === "daily")) return `🎁 Prämie bereit · ${base}`;
  if (actions.some((action) => action.id === "packs")) return `🎁 Pack bereit · ${base}`;
  return base;
}

/** "8 h 12 min", "35 min", "unter 1 min". */
export function formatAwayDuration(ms: number) {
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  if (minutes < 1) return "unter 1 min";
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  if (hours >= 24) { const days = Math.floor(hours / 24); return `${days} ${days === 1 ? "Tag" : "Tage"} ${hours % 24} h`; }
  return hours ? `${hours} h ${rest} min` : `${minutes} min`;
}

/** The banner after a return: how long the club was alone and what waits now. */
export function returnSummary(awayMs: number, actions: readonly OpenAction[]) {
  const parts = [`${formatAwayDuration(awayMs)} weg`, ...actions.filter((action) => action.id !== "minigame").slice(0, 4).map((action) => action.label)];
  return parts.join(" · ");
}
