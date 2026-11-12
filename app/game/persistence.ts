// Whether autosaves may write. Its own small module, so the account screen can use it without loading the game
// (the game and its card data load as a separate chunk, audit P13). game/storage.ts reads and re-exports it.
let persistenceSuspended = false;

/** Stops all autosaves until the page reloads, so an imported save file is not overwritten on the way out. */
export function suspendLocalPersistence() {
  persistenceSuspended = true;
}

/** Saves again after an import that did not go through; the previous game is still the one in storage. */
export function resumeLocalPersistence() {
  persistenceSuspended = false;
}

export function localPersistenceSuspended() {
  return persistenceSuspended;
}
