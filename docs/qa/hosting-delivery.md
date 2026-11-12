# Auslieferung: lokaler Ist Zustand (12. November 2026)

Gemessen mit `next start` im Container (`curl -D -` mit `Accept-Encoding: br, gzip`), **nicht** auf goalclicker.ch. Was das Hosting
(ChatGPT Sites) davor ändert, ist damit nicht belegt und muss live mit denselben Aufrufen geprüft werden.

| Antwort | Cache-Control | Kompression | Bemerkung |
|---|---|---|---|
| HTML `/` | `private, no-cache, no-store, max-age=0, must-revalidate` | gzip | Spielzustand wird nie zwischengespeichert. |
| `/_next/static/chunks/*.js`, `*.css` | `public, max-age=31536000, immutable` | gzip | Dateinamen enthalten den Hash, also sicher für ein Jahr. |
| `/favicon.svg`, `/icons/*.png`, `/sw.js` | `public, max-age=0` (ETag) | gzip (Text) | Werden bei jedem Aufruf nachgefragt, deshalb greift der neue Cache Name `v2` des Service Workers sofort. |
| `/manifest.webmanifest` | `public, max-age=0, must-revalidate` | keine | Klein, unkritisch. |
| `/api/*` | `no-store` | | Konten, Spielstände und Koop Daten landen nie in einem gemeinsamen Cache. |

Alle Antworten tragen `x-content-type-options: nosniff` und `referrer-policy: strict-origin-when-cross-origin` (`next.config.ts`).
Es gibt keine Skripte von Drittanbietern (`app/layout.tsx` enthält nur das Theme Skript).

## Was offen bleibt (Live Prüfung, keine Änderung ohne Freigabe)

* Brotli: Next.js liefert gzip. Ob das Hosting davor Brotli und ein CDN anbietet, zeigt nur der Live Aufruf.
* Ob der Proxy `private`/`no-store` der HTML Seite und der API respektiert (nutzerübergreifendes Caching ausschliessen).
* Mobiles Prefetching und zusätzliche kostenpflichtige CDN Dienste: nicht bewertet, keine Empfehlung ohne Messung.

Wiederholen: `npm run build`, `next start`, dann dieselben `curl` Aufrufe gegen die Live Adresse und vergleichen.
