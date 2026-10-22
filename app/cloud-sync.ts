"use client";
// Keeps the single player save of a signed in account in the cloud. The game itself only knows localStorage:
// before it starts, the save of the account is written there, and while it runs, every change is uploaded.
//
// Two devices can be open at once. What counts is where the player actually plays: a device without any
// click or key press since its last save never asks, it simply takes the newer save. A save from a device
// that only collected passive goals is overwritten by a device that is played. Only when both were played
// the player decides.
import { BACKUP_STORAGE_KEY, COOP_ROOM_KEY, LEGACY_STORAGE_KEYS, PLAYER_NAME_KEY, RECOVERY_STORAGE_KEY } from "./game/constants";
import { cleanCloudSaveKeys, hashText, hasProgress, serializeCloudSaveKeys, summarizeSave, SYNCED_SAVE_KEYS } from "./cloud-save-rules";
import type { CloudSaveKeys } from "./cloud-save-rules";

/** Which account and save version this browser's localStorage belongs to, and whether it was played since. */
export const CLOUD_META_KEY = "goalClickerCloudMetaV1";
export type CloudMeta = { userId: string; version: number; hash: string; played?: boolean };
export type CloudSaveState = { version: number; updatedAt: string | null; active: boolean; keys: CloudSaveKeys | null };
export type SyncStatus = "saved" | "saving" | "offline" | "conflict";

const UPLOAD_INTERVAL_MS = 15_000;
// Browsers drop keepalive requests above 64 KB, the limit for the last upload while a page closes.
const KEEPALIVE_LIMIT = 60 * 1024;

export function readCloudMeta(userId: string): CloudMeta | null {
  try {
    const meta = JSON.parse(localStorage.getItem(CLOUD_META_KEY) ?? "null") as Partial<CloudMeta> | null;
    if (!meta || meta.userId !== userId || !Number.isSafeInteger(meta.version) || typeof meta.hash !== "string") return null;
    return { userId, version: meta.version!, hash: meta.hash, played: meta.played === true };
  } catch {
    return null;
  }
}

export function writeCloudMeta(meta: CloudMeta) {
  localStorage.setItem(CLOUD_META_KEY, JSON.stringify(meta));
}

export function readLocalSaveKeys(): CloudSaveKeys {
  const keys: CloudSaveKeys = {};
  for (const key of SYNCED_SAVE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) keys[key] = value;
  }
  return keys;
}

/**
 * Replaces this browser's save with the cloud save. Backups and old save versions go too, otherwise the
 * game would pick an older local backup that looks more advanced.
 */
export function applyCloudSave(userId: string, save: CloudSaveState) {
  for (const key of [...SYNCED_SAVE_KEYS, BACKUP_STORAGE_KEY, RECOVERY_STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) localStorage.removeItem(key);
  if (save.keys) for (const [key, value] of Object.entries(save.keys)) if (value !== undefined) localStorage.setItem(key, value);
  writeCloudMeta({ userId, version: save.version, hash: save.keys ? hashText(serializeCloudSaveKeys(save.keys)) : "", played: false });
}

/** Forgets the account's save on this device, after signing out or deleting the profile. */
export function clearLocalAccountData() {
  for (const key of [...SYNCED_SAVE_KEYS, BACKUP_STORAGE_KEY, RECOVERY_STORAGE_KEY, ...LEGACY_STORAGE_KEYS, CLOUD_META_KEY, COOP_ROOM_KEY, PLAYER_NAME_KEY]) localStorage.removeItem(key);
}

/**
 * What to do when a signed in device starts:
 * - "use-local": the device continues the cloud version it last synced (or the cloud has nothing yet).
 * - "use-cloud": the device has nothing of its own, or was not played since its last sync.
 * - "keep-local": both changed, but the cloud save only collected passive goals; this device overwrites it.
 * - "ask": both saves were played; the player decides.
 */
export type InitialSyncPlan = "use-local" | "use-cloud" | "keep-local" | "ask" | "fresh";

export function planInitialSync(meta: CloudMeta | null, cloud: CloudSaveState, local: CloudSaveKeys): InitialSyncPlan {
  const localGame = cleanCloudSaveKeys(local);
  if (!cloud.keys) return localGame ? "use-local" : "fresh";
  if (meta && meta.version === cloud.version) return "use-local";
  if (!localGame || !hasProgress(summarizeSave(localGame))) return "use-cloud";
  const localText = serializeCloudSaveKeys(localGame);
  if (localText === serializeCloudSaveKeys(cloud.keys)) return "use-cloud";
  if (meta && (meta.hash === hashText(localText) || !meta.played)) return "use-cloud";
  if (meta && !cloud.active) return "keep-local";
  return "ask";
}

export async function fetchCloudSave(since?: number): Promise<CloudSaveState & { unchanged?: boolean }> {
  const response = await fetch(since === undefined ? "/api/save" : `/api/save?since=${since}`, { cache: "no-store" });
  const data = await response.json() as CloudSaveState & { error?: string; unchanged?: boolean };
  if (!response.ok) throw Object.assign(new Error(data.error ?? "Der Spielstand konnte nicht geladen werden."), { status: response.status });
  return { version: data.version, updatedAt: data.updatedAt, active: data.active !== false, keys: cleanCloudSaveKeys(data.keys), unchanged: data.unchanged };
}

let statusListeners: ((status: SyncStatus) => void)[] = [];
let currentStatus: SyncStatus = "saved";

function setStatus(status: SyncStatus) {
  currentStatus = status;
  for (const listener of statusListeners) listener(status);
}

/** For the small save indicator next to the account name. */
export function subscribeSyncStatus(listener: (status: SyncStatus) => void) {
  statusListeners.push(listener);
  listener(currentStatus);
  return () => { statusListeners = statusListeners.filter((item) => item !== listener); };
}

type SyncHandlers = {
  /** Both devices were played: the player has to choose. */
  onConflict: (cloud: CloudSaveState) => void;
  /** This device was not played since its last save: load the newer save (the page reloads). */
  onNewerSave: (cloud: CloudSaveState) => void;
};

/**
 * Uploads the save whenever it changed: every few seconds, when the tab goes to the background and when it
 * closes. When the tab comes back it first looks for a newer save from another device.
 */
export class CloudSync {
  private timer: number | null = null;
  private running: Promise<boolean> | null = null;
  private stopped = true;
  // Counts clicks and key presses; an upload knows whether the player did anything since the last one.
  private inputs = 0;
  private inputsAtLastSave = 0;
  private playedMarked = false;

  constructor(private readonly userId: string, private readonly handlers: SyncHandlers) {}

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.inputsAtLastSave = this.inputs - (readCloudMeta(this.userId)?.played ? 1 : 0);
    this.timer = window.setInterval(() => void this.upload(), UPLOAD_INTERVAL_MS);
    document.addEventListener("visibilitychange", this.handleVisibility);
    window.addEventListener("pagehide", this.handlePageHide);
    window.addEventListener("pointerdown", this.handleInput, { capture: true, passive: true });
    window.addEventListener("keydown", this.handleInput, { capture: true, passive: true });
    void this.upload();
  }

  stop() {
    this.stopped = true;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener("visibilitychange", this.handleVisibility);
    window.removeEventListener("pagehide", this.handlePageHide);
    window.removeEventListener("pointerdown", this.handleInput, { capture: true });
    window.removeEventListener("keydown", this.handleInput, { capture: true });
  }

  private get played() {
    return this.inputs !== this.inputsAtLastSave;
  }

  private handleInput = () => {
    this.inputs += 1;
    if (this.playedMarked) return;
    // Remembered across reloads, so a device that was played is not silently replaced on its next start.
    this.playedMarked = true;
    const meta = readCloudMeta(this.userId);
    if (meta && !meta.played) writeCloudMeta({ ...meta, played: true });
  };

  private handleVisibility = () => {
    if (document.visibilityState === "hidden") void this.upload();
    else void this.checkForNewerSave();
  };

  private handlePageHide = () => {
    void this.upload({ keepalive: true });
  };

  /** A tab that comes back to the front first takes over what another device saved in the meantime. */
  async checkForNewerSave() {
    const meta = readCloudMeta(this.userId);
    if (this.stopped || !meta) return;
    try {
      const cloud = await fetchCloudSave(meta.version);
      if (!cloud.unchanged && cloud.version > meta.version) this.resolve(cloud);
    } catch {
      setStatus("offline");
    }
  }

  private resolve(cloud: CloudSaveState) {
    if (!this.played) {
      this.stop();
      this.handlers.onNewerSave(cloud);
      return;
    }
    if (!cloud.active) {
      void this.upload({ overwriteVersion: cloud.version });
      return;
    }
    this.stop();
    setStatus("conflict");
    this.handlers.onConflict(cloud);
  }

  /** Uploads now if the save changed; resolves true once the cloud has this device's save. */
  upload(options: { keepalive?: boolean; overwriteVersion?: number } = {}): Promise<boolean> {
    if (this.running && !options.keepalive) return this.running.then(() => this.upload(options));
    const run = this.uploadOnce(options).finally(() => { if (this.running === run) this.running = null; });
    this.running = run;
    return run;
  }

  private async uploadOnce({ keepalive = false, overwriteVersion }: { keepalive?: boolean; overwriteVersion?: number }) {
    if (this.stopped && overwriteVersion === undefined) return false;
    const keys = cleanCloudSaveKeys(readLocalSaveKeys());
    // Without a game in this browser there is nothing to save, and an empty save must never replace a real one.
    if (!keys) return true;
    const text = serializeCloudSaveKeys(keys);
    const hash = hashText(text);
    const meta = readCloudMeta(this.userId) ?? { userId: this.userId, version: 0, hash: "" };
    if (overwriteVersion === undefined && meta.hash === hash) {
      setStatus("saved");
      return true;
    }
    const inputs = this.inputs;
    const active = this.played || meta.played === true;
    const body = JSON.stringify({ baseVersion: overwriteVersion ?? meta.version, keys, active });
    setStatus("saving");
    try {
      const response = await fetch("/api/save", { method: "PUT", headers: { "content-type": "application/json" }, body, keepalive: keepalive && body.length < KEEPALIVE_LIMIT });
      const data = await response.json() as { version?: number; errorCode?: string } & Partial<CloudSaveState>;
      if (response.ok && typeof data.version === "number") {
        this.inputsAtLastSave = inputs;
        this.playedMarked = this.played;
        writeCloudMeta({ userId: this.userId, version: data.version, hash, played: this.played });
        setStatus("saved");
        return true;
      }
      if (response.status === 409 && data.errorCode === "SAVE_CONFLICT") {
        this.resolve({ version: data.version ?? 0, updatedAt: data.updatedAt ?? null, active: data.active !== false, keys: cleanCloudSaveKeys(data.keys) });
        return false;
      }
      setStatus("offline");
      return false;
    } catch {
      setStatus("offline");
      return false;
    }
  }
}
