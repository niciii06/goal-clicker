// Release notes for the "Was ist neu" window. Every update players notice adds a new entry at the TOP.
// Each player sees the newest entry once; the seen id travels with the account's cloud save.

export type WhatsNewEntry = { id: string; date: string; title: string; items: readonly string[] };

export const WHATS_NEW: readonly WhatsNewEntry[] = [
  {
    id: "2026-10-29-balance",
    date: "29. Oktober 2026",
    title: "Balance Update: Packs passen zur Liga",
    items: [
      "Acht Packs statt vier: Regional-, Profi- und Weltklasse-Pack sind neu, jedes Pack öffnet erst in der Liga, zu der seine Karten passen.",
      "Das Spezialkarten-Pack gibt es erst ab Liga 3, es kostet 50'000 Fragmente und nur noch 8% der Züge sind 100er.",
      "Flurin Fabrice ist jetzt eine 100er Spezialkarte, Silvuz heisst jetzt Silvanzambi, und im 2D Spiel stehen Spezialkarten mit richtigem Namen (Nedu statt Yesss).",
      "100er Spezialkarten, die vor Liga 3 gezogen wurden, sind aus dem Kader entfernt.",
      "Späte Upgrades bringen weniger, Turnierprämien richten sich nach eurer Liga, und alte Kontostände wurden auf eine Stunde Einkommen gekürzt.",
      "Lobby Codes sind deaktiviert.",
    ],
  },
];
