# Goal Clicker hosten: ChatGPT Sites, Neon und Login

**Produktion (Stand 6. November 2026, Aussage des Besitzers):** Die Live Seite läuft **nur auf ChatGPT Sites**, mit den Daten in Neon (PostgreSQL) und dem Login über Neon Auth. Netlify und Vercel werden für die Produktion nicht mehr verwendet; ihre Abschnitte in [docs/neon-netlify-migration.md](docs/neon-netlify-migration.md) sind Geschichte.

**Veröffentlichen:** ChatGPT Sites übernimmt den Stand des GitHub Branches `main` erst, wenn der Besitzer die Site anweist, `main` zu übernehmen. Ein Push nach GitHub (auch nach `main`) veröffentlicht nichts. Live ist also der zuletzt übernommene Stand von `main`, nicht automatisch der neueste Commit.

Die App ist eine normale Next.js 16 Anwendung auf Node.js 24 (`next build`, `next start`). Die Daten liegen in PostgreSQL bei Neon, angemeldet wird über Neon Auth mit Google oder mit Benutzername und Passwort (ohne Mails). Ohne Login startet das Spiel nicht; jedes Konto hat ein Profil mit eindeutigem Benutzernamen, und der Einzelspieler Spielstand liegt im Profil (gleich auf allen Geräten).

Der Umzug von Vercel und Supabase nach Neon ist in [docs/neon-netlify-migration.md](docs/neon-netlify-migration.md) beschrieben (Übernahme der Originalkonten, Login, Datenbank, Sicherheit). Die dortigen Angaben zu Netlify als Produktion, zum Status «NO GO» und zu Netlify Deploys gelten nicht mehr.

Weiterführend:

* [Umzug auf Neon Auth und Neon (Netlify Teile historisch)](docs/neon-netlify-migration.md)
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

Ohne `NEON_AUTH_BASE_URL` und `NEON_AUTH_COOKIE_SECRET` läuft die App lokal ohne Login und ohne Profil, wie bisher mit der Spieler ID des Browsers. Ein gehosteter Server darf das nie: Er verweigert ohne vollständige Werte alles, was eine Identität braucht. Erkannt wird ein gehosteter Server an den Variablen von Netlify, Vercel oder AWS Lambda oder an `AUTH_REQUIRED=1` (`hostedRuntime` in `app/auth/config.ts`, `next.config.ts`). **ChatGPT Sites setzt keine dieser Anbieter Variablen; dort muss `AUTH_REQUIRED=1` gesetzt sein** (beim Build und zur Laufzeit), sonst würde ein Server mit fehlenden Auth Werten anonym starten (Audit R19).

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

Nur Namen, keine Werte. Werte gehören in `.env.local` (lokal, von Git ignoriert) und in die Einstellungen der ChatGPT Site (Produktion). Eine Testumgebung bekommt eigene Werte und einen eigenen Neon Branch, nie die Produktionsdatenbank. Zusätzlich zur Liste: `AUTH_REQUIRED=1` auf ChatGPT Sites. Liste mit Zweck: [docs/neon-netlify-migration.md](docs/neon-netlify-migration.md#umgebungsvariablen-nur-namen). Keine Variable beginnt mit `NEXT_PUBLIC_`; das Google Client Secret gehört nur in Neon Auth.

## Datenbank auf Neon

* App: der Pooler Host (`-pooler`) des Branches mit `?sslmode=require`, als Rolle `goal_clicker_app` (`scripts/migration/runtime-role.sql`).
* Migrationen und Skripte: direkte Verbindung als `neondb_owner`.
* Auf den Neon Branches fehlt das Drizzle Journal. Neue Migrationen dort direkt mit `psql -f` einspielen; sie sind dafür idempotent geschrieben (`IF NOT EXISTS`).
* Alle Tabellen haben Row Level Security. Data API, Realtime und Object Storage bleiben aus.

## ChatGPT Sites (Produktion)

* Die Site baut die Next.js App aus dem übernommenen Stand von `main`. Neue Versionen gehen nur live, wenn der Besitzer die Site anweist, `main` zu übernehmen; ein Push allein veröffentlicht nichts.
* Vor dem Übernehmen: `npm run typecheck`, `npm run lint`, `npm test` auf `main`. Datenbank Migrationen spielt niemand automatisch ein; neue Migrationen von Hand (siehe oben) und nur, wenn der Code mit und ohne sie läuft.
* Welcher Neon Branch die Live Daten hält, steht in den Variablen der Site (`DATABASE_URL`). Am 2. November 2026 lief die Live Seite auf dem Neon Branch `migration-staging` (Nachtrag in [docs/neon-netlify-migration.md](docs/neon-netlify-migration.md)); vor jeder Arbeit an der Datenbank den Branch in den Site Einstellungen prüfen.
* Rückweg: die Site wieder einen früheren Stand von `main` übernehmen lassen. Daten in Neon bleiben davon unberührt; Spielstände, die ein neuerer Stand geschrieben hat, muss der ältere Code lesen können.

## Netlify und Vercel (nicht mehr für die Produktion)

Netlify und Vercel werden für die Produktion nicht mehr verwendet. Der Code erkennt ihre Umgebungen weiterhin (ohne Auth Werte verweigert der Server), und die Hinweise zu Netlify in [docs/neon-netlify-migration.md](docs/neon-netlify-migration.md) bleiben als Geschichte stehen.

## Spielstand sichern (für Spieler)

Der Spielstand liegt im Profil, sobald man angemeldet ist, und ist auf allen Geräten gleich, auch nach dem Wechsel auf die neue Adresse. Gäste spielen nur Einzelspieler mit einem Spielstand in diesem Browser; mit *Anmelden* kommt er in ein neues Konto.

## Was entfernt wurde

`@supabase/ssr` und `@supabase/supabase-js`, der Supabase Browser Client, die Datenbankfunktionen `goal_clicker_private.create_password_user` und `delete_user` als Abhängigkeit, und die Auslieferung der Login Adresse über `/api/login`. Früher entfernt: die Cloudflare Teile der ersten ChatGPT Sites Version (Vite, vinext, Wrangler, D1, Worker); die heutige ChatGPT Site läuft mit der Next.js App und Neon.
