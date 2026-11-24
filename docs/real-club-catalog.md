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
| Bern | 0 | 0 fiktiv, 42 echt (Heimberg, Stettlen 08, Oberdiessbach, Grosshöchstetten-Schlosswil, Goldstern, Orpund Safnern, Ittigen ersetzt, siehe unten) | 0 |
| Zürich | 0 | 39 fiktiv, 3 echt (FC Oerlikon/Polizei ZH, FC Seefeld ZH, FC Wiedikon ZH) | 39 |
| Basel | 0 | 36 fiktiv, 6 echt (FC Amicitia Riehen, FC Pratteln, SC Dornach, FC Black Stars, SV Muttenz, FC Allschwil) | 36 |
| Genève | 0 | 37 fiktiv, 5 echt (Signal FC Bernex-Confignon, Meyrin FC, Lancy FC, FC Vernier, FC Veyrier Sports) | 37 |

**Gemeinsame Plätze (wirken in allen vier Welten, deshalb zuerst):** ~~`extra-4-fc-alpenfestung`~~ (ersetzt durch Yverdon Sport FC), ~~`extra-5-fc-gotthard-murmeltiere`~~ (ersetzt durch FC Wil 1900), ~~`extra-6-fc-l-man-mouettes`~~ (ersetzt durch FC Rapperswil-Jona), ~~`extra-7-fc-z-risee-b-tler`~~ (ersetzt durch FC Locarno). Ihre Spielorte sind geliehene geprüfte Plätze anderer Clubs der Liga.

**Nur Bern, Liga 8 bis 14:** ~~`extra-8-fc-r-stigraben-united`~~ (ersetzt durch FC Orpund Safnern), `extra-9-fc-seeland-hechte`, `extra-10-fc-emmental-k-sekicker`, `extra-11-fc-g-rbetal-kickers`, ~~`extra-11-fc-g-rbetal-kickers`~~ (ersetzt durch FC Stettlen 08), ~~`extra-12-fc-worblental-rangers`~~ (ersetzt durch FC Heimberg), ~~`extra-13-sc-marzili-bern`~~ (ersetzt durch FC Goldstern), ~~`extra-14-fc-aaref-chse-bern`~~ (ersetzt durch SC Ittigen).

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
| SC Aegerten Brügg, Moos | FVBJ: Hauptplatz 102 × 64 m, Moosweg 14 (swisstopo: 47.11648, 7.28313). Drei beleuchtete Rasenplätze in OSM: way 35960672 (97.3 × 62.8 m), way 35960673 (110.0 × 68.0 m, am nächsten zu Moosweg 14), way 35960674 (103.2 × 72.1 m) | Keiner passt: der erste ist kleiner als das FVBJ Mass, der zweite 8 m länger, der dritte 8 m breiter (Auslauf der Karte rund +3 bis +7 m). Die Karte stimmt hier nicht sicher mit der Anlage überein, ein Orthofoto Abgleich oder die Masse des Platzes 2 und 3 aus dem FVBJ Eintrag würden es klären |
| FC Steffisburg, Schönau | Schönau ist ein Neubau (Schul, Kultur und Sportanlage), der alte Platz ist Eichfeld | aktuelle Heimspielstätte |

## Phase 3: die ersten zwei gemeinsamen Plätze, in allen vier Welten (Yverdon Sport FC Liga 4, FC Wil 1900 Liga 5)

Ersetzen `extra-4-fc-alpenfestung` und `extra-5-fc-gotthard-murmeltiere` in Bern, Zürich, Basel und Genève zugleich (die gemeinsamen Plätze Liga 4 bis 7 gehören zu jedem Katalog). IDs bleiben, die alten Namen führen weiter zu ihrem früheren Platz. Beide Clubs spielen heute in der Challenge League; die Katalogstufe ist wie überall eine Näherung (Liga 4 enthält schon fünf Challenge League Clubs, Liga 5 Promotion League Clubs).

| | Yverdon Sport FC (Liga 4) | FC Wil 1900 (Liga 5) |
|---|---|---|
| Heimstadion laut Club | Stade Municipal, Rue des Pêcheurs 16, 1400 Yverdon-les-Bains, Parkplatz Patinoire (yverdonsport.ch/stade-municipal) | Lidl Arena im Sportpark Bergholz, Kunstrasenstadion, Heimstadion seit 2013/14, 6000 Plätze (fcwil.ch/wir/sportpark-bergholz) |
| Stadiongebäude (swisstopo) | «Stade municipal d'Yverdon-les-Bains» bei 46.78357, 6.64639; Rue des Pêcheurs 16 bei 46.78309, 6.64602 | «Lidl Arena» bei 47.45815, 9.03685 |
| OSM Stadionfeld | way 79701353: Rasen, beleuchtet, 105.6 × 67.9 m (Standardmass), 7131 m², Mittelpunkt 46.7833023, 6.6470583 | way 581466821: im Umriss way 398357405 «Lidl Arena», beleuchtet, 111.8 × 75.0 m (Standardmass plus Auslauf), 8257 m², Mittelpunkt 47.4585499, 9.0369799 |
| Gegenprobe | die anderen Plätze der Anlage haben kein Standardmass (96 × 62 m zweimal, 100 × 64 m, 95 × 87 m) und liegen östlich, 80 bis 270 m weiter | der Umriss way 398357405 (128.8 × 98.9 m) trägt den Namen, innerhalb liegt nur dieses Feld; die anderen Plätze der Anlage liegen 150 bis 400 m weg. OSM führt das Feld als «grass», der Club nennt Kunstrasen (Eintrag in OSM veraltet, Lage und Mass stimmen) |
| Strassenendpunkt | Rue des Pêcheurs (Wohnstrasse, öffentlich), 73 m vom Mittelpunkt | Parkplatz des Stadions (Servicestrasse parking_aisle, ohne Zugangsbeschränkung), erreicht über die öffentliche Bergholzstrasse, 80 m vom Mittelpunkt |
| Neue Routen | Bern bis Stade Municipal: 71.1 km, 54 Minuten | Bern bis Lidl Arena: 179.9 km, 129 Minuten; Winterthur bis Lidl Arena: 32.9 km (bestehender Zürcher Stützpunkt) |

Es kamen nur diese drei Routen neu in den Cache, bestehende Routen blieben unverändert. Die Matchcenter Seite des FVBJ ist für Super und Challenge League nicht zuständig (SFL Clubs).

## Phase 4: FC Goldstern (Bern, Liga 13)

Ersetzt `extra-13-sc-marzili-bern` (SC Marzili Bern). **Die ID bleibt**, der alte Name führt weiter zu seinem früheren Spielort (`REPLACED_CLUB_GROUNDS`). Liga 13 («Berner Stadtliga», bis 5 km) passt zur Entfernung: Bremgarten bei Bern liegt 4.5 km vom Heimstadion.

**Korrektur gegenüber dem früheren Stand:** Die erste Mannschaft (2. Liga regional) spielt ihre Ligaspiele auf dem Hauptplatz der **Sportanlage Bremgarten bB**, nicht am Clubhaus Waldruhe (FVBJ Ligaspiel vom 5.9. und 24.10.2026). Die Adresse Löhrwaldweg 9 und das Feld way 26531887 bei Uettligen gehören nur zum Clubhaus.

| Angabe | Beleg |
|---|---|
| FVBJ Anlage: Kalchackerstrasse, 3047 Bremgarten, genau ein Kunstrasenfeld 90,2 × 57,7 m | FVBJ Anlageneintrag (von Work abgerufen, Matchcenter blockiert automatische Zugriffe) |
| Platz: OSM way 72707053, Kunstrasen, 6074 m², kleinstes Rechteck 96.1 × 63.6 m | passt auf 90,2 × 57,7 m plus rund 5,9 m Auslauf je Richtung (gleiche Auslaufbreite wie in Leimen und Arniacher); der einzige Kunstrasenplatz der Anlage, die anderen Felder sind kleiner (45 × 43, 45 × 41, 24 × 16 m) |
| Mittelpunkt 46.9767239, 7.4337845 | Schwerpunkt des OSM Polygons, liegt innerhalb |
| Strasse | Kalchackerstrasse (Tertiärstrasse) 136 m vom Mittelpunkt, Johanniterstrasse (Wohnstrasse, öffentlich) 68 m |
| Parkplatz | Die Gemeinde bestätigt öffentliche Parkplätze bei den Sportanlagen (Parkierungsverordnung vom 1.9.2025, Art. 1). In OSM: Strassenparkplätze ohne Gebühr 64 und 89 m, öffentlicher Parkplatz mit 28 Plätzen 114 m vom Mittelpunkt |
| Strassenendpunkt | Route Bern bis Sportanlage: 8,1 km, 12 Minuten, endet bei 46.977333, 7.433776 auf der Johanniterstrasse, 68 m vom Mittelpunkt (die letzten Meter sind geschätzt) |

Nur diese eine Route kam neu in den Cache, bestehende Routen blieben unverändert.

## Phase 5: FC Rapperswil-Jona (Liga 6, alle vier Welten)

Ersetzt `extra-6-fc-l-man-mouettes` (FC Léman Mouettes) in Bern, Zürich, Basel und Genève zugleich. **Die ID bleibt**, der alte Name führt weiter zu seinem früheren Platz. Der Club spielt in der Promotion League; Liga 6 enthält Promotion League und 1. Liga Clubs (Näherung wie überall).

**Welches Feld ist das Hauptspielfeld?** OFV Anlageneintrag: Hauptplatz 105 × 68 m. Die Gemeinde nennt ein «Hauptspielfeld mit Zuschauertribüne (800 Plätze), Garderobentrakt und Clubraum (FC Rapperswil-Jona)». Der Übersichtsplan der Gemeinde (Sportanlagen Grünfeld, Juli 2024) ist mit Norden **unten** gezeichnet: Tennisplätze und Tennishalle liegen im Plan links unten, in OSM nordöstlich; die Sporthalle und die Grünfeldstrasse liegen im Plan unten, in OSM nördlich der Felder; das Kunstrasenfeld 3 (G11) liegt im Plan oben, in OSM der einzige Kunstrasenplatz im Südwesten. Mit dieser Drehung um 180 Grad ist «Fussballfeld 1» (G1) neben «Fussballstadion, Garderoben» das Feld unmittelbar an der in OSM kartierten Tribüne (way 220366252, 7 m Abstand).

| | Beleg |
|---|---|
| Feld | OSM way 203508979: Rasen, beleuchtet, 115.6 × 76.1 m (105 × 68 m plus Auslauf der Stadionanlage, 5 m je Seite), 8730 m², Mittelpunkt 47.2205209, 8.8415371 |
| Nachbarfeld | way 203509029 (G2, 102.4 × 70.6 m) liegt ebenfalls 6 m neben der Tribüne, ist aber kürzer als das 105 m lange Hauptfeld und scheidet damit aus; way 195667482 (106.1 × 70.0 m) liegt 88 m von der Tribüne entfernt und ist nach Plan nicht das Stadionfeld |
| Gebäude | swisstopo «Stadion Grünfeld» bei 47.22098, 8.84158 (die Tribüne), Anschrift laut Club Grünfeldstrasse 3, laut Gemeinde Grünfeldstrasse 8, 8645 Jona |
| Zufahrt laut Club | Keine direkte Zufahrt über die Blumenaustrasse; der Zugang erfolgt vom Parkplatz an der Grünfeldstrasse über den Fussweg vor der Grünfeld-Halle zum Stadion (fcrj.ch/pages/stadionordnung und /verkehrsanbindung); Zufahrt über die Blaubrunnenstrasse nur mit Bewilligung |
| Strassenendpunkt | Die Standardroute (OSRM, nächste Strasse) würde auf der Blaubrunnenstrasse 47 m südlich des Feldes enden, in OSM `motor_vehicle=agricultural`. Deshalb endet die Route am gebührenpflichtigen öffentlichen Parkplatz an der Grünfeldstrasse (OSM way 26458013, Parkierungsweg bei 47.22211, 8.844756), erreicht über die Grünfeldstrasse (öffentlich), und läuft von dort zum Feld. Der Parkplatz liegt 190 m vom Feld. |
| Neue Routen | Bern bis Stadion Grünfeld: 167.5 km, 122 Minuten; Zürich bis Stadion Grünfeld: 42.5 km, 36 Minuten (der bestehende Zürcher Stützpunkt) |

Die Routen wurden mit dem Parkplatz als Routenziel erzeugt, der letzte Punkt der Strecke bleibt das Feld. Dieselbe Regel steht jetzt in `scripts/travel/fetch-real-routes.mts` (`routeTarget`): ohne sie würde eine Neuerzeugung die Blaubrunnenstrasse wählen.

## Phase 6: FC Locarno (Liga 7, alle vier Welten), die letzte gemeinsame Stelle

Ersetzt `extra-7-fc-z-risee-b-tler` (FC Zürisee Böötler) in Bern, Zürich, Basel und Genève zugleich. **Die ID bleibt**, der alte Name führt weiter zu seinem früheren Platz. Damit sind alle vier gemeinsamen Plätze (Liga 4 bis 7) echt.

| Angabe | Beleg |
|---|---|
| Heimstadion, Hauptfeld 105 × 68 m | Club (fclocarno.ch/societa/stadio) und regionale Tourismusstelle; Tessiner Verband (FTC): Via Respini, «Terreno principale» |
| Stadion in OSM | way 486867520 «Stadio Lido» (`leisure=stadium`, mit Laufbahn, 195 × 114 m, geprüft 15.5.2026) |
| Feld innerhalb der Laufbahn | way 278977348: alle vier Ecken liegen im Stadionumriss, einziges Fussballfeld darin; Mittelpunkt 46.1626832, 8.8015333, 6397 m² |
| Trainingsfelder ausserhalb | way 278977344 (100.1 × 62.5 m) und way 486872270 (76.2 × 68.4 m): keine Ecke im Stadionumriss |
| Grösse | die Karte zeichnet das Feld 99.9 × 64.4 m, also 5 m kürzer als die offiziellen 105 × 68 m (wohl enger gezeichnet). Es dient nur der Lage; der Mittelpunkt des Feldes ist davon kaum betroffen |
| Gebäude | swisstopo «Stadio del Lido, Locarno» bei 46.16316, 8.80154, 53 m vom Mittelpunkt |
| Strassenendpunkt | Route endet bei 46.162161, 8.801525 auf der Via della Posta, an der Kreuzung mit Viale al Lido und Viale Gioacchino Respini (öffentliche Wohnstrassen ohne Einschränkung, 58 m vom Mittelpunkt). Öffentliche gebührenpflichtige Strassenparkplätze am Viale Respini (OSM way 1390613598 und 1390613601) 114 und 150 m |
| Neue Routen | Bern bis Stadio del Lido: 275.9 km, 209 Minuten; Lugano bis Stadio del Lido: 38.6 km, 39 Minuten (bestehender Tessiner Stützpunkt) |

Die Stelle von Schaffhausen (Stadion Breite, zwei verschachtelte Umrisse) bleibt offen und hat keinen freien gemeinsamen Platz mehr; sie käme nur als Austausch eines echten Clubs in Frage.

## Phase 7: SC Ittigen (Liga 14) und FC Orpund Safnern (Liga 8), die letzten zwei Berner Plätze

Damit hat die **Berner Welt ausserhalb von Liga 15 keinen fiktiven Club mehr**. Beide Clubs ersetzen die fiktiven Plätze `extra-14-fc-aaref-chse-bern` (FC Aarefüchse Bern) und `extra-8-fc-r-stigraben-united` (FC Röstigraben United) und behalten deren IDs; die alten Namen führen weiter zu ihrem früheren Platz. Die Liga ergibt sich aus der Entfernung: Worblaufen liegt 5.9 km vom Heimstadion (Liga 14 «Berner Quartier», Clubs bis rund 6 km), Orpund 22 km (Liga 8 «Nachbarkantone», die fernste der Berner Regionalligen). Beide Clubs spielen in der 3. Liga, die Katalogstufe ist wie überall eine Näherung.

| | SC Ittigen (Liga 14) | FC Orpund Safnern (Liga 8) |
|---|---|---|
| Heimspiele der Herren laut Club | scittigen.ch/infrastruktur: «Hubelgut: Hier trägt der SC-Ittigen die Heimspiele in den Meisterschaften aus», Herren 1. Mannschaft 3. Liga | fcorpundsafnern.ch: Fussballplatz «an der Aare in Orpund», 3. Liga Herren, Garderobeneinteilung Orpund (Heimspiele 2027 gelistet); Name seit der Fusion «FC Orpund Safnern» |
| FVBJ Hauptplatz | 96 × 62 m | 99 × 60 m (Anlage «Aare») |
| OSM Hauptplatz | way 26463168: Rasen, 101.8 × 63.9 m, 6398 m², Mittelpunkt 46.9786904, 7.4563938; der einzige Vollfeld Platz, daneben nur ein kleiner Tartanplatz | way 228514411 mit der Beschreibung «Aare Hauptplatz FC Orpund»: 99.7 × 63.5 m, 6264 m², Mittelpunkt 47.1367418, 7.310109; way 228514412 «Aare Nebenplatz FC Orpund» ist das Trainingsfeld, 60 m südlich |
| Adresse | Hubelgutstrasse 1, 3048 Worblaufen (swisstopo) bei 46.9799, 7.45598 | Sportanlage Aare, 2552 Orpund |
| Strassenendpunkt | Tiefenaustrasse (Hauptstrasse, öffentlich) bei 46.97871, 7.457047, 50 m vom Mittelpunkt | Byfangstrasse (Wohnstrasse, öffentlich) und Servicestrasse am Platz, bei 47.137119, 7.310013, 43 m vom Mittelpunkt |
| Neue Route | Bern bis Hubelgut: 7.4 km, 11 Minuten | Bern bis Aare: 45.9 km, 39 Minuten |

Der FVBJ Anlageneintrag und die Spielansetzung (Matchcenter) sind für automatische Zugriffe gesperrt; Masse und aktuelle Teamspiele stammen aus den Notion Notizen, die Heimspielorte zusätzlich aus den Seiten der Clubs.

**Folge für den Start:** In `defaultAiLeagues` spielt der sechste Club der eigenen Liga in der untersten Liga. Wer in Liga 8 oder Liga 14 startet, trifft in Liga 15 jetzt einen echten Club statt einen erfundenen; die Regel erlaubt das ausdrücklich.

## Phase 3, weiter geprüft und nicht übernommen

| Kandidat | Was fehlt |
|---|---|
| FC Steffisburg, Schönau | FVBJ: aktuelle Spiele auf dem Hauptplatz Schönau, Anlage Schönauweg 46 (3612 Steffisburg, Schulhaus Schönau), Hauptplatz 100 × 64 m. In OpenStreetMap ist dort **kein Fussballfeld** kartiert: die Anlage ist neu. Das nächste Grasfeld (way 334213888, 110 × 81 m, `sport=multi`, bearbeitet am 3.11.2025) liegt 285 m von der Adresse entfernt und passt nicht zu 100 × 64 m (+10/+17 m). Ohne Feldpolygon bleibt der Mittelpunkt offen (kein provisorischer Punkt). Der Parkplatz beim Schulhaus ist in OSM kartiert (way 124614207, 10 m von der Adresse) |
| FC Schaffhausen, Stadion Breite | Zwei verschachtelte OSM Umrisse mit demselben Namen (111.0 × 76.5 m und 107.7 × 73.9 m), kein Mass des Clubs, das den Feldumriss bestimmt |

## Phase 6: erste regionale Plätze ausserhalb Berns (Zürich, Basel, Genève)

Je ein fiktiver Platz pro Welt wird echt. Die Slot ID (`zh-3-6`, `bs-7-1`, `ge-2-1`) bleibt. Die Liga folgt wie bei allen regionalen Plätzen dem Distanzprofil des Slots (`docs/home-cities-data.md`), nicht der echten Spielklasse. Die Namen der übrigen fiktiven Clubs bleiben gleich: der ersetzte Platz verbraucht seinen fiktiven Namen weiter (`legacy` in `app/home-cities.ts`), der alte Name führt über `venueForClubName` zum alten Platz.

**Étoile Carouge ist ausgenommen.** `docs/home-cities-data.md` schliesst den Profiklub aus den Genfer Regionalligen aus. Stattdessen gilt Lancy FC (1. Liga Classic).

**Duplikate:** Keiner der drei Namen steht in einer der vier Welten oder in `app/swiss-clubs.json`. Lancy FC ist nicht Servette (dessen Stade de Genève liegt auf Lancyer Gemeindegebiet, ist aber ein anderer Platz).

| Club | Welt, Liga | Platz | Beleg Feld | Strassenende (OSM) |
|---|---|---|---|---|
| FC Seefeld ZH | Zürich, Liga 13 (`zh-3-6`) | Sportanlage Lengg, R1, OSM way 40808587, Mittelpunkt 47.34924, 8.57108 | Sportamt Zürich: R1 Naturrasen 100 × 64 m, 1. Liga tauglich, Betrieb FC Seefeld, «Keine Parkplätze vorhanden». Kartiert 110 × 71 m (Feld plus Auslauf), 7739 m². FVRZ Heimspiel der ersten Mannschaft auf Lengg R1 | Auf der Anlage gibt es keine Parkplätze, deshalb endet die Route auf der Bleulerstrasse (OSM way 652006889, `residential`, öffentlich) bei 47.348989, 8.570622, 50 m vom Feld. Route 8,4 km, 15 Minuten |
| FC Black Stars | Basel, Liga 9 (`bs-7-1`) | Sportplatz Buschweilerhof, OSM way 39976253, Mittelpunkt 47.55941, 7.5625 (derselbe Platz, den der alte fiktive Club schon hatte) | Heimspiel 105653 gegen SC Buochs am 15.11.2026 auf Platz A (FVNWS); Vereinsseite blackstars.ch nennt Restaurant Buschweilerhof und Platzwart. Nachtrag aus dem Notion Hinweis vom 23.11.: Platz A ist laut FVNWS Kunstrasen 100 × 64 m, das Nebenfeld B nur 42 × 34 m ([FVNWS Anlage](https://matchcenter.fvnws.ch/default.aspx?a=sa&lng=1&oid=8&sa=583104&v=409)). Das kartierte Feld way 39976253 (107 × 71 m, in OSM noch mit `surface=grass`) ist das einzige Vollfeld der Anlage und passt mit 7 m Auslauf zu 100 × 64 m; der Trainingsplatz way 147639501 (46 × 30 m) entspricht Feld B und scheidet aus. Der OSM Belag ist veraltet, die Lage ist eindeutig | Nidwaldnerstrasse (OSM way 24511727, `residential`, 30 km/h) bei 47.559355, 7.563063, 49 m vom Feld. Route 7,9 km, 11 Minuten |
| Lancy FC | Genève, Liga 14 (`ge-2-1`) | Stade de Marignac, Terrain 1, OSM way 49722965, Mittelpunkt 46.179, 6.12285 | Erste Mannschaft (1. Liga Classic) am 12.09. und 26.09. auf Terrain 1 (Naturrasen); Naturrasen 100 × 64 m laut Erste Liga ([Verband](https://dev-matchcenter.el-pl.ch/default.aspx?a=sa&lng=1&oid=3&sa=599502&v=1047707)), Anschrift Chemin des Rambossons 27 von der [Stadt Lancy](https://www.lancy.ch/annuaire/stade-de-marignac) bestätigt (ACGF Seite sperrt Automaten, nicht umgangen). Kartiert 100 × 64 m, 6439 m², einziges Vollfeld der Anlage | Chemin des Rambossons (OSM way 27951875, `residential`, 30 km/h) bei 46.17769, 6.123535, 158 m vom Feld. Die letzten 86 m bis zum Stadion sind ein Servicezugang ohne Zugangsangabe in OSM, deshalb endet die Route vorher auf der öffentlichen Strasse. Route 4,3 km, 7 Minuten |

**Quellen:** Seefeld [Sportamt Zürich](https://www.stadt-zuerich.ch/de/stadtleben/sport-und-erholung/sport-und-badeanlagen/rasensportanlagen/lengg.html) und [FVRZ](https://matchcenter.fvrz.ch/default.aspx?lng=1&oid=11&tg=4314168&v=1590) (eine eigene Vereinsseite war nicht erreichbar); Black Stars [blackstars.ch](https://www.blackstars.ch/), [FVNWS](https://matchcenter.fvnws.ch/default.aspx?lng=1&oid=8&tg=4315770&v=409), [Kanton Basel-Stadt](https://www.bs.ch/medienmitteilungen/bvd/2004-sportplatz-buschweilerhof-saniert); Lancy FC [Verbandsmatch 105351](https://matchcenter-acvf.football.ch/default.aspx?lng=2&ls=25795&oid=16&sg=70237&t=66170&tg=4315468&v=1364768) und [105366](https://matchcenter-acvf.football.ch/Default.aspx?ln=&lng=2&oid=16&tg=4315483&v=777823).

**Routen:** Je eine neue Strassenroute vom Heimplatz der Stadt (nur diese drei Einträge im Cache, `app/route-cache/part-10.json`). Alle anderen Routen blieben unverändert.

**Tests:** `tests/real-club-catalog.test.ts` (Backlog Zürich 13: 5, Basel 9: 5, Genève 14: 5; Namen, Alias, Eindeutigkeit, Feldpolygon mit Grösse, Strassenende, Reise), `tests/home-cities.test.ts` (Quellenregel: eigene Vereinsseite oder offizielle Seite, die den Heimplatz nennt).

**Offen:** Verbandsseiten sperren Automaten; die Platzgrössen von Black Stars und Lancy FC stammen aus den Notion Hinweisen (FVNWS, Erste Liga), nicht aus einem von hier abgerufenen Verzeichnis. Alle drei Plätze sind durch die jeweils einzige passende Vollfeldfläche der Anlage eindeutig. Echtes iPhone, iPad und Safari wurden nicht geprüft.

## Phase 7: SV Muttenz, CS Chênois, FC Altstetten (nichts übernommen)

Geprüft nach dem Notion Hinweis vom 23.11. auf Stand `8bea2d7`. Keiner der drei ist eindeutig genug, es gab deshalb keine Katalogänderung. Der Stand der Plätze bleibt: Zürich 40, Basel 38, Genève 39 fiktive Regionalplätze.

| Club | Ergebnis | Grund |
|---|---|---|
| CS Chênois | **Übersprungen, schon vertreten** | Steht als echter Club `cs-chenois` (Stade des Trois-Chêne, Liga 6) in `app/swiss-clubs.json` und damit in allen vier Welten. Ein zweiter Eintrag in der Genfer Regionalliga wäre ein Doppelgänger. Das fiktive Genfer Feld «Stade des Trois-Chêne» wurde schon vom Lancy FC Slot abgelöst |
| SV Muttenz | **Nachträglich übernommen** (siehe unten) | Der fehlende amtliche Beleg kam später (FVNWS und Erste Liga) |
| FC Altstetten | **Zurückgestellt, Feld nicht eindeutig** | Das Sportzentrum Buchlern hat laut [Sportamt Zürich](https://www.stadt-zuerich.ch/de/stadtleben/sport-und-erholung/sport-und-badeanlagen/rasensportanlagen/buchlern.html) elf Plätze, darunter mehrere Naturrasen der Grössen 100 × 64 m (R4, R10), 104 × 66 m (R9, 1. Liga) und 100 × 59 m (R8). Die Platznummer des Heimspiels 164081 ist vor Ort variabel, ohne Zusatzbeleg lässt sich kein Feldpolygon zuordnen. Öffentliche Parkplätze (kostenpflichtig) sind vorhanden |

**Was zur Freigabe fehlt:** Altstetten: die Platznummer des Heimspiels (Verband oder Vereinsseite).

## CS Chênois: Platz und Anreise nachgeführt (Liga 6, alle vier Welten)

Der Club war schon vertreten, sein Platz aber nur die Gemeindemitte von Chêne-Bourg (Näherung, die Prüfung in `app/stadium-audit.json` war mit HTTP 509 gescheitert). Nach dem amtlichen ACGF Eintrag ([Stade des Trois-Chêne](https://dev-matchcenter.acgf.ch/Default.aspx?a=sa&lng=2&oid=14&sa=628516&v=829)): Hauptfeld A Naturrasen 105 × 68 m, Route de Sous-Moulin 22, direkte Zufahrt wegen Bauarbeiten gesperrt, empfohlen wird der P+R Sous-Moulin.

| | Beleg |
|---|---|
| Feld | OSM way 132470618, 114 × 75 m (105 × 68 m plus Auslauf), 8562 m², Mittelpunkt 46.191811, 6.190674. Die anderen Felder der Anlage sind kürzer (way 132470606: 99 × 66 m, way 132470670: 106 × 65 m, schmaler als 68 m) |
| Anschrift | swisstopo Route de Sous-Moulin 22 bei 46.19226, 6.19159, 86 m vom Feld; Gebäude «Stade des Trois-Chêne» 40 m vom Feld |
| Anreise | Route endet am öffentlichen P+R Sous-Moulin (OSM way 35514353, `access=yes`, mehrstöckig), konkret auf der Route Blanche (`primary`) am Eingang, 9 m von der Strasse, ca. 220 m vom Feld. Bern bis Stade: 156,3 km, 113 Minuten; letzte Strecke ab Genève Cornavin 5,6 km, 10 Minuten |

Nur zwei neue Routeneinträge, die alten Routen zur früheren Gemeindemitte bleiben ungenutzt im Cache. ID `cs-chenois`, Name und Liga sind unverändert. Wichtig für Muttenz und Altstetten: Eine Freigabe verlangt den genauen Spielfeldnachweis; die Stadt Zürich nennt auf Buchlern mehrere für die 1. und 2. Liga taugliche Felder.

## SV Muttenz (Basel, Liga 9, `bs-7-2`)

Der amtliche Beleg ist da: FVNWS ([Anlage](https://matchcenter.fvnws.ch/Default.aspx?a=sa&lng=1&oid=8&sa=610216&v=498)) und Erste Liga ([Anlage](https://matchcenter.el-pl.ch/default.aspx?a=sa&lng=1&oid=3&sa=610216&v=498)) nennen Feld 1 als Hauptplatz, Naturrasen 100 × 64 m, Sandgrubenweg 10, 1. Liga. Dazu das Heimspiel 105642 (07.11.) und der Parkplatz auf [svmuttenz.ch](https://www.svmuttenz.ch/kontakt_und_situationsplan). Duplikat: «SV Muttenz» kommt in keiner Welt vor. Der Slot `bs-7-2` (Distanzprofil, 3,87 km vom Basler Heimpunkt) verliert den fiktiven «Real Homburg» (Name und Platz Sportplatz Au bleiben als Alias erreichbar).

| | Beleg |
|---|---|
| Feld | OSM way 946997664, Rasen, 101 × 65 m (100 × 64 m plus 1 m), 6477 m², Mittelpunkt 47.53013, 7.63209. Andere Felder der Anlage passen nicht: way 450070177 (96 × 68 m), way 59609073 (109 × 70 m, grösser) und der Kunstrasen way 113617204 (97 × 60 m) |
| Anschrift | swisstopo Sandgrubenweg 10 bei 47.530617, 7.632445, 60 m vom Feld |
| Parkplatz | OSM way 216256986 «Sportanlage Margelacker», `access=yes`, `fee=no`, höchstens 3 Stunden (passt zur Angabe des Clubs). Die Route endet im Parkplatz bei 47.529627, 7.631809 (60 m vom Feld) nach der Münchensteinerstrasse (`secondary`). Route 6,5 km, 8 Minuten |

Quelle im Katalog: svmuttenz.ch (Parkplatzangabe) und die FVNWS Anlage. Eine neue Route im Cache, die übrigen blieben unverändert.

## FC Wiedikon ZH (Zürich, Liga 13, `zh-3-3`)

FVRZ Heimspiele der ersten Mannschaft 163483 und 163522 auf Heuried. Die [Stadt Zürich](https://www.stadt-zuerich.ch/de/stadtleben/sport-und-erholung/sport-und-badeanlagen/rasensportanlagen/heuried.html) führt dort genau einen Platz: KR1 Kunstrasen 100 × 64 m, beleuchtet, 2. Liga tauglich, öffentliche Parkplätze (kostenpflichtig). Duplikat: «FC Wiedikon ZH» kommt in keiner Welt vor. Der Slot `zh-3-3` (Distanzprofil, 5,95 km vom Zürcher Heimpunkt) verliert den fiktiven «SV Hönggerberg Igel» (Sportanlage Letzi), der Name bleibt als Alias erreichbar.

| | Beleg |
|---|---|
| Feld | OSM way 34945595, Kunstrasen, 109 × 70 m (100 × 64 m plus Auslauf), 7641 m², Mittelpunkt 47.36655, 8.50341; in OSM mit `alt_name=KR1` und Betreiber Sportamt Zürich getaggt. Andere Felder im Umkreis sind kleiner (way 34945596: 51 × 47 m, way 32857644: 64 × 54 m) |
| Parkplatz | OSM way 505081213, `access=yes`, `fee=yes`, 214 m vom Feld (die Stadt nennt kostenpflichtige öffentliche Parkplätze). Die Route endet im Parkplatz bei 47.365132, 8.501444, erreicht über die Paul-Clairmont-Strasse (`residential`, 30 km/h, `motor_vehicle=destination`: nur Zufahrt zum Ziel, was die Anreise zur Anlage ist) und eine Zufahrt ohne Einschränkung. Route 7,7 km, 13 Minuten |

Eine neue Route im Cache, alle anderen unverändert. Der Club hat keine erreichbare eigene Seite; Quelle im Katalog ist die Seite der Stadt, die Spielnummern stammen aus dem Notion Hinweis (FVRZ). FC Altstetten bleibt zurückgestellt, bis die genaue Platznummer des ersten Teams belegt ist.

## FC Allschwil (Basel, Liga 14, `bs-2-1`)

FVNWS belegt die Meisterschaftsspiele 110808 und 110795 der ersten Mannschaft auf Im Brüel, Feld 1; das [Anlagenverzeichnis](https://matchcenter.fvnws.ch/default.aspx?a=sa&lng=1&oid=8&sa=696821&v=483) führt das Hauptfeld als Naturrasen 105 × 68 m, die kleinere Kunstrasenfläche 2 getrennt. Die Vereinsseite [fcallschwil.ch](https://www.fcallschwil.ch/) nennt die «Sportanlage im Brüel». Der frühere Hinweis in `docs/home-cities-data.md` (Hauspunkt Hegenheimermattweg 132 beim Restaurant, kein Feld bestätigt) ist damit überholt. Duplikat: «FC Allschwil» kommt in keiner Welt vor. Der Slot `bs-2-1` (nächstes Distanzprofil, 6,11 km vom Basler Heimpunkt) verliert den fiktiven «Sporting Dreiländereck» (Sportplatz am Rhein), der Name bleibt als Alias erreichbar.

| | Beleg |
|---|---|
| Feld | OSM way 503051595, Rasen, beleuchtet, 6747 m², kartiert 104 × 67 m, Mittelpunkt 47.55652, 7.54764. Das ist 1 m weniger als das offizielle Mass (die Karte enthält keinen Auslauf). Die anderen Rasenfelder der Anlage passen nicht: 102 × 69 m (way 503051598, zu kurz), 106 × 61 m (way 503051599, zu schmal), 96 × 63 m (way 503051596, kleiner; wohl die Fläche 2). Eindeutig ist die Zuordnung nur über diese Masse, nicht über eine Platzbezeichnung in OSM |
| Anreise | Die Route endet auf dem Grabenmattweg (OSM way 30080971, `residential`, `access=permissive`, `motor_vehicle=destination`: Zufahrt zum Ziel), 72 m vom Feld, bei 47.555876, 7.54751. Route 8,1 km, 13 Minuten. Der Parkplatz am Hegenheimermattweg (way 503051581, `access=yes`, `fee=no`) liegt 324 m vom Feld und wurde nicht gewählt |

Eine neue Route im Cache, die anderen blieben unverändert.

## FC Vernier (Genève, Liga 11, `ge-5-3`)

ACGF belegt die erste Mannschaft in den Spielen 108678 und 108691 auf Hauptfeld A, Kunstrasen 100 × 64 m, Avenue Louis-Pictet 17 ([Spiel](https://matchcenter.acgf.ch/default.aspx?lng=2&oid=14&tg=4319042&v=886), [Anlage](https://matchcenter.acgf.ch/Default.aspx?a=sa&lng=2&oid=14&sa=599480&v=512919)). Der frühere Stand («zurückgestellt», `cfa40ac`) fand im Centre sportif zwei fast gleich grosse Vollfelder (106 × 70 und 106 × 71 m) und verwarf das 125 × 71 m Polygon. Das war falsch gewichtet: der Projektingenieur der Stadt, [SABERT SA, Dossier 3371](https://www.sabert.ch/wp-content/uploads/2023/08/3371-Vernier-Transformation-Terrain-A-site-ok.pdf) (Bauherrin Ville de Vernier, Projekt 2017), nennt für das Terrain A «gazon synthétique (100 × 64 m) sur un terrain en gazon naturel» und «une aire d'entraînement (25 × 64 m)». Das Terrain A ist also **ein** zusammenhängendes Kunstrasenfeld von rund 125 m Länge: Spielfläche plus Trainingsfläche.

| | Beleg |
|---|---|
| Polygon | OSM way 87345848, 125,2 × 70,5 m (aus Orthophotos 2011 kartiert, also noch das frühere Naturrasenfeld), die einzige Fläche der Anlage dieser Länge. Die 106 × 70 und 106 × 71 m grossen Felder daneben sind andere Plätze |
| Orthofoto | swisstopo swissimage (aktuell), Zoom 19 und 20, mit dem OSM Polygon überlagert: auf einem durchgehenden Kunstrasen liegt am südlichen Ende das aufgemalte Spielfeld mit Mittelkreis und Strafraum, am anderen Ende folgen die kleineren Tore und der Strafraum der Trainingsfläche. Die Aufteilung entspricht 100 m plus 25 m |
| Marker | Mittelpunkt des Mittelkreises, 46.21964, 6.08251. Er liegt 55 m von der südlichen und 70 m von der nördlichen Kante des Polygons; das 100 × 64 m Spielfeld um ihn liegt vollständig im Polygon, hinter ihm bleiben rund 20 m Trainingsfläche (25 m minus Auslauf). Der alte Marker (Mittelpunkt des ganzen Sportzentrums) lag 70 m daneben |
| Anschrift | swisstopo Avenue Louis-Pictet 17 bei 46.21907, 6.08513, 79 m vom Marker |
| Anreise | Die Strasse zur Adresse führt über Servicewege ohne öffentliche Angabe, deshalb endet die Route auf dem Chemin de Morglas (OSM way 27461834, `unclassified`, 50 km/h, keine Zugangsbeschränkung) bei 46.220044, 6.081715, 76 m vom Marker. Route 9,3 km, 16 Minuten |

Der Slot `ge-5-3` (7,17 km vom Genfer Heimpunkt) verliert den fiktiven «FC Jura Vaudois»; er stand schon im selben Sportzentrum (alter Marker 70 m entfernt), der Name bleibt als Alias erreichbar. Duplikat: «FC Vernier» fehlt in allen Welten. Eine neue Route im Cache.

## FC Veyrier Sports (Genève, Liga 14, `ge-2-2`)

ACGF belegt die erste Mannschaft in den Spielen 108625 und 108681 auf Veyrier-Village, Feld A; das einzige Feld der Anlage ist ein Naturrasen von 100 × 64 m am Chemin des Rasses (Angaben aus dem Notion Beleg, die ACGF Seiten selbst sind von hier nicht abrufbar). Duplikat: «FC Veyrier Sports» kommt in keiner Welt vor.

| | Beleg |
|---|---|
| Feld | OSM way 133087559, 100 × 65 m (6478 m²), Mittelpunkt 46.16663, 6.17965, innerhalb des Sportzentrums way 38346111 (105 × 70 m). Es ist das einzige Spielfeld der Anlage; das 1 m breitere Mass ist die Karte, nicht ein zweites Feld |
| Widerspruch | Ein Verzeichnis eines Dritten (sporteden.com) nennt für Veyrier Sports das Stade du Grand-Donzel (Chemin des Sylvains 20, Vessy), das rund 1,1 km entfernt zwei grössere Felder hat (114 × 74 und 106 × 70 m). Die Verbandsangabe (ACGF, Spielort Veyrier-Village, 100 × 64 m am Chemin des Rasses) passt zur Grösse des Rasses Feldes und hat Vorrang; das Verzeichnis wird nicht verwendet |
| Anreise | Die Route endet auf dem Chemin des Rasses (OSM way 26300046, `residential`, 30 km/h, keine Zugangsbeschränkung) bei 46.166198, 6.179552, 55 m vom Feld. Route 4,3 km, 8 Minuten. P+R de l'Uche (`access=yes`) liegt 260 m weiter nordöstlich |

Der Slot `ge-2-2` (2,36 km, nächstes Distanzprofil) verliert den fiktiven «FC Plainpalais Puces» (Centre sportif de Sous-Moulin); der Name bleibt als Alias erreichbar. Quelle im Katalog ist das ACGF Matchcenter (ohne Einzellink, die Spielnummern stehen im Zitat). Eine neue Route im Cache.

## SC Binningen (Basel): zurückgestellt, Feld nicht eindeutig

Notion Beleg: Heimspiel 142866 und das Spiel gegen Zwingen auf Spiegelfeld, Feld 1. Duplikat: «SC Binningen» und Spiegelfeld kommen in keiner Welt und nicht in `app/swiss-clubs.json` vor. Die Anlage liegt bei Im Spiegelfeld 1 (swisstopo 47.53609, 7.57088), die Gemeinde Binningen nennt in der [Vorlage zum Kunststoffrasen](https://www.binningen.ch/public/upload/assets/6939/119_Investitionskredit%20Kunststoffrasen%20Spiegelfeld.pdf?fp=1) **zwei** Fussballfelder, ein Naturrasenfeld und ein Kunstrasenfeld (erstellt 2005, Teppich 2020er Jahre ersetzt). Die Gemeinde führt keine Platznummern.

| Befund | Wert |
|---|---|
| OSM | nur ein Polygon `way 435937555`, 142 × 104 m, `sport=soccer`, ohne Belag, das beide Felder und den Auslauf zusammenfasst; daneben nur ein 60 × 25 m Kleinfeld (`way 422856415`). Es gibt kein Polygon pro Feld |
| swissimage (aktuell, Zoom 19) | Das Naturrasenfeld liegt im Rund der Laufbahn mit Tribünenseite, das Kunstrasenfeld unmittelbar südlich davon mit Linien mehrerer Felder. Welches davon Feld 1 ist, zeigt das Bild nicht |
| Grösse | Ein offizielles Mass für ein Feld fehlt (ältere Gemeindeunterlage 2003: zwei Rasenfelder zu je rund 100 × 70 m, nicht auf die Felder zugeordnet) |

**Fehlender Unterscheider:** das FVNWS Anlagenverzeichnis (Spiegelfeld, Feld 1: Belag und Grösse, Platznummer 1 oder 2) oder ein Plan der Gemeinde mit Platznummern. Mit dem Belag lässt sich Feld 1 dem Naturrasen im Laufbahnrund oder dem Kunstrasen im Süden zuordnen; danach sind der Feldmittelpunkt aus dem Orthofoto (wie bei FC Vernier) und die Strassenanfahrt (Im Spiegelfeld, öffentliche Strasse) schnell geprüft. Ohne das wäre der Marker bis zu rund 70 m daneben und die Feldgrösse geraten. Kein Code, kein Alias und keine ID geändert.
