# Heimstädte Phase 1: Datenpaket

Stand 12. November 2026, Branch `claude/opus-home-cities-data` ab `integration/sonnet-main-candidate` (`c145b19`). Konzept: Branch `claude/opus-home-stadium-plan`, `docs/home-stadium-phase1.md`.

**Freigabe von Nicolas:**
* Städte Bern, Zürich, Basel und Genève.
* Fiktiver Heimclub auf einem dokumentierten realen Platz.
* Lokale Gegner bis Division 8: echte Clubs, wo belegt, sonst klar fiktiv.
* Bern ist Standard für alte Spielstände.
* Wechsel nur beim Prestige; im Koop eine Stadt pro Welt, Wechsel beim Welt Prestige per Abstimmung.
* Sechs Clubs pro Liga, ein Aufsteiger und ein Absteiger bleiben.

**Nur Daten und Tests.** Nichts im Spiel liest `app/home-cities.ts`. Jeder Spielstand spielt weiter in Bern, bis der Katalog pro Welt verdrahtet ist (siehe unten).

## Inhalt

| Datei | Zweck |
| --- | --- |
| `app/home-cities.ts` | Vier Städte, Heimpunkt, Liganamen der Divisionen 1 bis 8, 47 lokale Clubs pro Stadt. `worldCatalog(stadt)` liefert die 89 Clubs einer Welt, `homeCityOf(gespeichert)` liefert Bern für jeden Spielstand ohne gültige Stadt. |
| `app/home-cities/pitches.json` | Plätze aus OpenStreetMap mit OSM Objekt, Gemeinde und Kanton, dazu die belegten Clubs mit Quelle und Zitat. |
| `scripts/home-cities/fetch-pitches.mts` | Erzeugt `pitches.json`. Läuft nur von Hand, mit Zwischenspeicher, höchstens eine Nominatim Anfrage alle 1,5 Sekunden. |
| `tests/home-cities.test.ts` | 7 Tests, in `npm run test:unit`. |

## Belegte echte Clubs

Belegt heisst: Die **offizielle Vereinsseite** nennt den Heimplatz. Nominatim liefert nur die Lage eines Platzes, nie den Verein.

Die Verbände (football.ch, FVRZ, FVNWS, ACGF) untersagen maschinellen Zugriff ausdrücklich und blockieren ihn. Ihre Seiten wurden deshalb nicht verwendet und auch nicht umgangen.

| Stadt | Club | Quelle (Zitat) | Liga im Spiel |
| --- | --- | --- | --- |
| Zürich | FC Oerlikon/Polizei ZH | fcop.ch: «Heimplatz: Sportanlage Neudorf» | Division 2 |
| Basel | FC Amicitia Riehen | fcamicitia.ch: «ein Zuhause auf der Sportanlage Grendelmatte», Grendelgasse 21, Riehen | Division 2 |
| Basel | FC Pratteln | fcpratteln.ch: «Clubhaus und Sportanlage: Sportanlage in den Sandgruben, Giebenacherstrasse 14» | Division 4 |
| Basel | SC Dornach | scdornach.ch: «Erneuerung der Fussballplätze im Gigersloch» | Division 8 |
| Genève | Signal FC Bernex-Confignon | fcsignal.ch: Heimspiel im «Stade municipal de Bernex». Platz laut AGFC Platzverzeichnis: Chemin du Signal 31, Bernex, 110 m vom OSM Objekt «Centre sportif du Signal» | Division 4 |
| Genève | Meyrin FC | meyrinfc.ch: «Secrétariat Stade des Arbères, Avenue Louis-Rendu 11, 1217 Meyrin». AGFC Platzverzeichnis: gleiche Adresse, 30 m vom OSM Objekt «Centre sportif des Vergers» | Division 7 |

**Hinweise von Nicolas, geprüft am 12. November 2026:**

| Hinweis | Ergebnis |
| --- | --- |
| FC Allschwil, Sportanlage im Brüel | Vereinsseite: «Hegenheimermattweg 132, 4123 Allschwil». Der Hauspunkt 132 liegt beim «Restaurant im Brüel», ein kartiertes Spielfeld lässt sich dort aber nicht bestätigen. Deshalb **nicht platziert**. |
| SV Muttenz, Margelacker | Die Quelle ist das Matchcenter des Verbands (FVNWS); maschinelle Zugriffe sind dort untersagt, daher nicht abgerufen. Die eigene Seite (svmuttenz.ch) nennt den Platz nicht. **Nicht belegt.** |
| FC Choulex | fcchoulex.ch war nicht erreichbar. **Nicht belegt.** |
| Meyrin FC, Stade des Arbères | **Belegt**, siehe Tabelle. |
| Genfer Platzverzeichnis (agfc.ch) | Bestätigt die Plätze von Meyrin FC und Signal FC. Es ordnet keine Teams zu und wird deshalb nur als zweite Quelle für den Platz verwendet. |

**Weitere Prüfungen:**
* Étoile Carouge: Profiklub, gehört nicht in eine Regionalliga.
* Kloten, Altstetten, Witikon: Platz genannt, aber nicht als Heimspielort.
* Nicht erreichbar: Red Star, Seefeld, Concordia, Black Stars, Lancy, Onex, Vernier.

**Belegter Anteil der 47 lokalen Clubs:**

| Stadt | Echt | Fiktiv |
| --- | --- | --- |
| Zürich | 1 | 46 |
| Basel | 3 | 44 |
| Genève | 2 | 45 |
| Bern | unverändert | wie heute |

Echte Clubs spielen nie in der Chaosliga (Division 1). Die bleibt wie in Bern eine Spassliga fiktiver Clubs.

## Plätze und Zuteilung

**Heimpunkte**, jeweils mit fiktivem Heimclub:
* Zürich: Schul und Sportanlage Apfelbaum, Oerlikon. Nicht Neudorf, weil dort FC Oerlikon/Polizei zu Hause ist.
* Basel: Sportplatz Rheinacker, Hirzbrunnen.
* Genève: Centre Sportif du Bout du Monde, Champel.

**Filter:**
* Keine Stadien von Profiklubs.
* Keine Platznamen mit Clubkürzeln.
* Kein Tennis, Padel, Kart, Schach, keine Pfadfinder, Pumptrack oder Leichtathletik.

**Zuteilung nach Berns Distanzprofil:** Jeder Ligaplatz bekommt den Platz, dessen Distanz zum Heimpunkt der des Berner Clubs am nächsten liegt.

**Geteilte Plätze:** Fehlen Plätze, teilen sich zwei fiktive Clubs einen. Nie in derselben Liga, nie mehr als zwei, nie der Heimplatz.

| Stadt | Geteilte Plätze |
| --- | --- |
| Zürich | 0 |
| Basel | 16 |
| Genève | 9 |

**Mittlere Distanz zum Heimpunkt in km**, Division 1 bis 8:

| Stadt | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bern | 1,2 | 2,1 | 2,6 | 9,3 | 13,6 | 31,8 | 12,7 | 23,6 |
| Zürich | 1,8 | 3,2 | 6,0 | 10,2 | 13,6 | 30,9 | 14,5 | 24,3 |
| Basel | 4,8 | 7,3 | 14,2 | 17,2 | 22,1 | 22,7 | 12,2 | 18,1 |
| Genève | 2,0 | 3,6 | 4,4 | 9,4 | 13,5 | 26,1 | 12,4 | 22,9 |

**Bekannte Abweichung Basel:** Die Stadtligen liegen weiter draussen als in Bern, weil OpenStreetMap in Basel Stadt über die Suche nur wenige getrennte Plätze liefert. Insgesamt liegt Basel im Rahmen (Test: Gesamtmittel höchstens 35 % von Bern entfernt). Verbessern lässt sich das mit weiteren belegten Basler Plätzen.

## Nächste Schritte

1. **Katalog pro Welt:** in `app/season-leagues.ts` (`normalizeAiLeagues`, `advanceAiLeagues`) und `app/travel-geography.ts` (`defaultAiLeagues`, `seasonClubsOf`) `worldCatalog(homeCity)` statt `SEASON_CLUBS`. Dazu `seasonMode.homeCity` optional mit Standard Bern und der Test «alte Spielstände laden identisch».
2. **Heimpunkt und Reisekategorie relativ zur Heimat:** Vergleichstest Bern, Bahnhof der Heimatstadt.
3. **Auswahl beim Prestige**, im Koop per Abstimmung. Oberfläche nach den Apple Design Richtlinien.
4. **Routencache** für die neuen Heimpunkte, sonst die getestete Ersatzlinie.
5. **Mehr echte Clubs,** sobald weitere offizielle Vereinsseiten den Heimplatz nennen. Der Eintrag kommt in `VERIFIED` im Generator, der Test des belegten Anteils wird angepasst.
