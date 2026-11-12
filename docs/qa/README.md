# QA Nachweise: Ordnung und Regeln

Stand 12. November 2026. Abgleich zum Ticket «Repository-Hygiene». Es wurde nichts gelöscht und nichts verschoben.

## Regel für neue Ausgaben

* Test-, Lint-, Build- und Audit-Protokolle (`*.log`, `test-results/`, `playwright-report/`) sind jetzt in `.gitignore`. Die CI bewahrt ihre Ausgaben selbst (Job-Protokolle in GitHub Actions); sie müssen nicht eingecheckt werden.
* Bereits versionierte Dateien bleiben, denn `.gitignore` entfernt nichts aus Git. Wer einen Nachweis dauerhaft braucht, schreibt ihn als Markdown (Befehl, Datum, Commit, Ergebnis) wie `perf-baseline.md` und `hosting-delivery.md` und nicht als rohes Protokoll.
* Soll ein Protokoll ausnahmsweise doch versioniert werden: `git add -f` und im zugehörigen Markdown verlinken.

## Bestand (39 versionierte Dateien, 712 KB)

| Ordner | Inhalt | Einordnung |
|---|---|---|
| `config-security-repair/`, `config-remediation-followup/`, `sites-security-repair/` | Protokolle und Audit JSON zur Konfigurationsreparatur | historischer Nachweis zu `docs/config-security-repair.md` und `docs/sites-security-repair.md`, behalten |
| `release/` | Protokolle und Kontaktbild zum Match Realism Release | historischer Nachweis zu `docs/release-match-realism.md`, behalten |
| `final-audit/` + `final-audit.md` | Abschlussprüfung | historischer Nachweis, behalten |
| `match-canvas.png` | Kontaktbild Match Canvas | von `docs/match-realism-report.md` und `docs/match-realism-implementation.md` verlinkt |
| `perf-baseline.md`, `hosting-delivery.md` | aktuelle Messungen | lebendig, werden bei Messungen erneuert |

## Doppelte Dateien (gleicher Git Blob)

Geprüft mit `git ls-files -s`. Gleiche Inhalte, aber nicht entfernt:

* `match-canvas.png`, `release/canvas-contact.png`, `final-audit/canvas-contact.png`: **alle drei werden von Dokumenten verlinkt** (`match-realism-report.md`, `release-match-realism.md`, `final-audit.md`). Ein Löschen würde Bilder in diesen Berichten brechen, der Gewinn ist klein. Dedupliziert werden könnte nur, indem die Links angepasst werden; das lohnt sich nicht.
* `app/opengraph-image.jpg` und `app/twitter-image.jpg` (und ihre `.alt.txt`): **müssen bleiben**. Next.js leitet daraus zwei getrennte Metadaten Endpunkte ab (`/opengraph-image.jpg`, `/twitter-image.jpg`, beide im Build vorhanden). Eine Deduplizierung wäre nur mit eigenen Routen möglich und bringt für zwei kleine Dateien keinen Vorteil.
* Mehrfache `typecheck.log`, `lint.log`, `physics.log`, `canvas.log`, `audit-production.json`: wiederholte Ausgaben verschiedener Läufe. Sie belegen den jeweiligen Stand und werden nicht angefasst. Eine Bereinigung ist nur nach ausdrücklicher Freigabe sinnvoll (dann in einem eigenen Commit, damit sie sich zurückholen lässt).
