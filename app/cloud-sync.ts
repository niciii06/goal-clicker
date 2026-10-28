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
import { bumpSaveRevision, localSaveFailed } from "./game/save-revision";

/** Which account and save version this browser's localStorage belongs to, and whether it was played since. */
export const CLOUD_META_KEY = "goalClickerCloudMetaV1";
/** Asks the running game to write its current state to localStorage right now, before an upload reads it. */
export const FLUSH_SAVE_EVENT = "goalclicker:flush-save";
/** `pending` lists the hashes of uploads that were sent but whose answer never arrived (the page closed or the
 * connection dropped), newest last; the cloud may hold any of them. */
export type CloudMeta = { userId: string; version: number; hash: string; played?: boolean; pending?: string[] };
const MAX_PENDING_UPLOADS = 6;
/** `activeVersion`: the last version a played device stored. Versions after it only collected passive goals. */
export type CloudSaveState = { version: number; updatedAt: string | null; active: boolean; activeVersion?: number; keys: CloudSaveKeys | null };

/**
 * Whether a played device that loaded `baseVersion` may replace this cloud save without loading it: only when
 * nothing was played elsewhere since then. A device that played once and then only collected passive goals still
 * protects what was played.
 */
export function cloudPlayedSince(cloud: CloudSaveState, baseVersion: number) {
  const activeVersion = Number.isSafeInteger(cloud.activeVersion) ? cloud.activeVersion! : cloud.active ? cloud.version : 0;
  return activeVersion > baseVersion;
}
export type SyncStatus = "saved" | "saving" | "offline" | "failed";

const UPLOAD_INTERVAL_MS = 15_000;
// Browsers drop keepalive requests above 64 KB, the limit for the last upload while a page closes.
const KEEPALIVE_LIMIT = 60 * 1024;

export function readCloudMeta(userId: string): CloudMeta | null {
  try {
    const meta = JSON.parse(localStorage.getItem(CLOUD_META_KEY) ?? "null") as Partial<CloudMeta> | null;
    if (!meta || meta.userId !== userId || !Number.isSafeInteger(meta.version) || typeof meta.hash !== "string") return null;
    // Older versions stored a single pending hash as a string.
    const raw: unknown = meta.pending, pending = (typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : []).filter((item): item is string => typeof item === "string").slice(-MAX_PENDING_UPLOADS);
    return { userId, version: meta.version!, hash: meta.hash, played: meta.played === true, ...(pending.length ? { pending } : {}) };
  } catch {
    return null;
  }
}

/**
 * Whether this browser holds the save of another account (its session ended without the sign out button, for
 * example by expiring). That save must not become the save of the account signing in now.
 */
export function holdsOtherAccountSave(userId: string) {
  const owner = readCloudMetaOwner();
  return owner !== null && owner !== userId;
}

/** The account this browser's save belongs to, or null for a save without an account (a guest's). */
export function readCloudMetaOwner() {
  try {
    const meta = JSON.parse(localStorage.getItem(CLOUD_META_KEY) ?? "null") as { userId?: unknown } | null;
    return typeof meta?.userId === "string" ? meta.userId : null;
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
  const keys = [...SYNCED_SAVE_KEYS, BACKUP_STORAGE_KEY, RECOVERY_STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
  const previous = keys.flatMap((key) => { const value = localStorage.getItem(key); return value === null ? [] : [[key, value] as const]; });
  try {
    for (const key of keys) localStorage.removeItem(key);
    if (save.keys) for (const [key, value] of Object.entries(save.keys)) if (value !== undefined) localStorage.setItem(key, value);
    // Other open tabs still hold the replaced game and must not save it back.
    bumpSaveRevision(localStorage);
  } catch (error) {
    // Storage full: put the previous game and its recovery copies back before giving up.
    for (const key of keys) localStorage.removeItem(key);
    for (const [key, value] of previous) { try { localStorage.setItem(key, value); } catch { /* keep restoring the rest */ } }
    throw error;
  }
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
 * When the cloud holds exactly a save this device sent, that upload went through even though its answer was
 * lost (the page closed, the connection dropped, a retry followed). The device then simply is at that cloud
 * version, instead of mistaking its own save for one from another device. Returns the corrected meta, or null.
 */
export function adoptOwnUpload(meta: CloudMeta | null, cloud: CloudSaveState): CloudMeta | null {
  if (!meta?.pending?.length || !cloud.keys || cloud.version <= meta.version) return null;
  const cloudHash = hashText(serializeCloudSaveKeys(cloud.keys));
  if (!meta.pending.includes(cloudHash)) return null;
  return { userId: meta.userId, version: cloud.version, hash: cloudHash, played: meta.played };
}

export function planInitialSync(meta: CloudMeta | null, cloud: CloudSaveState, local: CloudSaveKeys): InitialSyncPlan {
  const localGame = cleanCloudSaveKeys(local);
  if (!cloud.keys) return localGame ? "use-local" : "fresh";
  if (meta && meta.version === cloud.version) return "use-local";
  if (!localGame || !hasProgress(summarizeSave(localGame))) return "use-cloud";
  const localText = serializeCloudSaveKeys(localGame);
  if (localText === serializeCloudSaveKeys(cloud.keys)) return "use-cloud";
  if (meta && (meta.hash === hashText(localText) || !meta.played)) return "use-cloud";
  if (meta && meta.played && !cloudPlayedSince(cloud, meta.version)) return "keep-local";
  return "use-cloud";
}

export async function fetchCloudSave(since?: number): Promise<CloudSaveState & { unchanged?: boolean }> {
  const response = await fetch(since === undefined ? "/api/save" : `/api/save?since=${since}`, { cache: "no-store" });
  const data = await response.json() as CloudSaveState & { error?: string; unchanged?: boolean };
  if (!response.ok) throw Object.assign(new Error(data.error ?? "Der Spielstand konnte nicht geladen werden."), { status: response.status });
  return { version: data.version, updatedAt: data.updatedAt, active: data.active !== false, activeVersion: data.activeVersion, keys: cleanCloudSaveKeys(data.keys), unchanged: data.unchanged };
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
  // Raised by stop(): an answer that arrives later belongs to a finished sync and must not touch this browser.
  private generation = 0;

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
    this.generation += 1;
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
    const baseVersion = readCloudMeta(this.userId)?.version ?? 0;
    if ((this.played || readCloudMeta(this.userId)?.played === true) && !cloudPlayedSince(cloud, baseVersion)) return "overwrite";
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
    // The browser storage refused the current game: what it still holds is older, so nothing counts as saved.
    if (localSaveFailed()) {
      setStatus("failed");
      return false;
    }
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
    const generation = this.generation;
    const active = this.played || meta.played === true;
    const body = JSON.stringify({ baseVersion: overwriteVersion ?? meta.version, keys, active });
    setStatus("saving");
    // Remembered until an answer arrives: if the page closes or the request fails first, the next start or
    // retry recognises this save in the cloud. Earlier unanswered uploads stay on the list.
    writeCloudMeta({ ...meta, pending: [...(meta.pending ?? []).filter((item) => item !== hash), hash].slice(-MAX_PENDING_UPLOADS) });
    try {
      const response = await fetch("/api/save", { method: "PUT", headers: { "content-type": "application/json" }, body, keepalive: keepalive && body.length < KEEPALIVE_LIMIT });
      const data = await response.json() as { version?: number; errorCode?: string } & Partial<CloudSaveState>;
      if (generation !== this.generation) return response.ok;
      if (response.ok && typeof data.version === "number") {
        this.inputsAtLastSave = inputs;
        this.playedMarked = this.played;
        writeCloudMeta({ userId: this.userId, version: data.version, hash, played: this.played });
        setStatus("saved");
        return true;
      }
      if (response.status === 409 && data.errorCode === "SAVE_CONFLICT") {
        const cloud = { version: data.version ?? 0, updatedAt: data.updatedAt ?? null, active: data.active !== false, activeVersion: data.activeVersion, keys: cleanCloudSaveKeys(data.keys) };
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
      if (generation === this.generation) setStatus("offline");
      return false;
    }
  }

  /** Waits for an upload that is still on its way, for example before the account is deleted. */
  async settle() {
    await this.running?.catch(() => false);
  }
}
