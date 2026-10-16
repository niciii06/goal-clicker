# Konfigurationsreparatur und Sicherheitsprüfung

Prüfdatum: 16. Oktober 2026. Ausgangsbasis: Commit `13f952d89ca1e59386fbd92362776fbef6a8fc64`.

## Reparaturen

Die Konfigurationen und die beiden Hosting Dokumente entsprechen den angeforderten vollständigen Fassungen. Der Clone Befehl in HOSTING.md enthält eine ausführbare URL. Die im Auftrag vermuteten fehlenden Abschlussklammern waren im Ausgangsstand bereits vorhanden. Das Lockfile war ebenfalls vollständig.

ESLint ignoriert generierte Verzeichnisse direkt in der Konfiguration. Das Lint Skript benötigt keine zusätzlichen Ignore Argumente. React Strict Mode ist aktiviert. Worker Geheimnisse und lokale SQLite Dateien sind in .gitignore ausgeschlossen.

Die npm Sicherheitsprüfung ist sowohl in .npmrc als auch in scripts/sites-env.sh aktiviert. Der vorherige Skriptwert hätte den Wert aus .npmrc überschrieben. Zwei Spielmeldungen verwenden jetzt die Schweizer Schreibweise draussen. Eine .gitattributes sichert LF Zeilenumbrüche, damit die Bash Skripte und die vorhandenen Quelltextprüfungen auch nach einem Windows Checkout funktionieren.

## Sicherheitsupdates

| Direktes Paket | Vorher | Jetzt |
| :--- | :--- | :--- |
| next und eslint-config-next | 16.2.6 | 16.4.2 |
| react, react-dom und react-server-dom-webpack | 19.2.6 | 19.2.9 |
| @cloudflare/vite-plugin | 1.37.1 | 1.64.0 |
| wrangler | 4.92.0 | 4.151.1 |
| vite | 8.0.13 | 8.0.16 |
| drizzle-kit | 0.31.10 | 0.31.11 |

Zusätzlich wurden korrigierte transitive Versionen im Lockfile aufgelöst. Zwei gezielte npm Overrides verwenden image-size 2.0.4 unter Vinext und esbuild 0.25.12 unter @esbuild-kit/core-utils. Alle direkten Abhängigkeiten und alle Anwendungsfunktionen bleiben vorhanden. Vinext bleibt auf 0.0.50.

## Prüfergebnisse

| Prüfung | Ergebnis |
| :--- | :--- |
| Saubere Installation mit npm ci | Erfolgreich, Lockfile reproduziert |
| npm run typecheck | Erfolgreich, Exitcode 0 |
| npm run lint | Erfolgreich, keine Fehler oder Warnungen, Exitcode 0 |
| npm test | 182 TypeScript Tests und 41 weitere Tests erfolgreich, keine Fehler oder übersprungenen Tests |
| Produktionsbuild innerhalb von npm test | Erfolgreich, Worker Export und Sites Manifest geprüft |
| Client Chunk Budget | 23 Chunks, grösster Chunk 480996 Bytes bei erlaubten 500000 |
| npm run verify:physics | Vier vollständige simulierte Spiele erfolgreich |
| npm run check:external | Erfolgreiche Paketprüfung ohne Upload |
| Drizzle Migrationsprüfung mit aktualisiertem Compiler | Erfolgreich, keine Migration verändert |
| Syntax und Zeichenkodierung | Alle im Auftrag genannten Dateien und Skripte geprüft |
| npm audit --omit=dev | Keine bekannten Sicherheitslücken, Exitcode 0 |
| Vollständiger npm audit | Acht hohe Befunde in Entwicklungsabhängigkeiten, keine kritischen Befunde |

Die vollständigen Ausgaben befinden sich unter [docs/qa/config-security-repair](qa/config-security-repair/): [Typprüfung](qa/config-security-repair/typecheck.log), [Lint](qa/config-security-repair/lint.log), [Tests mit Build](qa/config-security-repair/tests.log), [Physik](qa/config-security-repair/physics.log), [Produktionsaudit](qa/config-security-repair/audit-production.json) und [vollständiger Audit](qa/config-security-repair/audit-all.json).

## Verbleibender Befund in Entwicklungswerkzeugen

Alle acht verbleibenden Meldungen gehen auf [GHSA-vfj7-8cjw-p6xm in braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) zurück. braces 3.0.3 ist zum Prüfzeitpunkt die neueste veröffentlichte Version und besitzt keine korrigierte Nachfolgeversion. Betroffen sind die über micromatch und fast-glob verwendeten Werkzeuge von ESLint und Vinext. Laut npm Audit gehören diese Pakete nicht zu den Produktionsabhängigkeiten.

Der von npm angebotene erzwungene Wechsel zu eslint-config-next 14.2.35 ist eine inkompatible Rückstufung und behebt die separate Vinext Kette nicht. Daher wurde kein erzwungener Downgrade durchgeführt. Der Befund wird nicht als behoben dargestellt. Eine umfassende Prüfung aller Anwendungsangriffswege ist durch einen Paket Audit nicht abgedeckt.

## Automatische GitHub Prüfung

Der bestehende Workflow führt künftig zusätzlich Lint und den Audit der Produktionsabhängigkeiten aus. npm ci deaktiviert die Sicherheitsprüfung nicht mehr. Die bestehenden Tests und die Typprüfung bleiben erhalten.

Ein Push auf main aktualisiert den GitHub Quellstand. Die bestehende ChatGPT Site und externe Worker werden dadurch nicht veröffentlicht oder verändert.

## Ergänzende Reparatur vom 16. Oktober 2026

Ausgangsbasis dieser Nachprüfung ist Commit `09d6526143594d31f184804a80a4d88a08190be6`. Die erneute Aufgabenbeschreibung wurde in der Reihenfolge kritisch, hoch, mittel und niedrig abgearbeitet. Bereits passende Dateien behalten denselben Inhalt. Spiellogik, Datenbankmigrationen, Skripte und Abhängigkeiten wurden nicht entfernt.

* TypeScript ignoriert jetzt auch generierte Build- und Laufzeitverzeichnisse.
* Vite verwendet die vorgegebene optionale Host-Umgebungsvariable und erkennt Windows- sowie Unix-Pfade für die bestehenden Client-Chunks. Die Typangabe für Hosting-Bindings erlaubt zusätzlich `null`, weil das vorhandene Manifest `r2: null` enthält; die unveränderte Typangabe aus dem Auftrag scheitert an der Typprüfung.
* `tsx` ist direkt mit Version `4.22.1` deklariert. Das vollständige Lockfile bleibt erhalten und stimmt mit dem Manifest überein. Das angeforderte Skript `scripts/repair-lockfile.mjs` wurde vollständig übernommen und ausgeführt.
* `npm run types:worker` hat die vollständigen Typen mit dem installierten Wrangler 4.151.1 und workerd 1.20261012.1 erzeugt. Die kurze Typdatei im Auftrag wurde nicht als Ersatz verwendet, da sie bestehende Laufzeitdeklarationen entfernen würde. Abschliessende Leerzeichen der generierten Datei wurden normalisiert.
* `.npmrc`, `.gitattributes`, Drizzle, ESLint, Next, PostCSS und `.gitignore` entsprechen bereits den angeforderten Inhalten.
* `README.md`, `HOSTING.md` und `TRAVEL.md` wurden auf UTF-8, Ersatzzeichen, Schweizer Schreibweise und geschlossene Markdown-Codeblöcke geprüft. Ihre bestehenden Inhalte bleiben erhalten. Der Anhang enthält die erwähnten Dokumentfassungen aus «Issue 12» nicht. Der Abruf von `niciii06/goal-clicker#12` über GitHub lieferte 404; eine inhaltlich identische Wiederherstellung dieser unbekannten Fassungen ist daher nicht belegt.

| Aktuelle Prüfung | Ergebnis |
| :--- | :--- |
| `npm run types:worker` | Vollständige Typdatei erzeugt |
| `npm run typecheck` | Erfolgreich |
| `npm run lint` | Erfolgreich, keine Warnungen |
| `npm test` | Produktionsbuild, 182 TypeScript-Tests und 41 weitere Tests erfolgreich |
| Client-Chunk-Budget | 23 Chunks; grösster Chunk 480996 Bytes bei maximal 500000 |
| `node --test tests/repair-lockfile.test.mjs` | Zwei Tests erfolgreich; gültiges JSON, fehlende Klammern, wiederholte Ausführung, Erhalt ungültiger Eingaben und Abhängigkeitsabgleich geprüft |
| GitHub-Workflow | Bestehende Prüfungen erhalten; Lockfile-Tests ergänzt |
| `npm audit --omit=dev --json` | Null bekannte Befunde |
| `npm audit --json` | Acht hohe Befunde in Entwicklungsabhängigkeiten, null kritische Befunde |

Die erneuten Audit-Befunde betreffen weiterhin die bereits oben beschriebene braces-Abhängigkeit. Sie sind durch diese Konfigurationsreparatur nicht behoben. Es wurde kein inkompatibler Downgrade vorgenommen.

Prüfausgaben: [Typprüfung](qa/config-remediation-followup/typecheck.log), [Lint](qa/config-remediation-followup/lint.log), [Tests und Build](qa/config-remediation-followup/tests.log), [Lockfile-Tests](qa/config-remediation-followup/lockfile.log), [Produktionsaudit](qa/config-remediation-followup/audit-production.json) und [vollständiger Audit](qa/config-remediation-followup/audit.json).

Diese Nachprüfung umfasst lokale automatisierte Prüfungen unter Windows mit Git Bash. Es wurden keine Site veröffentlicht, keine Datenbank migriert und keine manuellen Mehrgeräte- oder Kontotests ausgeführt. Die GitHub-Prüfung des neuen Commits muss separat beobachtet werden.
