// A whole career from Liga 15 to Liga 1 with pack purchases, league matches, match rewards and the pauses of the
// VAR and the random events while the team travels and plays. Card ratings stand in for the squad: the best
// eleven ratings (an empty slot counts 55) against the opponents of the league decide promotion.
import { UPGRADES } from "../../app/game/upgrades";
import { getCostAtLevel } from "../../app/game/economy";
import { getPackUnlockLeague, getTournamentUnlockLeague, getUpgradeUnlockLeague, LEAGUE_COUNT } from "../../app/season-progression";
import { MATCH_PACK_STAMP_TARGET, STAR_PACKS, getSeasonOpponentRating, getTournamentRewardPack, openEarnedPackDraw, resolveRandomEvent, resolveVarEvent } from "../../app/feature-data";
import type { StarPackDefinition, TournamentId } from "../../app/feature-data";
import { DAILY_REWARD_DAYS, getDailyRewardAmount } from "../../app/daily-reward";
import { getIncomePerSecond, seededRandom } from "./economy-model";

// Assumptions of the model, in seconds unless named otherwise.
export const OFFICE_SECONDS = 120; // in the club office between two matches; only here the VAR and the events hit
export const TRAVEL_SECONDS = 60;
export const MATCH_SECONDS = 240;
export const PLAY_MINUTES_PER_DAY = 60; // one daily reward per hour of play
const MATCHES_PER_SEASON = 10;
const PRESS_SECONDS = 90; // getPressReward: 90 seconds of passive income after every match
const UPGRADE_PAYBACK_LIMIT = 900; // upgrades that pay back within 15 minutes come before saving for a pack
const EMPTY_SLOT_RATING = 55;
const WELCOME_RATING = 87;

export type LeagueProgress = { league: number; minutes: number; packWaits: number[]; packs: number; squadRating: number };
export type CareerRun = { firstFullElevenMinutes: number; leagues: LeagueProgress[] };

const homeAttendance = (league: number) => 3000 + (LEAGUE_COUNT - league) * 4000;

function drawRating(pack: StarPackDefinition, random: () => number) {
  const total = pack.odds.reduce((sum, band) => sum + band.chance, 0);
  let roll = random() * total;
  const band = pack.odds.find((entry) => (roll -= entry.chance) < 0) ?? pack.odds[pack.odds.length - 1];
  return band.minRating + Math.floor(random() * (band.maxRating - band.minRating + 1));
}

function squadRating(cards: number[]) {
  const best = [...cards].sort((first, second) => second - first).slice(0, 11);
  while (best.length < 11) best.push(EMPTY_SLOT_RATING);
  return best.reduce((sum, rating) => sum + rating, 0) / 11;
}

/** One career; `clicksPerSecond` are effective clicks (see activeClicks), 0 for a passive club. */
export function simulateCareer({ clicksPerSecond = 0, seed = 1, maxHours = 30 }: { clicksPerSecond?: number; seed?: number; maxHours?: number } = {}): CareerRun {
  const random = seededRandom(seed);
  const levels: Record<string, number> = {};
  // The welcome walkout plus the starter squad (55 to 59) after the first fifty clicks.
  const cards = [WELCOME_RATING, ...Array.from({ length: 10 }, () => 55 + Math.floor(random() * 5))];
  const firstFullElevenMinutes = 1;
  const leagues: LeagueProgress[] = [];
  let goals = 60, second = 0, league = LEAGUE_COUNT, stamps = 0, dailyIndex = 0, lastPackAt = 0;
  let nextVar = 60 + random() * 120, nextEvent = 60 + random() * 120, nextDaily = 0;
  let current: LeagueProgress = { league, minutes: 0, packWaits: [], packs: 0, squadRating: 0 };
  let income = getIncomePerSecond(levels, clicksPerSecond);
  const tierOf = (value: number) => LEAGUE_COUNT + 1 - value;
  const addCard = (rating: number) => cards.push(rating);
  const spend = () => {
    for (;;) {
      let best: { id: string; cost: number; payback: number } | null = null;
      for (const upgrade of UPGRADES) {
        if (getUpgradeUnlockLeague(upgrade.id) < league) continue;
        const cost = getCostAtLevel(upgrade, levels[upgrade.id] ?? 0);
        if (!Number.isFinite(cost)) continue;
        const gain = getIncomePerSecond({ ...levels, [upgrade.id]: (levels[upgrade.id] ?? 0) + 1 }, clicksPerSecond) - income;
        const payback = gain > 0 ? cost / gain : Infinity;
        if (!best || payback < best.payback) best = { id: upgrade.id, cost, payback };
      }
      if (best && best.payback <= UPGRADE_PAYBACK_LIMIT && best.cost <= goals) {
        goals -= best.cost;
        levels[best.id] = (levels[best.id] ?? 0) + 1;
        income = getIncomePerSecond(levels, clicksPerSecond);
        continue;
      }
      const pack = STAR_PACKS.filter((item) => getPackUnlockLeague(item.id) >= league).at(-1)!;
      if (pack.price > goals) return;
      goals -= pack.price;
      addCard(drawRating(pack, random));
      current.packWaits.push((second - lastPackAt) / 60);
      current.packs += 1;
      lastPackAt = second;
    }
  };
  const run = (seconds: number, events: boolean) => {
    for (let index = 0; index < seconds; index += 1) {
      second += 1;
      goals += income;
      if (second >= nextDaily) {
        const day = DAILY_REWARD_DAYS[dailyIndex % DAILY_REWARD_DAYS.length];
        goals += getDailyRewardAmount(day, income, 0);
        if (day.pack) addCard(openEarnedPackDraw(day.pack, [], tierOf(league), random).player.rating);
        dailyIndex += 1;
        nextDaily = second + PLAY_MINUTES_PER_DAY * 60;
      }
      if (events && second >= nextVar) { goals = Math.max(0, goals + resolveVarEvent(goals, random()).amount); nextVar = second + 60 + random() * 120; }
      if (events && second >= nextEvent) { goals = Math.max(0, goals + resolveRandomEvent(goals, random()).amount); nextEvent = second + 60 + random() * 120; }
      if (!events) { nextVar = Math.max(nextVar, second + 1); nextEvent = Math.max(nextEvent, second + 1); }
      if (index % 15 === 0) spend();
    }
  };
  while (league >= 1 && second < maxHours * 3600) {
    const startedAt = second;
    for (let match = 0; match < MATCHES_PER_SEASON; match += 1) {
      run(OFFICE_SECONDS, true);
      run(TRAVEL_SECONDS + MATCH_SECONDS, false);
      goals += PRESS_SECONDS * income;
      if (match % 2 === 0) goals += homeAttendance(league) * 0.004 * income;
      stamps += 1;
      if (stamps >= MATCH_PACK_STAMP_TARGET) { stamps = 0; addCard(drawRating(getTournamentRewardPack("cup", tierOf(league)), random)); }
    }
    // One tournament reward per season, from the best tournament the club may enter.
    const tournament = (["world", "champions", "stadium"] as TournamentId[]).find((id) => getTournamentUnlockLeague(id) >= league)!;
    addCard(drawRating(getTournamentRewardPack(tournament, tierOf(league)), random));
    const rating = squadRating(cards);
    const opponents = [1, 2, 3, 4, 5].map((index) => getSeasonOpponentRating(tierOf(league), index));
    const opponentAverage = opponents.reduce((sum, value) => sum + value, 0) / opponents.length;
    // Top two of six: likely when the eleven is clearly stronger than the league.
    const promoted = random() < 1 / (1 + Math.exp(-(rating - opponentAverage - 1) / 2.5));
    current.minutes += (second - startedAt) / 60;
    current.squadRating = rating;
    if (promoted) {
      leagues.push(current);
      league -= 1;
      current = { league, minutes: 0, packWaits: [], packs: 0, squadRating: 0 };
    }
  }
  if (league >= 1) leagues.push(current);
  return { firstFullElevenMinutes, leagues };
}

export function percentile(values: number[], share: number) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
}

/** Median and P90 per league over `runs` careers. */
export function summarizeCareers(runs: CareerRun[]) {
  return Array.from({ length: LEAGUE_COUNT }, (_, index) => LEAGUE_COUNT - index).map((league) => {
    const entries = runs.map((run) => run.leagues.find((entry) => entry.league === league)).filter((entry): entry is LeagueProgress => Boolean(entry));
    const waits = entries.flatMap((entry) => entry.packWaits);
    return {
      league,
      reached: entries.length,
      minutes: { median: percentile(entries.map((entry) => entry.minutes), 0.5), p90: percentile(entries.map((entry) => entry.minutes), 0.9) },
      packWait: { median: percentile(waits, 0.5), p90: percentile(waits, 0.9) },
      squadRating: percentile(entries.map((entry) => entry.squadRating), 0.5),
    };
  });
}
