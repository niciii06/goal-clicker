# Goal Clicker selbst bearbeiten und hosten

Dieser Stand übernimmt den Spielcode der Sites Version 113, Commit
`0b96e6007467246726af8e5ff5192c4153b308d5`, und ergänzt externes Hosting.

## Voraussetzungen

- Node.js ab 22.13, npm und Git
- Ein eigener Cloudflare Account für Workers und D1
- Windows: PowerShell funktioniert mit den hier genannten `:external` Befehlen.
  Die ursprünglichen Sites Skripte benötigen dagegen Bash und Linux Werkzeuge.

## Projekt herunterladen und bearbeiten

```sh
git clone https://github.com/niciii06/goal-clicker.git
cd goal-clicker
npm ci
npm run dev:external
```

Die ausgegebene lokale URL öffnen. Der Einzelspieler speichert im Browser.
Für einen lokalen Test inklusive Multiplayer zuerst den unten beschriebenen
Build und die lokalen Migrationen ausführen und `preview:external` verwenden.
Der Vite Entwicklungsserver und die gebaute Vorschau können getrennte lokale
Datenbankzustände verwenden.

| Datei | Inhalt |
| --- | --- |
| `app/page.tsx` | Oberfläche und Spiellogik |
| `app/globals.css` | Darstellung |
| `app/fc26-player-pool.ts` | Spielerpool; der historische Dateiname bleibt bestehen |
| `app/feature-data.ts` | Spielinhalte und Einstellungen |
| `app/walkout-data.ts` | Walkout Daten |
| `app/api/multiplayer/route.ts` | Multiplayer API |
| `db/schema.ts` | Datenbankschema |
| `drizzle/` | SQL Migrationen |
| `wrangler.external.json` | Konfiguration für den eigenen Cloudflare Account |

## Build und lokale Prüfung

```sh
npm run build:external
npm run check:external
npm run db:local
npm run preview:external
```

`check:external` erstellt nur ein Deployment Paket, ohne es hochzuladen.
Die Vorschau läuft lokal mit der D1 Datenbank auf deinem Computer.
Nach Codeänderungen den Build erneut ausführen.

## Im eigenen Cloudflare Account veröffentlichen

```sh
npx wrangler login
npx wrangler d1 create goal-clicker-db
```

Die zurückgegebene `database_id` in `wrangler.external.json` eintragen und bei
abweichendem Namen auch `database_name` ändern. Der Binding Name bleibt `DB`.
Die eingetragene Null-ID ist ausschliesslich ein lokaler Platzhalter.
Die Befehle für Remote Migration und Veröffentlichung lehnen diese ID ab.
Den Worker Namen `goal-clicker` bei Bedarf anpassen.

Anschliessend:

```sh
npm run build:external
npm run check:external
npm run db:remote
npm run deploy:external
```

Wrangler gibt die öffentliche Adresse des Workers aus. Dieser Schritt legt
Hosting Ressourcen in deinem eigenen Account an und verwendet dessen Tarif.
Die bestehende ChatGPT Site wird dadurch nicht umgestellt.
Die externen Befehle geben die Konfiguration ausdrücklich an, damit nicht die
vom Sites Build erzeugte Konfiguration mit der Platzhalter-Datenbank verwendet wird.

Für spätere Updates:

```sh
git pull
npm ci
npm run build:external
npm run db:remote
npm run deploy:external
```

Vor `git pull` eigene Änderungen committen. Änderungen auf GitHub aktualisieren
weder die bestehende ChatGPT Site noch den externen Worker automatisch.
Es ist bewusst kein automatischer Deployment Workflow eingerichtet.

## Daten und Spielstände

GitHub enthält den Quellcode und die Datenbankstruktur, keine laufenden
Multiplayer Welten oder persönlichen Browser Spielstände.

- **Neue Installation:** `db:remote` erstellt die Tabellen in einer leeren D1
  Datenbank. Multiplayer beginnt dort ohne die bisherigen Welten.
- **Bestehende Multiplayer Welten:** Für einen Umzug ist ein vollständiger,
  konsistenter SQL Export der bisherigen D1 Datenbank und Import in die neue
  Datenbank nötig. Dieser Export ist nicht Teil dieses Repositories. Nicht
  einfach den vollständigen Export über bereits migrierte Tabellen importieren.
  Während eines endgültigen Umzugs Schreibzugriffe anhalten und auch den
  Migrationsstand übernehmen bzw. abgleichen.
- **Einzelspieler:** Die Daten liegen unter `goalClicker…` Schlüsseln im
  `localStorage` der alten Adresse. Eine neue Domain erhält diese Daten nicht
  automatisch. Vor dem Wechsel die Schlüssel im Browser sichern und auf der
  neuen Adresse wiederherstellen. Spieler-ID ebenfalls übernehmen, wenn eine
  vorhandene Multiplayer Welt samt Datenbank migriert wird. Solche privaten
  Sicherungen nicht in dieses öffentliche Repository hochladen.

Der aktuelle aktive Datenbankadapter nutzt Cloudflare D1. Das vorhandene
Supabase Paket allein bedeutet keine Supabase Anbindung. Ein Umzug zu einem
anderen Backend erfordert Codeanpassungen.

Ein reiner statischer Hoster kann die Multiplayer API nicht ausführen.
Dieses Setup ist für Cloudflare Workers mit D1 vorbereitet. Für einen anderen
Host müssen Worker Laufzeit und Datenbankadapter angepasst werden.

## Technische Referenzen

- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/workers/wrangler/bundling/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/workers/static-assets/binding/
