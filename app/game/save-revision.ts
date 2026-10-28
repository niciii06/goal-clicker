// Bookkeeping of this browser's local save, shared by every open tab. None of it belongs to a save file or the cloud.

/** Counts every replacement of the local save (autosave, reset, import, cloud load) by any tab. */
export const SAVE_REVISION_KEY = "goalClickerSaveRevisionV1";
/** The tab that currently saves, with the time of its last save. Other tabs leave the save alone meanwhile. */
export const SAVE_WRITER_KEY = "goalClickerSaveWriterV1";
/** Set by a confirmed file import: the next start sends the imported game to the profile instead of loading it from there. */
export const IMPORT_PENDING_KEY = "goalClickerImportPendingV1";

type RevisionStorage = Pick<Storage, "getItem" | "setItem">;

export function readSaveRevision(storage: Pick<Storage, "getItem">) {
  const revision = Number(storage.getItem(SAVE_REVISION_KEY));
  return Number.isSafeInteger(revision) && revision > 0 ? revision : 0;
}

/** Marks that the local save was replaced; tabs that loaded an older revision then stop saving over it. */
export function bumpSaveRevision(storage: RevisionStorage) {
  const next = readSaveRevision(storage) + 1;
  storage.setItem(SAVE_REVISION_KEY, String(next));
  return next;
}

let localSaveFailing = false;

/** Whether the last local save attempt failed (storage full); the cloud must not report the game as saved then. */
export function localSaveFailed() {
  return localSaveFailing;
}

export function setLocalSaveFailed(failed: boolean) {
  localSaveFailing = failed;
}
