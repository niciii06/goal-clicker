# Heimstädte Phase 1: Datenpaket (Zwischenstand)

Stand 12. November 2026, Branch `claude/opus-home-cities-data` ab `integration/sonnet-main-candidate` (`c145b19`). Konzept und Entscheide: Branch `claude/opus-home-stadium-plan`, `docs/home-stadium-phase1.md`.

**Freigabe von Nicolas:**
* Städte Bern, Zürich, Basel und Genève.
* Fiktiver Heimclub auf einem dokumentierten realen Platz.
* Lokale Gegner bis Division 8: echte Clubs, wo verifiziert, sonst klar fiktiv.
* Bern bleibt Standard für alte Spielstände.
* Ein Wechsel ist nur beim Prestige möglich, im Koop eine Stadt pro Welt mit Wechsel beim Welt Prestige per Abstimmung.
* Sechs Clubs pro Liga, ein Aufsteiger und ein Absteiger bleiben.

## Was es gibt

`scripts/home-cities/fetch-pitches.mts` sammelt reale Sportanlagen aus OpenStreetMap über Nominatim und schreibt `app/home-cities/pitches.json`.

**Höflicher Abruf:**
* Eine Anfrage nach der anderen, mindestens 1,5 Sekunden Abstand.
* Eigene Kennung, jede Antwort im Zwischenspeicher.
* Wird nur von Hand gestartet, nie in Tests.

**Filter:**
* Nur Anlagen der Art Platz, Sportzentrum, Stadion oder Spielwiese, sowie Schulanlagen mit «Sportanlage» im Namen.
* Kein Tennis, Padel, Kart und Ähnliches.
* Keine grossen Stadien oder Plätze bekannter Profiklubs.
* Keine Namen mit Clubkürzeln (FC, SC …), damit der fiktive Club nie für einen echten gehalten wird.

**Zuteilung:** Für jeden Berner Club der Divisionen 1 bis 8 nimmt der Generator den freien Platz der Region, dessen Distanz zum neuen Heimpunkt am nächsten liegt. Jede Stadt übernimmt so Berns Distanzprofil pro Liga, damit Reisezeiten und Einnahmen vergleichbar bleiben.

**Echte Clubs:** Sie lassen sich hier nicht belegbar einem Platz zuordnen. OpenStreetMap kennt keine Vereinsobjekte (Proben «FC Red Star Zürich», «FC Concordia Basel», «Servette FC Chênois»), und Overpass ist nicht erreichbar. Nach der freigegebenen Regel sind die lokalen Gegner deshalb vorerst alle fiktiv. Echte Clubs können später einzelne fiktive ersetzen, sobald Verein und Platz belegt sind.

## Stand der Läufe

| Stadt | Heimpunkt (OSM) | Ergebnis |
| --- | --- | --- |
| Bern | bestehendes Heimstadion Bümplizstrasse 45 | Katalog wie heute, keine neuen Daten |
| Zürich | Sportanlage Neudorf, Oerlikon | **vollständig:** 47 Plätze in Division 1 bis 8, 28 in Reserve |
| Basel | Sportplatz Rheinacker, Hirzbrunnen | **unvollständig:** Divisionen 1 bis 5 gefüllt, in Division 6 ist der Topf leer |
| Genève | Centre sportif du Bout-du-Monde | noch nicht gelaufen (der Lauf bricht bei Basel ab) |

Nominatim findet um Basel zu wenige getrennte Anlagen; mehr Gemeinden in BL, AG und SO haben bisher nicht gereicht. `pitches.json` ist deshalb noch nicht geschrieben.

## Nächste Schritte

1. **Basel auffüllen.** Weitere Suchbegriffe («Fussballplatz», «Rasenplatz») und Gemeinden im Fricktal, Laufental, Thierstein und Jura. Reicht das nicht, teilen sich in den Divisionen 6 bis 8 zwei fiktive Clubs einen Platz, wie es Sonnets fiktive sechste Clubs bereits tun.
2. **Genève laufen lassen**, mit derselben Methode.
3. **Prüfen, was die Läufe gefunden haben.** Generische Namen («Sportplatz») bekommen im Datenmodul die Gemeinde dazu. Plätze, die doch zu einem Profiklub gehören, kommen auf die Ausschlussliste.
4. **`app/home-cities.ts`.** Städte, Heimpunkte, 47 fiktive Clubs pro Stadt mit Präfix `zh-`, `bs-`, `ge-` und regionale Liganamen. Bern liefert exakt die heutigen Clubs der Divisionen 1 bis 8.
5. **`tests/home-cities.test.ts`.**
   * Bern unverändert gegenüber `SEASON_CLUBS`.
   * Pro Stadt 5 und 6 mal 6 Clubs, zusammen mit den nationalen Ligen 89.
   * Eindeutige IDs.
   * Jeder Platz mit OSM Quelle.
   * Mittlere Distanz pro Division im Rahmen von Bern.
   * Keine Namensgleichheit mit echten Clubs.
6. **Danach,** getrennt: Katalog pro Welt in `app/season-leagues.ts`, Heimpunkt und Reisekategorie, Auswahl beim Prestige, Koop Abstimmung.
