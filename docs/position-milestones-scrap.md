# Position milestones and Schrott-Pack

> Historischer Stand. Aktuelle Regeln und Freigabe: [Release verification](release-match-realism.md) und [Sites project knowledge](chatgpt-sites-knowledge.md).

## Implemented behaviour

Career schema version 2 fixes each card's milestone category from its catalogue primary position. Match-position changes and alternate positions do not alter the category. Existing lifetime statistics, unlocked legacy milestone IDs, accumulated album collections and claimed album rewards survive normalization. On migration from version 1, previously earned legacy entitlements are granted once before switching to positional thresholds. New tiers unlock automatically; the strongest version applies, bonuses never stack and OVR never exceeds 100. The existing album bulk-claim button continues to collect all complete unclaimed groups once.

| Category | Appearances (tiers 1/2/3) | Goals | Assists | Minutes |
| --- | --- | --- | --- | --- |
| TW | 10 / 25 / 100 | None | None | 450 / 1800 / 9000 |
| IV, LV, RV, LAV, RAV | 10 / 25 / 100 | 1 / 5 / 15 | 2 / 10 / 30 | None |
| ZDM, ZM, ZOM | 10 / 25 / 100 | 5 / 20 / 60 | 5 / 20 / 60 | None |
| LM, RM, LF, RF (LW/RW aliases) | 10 / 25 / 100 | 5 / 25 / 75 | 5 / 15 / 50 | None |
| ST, MS | 10 / 25 / 100 | 10 / 30 / 100 | 3 / 10 / 30 | None |

Each track grants +1 / +2 / +3 OVR for its tiers, using the existing automatic milestone-card mechanism. Clean sheets, tackles, saves and penalty saves have no existing reliable lifetime counters, so no new counters were invented. Early tiers need at most ten appearances for the participation reward; the top participation tier needs ten ten-game seasons if the player appears throughout. Offensive tiers are lifetime cumulative goals/assists and follow the existing match engine's recorded contributions. Requirement progress and remaining amounts appear on every card.

## Schrott-Pack: FC 27 update, 12 October 2026

Source: official EA ratings at https://www.ea.com/games/ea-sports-fc/ratings/nations-ratings/india/159 (all three pages, 218 records). Original source snapshot including EA IDs, names, ratings, primary and alternate positions, nationality, club, abilities and all available attributes is tracked in app/fc27-india-source.json. Empty optional fields stay empty.

Price stays 7,500 Tore. Rating groups contain 137 / 57 / 10 / 14 players and have probabilities 50% / 35% / 13% / 2%. Each draw selects a group, then a uniformly random player inside it. Ownership and squad positions never affect the draw. Duplicates use existing fragment compensation. Empty groups redistribute probability proportionally; source updates above 69 require an explicit rule update instead of silently excluding players.

The old 60 fictional cards are completely removed at the user's request. Save normalization removes their IDs from rosters and formations. Multiplayer protocol 6 prevents older clients from overwriting the new catalogue. The scrap album now contains the 218 real cards; previously claimed rewards remain claimed. Existing other pack definitions, prices and eligible player pools are preserved. No source restrictions or group odds appear in public pack metadata; normal cards show their normal data.

Validation: 100,000 production draws yielded 50,167 / 34,892 / 12,958 / 1,983. Chi-square across individual players was 216.957 (217 degrees of freedom), under the test threshold of 300. Every player was sampled and deterministic quantile checks confirm all players are reachable. Tests cover complete source matching, original attributes, save normalization, positional eligibility, milestone upgrades, albums, season match lifecycle, API charging/duplicates and legacy removal. Random pulls no longer guarantee a full team after eleven purchases. Formations requiring positions absent from the official pool still require compatible players from elsewhere; no positions are invented.

Interactive browser QA is unavailable; production build, server-rendered markup, game logic, saves and API handlers are checked.

## FC 27 Datenbank und Icons: Update vom 17. Oktober 2026

Quelle für Basiskarten: die offizielle EA SPORTS FC 27 Ratings-Datenbank auf https://www.ea.com/games/ea-sports-fc/ratings (alle 198 Seiten, 19'789 Spieler). Die bisherigen Launch-Werte stimmen für alle 1'394 noch gelisteten Spieler exakt mit Rating und Positionen überein. 17 Spieler, die EA nach dem Launch ergänzt hat (zum Beispiel Salah 87, Vlahović 81, Partey 78), haben jetzt ihre FC 27 Werte. Damit gibt es 1'423 offizielle FC 27 Einträge.

90 Basis- und YB-Karten gibt es in FC 27 nicht mehr. Sie stehen in `FC27_UNAVAILABLE_SOURCE_IDS`, tragen `retired: true` und werden aus keinem Pack mehr gezogen (Shop, Schrott und Prämien). Wer sie besitzt, behält sie mit dem bisherigen Rating. Im Sammelalbum erscheinen sie nur noch bei Spielern, die sie bereits gesammelt haben, und zählen nicht mehr zu den Sammlungsprämien.

Icons: alle 136 FC 27 Base Icons aus dem Ultimate Team Katalog (FUT.GG Spiegel der EA Spieldaten, abgerufen am 17. Oktober 2026), mit FC 27 Rating, Positionen und Nation. Bestehende Icon-IDs und Namen bleiben für Spielstände erhalten. 14 Icons sind neu, darunter Sinclair, Agüero, Yaya Touré und Varane, alle mit festem Walkout-Aussehen. Die 7 FC 26 Icons ohne FC 27 Karte (Yashin, Kluivert, Šuker, Zola, Luis Hernández, Larsson, Verón) sind wie oben aus den Packs genommen.

FC 27 kennt keine Positionen LAV, RAV und MS mehr. Damit Fünferketten spielbar bleiben, decken LV und RV die Flügelverteidiger-Slots ab und ST den MS-Slot. Angezeigt werden weiterhin nur die offiziellen Positionen.
Protokoll 12 verhindert, dass ältere Koop-Clients die neuen Icon-IDs aus gemeinsamen Spielständen entfernen.

## FC 27 Spielerinnen: Update vom 17. Oktober 2026

Alle 1'220 Spielerinnen mit Rating 70 oder höher aus der offiziellen FC 27 Ratings-Datenbank sind jetzt Basiskarten (`app/fc27-women-pool.ts`, IDs `star-fc27w-<EA-ID>`). Rating und Positionen stehen wie bei den Männern in den gemeinsamen FC 27 Tabellen (jetzt 2'643 offizielle Einträge). Jede Karte trägt ihre Nation, die Namen folgen derselben Schreibweise mit geändertem Schlussbuchstaben.

Die Spielerinnen laufen in denselben Packs, Prämien, Gegnerteams und Sammelalben wie alle anderen Basiskarten. In den Shop-Packs sind 939 von 1'929 Standardkarten (65 bis 79) Spielerinnen, 243 von 625 seltenen (80 bis 85), 35 von 89 Walkouts (86 bis 89) und 3 von 14 Top-Walkouts (90+).

Einen Walkout gibt es nur ab Rating 86. Die 38 Spielerinnen in diesem Bereich und die 14 neuen FC 27 Icons sind nach den offiziellen EA FC 27 Porträts gestaltet (Hautton, Frisur, Haarfarbe, Gesichtsform). Grösse und Statur kommen aus den FC 27 Kartendaten. Spielerinnen unter 86 bekommen keinen Walkout, ihr neutraler Rückfall-Look ohne Bart erscheint deshalb nie als Walkout-Figur. 33 neue Nationen haben Walkout-Farben und echte Flaggen bekommen, dabei auch Kanada für das neue Icon Christine Sinclair. Protokoll 13 schützt die neuen Karten vor älteren Koop-Clients.

## Walkout-Abgleich mit den FC 27 Porträts: 17. Oktober 2026

Alle Walkout-Figuren, die ein Pack zeigen kann, wurden mit den offiziellen Porträts verglichen: 136 FC 27 Icons (FUT.GG Kartenbilder), 65 Männer und 38 Frauen ab Rating 86 (EA Ratings-Porträts). Geprüft wurden Hautton, Frisur, Haarfarbe und Bart. 68 bestehende Figuren wurden korrigiert, unter anderem Zidane (kurze Haare statt Glatze), Ronaldinho (Pferdeschwanz), Drogba und Rio Ferdinand (Zöpfe), Salah (kurz rasiert), van Dijk (zurückgekämmt), Wirtz (blond gefärbt) und Bellingham. Die 7 FC 26 Icons ohne FC 27 Karte wurden nicht geprüft, sie kommen in keinem Pack mehr vor.
