# Balance Update vom 29. Oktober 2026

Ein Club in Liga 5 hatte schon ein Star XI Rating von 93, die Gegner dort liegen bei etwa 76 bis 82. Gründe: Das Spezialkarten-Pack war ab Liga 15 offen und gab in 70% der Züge einen 100er, doppelte 100er zahlten den nächsten Zug fast ganz, das Scout Pack und die Turnierprämien waren für die ersten Ligen viel zu stark, und ab Liga 11 explodierte das Einkommen (VAR 2.0 bis Superclub amortisierten sich in 30 bis 40 Sekunden). In Liga 6 kostete ein Legenden Pack nur etwa 30 Sekunden Einkommen.

## Spezialkarten

* Flurin Fabrice ist jetzt eine 100er Spezialkarte (ZM).
* Spezialkarten-Pack: ab **Liga 3**, **50'000 Fragmente**, nur **8%** der Züge geben einen 100er (darin gewichtet nach `packWeight`, GOAT Nicu bleibt der seltenste). Sonst kommt Pfuschi oder Mikeboy Jr.
* Doppelte Spezialkarten geben höchstens 5'000 Fragmente zurück (vorher bis 20'400).
* Einmalige Migration (Spielstand Version 6): Wer Liga 3 noch nicht erreicht hat, verliert alle 100er Spezialkarten aus Kader, Bank und Sammelalbum. Später gezogene 100er bleiben.

## Packs nach Liga

| Liga | Pack | Preis | Inhalt | 100er |
|---|---|---|---|---|
| 15 | Schrott-Pack | 15'000 | bis 69 | keine |
| 13 | Regional-Pack (neu) | 10 Mio | 85% 65 bis 74, 14% 75 bis 79, 1% 80 bis 85 | keine |
| 11 | Scout Pack | 50 Mio | wie bisher | 0,0001% |
| 9 | Profi-Pack (neu) | 350 Mio | 65% 70 bis 79, 32% 80 bis 85, 3% 86 bis 89 | keine |
| 7 | Elite Pack | 3 Mrd | wie bisher | 0,001% |
| 5 | Weltklasse-Pack (neu) | 6 Mrd | 60% 80 bis 85, 37% 86 bis 89, 3% 90 bis 99 | keine |
| 4 | Legenden Pack | 15 Mrd | wie bisher | 0,1% |
| 3 | Spezialkarten-Pack | 50'000 Fragmente | Spezialkarten | 8% |

Jedes Pack kostet beim Freischalten etwa 20 Minuten Einkommen, das Legenden Pack etwa 48 Minuten.

Turnierprämien richten sich nach der besten erreichten Liga: Liga 15 bis 13 Kleines Prämienpack, 12 bis 10 Basis, 9 bis 7 Solide, 6 bis 5 Hochwertig, 4 bis 3 Premium, 2 bis 1 Top. Die WM gibt eine Stufe mehr.

## Upgrades

Der Ertrag pro Stufe steht als `gain` im Katalog (`app/game/upgrades.ts`), die Wirtschaft liest ihn von dort. Neue Erträge der späten passiven Upgrades:

| Upgrade | Liga | vorher | jetzt | Amortisation erste Stufe |
|---|---|---|---|---|
| Talent-Scouting | 12 | 1'200/s | 800/s | 4,2 min |
| VAR 2.0 | 11 | 10'000/s | 1'300/s | 5,1 min |
| Arena-Ausbau | 10 | 50'000/s | 5'500/s | 6,1 min |
| Weltweite Übertragung | 9 | 250'000/s | 19'000/s | 7,0 min |
| Globaler Sponsor | 8 | 1,2 Mio/s | 68'000/s | 8,6 min |
| Superclub-Netzwerk | 7 | 6 Mio/s | 300'000/s | 10,0 min |

Bestehende Stufen bleiben, geben aber weniger. Vorhandene Tore bleiben.

## Simulation

`npx tsx scripts/balance/simulate-economy.mts [Klicks pro Sekunde] [Minuten pro Liga]` spielt einen gierigen Club durch (Standard 4 Klicks pro Sekunde, 45 Minuten pro Liga) und gibt Einkommen pro Liga, Amortisation und Packpreise in Minuten Einkommen aus. `tests/rebalance.test.ts` prüft damit: keine passive Amortisation unter 2 Minuten, Einkommen wächst pro Liga höchstens um Faktor 3,5, jedes Pack ausser dem Schrott-Pack kostet beim Freischalten mindestens 15 Minuten Einkommen.

| Liga | Einkommen pro Stunde vorher | jetzt |
|---|---|---|
| 13 | 32 Mio | 32 Mio |
| 11 | 773 Mio | 148 Mio |
| 9 | 21 Mrd | 1,0 Mrd |
| 7 | 490 Mrd | 9,4 Mrd |
| 5 | 630 Mrd | 17 Mrd |
| 3 | 687 Mrd | 20 Mrd |

Beide Spalten zeigen den Schnitt über die ganze Liga.

## Nachtrag: Lobby Codes, Kontostand, "Was ist neu"

* **Lobby Codes deaktiviert:** `redeem-lobby-code` antwortet immer mit "Lobby Codes sind deaktiviert.", das Eingabefeld ist weg. Welten, die AZB früher eingelöst haben, behalten ihren Testmodus.
* **Kontostand gekürzt:** Spielstände mit Feature Schema unter 7 (vor diesem Update) werden beim Laden einmalig auf höchstens eine Stunde passives Einkommen nach den neuen Werten gekürzt, mindestens 1 Mio (`capGoalsAfterRebalance` in `app/game/economy.ts`). Gesamttore und Rangliste bleiben. Gilt für Einzelspieler, Cloud Spielstände und Multiplayer Welten.
* **"Was ist neu" Fenster:** `app/whats-new.ts` hält die Einträge, `app/whats-new-dialog.tsx` zeigt den neuesten einmal. Der Gesehen Status (`goalClickerWhatsNewSeenV1`) gehört zu den Cloud Schlüsseln, daher erscheint das Fenster pro Konto nur einmal, auch über mehrere Geräte. Die Regel für künftige Updates steht in `CLAUDE.md`.
