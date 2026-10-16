# Sites Konfigurationsreparatur und Sicherheitsupdates

Stand: 16. Oktober 2026. Ausgangsbasis ist die veröffentlichte Sites Version 132, Commit `ac4b92d301d283def774cdac2f8bca1271865971`.

Die Sites und GitHub Historien sind getrennt. Dieser Sites Stand behält seine interaktive Matchengine, die zusätzlichen Renderer, die Steuerelemente und den vollständigen bestehenden Testsatz. Es wurden keine GitHub Spieländerungen über den Sites Stand kopiert. Die Datenbankstruktur und die bestehenden Migrationen bleiben unverändert.

Die Konfigurationsreparaturen, React Strict Mode, Ausschlüsse für lokale Geheimnisse und Datenbanken sowie die Sicherheitsupdates entsprechen dem geprüften GitHub Commit `09d6526143594d31f184804a80a4d88a08190be6`. Die bestehenden Sites Skripte bleiben erhalten. Die npm Sicherheitsprüfung ist auch im Sites Umgebungsskript aktiviert. LF Zeilenumbrüche sind für weitere Checkouts abgesichert.

Zusätzlich wurden zwei React Prüfungsfehler der vorhandenen Reisekarte behoben. Die Projektion verwendet eine reine Hilfsfunktion. Der Zoom im Verfolgungsmodus wird direkt berechnet. Manuelles Zoomen, Verschieben, Routenübersicht und Verfolgen bleiben verfügbar. Der vorhandene Worker Test verwendet eine portable Datei URL für den TypeScript Loader. Die Artefaktprüfung registriert den Loader über die stabile Node API.

## Prüfungen

| Prüfung | Ergebnis |
| :--- | :--- |
| Saubere Installation mit npm ci | Erfolgreich |
| npm run typecheck | Erfolgreich |
| npm run lint | Erfolgreich, keine Fehler, 34 bestehende Warnungen zu ungenutzten Variablen |
| npm test | 174 TypeScript Tests und 41 weitere Tests erfolgreich, keine übersprungenen Tests |
| Worker Test | Eigenständiges Zeichnen während einer blockierten Hauptausführung bestätigt |
| Build und Artefaktprüfung | Erfolgreich, Worker Export und Sites Manifest vorhanden |
| npm audit --omit=dev | Keine bekannten Sicherheitslücken |
| Lokale HTTP Prüfung | Status 200, erwarteter Goal Clicker Titel |
| Visuelle Browserprüfung | Browsersteuerung wegen eines Verbindungsfehlers nicht verfügbar |

Die Sites Fassung meldet weiterhin bestehende Build Warnungen zu grossen JavaScript Chunks und zur statischen Routenerkennung. Die 500000 Byte Grenze des anderen GitHub Stands ist hier nicht eingeführt. Im vollständigen Paket Audit bleiben die bereits dokumentierten acht Entwicklungsbefunde aus der braces Abhängigkeitskette ohne veröffentlichte Korrektur. Sie werden nicht als behoben dargestellt.

Vollständige Protokolle: [Typprüfung](qa/sites-security-repair/typecheck.log), [Lint](qa/sites-security-repair/lint.log), [Tests mit Build](qa/sites-security-repair/tests.log) und [Produktionsaudit](qa/sites-security-repair/audit-production.json).

Die Veröffentlichung behält die bestehende öffentliche Zieladresse und die vorhandene D1 Bindung DB bei.
