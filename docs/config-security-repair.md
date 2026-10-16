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
