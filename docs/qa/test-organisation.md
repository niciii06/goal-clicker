# Test und Skriptorganisation: Entscheidungsvorlage

Stand 12. November 2026, Ticket «Test und Skriptorganisation gezielt prüfen». Es wurde nichts konvertiert und nichts umgestellt.

## Befund

* **Zwei Formate sind gewollt.** `package.json` startet 85+ `tests/*.test.ts` mit `node --import tsx --test` und 10 `tests/*.test.mjs` mit `node --test`. Beides ist gültig und läuft in der CI. Eine Vereinheitlichung bringt für sich keinen Nutzen.
* **Sieben der zehn `.mjs` Tests sind reine Quelltextprüfungen** (sie lesen `app/page.tsx`, `app/api/multiplayer/route.ts` und ähnliche Dateien und prüfen mit regulären Ausdrücken): `walkout-reveal` (258 Zeilen), `test-mode-access`, `multiplayer-concurrency`, `transfer-insider`, `click-progression`, `squad-drag-drop`, `event-restore`. Die anderen drei (`save-safety`, `rendered-html`, `repair-lockfile`) prüfen Verhalten bzw. gerenderte Ausgabe.
* **Das macht sie anfällig:** Jede Umbenennung oder Umformatierung in `page.tsx` kann sie brechen, ohne dass sich das Spielverhalten ändert. Das ist in dieser Arbeit mehrfach passiert (Tests zu Reveal, Testmodus und Saisonpanel mussten nachgezogen werden).
* **Python:** Die drei Skripte in `scripts/travel/` brauchen nur die Standardbibliothek. `requirements.txt` ist nicht nötig. Aufruf und Version stehen jetzt in `docs/realistic-travel.md`.

## Empfehlung (priorisiert)

1. **Nichts massenhaft umstellen.** Die Tests laufen stabil und belegen echte Regeln.
2. **Bei Gelegenheit, wenn der betroffene Bereich ohnehin geändert wird,** Quelltexttests in Verhaltenstests überführen, in dieser Reihenfolge nach Nutzen:
   * `multiplayer-concurrency` und `test-mode-access`: Der Nutzen ist am grössten, denn sie prüfen Sicherheit und Berechtigung. Dafür gibt es schon die Route Tests in `tests/coop-security.test.ts` und `tests/availability-coop.test.ts` als Vorbild (Aufruf der Route mit Fixtures statt Textsuche).
   * `transfer-insider`, `click-progression`: Die Logik liegt in `feature-data.ts` bzw. `game/`. Direkte Funktionsaufrufe sind robuster.
   * `walkout-reveal`, `squad-drag-drop`, `event-restore`: Prüfen UI Verdrahtung. Hier ist ein Browser Test der robustere Ersatz (`tests/browser/smoke.test.ts` deckt Reveal und Aufstellung schon teilweise ab). Umstellen nur zusammen mit einem Browser Test.
3. **Neue Tests als Verhaltenstests schreiben** (`.test.ts`), Quelltexttests nur als letztes Mittel.
4. **Python Abhängigkeiten erst deklarieren**, wenn ein Paket ausserhalb der Standardbibliothek dazukommt.

## Nicht empfohlen

* `.mjs` nach `.ts` umbenennen, nur um ein Format zu haben.
* Eine Testlauf Struktur ändern, solange die CI und `npm test` grün sind.
