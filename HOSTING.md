# Goal Clicker hosten: Netlify, Neon und Login

Die App ist eine normale Next.js 16 Anwendung auf Node.js 24. Netlify baut sie mit `next build` und dem Next.js Adapter (`@netlify/plugin-nextjs`). Die Daten liegen in PostgreSQL bei Neon, angemeldet wird über Neon Auth mit Google oder mit Benutzername und Passwort (ohne Mails). Ohne Login startet das Spiel nicht; jedes Konto hat ein Profil mit eindeutigem Benutzernamen, und der Einzelspieler Spielstand liegt im Profil (gleich auf allen Geräten).

Der Umzug von Vercel und Supabase ist in [docs/neon-netlify-migration.md](docs/neon-netlify-migration.md) beschrieben, mit Übernahme der Originalkonten, Freigabe, Umstellung und Rückweg. Bis zur Freigabe durch den Besitzer gilt: **keine Umstellung der Produktion.**

Weiterführend:

* [Umzug auf Neon Auth, Neon und Netlify](docs/neon-netlify-migration.md)
* [Login einrichten (Google oder Benutzername), Profil und Cloud Spielstand](docs/google-login.md)
* [Datenbank und Datenübernahme](docs/supabase-datenbank.md) (Schema und Regeln, Abschnitte zu Supabase sind historisch)

## Lokal entwickeln

Voraussetzungen: Node.js 24, npm, Git. Für Multiplayer lokal zusätzlich ein PostgreSQL.

```sh
git clone https://github.com/niciii06/goal-clicker.git
cd goal-clicker
npm ci
cp .env.example .env.local   # Werte eintragen, Datei bleibt lokal
npm run db:migrate           # Tabellen in einer LEEREN lokalen Datenbank anlegen (nicht auf Neon, siehe unten)
npm run dev                  # http://localhost:3000
```

Ohne `NEON_AUTH_BASE_URL` und `NEON_AUTH_COOKIE_SECRET` läuft die App lokal ohne Login und ohne Profil, wie bisher mit der Spieler ID des Browsers. Auf Netlify oder Vercel geht das nie: dort verweigert der Server ohne vollständige Werte alles, was eine Identität braucht.

| Befehl | Zweck |
| :--- | :--- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` / `npm start` | Produktionsbuild und lokaler Start |
| `npm run typecheck` / `npm run lint` | Prüfungen |
| `npm test` | Build, alle Unit Tests und ein Test gegen `next start` |
| `npm run test:browser` | Browser Smoke Test gegen den Produktionsbuild (Chromium) |
| `npm run test:db` | Datenbanktests, braucht `TEST_DATABASE_URL` auf eine leere Testdatenbank |
| `npm run test:account` | Login, Übernahme der Originalkonten, Profil, Cloud Spielstand und Multiplayer im Browser gegen einen Nachbau von Neon Auth (braucht `TEST_DATABASE_URL`) |
| `npm run db:migrate` / `npm run db:generate` | Migrationen auf eine Datenbank mit Drizzle Journal anwenden bzw. erzeugen |
| `npx tsx scripts/migration/verify-accounts.mts` | Anzahlen, Prüfsummen und Übernahmestand (nur lesen) |

## Umgebungsvariablen

Nur Namen, keine Werte. Werte gehören in `.env.local` (lokal, von Git ignoriert) und in die Netlify Einstellungen, **pro Kontext** (Produktion und Staging zeigen auf verschiedene Neon Branches). Liste mit Zweck: [docs/neon-netlify-migration.md](docs/neon-netlify-migration.md#umgebungsvariablen-nur-namen). Keine Variable beginnt mit `NEXT_PUBLIC_`; das Google Client Secret gehört nur in Neon Auth.

## Datenbank auf Neon

* App: der Pooler Host (`-pooler`) des Branches mit `?sslmode=require`, als Rolle `goal_clicker_app` (`scripts/migration/runtime-role.sql`).
* Migrationen und Skripte: direkte Verbindung als `neondb_owner`.
* Auf den Neon Branches fehlt das Drizzle Journal. Neue Migrationen dort direkt mit `psql -f` einspielen; sie sind dafür idempotent geschrieben (`IF NOT EXISTS`).
* Alle Tabellen haben Row Level Security. Data API, Realtime und Object Storage bleiben aus.

## Netlify

* Framework Next.js, Build `next build`, Node.js 24, Funktionen in `us-east-2` (gleiche Region wie Neon).
* Der Netlify Zugangsschutz schützt alle Deployments, bis der Besitzer ihn entfernt.
* Ein Deploy Preview, das auf die Produktionsdatenbank zeigt, ist **kein** Staging. Für Staging einen Branch Deploy mit eigenen Variablen auf `migration-staging` verwenden und prüfen, dass der Kontext sie bekommt.
* Jedes Produktionsdeploy kostet im Free Plan 15 Credits; nicht für Kleinigkeiten deployen.

## Spielstand sichern (für Spieler)

Der Spielstand liegt im Profil, sobald man angemeldet ist, und ist auf allen Geräten gleich, auch nach dem Wechsel auf die neue Adresse. Gäste spielen nur Einzelspieler mit einem Spielstand in diesem Browser; mit *Anmelden* kommt er in ein neues Konto.

## Was entfernt wurde

`@supabase/ssr` und `@supabase/supabase-js`, der Supabase Browser Client, die Datenbankfunktionen `goal_clicker_private.create_password_user` und `delete_user` als Abhängigkeit, und die Auslieferung der Login Adresse über `/api/login`. Früher entfernt: die ChatGPT Sites und Cloudflare Teile (Vite, vinext, Wrangler, D1, Worker).
