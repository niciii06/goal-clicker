// Number and time formatting, labels and small random helpers for the game page.
import type { CrossbarHeight, MatchPrediction, PenaltyDirection } from "./types";
import type { SeasonTableRow } from "../feature-data";
import { CROSSBAR_HEIGHTS, MATCH_PREDICTIONS, PENALTY_DIRECTIONS } from "./constants";

export function formatCountdown(until: number, now: number) {
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function formatPackChance(chance: number) {
  const percentage = chance * 100;
  const precision = percentage < 0.001 ? 4 : percentage < 0.01 ? 3 : percentage < 0.1 ? 2 : percentage < 1 ? 1 : 0;
  return `${percentage.toLocaleString("de-CH", { minimumFractionDigits: precision, maximumFractionDigits: precision })}%`;
}

export function getRandomItem<T>(items: readonly T[]) {
  const random = new Uint32Array(1);
  globalThis.crypto.getRandomValues(random);
  return items[random[0] % items.length];
}

export function getRandomPenaltyDirection(): PenaltyDirection {
  return getRandomItem(PENALTY_DIRECTIONS);
}

export function getRandomCrossbarHeight(): CrossbarHeight {
  return getRandomItem(CROSSBAR_HEIGHTS);
}

export function getRandomMatchPrediction(): MatchPrediction {
  return getRandomItem(MATCH_PREDICTIONS);
}

export function directionLabel(direction: PenaltyDirection) {
  return direction[0].toUpperCase() + direction.slice(1);
}

export function heightLabel(height: CrossbarHeight) {
  return height[0].toUpperCase() + height.slice(1);
}

export function predictionLabel(prediction: MatchPrediction) {
  if (prediction === "heim") return "Heimsieg";
  if (prediction === "auswärts") return "Auswärtssieg";
  return "Remis";
}

export function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "MAX";
  if (value <= 0) return "0";
  if (value < 1000) return Math.floor(value).toLocaleString("de-CH");
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "Ud"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log10(value) / 3) - 1);
  if (Math.floor(Math.log10(value) / 3) - 1 >= units.length) return value.toExponential(2).replace("e+", "e");
  const divisor = 1000 ** (exponent + 1);
  const scaled = value / divisor;
  return `${scaled.toFixed(scaled < 10 ? 1 : 0)}${units[exponent]}`;
}

export function formatGoalDifference(team: Pick<SeasonTableRow, "goalsFor" | "goalsAgainst">) {
  const difference = team.goalsFor - team.goalsAgainst;
  if (difference === 0) return "0";
  return `${difference > 0 ? "+" : "−"}${Math.abs(difference)}`;
}

export function formatHistoryTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}
/** Light card accents (silver) are darkened for text on the white card; darker accents stay as they are. */
export function readableAccent(hex: string) {
  const value = /^#([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!value) return hex;
  const n = parseInt(value, 16), rgb = [n >> 16, (n >> 8) & 255, n & 255];
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return luminance > 0.6 ? `rgb(${rgb.map((c) => Math.round(c * 0.55)).join(",")})` : hex;
}
