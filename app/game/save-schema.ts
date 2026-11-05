// Protection against older clients (an old PWA tab after a deploy). normalizeGameFeatures drops fields it does not
// know and writes its own schema version, so a client must never normalize, store or upload a save that a newer
// version of the game wrote. It keeps that save untouched and asks the player to reload instead.
import { GAME_FEATURES_SCHEMA_VERSION } from "../feature-data";
import { readGameSchemaVersion, readSaveSchemaVersion } from "../cloud-save-rules";
import type { CloudSaveKeys } from "../cloud-save-rules";

export const NEWER_VERSION_MESSAGE = "Neue Version verfügbar, bitte neu laden. Dein Spielstand wurde mit einer neueren Version gespeichert und bleibt unverändert.";

/** Whether the raw stored game (STORAGE_KEY text) comes from a newer version of the game than this one. */
export function isGameFromNewerVersion(game: string | null | undefined, supported = GAME_FEATURES_SCHEMA_VERSION) {
  return readGameSchemaVersion(game) > supported;
}

/** Whether a set of cloud save keys holds a game from a newer version of the game than this one. */
export function isSaveFromNewerVersion(keys: CloudSaveKeys | null | undefined, supported = GAME_FEATURES_SCHEMA_VERSION) {
  return readSaveSchemaVersion(keys) > supported;
}
