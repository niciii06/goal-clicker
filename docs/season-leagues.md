# Auf und Abstieg: ein Platz hoch, ein Platz runter, strikter Tausch

Entscheid von Nicolas (12. November 2026): Pro Saison und Ligagrenze steigt **ein** Club auf und **einer** ab, für alle Clubs inklusive des eigenen. Konstanten: `SEASON_PROMOTION_PLACES` und `SEASON_RELEGATION_PLACES` in `app/feature-data.ts` (beide 1). Logik: `app/season-leagues.ts`.

## Ligen mit je sechs Mitgliedern

* Jede der 15 Ligen hat **sechs Mitglieder**. In der Liga des eigenen Clubs sind es fünf KI Clubs plus der eigene Club (10 Spiele gegen fünf Gegner), in allen anderen Ligen sechs KI Clubs.
* Dafür hat der Katalog 89 statt 75 Clubs: **ein neuer Club in jeder Liga ausser der untersten** (dort beginnt der eigene Club, fünf KI Clubs). Die ursprünglichen fünf Clubs einer Liga behalten ihre Plätze und Stärken, die neuen stehen am Ende.

| Liga | Neuer Club | Spielort |
|---|---|---|
| 1 | Paris Saint-Germain (echt, offizieller Name seit der Katalogkorrektur, siehe `docs/real-club-catalog.md`) | Stadion Paris aus dem Katalog |
| 2 | Grasshopper Club Zürich (echt) | Letzigrund (geprüfter Katalogeintrag) |
| 3 | FC Winterthur (echt) | Schützenwiese (geprüfter Katalogeintrag) |
| 4 | Yverdon Sport FC (echt, ersetzt in allen Welten den fiktiven FC Alpenfestung, gleiche ID) | Stade Municipal, Yverdon-les-Bains |
| 5 | FC Wil 1900 (echt, ersetzt in allen Welten den fiktiven FC Gotthard Murmeltiere, gleiche ID) | Lidl Arena, Wil |
| 13 | FC Goldstern (echt, ersetzt in Bern den fiktiven SC Marzili Bern, gleiche ID, Sportanlage Bremgarten bB) | Sportanlage Bremgarten bB, Bremgarten bei Bern |
| 6 | FC Rapperswil-Jona (echt, ersetzt in allen Welten den fiktiven FC Léman Mouettes, gleiche ID) | Stadion Grünfeld, Rapperswil-Jona |
| 7 | FC Locarno (echt, ersetzt in allen Welten den fiktiven FC Zürisee Böötler, gleiche ID) | Stadio del Lido, Locarno |
| 9 | FC Oberdiessbach (echt, ersetzt in Bern den fiktiven FC Seeland Hechte, gleiche ID) | Sportanlage Leimen, Oberdiessbach |
| 10 | FC Grosshöchstetten-Schlosswil (echt, ersetzt in Bern den fiktiven FC Emmental Käsekicker, gleiche ID) | Sportanlage Arniacher, Grosshöchstetten |
| 11 | FC Stettlen 08 (echt, ersetzt in Bern den fiktiven FC Gürbetal Kickers, gleiche ID, siehe `docs/real-club-catalog.md`) | Sportplatz beim Schulhaus Walkringen |
| 12 | FC Heimberg (echt, ersetzt in Bern den fiktiven FC Worblental Rangers, gleiche ID, siehe `docs/real-club-catalog.md`) | Sportanlage Waldgarten, Heimberg |
| 8 bis 14 (ohne Liga 9 bis 13 in Bern) | FC Röstigraben United, FC Aarefüchse Bern (**fiktiv**, `fictional: true`) | teilen den geprüften Platz des ersten Clubs ihrer Liga |

**Überholt (Stand 21. November 2026):** Fiktive Clubs dürfen nur in Liga 15 starten; der Ersatz der übrigen fiktiven sechsten Clubs ist in `docs/real-club-catalog.md` geplant. **Warum sie so gewählt wurden:** Spielort und Route jedes Clubs sind quellengestützt (OSM Fussballfeld, Routencache). Für echte Amateurclubs hätte ich Plätze und Routen neu beschaffen müssen. Die öffentlichen Kartendienste lieferten aus dieser Umgebung keine verlässlichen Felder (Overpass war nicht erreichbar, die Suche in Nominatim fand für viele Orte keine Fussballfelder). Eine falsche Zuordnung eines echten Clubs zu einem Platz wollte ich nicht erfinden. Die Namen lassen sich später ersetzen, ohne die Mechanik zu ändern (`EXTRA_CLUBS` in `app/travel-geography.ts`).

## Der Tausch

* Pro Grenze (14) steigt der Erste der unteren Liga auf und der Letzte der oberen Liga ab: **insgesamt 28 Bewegungen pro Saison**, der eigene Club zählt mit.
* In der Liga des eigenen Clubs gilt die echte Tabelle (inklusive des eigenen Clubs), alle anderen Ligen werden einmal beim Saisonende simuliert (Hin und Rückspiel der sechs Clubs, Stärke nach Ligaplatz) und im Spielstand festgehalten.
* **Gewinnt der eigene Club**, belegt er den einzigen Aufstiegsplatz und tauscht mit dem Club, der aus der oberen Liga absteigt. Es steigt **kein zusätzlicher KI Club** auf. Beim letzten Platz ist es umgekehrt. Platz 2 bis 5 bleiben, dann bewegen sich zwei KI Clubs der eigenen Liga.
* Alle Bewegungen werden aus den Endtabellen berechnet, bevor ein Club wechselt, niemand wechselt zweimal. In Liga 15 ist Platz 1 die Hall of Fame (dann bewegt sich nichts, der Lauf endet), unterhalb der untersten Liga gibt es keinen Abstieg.
* Identität, Stadion, Reisedaten und Spieler Pool eines Clubs bleiben, es ändert sich nur die Liga. Die Stärke folgt dem Platz in der Liga (wie bisher).

## Speicherung und alte Spielstände

* `seasonMode.aiLeagues` (Club zu Liga) und `seasonMode.lastAiMoves` (Bewegungen der letzten Saison, der eigene Club mit `clubId: "club"`) sind optional.
* Fehlt `aiLeagues` (alter Spielstand, neue Welt), gilt `defaultAiLeagues(division)`: Katalogligen, der sechste Club der eigenen Liga spielt in der untersten Liga. Die fünf bisherigen Gegner und alle gespeicherten Tabellen bleiben unverändert. Ein Spielstand speichert die Zuordnung erst beim ersten Saisonende.
* Eine Zuordnung, die nicht zur aktuellen Division passt (falsche Anzahl, fehlende Clubs, das frühere Fünf Clubs Modell), wird verworfen und fällt auf den Standard zurück.
* Eine laufende Saison behält ihre Tabelle, die Regel gilt ab dem Saisonende. Prestige startet wieder mit den Standardligen (`startSeasonPrestige`). Koop: Die Zuordnung liegt im gemeinsamen Spielstand und wird einmal beim Saisonende festgelegt.

Tests: `tests/ai-promotion-relegation.test.ts`, `tests/master-update.test.ts` (89 Clubs), die Reise Tests (`travel-route-geometry`, `stadium-audit`) prüfen die neuen Clubs mit.
