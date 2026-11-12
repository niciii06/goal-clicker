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
2. **Freischaltung Liga 3:** Das gekaufte Spezialkarten Pack öffnet weiter ab Liga 3 (`PACK_UNLOCK_SEASONS`). Der Grund war die 100er Kategorie. Soll es früher oder bleibt es wegen der Ökonomie?
3. **Normale Packs:** Im Weltklasse Pack (0,001 %) und Legenden Pack (0,01 %) gibt es eine Zeile «Rating 100», aus der die Spezialkarten mit Rating 100 fallen können. Das ist eine Rating Zeile, keine Kategorie, deshalb unverändert. Sollen Spezialkarten nur noch aus dem Spezialkarten Pack kommen?
