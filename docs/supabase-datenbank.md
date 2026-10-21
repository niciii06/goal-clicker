# Datenbank: Supabase (PostgreSQL)

Die Multiplayer Welten (`coop_rooms`) und die Reise und Prämienbelege der Einzelspieler (`solo_travel`) liegen in PostgreSQL bei Supabase. Die frühere Cloudflare D1 Datenbank (SQLite) wird vom Code nicht mehr verwendet.

## Was sich gegenüber D1 geändert hat

| Thema | D1 (SQLite) | Supabase (PostgreSQL) |
| :--- | :--- | :--- |
| Treiber | `drizzle-orm/d1` über `env.DB` aus `cloudflare:workers` | `drizzle-orm/postgres-js` mit `DATABASE_URL` |
| Kommazahlen (Tore, Kosten) | `real` | `double precision` |
| Klickzähler, Zustandsversion | `integer` (64 Bit) | `bigint` |
| Reisebeleg | Text mit `json_extract` | `jsonb`, Abfrage mit `->` |
| Zähler erhöhen | `sql.raw` mit Spaltennamen als Text | Spaltenobjekt und gebundener Parameter (`sql\`${spalte} + ${betrag}\``) |
| Zeitstempel | Text, Standardwert `CURRENT_TIMESTAMP` | Text im ISO Format, Standardwert per `to_char(now() ...)` |
| Zugriff über die Supabase REST API | nicht vorhanden | gesperrt: Row Level Security aktiv, keine Policies |
| Indizes | keine | je ein Index auf die vier Sitz Spalten für die Weltenliste |

Alle bedingten Updates bleiben atomar. Jede Schreiboperation ist ein einzelnes `UPDATE ... WHERE ... RETURNING`. Unter PostgreSQL (Isolationsstufe READ COMMITTED) prüft die Datenbank die Bedingung nach einer gleichzeitigen Änderung erneut, deshalb gewinnt genau ein Schreiber:

* `sharedStateVersion`: Spielstand nur speichern, wenn die Version noch stimmt.
* Sitzbelegung: ein freier Platz wird genau einmal vergeben, ein besetzter Platz nur vom Besitzer geändert.
* `lastPassiveAt`: das passive Einkommen wird pro Zeitpunkt genau einmal gutgeschrieben.
* Klicks: `shared_coins = shared_coins + betrag` direkt in der Datenbank.
* Reisebelege: `insert ... on conflict do nothing` und Verbrauch nur, solange `consumed` fehlt, `null`, `false` oder `0` ist.

`tests/db-postgres.test.ts` prüft genau diese Fälle mit vielen gleichzeitigen Anfragen gegen eine echte Datenbank.

## Umgebungsvariablen

| Name | Wofür |
| :--- | :--- |
| `DATABASE_URL` | Verbindung der App. Auf Vercel den **Transaction Pooler** von Supabase verwenden (Port 6543) und `?sslmode=require` anhängen. |
| `DATABASE_POOL_MAX` | Optional, Verbindungen pro Server Instanz (Standard 5). |

Für Migrationen und den Datenimport eine **direkte Verbindung** oder den **Session Pooler** (Port 5432) verwenden. Die Werte stehen im Supabase Dashboard unter *Connect*. Passwörter gehören nie ins Repository, nur in `.env.local` (ignoriert) oder in die Vercel Einstellungen.

## Schema anlegen und ändern

```sh
npm run db:migrate      # wendet drizzle/ auf DATABASE_URL an, mehrfach ausführbar
npm run db:generate     # nach einer Änderung an db/schema.ts eine neue Migration erzeugen
```

Die alten D1 Migrationen liegen zur Nachvollziehbarkeit unter `db/d1-legacy-migrations/`. Sie werden nicht mehr ausgeführt.

## Lokal testen

Variante A, Supabase CLI (braucht Docker):

```sh
npx supabase init
npx supabase start
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run db:migrate
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
```

Variante B, ein normales PostgreSQL ab Version 15 mit einer leeren Datenbank:

```sh
createdb goalclicker_test
TEST_DATABASE_URL=postgres://postgres@localhost:5432/goalclicker_test npm run test:db
```

`npm run test:db` legt die Tabellen an und leert sie. Nie gegen die produktive Datenbank ausführen. Ohne `TEST_DATABASE_URL` werden diese Tests übersprungen.

## Daten von D1 nach Supabase übernehmen

1. In Supabase die Tabellen anlegen: `DATABASE_URL=<Session Pooler URL> npm run db:migrate`.
2. Einen SQL Export der D1 Datenbank beschaffen (siehe nächster Abschnitt) und **nicht** ins Repository legen.
3. Probelauf ohne Schreiben:
   `DATABASE_URL=<Session Pooler URL> npm run db:import-d1 -- --dump d1-export.sql --dry-run`
4. Import: `DATABASE_URL=<Session Pooler URL> npm run db:import-d1 -- --dump d1-export.sql`

Das Skript `scripts/migrate-d1-to-supabase.mjs` ist idempotent:

* Ein zweiter Lauf mit demselben Export ändert nichts.
* Eine Welt, die nach dem ersten Lauf auf Supabase weitergespielt wurde (höhere `shared_state_version` oder neueres `updated_at`), wird nicht überschrieben. `--force` erzwingt das Überschreiben.
* Ein auf Supabase bereits verbrauchter Reisebeleg bleibt verbraucht.
* Spalten, die ältere D1 Stände noch nicht hatten, bekommen die Standardwerte.
* Tabellen, die die App nicht mehr liest (zum Beispiel die alte `leaderboard_entries`), werden als `d1-archive-<tabelle>.json` neben dem Aufruf gespeichert.
* Statt eines SQL Exports geht auch eine SQLite Datei: `--sqlite d1-kopie.sqlite`.

Empfehlung für den endgültigen Umzug: einmal früh importieren und testen, dann kurz vor der Umstellung Schreibzugriffe auf der alten Seite anhalten, frisch exportieren und erneut importieren.

## WICHTIG vor der Kündigung von ChatGPT: Live Daten der Sites Version sichern

**Der Export der Live Datenbank ist aus diesem Repository heraus nicht möglich und konnte nicht geprüft werden.** Die D1 Datenbank der ChatGPT Site läuft in der von OpenAI betriebenen Sites Umgebung (`.openai/hosting.json`, Binding `DB`). Das Repository enthält dafür weder Zugangsdaten noch ein Export Werkzeug, und `wrangler d1 export` funktioniert nur mit einem eigenen Cloudflare Konto. Nach der Kündigung ist die Datenbank vermutlich nicht mehr erreichbar. Deshalb vorher:

1. **In der Sites Oberfläche nach einem Datenbank Export suchen** (Download der D1 Datenbank oder SQL Export). Falls vorhanden, ist das der einfachste Weg. Die Datei mit `npm run db:import-d1 -- --dump <datei>` importieren.
2. **Falls es keinen Export gibt:** eine einmalige, nur für den Besitzer freigegebene Export Route in der Sites Version veröffentlichen. Das deaktiviert nichts, ist aber eine neue Version der Live Seite und muss vom Besitzer bewusst veröffentlicht werden. Die Route gehört auf den Stand der Sites Version (Branch `main`), nicht auf diesen Branch:

   ```ts
   // app/api/owner-export/route.ts (nur Sites Version)
   import { env } from "cloudflare:workers";
   import { headers } from "next/headers";

   export const dynamic = "force-dynamic";
   const OWNER_EMAIL = "besitzer@example.com"; // eigene ChatGPT E-Mail eintragen

   const quote = (v: unknown) => v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replaceAll("'", "''")}'`;

   export async function GET() {
     const email = (await headers()).get("oai-authenticated-user-email");
     if (email?.toLowerCase() !== OWNER_EMAIL) return new Response("Nicht erlaubt", { status: 403 });
     const db = (env as { DB: D1Database }).DB;
     const { results: tables } = await db.prepare("select name, sql from sqlite_master where type = 'table' and name not like '_cf_%' and name not like 'sqlite_%' and name <> 'd1_migrations'").all<{ name: string; sql: string }>();
     let dump = "PRAGMA defer_foreign_keys=TRUE;\n";
     for (const table of tables) {
       dump += `${table.sql};\n`;
       const { results } = await db.prepare(`select * from "${table.name}"`).all<Record<string, unknown>>();
       for (const row of results) dump += `INSERT INTO "${table.name}" (${Object.keys(row).map((k) => `"${k}"`).join(",")}) VALUES(${Object.values(row).map(quote).join(",")});\n`;
     }
     return new Response(dump, { headers: { "content-type": "application/sql; charset=utf-8", "content-disposition": "attachment; filename=d1-export.sql", "cache-control": "no-store" } });
   }
   ```

   Danach angemeldet `https://<sites-adresse>/signin-with-chatgpt?return_to=/api/owner-export` öffnen. Die heruntergeladene Datei ist das Format, das `db:import-d1` erwartet. Die Route nach dem Export wieder entfernen.
3. **Einzelspieler Spielstände** liegen nur im Browser der alten Adresse. Jede Person muss sie vor der Abschaltung sichern. Anleitung im Abschnitt *Spielstand sichern* in `HOSTING.md`.

Welten werden über die Spieler ID im Browser zugeordnet, nicht über die E-Mail Adresse. Wer seinen Einzelspieler Spielstand samt Spieler ID sichert und auf der neuen Seite importiert, findet nach dem Google Login auch seine Multiplayer Welten wieder.
