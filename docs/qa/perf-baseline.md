# Performance Baseline (12. November 2026)

Ausgangswerte für spätere Vergleiche. Gemessen mit `npm run build` und `npm run perf:baseline` (`scripts/qa/perf-baseline.mjs`):
lokaler `next start`, kalter Cache, leeres Browserprofil, lokales Einzelspiel ohne Konto, ohne Datenbank, ohne Telemetrie.

* Stand: Commit der Messung siehe Kopf der Ausgabe, Node v24.22.3, Chromium 153 (im Container vorinstalliert), 3 Läufe je Zeile, Median.
* Mobil: 390 x 844, Touch, CPU 4 fach gedrosselt, Netz 1,6 Mbit/s mit 150 ms Latenz. Desktop: 1280 x 800 ohne Drosselung.
* Gemessen werden LCP, FCP, CLS, bis das Spiel bedienbar ist, übertragene Bytes (JS und gesamt), Anfragen und die längste Verarbeitung von 20 Ballklicks als Ersatz für INP.
* Das ist **synthetisch**. Echtes INP und echte Felddaten brauchen echte Besucher und eine datenschutzkonforme Erfassung; dafür wurde bewusst nichts eingebaut (keine Skripte von Dritten, keine Spieldaten in Telemetrie).

| Profil | Szenario | LCP ms | FCP ms | CLS | bereit ms | längste Eingabe ms | JS KB | gesamt KB | Anfragen |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| mobile | Erststart (Home) | 864 | 864 | 0.027 | 4586 | 40 | 652.3 | 1102.7 | 19 |
| mobile | Kader | 868 | 868 | 0.001 | 4697 | - | 652.3 | 742.1 | 16 |
| mobile | Packshop | 880 | 880 | 0.001 | 4775 | - | 652.3 | 742.1 | 16 |
| mobile | Spiele | 4896 | 896 | 0.001 | 4719 | - | 652.3 | 722.9 | 14 |
| desktop | Erststart (Home) | 212 | 212 | 0.009 | 519 | 232 | 652.3 | 1102.7 | 19 |
| desktop | Kader | 176 | 176 | 0 | 425 | - | 652.3 | 1102.7 | 19 |
| desktop | Packshop | 184 | 184 | 0 | 402 | - | 652.3 | 1102.7 | 19 |
| desktop | Spiele | 500 | 228 | 0 | 475 | - | 950.6 | 1401 | 20 |

Wiederholen und vergleichen: `npm run build`, dann `npm run perf:baseline -- --check`. Die Warnschwellen stehen in `scripts/qa/perf-budget.json`
(Bytes und Anfragen etwa 25 Prozent über der Messung, Zeiten etwa doppelt, weil sie schwanken). `--check` meldet nur Warnungen und beendet mit Code 0,
damit eine laute Messung nie ein Deployment blockiert; `--strict` macht daraus einen Fehler. Schwellen nur zusammen mit einer neuen Messung ändern.

## Was die Zahlen zeigen (und was nicht)

1. **Jeder Tab lädt dieselben 652 KB JavaScript** (komprimiert übertragen), weil alle Ansichten in einer Seite stecken (`app/page.tsx`, rewrites in `next.config.ts`). Die zwei grössten Dateien enthalten den Kartenkatalog (`star-goat-nicu`), die Reisegeografie und die FC27 Daten (rund 278 KB und 220 KB komprimiert). Das ist der grösste Hebel für das Ticket «Frontend schneller laden», aber erst ein Vorher/Nachher Vergleich mit diesem Skript belegt einen Gewinn.
2. **Spiele lädt zusätzlich den Routen Cache** (rund 300 KB komprimiert, die 1,5 MB Datei `app/travel-route-cache.json`). Auf Mobil liegt der LCP dort bei etwa 4,9 s gegen 0,9 s FCP: Das grösste Element erscheint unter Drosselung spät. Ursache nicht nachgewiesen.
3. **Die Eingabe ist unauffällig.** Die längste Verarbeitung eines Ballklicks liegt mobil bei etwa 40 ms. Der Desktop Wert (etwa 230 ms) stammt vermutlich vom ersten Klick; mit mehr Läufen prüfen, bevor etwas optimiert wird.

Keine dieser Aussagen ist eine Optimierung. Der grösste CLS Wert liegt bei 0,027 (gut, Grenze 0,1).
