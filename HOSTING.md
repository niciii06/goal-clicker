# Goal Clicker hosten: Vercel, Supabase und Login

Die App ist eine normale Next.js 16 Anwendung. Vercel baut sie direkt mit `next build`, ohne Anpassungen. Die Daten liegen in Supabase (PostgreSQL), angemeldet wird über Supabase Auth mit Google, mit einem Code per Mail oder mit E-Mail und Passwort. Ohne Login startet das Spiel nicht; jedes Konto hat ein Profil mit eindeutigem Benutzernamen, und der Einzelspieler Spielstand liegt im Profil (gleich auf allen Geräten).

Weiterführend:

* [Datenbank und Datenübernahme](docs/supabase-datenbank.md)
* [Login einrichten (Google und E-Mail), Profil und Cloud Spielstand](docs/google-login.md)

Die bisherige ChatGPT Sites Version ist davon unabhängig. Nichts in diesem Repository schaltet sie ab oder verändert sie. Ein Push auf GitHub aktualisiert die Site nicht.

## Lokal entwickeln

Voraussetzungen: Node.js ab 22.13, npm, Git. Für Multiplayer lokal zusätzlich ein PostgreSQL (Supabase CLI mit Docker oder ein normales PostgreSQL).

```sh
git clone https://github.com/niciii06/goal-clicker.git
cd goal-clicker
npm ci
cp .env.example .env.local   # Werte eintragen, Datei bleibt lokal
npm run db:migrate           # Tabellen in DATABASE_URL anlegen
npm run dev                  # http://localhost:3000
```

Ohne Supabase Werte in `.env.local` läuft die App lokal ohne Login und ohne Profil, wie bisher mit der Spieler ID des Browsers. Der Einzelspieler braucht dann gar keine Datenbank.

| Befehl | Zweck |
| :--- | :--- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` / `npm start` | Produktionsbuild und lokaler Start |
| `npm run typecheck` / `npm run lint` | Prüfungen |
| `npm test` | Build, alle Unit Tests und ein Test gegen `next start` |
| `npm run test:browser` | Browser Smoke Test gegen den Produktionsbuild (Chromium) |
| `npm run test:db` | Datenbanktests, braucht `TEST_DATABASE_URL` auf eine leere Testdatenbank |
| `npm run test:account` | Login, Profil und Cloud Spielstand im Browser, mit einem Ersatz für Supabase Auth (braucht `TEST_DATABASE_URL`) |
| `npm run db:migrate` / `npm run db:generate` | Migrationen anwenden bzw. nach Schemaänderungen erzeugen |
| `npm run db:import-d1` | Daten aus einem D1 Export übernehmen |
| `npm run generate:client-data` | Schlanke Browser Kopie von `app/fc27-india-source.json` neu erzeugen |

## Umgebungsvariablen

Nur Namen, keine Werte. Werte gehören in `.env.local` (lokal, von Git ignoriert) und in die Vercel Einstellungen.

| Name | Pflicht | Wo | Beschreibung |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | ja | Vercel, lokal | Projekt URL `https://<projekt-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ja | Vercel, lokal | Publishable Key (`sb_publishable_...`), bei älteren Projekten ersatzweise `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `DATABASE_URL` | ja | Vercel, lokal | PostgreSQL Verbindung. Auf Vercel der Transaction Pooler (Port 6543) mit `?sslmode=require` |
| `DATABASE_POOL_MAX` | nein | Vercel | Verbindungen pro Server Instanz, Standard 5 |
| `AUTH_REQUIRED` | nein | lokal | `1` verweigert Multiplayer ohne Supabase Werte auch ausserhalb von Vercel |
| `TEST_DATABASE_URL` | nein | nur Tests | Leere Testdatenbank für `npm run test:db`, nie die echte |

Das Google Client Secret gehört **nur** in Supabase, nicht in Vercel. Der Supabase `service_role` bzw. `secret` Key wird nicht gebraucht.

## Einrichtung durch den Besitzer

Diese Schritte erfordern Konten und Geheimnisse und können nur vom Besitzer erledigt werden.

### 1. Supabase Projekt

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen. Region möglichst nah an den Spielern, zum Beispiel Frankfurt (`eu-central-1`).
2. Unter *Project Settings* → *JWT Keys* prüfen, dass die neuen asymmetrischen Signing Keys aktiv sind. Dann prüft der Server Logins lokal statt bei jeder Anfrage bei Supabase nachzufragen.
3. Unter *Connect* die Verbindungs URLs kopieren: **Transaction Pooler** (für Vercel) und **Session Pooler** oder direkte Verbindung (für Migrationen und Import).
4. Tabellen anlegen, lokal ausgeführt: `DATABASE_URL=<Session Pooler URL> npm run db:migrate`

Alle Tabellen haben Row Level Security ohne Policies. Damit sind sie über die öffentliche Supabase REST API gesperrt. Die App greift serverseitig direkt per PostgreSQL zu.

### 2. Login (Google und E-Mail)

Anleitung mit allen Weiterleitungs URLs und Mailvorlagen: [docs/google-login.md](docs/google-login.md). Kurzfassung:

* Google OAuth Client, Weiterleitungs URI: `https://<projekt-ref>.supabase.co/auth/v1/callback`
* Supabase *URL Configuration*: Site URL `https://<domain>`, Redirect URLs `https://<domain>/auth/callback`, `https://*-<team>.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`
* E-Mail: eigener Mailversand (SMTP, zum Beispiel Gmail mit App Passwort) und die drei Mailvorlagen mit `{{ .Token }}`

### 3. Vercel Projekt verbinden

1. Auf [vercel.com](https://vercel.com) *Add New* → *Project* → das GitHub Repository `niciii06/goal-clicker` importieren.
2. Framework Preset: **Next.js** (wird erkannt). Build Command `next build`, Output und Install Command auf Standard lassen. Node.js Version 22 oder neuer (aus `engines` in `package.json`).
3. Die Umgebungsvariablen aus der Tabelle oben für *Production* und *Preview* setzen.
4. Unter *Settings* → *Functions* die Region auf die Supabase Region setzen (zum Beispiel `fra1` für Frankfurt), damit Datenbankabfragen kurz bleiben.
5. Deployen. Jeder Push auf einen Branch erzeugt ein Preview Deployment, ein Push auf `main` die Produktion.

Hinweis: Der frühere Cloudflare Worker hatte eine optionale Anfragebegrenzung für `/api/`. Vercel hat dafür keine Bindung im Code. Bei Bedarf in Vercel unter *Firewall* eine Rate Limiting Regel für `/api/*` anlegen.

### 4. Preview Deployment prüfen

Auf der Preview Adresse nacheinander:

1. **Login**: *Mit Google anmelden* → Google Konto wählen → beim ersten Mal Profil anlegen → im Spiel stehen Anzeigename und Benutzername oben. Ebenso mit *Code per Mail*. *Abmelden* funktioniert.
2. **Einzelspieler**: klicken, Upgrade kaufen, Seite neu laden, Stand bleibt. Auf einem zweiten Gerät anmelden: derselbe Stand. Unter *Club & Mehr* *Spielstand herunterladen* und wieder *hochladen*.
3. **Multiplayer**: angemeldet eine Welt erstellen, in einem zweiten Browser (anderes Google Konto) mit dem Code beitreten, beide klicken, beide sehen dieselben Tore. Abgemeldet erscheint der Hinweis, dass Multiplayer einen Login braucht.

### 5. Daten übernehmen

1. **Vor der Kündigung von ChatGPT** die Live Datenbank der Sites Version sichern. Das ist nicht aus diesem Repository heraus möglich, siehe [Abschnitt in docs/supabase-datenbank.md](docs/supabase-datenbank.md#wichtig-vor-der-kündigung-von-chatgpt-live-daten-der-sites-version-sichern).
2. `DATABASE_URL=<Session Pooler URL> npm run db:import-d1 -- --dump d1-export.sql --dry-run`, danach ohne `--dry-run`. Der Import ist wiederholbar.
3. Spieler bitten, ihren Einzelspieler Spielstand zu sichern (nächster Abschnitt).

## Spielstand sichern (für Spieler)

Der Einzelspieler Spielstand liegt im Browser unter der alten Adresse und zieht nicht automatisch auf eine neue Domain um.

**Auf der neuen Seite**: *Club & Mehr* → *Spielstand herunterladen* bzw. *Spielstand hochladen*.

**Auf der alten ChatGPT Sites Adresse** gibt es diesen Knopf nicht. Dort die Seite öffnen, die Entwicklerkonsole des Browsers öffnen (F12, Reiter *Konsole*) und einfügen:

```js
(() => {
  const keys = Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith("goalClicker")).map((k) => [k, localStorage.getItem(k)]));
  const file = { format: "goal-clicker-save", version: 1, exportedAt: new Date().toISOString(), origin: location.origin, keys };
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" })), download: "goal-clicker-spielstand.json" });
  link.click();
})();
```

Die heruntergeladene Datei auf der neuen Seite unter *Spielstand hochladen* einlesen. Sie enthält auch die Spieler ID. Wer danach angemeldet ist, bekommt seine bisherigen Multiplayer Welten zurück (Details in [docs/google-login.md](docs/google-login.md)). Die Datei nicht öffentlich teilen, die Spieler ID darin ist der Schlüssel zu den eigenen Welten.

## Was entfernt wurde

Die ChatGPT Sites und Cloudflare spezifischen Teile sind nicht mehr im Code: Vite und vinext Build, `build/sites-vite-plugin.ts`, `build/client-data-plugin.ts`, `scripts/sites-env.sh`, die Sites Install und Artefakt Skripte, `scripts/external-hosting.mjs`, `scripts/export-chatgpt-knowledge.mjs`, Wrangler Konfigurationen, der Worker Einstieg, `.openai/hosting.json`, das D1 Beispiel, `@cloudflare/vite-plugin` und alle `cloudflare:workers` Importe. Die Aufgaben der Vite Plugins übernehmen jetzt die `imports` in `package.json`: Der Browser bekommt die schlanke FC 27 Datei und lädt die Reiserouten erst nach dem Start.
