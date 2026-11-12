# Auf und Abstieg der KI Vereine

Entscheid von Nicolas (12. November 2026): Pro Saison und Ligagrenze steigt **ein** Verein auf und **einer** ab, für alle Vereine inklusive des eigenen Clubs. Konstanten: `SEASON_PROMOTION_PLACES` und `SEASON_RELEGATION_PLACES` in `app/feature-data.ts` (beide 1).

## Regeln

* **Eigener Club:** Platz 1 steigt auf, nur der letzte Platz (6) steigt ab. In Liga 15 ist Platz 1 die Hall of Fame, die unterste Liga kennt keinen Abstieg. Platz 2 bis 5 bleiben.
* **KI Vereine:** An jeder der 14 Grenzen steigt der beste KI Verein der unteren Liga auf und der schlechteste KI Verein der oberen Liga ab. Zuerst werden alle Tabellen berechnet, dann bewegen sich alle Vereine gleichzeitig (niemand wechselt zweimal). Jede Liga behält fünf KI Vereine, die Ligagrössen bleiben gleich.
* **Tabellen:** In der Liga des eigenen Clubs gilt die echte Abschlusstabelle (ohne den eigenen Club). Alle anderen Ligen werden einmal pro Saison simuliert (Hin und Rückspiel der fünf Vereine, Stärke wie die Liga Plätze, Zufall aus der Saisonziehung) und im Spielstand festgehalten. Neuladen ändert das Ergebnis nicht.
* **Folge für die Liga des eigenen Clubs:** Gewinnt der eigene Club die Liga, steigt zusätzlich der beste KI Verein dieser Liga auf. Sonst bekäme die obere Liga nur vier KI Vereine neben dem eigenen Club oder die untere Liga sechs. Das gilt umgekehrt für den letzten Platz.
* **Identität:** Verein, Stadion, Reisedaten und Spieler Pool bleiben, es ändert sich nur die Liga. Die Stärke folgt dem Platz in der Liga (wie bisher).

## Speicherung und alte Spielstände

* `seasonMode.aiLeagues` (Verein zu Liga) und `seasonMode.lastAiMoves` (Bewegungen der letzten Saison) sind optional. Fehlt `aiLeagues`, spielt jeder Verein in seiner Katalogliga, ein alter Spielstand lädt unverändert.
* Ungültige Daten (fehlende Vereine, falsche Ligagrösse) werden verworfen und fallen auf den Katalog zurück.
* Eine laufende Saison behält ihre Tabelle; die neue Regel gilt ab dem Ende der Saison. Die Markierungen in der Tabelle (Platz 1 grün, letzter Platz rot) und die Hinweise folgen der neuen Zahl sofort.
* Ein neuer Prestige Lauf beginnt wieder in den Katalogligen (`startSeasonPrestige` löscht die Zuordnung). Prestige und Hall of Fame Regeln sind sonst unverändert.
* Koop: Die Zuordnung liegt im gemeinsamen Spielstand der Welt und wird einmal beim Saisonende festgelegt.

Tests: `tests/ai-promotion-relegation.test.ts`.
