// English catalog (British English, en-GB). Not shown to players yet: English is not in ENABLED_LOCALES.
// Keys must exist in the German catalog; missing keys fall back to German (tests/i18n.test.ts lists them).
import type { Message, MessageKey } from "./de";

export const en = {
  "sync.storageFull": "Device storage is full. Please free up space or back up your save as a file.",
  "sync.saveTooLarge": "Your save is too large for the cloud and is only stored on this device. Please back it up as a file.",
  "update.newerSave": "A new version is available, please reload. Your save was written by a newer version and stays unchanged.",
  "update.multiplayer": "A new Goal Clicker version is available. Reload the page once. Your room and save are fully kept.",
  "pack.fragmentsBack": "+{amount} fragments refunded.",
  "season.matchesLeft": { one: "{count} match left", other: "{count} matches left" },
} as const satisfies Partial<Record<MessageKey, Message>>;
