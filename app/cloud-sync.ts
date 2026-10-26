"use client";
// Keeps the single player save of a signed in account in the cloud. The game itself only knows localStorage:
// before it starts, the save of the account is written there, and while it runs, every change is uploaded.
//
// Signing in is required, so the save in the profile always wins: a device never asks, it takes the newer
// cloud save. Only a cloud save from a device that merely collected passive goals (nobody clicked there)
// is overwritten by a device that is actually played, so an idle tab cannot wipe real progress.
import { BACKUP_STORAGE_KEY, COOP_ROOM_KEY, LEGACY_STORAGE_KEYS, PLAYER_NAME_KEY, RECOVERY_STORAGE_KEY } from "./game/constants";
import { cleanCloudSaveKeys, hashText, hasProgress, serializeCloudSaveKeys, summarizeSave, SYNCED_SAVE_KEYS } from "./cloud-save-rules";
import type { CloudSaveKeys } from "./cloud-save-rules";

/** Which account and save version this browser's localStorage belongs to, and whether it was played since. */
export const CLOUD_META_KEY = "goalClickerCloudMetaV1";
/** Asks the running game to write its current state to localStorage right now, before an upload reads it. */
export const FLUSH_SAVE_EVENT = "goalclicker:flush-save";
/** `pending` is the hash of an upload that was sent but whose answer never arrived, e.g. while the page closed. */
export type CloudMeta = { userId: string; version: number; hash: string; played?: boolean; pending?: string };
export type CloudSaveState = { version: number; updatedAt: string | null; active: boolean; keys: CloudSaveKeys | null };
export type SyncStatus = "saved" | "saving" | "offline";

const UPLOAD_INTERVAL_MS = 15_000;
// Browsers drop keepalive requests above 64 KB, the limit for the last upload while a page closes.
const KEEPALIVE_LIMIT = 60 * 1024;

export function readCloudMeta(userId: string): CloudMeta | null {
  try {
    const meta = JSON.parse(localStorage.getItem(CLOUD_META_KEY) ?? "null") as Partial<CloudMeta> | null;
    if (!meta || meta.userId !== userId || !Number.isSafeInteger(meta.version) || typeof meta.hash !== "string") return null;
    return { userId, version: meta.version!, hash: meta.hash, played: meta.played === true, ...(typeof meta.pending === "string" ? { pending: meta.pending } : {}) };
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
 * Otherwise the cloud save wins.
 */
export type InitialSyncPlan = "use-local" | "use-cloud" | "keep-local" | "fresh";

/**
 * When the cloud holds exactly the save this device last sent, that upload went through even though its
 * answer was lost (the page closed or reloaded). The device then simply is at that cloud version, instead
 * of mistaking its own save for one from another device. Returns the corrected meta, or null.
 */
export function adoptOwnUpload(meta: CloudMeta | null, cloud: CloudSaveState): CloudMeta | null {
  if (!meta?.pending || !cloud.keys || cloud.version <= meta.version) return null;
  if (hashText(serializeCloudSaveKeys(cloud.keys)) !== meta.pending) return null;
  return { userId: meta.userId, version: cloud.version, hash: meta.pending, played: meta.played };
}

export function planInitialSync(meta: CloudMeta | null, cloud: CloudSaveState, local: CloudSaveKeys): InitialSyncPlan {
  const localGame = cleanCloudSaveKeys(local);
  if (!cloud.keys) return localGame ? "use-local" : "fresh";
  if (meta && meta.version === cloud.version) return "use-local";
  if (!localGame || !hasProgress(summarizeSave(localGame))) return "use-cloud";
  const localText = serializeCloudSaveKeys(localGame);
  if (localText === serializeCloudSaveKeys(cloud.keys)) return "use-cloud";
  if (meta && (meta.hash === hashText(localText) || !meta.played)) return "use-cloud";
  if (meta && meta.played && !cloud.active) return "keep-local";
  return "use-cloud";
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
  /** Another device saved something newer: load it (the page reloads). */
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
      if (cloud.unchanged || cloud.version <= meta.version) return;
      const own = adoptOwnUpload(meta, cloud);
      if (own) { writeCloudMeta(own); void this.upload(); return; }
      if (this.resolve(cloud) === "overwrite") void this.upload({ overwriteVersion: cloud.version });
    } catch {
      setStatus("offline");
    }
  }

  /** A newer save from another device: take it, or overwrite it when it only collected passive goals. */
  private resolve(cloud: CloudSaveState): "overwrite" | "handled" {
    if (this.played && !cloud.active) return "overwrite";
    this.stop();
    this.handlers.onNewerSave(cloud);
    return "handled";
  }

  /** Uploads now if the save changed; resolves true once the cloud has this device's save. */
  upload(options: { keepalive?: boolean; overwriteVersion?: number } = {}): Promise<boolean> {
    if (this.running && !options.keepalive) return this.running.then(() => this.upload(options));
    const run = this.uploadOnce(options).finally(() => { if (this.running === run) this.running = null; });
    this.running = run;
    return run;
  }

  private async uploadOnce({ keepalive = false, overwriteVersion }: { keepalive?: boolean; overwriteVersion?: number }): Promise<boolean> {
    if (this.stopped && overwriteVersion === undefined) return false;
    // The game saves every few seconds on its own; the upload must not miss the clicks since then.
    window.dispatchEvent(new Event(FLUSH_SAVE_EVENT));
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
    // Remembered until the answer arrives: if the page closes first, the next start recognises this save.
    writeCloudMeta({ ...meta, pending: hash });
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
        const cloud = { version: data.version ?? 0, updatedAt: data.updatedAt ?? null, active: data.active !== false, keys: cleanCloudSaveKeys(data.keys) };
        // The cloud is ahead only by this device's own earlier upload: continue on top of it.
        const own = adoptOwnUpload(readCloudMeta(this.userId) ?? meta, cloud);
        if (own) { writeCloudMeta(own); return this.uploadOnce({ keepalive, overwriteVersion: cloud.version }); }
        // Overwriting belongs to this same upload, so whoever waits for it (signing out) waits for the overwrite too.
        if (this.resolve(cloud) === "overwrite") return this.uploadOnce({ keepalive, overwriteVersion: cloud.version });
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
