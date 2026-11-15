# Bundle Analyse: Frontend schneller laden (15. November 2026)

Rein lesende Analyse zum Notion Ticket «Frontend schneller laden: Bundle, Lazy Loading und Spielansichten gezielt aufteilen». Basis ist main `91c62d4`. Es wurde nichts am Spiel geändert und nichts deployt. Vergleichsbasis ist die Messung in [perf-baseline.md](perf-baseline.md) vom 12. November.

## Methode

| Schritt | Werkzeug | Ergebnis |
| --- | --- | --- |
| Produktionsbuild | `npm run build` (Next.js 16.4.2, Turbopack) | 19 Chunks, 4,4 MB roh |
| Was wird wann geladen | Playwright gegen `next start`, Telefon, alle sieben Tabs und drei Unterseiten | Dateien je Ansicht |
| Was steckt in jedem Chunk | Analyse Build mit `productionBrowserSourceMaps: true` (nur in einer Scratch Kopie, nie committet), `node scripts/qa/bundle-attribution.mjs` | Bytes je Quelldatei |
| Ladezeiten | `npm run perf:baseline -- --runs 3 --check` | Vergleich mit dem 12. November |
| Live Build | Statische Dateien von goalclicker.ch, nur gelesen (HTML, dann jede referenzierte Datei einmal) | Aufbau des Live Bundles |

Die Live Seite wurde bewusst nicht im Browser gestartet: Das Spiel würde dort Schnittstellen aufrufen und Daten in der Produktion schreiben. gzip Werte je Quelldatei sind einzeln komprimiert und liegen deshalb etwas über ihrem Anteil im Chunk; für die Rangfolge reicht das.

## 1. Vergleich mit der Baseline vom 12. November

Mobil (CPU 4 fach gedrosselt, 1,6 Mbit/s, 150 ms), Median aus 3 Läufen:

| Szenario | JS KB 12.11. | JS KB 91c62d4 | bereit ms 12.11. | bereit ms 91c62d4 | LCP ms 12.11. | LCP ms 91c62d4 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Erststart (Home) | 652 | 679 | 4586 | 5108 | 864 | 5268 |
| Kader | 652 | 679 | 4697 | 5034 | 868 | 5252 |
| Packshop | 652 | 679 | 4775 | 5048 | 880 | 5288 |
| Spiele | 652 | 679 | 4719 | 5313 | 4896 | 5424 |

* **JS +27 KB, bereit rund +0,5 s:** echtes Wachstum seit dem 12. November.
* **LCP von 0,9 auf 5,2 s ist kein Ladeproblem, sondern ein anderes Element.** Gemessen mit `PerformanceObserver` unter gleicher Drosselung: Das grösste Element ist jetzt der Begrüssungstext des interaktiven Tutorials («Du bist Präsident, Trainer und grösster Fan in einem …», 21 896 px², bei 5,1 s). Er erscheint bei einem neuen Spieler erst, wenn das Spiel geladen ist. Vorher (bei 0,7 bis 1,2 s) sind «FOOTBALL IDLE CLUB» und «Build your football empire.» schon da. Die Messung läuft mit leerem Profil, also immer als neuer Spieler. Für eine faire Kennzahl braucht `perf:baseline` ein Szenario mit abgeschlossenem Tutorial.
* FCP (0,7 bis 0,9 s), CLS (höchstens 0,027) und die längste Eingabe (32 ms mobil) sind unauffällig.

## 2. Was wann geladen wird (lokaler Build)

**Erstbesuch:** alle 12 JS Dateien auf einmal, 2,45 MB roh, **rund 666 KB gzip** (548 KB brotli), dazu 4 CSS Dateien (307 KB roh). **Kein Tab lädt etwas nach ausser «Spiele»**, das den Routen Cache holt. Saison, Kader, Karriere, Packs & Album, Club & Mehr, Sammelalbum, Rangliste und Fabrizio laden nichts Neues, weil alle Ansichten in `app/game-app.tsx` und seinen statischen Imports stecken (eine Seite, Tab URLs sind Rewrites in `next.config.ts`).

| Chunk | roh | gzip | brotli | geladen | Inhalt |
| --- | ---: | ---: | ---: | --- | --- |
| `02muy2fjx8ak-.js` | 1515 KB | 302 KB | 133 KB | Tab Spiele | Routen Cache (`app/route-cache/part-0` bis `part-9`) |
| `0f-t_ogly6c_a.js` | 1123 KB | 284 KB | 227 KB | Erstbesuch | Spieldaten: Kartenpools, Indien Daten, `feature-data`, Spiel Engine |
| `3lcd8ch673ki8.js` | 499 KB | 145 KB | 117 KB | Erstbesuch | Spieloberfläche: `game-app`, Panels, Flaggen, Walkout |
| `3d_a-5h76e0b9.js` | 312 KB | 90 KB | 77 KB | Erstbesuch | Anmeldung: `@neon/auth`, `zod`, `account-gate`, Kataloge |
| `2khxl0v1q4i6n.js` | 230 KB | 72 KB | 61 KB | Erstbesuch | Next.js |
| `1f3_j0-7srs8o.js` | 181 KB | 48 KB | 41 KB | Erstbesuch | Next.js |
| `0cz1d0mv5g_q7.js` | 113 KB | 40 KB | 35 KB | nein (Polyfills) | nur für alte Browser |
| `00ke0s041xb05.js` | 98 KB | 19 KB | 16 KB | Erstbesuch | Reisegeografie, Routen, Schweizer Clubs |
| übrige 11 | je unter 23 KB | | | | Laufzeit, kleine Module |

## 3. Grösste Module im Erstbesuch (gzip, einzeln komprimiert)

| Bereich | Quelle | roh | gzip |
| --- | --- | ---: | ---: |
| Framework | Next.js und React | 438 KB | 129 KB |
| Spieldaten | `app/fc27-added-players.ts` | 137 KB | 53 KB |
| | `app/feature-data.ts` | 113 KB | 37 KB |
| | `app/fc27-positions.ts` | 132 KB | 29 KB |
| | `app/fc26-player-pool.ts` | 156 KB | 26 KB |
| | `app/fc27-india-source.client.json` | 253 KB | 25 KB |
| | `app/fc27-ratings.ts` | 64 KB | 22 KB |
| | `app/fc27-women-pool.ts` | 35 KB | 14 KB |
| Oberfläche | `app/game-app.tsx` | 196 KB | 57 KB |
| | `country-flag-icons` | 58 KB | 13 KB |
| | `app/career-panels.tsx` | 44 KB | 12 KB |
| | `app/walkout-data.ts` | 30 KB | 9 KB |
| Anmeldung | `@neon/auth` | 136 KB | 37 KB |
| | `zod` (über `@neon/auth`) | 100 KB | 29 KB |

Zusammengefasst: Spieldaten rund 204 KB gzip, Framework 129 KB, Oberfläche rund 91 KB, Anmelde SDK rund 65 KB.

## 4. Live Build (goalclicker.ch, Stand des Live main `383421b`)

* ChatGPT Sites baut **nicht** mit Turbopack, sondern mit Rolldown/Vite (`framework-…`, `index-…`, `rolldown-runtime-…`). Lokale Chunk Grössen sind deshalb nur ein Richtwert für die Live Seite.
* Das HTML referenziert rund 187 KB gzip (Framework, Einstieg, CSS 54 KB, Konto Gate 14 KB). Das Spiel selbst kommt dynamisch: **`game-app-…` mit 1,55 MB roh und rund 421 KB gzip in einer Datei**, der Routen Cache `travel-route-cache-…` mit 1,46 MB (314 KB). Kleinere Teile (Reisekarte, Spielfeld Canvas, Routenberechnung) sind live schon eigene Dateien.
* Bereits dokumentiert in [live-delivery-check.md](live-delivery-check.md) und hier bestätigt: gehashte Dateien mit `cache-control: public, max-age=0, must-revalidate` (jede Datei wird bei jedem Besuch neu bestätigt) und nur gzip, kein Brotli.

## 5. Hebel nach Beleg, ohne Umsetzung

| # | Hebel | Beleg | Möglicher Gewinn | Braucht |
| --- | --- | --- | --- | --- |
| 1 | Brotli auf der Live Auslieferung | Routen Cache 302 → 133 KB, Spieldaten 284 → 227 KB, Erstbesuch 666 → 548 KB | rund 120 KB beim Erstbesuch, rund 170 KB mehr auf «Spiele» | Einstellung beim Hosting (Nicolas), kein Code |
| 2 | Lange Cache Dauer für gehashte Dateien live | `max-age=0, must-revalidate` auf allen gehashten Dateien | wiederkehrende Besuche ohne Nachfrage pro Datei | Einstellung beim Hosting (Nicolas) |
| 3 | Anmelde SDK erst bei Bedarf laden | `@neon/auth` + `zod` rund 65 KB gzip im Erstbesuch; gebraucht für Google Anmeldung, Passwort ändern, verknüpfte Konten und `refreshAuthSession()` nach erfolgreicher Anmeldung (`app/auth/browser.ts`) | Gäste und abgemeldete Spieler laden es nie; Angemeldete laden es nach dem ersten Bild | Code Änderung mit Freigabe |
| 4 | Routen Cache nur für die gebrauchte Reise | 10 Teile nach Grösse geschnitten (110 bis 163 KB je Teil), alle zusammengeführt (`app/travel-route-cache.ts`) | eine Reise braucht eine Route statt aller; von rund 300 KB auf einen Bruchteil | Datenformat und Code Änderung mit Freigabe |
| 5 | Erststart Messung ohne Tutorial | LCP Element ist das Tutorial | ehrliche LCP Kennzahl | kleine Ergänzung an `perf:baseline` |
| 6 | Flaggen nur mit dem Walkout laden | `country-flag-icons` 13 KB gzip, nur in Walkout und Album gebraucht | rund 13 KB | Code Änderung mit Freigabe |

**Geprüft und kein Hebel:**

* **Indien Daten:** Die Browserkopie ist schon verschlankt (`scripts/client-data.mjs`). Die `stats` sind 85 % der Rohgrösse, komprimiert aber nur rund 20 KB, und die Spiel Engine liest sie (`app/football-rules.ts` über `attributes`).
* **Polyfill Chunk (113 KB):** Moderne Browser laden ihn nicht.
* **Spieldaten später laden:** Kartenpools und `feature-data` braucht schon der erste Bildschirm (Kader, Packs, Fortschritt). Ein Aufteilen wäre ein grösserer Umbau mit Risiko für Spielstände und gehört zum Modularisierungs Ticket.

## Wiederholen

```bash
npm run build
```

```bash
npm run perf:baseline -- --runs 3 --check
```

Für die Zuordnung je Quelldatei in einer Scratch Kopie `productionBrowserSourceMaps: true` in `next.config.ts` setzen, `npx next build` ausführen, dann:

```bash
node scripts/qa/bundle-attribution.mjs <Pfad der Scratch Kopie> bundle-rows.json
```
