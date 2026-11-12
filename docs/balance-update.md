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

## Nachtrag: Packender Start

* **Willkommenspack:** Ein ganz neuer Club (kein Spielstand im Browser und keiner im Konto) öffnet beim ersten Start ein Gratis-Pack mit einer garantierten Walkout-Karte 86 bis 89 (keine Icons, keine Spezialkarten) und sieht die Walkout-Show (`grantWelcomePack` in `app/feature-data.ts`).
* **Schnellerer Anfang:** Die fünf Upgrades aus Liga 15 kosten die Hälfte und bringen dreimal so viel (Schnellere Stiefel +3 pro Klick ab 12, Balljunge +3/s ab 60, Schusstechnik +9 pro Klick ab 130, Torinstinkt +15 pro Klick ab 700, Taktiktafel +45/s ab 1'750). Erstes gekauftes Pack nach etwa 3 Minuten bei 3 Klicks pro Sekunde (vorher 9), nach etwa 5 Minuten bei 1 Klick pro Sekunde (vorher 21); volle Startelf nach 5 bzw. 8 Minuten. Das Regional-Pack kostet beim Freischalten 11 statt 19 Minuten Einkommen; ab Liga 12 bleibt alles gleich.

## Nachtrag: Rechnung nur mit Einkommen pro Sekunde und VAR

Die Simulation (`scripts/balance/economy-model.ts`) rechnet jetzt standardmässig nur mit passivem Einkommen: Der erste Balljunge kommt aus ein paar Klicks (60 Tore), danach klickt niemand mehr. Packzeiten werden als Median aus vielen Durchläufen gemessen, in denen VAR und Ereignisse wie im Spiel alle 1 bis 3 Minuten den Kontostand treffen (`medianSavingMinutes`). VAR und Johhny Elefantino bleiben unverändert.

* **Passive Upgrades günstiger:** halber Grundpreis und 40% weniger Preisaufschlag pro Stufe (z.B. Superclub-Netzwerk 90 Mio statt 180 Mio, +22,8% statt +38% pro Stufe).
* **Packpreise:** Regional 2 Mio (vorher 10 Mio), Scout 25 Mio (50 Mio), Profi 130 Mio (350 Mio), Elite 1,5 Mrd (3 Mrd), Weltklasse 5 Mrd (6 Mrd), Legenden 10 Mrd (15 Mrd).
* **Ergebnis beim Freischalten (Median mit VAR):** neue Packs 7 bis 9 Minuten, Legenden Pack gut 12 Minuten. `tests/rebalance.test.ts` hält 6 bis 10 Minuten fest, beim Legenden Pack 10 bis 14.

**Korrektur am selben Tag:** Die Wartezeiten steigen jetzt von Pack zu Pack. Preise: Regional 1,5 Mio, Scout 20 Mio, Profi 130 Mio, Elite 1,6 Mrd, Weltklasse 8 Mrd, Legenden 10 Mrd. Median mit VAR beim Freischalten: 6,5 / 7,9 / 8,2 / 9,4 / 9,8 / 12,2 Minuten. Der Balance Test verlangt, dass jedes spätere Pack länger dauert als das vorherige.

## Nachtrag 30. Oktober: Balancepaket nach externem Review

Ein externes Review (ChatGPT, auf Stand `ebc083a`) hat die Balance geprüft. Übernommen wurde, was die Simulation bestätigt. VAR, Johhny Elefantino, die 100er Ziehchancen und die Gegner ausser Liga 1 bleiben unverändert. Alle Werte unten sind Ergebnisse von `npx tsx scripts/balance/simulate-economy.mts`; die Grenzen hält `tests/balance-review.test.ts` fest.

### Start

* **Schrott-Pack ohne Karten unter 55:** 55 bis 59 mit 35%, 60 bis 64 mit 50%, 65 bis 69 mit 15% (vorher 50% unter 55, also schlechter als ein leerer Platz). Die 137 schwächeren Schrottkarten bleiben bei den Clubs, die sie haben, kommen aber nicht mehr aus dem Pack. Das Album "Alle Schrottkarten" zählt nur noch die 81 Karten, die es noch gibt.
* **Starterkader:** Nach 50 Klicks füllt `maybeGrantStarterSquad` einmalig jede freie Position der Startelf mit einer passenden Schrottkarte (55 bis 59, wo die Position das hergibt). Die Startelf verlangt passende Positionen (`canStarXIPlayerFillSlot`), darum wählt der Kader pro Platz. Die Prüfung läuft nach jedem Klick und nach dem Laden, also bekommen auch alte Spielstände mit mehr als 50 Klicks und weniger als elf Spielern die Hilfe einmal. "Startelf komplett" erscheint nur, wenn wirklich elf Spieler aufgestellt sind. Im Koop gibt es den Kader einmal pro Welt (Aktion `starter-squad`, geschützt durch die Versionsprüfung beim Speichern).

### Preise, alle rund

Packpreise und Grundpreise der Upgrades: erlaubt sind nur 1 / 1,5 / 2 / 2,5 / 3 / 4 / 5 / 6 / 7,5 / 8 mal einer Zehnerpotenz. Die weiteren Upgradestufen sind auf zwei signifikante Stellen gerundet und steigen streng an (siehe "Stufenpreise mit zwei Stellen").

| Pack | vorher | neu | Liga | Median passiv / P90 | 1 aktiv | Koop 2 | Koop 4 |
|---|---|---|---|---|---|---|---|
| Regional | 1,5 Mio | 1 Mio | 13 | 4,1 / 6,1 | 0,9 / 0,9 | 0,5 / 0,5 | 0,3 / 0,3 |
| Scout | 20 Mio | 15 Mio | 11 | 5,6 / 10,6 | 3,5 / 4,9 | 2,2 / 3,2 | 1,4 / 1,7 |
| Profi | 130 Mio | 100 Mio | 9 | 6,1 / 11,7 | 4,8 / 7,6 | 3,8 / 5,5 | 2,5 / 3,4 |
| Elite | 1,6 Mrd | 1,5 Mrd | 7 | 8,6 / 20,5 | 7,2 / 16,4 | 6,0 / 11,8 | 4,3 / 6,8 |
| Weltklasse | 8 Mrd | 10 Mrd | 5 | 9,8 / 24,4 | 7,9 / 18,1 | 5,8 / 10,8 | 3,6 / 5,0 |
| Legenden | 10 Mrd | 20 Mrd | 4 | **13,9** / 34,0 | 9,7 / 24,6 | 8,0 / 18,2 | 5,2 / 8,7 |

Minuten bis das Pack beim Freischalten angespart ist, Median und P90 (die Wartezeit, die 10% der Durchläufe überschreiten), mit VAR und Ereignissen. **Ziel für das Legenden Pack: passiver Median 12 bis 14 Minuten.** Aktiv heisst 3 Klicks pro Sekunde mit voller Combo pro Spieler; im Koop teilen sich alle das passive Einkommen.

Mit dem Raster aus runden Preisen gab es nur eine Reihe, in der jedes Pack länger dauert als das vorherige und Legenden zwischen 12 und 14 Minuten liegt; dafür sind die frühen Packs etwas günstiger geworden. Weil die Mediane in Sprüngen von etwa einer VAR Runde wachsen, liegt Legenden mit 13,9 Minuten am oberen Rand.

Upgrade Grundpreise gerundet: Schnellere Stiefel 10, Schusstechnik 150, Torinstinkt 750, Taktiktafel 800, Nachwuchsakademie 6'000, Flutlichtanlage 25'000, Globaler Sponsor 15 Mio, Superclub-Netzwerk 100 Mio, Goldener Schuh 1 Mrd.

### Neue passive Upgrades ab Liga 6

| Upgrade | Liga | Preis | Ertrag | Faktor | Amortisation erste Stufe |
|---|---|---|---|---|---|
| Stadionrechte | 6 | 100 Mio | 300'000/s | 1,24 | 5,6 min |
| Fanshop | 5 | 150 Mio | 425'000/s | 1,25 | 5,9 min |
| Internationale Marke | 4 | 200 Mio | 500'000/s | 1,26 | 6,7 min |
| Fussballcampus | 3 | 300 Mio | 700'000/s | 1,27 | 7,1 min |
| Partnerclubs | 2 | 400 Mio | 900'000/s | 1,28 | 7,4 min |
| Fussballimperium | 1 | 600 Mio | 1,3 Mio/s | 1,29 | 7,7 min |

Passives Einkommen beim Ligastart: Liga 6 12,6 Mio/s, Liga 5 19,7, Liga 4 29,1, Liga 3 39,9, Liga 2 54,3, Liga 1 88,9 (vorher 12,4 bis 20,4). Der Schnitt pro Liga wächst ab Liga 6 um 36% bis 75% pro Liga (Test: mindestens 25%).

### Klickupgrades

Die sechs späten Klickupgrades geben zusätzlich zu den festen Toren pro Klick einen Anteil am passiven Grundeinkommen (`getBasePassivePower`, ohne Turnierboosts). Jedes Upgrade hat einen eigenen Höchstanteil, zusammen genau **5% pro Klick** (`CLICK_PASSIVE_SHARE_CAP`). So drängen billige Upgrades die teuren nicht aus dem Deckel. Der Goldene Schuh erhöht nur die festen Tore. Bei 3 Klicks pro Sekunde und vollem Ausbau sind das +15% ohne Combo, mit voller Combo und Serie (×2 × 1,1 × 1,02) etwa **+34%**.

| Upgrade | Preis vorher | neu | Anteil pro Stufe | Höchstanteil |
|---|---|---|---|---|
| Killerstürmer | 7'500 | 1'000 | 0,01% | 0,2% |
| Distanzschütze | 75'000 | 15'000 | 0,02% | 0,3% |
| Freistoss-Spezialist | 750'000 | 50'000 | 0,04% | 0,4% |
| Weltklasse-Abschluss | 7,5 Mio | 250'000 | 0,06% | 0,6% |
| Ballon-d'Or-Angreifer | 75 Mio | 4 Mio | 0,11% | 1,1% |
| Kapitänsbinde | 350 Mio | 75 Mio | 0,3% | 2,4% |

Ein erster Versuch mit nur einem gemeinsamen Deckel zeigte das Problem: Billige Klickupgrades füllten die 5% schon vor Liga 6, die Kapitänsbinde brachte danach nur noch die festen +500 und amortisierte sich in 371 Minuten. Mit eigenen Höchstanteilen bringt jede Stufe etwas. Tatsächlicher Mehrertrag nach dem Deckel beim Kauf ab Liga 6, Club mit 3 Klicks pro Sekunde und voller Combo:

| Kapitänsbinde | Preis | +/s bei 1 Klick/s | +/s bei 3 Klicks/s | Amortisation |
|---|---|---|---|---|
| Stufe 1 | 75 Mio | 89'600 | 268'800 | 4,6 min |
| Stufe 2 | 106,5 Mio | 89'600 | 268'800 | 6,6 min |
| Stufe 3 | 151,2 Mio | 89'600 | 268'800 | 9,4 min |
| Stufe 4 | 214,7 Mio | 89'600 | 268'800 | 13,3 min |
| Stufe 5 | 304,9 Mio | 89'600 | 268'800 | 18,9 min |
| Stufe 6 | 433 Mio | 89'600 | 268'800 | 26,8 min |
| Stufe 7 | 614,9 Mio | 89'600 | 268'800 | 38,1 min |
| Stufe 8 | 873,1 Mio | 89'600 | 268'800 | 54,1 min |

Ballon-d'Or-Angreifer ab Liga 9: Stufe 1 14,9 min, Stufe 8 142 min. Weltklasse-Abschluss ab Liga 11: Stufe 1 4,5 min, Stufe 8 35 min.

### Belohnungen

* **Turnierprämien gedeckelt:** Stadionpokal höchstens Basis-Prämienpack (Stufe 2), Champions Cup höchstens Hochwertiges Prämienpack (Stufe 4), WM bis Top-Prämienpack.
* **Matchstempel (abgeschafft am 12. November 2026):** Früher gab jedes beendete Ligaspiel einen Stempel, beim vierten ein Prämienpack. Ligaspiele geben keine Packs mehr. Turniersiege geben weiterhin ihr Prämienpack, schon verdiente Packs bleiben öffnbar, ein alter Zähler `matchStamps` im Spielstand wird nur noch gelesen.
* **Albumziele:** 10, 25 und 50 verschiedene Karten geben einmalig 100, 250 und 500 Fragmente.
* **Tagesprämie:** Tag 7 gibt ein Gratis Spezialkarten-Pack statt des Basis-Prämienpacks. Unter Liga 3 kommen daraus keine 100er, ab Liga 3 gilt die normale Chance von 8%. Im Koop gibt es die ganze Tagesprämie (Tore und Pack) nur einmal pro Welt und Tag, alle sehen denselben Fortschritt. Alte Welten mit einem Eintrag pro Sitz werden beim Laden zusammengeführt: Hat irgendein Sitz heute abgeholt, gilt die Welt heute als abgeholt; die Serie ist die längste, die noch läuft. Parallele Abholungen schützt das Speichern mit `UPDATE … WHERE shared_state_version = …` (`db.updateRoom`); `tests/rewards-api.test.ts` lässt vier Spieler gleichzeitig abholen und prüft den gespeicherten Kontostand und die gespeicherten Packs.
* **Liga 1:** Gegner 96, 90, 91, 94, 92 statt 98, 92, 91, 96, 94.

### Karrieren mit Packkäufen, Partien und Ereignispausen

Neues Modell `scripts/balance/progression-model.ts`. Annahmen: 2 Minuten Büro, 1 Minute Reise und 4 Minuten Partie pro Spieltag; VAR und Ereignisse nur im Büro. Upgrades, die sich in 15 Minuten lohnen, kommen vor dem Ansparen; sonst kauft der Club das beste freigeschaltete Pack. Nach jeder Partie gibt es die Medienprämie, bei Heimspielen Tickets. Dazu kommen Matchstempel, eine Turnierprämie pro Saison und eine Tagesprämie pro Stunde Spielzeit. Aufstieg ist wahrscheinlich, wenn die besten elf Karten klar über dem Schnitt der Gegner liegen. Es sind 25 Karrieren pro Modus.

| Liga | passiv: Minuten in der Liga | passiv: Wartezeit nächstes Pack | 1 aktiv: Wartezeit nächstes Pack |
|---|---|---|---|
| 15 bis 6 | 70 / 70 | 0 bis 3,8 / bis 7,3 | 0 bis 2,8 / bis 5,0 |
| 5 | 70 / 70 | 6,0 / 21,5 | 3,0 / 18,3 |
| 4 | 70 / 140 | 11,5 / 35,0 | 4,0 / 26,3 |
| 3 | 70 / 140 | 13,0 / 49,0 | 7,3 / 26,8 |
| 2 | 140 / 210 | 8,3 / 29,3 | 6,0 / 21,3 |
| 1 | 140 / 350 | 5,3 / 21,5 | 4,8 / 13,0 |

Werte: Median / P90 in Minuten. Die volle Startelf steht nach 50 Klicks, also nach unter einer Minute. Offene Punkte: In Liga 5 bis 3 wartet jeder zehnte passive Club über 20 bis 49 Minuten auf das nächste Pack, weil das VAR Pech dort mit den teuersten Packs zusammentrifft. In Liga 1 und 2 braucht ein Club oft zwei Saisons.

## Nachtrag 2. November: Special Cards wachsen von 80 auf 100

Alle zehn Special Cards (auch Pfuschi und Mikeboy Jr.) starten mit 80 OVR und haben Potenzial 100. Sie wachsen nur mit den Punkten ihrer Partien, Meilensteine gibt es für sie nicht mehr:

* Punkte für jede Partie, in der die Karte gespielt hat (Startelf oder eingewechselt), nach dem Resultat nach 90 Minuten: Sieg 3, Unentschieden 1, Niederlage 0. Geht eine Partie in die Verlängerung oder ins Elfmeterschiessen, war es nach 90 Minuten unentschieden: 1 Punkt, egal wer weiterkommt. Alle 5 Punkte +1 OVR, also 100 Punkte bis 100 (etwa 34 Siege, mit gemischter Bilanz rund 50 bis 60 Partien).
* Tore, Vorlagen und Spieler des Spiels zählen nicht.
* Der Punktezähler (`points` in der Karrierestatistik) ist neu, deshalb beginnen alle Karten bei 0, auch in bestehenden Spielständen und Welten. Bestehende 100er fallen auf 80. `career.growthBase` hält den Startpunkt fest (Karriere Version 3).
* Das Wachstum wirkt im Spiel: Es fliesst wie die Meilensteinboni über `careerBonuses` in die Spielstärke (für Karten mit Potenzial bis +20 statt +5) und in die Beste Elf.
* Packs bleiben gleich: `packRating` hält die frühere Stufe (100 oder 67) für Packzeilen, Seltenheit, Liga 3 Sperre, Special Card Pack Chance und Duplikat Entschädigung. Preis und Pack Gewichte sind unverändert.
* Pfuschi bleibt Spasskarte: nur Bank, absichtlich schlechte Werte.
* Anzeige im Spielerprofil: „OVR 83 · Potenzial 100 · noch 2 Punkte bis 84“; im Verlauf erscheint jede neue Stufe.
* Multiplayer Protokoll 14, damit alte Clients nach dem Update neu laden. Kein Eintrag in „Was ist neu“.

Code: `app/feature-data.ts` (`SPECIAL_START_RATING`, `SPECIAL_POTENTIAL`, `cardPackRating`), `app/career-data.ts` (`getSpecialGrowth`, `MATCH_RESULT_POINTS`, `GROWTH_POINTS_PER_LEVEL`), Anzeige in `app/career-panels.tsx`. Tests: `tests/special-growth.test.ts`, `tests/career.test.ts`.


## Nachtrag 6. November: Belohnungen am Einkommen, runde Stufenpreise, Fanstimmung

Entscheid des Besitzers (Runde 2, Punkte 7 und 8). Massstab ist überall das passive Grundeinkommen `getBasePassivePower` (ohne Turnierboost und Prestige).

### VAR und Ereignisse in Sekunden Einkommen

Bisher bemassen sich VAR und Ereignisse am Kontostand: Wer sparte, verlor mehr, und Johhny Elefantino nahm alles. Jetzt zählen Sekunden Einkommen (`resolveVarEvent`, `resolveRandomEvent` in `app/feature-data.ts`). Die Werte treffen, was ein typischer Club vorher sah: Er hat beim Ereignis im Median etwa vier Minuten Einkommen auf dem Konto.

| Ereignis | vorher | jetzt |
|---|---|---|
| VAR gibt frei (20%) | 50% bis 250% des Kontos | 2 bis 9 Minuten Einkommen |
| VAR greift ein (80%) | 10% bis 70% des Kontos | 25 bis 170 Sekunden, höchstens der Kontostand |
| Sponsor / Fans | 2,5% / 1,8% des Kontos | 6 / 4 Sekunden, mindestens 80 / 40 Tore |
| Platzregen / Verletzung | 1,2% / 1,6% des Kontos | 3 / 4 Sekunden, mindestens 20 / 30, höchstens der Kontostand |
| Johhny Elefantino (1%) | das ganze Konto | das Konto, höchstens 10 Minuten Einkommen |

Typischer Ausschlag (Simulation): VAR Median vorher etwa minus 70 Sekunden Einkommen, jetzt minus 79; Ereignis Median vorher plus 3,7, jetzt plus 4. Der grösste Verlust fällt von 1'356 auf 600 Sekunden. Ein Club ohne passives Einkommen zählt als 1 Tor pro Sekunde.

### Minigames und Album am Einkommen

* **Minigames:** Der beste Lauf zahlt 10 Sekunden Einkommen (Matchday Tipp 15), ein schwächerer Lauf seinen Anteil davon. Die bisherigen festen Beträge bleiben die Untergrenze (`scaleMiniGameReward` in `app/game/economy.ts`). Wer alle vier Minigames spielt, sobald sie bereit sind, verdient etwa ein Drittel mehr, so viel wie mit 3 Klicks pro Sekunde und voller Combo. Der Koop Server deckelt mit derselben Formel (`getMiniGameMaxReward`).
* **Album:** Jede Gruppe zahlt weiter ihre Fragmente und dazu Tore: Meilensteine 10 / 25 / 50 Karten 1 / 2 / 5 Minuten Einkommen, jede Nation 2, Schrottkarten 5, Icons und Legendäre je 15, alle Basiskarten 30 Minuten (`claimAlbumRewards` in `app/career-data.ts`). Die Tore richten sich nach dem Einkommen beim Abholen.
* Koop Missionen bleiben unverändert, sie werden durch Wochenziele ersetzt.

### Stufenpreise mit zwei Stellen

Stufe 0 kostet den runden Grundpreis. Jede weitere Upgradestufe kostet den Wert der bisherigen Kurve (Grundpreis mal Faktor hoch Stufe), gerundet auf zwei signifikante Stellen: 12, 150, 4'800, 1,2 Mio, 9,9 Mrd; unter 10 ganze Zahlen ab 1 (`getUpgradeCostAtLevel` in `app/upgrade-purchase.ts`). Jede Stufe kostet mehr als die vorherige; landet die Rundung auf dem Preis der Stufe davor oder darunter, gilt der nächste Wert mit zwei Stellen darüber. Die Preise entstehen aus ganzzahliger Mantisse und Exponent, auch bei 1e26 und mehr gibt es keine Rechenreste. Client, Server und Koop rechnen mit derselben Funktion, Mehrfachkauf zählt dieselben Stufenpreise zusammen.

Vorher lagen alle Stufen auf dem groben Raster der Grundpreise, darum kosteten oft zwei bis drei Stufen hintereinander gleich viel. Beispiel Kapitänsbinde Stufe 0 bis 10: 75 / 110 / 150 / 210 / 300 / 430 / 610 / 870 Mio / 1,2 / 1,8 / 2,5 Mrd (vorher 75 / 100 / 150 / 200 / 300 / 400 / 600 / 800 Mio / 1 / 2 / 2,5 Mrd). Balljunge Stufe 10 bis 16: 93 / 100 / 120 / 130 / 150 / 160 / 180 (vorher 100 / 100 / 100 / 150 / 150 / 150 / 200).

In der Simulation bleiben die Packwartezeiten (Median und P90, passiv) gleich, das passive Einkommen pro Liga ändert sich um höchstens etwa 1,5%.

### Prämienpacks ohne Karten unter 55

Die schwächste Zeile der Prämienpacks heisst jetzt "Gewöhnlich 55–64" (vorher "bis 64"), mit denselben Chancen; die angezeigten Chancen sind genau die gezogenen. Karten unter 55 kommen damit aus keinem Pack mehr. Darum zählt eine Nationengruppe im Album nur noch Karten ab 55 (`MIN_DRAWABLE_RATING`): **Nation IN** hat jetzt die 81 Karten des Schrott-Packs statt 218 und ist mit dem Schrott-Pack allein komplett. Gesammelte schwächere Karten bleiben im Album, abgeholte Prämien bleiben.

### Fanstimmung

Nach jeder Partie einmal (solo und Koop, in `recordCareerMatch`): Sieg +3, Unentschieden +1, Niederlage minus 3, dazu für jede volle 10 Punkte Abstand ein Punkt zurück Richtung 50 (`applyMatchResultToFanMood` in `app/press-conference.ts`). Ein Elfmeterschiessen zählt als entschieden. Eine Siegesserie pendelt sich bei etwa 80 ein, eine Niederlagenserie bei etwa 20. Die Stimmung wirkt wie bisher auf Zuschauer und Tickets des nächsten Heimspiels.

### Simulation vorher und nachher

`npx tsx scripts/balance/simulate-economy.mts`, Minuten bis das Pack beim Freischalten angespart ist (passiv, Median / P90):

| Pack | vorher | jetzt |
|---|---|---|
| Regional | 4,1 / 6,1 | 4,8 / 10,1 |
| Scout | 5,6 / 10,6 | 6,3 / 13,2 |
| Profi | 6,1 / 11,7 | 6,5 / 15,3 |
| Elite | 8,6 / 20,5 | 8,0 / 18,8 |
| Weltklasse | 9,8 / 24,4 | 9,5 / 20,6 |
| Legenden | 13,9 / 34,0 | 13,1 / 25,4 |

Die Mediane bleiben fast gleich und steigen weiter von Pack zu Pack, Legenden liegt im Ziel 12 bis 14. Die langen Wartezeiten der teuren Packs (P90) werden deutlich kürzer, weil der VAR kein grosses Konto mehr halbiert; bei den billigen Packs sind sie etwas länger, weil ein Verlust jetzt nicht mehr vom kleinen Kontostand abhängt. Im Karrieremodell (100 Karrieren) steigt die typische Wartezeit des passiven Clubs in Liga 5 bis 1 um 3 bis 7 Minuten (vorher halfen grosse VAR Gewinne auf grossen Konten), dafür fallen die P90 Werte von bis zu 47 auf höchstens 27 Minuten. Ein rein passiver Club braucht in Liga 1 im Median 210 statt 140 Minuten; mit einem aktiven Spieler bleibt es bei 140. Die Grenzen in `tests/rebalance.test.ts` sind unverändert; `tests/balance-review.test.ts` prüft zusätzlich die Stufenpreise (zwei Stellen, streng steigend), Minigame und Albumprämien, Prämienpacks ab 55, Nation IN, die Ereignisse und die Fanstimmung.
