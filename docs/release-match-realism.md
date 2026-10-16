# Goal Clicker – Release verification

Stand: 16. Oktober 2026. Die vier in diesem Folgeauftrag definierten Blocker sind behoben.
Der geprüfte Quellstand wurde nach bestandenem Gate auf GitHub main übernommen:
`697b342ff57d05a764f5a5fcf538065806e4bdf7`.

## Warnungen, Chunks und Whitespace

Karte und Canvas werden dynamisch mit zugänglichen Lade-/SSR-Fallbacks geladen.
Die reine Frameberechnung ist aus der React-Oberfläche ausgelagert; die Canvas-Logik
und die CLI nutzen dieselbe zustandsbehaftete Bewegungspipeline. Der kanonische
Routencache bleibt erhalten und wird für den Client aus sieben verlustfreien Teilen
zusammengesetzt. Die Testprüfung vergleicht alle Geometrien, Metadaten und die Reihenfolge.

Vinexts Startseite ist jetzt ausdrücklich dynamisch; die drei API-Segmente deklarieren
`force-dynamic` und `revalidate = 0`. Die Artefaktprüfung registriert den Node-Loader
über die stabile API. Der lokale Build benötigt keinen Netzwerkproxy; nur für diesen
Prozess werden die Proxyvariablen entfernt. Installation und Anwendungsruntime behalten
ihre Netzwerkeinstellungen. Keine Warnungsfilter oder erhöhten Grenzwerte.

Der abschliessende Build enthält **23 Client-JavaScript-Chunks**, maximal **480996 Bytes**.
Der Validator bricht bei mehr als **500000 Bytes** ab. Alte `dist`-Dateien werden vor
einem vollständigen Build entfernt, damit frühere grosse Chunks nicht im Paket bleiben.
Die historisch gespeicherten Protokolle wurden an Zeilenenden und Dateiende normalisiert;
Diagnosen und Zahlen bleiben erhalten. Der erzeugte TypeScript-Cache wird nicht mehr versioniert.
`git diff --check` gegen den vorherigen Main-Stand und über den abschliessenden Source-Commit ist sauber.

## Mathematischer Kontinuitätsnachweis

`scripts/verify-match-physics.ts` schreibt jedes Frame mit Zeitstempel, X/Y in Metern
und dokumentiertem Unterbruchsgrund nach `outputs/match-physics/frames.csv`.
`npm test` führt dieselbe vollständige Prüfung aus. Auslosung und Match-RNG sind fest
gesetzt; CLI und Tests liefern identische Ergebnisse.

Für aufeinanderfolgende aktive Frames gilt:

`d = hypot(x2 - x1, y2 - y1) <= 55 * (t2 - t1) / 1000 + 1e-7`.

**51595 Frames**, **44659 geprüfte aktive Übergänge**, **6932 ausgenommene Übergänge**,
vier Initialframes ohne Vorgänger. Höchste gemessene Geschwindigkeit:
`55.000000000000455 m/s`; die Abweichung oberhalb 55 ist Gleitkomma-Rundung und liegt
unter der Assertionstoleranz. Grösster aktiver Schritt: `3.300000000000005 m` im
Profil mit ausgelassenen Frames. Normale 60-FPS-Schritte bleiben bei höchstens ca. 0.916667 m.

| Partie | Frames | Aktiv geprüft | Unterbruch ausgenommen | Max. m/s |
| --- | --- | --- | --- | --- |
| league-60fps | 15318 | 12470 | 2847 | 55.000000 |
| stadium-30fps | 7969 | 6988 | 980 | 55.000000 |
| champions-variable | 8535 | 7628 | 906 | 55.000000 |
| world-60fps | 19773 | 17573 | 2199 | 55.000000 |

Jede Partie endet vollständig, enthält genau eine Halbzeit und mindestens einen
serialisierten Reload während einer echten Pause. Das variable Profil enthält
200-ms-Frame-Lücken. Anpfiff, gepfiffene Standards/Abseits und Pausen werden anhand
von Ereignis/Status ausgenommen; grosse Distanzen lösen niemals selbst eine Ausnahme aus.
Ein Negativtest verlangt, dass ein künstlicher 80-m-Sprung in 16 ms ohne Unterbruch
abgewiesen und ein legitimer Wiederanpfiff zugelassen wird.

Der Nachweis gilt für den tatsächlich gezeichneten Ball in `MatchPresentation`.
Er behauptet keine neue vollständige Kollisionssimulation aller Spieler. Die zuvor
dokumentierten weitergehenden Stadion-/Realismusziele bleiben gesonderte Ausbauarbeit;
der Nutzer hat für diesen Release die vier hier geprüften Blocker und das Vier-Kommandos-Gate vorgegeben.

## Abschliessende Tests und Build

Alle Befehle liefen im bestehenden Projekt-Umgebungswrapper:
`bash scripts/sites-env.sh -- <Befehl>`. Keine Tests wurden gelöscht oder übersprungen.
Der bestehende Canvas-DOM-Test bleibt unverändert und besteht auch mit dynamischem
Laden; die Karten-Assertions prüfen die extrahierte Produktionskomponente direkt.

| Befehl | Ergebnis | Konsolenausgabe |
| --- | --- | --- |
| `npm run typecheck` (`tsc --noEmit`) | Exit 0, keine Diagnosen | [typecheck.log](qa/release/typecheck.log) |
| `npm run lint` | Exit 0, keine Fehler/Warnungen | [lint.log](qa/release/lint.log) |
| `npm test` | Exit 0, 182 TS + 41 JS = 223 Tests, 0 Fehler/Skipped/Todo | [tests.log](qa/release/tests.log) |
| `npm run build` | Exit 0, keine Warnungen, Routen vollständig klassifiziert, Artefakt validiert | [build.log](qa/release/build.log) |
| `npm run verify:physics` | Exit 0, alle vier vollständigen Sequenzen bestanden | [physics.log](qa/release/physics.log) |

Die Protokolle sind nur bei Zeilenenden/Leerzeichen normalisiert. Die alten Fehlversuche
bleiben im historischen Audit erhalten. Während dieses Folgeauftrags wurde ein
Canvas-SSR-Fehlschlag durch einen echten Canvas-Ladefallback korrigiert; keine
entsprechende Assertion wurde entfernt. Weitere Änderungen betreffen die nachladbaren
Modulgrenzen und die reproduzierbar gesetzte Turnierauslosung.

## Visuelle Evidenz und Browserstatus

480 Bilder wurden erneut mit der Produktionspipeline erzeugt. Das Kontaktbild wurde
auf Spielfeld, Ball, Mannschaftskontrast, Nummern und Schuss-/Paradenbilder angesehen.

Real time interactive browser verification was bypassed due to the headless CLI environment; verification is established via the 480 generated canvas frames and DOM component test suites.

Dies ersetzt keine Browser-/Geräte- oder Responsive-Abnahme. Es wurde kein Browser
installiert und keine interaktive Browserprüfung als bestanden ausgegeben.

![Canvas-Kontaktbild](qa/release/canvas-contact.png)

## Git und ChatGPT Sites

Ausgangs-Main: `a8ab9a2ab1cc31ebbeb59f46e9948bf545c6f1a5`.
Feature-Branch: `feat/match-realism-cup-travel`.
Remote-Feature / Main-Codefreigabe: `697b342ff57d05a764f5a5fcf538065806e4bdf7`.
Geprüfter Quellbaum: `ea679c19d7dbafc41783c133945ad212692a0744`.
Lokale Prüfhistorie einschliesslich `541f38a` und `d1d5800` ist zusätzlich unter
`archive/qa-release-local-d1d5800` erhalten. Der über die GitHub-Verbindung erzeugte
Release-Commit enthält genau denselben, per Datei-/Baum-Hash verglichenen Quellstand.
Die bisherigen Phasen-Commits bleiben Vorfahren der Freigabe.

Ausgeführt: Branchwechsel nach main, `git pull --ff-only origin main` und
`git merge --ff-only feat/match-realism-cup-travel`. Die GitHub-Verbindung hat
main mit erwartetem Vorgänger-Hash und `force=false` aktualisiert; ein Shell-
`git push` mit lokal gespeicherten Zugangsdaten war dafür nicht nötig.
Der nachfolgende Dokumentations-Commit wird separat auf main veröffentlicht;
sein bestätigter Hash steht im Abschlussbericht.

Aktualisiert: README, Hosting-Hinweise, Reise-/Match-Dokumentation, historisch
gekennzeichnete Auditberichte, dieses Releaseprotokoll und
[ChatGPT Sites Projektwissen](chatgpt-sites-knowledge.md).
`scripts/export-chatgpt-knowledge.mjs` exportiert das Projektwissen reproduzierbar
nach `chatgpt/goal-clicker-project-knowledge.md`.

Die Live-Site besitzt Version 132 mit eigenständigen Interactive-Match-/Worker-
Änderungen (`ac4b92d...`). Ihr Quellstand wurde geöffnet und geprüft, jedoch nicht
mit dem anderen GitHub-Verlauf überschrieben. Dieser Auftrag aktualisiert die
Sites-Dokumentation im Repository; eine neue Sites-Anwendungsversion wurde nicht
veröffentlicht. Vor einem solchen Deployment sind beide Quellhistorien zusammenzuführen.
