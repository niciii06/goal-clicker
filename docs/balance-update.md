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

## Nachtrag: Pack-Leiter, Flurin, Sammelalbum

Die Packs bilden jetzt eine Leiter, die nur steigt: Jedes teurere Pack beginnt höher und erreicht bessere Karten als das billigere davor. Normale Packs enthalten keine 100er und keine Spezialkarten mehr, die gibt es nur im Spezialkarten-Pack. Preise und Ligen bleiben.

| Liga | Pack | Standard | Gut | Selten |
|---|---|---|---|---|
| 15 | Schrott-Pack | bis 54 50%, 55 bis 59 35% | 60 bis 64 13% | 65 bis 69 2% |
| 13 | Regional-Pack | 65 bis 72 80% | 73 bis 76 18% | 77 bis 79 2% |
| 11 | Scout Pack | 70 bis 76 75% | 77 bis 79 20% | 80 bis 83 5% |
| 9 | Profi-Pack | 73 bis 79 65% | 80 bis 83 30% | 84 bis 86 5% |
| 7 | Elite Pack | 77 bis 81 60% | 82 bis 85 33% | 86 bis 89 7% |
| 5 | Weltklasse-Pack | 80 bis 84 55% | 85 bis 88 38% | 89 bis 91 7% |
| 4 | Legenden Pack | 83 bis 86 50% | 87 bis 89 40% | 90 bis 99 10% |

* Flurin Fabrice spielt ZM und ZOM.
* Einmalige Album Bereinigung (Feature Schema 8, alle Ligen): Für alle 100er Karten werden Sammelstatus, Meilensteinkarten und die Karrierestatistiken entfernt, aus denen Meilensteine entstehen. Karten im Kader bleiben im Kader. Abgeholte Albumprämien bleiben.
* Der Kaufknopf sitzt in jeder Packkarte am unteren Rand.

## Nachtrag: Packzeilen nach Kartenstufen

Jede Zeile der Packchancen liegt jetzt in genau einer Kartenstufe der Pack-Enthüllung und trägt deren Namen: Gewöhnlich bis 70, Profi 71 bis 79, Selten 80 bis 85 (eigene Animation), Walkout 86 bis 89 (Walkout Animation ab 86), Top Walkout 90 bis 99. `tierBand` in `app/feature-data.ts` bricht beim Start ab, wenn eine Zeile eine Stufe überschreitet. Für jede Stufe hat ein teureres Pack mindestens die Chance eines billigeren.

| Liga | Pack | Gewöhnlich | Profi | Selten | Walkout | Top Walkout |
|---|---|---|---|---|---|---|
| 15 | Schrott-Pack | 100% (bis 69) | | | | |
| 13 | Regional-Pack | 70% (65 bis 70) | 30% | | | |
| 11 | Scout Pack | 35% (68 bis 70) | 62% | 3% | | |
| 9 | Profi-Pack | | 85% | 14% | 1% | |
| 7 | Elite Pack | | 60% (75 bis 79) | 33% | 6% | 1% |
| 5 | Weltklasse-Pack | | 40% (77 bis 79) | 48% | 10% | 2% |
| 4 | Legenden Pack | | | 55% | 35% | 10% |

Die Turnierprämien nutzen dieselben Stufen: Gewöhnlich bis 64, Gewöhnlich 65 bis 70, Profi 71 bis 79, Selten 80 bis 85, Walkout 86 bis 89, Top Walkout 90 bis 99.

## Nachtrag: 100er Karten

* Alle 100er Spezialkarten haben dasselbe `packWeight` (gleich selten) und `cardType: "legendary"`, damit alle den legendären Walkout bekommen.
* Weltklasse-Pack: Legendär 100 mit 0,001%, Legenden Pack: 0,01%. Die Zeile zieht nur aus den 100er Spezialkarten; andere Spezialkarten kommen weiter nur aus dem Spezialkarten-Pack.

## Nachtrag: Vercel Datenvolumen (Fast Origin Transfer)

Am 29. Oktober stand der Hobby Plan bei 9,08 von 10 GB "Fast Origin Transfer" (3,5 GB eingehend, 5,59 GB ausgehend). Ursachen: Der Cloud Upload schickte alle 15 Sekunden den ganzen Spielstand (150 bis 400 KB), Koop Abfragen alle 1,5 Sekunden lieferten bei jeder Änderung der Spielfunktionen den ganzen Stand, und laufende Reisen fragten alle 5 Sekunden ihre Route ab (bis 31 KB).

* `app/api/compression.ts`: JSON Antworten ab 1 KB gehen gzip-komprimiert raus, wenn der Browser es annimmt (Koop, Cloud Speichern, Reisen). Spielstände schrumpfen etwa auf ein Zehntel.
* `app/cloud-sync.ts`: Uploads gehen gzip-komprimiert raus und nur noch jede Minute (plus beim Wegschalten und Schliessen der Seite). Beim Schliessen wird unkomprimiert sofort gesendet.
* `app/api/request-body.ts` liest komprimierte Anfragen; ausgepackt gilt dasselbe Grössenlimit wie vorher.

## Nachtrag: Mehr Einkommen ab Liga 12

Packs dauerten zu lange. Die passiven Upgrades ab Liga 12 bringen 50% mehr (Talent-Scouting 1'200/s, VAR 2.0 1'950/s, Arena-Ausbau 8'250/s, Weltweite Übertragung 28'500/s, Globaler Sponsor 102'000/s, Superclub-Netzwerk 450'000/s). Das Einkommen ab Liga 11 steigt in der Simulation um etwa 70%; ein neues Pack kostet beim Freischalten 10 bis 14 Minuten Einkommen statt rund 20, das Legenden Pack 28 statt 48 Minuten. Der Balance Test erlaubt 8 bis 35 Minuten.
