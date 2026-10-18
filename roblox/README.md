# Goal Clicker für Roblox

Die Roblox Version von Goal Clicker. Die Website in `app/` bleibt unverändert und läuft weiter wie bisher. Dieser Ordner enthält ein eigenständiges Roblox Spiel mit denselben Inhalten.

## Was drin ist

* **Klicken und Upgrades:** Ball mit Combo (bis x3), kritischen Treffern und Serienbonus. Dazu 21 Upgrades mit Kaufmodus x1, x10, x100 und MAX sowie Ränge und Erfolge.
* **Star XI:** 3104 Karten (davon 3007 aus Packs ziehbar, alle FC 27 Icons und Spielerinnen), 29 Formationen, Startelf, Bank (12), Reserve mit Filtern und automatische „Beste Elf“.
* **Packs:** Schrott, Scout, Elite und Legenden Pack mit denselben Wahrscheinlichkeiten wie im Web. Dazu Prämienpacks, Fragmente, Spezialkarten-Zug und Walkout Animationen.
* **Saisonmodus:** 15 Ligen, Tabelle, Auf- und Abstieg, Hall of Fame und Prestige.
* **Turniere:** Stadionpokal, Champions Cup und Weltmeisterschaft mit Verlängerung, Elfmeterschiessen, Goal Gazette und Goalboost.
* **Live Spiel:** Dieselbe Spielzug Simulation wie im Web (Pässe, Dribblings, Schüsse, Karten, Verletzungen). Mit 2D Ansicht, 3D Ansicht direkt im Stadion, Wechseln und Taktik in den Pausen, Liveticker, Statistik und Noten.
* **Reisen:** Auswärtsspiele mit Teambus, Zug oder Flugzeug. Die Reisepläne kommen aus dem Webcode.
* **Karriere:** Form, Meilensteinkarten, Saisonauszeichnungen, Rivalitäten und Derbys, Matcharchiv, Reisestatistik und Sammelalbum.
* **Club Welt:** Fabrizio Romario (Leihen, Verkäufe, Deadline Day), Zufallsereignisse, VAR, Pressekonferenzen, tägliche Prämie, vier Minispiele, Codes (zum Beispiel `SILVAN`), Missionen und Verlauf.
* **Koop:** Gemeinsame Welten für bis zu vier Spieler auf demselben Server.
* **Roblox Extras:** Speichern über DataStore mit Sperre gegen doppeltes Laden, globale Rangliste, leaderstats (Tore, Pokale) und ein begehbares 3D Stadion mit klickbarem Riesenball.

Alles Wichtige rechnet der Server. Der Client schickt nur Absichten (klicken, kaufen, aufstellen). Gewinne, Packs und Spielergebnisse lassen sich so nicht fälschen.

## Ordner

| Pfad | Inhalt |
|---|---|
| `src/shared` | Spiellogik (läuft auf Server und Client) und `Data/` mit den exportierten Spieldaten |
| `src/server` | Server: Aktionen, Speichern, Koop, Synchronisation, Stadion |
| `src/client` | Oberfläche, Live Spielansicht, Ansagen |
| `tests` | Tests der Spiellogik (laufen ohne Roblox) |
| `tools/export-data.ts` | Überträgt die Spieldaten aus `app/` nach `src/shared/Data` |
| `build/GoalClicker.rbxl` | Fertig gebaute Place Datei zum direkten Öffnen in Roblox Studio |

## In Roblox Studio öffnen

**Am einfachsten:** `build/GoalClicker.rbxl` herunterladen und in Roblox Studio öffnen. Dann auf „Play“ drücken.

**Mit Live Sync (empfohlen zum Weiterentwickeln):**

1. [Rojo](https://rojo.space) installieren (Studio Plugin und Kommandozeile).
2. Im Ordner `roblox` den Befehl `rojo serve` ausführen.
3. In Studio im Rojo Plugin auf „Connect“ klicken. Änderungen an den Dateien landen sofort in Studio.

## Veröffentlichen

1. Place in Studio öffnen und mit **File > Publish to Roblox** veröffentlichen.
2. Unter **Home > Game Settings > Security** die Option **Enable Studio Access to API Services** aktivieren. Ohne diese Option speichert das Spiel in Studio nichts. Im veröffentlichten Spiel funktioniert das Speichern immer.
3. In den Game Settings einen Namen, eine Beschreibung und ein Icon setzen und die Altersfreigabe (Experience Questionnaire) ausfüllen.
4. Unter **Permissions** das Spiel auf **Public** stellen.

## Spieldaten aktualisieren

Wenn sich Spieler, Packs, Turniere oder Texte auf der Website ändern, im Hauptordner des Repositories ausführen:

```
npx tsx roblox/tools/export-data.ts
```

Danach den Place neu bauen (`rojo build -o build/GoalClicker.rbxl` im Ordner `roblox`).

## Testen

`tools/check.sh` führt alle Prüfungen aus:

1. **Logiktests** (`tests/*.spec.luau`): Wirtschaft, Kader, ganze Liga- und Turnierspiele, Minispiele, Prämien und Codes. Sie laufen mit `luaurun`, einem kleinen Luau Runner auf Basis von `mlua` (siehe `tests/harness.luau`).
2. **Typprüfung** mit `luau-lsp` und den Roblox Definitionen.
3. **Build** des Places mit Rojo.
4. **Integrationstest** (`tests/integration/run.luau`) mit [Lune](https://lune-org.github.io). Er lädt den gebauten Place, startet Server und Client mit einer nachgebauten Roblox Umgebung und spielt über die Oberfläche: Klicks, 90 Packs, Beste Elf, Formation, ein Heim- und ein Auswärtsspiel mit Reise und 3D Ansicht, ein Turnierspiel, der Code SILVAN mit Walkout und Koop mit einem zweiten Spieler. Jeder Bildschirm wird dabei auf Fehler geprüft.

Was der Integrationstest nicht prüfen kann: das echte Aussehen (Abstände, Schriftgrössen) und Roblox Dienste wie DataStore. Das bitte in Studio anschauen.

## Unterschiede zur Website

* Spielstände werden pro Roblox Konto gespeichert und nicht im Browser.
* Koop Mitspieler müssen auf demselben Roblox Server sein. Über die Freundesliste tritt man dem Server eines Freundes bei.
* Der AZB Testmodus ist wie auf der Website deaktiviert.
* Der Goalboost nach einem Turniersieg ist hier wirklich aktiv. Auf der Website wird er angekündigt, aber nicht gestartet.
* Spielernamen kommen unverändert aus den Webdaten. Vor einer öffentlichen Veröffentlichung solltest du prüfen, ob echte Namen von Spielern und Clubs im Spiel bleiben sollen.
* Karten, die es in FC 27 nicht mehr gibt, bleiben in bestehenden Spielständen gültig, kommen aber nicht mehr aus Packs. Im Album erscheinen sie nur, wenn man sie schon gesammelt hat.
