# Echte Clubs im Startkatalog

Regel von Nicolas (16. November 2026): Fiktive KI Clubs dürfen nur in der untersten Liga (Liga 15) **starten**. Alle Clubs, die in Liga 14 bis Liga 1 beginnen, müssen echte Clubs mit offiziellem Namen sein. Ein fiktiver Club, der aus Liga 15 aufsteigt, bleibt erlaubt. Auf und Abstieg (ein Club hoch, einer runter, `SEASON_PROMOTION_PLACES` und `SEASON_RELEGATION_PLACES` je 1) ändern sich nicht.

Stand: Branch `claude/sonnet-real-club-catalog` auf main `308007b`. **Phase 1 ist umgesetzt (Weltliga), der Rest ist offen und unten pro Region aufgelistet.** Der Test `tests/real-club-catalog.test.ts` hält den Rest als genaue Zahlen fest; sie dürfen nur sinken.

## Phase 1: Weltliga (Liga 1), alle vier Heimstädte

Die sechs Clubs tragen jetzt ihren offiziellen Namen. IDs und Spielorte bleiben, es gibt weder neue Koordinaten noch neue Routen. Die alten Parodienamen stehen weiter in `LEGACY_POOLS`, damit gespeicherte Tabellen und Reisen denselben Spielort finden.

| Stabile ID (Altspielstände) | Früherer Name | Jetzt | Spielort (Katalog) |
|---|---|---|---|
| `world-real-madreto` | Real Madreto | Real Madrid CF | Santiago Bernabéu |
| `world-fc-barceloneta` | FC Barceloneta | FC Barcelona | Camp Nou |
| `world-liverpuhl-fc` | Liverpuhl FC | Liverpool FC | Anfield |
| `world-manchester-cite` | Manchester Cité | Manchester City | Etihad Stadium |
| `world-bayern-muenchan` | Bayern Münchan | FC Bayern München | Allianz Arena |
| `world-paris-saint-german` | Paris Saint German | Paris Saint-Germain | Parc des Princes |

**Quellen für die Namen (abgerufen am 21. November 2026):**
* realmadrid.com: «Real Madrid CF official website».
* fcbarcelona.com: «Official FC Barcelona Website».
* liverpoolfc.com: «Liverpool FC».
* psg.fr: «PSG.FR, Official site of Paris Saint-Germain».
* mancity.com und fcbayern.com blockieren automatische Abrufe (403), nicht umgangen. Zweitquelle: de.wikipedia.org «Fußball-Club Bayern München e. V., kurz FC Bayern München» und en.wikipedia.org «Manchester City F.C.» (Spielname «Manchester City»). Diese beiden Namen sind damit nur durch eine Zweitquelle belegt.

Die Spielorte sind die bereits geprüften Katalogeinträge (`VENUES`, Audit in `app/stadium-audit.json`) und bleiben unverändert. Camp Nou: Der Katalog führt weiter den geprüften Ankerpunkt, auch wenn der Club zeitweise im Estadi Olímpic spielte.

Weitere Anpassung: `app/match-colours.ts` erkennt jetzt auch «Real Madrid» und «Manchester City» (vorher nur die Parodienamen), damit die Trikotfarben bleiben.

## Rest: fiktive Clubs ausserhalb von Liga 15 (Stand `308007b`, unverändert)

Pro Welt 89 Clubs, 15 Ligen. Fiktiv und zu ersetzen:

| Heimstadt | Gemeinsame Plätze Liga 4 bis 7 | Regionale Ligen 8 bis 14 (42 Clubs) | Summe |
|---|---|---|---|
| Bern | 4 | 3 fiktiv, 39 echt (Heimberg, Stettlen 08, Oberdiessbach, Grosshöchstetten-Schlosswil ersetzt, siehe unten) | 7 |
| Zürich | 4 | 41 fiktiv, 1 echt (FC Oerlikon/Polizei ZH) | 45 |
| Basel | 4 | 39 fiktiv, 3 echt (FC Amicitia Riehen, FC Pratteln, SC Dornach) | 43 |
| Genève | 4 | 40 fiktiv, 2 echt (Signal FC Bernex-Confignon, Meyrin FC) | 44 |

**Gemeinsame Plätze (wirken in allen vier Welten, deshalb zuerst):** `extra-4-fc-alpenfestung` (FC Alpenfestung, Liga 4), `extra-5-fc-gotthard-murmeltiere` (Liga 5), `extra-6-fc-l-man-mouettes` (Liga 6), `extra-7-fc-z-risee-b-tler` (Liga 7). Ihre Spielorte sind geliehene geprüfte Plätze anderer Clubs der Liga.

**Nur Bern, Liga 8 bis 14:** `extra-8-fc-r-stigraben-united`, `extra-9-fc-seeland-hechte`, `extra-10-fc-emmental-k-sekicker`, `extra-11-fc-g-rbetal-kickers`, ~~`extra-11-fc-g-rbetal-kickers`~~ (ersetzt durch FC Stettlen 08), ~~`extra-12-fc-worblental-rangers`~~ (ersetzt durch FC Heimberg), `extra-13-sc-marzili-bern`, `extra-14-fc-aaref-chse-bern`.

**Zürich, Basel, Genève:** IDs `zh-D-N`, `bs-D-N`, `ge-D-N` (Division D = 2 bis 8, Liga 16 minus D), pro Liga bis zu sechs fiktive Clubs. Anzahl je Liga (Liga 14, 13, ..., 8): Zürich 5, 6, 6, 6, 6, 6, 6. Basel 5, 6, 5, 6, 6, 6, 5. Genève 6, 6, 5, 6, 6, 5, 6.

## Warum nicht mehr in diesem Schritt

* **Belegte Plätze fehlen.** Für jeden Ersatz braucht es den offiziellen Vereinsnamen, den Heimplatz laut Vereinsseite und eine geprüfte Koordinate (OSM Fussballfeld ab 3500 m², Eintrag in `app/stadium-audit.json`). Verbandsseiten (football.ch, FVRZ, FVNWS, ACGF) untersagen maschinelle Zugriffe, Overpass ist aus dieser Umgebung nicht erreichbar, viele Vereinsseiten antworten nicht. Das ist derselbe Stand wie im Datenpaket `docs/home-cities-data.md`.
* **Keine ungeprüften Koordinaten.** Ein neuer Spielort bekäme sonst eine Koordinate ohne Audit und eine Strecke nur als Ersatzlinie (kein Routencache).

## Kandidaten für die vier gemeinsamen Plätze (Vereinsseite nennt den Heimplatz, Koordinate und Audit fehlen noch)

| Club | Heimplatz laut Vereinsseite | Noch nötig |
|---|---|---|
| Yverdon Sport FC | Stade Municipal, Yverdon-les-Bains (yverdonsport.ch) | OSM Feld und Audit, Routen |
| FC Wil 1900 | Lidl Sportpark Bergholz (fcwil.ch); Nominatim kennt OSM way 38526031 («sports_centre») | Fussballfeld Polygon und Audit, Routen |
| FC Schaffhausen | FCS Arena, Schaffhausen (fcschaffhausen.ch) | OSM Feld und Audit, Routen |
| FC Rapperswil-Jona | Stadion Grünfeld (fcrj.ch) | OSM Feld und Audit, Routen |
| FC Locarno (Reserve) | Stadio Comunale Lido, Locarno (fclocarno.ch) | OSM Feld und Audit, Routen |

Ligazuordnung wäre wie bei den übrigen Clubs eine Karrierestufe, keine exakte Abbildung der Schweizer Pyramide. Für Liga 8 bis 14 der drei neuen Heimstädte und die sieben Berner Plätze gibt es bisher keine belegten Kandidaten.

## Plan für die Ablösung der übrigen Clubs (ohne Spielstände zu verändern)

* **IDs bleiben.** Ein ersetzter Club behält seine ID (`extra-4-...`, `zh-9-3`, ...), damit `seasonMode.aiLeagues`, Tabellen (`clubId`) und `lastAiMoves` gültig bleiben. Nur `name`, `venue` und `fictional` ändern sich.
* **Alte Namen finden ihren Platz.** Wie bei der Weltliga: Der frühere fiktive Name bleibt als Alias, damit eine laufende Tabelle oder Reise ihren Spielort behält (`venueForClubName`).
* **Laufende Saison:** gespeicherte Tabellenzeilen tragen den alten Namen bis zum Saisonende, danach gilt der Katalog.
* **Aufgestiegene Liga 15 Clubs** behalten Identität, Name und Platz (Test deckt das ab).

## Getrennte Unklarheiten (nicht Teil dieser Änderung)

1. **Anzahl Aufsteiger:** Code und Tests nutzen 1 und 1 (Entscheid vom 12. November). Hier unverändert.
2. **Turnier, Transfer und News Texte** (`app/features/catalog.ts`, `app/features/news-data.ts`) nennen weiter die Parodienamen (zum Beispiel «Real Madreto», «Liverpuhl FC») und Parodien der Spielernamen. Ob diese ebenfalls echt werden sollen (auch aus Marken und Lizenzgründen), ist nicht entschieden und gehört nicht in den Start Katalog der Ligen.
3. **Der sechste Club der eigenen Liga** (`defaultAiLeagues`) spielt in der untersten Liga. Sobald die fiktiven sechsten Clubs ersetzt sind, kann dort ein echter Club starten; das erlaubt die Regel, ändert aber die gewohnte Zusammensetzung von Liga 15.

## Phase 2, erster regionaler Platz: FC Heimberg (Bern, Liga 12)

Ersetzt `extra-12-fc-worblental-rangers` (FC Worblental Rangers). **Die ID bleibt**, damit gespeicherte Ligazuteilungen, Tabellen und `lastAiMoves` gültig bleiben. Der alte Name führt weiter zu seinem früheren Spielort (`REPLACED_CLUB_GROUNDS`), solange eine gespeicherte Tabelle oder Reise ihn trägt. Liga 12 ist wie bei allen Katalogclubs eine Karrierestufe, keine Abbildung der Schweizer Pyramide.

| Angabe | Beleg |
|---|---|
| Heimspielstätte, Hauptplatz Naturrasen 96 × 61 m mit Flutlicht, Trainingsplatz 84 × 42 m, Club an der Schützenstrasse 73 | Anlageneintrag «Waldgarten» des FVBJ (von Work abgerufen, Matchcenter blockiert automatische Zugriffe) und fcheimberg.ch/verein/ (hinter einer Browser Prüfseite, nicht abgerufen) |
| Adresse Schützenstrasse 73, 3627 Heimberg bei 46.79110, 7.59736 | swisstopo Adressdienst (Bundesregister), 56 m vom Platzmittelpunkt |
| Platz: OpenStreetMap way 93077552, beleuchtet, Rasen, 6232 m² inklusive Auslauf, kleinstes Rechteck 98.8 × 63.2 m | passt zu 96 × 61 m (Auslauf je 1.4 m). Die beiden Nachbarplätze way 333174875 (94 × 54 m) und way 333174873 (91 × 44 m, wohl der Trainingsplatz) passen nicht |
| Platzmittelpunkt 46.7908374, 7.5979965 | Schwerpunkt des OSM Polygons, liegt innerhalb |
| Öffentlicher Fahrzeugpunkt 46.791334, 7.597882 | Schützenstrasse (öffentlich, ohne Zufahrtsbeschränkung in OSM), nächste befahrbare Strasse nach OSRM, 56 m vom Platzmittelpunkt |

Die Strecke von Bern zum Platz ist neu im Routencache (`bus:46.94689,7.39373:46.79084,7.59800`, 34.1 km, 30 Minuten) und endet auf diesem Punkt an der Schützenstrasse, die letzten 56 m bis zum Platz sind geschätzt (wie bei anderen Plätzen). Es wurden keine bestehenden Routen verändert. `app/stadium-audit.json` führt den Platz mit OSM way und Fläche.

**Bern Rest:** 6 fiktive Plätze (Liga 8, 9, 10, 11, 13, 14) und die gemeinsamen Plätze Liga 4 bis 7. Offen bleiben ausserdem Goldstern (Waldruhe, Löhrwaldweg 9, Adresse und Platz belegt, aber Spielstätte der 1. Mannschaft gegenüber Bremgarten und öffentliche Zufahrt noch offen) und die anderen Kandidaten aus dem Notion Kommentar.

## Phase 2, zweiter regionaler Platz: FC Stettlen 08 (Bern, Liga 11)

Ersetzt `extra-11-fc-g-rbetal-kickers` (FC Gürbetal Kickers). **Die ID bleibt**, der alte Name führt weiter zu seinem früheren Spielort (`REPLACED_CLUB_GROUNDS`). Liga 11 passt zur Entfernung (Walkringen liegt 17 km vom Heimstadion, wie Rubigen, Belp, Jegenstorf der Liga); die echte Spielklasse des Clubs ist tiefer, die Katalogstufe ist wie überall eine Näherung.

| Angabe | Beleg |
|---|---|
| Heimspiele «auf dem Naturrasen beim Schulhaus in Walkringen» (Training in Stettlen, Winter in der Halle) | Vereinsseite fcstettlen08.ch/teams/aktive, Abschnitt «Spieltag» (am 23.11.2026 abgerufen) |
| Schulareal Primar- und Sekundarschule Walkringen bei 46.94925, 7.61889, Adresse Dornistrasse 10, 3512 Walkringen | swisstopo Ortsnamen und Adressdienst |
| Platz: OSM way 318117223, 6198 m², kleinstes Rechteck 96.4 × 65.5 m, der **einzige** kartierte Fussballplatz in Walkringen, 45 m vom Schulareal | OpenStreetMap (Quelle Bing, 2014, ohne Belagsangabe) |
| Platzmittelpunkt 46.9496329, 7.6190465 | Schwerpunkt des OSM Polygons, liegt innerhalb |
| Strassenendpunkt | OSRM Route endet bei 46.949452, 7.618341 auf der Servicestrasse am Schulparkplatz (57 m vom Mittelpunkt, kein Zugangsverbot in OSM), die Dornistrasse (öffentlich) liegt 126 m entfernt |

Neu im Routencache ist nur `bus:46.94689,7.39373:46.94963,7.61905` (26.2 km, 32 Minuten). Die Matchcenter Seite des FVBJ blockiert automatische Zugriffe; die Platzangabe stützt sich auf die Vereinsseite.

## Phase 2, Plätze drei und vier: FC Oberdiessbach (Liga 9) und FC Grosshöchstetten-Schlosswil (Liga 10)

Beide Plätze stützen sich auf die FVBJ Anlageneinträge (von Work am 23. November 2026 abgerufen; das Matchcenter blockiert automatische Zugriffe). Die IDs der ersetzten Clubs bleiben (`extra-9-fc-seeland-hechte`, `extra-10-fc-emmental-k-sekicker`), die alten Namen führen weiter zu ihrem früheren Spielort. Die Ligen sind Näherungen nach Entfernung: Oberdiessbach liegt 21 km vom Heimstadion (Liga 9: Münsingen, Köniz, Muri), Grosshöchstetten 19 km (Liga 10: Langnau, Burgdorf, Emmental).

| | FC Oberdiessbach, Sportanlage Leimen | FC Grosshöchstetten-Schlosswil, Arniacher |
|---|---|---|
| FVBJ Eintrag | Hauptplatz Naturrasen 100 × 64 m, Kunstrasenplatz 90 × 57.6 m, Helisbühlstrasse | Hauptplatz 100 × 64 m |
| OSM Hauptplatz | way 208125381: Rasen, beleuchtet, 106.5 × 69.4 m, 7374 m² | way 185813961: Rasen, 107.0 × 70.9 m, 7498 m² |
| Abweichung zum FVBJ Mass | +6.5 / +5.4 m (Auslauf der Karte) | +7.0 / +6.9 m (Auslauf der Karte) |
| Gegenprobe | der zweite Platz way 208125372 (Kunstrasen, 95.6 × 63.5 m) liegt ebenfalls rund 6 m über dem FVBJ Mass 90 × 57.6 m, also gleiche Auslaufbreite | der einzige Fussballplatz beim Flurnamen Arniacher (swisstopo, 95 m entfernt); die nächsten Plätze liegen 580 m (108 × 45 m) und 1 km weg |
| Adresse | Helisbühlstrasse 6a (swisstopo) bei 46.83212, 7.61709, 70 m vom Mittelpunkt | keine Adresse im FVBJ Text, Flurname und Platz genügen für die Lage |
| Mittelpunkt | 46.8321558, 7.6161992 | 46.9112538, 7.6317333 |
| Strassenendpunkt | Route endet bei 46.832562, 7.615532 auf der Thunstrasse (Kantonsstrasse), 68 m vom Mittelpunkt | Route endet bei 46.911278, 7.632258 auf dem Gwattbergweg (asphaltiert, ohne Zugangsbeschränkung), 40 m vom Mittelpunkt |
| Neue Route | `bus:46.94689,7.39373:46.83216,7.61620`, 29.3 km, 31 Minuten | `bus:46.94689,7.39373:46.91125,7.63173`, 22.3 km, 31 Minuten |

Es kamen nur diese zwei Routen in den Cache, bestehende Routen blieben unverändert.

## Geprüft, aber (noch) nicht übernommen

| Kandidat | Stand | Was fehlt |
|---|---|---|
| FC Goldstern, Waldruhe | Adresse Löhrwaldweg 9 (Bundesregister) und Platz way 26531887 (4950 m²) passen zum FVBJ Eintrag | Spielstätte der 1. Mannschaft (Clubseite nennt auch «Buvette Bremgarten»), öffentliche Zufahrt (Löhrwaldweg teils privat) |
| SC Aegerten Brügg, Moos | FVBJ: Hauptplatz 102 × 64 m, Moosweg 14 (swisstopo: 47.11648, 7.28313). Drei beleuchtete Rasenplätze in OSM: way 35960672 (97.3 × 62.8 m), way 35960673 (110.0 × 68.0 m, am nächsten zu Moosweg 14), way 35960674 (103.2 × 72.1 m) | Keiner passt: der erste ist kleiner als das FVBJ Mass, der zweite 8 m länger, der dritte 8 m breiter (Auslauf der Karte rund +3 bis +7 m). Die Karte stimmt hier nicht sicher mit der Anlage überein, ein Orthofoto Abgleich oder die Masse des Platzes 2 und 3 aus dem FVBJ Eintrag würden es klären |
| FC Steffisburg, Schönau | Schönau ist ein Neubau (Schul, Kultur und Sportanlage), der alte Platz ist Eichfeld | aktuelle Heimspielstätte |
