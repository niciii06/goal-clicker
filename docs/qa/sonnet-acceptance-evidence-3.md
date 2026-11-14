# Sonnet Abnahmen: GitHub Actions, Startbildschirm, Stadionmarker

Basis: `sonnet/fix-joint-39ffbd2` (39ffbd2, 18399c6, 7c6e1d0). main, gemeinsame Kandidaten und Opus Branches unberührt.

## GitHub Actions Ubuntu und Chromium
Aktueller Lauf: Goal Clicker Validation Nr. 116 auf main 383421b, Job `validate`, Ergebnis **fehlgeschlagen**.
- Erfolgreich: Installation, Lockfile, TypeScript, Lint, Audit, `npm test` (3 Min 20 s), PostgreSQL Tests.
- Fehlgeschlagen: Schritt «Install Chromium for browser tests» mit `Playwright does not support chromium on ubuntu26.04-x64`. Der Lauf nutzte `ubuntu-latest`, das inzwischen Ubuntu 26.04 ist. Browser Smoke, Konto Tests wurden deshalb **übersprungen**, nicht ausgeführt.
- Die Duplikat Schlüssel Zeilen (`profiles_username_key_unique`) im Postgres Log stammen von den Parallelitätstests, die grün sind, und sind kein Fehler.
- Behebung: Commit 57bfc6e legt `runs-on: ubuntu-24.04` fest. Er ist auf `integration/sonnet-main-candidate` und auf diesem Branch enthalten, aber nicht auf main, deshalb gibt es dazu noch keinen GitHub Lauf. playwright-core 1.56.1 listet Chromium für `ubuntu24.04-x64` (`registry/index.js`).
- Offen: Ein grüner Lauf des Browserteils auf GitHub existiert erst, wenn der Pin auf main (oder in einem Pull Request) läuft. Ich habe keinen Lauf ausgelöst (kein main Push, kein Pull Request). Die Browsersuiten laufen lokal grün (Smoke 36, Abnahme 12, Match 5, Konto 16 plus 11 neue).

## Startbildschirm mit springendem Fussball (d4066be)
Befund: erfüllt. Neu: `tests/browser/boot-screen.test.ts` (11 Tests, echter Chromium, Login Build mit Neon Auth Ersatz und Scratch Datenbank).

| Abnahmetest | Beleg |
| --- | --- |
| 1 Kaltstart langsam: Fussball sofort, kein Statuskarte, Ball bewegt sich | Test 1 (Antworten von `/api/account` und `/api/profile` gehalten; Ball sichtbar, keine «FOOTBALL IDLE CLUB» Karte, mindestens 4 verschiedene Höhen, Animation `account-boot-bounce`) |
| 2 Gültige Session: direkt ins Spiel, keine Mindestwartezeit, Spiel erst nach der Prüfung | Test 2 (2,5 s lang kein Spielbutton, Ball bleibt; nach Freigabe Spiel in unter 4 s) |
| 3 Keine Session: Login ohne zusätzliche Wartezeit | Test 1 (Login in unter 1,5 s nach der Antwort) |
| 4 Netzwerkfehler: Meldung mit Wiederholen | Test 3 (Abbruch von `/api/account`, Meldung «Keine Verbindung», Wiederholen führt ins Spiel) |
| 5 Reduzierte Bewegung, hell und dunkel, Safe Area, Grössen | Test 4 (keine Animation, Ball steht still), Tests 5 bis 10 (Handy, Tablet, Desktop je hell und dunkel: Kontrast Statustext mindestens 4,5 zu 1, kein seitliches Scrollen, Ball und Titel im Bild, Innenabstand mindestens 24 px bzw. Safe Area Inset) |
| 6 Keine falsche Spielstandzuordnung, Races | vorhandene Tests: `tests/account-profile.test.ts`, `tests/cloud-sync.test.ts`, `tests/save-recovery.test.ts` (55 grün), Konto Browser Test (16) |

Nicht prüfbar hier: echter iPhone Kaltstart mit langsamer Verbindung und PWA Safe Areas auf echtem Gerät.

## Stadion Marker Wankdorf (5016557)
Befund: Daten korrekt, Marker lokal nicht falsch reproduzierbar. Neu: `tests/browser/travel-marker.test.ts` (2 Tests, Desktop und Handy, Produktionsbuild).
- Der gezeichnete Zielmarker liegt exakt auf der Projektion der geprüften Wankdorf Koordinate (x und y mit derselben Skala, ganzzahliger Zoom) bei Routenansicht und vier Zoomstufen, auch nach Neuladen. Die Strasse endet innerhalb von 100 m am Marker (bei jedem Zoom).
- Die Wankdorf Koordinate selbst bleibt durch `tests/wankdorf-marker.test.ts` gegen die unabhängige OSM Referenz (Weg 32485183, unter 100 m) und gegen den Stadtmittelpunkt (über 2 km) festgenagelt. Weiter vorhanden: `tests/stadium-audit.test.ts` (65 Schweizer Plätze, 41 internationale Anker, Snapshots alter Reisen bleiben), `tests/travel-route-geometry.test.ts`.
- Die OSM Kacheln sind im Test blockiert (kein Fremdzugriff); ob die Kacheln auf dem Handy und live zum Marker passen, braucht die Live Karte.
- Offen: Live Prüfung auf Handy und Desktop nach dem Deployment, Vorher/Nachher Screenshots mit echten Kacheln, Ursache der ursprünglichen Meldung «im Wald» (lokal nicht reproduzierbar; möglich: alte gespeicherte Reise mit der früheren Koordinate 46.96278, 7.465, das ist etwa 40 m neben dem Stadion, kein Wald).
