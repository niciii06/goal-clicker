# Live Prüfung (lesend): goalclicker.ch

Stand 12. November 2026, 19:44 UTC. Nur normale Lese Abrufe der öffentlichen Seite (GET und HEAD, kein Login, keine Schreibzugriffe, keine Last, keine Zugangsdaten). Der Abruf läuft aus der Sandbox über deren Egress Proxy. Das Ergebnis gilt für **den Stand, der live läuft**: Er ist älter als dieser Branch (die Anmeldeseite hat noch kein Augen Symbol im Passwortfeld).

## Befunde

| Punkt | Beobachtung | Bewertung |
|---|---|---|
| DNS | `goalclicker.ch` zeigt auf Cloudflare Adressen, `www.goalclicker.ch` auf `custom-domains.chatgpt.site` | Domain verbunden |
| http zu https | `http://goalclicker.ch/` antwortet `302` auf `https://goalclicker.ch/` (Cloudflare) | funktioniert, aber 302 ist vorläufig; 301 wäre die dauerhafte Form (Einstellung der Plattform) |
| www | `https://www.goalclicker.ch/` liefert `200` ohne Weiterleitung auf die Hauptdomain; `og:url` und Vorschaubild zeigen auf `https://goalclicker.ch` | beide Adressen erreichbar, kanonisch ist die Hauptdomain |
| Protokoll, Kompression | HTTP/2, `content-encoding: gzip` (Brotli wird trotz `Accept-Encoding: br, gzip` nicht geliefert) | Kompression aktiv |
| HTML | `cache-control: no-store, must-revalidate`; ein `__cf_bm` Cookie von Cloudflare (HttpOnly, Secure) | Seiten werden nie geteilt gecacht |
| Hashierte Dateien (`/_next/static/...`) | `cache-control: public, max-age=0, must-revalidate`, `ETag`, `cf-cache-status: HIT` | Beim Besuch wird jede Datei neu bestätigt (304) statt ein Jahr lang aus dem Browser Cache zu kommen. Lokal mit `next start` ist es `immutable`, live setzt die Plattform den Wert. Eine Änderung braucht eine Plattform Einstellung. |
| API | `/api/leaderboard` ohne Parameter: `400`, `cache-control: no-store` | kein öffentlicher Cache für Spiel Daten |
| Weitere Header | kein `strict-transport-security`, keine `content-security-policy`, kein `x-frame-options` auf der Startseite; `x-content-type-options: nosniff` nur auf einigen Antworten | Verbesserungsmöglichkeit, Plattform oder `next.config.ts`; nicht ohne Freigabe geändert |
| Drittanbieter | Im HTML und bei den 17 Anfragen des Browsers nur `goalclicker.ch`; keine Werbe oder Analyse Skripte | AdSense und GA4 sind live nicht eingebunden |
| `ads.txt` | `/ads.txt` ist live vorhanden (eine AdSense Publisher Zeile), im Repository liegt keine Datei | kommt von der Plattform bzw. dem Dashboard |
| `robots.txt`, `sitemap.xml` | beide `404` | nicht vorhanden |
| Offline Seite | `/offline.html` wird mit `307` auf `/offline` umgeleitet, dort `200` | siehe Korrektur unten |
| Browser (headless Chromium, ohne Login) | Anmeldeseite bei 390 und 1280 Pixeln Breite sichtbar, kein horizontaler Überlauf, 17 Anfragen, 3,4 s und 2,1 s bis zum Netzwerk Leerlauf, einziger Konsolenfehler ist der `401` der Sitzungsabfrage ohne Login | gut |

## Was sich von hier nicht belegen lässt

* **Zertifikat:** Der Egress Proxy der Sandbox ersetzt das Zertifikat durch ein eigenes (Aussteller «Egress Gateway»). Gültigkeit, Aussteller und Laufzeit des echten Zertifikats lassen sich nur in einem normalen Browser oder mit einem externen TLS Test prüfen.
* **Login und Spielstand live:** brauchen ein Konto und Zugriff, nicht Teil dieser lesenden Prüfung.
* **Laufende Überwachung (Uptime):** nicht aus dem Repository erkennbar.

## Korrekturen im Code (kostenlos, ohne Live Eingriff)

* `app/layout.tsx`: `metadataBase` zeigte noch auf `goal-clicker.vercel.app`, jetzt `goalclicker.ch`. Die Live Seite liefert die richtige Adresse schon (die Plattform leitet sie vom Host ab); der Code stimmt jetzt damit überein. Die Kennung `players.goal-clicker.vercel.app` für alte Passwort Konten bleibt unverändert, sie ist Teil der Konto Identität.
* `public/sw.js` (Version v3): Der Service Worker speicherte die Offline Seite so, wie sie live ankommt, nämlich als umgeleitete Antwort. Browser lehnen umgeleitete Antworten für Navigationen ab, die Offline Seite hätte nie erscheinen können. Jetzt wird eine saubere Kopie ohne Weiterleitung gespeichert, und die Installation bricht ab, wenn die Seite nicht lädt. Getestet im Unit Test mit nachgebautem Service Worker (`tests/pwa.test.ts`); auf einem echten Gerät offline noch nicht gesehen.

## Offene Entscheidungen und Blocker pro Ticket

| Ticket | Stand | Was fehlt |
|---|---|---|
| Domain, HTTPS und Website-Erreichbarkeit | http zu https, www, DNS und Seite erreichbar belegt | echtes Zertifikat im Browser prüfen, 302 oder 301 entscheiden, laufende Überwachung bestätigen |
| Hosting-Auslieferung | Kompression, Cache Header, Drittanbieter live belegt, Vergleich mit lokal in `docs/qa/hosting-delivery.md` | Entscheid, ob lange Cache Zeiten für hashierte Dateien bei der Plattform gewünscht und möglich sind; Security Header |
| AdSense | `ads.txt` live vorhanden, keine Werbung eingebunden | Freigabe und Einwilligungslösung durch Nicolas, Konto Status in AdSense |
| Neon Kosten | nicht lesend prüfbar | Zugriff auf die Neon Konsole |
