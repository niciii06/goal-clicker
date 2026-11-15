# Sonnet Abnahmen: Busanimation, mobiler Header, überladene Ansichten

Branch `sonnet/header-touch-solid` (baut auf `sonnet/fix-joint-39ffbd2`). main, gemeinsame Kandidaten und Opus Branches unberührt.

## Funde und Korrekturen (zwei echte Fehler)
1. **iPad und Desktop: die angeheftete Tableiste verdeckte den Header.** Ab 781 px sitzt die Tableiste oben als schwebende Glaskapsel (angeheftet, z-index 30), der Header war ebenfalls angeheftet (z-index 8). Beim Scrollen lag die Kapsel mit Unschärfe über Logo, Kontostand und Symbolen. Das ist die wahrscheinliche Ursache der iPad Meldung vom 14.11. («oben ein Blur, man kann nichts lesen»). Die frühere iOS Anpassung (94 Prozent deckend) konnte das nicht beheben. Korrektur: ab 781 px scrollt der Header weg, nur die Tableiste bleibt angeheftet (`app/styles/base.css`). Verhaltensänderung auf Desktop: der Kontostand bleibt dort beim Scrollen nicht mehr oben stehen. Bitte bestätigen.
2. **Handy: die Pausenkarte (Halbzeit, 90/105 Minuten) legte sich beim Scrollen über den angehefteten Header.** Ursache: `.gc-halftime-cover` (z-index 20) lag in keinem eigenen Stapelkontext. Korrektur: `isolation: isolate` am Spielfeldrahmen (`app/styles/match.css`).
3. Zusätzlich: der Header auf Touchgeräten (iPhone, iPad, `hover: none` und `pointer: coarse`) ist jetzt eine volle deckende Leiste ohne `backdrop-filter`, nicht nur 94 Prozent mit Unschärfe. Desktop behält das leichte Glas.

## Belege
| Ticket | Test | Ergebnis |
| --- | --- | --- |
| Mobiler Header | `tests/browser/header-touch.test.ts` (7): iPhone, iPad hoch und quer, hell und dunkel, oben und gescrollt: keine Unschärfe, volle Deckkraft, Kontrast Titel und Kontostand mindestens 4,5, Touchziele mindestens 44, Header auf dem Handy bleibt oben, auf iPad scrollt er weg; Desktop behält Glas. Ohne die Korrektur rot (6 von 7), mit ihr grün. `tests/ui-fixes.test.ts` pinnt die Regeln. | grün |
| Überladene Ansichten | `tests/browser/overloaded-views.test.ts` (12): pausiertes Match mit offenem Wechselfenster und Club & Mehr (Spielstand Karte über Clubidentität), Handy, iPad, Desktop, hell und dunkel: kein seitliches Scrollen, nichts abgeschnitten, Abstand mindestens 12 px, Touchziele, Header nie verdeckt. Bildschirmfotos visuell nach den Apple HIG geprüft (Hierarchie, Abstände, Lesbarkeit, Dunkel und Hell). | grün |
| Busanimation | `tests/browser/travel-marker.test.ts` (4): Reise Bern nach Zürich (Bus, Zug, Bus), Bus auf der gezeichneten Strasse in 10 Zeitpunkten, Abstand unter 2 px (gemessen 0,01 bis 0,04 px), Strassenverlauf mit vielen Punkten (nicht gerade), Handy und Desktop; Wankdorf Marker wie zuvor. Vorhandene Unit Tests `travel-route-geometry`, `journey-routing`, `travel-realism`, `travel-api`: 57 grün. | grün |

Hinweis zur Busanimation: Eine künstliche Reise von Zürich nach Bern hat keine gecachte Strasse und wird gerade gezeichnet (2 Punkte). Das betrifft nur Heimstädte ausser Bern, deren Wege nicht im Routencache liegen. Das gehört zu den Heimstadt Daten (Opus Ticket), ich habe es nicht geändert.

## Läufe
Unit 801 plus 43 grün, Smoke 28, i18n, Abnahme 12, Match 5, Marker 4, Header 7, Ansichten 12 grün; tsc und eslint sauber.

## Offene Geräte Punkte
- Echtes iPad (Safari): Header ohne Unschärfe, Tableiste angeheftet, nichts verdeckt, hoch und quer, hell und dunkel. WebKit läuft hier nicht, geprüft wurde in Chromium mit Touch Emulation.
- Echtes iPhone: Header, Pausenkarte beim Scrollen.
- Busanimation auf echtem Handy und auf der Live Karte (echte OSM Kacheln).
- Die Kapsel der Tableiste selbst bleibt ein Glas (gewollt), zu entscheiden, ob sie auf iPad ebenfalls deckend werden soll.
- Originalscreenshots der Meldungen liegen nicht in Notion, die Zuordnung der überladenen Ansichten beruht auf der Beschreibung.
