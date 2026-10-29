// Release notes for the "Was ist neu" window. Every update players notice adds a new entry at the TOP.
// Each player sees the newest entry once; the seen id travels with the account's cloud save.

export type WhatsNewEntry = { id: string; date: string; title: string; items: readonly string[] };

export const WHATS_NEW: readonly WhatsNewEntry[] = [
  {
    id: "2026-10-29-100er",
    date: "29. Oktober 2026",
    title: "100er Karten: gleich selten, legendärer Auftritt",
    items: [
      "Alle 100er Karten sind gleich selten und bekommen den legendären Walkout.",
      "Neben dem Spezialkarten-Pack gibt es 100er jetzt auch im Weltklasse-Pack (0,001%) und im Legenden Pack (0,01%).",
    ],
  },
  {
    id: "2026-10-29-pack-stufen",
    date: "29. Oktober 2026",
    title: "Packchancen passen zur Karte",
    items: [
      "Jede Zeile in den Packchancen ist jetzt eine Kartenstufe: Gewöhnlich bis 70, Profi 71 bis 79, Selten 80 bis 85, Walkout ab 86, Top Walkout ab 90.",
      "Ein teureres Pack hat in jeder Stufe mindestens so gute Chancen wie ein billigeres.",
      "Turnierprämien zeigen ihre Chancen mit denselben Stufen.",
    ],
  },
  {
    id: "2026-10-29-packs-album",
    date: "29. Oktober 2026",
    title: "Packs mit klarer Leiter",
    items: [
      "Jedes teurere Pack beginnt höher und erreicht bessere Karten als das billigere davor.",
      "Top Walkouts bis 99 gibt es nur noch im Legenden Pack, 100er nur im Spezialkarten-Pack.",
      "Flurin Fabrice spielt jetzt auch ZOM.",
      "100er Karten zählen im Sammelalbum nicht mehr als gesammelt, ihre Meilensteinkarten sind entfernt.",
    ],
  },
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
