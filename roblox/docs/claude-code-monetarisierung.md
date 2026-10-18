Du arbeitest an der Roblox Version von Goal Clicker. Antworte mir auf Deutsch, mit echten Umlauten und ohne Gedankenstriche (—) mitten im Text.

## Schritt 0: Warte auf Roblox Studio

Arbeite erst los, wenn der MCP Server "Roblox_Studio" verbunden ist.

1. Prüfe, ob dir Tools des MCP Servers "Roblox_Studio" zur Verfügung stehen. Rufe testweise ein lesendes Tool auf, zum Beispiel eines, das den Studio Modus oder die Konsole abfragt.
2. Klappt das nicht, schreibe mir kurz, was ich tun muss:
   * Roblox Studio öffnen und einen Place öffnen
   * Im Assistant über "… > MCP-Server verwalten" die Option "Studio als MCP-Server aktivieren" einschalten
   * Falls der Server in Claude Code fehlt: `claude mcp add Roblox_Studio -- cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat` und Claude Code neu starten
   Dann stoppe und warte, bis ich "verbunden" schreibe. Prüfe danach noch einmal. Fange nicht ohne funktionierende Verbindung an.

## Schritt 1: Projekt holen

* Repository: https://github.com/niciii06/goal-clicker, Branch `claude/roblox-game-publish-zb61lh`. Klone es, falls es noch nicht lokal liegt, und arbeite auf genau diesem Branch.
* Lies zuerst `roblox/README.md`. Der Ordner `app/` ist die Website und darf nicht verändert werden.
* Aufbau: Rojo Projekt in `roblox/` (`default.project.json`). `src/shared` ist die Spiellogik, `src/server` der Server (Aktionen, Speichern über DataStore mit Sitzungssperre in `Store.luau`, Koop in `Clubs.luau`, Remotes in `Main.server.luau`), `src/client` die Oberfläche (`UI.luau` Toolkit, `Theme.luau`, Screens unter `Screens/`).
* Der Server ist die einzige Wahrheit. Der Client schickt nur Absichten über die RemoteFunction "Action". Halte dich an dieses Muster.
* Verbinde Studio mit dem Code: Installiere Rojo (zum Beispiel über Rokit oder Aftman) und das Rojo Studio Plugin, starte im Ordner `roblox` den Befehl `rojo serve` und verbinde das Plugin. Klappt Rojo nicht, öffne `roblox/build/GoalClicker.rbxl` in Studio und baue nach jeder Änderung mit `rojo build -o build/GoalClicker.rbxl` neu.

## Schritt 2: Robux Käufe einbauen

Baue alles Folgende ein. Ziel: Spieler können Robux ausgeben, ohne dass das Spiel für Spieler ohne Robux unfair wird.

### Game Passes (einmal kaufen, für immer)

| Pass | Wirkung | Preis |
|---|---|---|
| Doppelte Tore | Alle Tore aus Klicks und Produktion x2 | 249 |
| Auto Klicker | Ein automatischer Klick pro Sekunde, solange man im Spiel ist | 149 |
| Schnellreise | Auswärtsreisen dauern nur noch halb so lang | 99 |
| VIP | Goldener Name in Koop und Rangliste, eigene Trikotfarbe, 50 % mehr Reserveplätze, täglich ein Basis Prämienpack | 249 |
| Grosser Koop Club | Selbst erstellte Koop Welten haben 6 statt 4 Plätze | 199 |

### Developer Products (beliebig oft kaufbar)

| Produkt | Wirkung | Preis |
|---|---|---|
| Kleines Tore Paket | 10 Minuten aktuelle Produktion sofort, mindestens 1000 Tore | 25 |
| Grosses Tore Paket | 1 Stunde Produktion sofort, mindestens 10000 Tore | 99 |
| Riesiges Tore Paket | 8 Stunden Produktion sofort, mindestens 100000 Tore | 399 |
| Goalboost | 2x Tore für 15 Minuten, nutzt die vorhandene Goalboost Mechanik | 49 |
| Fragmente | 500 Fragmente für den Spezialkarten Zug | 79 |
| Reise sofort beenden | Die laufende Auswärtsreise ist sofort am Ziel | 15 |
| Minigame sofort bereit | Setzt die Minigame Abklingzeit zurück | 15 |

### Regeln

* Keine Karten, Icons oder Packs direkt gegen Robux. Packs bleiben nur mit Toren kaufbar. So brauchen wir keine Regeln für bezahlte Zufallsinhalte ("Paid Random Items").
* In Koop Welten gilt ein Pass eines Mitglieds für die ganze Welt (zum Beispiel x2 Tore), Produkte wirken auf die Welt, in der der Käufer gerade spielt.
* Die Rangliste soll fair bleiben: Tore aus Tore Paketen zählen nicht für die globale Rangliste und den Rang, nur für das Guthaben.

### Technik

* Alle IDs kommen in eine einzige Datei `roblox/src/shared/Monetization.luau` mit Platzhaltern (0). Ist eine ID 0, wird der Kaufknopf ausgeblendet und nichts bricht.
* Server: `MarketplaceService.ProcessReceipt` mit sicherer Abwicklung. Speichere verarbeitete `PurchaseId`s im Spielstand des Käufers (begrenzte Liste, zum Beispiel die letzten 100), gib erst `PurchaseGranted` zurück, wenn der Spielstand mit der Wirkung erfolgreich gespeichert ist, sonst `NotProcessedYet`. Doppelte Belege dürfen nie doppelt wirken.
* Passes: `UserOwnsGamePassAsync` beim Beitritt (mit pcall und Cache), plus `PromptGamePassPurchaseFinished` für Käufe während des Spiels.
* Neue Felder im Spielstand müssen über die vorhandene Normalisierung alte Spielstände sauber übernehmen.
* Client: Ein neuer Bereich "Shop" (eigener Tab oder unter "Club & Mehr") mit allen Passes und Produkten, Preis in Robux, Besitzstatus bei Passes. Dazu kleine Kaufknöpfe direkt dort, wo sie Sinn ergeben: "Reise sofort beenden" auf der Reisekarte, "Sofort bereit" bei den Minigames, Goalboost auf der Startseite. Stil wie der Rest der Oberfläche, Texte auf Deutsch mit Umlauten.
* Sicherheit: Der Client darf nie selbst Wirkungen auslösen. Alles läuft über ProcessReceipt oder die serverseitige Pass Prüfung.

## Schritt 3: Prüfen

1. Führe `roblox/tools/check.sh` aus (Logiktests, Typprüfung, Build, Integrationstest mit Lune). Fehlen dir Tools, installiere sie oder sag mir, was fehlt. Ergänze Tests für die neue Logik (zum Beispiel: Beleg wird nur einmal verbucht, Tore Paket Mindestwerte, Pass Wirkungen).
2. Teste in Studio über den MCP Server: Spiel starten, Konsole auf Fehler prüfen, Shop öffnen, Testkäufe machen (in Studio sind Käufe kostenlos und simuliert), Wirkung kontrollieren. Schau dir die Oberfläche auch in kleiner Fenstergrösse (Handy) an.
3. Baue `roblox/build/GoalClicker.rbxl` neu, committe mit klaren Nachrichten und pushe auf den Branch `claude/roblox-game-publish-zb61lh`.

## Schritt 4: Was ich danach tun muss

Gib mir am Ende eine kurze Liste zum Abarbeiten:
* Welche Passes und Produkte ich auf create.roblox.com bei meinem Spiel unter "Monetization" anlegen muss, jeweils mit Name, Beschreibung (Deutsch) und Preis zum Abschreiben.
* Wo ich die IDs danach eintrage. Biete an, dass ich dir die IDs schicke und du sie einträgst.
* Was ich nach dem Veröffentlichen mit echtem Geld kurz testen sollte.

Frag nur nach, wenn etwas wirklich unklar ist. Sonst arbeite selbstständig und berichte am Ende kurz, was fertig ist und was du nicht prüfen konntest.
