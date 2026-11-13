# Sonnet Tickets: Abgleich mit dem Kandidaten 2932067

Stand 13. November 2026. Kandidat: `integration/sonnet-main-candidate` auf `2932067` (enthält `main` `383421b`). Geprüft auf diesem Stand: `tsc` und Lint sauber, Unit 751 und 43 (`.mjs`), lokale DB 32, Build, Browser Smoke 27 (jetzt 28 mit dem Offline Test, siehe unten), Account Browser Tests 15. Alle Prüfungen lokal und kostenlos, keine Live Daten verändert. Notion wurde nicht geschrieben.

Wichtig für alle «Zu prüfen» Tickets: **Live läuft noch ein älterer Stand** (Service Worker v1). Der Live Test jedes Tickets setzt ein Deployment voraus.

| Ticket | Commits im Kandidaten | Beleg lokal | Was fehlt für die Abnahme |
|---|---|---|---|
| GitHub Actions: Chromium unter Ubuntu 26.04 | `57bfc6e` | Runner `ubuntu-24.04`, Playwright 1.56.1, jeder im Workflow genutzte npm Befehl existiert, Postgres 16 Dienst und `TEST_DATABASE_URL` für `test:db` und `test:account` gesetzt. Dieselben Befehle laufen lokal grün. | Ein echter GitHub Actions Lauf (kein CI Zugriff hier) |
| Performance Baseline, Web Vitals, Budget | `0bd8fce` | Neu gemessen auf `2932067`, siehe `docs/qa/perf-baseline.md` (LCP Element: Einstiegsdialog) | Felddaten echter Besucher |
| Startbildschirm mit Fussball | `d4066be` | Browser Smoke und Account Test (Startbildschirm, Wechsel zum Login) | Live |
| Passwortfeld mit Auge (Teil von Login) | `8a9d414` | Account Browser Tests 15 von 15 | Live |
| Tutorial interaktiv, Willkommens Walkout | `bce3e4d`, `d3a62d2` | Tutorial Tests, Browser Smoke (geführter Pfad, abbrechen) | Opus Ticket «Tutorial interaktiv» (nicht meins), Live |
| Walkout Typ und Beschreibung erst nach Animation | `4b3ddbf` | `walkout-reveal` Test, Smoke | Live |
| Bestes Team: Spieler fixieren | `c0c01cd` | `pinned-starters` Test, Koop Aktion `star-pin` | Live |
| Koop Weltverwaltung nach unten | `375baa9` | `qol-coop` Test, Smoke | Live |
| Prämienpacks nach 4 Ligaspielen abschaffen | `47324db` | Balance und Koop Tests | Live |
| Matchpausen bei 90 und 105 | `36b87ef` | Tests (Pause, Fortsetzen, Ende bei 120) | Live |
| Saison und Matchlogik Tests | `2478301`, `51f6c11` | 166 Tests, zweimal stabil, Zuordnung in `docs/qa/match-logic-coverage.md` | keine |
| Saisontabelle: Form, Tooltips | `d58ad29`, `7d1bf32` | Tooltip im Browser (Hover, Fokus, Escape, Tippen, 1280 und 768 Pixel) | Live |
| KI Auf und Abstieg | `ff69b58`, `28416b4` | 15 Tests, Browser Sicht bei 390 und 1280 Pixel, Spielstände, 40 Saisons | Live Test |
| Wankdorf Marker | `5016557` | Daten 3 bis 4 m neben der Referenz, Route endet 39 m davor, Test | Live Karte, Ursache der Meldung nicht reproduzierbar |
| Busanimation entlang der Strasse | `671da7f` | Test über alle Auswärtsziele, Chromium 390 und 1280 Pixel | echtes Mobilgerät |
| Zwei überladene Ansichten | `78ba24f`, `f28e761` | Browser Sicht Desktop und Mobil | Bildoriginale fehlen, Abnahme durch Nicolas |
| Mobiler Header iPhone und iPad | `86a955d` | Chromium sieht keinen Fehler, Gegenmassnahme nur für WebKit (`@supports`). **In dieser Umgebung gibt es kein WebKit** (nur Chromium), die Wirkung ist hier nicht prüfbar. | Echtes iPhone oder iPad |
| Apple HIG Standard | `6813382` | Regel in `CLAUDE.md`, bei jeder UI Änderung angewendet | keine |
| Test und Skriptorganisation | `3ed3e67` | Entscheidungsvorlage `docs/qa/test-organisation.md` | Entscheid von Nicolas |
| Repository Hygiene | `966b460` | `.gitignore`, Bestandsdokument, nichts gelöscht | keine |
| Spezialkarten gleich wahrscheinlich, 25'000 | `6fa9a06`, `064968f`, `e4c6061`, `2932067` | 40 gezielte Tests (Gleichverteilung, Solo, Koop, Altquittung) | Live Test |
| Hosting Auslieferung | `18dfb81`, `47b62c0` | Lokal und live gemessen, Offline Korrektur im echten Browser belegt (neu, siehe `docs/qa/live-delivery-check.md`) | Plattform Entscheide, echtes Gerät |
| Domain, HTTPS | `47b62c0` | DNS, 302, www, Metadaten Basis im Code | echtes Zertifikat im Browser, Überwachung |
| AdSense, Neon Kosten | nicht lesend im Code prüfbar | `ads.txt` live vorhanden, keine Skripte; Neon Kontoprüfung steht in Notion | Konto Zugriff und Freigabe von Nicolas |
| Web Push (Idee) | `586d745`, `0d5b6e8` | Analyse, nichts implementiert | Entscheid, drei fehlende Belege |
| Werbekonzept, GA4 (Idee, ChatGPT) | nicht angefasst | keine | Freigabe |

## Neu in dieser Runde

* **Offline Seite im echten Browser belegt und als Test festgehalten** (`tests/browser/smoke.test.ts`): Mit einer Weiterleitung wie live speichert der alte Worker eine umgeleitete Antwort, die Offline Navigation scheitert. Der neue zeigt «Keine Verbindung». Gegenprobe: Der Test schlägt mit dem alten Worker fehl.
* **Performance neu gemessen** und die LCP Veränderung erklärt (Element, nicht Verlust).
* **Notion nennt noch 731 Tests und den Stand `47b62c0`.** Aktuell sind es 751 Unit und 43 weitere Tests auf `2932067`.
