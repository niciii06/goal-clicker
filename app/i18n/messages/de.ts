// German source catalog. Every key of every language comes from here; German wording must stay exactly as the game
// shows it today (tests/i18n.test.ts compares each entry with the constant it will replace).
//
// A message is a text with {placeholders}, or plural forms chosen by Intl.PluralRules (one, other, …) for {count}.
export const de = {
  "sync.storageFull": "Gerätespeicher voll. Bitte Speicher freigeben oder Spielstand als Datei sichern.",
  "sync.saveTooLarge": "Der Spielstand ist zu gross für die Cloud und wird nur auf diesem Gerät gespeichert. Bitte sichere ihn als Datei.",
  "update.newerSave": "Neue Version verfügbar, bitte neu laden. Dein Spielstand wurde mit einer neueren Version gespeichert und bleibt unverändert.",
  "update.multiplayer": "Eine neue Goal Clicker Version ist verfügbar. Lade die Seite einmal neu. Dein Raum und Spielstand bleiben vollständig erhalten.",
  "pack.fragmentsBack": "+{amount} Fragmente zurück.",
  "season.matchesLeft": { one: "Noch {count} Spiel", other: "Noch {count} Spiele" },
} as const satisfies Record<string, Message>;

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Message = string | PluralForms;
export type MessageKey = keyof typeof de;
