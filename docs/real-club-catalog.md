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
| Bern | 4 | 7 fiktiv, 35 echt | 11 |
| Zürich | 4 | 41 fiktiv, 1 echt (FC Oerlikon/Polizei ZH) | 45 |
| Basel | 4 | 39 fiktiv, 3 echt (FC Amicitia Riehen, FC Pratteln, SC Dornach) | 43 |
| Genève | 4 | 40 fiktiv, 2 echt (Signal FC Bernex-Confignon, Meyrin FC) | 44 |

**Gemeinsame Plätze (wirken in allen vier Welten, deshalb zuerst):** `extra-4-fc-alpenfestung` (FC Alpenfestung, Liga 4), `extra-5-fc-gotthard-murmeltiere` (Liga 5), `extra-6-fc-l-man-mouettes` (Liga 6), `extra-7-fc-z-risee-b-tler` (Liga 7). Ihre Spielorte sind geliehene geprüfte Plätze anderer Clubs der Liga.

**Nur Bern, Liga 8 bis 14:** `extra-8-fc-r-stigraben-united`, `extra-9-fc-seeland-hechte`, `extra-10-fc-emmental-k-sekicker`, `extra-11-fc-g-rbetal-kickers`, `extra-12-fc-worblental-rangers`, `extra-13-sc-marzili-bern`, `extra-14-fc-aaref-chse-bern`.

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
