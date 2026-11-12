# Heimstadion Phase 1: Bestandsaufnahme und Vorschlag

Stand 12. November 2026. Notion: «Heimstadion aus vorgegebenen Schweizer Städten wählen» (Opus, P1). **Nur Konzept, kein Code.** Laut Ticket gibt es noch keine Umsetzungsfreigabe, und die Städteliste ist offen.

Geprüft auf Sonnets Branch `claude/gallant-galileo-uswp4k` beim Stand `28416b4`: sechs Clubs pro Liga, ein Aufsteiger und ein Absteiger pro Grenze, 89 Clubs. `main` (383421b) hat dieses Ligasystem noch nicht.

## Bestand

**Heimstandort.** `HOME_VENUE` ist fest «Heimstadion Bümplizstrasse 45, Bern» (`app/travel-geography.ts`). Davon hängen ab:

* Heimspiele und Reisedistanz (`app/travel-data.ts`).
* Die Reisekategorie (`classifyDestination`). Sie ist auf Bern zugeschnitten: Stadt Bern, Kanton BE, Thun und Biel als Sonderfälle.
* Die Routenplanung (`app/journey-routing.ts`). Teambus zum Bahnhof Bern, Fahrzeiten `RAIL_MINUTES_FROM_BERN`.

Laufende Reisen speichern ihren Startpunkt in `journey.origin`. Ein späterer Wechsel des Heimstandorts trifft sie nicht.

**Clubs je Liga** (Division 1 ist die unterste):

| Division | Liga | Lage der KI Clubs |
| --- | --- | --- |
| 1 | Chaosliga | 5 fiktive Clubs in Bern |
| 2 bis 3 | Quartier und Stadtliga | 12 Clubs in Bern (je einer fiktiv) |
| 4 bis 7 | Agglomeration bis Regionalelite | 24 Clubs im Kanton Bern, 7 bis 47 km |
| 8 | Mittellandliga | 6 Clubs in SO und FR, 10 bis 30 km |
| 9 bis 14 | Deutschschweiz bis Super League | 36 Clubs schweizweit |
| 15 | Weltliga | 6 Clubs im Ausland |

**Echte Clubs nahe an möglichen Heimstädten** (Katalog ohne fiktive Clubs):

| Stadt | bis 15 km | bis 40 km | bis 80 km |
| --- | --- | --- | --- |
| Bern | 26 | 40 | 51 |
| Zürich | 3 | 10 | 19 |
| Basel | 1 | 4 | 44 |
| Genf | 2 | 2 | 5 |
| Lausanne | 2 | 3 | 33 |
| Luzern | 1 | 6 | 52 |
| Lugano | 2 | 2 | 2 |

**Das Hauptproblem sind die Daten.** Für jede neue Stadt braucht es 47 regionale Clubs für die Divisionen 1 bis 8 (5 in der untersten Liga, je 6 darüber), jeweils mit geprüftem Platz und Route. Ausserhalb Berns gibt es heute praktisch keine.

**Kartendienste von hier aus**, je ein Statusabruf:

| Dienst | Erreichbar | Bedeutung |
| --- | --- | --- |
| Overpass | nein | Fussballfelder aus OpenStreetMap lassen sich nicht gesammelt abfragen |
| Nominatim | ja | Einzelne Orte lassen sich suchen |
| OSRM | ja | Strassenrouten lassen sich berechnen |

**Routen.** Der Routencache (`app/route-cache`, 1,5 MB) ist nach Koordinaten von bis abgelegt und hat heute nur Strecken ab Bern. Fehlt ein Eintrag, zeichnet die Karte eine geometrische Ersatzlinie. Das ist getestet.

**Bahn.** Bahnhöfe (`STATIONS`) gibt es für Bern, Zürich, Basel, Genf, Lausanne, Luzern, St. Gallen, Winterthur, Lugano, Sion, Thun, Biel und Chur.

## Vorschlag

### Städte

| | Städte | Begründung |
| --- | --- | --- |
| **Empfohlen** | Bern, Zürich, Basel, Genf | Drei Sprachregionen. Genf liegt 130 km von Bern und 225 km von Zürich: weit genug auseinander für die Abnahme mit zwei entfernten Städten. Je ein Bahnhof und ein geprüftes Stadion im Katalog. |
| Kleiner | Bern, Zürich | Halbiert den Datenaufwand. |
| Grösser | die 12 Städte aus dem Ticket | Rund 500 neue regionale Clubs mit Plätzen. Für Phase 1 zu viel. |

### Heimstadionpunkt

Pro Stadt ein fester, fiktiver Club Standort auf einem realen öffentlichen Fussballplatz, wie heute die Bümplizstrasse 45 in Bern. Die Koordinate wird einmal von Hand über Nominatim und OSM geprüft und mit Quelle gespeichert. Keine Verwechslung mit Letzigrund, Joggeli oder Stade de Genève.

### Regionale Ligen und Verträglichkeit mit Sonnets Ligasystem

* **Spielstand.** Neues optionales Feld `seasonMode.homeCity`. Fehlt es, gilt `"bern"`.
* **Katalog pro Welt.** Jede Welt bekommt ihren eigenen Katalog: die regionalen Clubs ihrer Stadt für die Divisionen 1 bis 8, dazu die gemeinsamen Clubs der Divisionen 9 bis 15.
  * Jeder Katalog hat genau 89 Clubs: 5 in der untersten Liga, je 6 darüber.
  * `normalizeAiLeagues`, `defaultAiLeagues` und `advanceAiLeagues` bleiben in ihrer Logik gleich. Sie lesen nur den Katalog der Welt statt `SEASON_CLUBS`.
* **Bern bleibt Byte für Byte gleich.** Der Berner Katalog entspricht exakt dem heutigen `SEASON_CLUBS`, dieselben IDs in derselben Reihenfolge. Damit bleiben gespeicherte `aiLeagues`, Tabellen, `fixtures` und `lastAiMoves` aller alten Spielstände gültig. Regionale Clubs anderer Städte bekommen eigene ID Präfixe (`zh-`, `bs-`, `ge-`). Eine Zuordnung kann deshalb nie versehentlich zwischen Städten passen.
* **Grenze zwischen Division 8 und 9.** Hier tauscht ein regionaler Club mit einem nationalen. Das bleibt erlaubt: Der Aufsteiger spielt danach national, der Absteiger in der regionalen Liga dieser Welt. Ab Division 9 sind alle Welten gleich.
* **Liganamen.** Je Region eigene Namen, zum Beispiel «Zürcher Quartierliga» oder «Ligue de quartier genevoise». Die Ligen 9 bis 15 behalten ihre Namen.

### Reisen

* `homeVenue(features)` ersetzt `HOME_VENUE` an allen Stellen, die einen Spielstand haben. Neue Reisen speichern wie bisher `origin`.
* `classifyDestination` wird relativ zur Heimat: gleiche Stadt bis 5 und 15 km, Agglomeration bis 40 km, Heimatkanton, Nachbarkantone bis 90 km, Sprachregion, Schweiz. Dafür braucht jede Stadt einen Kanton und eine Liste der Nachbarkantone. Für Bern muss das Ergebnis identisch bleiben. Ein Test vergleicht alle 89 Clubs mit dem heutigen Wert.
* **Routenplanung.** Bahnhof der Heimatstadt statt Bern.
  * Fahrzeiten: aus einer neuen Tabelle je Stadt, sonst eine Schätzung über die Distanz.
  * Routencache: neue Einträge ab den neuen Heimpunkten, erzeugt mit den vorhandenen Skripten in `scripts/travel`. Bis dahin zeichnet die Karte die geprüfte Ersatzlinie.
* **Ausgleich.** Ein Test prüft je Stadt die mittlere Reisedistanz pro Division gegen Bern, mit einer Toleranz, die noch festzulegen ist. So bleiben Reisezeiten und Einnahmen vergleichbar.

### Alte Spielstände, Prestige und Koop

* **Alte Spielstände.** Ohne `homeCity` gilt Bern, nichts ändert sich. Es gibt kein automatisches Umschreiben von Spielplänen, laufenden Reisen oder Ergebnissen.
* **Wahl bei neuen Spielständen.** Im Clubaufbau oder Tutorial, vor der ersten Saison.
* **Wechsel für bestehende Konten.** Nur beim Start eines Prestiges. Dann beginnt der Lauf ohnehin in der Chaosliga, und `startSeasonPrestige` setzt die Ligazuordnung schon heute zurück. Nie mitten in einer Saison oder Reise, deshalb kein Ausnutzen vor Auswärtsspielen.
* **Koop.** Eine Heimstadt pro Welt. Der Ersteller wählt sie beim Anlegen. Ein Wechsel ist nur beim Prestige der Welt möglich, über die bestehende Prestige Abstimmung. Alte Welten bleiben Bern.

### Mögliche Umsetzungsschritte nach Freigabe

1. **Datenpaket je Stadt.** Heimpunkt und 47 regionale Clubs mit Plätzen und Quellen, als reine Daten und Tests. Ohne Wirkung, solange niemand eine andere Stadt wählt.
2. **Katalog je Welt in `season-leagues.ts`.** Mit dem Test «Bern unverändert»: alte Spielstände laden identisch.
3. **Heimbezogene Reisekategorie und Routenplanung.** Mit Vergleichstest für Bern.
4. **Auswahl im Clubaufbau und beim Prestige**, gestaltet nach den Apple Design Richtlinien. Koop Erstellung und Prestige Abstimmung.
5. **Routencache für die neuen Heimpunkte.** Dazu Browserprüfung mobil und am Desktop für Bern und Genf.

## Offene Entscheidungen

1. **Städte:** Bern, Zürich, Basel und Genf (empfohlen), nur Bern und Zürich, oder alle 12?
2. **Heimpunkt:** fiktiver Clubstandort auf einem realen öffentlichen Platz (empfohlen), das grosse Stadion der Stadt, oder das Stadtzentrum?
3. **Regionale Gegner:** echte Amateurclubs, wo Platz und Verein geprüft sind, und klar fiktive Clubs für den Rest (empfohlen)? Oder alle fiktiv, oder alle echt (braucht viel Handarbeit, solange Overpass nicht erreichbar ist)?
4. **Regionale Tiefe:** Divisionen 1 bis 8 regional (empfohlen), oder nur 1 bis 7 (dann bleibt die Mittellandliga für alle Städte bernnah)?
5. **Wann wählen:** neue Spielstände im Clubaufbau und bestehende beim Prestige (empfohlen)? Oder zusätzlich ein einmaliger Wechsel für bestehende Konten am Saisonende?
6. **Späterer Wechsel:** nur beim Prestige (empfohlen), nie, oder zwischen Saisons mit Wartezeit?
7. **Koop:** eine Stadt pro Welt, Wahl durch den Ersteller, Wechsel nur beim Welt Prestige per Abstimmung (empfohlen)?
8. **Liganamen:** regional benannt (empfohlen) oder neutral?
9. **Routen:** neue Routen mit dem freien öffentlichen OSRM Dienst erzeugen (kostenlos, aber begrenzte Last; einmalig, Ergebnis im Cache)? Oder in Phase 1 nur die Ersatzlinie?
