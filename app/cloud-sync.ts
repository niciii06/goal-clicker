"use client";
// Keeps the single player save of a signed in account in the cloud. The game itself only knows localStorage:
// before it starts, the save of the account is written there, and while it runs, every change is uploaded.
//
// Signing in is required, so the save in the profile always wins: a device never asks, it takes the newer
// cloud save. Only a cloud save from a device that merely collected passive goals (nobody clicked there)
// is overwritten by a device that is actually played, so an idle tab cannot wipe real progress.
import { BACKUP_STORAGE_KEY, COOP_ROOM_KEY, LEGACY_STORAGE_KEYS, PLAYER_NAME_KEY, RECOVERY_STORAGE_KEY, STORAGE_KEY } from "./game/constants";
import { cleanCloudSaveKeys, hashText, hasProgress, MAX_CLOUD_SAVE_REQUEST_BYTES, serializeCloudSaveKeys, summarizeSave, SYNCED_SAVE_KEYS } from "./cloud-save-rules";
import type { CloudSaveKeys } from "./cloud-save-rules";
import { bumpSaveRevision, localSaveFailed } from "./game/save-revision";
import { isSaveFromNewerVersion, NEWER_VERSION_MESSAGE, uploadSchemaVersion } from "./game/save-schema";
import { compareStoredGameProgress, parseStoredGame } from "./save-safety";
import { isAway } from "./activity";

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

/** Shown with the "failed" status when the browser storage cannot hold the save from the cloud. */
export const STORAGE_FULL_MESSAGE = "Gerätespeicher voll. Bitte Speicher freigeben oder Spielstand als Datei sichern.";
/** Shown with the "failed" status when the save is larger than the cloud accepts. */
export const SAVE_TOO_LARGE_MESSAGE = "Der Spielstand ist zu gross für die Cloud und wird nur auf diesem Gerät gespeichert. Bitte sichere ihn als Datei.";
export { NEWER_VERSION_MESSAGE };

// Played progress is uploaded once a minute while the tab is visible and someone is at it (and always when the
// page is left or hidden). Passive income alone changes the save all the time; it is uploaded at most every
// 10 minutes, and not at all from a hidden or untouched tab (app/activity.ts), so a forgotten tab neither sends
// requests nor keeps the database awake. Hiding or closing the tab still uploads at once.
const UPLOAD_INTERVAL_MS = 60_000;
const PASSIVE_UPLOAD_INTERVAL_MS = 10 * 60_000;
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

/**
 * After the player replaced the game on purpose (a save file): the device counts as played, so the next upload
 * stores that game instead of quietly taking a cloud save that only collected passive goals.
 */
export function markCloudMetaPlayed() {
  const owner = readCloudMetaOwner();
  const meta = owner ? readCloudMeta(owner) : null;
  if (meta) writeCloudMeta({ ...meta, played: true });
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
  // A cloud answer without a game (a missing or broken row) must never wipe the game in this browser.
  const incoming = cleanCloudSaveKeys(save.keys);
  if (!incoming) throw new Error("Der Cloud Spielstand ist leer und wird nicht geladen.");
  const keys = [...SYNCED_SAVE_KEYS, BACKUP_STORAGE_KEY, RECOVERY_STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
  const previous = keys.flatMap((key) => { const value = localStorage.getItem(key); return value === null ? [] : [[key, value] as const]; });
  try {
    for (const key of keys) localStorage.removeItem(key);
    for (const [key, value] of Object.entries(incoming)) if (value !== undefined) localStorage.setItem(key, value);
    // Other open tabs still hold the replaced game and must not save it back.
    bumpSaveRevision(localStorage);
  } catch (error) {
    // Storage full: put the previous game and its recovery copies back before giving up.
    for (const key of keys) localStorage.removeItem(key);
    for (const [key, value] of previous) { try { localStorage.setItem(key, value); } catch { /* keep restoring the rest */ } }
    throw error;
  }
  writeCloudMeta({ userId, version: save.version, hash: hashText(serializeCloudSaveKeys(incoming)), played: false });
}

/** Forgets the account's save on this device, after signing out or deleting the profile. */
export function clearLocalAccountData() {
  for (const key of [...SYNCED_SAVE_KEYS, BACKUP_STORAGE_KEY, RECOVERY_STORAGE_KEY, ...LEGACY_STORAGE_KEYS, CLOUD_META_KEY, COOP_ROOM_KEY, PLAYER_NAME_KEY]) localStorage.removeItem(key);
}

/**
 * What to do when a signed in device starts:
 * - "use-local": the device continues the cloud version it last synced (or the cloud has nothing yet).
 * - "use-cloud": the device has nothing of its own, or was not played since its last sync.
 * - "keep-local": both changed, but the cloud save only collected passive goals; this device overwrites it. Also
 *   when the cloud went back to an older version than this device last synced (a database restore) and this
 *   device holds at least as much progress: the restore must not roll the device back.
 * - "choose": a save without an account (a guest's) meets an account that already has a different save with
 *   progress. Neither is replaced without the player choosing.
 * Otherwise the cloud save wins.
 */
export type InitialSyncPlan = "use-local" | "use-cloud" | "keep-local" | "fresh" | "choose";

/** Whether the local game holds at least as much progress as the cloud game (save-safety ranking). */
export function localAtLeastAsAdvanced(local: CloudSaveKeys, cloud: CloudSaveKeys) {
  return compareStoredGameProgress(parseStoredGame(local[STORAGE_KEY] ?? null), parseStoredGame(cloud[STORAGE_KEY] ?? null)) >= 0;
}

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
  // Continuing the synced version needs a game here: without one, a fresh game would replace the cloud save.
  if (meta && meta.version === cloud.version && localGame) return "use-local";
  if (!localGame || !hasProgress(summarizeSave(localGame))) return "use-cloud";
  const localText = serializeCloudSaveKeys(localGame);
  if (localText === serializeCloudSaveKeys(cloud.keys)) return "use-cloud";
  // The cloud is older than what this device last synced (restored database): keep the more advanced game.
  if (meta && cloud.version < meta.version) return localAtLeastAsAdvanced(localGame, cloud.keys) ? "keep-local" : "use-cloud";
  // A guest's save and the account's save both hold progress: the player decides, nothing is replaced silently.
  // A guest's save and an account save without progress: the guest's game moves into the account.
  if (!meta) return hasProgress(summarizeSave(cloud.keys)) ? "choose" : "keep-local";
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

/** The save as gzip (about a tenth of the JSON), or null where the browser cannot compress. */
async function gzipText(text: string): Promise<Uint8Array<ArrayBuffer> | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

type SyncStatusListener = (status: SyncStatus, message: string | null) => void;
let statusListeners: SyncStatusListener[] = [];
let currentStatus: SyncStatus = "saved";
let currentMessage: string | null = null;

function setStatus(status: SyncStatus, message: string | null = null) {
  currentStatus = status;
  currentMessage = status === "failed" ? message : null;
  for (const listener of statusListeners) listener(status, currentMessage);
}

/** Marks the save as not saved with a clear reason, for problems found outside an upload (storage full). */
export function reportSyncProblem(message: string) {
  setStatus("failed", message);
}

/**
 * For the small save indicator next to the account name. `message` explains a "failed" status when the reason is
 * not the usual full local storage.
 */
export function subscribeSyncStatus(listener: SyncStatusListener) {
  statusListeners.push(listener);
  listener(currentStatus, currentMessage);
  return () => { statusListeners = statusListeners.filter((item) => item !== listener); };
}

function byteLength(text: string) {
  return typeof TextEncoder === "undefined" ? text.length * 3 : new TextEncoder().encode(text).byteLength;
}

/** How often one upload may follow a conflict with an overwrite before it waits for the next regular upload. */
const MAX_OVERWRITE_ATTEMPTS = 3;
type UploadOptions = {
  /** The page is going away: send with keepalive where the body fits. */
  keepalive?: boolean;
  /** The page is closing right now: do not wait behind a running upload. */
  immediate?: boolean;
  overwriteVersion?: number;
  attempt?: number;
};

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
    this.timer = window.setInterval(() => this.periodicUpload(), UPLOAD_INTERVAL_MS);
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

  private lastUploadAt = Date.now();

  /** The once a minute upload: skipped while away, and for passive goals only every PASSIVE_UPLOAD_INTERVAL_MS. */
  private periodicUpload() {
    if (isAway()) return;
    if (!this.played && Date.now() - this.lastUploadAt < PASSIVE_UPLOAD_INTERVAL_MS) return;
    void this.upload();
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
    // Hiding is usually the last moment before a tab closes, so this upload also uses keepalive when it fits.
    if (document.visibilityState === "hidden") void this.upload({ keepalive: true });
    else void this.checkForNewerSave();
  };

  private handlePageHide = () => {
    void this.upload({ keepalive: true, immediate: true });
  };

  // A save the cloud refused as too large; the same save is not sent again every minute.
  private tooLargeHash: string | null = null;

  /** This device or the cloud holds a save from a newer version of the game: nothing more is uploaded. */
  private blockForNewerVersion() {
    this.stop();
    setStatus("failed", NEWER_VERSION_MESSAGE);
  }

  /** A tab that comes back to the front first takes over what another device saved in the meantime. */
  async checkForNewerSave() {
    const meta = readCloudMeta(this.userId);
    if (this.stopped || !meta) return;
    try {
      const cloud = await fetchCloudSave(meta.version);
      if (cloud.unchanged || cloud.version <= meta.version) return;
      const own = adoptOwnUpload(meta, cloud);
      if (own) { writeCloudMeta(own); void this.upload(); return; }
      if (this.resolve(cloud, meta) === "overwrite") void this.upload({ overwriteVersion: cloud.version });
    } catch {
      setStatus("offline");
    }
  }

  /**
   * A newer save from another device: take it, or overwrite it when it only collected passive goals. Never
   * applied: an answer without a game (missing or broken row: re-created from this device), a cloud that went back
   * behind this device's version with less progress (database restore), and a save from a newer game version.
   */
  private resolve(cloud: CloudSaveState, knownMeta?: CloudMeta | null): "overwrite" | "handled" | "blocked" {
    const meta = readCloudMeta(this.userId) ?? knownMeta ?? null;
    if (isSaveFromNewerVersion(cloud.keys)) { this.blockForNewerVersion(); return "blocked"; }
    if (!cloud.keys) return "overwrite";
    const local = cleanCloudSaveKeys(readLocalSaveKeys());
    if (meta && cloud.version < meta.version && local && localAtLeastAsAdvanced(local, cloud.keys)) return "overwrite";
    const baseVersion = meta?.version ?? 0;
    if ((this.played || meta?.played === true) && !cloudPlayedSince(cloud, baseVersion)) return "overwrite";
    this.stop();
    this.handlers.onNewerSave(cloud);
    return "handled";
  }

  /** Uploads now if the save changed; resolves true once the cloud has this device's save. */
  upload(options: UploadOptions = {}): Promise<boolean> {
    if (this.running && !options.immediate) return this.running.then(() => this.upload(options));
    const run = this.uploadOnce(options).finally(() => { if (this.running === run) this.running = null; });
    this.running = run;
    return run;
  }

  private async uploadOnce({ keepalive = false, immediate = false, overwriteVersion, attempt = 0 }: UploadOptions): Promise<boolean> {
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
    // A newer version of the game wrote this save: this older client must not upload it (or anything over it).
    if (isSaveFromNewerVersion(keys)) {
      this.blockForNewerVersion();
      return false;
    }
    const text = serializeCloudSaveKeys(keys);
    const hash = hashText(text);
    const meta = readCloudMeta(this.userId) ?? { userId: this.userId, version: 0, hash: "" };
    if (overwriteVersion === undefined && meta.hash === hash) {
      setStatus("saved");
      return true;
    }
    if (hash === this.tooLargeHash) {
      setStatus("failed", SAVE_TOO_LARGE_MESSAGE);
      return false;
    }
    const inputs = this.inputs;
    const generation = this.generation;
    const active = this.played || meta.played === true;
    // The schema version lets the server refuse an upload from an older game version than the stored save.
    const json = JSON.stringify({ baseVersion: overwriteVersion ?? meta.version, keys, active, schemaVersion: uploadSchemaVersion(keys) });
    const jsonBytes = byteLength(json);
    if (jsonBytes > MAX_CLOUD_SAVE_REQUEST_BYTES) {
      this.tooLargeHash = hash;
      setStatus("failed", SAVE_TOO_LARGE_MESSAGE);
      return false;
    }
    // A closing page sends a small save at once (compression is asynchronous and the page may be gone before it
    // ends). A larger one is compressed first: uncompressed it would never fit into a keepalive request.
    const sendNow = immediate && jsonBytes < KEEPALIVE_LIMIT;
    const gzipped = sendNow ? null : await gzipText(json);
    // Signed out or replaced while compressing: this upload belongs to a finished sync.
    if (generation !== this.generation) return false;
    const body = gzipped ?? json;
    setStatus("saving");
    // Remembered until an answer arrives: if the page closes or the request fails first, the next start or
    // retry recognises this save in the cloud. Earlier unanswered uploads stay on the list.
    writeCloudMeta({ ...meta, pending: [...(meta.pending ?? []).filter((item) => item !== hash), hash].slice(-MAX_PENDING_UPLOADS) });
    try {
      const headers: Record<string, string> = { "content-type": "application/json", ...(gzipped ? { "content-encoding": "gzip" } : {}) };
      const size = typeof body === "string" ? jsonBytes : body.byteLength;
      const response = await fetch("/api/save", { method: "PUT", headers, body, keepalive: keepalive && size < KEEPALIVE_LIMIT });
      const data = await response.json() as { version?: number; errorCode?: string } & Partial<CloudSaveState>;
      if (generation !== this.generation) return response.ok;
      if (response.ok && typeof data.version === "number") {
        this.inputsAtLastSave = inputs;
        this.playedMarked = this.played;
        writeCloudMeta({ userId: this.userId, version: data.version, hash, played: this.played });
        this.lastUploadAt = Date.now();
        setStatus("saved");
        return true;
      }
      if (response.status === 409 && data.errorCode === "SAVE_SCHEMA_NEWER") {
        this.blockForNewerVersion();
        return false;
      }
      if (response.status === 409 && data.errorCode === "SAVE_CONFLICT") {
        const cloud = { version: data.version ?? 0, updatedAt: data.updatedAt ?? null, active: data.active !== false, activeVersion: data.activeVersion, keys: cleanCloudSaveKeys(data.keys) };
        // A conflict that keeps coming back (another device racing) is left for the next regular upload.
        if (attempt >= MAX_OVERWRITE_ATTEMPTS) { setStatus("offline"); return false; }
        // The cloud is ahead only by this device's own earlier upload: continue on top of it.
        const own = adoptOwnUpload(readCloudMeta(this.userId) ?? meta, cloud);
        if (own) { writeCloudMeta(own); return this.uploadOnce({ keepalive, immediate, overwriteVersion: cloud.version, attempt: attempt + 1 }); }
        // Overwriting belongs to this same upload, so whoever waits for it (signing out) waits for the overwrite too.
        // Without a cloud game (version 0: the row is missing) the overwrite creates it again on base version 0.
        if (this.resolve(cloud, meta) === "overwrite") return this.uploadOnce({ keepalive, immediate, overwriteVersion: cloud.version, attempt: attempt + 1 });
        return false;
      }
      if (response.status === 413) {
        this.tooLargeHash = hash;
        setStatus("failed", SAVE_TOO_LARGE_MESSAGE);
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
