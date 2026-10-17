// Device vibration with a per device on/off setting.
import { VIBRATION_STORAGE_KEY } from "./constants";

export function canVibrate() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function readVibrationSetting() {
  try { return typeof window === "undefined" || localStorage.getItem(VIBRATION_STORAGE_KEY) !== "off"; } catch { return true; }
}

export let vibrationOn = readVibrationSetting();

export function vibrate(pattern: number | number[]) {
  if (!vibrationOn || !canVibrate()) return;
  try { navigator.vibrate(pattern); } catch { /* Some browsers block vibration without a user gesture. */ }
}

export function setVibrationOn(next: boolean) {
  vibrationOn = next;
}
