# Spezialkarten: alle gleich wahrscheinlich

Verbindliche Regel (Nicolas, 12. November 2026): Es gibt nur noch die Kategorie «Spezialkarten». Die Kategorie «100er Karten» existiert nicht mehr.

## Umgesetzt

* **Ein Zug für alle:** Das Spezialkarten Pack (gekauft für 50'000 Fragmente und das Gratis Pack der Tagesprämie) wählt unter allen N Spezialkarten mit **genau 1 zu N**, mit einer einzigen Zufallszahl (`drawRandomStarXICustomCard`). Rating, `packRating`, `packWeight` und Besitz haben keinen Einfluss. Kein Neuwurf, keine Pity Regel, keine Bevorzugung fehlender Karten.
* **Duplikate bleiben erlaubt:** Die Chance auf ein Duplikat ist der Besitzanteil (3 von 10 Karten besessen ergeben 30 %). `getSpecialCardPackOdds` liefert `each`, `newCard` und `duplicate`.
* **Entfernt:** `SPECIAL_PACK_HUNDRED_CHANCE` (8 %), `SPECIAL_PACK_GROUPS`, `canDrawHundredSpecialCards`, die Option `allowHundred`, die Sperre «Gratis Pack unterhalb Liga 3 gibt keine 100» in `openEarnedPack`, `hundredChance` und die Texte «nur 8% sind 100er» und «100er gibt es erst ab Liga 3». Die Pack Kachel zeigt «Jede Karte: 10 %» statt «100er Karte».
* **Geschützt:** Kaufpreis (50'000), Quittungen und Doppelgutschrift Schutz, gespeicherte und geöffnete Packs, Ratings, alle Karten und Identitäten. Die einmaligen Reparaturen alter Spielstände (Schema 6 und 8) sind unverändert.
* **Duplikat Entschädigung: genau 25'000 Fragmente** je Spezialkarten Duplikat (`SPECIAL_CARD_DUPLICATE_FRAGMENTS`, Bestätigung von Nicolas am 12. November 2026), unabhängig von Rating und Karte, aus jedem Pack (gekauft, Gratis, solo, Koop, ältere Clients über `star-custom-buy`). Alle übrigen Kartentypen behalten ihre Regeln (Basis, Icon: Ratingstufe mal 15 bzw. 75). Ein bereits gespeichertes Ergebnis (`opening.fragmentCompensation`) wird nie neu berechnet, ein Pack lässt sich nicht zweimal gutschreiben.

## Folge für die Ökonomie (bitte wissen)

Von den 10 Spezialkarten haben 8 das Rating 100 und 2 das Rating 67. Mit gleicher Chance sind **80 % der Züge 100 bewertete Karten** (vorher 8 %). Das gilt auch für das Gratis Pack, das unterhalb Liga 3 vorher nie eine 100 gab.

## Offene Fragen an Nicolas

1. ~~Höhe der Duplikat Entschädigung~~ entschieden: 25'000. Ein Duplikat bringt damit einen halben Packpreis zurück, bei 80 % Karten mit Rating 100.
2. ~~Freischaltung Liga 3~~ geprüft, **Sperre bleibt** (siehe unten).
3. ~~Normale Packs~~ entschieden: Weltklasse und Legenden Pack bleiben im bisherigen Format mit ihren Rating Zeilen.

## Liga 3 Freischaltung des Spezialkarten Packs: Herkunft geprüft, Sperre bleibt

Kriterium aus Notion: nur entfernen, wenn sie nachweislich **ausschliesslich** an der alten 100er Kategorie hängt. Das ist nicht eindeutig belegt, und es gibt einen eigenständigen Fortschrittsgrund. Deshalb bleibt die Sperre (`PACK_UNLOCK_SEASONS.special` = 13, also Liga 3).

**Für eine Bindung an die 100er Kategorie**
* Commit `e346a75` (29. Oktober 2026) führt sie ein: «Spezialkarten-Pack erst ab Liga 3, 50'000 Fragmente, nur 8% 100er». Vorher war das Pack ab Liga 15 offen (`special: 1`).
* Kommentar in `app/season-progression.ts` bisher: «holds the 100 rated cards, so it opens only in Liga 3».
* Die einmalige Spielstand Reparatur (Schema 6, `removeEarlyHundredSpecialCards` in `app/feature-data.ts`) entfernt 100er Spezialkarten aus Spielständen unterhalb Liga 3. Sie bleibt unverändert, weil sie alte Spielstände betrifft.

**Eigenständige Gründe (Fortschritt und Ökonomie)**
* `docs/balance-update.md`, Zeile 3: Die Neuordnung entstand, weil das Pack ab Liga 15 offen war und in 70 % der Züge Karten mit Rating 100 gab, ein Club in Liga 5 hatte dadurch schon Star XI Rating 93. Das ist ein Problem des Fortschritts und der Ökonomie, nicht der Kategorie.
* Zeile 67 und 23: Die Packs bilden «eine Leiter, die nur steigt», das Spezialkarten Pack (50'000 Fragmente) steht als Stufe 3 oben. Der Code Kommentar dazu: «every pack opens in the league whose opponents match its cards» (`app/season-progression.ts`).
* Zeile 231: Die Liga 3 Sperre hängt an `packRating` der Karte, nicht an einer Kategorie Zuordnung.
* Folge der neuen Regel: Bei gleicher Chance sind 8 von 10 Spezialkarten Rating 100, also 80 % der Züge. Ohne Sperre wäre genau der damalige Zustand zurück (starkes Pack ab Liga 15).
* Tests und Anzeige: `tests/progression-shop.test.ts` (Zeilen 23 bis 30), Kauf Sperre im Client (`app/game-app.tsx`, Kauf und Kachel) und auf dem Server (`app/api/multiplayer/route.ts`, Aktion `special-pack`).

**Ergebnis:** Der Lock bleibt vorerst bestehen. Eine Änderung bräuchte eine eigene Ökonomie Entscheidung (ab welcher Liga, mit welchen Folgen für Fragmente und Kartenstärke). Das Gratis Pack der Tagesprämie ist nicht an die Liga gebunden und zieht schon mit der gleichen Chance.
