# Prestige (3. November 2026)

Nach der Hall of Fame startet «Prestige starten» unter «Spiele» einen neuen Aufstiegslauf in Saison 1.

## Ablauf

1. Der Knopf öffnet ein Auswahlfenster. Er hat eigene Regeln (`getPrestigeBlockReason` in `app/feature-data.ts`): Eine unvollständige Startelf, ein offener Kaderplatz oder ein gesperrter Spieler sperren ihn nie. Gesperrt ist er nur, solange etwas läuft, und dann steht der Grund unter dem Knopf: laufende Partie, noch nicht abgeschlossene Partie (Kadersperre), Auswärtsreise, laufendes Turnier.
2. Alle Spezialkarten im Kader bleiben automatisch. Der Spieler wählt genau eine normale Karte aus seinem Kader, die bleibt. Hat er keine normale Karte, geht es nur mit den Spezialkarten weiter. Eine behaltene Karte kann beim nächsten Prestige wieder gewählt werden.
3. Das Fenster zeigt die bleibenden Spezialkarten, die Auswahl, den neuen Torbonus und was mit Kontostand und Kader passiert. «Abbrechen» ändert nichts.

## Was beim Bestätigen passiert

`applySeasonPrestige` macht alles in einem Schritt, Einzelspieler und Koop rufen dieselbe Funktion auf:

* Saison 1, Spieltag 0, Hall of Fame zurückgesetzt, `prestigeCount` plus 1. Die höchste erreichte Liga bleibt, also bleiben alle Freischaltungen (Packs, Turniere, Formationen, Upgrades).
* Torkontostand auf 0. Fragmente, ungeöffnete Prämienpacks, Upgrades und Vereinssterne bleiben. Prestige gibt keine zusätzlichen Sterne mehr.
* Im Kader bleiben nur die behaltenen Karten. Startelf und Bank zeigen nur noch auf sie, offene Kaderplätze aus Verkäufen entfallen, Leihen und Angebote für abgegebene Karten fallen weg.
* Vorher kommen alle Karten des Kaders ins Sammelalbum (`career.collectedIds`). Abgegebene Karten stehen dort als «Gesammelt · Nicht im Kader».
* Der Starterkader kommt nicht wieder (`starterSquadGranted` bleibt gesetzt, auch bei alten Spielständen ohne Starterkader).
* Neuaufbau: Die Packs bleiben nach der höchsten Liga offen (das Schrottpack kostet 15 000 Tore), Klicks und passives Einkommen laufen mit allen Upgrades weiter.

## Torbonus

`getPrestigeGoalMultiplier = 1 + 0,20 × prestigeCount`, also +20 %, +40 %, +60 % (additiv). Er gilt einmal auf Klicks (`getClickPower`) und passives Einkommen (`getPassivePower`, `getPassiveIncomePower` für die Zeit im Hintergrund und den Koop Server). Ticketeinnahmen, tägliche Prämie und Pressekonferenz rechnen mit den Grundwerten ohne Bonus, Spielergebnisse bleiben unberührt. Spielstände, die schon mit dem alten Prestige gezählt haben, bekommen den Bonus sofort. Neben dem Torstand steht «Prestige 2 · +40 % Tore».

## Sicherheit

* Einzelspieler: Saison, Kader, Album, Kontostand und Zähler ändern sich in einem einzigen Zustandsupdate und werden zusammen gespeichert.
* Koop (`season-prestige`): Der Server prüft Hall of Fame, die gewählte Karte und laufende Vorgänge am gespeicherten Weltstand. Jede Anfrage hat eine `requestId` (als Beleg in `purchaseReceipts`), dazu `expectedPrestigeCount`. Eine Wiederholung derselben Anfrage ändert nichts, eine neue Anfrage von einem veralteten Bildschirm wird abgelehnt. Eine abgelehnte Anfrage speichert nichts.

## Nationalitäten

Pfuschi, GOAT Nicu, Champ Simu, Flurin Fabrice und Mätthu haben `countryCode: "CH"`. Gesammelte Karten lesen ihre Daten über die ID aus dem Katalog und zeigen die Schweiz sofort an.

Tests: `tests/prestige.test.ts` und der Browser Test «Prestige opens from the Hall of Fame …» in `tests/browser/smoke.test.ts`.
