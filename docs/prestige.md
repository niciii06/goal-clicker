# Prestige (3. November 2026, neue Regeln vom 5. November 2026)

Nach der Hall of Fame startet «Prestige starten» unter «Spiele» einen neuen Aufstiegslauf in Saison 1.

## Ablauf

1. Der Knopf öffnet ein Auswahlfenster. Er hat eigene Regeln (`getPrestigeBlockReason` in `app/feature-data.ts`): Eine unvollständige Startelf, ein offener Kaderplatz oder ein gesperrter Spieler sperren ihn nie. Gesperrt ist er nur, solange etwas läuft, und dann steht der Grund unter dem Knopf: laufende Partie, noch nicht abgeschlossene Partie (Kadersperre), Auswärtsreise, laufendes Turnier.
2. Alle Spezialkarten im Kader bleiben automatisch. Der Spieler wählt genau eine normale Karte aus seinem Kader, die bleibt. Hat er keine normale Karte, geht es nur mit den Spezialkarten weiter. Eine behaltene Karte kann beim nächsten Prestige wieder gewählt werden.
3. Das Fenster zeigt die bleibenden Spezialkarten, die Auswahl (mit der Wertung inklusive Meilensteinbonus), den neuen Torbonus und was mit Kontostand, Upgrades, Kader und Kartenverbesserungen passiert. «Abbrechen» ändert nichts.

## Was beim Bestätigen passiert

`applyGamePrestige` (`app/game/prestige.ts`) macht alles in einem Schritt, Einzelspieler und Koop rufen dieselbe Funktion auf. Sie ruft `applySeasonPrestige` (`app/feature-data.ts`) für Saison, Kader und Karten auf:

* Saison 1, Spieltag 0, Hall of Fame zurückgesetzt, `prestigeCount` plus 1. Die höchste erreichte Liga bleibt, also bleiben alle Freischaltungen (Packs, Turniere, Formationen, Upgrades).
* Alle 27 Upgrades im Club Office stehen wieder auf Stufe 0, genau wie in einem neuen Spiel (`upgrades: {}`). Klickkraft und passives Einkommen rechnen ab sofort mit diesen Stufen. Freigeschaltete Upgrades kann man sofort wieder kaufen.
* Offene Reisebussen einer angekommenen Reise werden zuerst bezahlt, danach geht der Torkontostand auf 0. Gesamttore, Klicks und andere Lebenszähler bleiben. Fragmente, ungeöffnete Prämienpacks und Vereinssterne bleiben. Prestige gibt keine zusätzlichen Sterne mehr.
* Im Kader bleiben nur die behaltenen Karten. Offene Kaderplätze aus Verkäufen entfallen, Leihen und Angebote für abgegebene Karten fallen weg (die Leihe einer behaltenen Karte bleibt). Danach stellt «Beste Startelf» die behaltenen Karten auf; verletzte, gesperrte oder verliehene Karten bleiben draussen.
* Abgegebene Karten hinterlassen nichts: keine Verletzung, keine Rote Karte, keine Gelbsperre, keine Gelbzähler (Liga und Turniere), keinen vorbereiteten Spielbonus.
* Vorher kommen alle Karten des Kaders ins Sammelalbum (`career.collectedIds`). Abgegebene Karten stehen dort als «Gesammelt · Nicht im Kader».
* Kartenverbesserungen (`rebaseCareerForPrestige` in `app/career-data.ts`): Spezialkarten (Startelf, Bank und Reserve) und die gewählte normale Karte behalten Meilensteine, Wachstum und Form. Alle anderen Karten verlieren sie: `milestoneCards` wird gelöscht, die Kategorie folgt wieder dem Katalog, und die aktuellen Statistiken werden zur Basislinie (`career.milestoneBase` für Meilensteine, `career.growthBase` für das Wachstum der Spezialkarten). Meilensteine zählen nur, was nach dieser Basislinie dazukommt (`getMilestoneStats`). Die Form der letzten fünf Spiele (`recent`) wird geleert, weil sie ebenfalls einen Wertungsbonus gibt. Beispiel: Alexia (91) mit 100 Einsätzen spielt mit 94; wird sie nicht behalten und später wieder gezogen, spielt sie mit 91 und braucht 10 neue Einsätze für 92.
* Die Statistik bleibt vollständig sichtbar (Einsätze, Tore, Berichte, Auszeichnungen). Abgeholte Albumprämien bleiben abgeholt und lassen sich nicht noch einmal abholen. Das Album gibt keine Karte in den Kader zurück.
* Der Starterkader kommt nicht wieder (`starterSquadGranted` bleibt gesetzt, auch bei alten Spielständen ohne Starterkader).
* Neuaufbau: Die Packs bleiben nach der höchsten Liga offen (das Schrottpack kostet 15 000 Tore), Klicks und passives Einkommen beginnen wieder bei den Grundwerten, mit dem Prestige Torbonus.
* Alte Spielstände ohne `milestoneBase` laden unverändert: Frühere Prestiges werden nicht nachträglich umgeschrieben.

## Torbonus

`getPrestigeGoalMultiplier = 1 + 0,20 × prestigeCount`, also +20 %, +40 %, +60 % (additiv). Er gilt einmal auf Klicks (`getClickPower`) und passives Einkommen (`getPassivePower`, `getPassiveIncomePower` für die Zeit im Hintergrund und den Koop Server). Ticketeinnahmen, tägliche Prämie und Pressekonferenz rechnen mit den Grundwerten ohne Bonus, Spielergebnisse bleiben unberührt. Spielstände, die schon mit dem alten Prestige gezählt haben, bekommen den Bonus sofort. Neben dem Torstand steht «Prestige 2 · +40 % Tore».

## Sicherheit

* Einzelspieler: Saison, Kader, Album, Kartenverbesserungen, Upgrades, Kontostand und Zähler ändern sich in einem einzigen Zustandsupdate und werden zusammen gespeichert. Ein Doppelklick zählt einmal (auch Meldung und Ton). Eine Sicherung von vor dem Prestige gewinnt nie gegen den neueren Stand: `prestigeCount` steht in der Rangfolge der Spielstände direkt nach den Gesamttoren (`app/save-safety.ts`).
* Koop (`season-prestige`): Der Server prüft Hall of Fame, die gewählte Karte und laufende Vorgänge am gespeicherten Weltstand. Jede Anfrage hat eine `requestId` (als Beleg in `purchaseReceipts`), dazu `expectedPrestigeCount`. Eine Wiederholung derselben Anfrage ändert nichts (auch keine seither gekauften Upgrades), eine neue Anfrage von einem veralteten Bildschirm wird abgelehnt (`PRESTIGE_ALREADY_STARTED`, mit dem aktuellen Raum). Eine abgelehnte Anfrage speichert nichts. Upgrades, Features und die Sicherungskopie des Raums werden in einem versionierten Update geschrieben, die alten Spalten für ausstehende Käufe werden dabei geleert.
* Hat ein anderer Sitz Prestige gestartet, schliesst sich das offene Fenster mit einem neutralen Hinweis. Ist die Antwort verloren gegangen, sagt das Fenster, dass Prestige nicht bestätigt wurde; dieselbe Anfrage kann gefahrlos wiederholt werden.

## Nationalitäten

Pfuschi, GOAT Nicu, Champ Simu, Flurin Fabrice und Mätthu haben `countryCode: "CH"`. Gesammelte Karten lesen ihre Daten über die ID aus dem Katalog und zeigen die Schweiz sofort an.

Tests: `tests/prestige.test.ts`, `tests/prestige-reset.test.ts` (die elf Regressionstests der neuen Regeln) und der Browser Test «Prestige opens from the Hall of Fame …» in `tests/browser/smoke.test.ts`.
