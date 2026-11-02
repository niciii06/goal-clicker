# Umzug auf Neon Auth, Neon PostgreSQL und Netlify

Stand: 2. November 2026. Status: **NO-GO für die Produktion.** Der Code ist ein Release Kandidat, die Umstellung der Produktion braucht die Punkte unter [Freigabe](#freigabe-für-die-produktion) und die ausdrückliche Zustimmung des Besitzers.

## Kurzfassung

* Login über **Neon Auth** (Managed Better Auth) mit `@neon/auth` 0.8.2: Google und Benutzername mit Passwort. Supabase Auth wird zur Laufzeit nicht mehr gebraucht, ausser von der **vorübergehenden Brücke** für die sechs alten Benutzername Konten.
* Daten weiter mit Drizzle und postgres.js in PostgreSQL, jetzt auf Neon. Mehrspieler Architektur, Versionsprüfungen, Sitz Bedingungen, Klickzählung und Kompression sind unverändert.
* **Drei getrennte Kennungen:** Login (Neon Auth Benutzer ID), Spielkonto (bisherige Konto UUID in `profiles.user_id`, `cloud_saves.user_id`, `player_accounts.user_id`) und Spieler ID (Sitz in den Welten). Neue Tabelle `auth_identities` ordnet einen geprüften Login einem Spielkonto zu. Eine Neon Benutzer ID wird nie als Spielkonto behandelt.
* Alle neun Originalkonten bleiben mit ihren IDs, Profilen, Spielständen und Welten erhalten. Übernommen wird nur durch einen geprüften Nachweis: der von Neon Auth bestätigte Google `sub`, das alte Passwort bei Supabase oder ein einmaliger Code des Besitzers.
* **Fail closed:** Auf Netlify oder Vercel, oder mit unvollständiger Konfiguration, verweigert der Server alles, was eine Identität braucht. Nie wieder anonymes Vertrauen in eine behauptete Spieler ID.

## Ablauf der Logins

| Fall | Was passiert | Nachweis |
| :--- | :--- | :--- |
| Neues Google Konto | Google über Neon Auth, Rückkehr auf `/auth/callback`, `proxy.ts` tauscht den einmaligen `neon_auth_session_verifier` gegen das Session Cookie (SDK Middleware). `POST /api/account` legt ein neues Spielkonto mit neuer zufälliger UUID an, danach Profil wählen. | Session bei Neon Auth geprüft |
| **Altes Google Konto (3)** | Gleich wie oben. Der Server liest mit der Session des Spielers `list-accounts` bei Neon Auth, nimmt den Google `sub` und sucht ihn in `legacy_identities`. Treffer: der Login wird an die **alte** Konto UUID gebunden (`legacy-google`). | Google `sub`, von Neon Auth verifiziert, gleich dem alten Supabase `sub` |
| Neues Konto mit Benutzername | `POST /api/register`: der Server legt bei Neon Auth einen Login mit erzeugter Adresse `p-<zufall>@players.goal-clicker.vercel.app` an, bindet ihn an ein neues Spielkonto und legt das Profil an. Schlägt danach etwas fehl, wird der Login wieder gelöscht. | Server erzeugt den Login selbst |
| Anmelden mit Benutzername | `POST /api/login`: der Server kennt die Adresse hinter dem Benutzernamen und meldet bei Neon Auth an. Die Adresse erreicht den Browser nie. | Passwort bei Neon Auth |
| **Altes Benutzername Konto (6)** | Der Spieler meldet sich ganz normal an. Hat das Konto noch keinen Neon Login, prüft der Server das Passwort einmal bei Supabase (Brücke), öffnet ein kurzes Übernahmefenster (10 Minuten), legt den Neon Login mit **demselben Passwort** an und bindet ihn in einer Transaktion an die alte Konto UUID (`legacy-password`). Ab dann ist es ein normaler Neon Login. | Altes Passwort bei Supabase, Antwort gehört genau zu dieser Konto UUID |
| Notfall: Besitzercode | Ist das Passwort vergessen oder Supabase weg: `scripts/migration/issue-recovery-code.mts` erzeugt einen Code für genau ein Konto (rund 99 Bit, 24 Stunden, einmalig, nur der Hash wird gespeichert). Der Spieler wählt unter *Ich habe einen Wiederherstellungscode* ein neues Passwort (`owner-code`). | Code vom Besitzer, persönlich übergeben |

Was **nie** als Nachweis gilt: E-Mail Adresse, Benutzername, Anzeigename, eine vom Browser behauptete Kennung oder das Wissen um eine Spieler ID. Ein Neon Login mit Passwort, den nicht dieser Server angelegt und gebunden hat, bekommt kein Konto (`IDENTITY_UNBOUND`). Damit läuft auch der Angriff ins Leere, bei dem jemand vorab mit der Gmail Adresse eines anderen ein Passwort Konto anlegt und hofft, dass dessen Google Login daran gehängt wird.

### Einmal binden, nie überschreiben

* `auth_identities` hat zwei eindeutige Schlüssel: (`issuer`, `subject`) und (`account_id`, `issuer`). Gleichzeitige Versuche binden höchstens einmal, ein schon übernommenes Konto kann kein zweiter Login nehmen (`ACCOUNT_ALREADY_CLAIMED`).
* `issuer` ist die Neon Auth URL des Branches. Ein Staging Login öffnet deshalb nie ein Produktionskonto.
* Eine Übernahme ändert nichts an `profiles`, `cloud_saves`, `player_accounts` oder `coop_rooms`. Ein bestehendes Profil wird nie ersetzt (`PROFILE_EXISTS`).
* Kann Neon Auth die Logins nicht liefern, gibt es einen Fehler, **nie** ein leeres neues Konto.
* Die Übernahme einer Passwort Anmeldung ist wiederholbar: die erzeugte Zieladresse ist pro Konto fest. Bricht ein Versuch nach dem Anlegen des Neon Logins ab, meldet sich der nächste Versuch bei genau diesem Login an und bindet ihn. Zehn gleichzeitige Versuche ergeben einen Login und eine Bindung (getestet).
* Ein verbrauchtes Übernahmefenster lässt sich nicht erneut verwenden; ein abgelaufenes auch nicht. Codes gelten nur für ihr Konto und nur einmal.

### Google verknüpfen

Ein Benutzername Konto kann Google verknüpfen (`linkSocial`, Rückkehr über `/auth/callback?link=google`). Der Server prüft danach, ob dieser Google Login der alte Login eines **anderen** Originalkontos ist; dann wird er sofort wieder gelöst und das Spiel meldet *vergeben*. Neon Auth selbst verhindert, dass ein Google Konto an zwei Logins hängt.

### Konto löschen (Löschauftrag)

Neons Managed Better Auth bietet **keine Selbstlöschung** an (`delete-user` antwortet 404, auf Staging geprüft). Entscheid des Besitzers vom 2. November 2026: Löschauftrag.

1. Das Spiel löscht Profil, Spielstand, Spieler Verknüpfung, importierte alte Logins und Übernahmezustand in einer Transaktion und **sperrt** den Login (`auth_identities.deleted_at`). Welten bleiben für die anderen Spieler.
2. Alle Sessions des Logins werden bei Neon Auth beendet (`revoke-sessions`), die Cookies gelöscht.
3. Die Antwort sagt genau das (`dataDeleted: true`, `loginDeleted: false`, Status 202) und das Spiel zeigt: *Profil und Spielstand sind gelöscht. Dein Login ist gesperrt und wird vom Besitzer des Spiels endgültig entfernt.* Es behauptet nie, der Login sei weg.
4. Ein gesperrter Login öffnet nichts mehr und legt kein neues Konto an (Google Anmeldung zeigt *Konto gelöscht*, der Benutzername existiert nicht mehr).
5. Der Besitzer entfernt den Login: `DATABASE_URL=<direkt> NEON_AUTH_BASE_URL=<…> npx tsx scripts/migration/finish-account-deletions.mts` listet die gesperrten Logins mit dem Befehl `neon neon-auth user delete <id>`; danach entfernt `--finish` die Markierung jener Logins, die in `neon_auth."user"` nicht mehr vorkommen. Gleich werden halb angelegte Logins einer abgebrochenen Registrierung behandelt (`failed-registration`).
6. Sollte Neon Auth später selbst löschen können, schliesst das Spiel die Löschung sofort ab (`loginDeleted: true`).

### Sessions

* Jede API Route prüft das Session Cookie selbst bei Neon Auth (`/get-session`). Pro Server Instanz wird ein geprüftes Ergebnis höchstens 30 Sekunden wiederverwendet (`AUTH_SESSION_CACHE_SECONDS`, maximal 60). Alles, was Daten anlegt, bindet oder löscht, fragt Neon Auth immer neu (`fresh`). Ein widerrufener, gelöschter oder gesperrter Login ist dort sofort und sonst nach spätestens 30 Sekunden draussen.
* Das signierte Session Cache Cookie des SDK (`session_data`) wird serverseitig nicht als Nachweis verwendet.
* Neon Auth nicht erreichbar heisst *bitte gleich nochmal* (503), nicht *abgemeldet*.
* Abmelden: `POST /auth/signout` meldet bei Neon Auth ab und löscht alle Neon Cookies im Browser.

### Schutz

* **CSRF:** Alle schreibenden Konto Endpunkte und der Auth Proxy verlangen dieselbe Herkunft (`Origin`). Cookies sind `Secure`, `HttpOnly`, `SameSite=Lax`.
* **Auth Proxy** `/api/auth/[...path]`: nur die Aufrufe, die das Spiel braucht (`get-session`, `sign-in/social`, `link-social`, `list-accounts`, `unlink-account`, `change-password`, `sign-out`, Sessions). Registrieren und Anmelden mit E-Mail, E-Mail ändern und Benutzer löschen laufen nur über die eigenen Endpunkte.
* **Rate Limits:** Login, Registrierung und Wiederherstellung zählen zusätzlich in PostgreSQL (`rate_limits`), also über alle Netlify Instanzen, pro Adresse und pro Benutzername. Die übrigen Grenzen bleiben im Speicher der Instanz.
* **Client Adresse auf Netlify:** nur `x-nf-client-connection-ip`, die Netlify selbst setzt. Den Anfang von `x-forwarded-for` kann ein Client fälschen.
* **Aufzählung:** falscher Benutzername und falsches Passwort ergeben dieselbe Antwort. Die erzeugten Login Adressen verlassen den Server nicht mehr (früher lieferte `/api/login` sie aus).

## Vorübergehende Brücke zu Supabase

Gekennzeichnet in `app/auth/legacy-bridge.ts`, `app/api/recovery/route.ts`, `app/auth/recovery-code.ts`, Tabellen `account_recovery` und `recovery_codes`.

Abhängigkeiten zur Laufzeit: `LEGACY_SUPABASE_URL` und `LEGACY_SUPABASE_PUBLISHABLE_KEY` (öffentlicher Schlüssel) des Projekts `iocdsjgmgkqdkojmciyx`, dessen Auth Dienst laufen muss. **Supabase Free pausiert Projekte nach etwa einer Woche ohne Nutzung.** Solange Konten offen sind, das Projekt aktiv halten oder auf Besitzercodes ausweichen.

**Abschalten, sobald eines davon zutrifft:**

1. `scripts/migration/verify-accounts.mts` zeigt *6 von 6* Benutzername Konten (und 3 von 3 Google) als übernommen, oder
2. der Besitzer entscheidet, die übrigen Konten nur noch per Besitzercode zu übernehmen.

Dann: `LEGACY_SUPABASE_*` in Netlify entfernen, neu deployen (die Anmeldung meldet bei nicht übernommenen Konten *RECOVERY_UNAVAILABLE*), nach weiteren 30 Tagen ohne offene Konten die Brücke im Code entfernen. Das Supabase Projekt bleibt als Sicherung bestehen, bis eine verschlüsselte, getestete Sicherung ausserhalb aller Anbieter existiert.

## Datenbank

* **Migration 0007** (`drizzle/0007_neon_auth_identities.sql`) legt nur neue Tabellen an und ist idempotent. **Auf Neon gibt es kein Drizzle Journal** (`drizzle.__drizzle_migrations` fehlt auf `migration-staging`, geprüft am 2. November 2026). `npm run db:migrate` würde dort 0000 erneut ausführen und scheitern. Deshalb 0007 direkt einspielen: `psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/0007_neon_auth_identities.sql`.
* **Alte Logins importieren:** `LEGACY_DATABASE_URL=<Supabase> TARGET_DATABASE_URL=<Neon direkt> npx tsx scripts/migration/import-legacy-identities.mts --dry-run`, danach ohne `--dry-run`. Übernimmt nur Konto UUID, Anbieter und Google `sub` (bzw. die UUID bei Passwort Konten), keine Mails, keine Hashes. Bricht ab, wenn ein Konto im Ziel kein Profil oder keinen Spielstand hat.
* **Laufzeitrolle:** `scripts/migration/runtime-role.sql` legt `goal_clicker_app` an (Login, kein BYPASSRLS, eine Policy pro Tabelle, kein DDL, `legacy_identities` nur lesen und löschen). Passwort danach ausserhalb des Repos setzen. Lokal geprüft: App Operationen gehen, `create table` und Schreiben in `legacy_identities` werden verweigert. `neondb_owner` umgeht RLS und bleibt nur für Migrationen und Skripte.
* **Pooling:** `DATABASE_URL` auf den `-pooler` Host des Branches (Transaktionsmodus) mit `?sslmode=require`. `prepare: false` und `fetch_types: false` bleiben. Pro Instanz höchstens `DATABASE_POOL_MAX` Verbindungen (Standard jetzt 3, maximal 10), Leerlauf schliesst nach 20 Sekunden, damit Neon pausieren kann. **Die Erreichbarkeit des Poolers ist noch nicht geprüft** (die API meldet `pooler_enabled=false`, der Pooler Host existiert).
* **Prüfbericht:** `DATABASE_URL=<…> NEON_AUTH_BASE_URL=<…> npx tsx scripts/migration/verify-accounts.mts` zeigt nur Anzahlen und Prüfsummen (`to_jsonb`, unabhängig von der Spaltenreihenfolge), Weltgrössen und den Übernahmestand. Gegen Supabase, Staging und Produktion laufen lassen und vergleichen.
* Neon Data API, Realtime und Object Storage bleiben aus bzw. ungenutzt.

## Umgebungsvariablen (nur Namen)

| Name | Wo | Zweck |
| :--- | :--- | :--- |
| `NEON_AUTH_BASE_URL` | Netlify pro Kontext, lokal | Auth URL **des passenden Branches** (Staging oder Produktion) |
| `NEON_AUTH_COOKIE_SECRET` | Netlify pro Kontext, lokal | mindestens 32 zufällige Zeichen, pro Umgebung verschieden |
| `DATABASE_URL` | Netlify pro Kontext, lokal | Pooler URL desselben Branches, Rolle `goal_clicker_app` |
| `DATABASE_POOL_MAX` | optional | Verbindungen pro Instanz (3) |
| `AUTH_SESSION_CACHE_SECONDS` | optional | Session Wiederverwendung pro Instanz (30, maximal 60) |
| `LEGACY_SUPABASE_URL`, `LEGACY_SUPABASE_PUBLISHABLE_KEY` | Netlify, **vorübergehend** | Brücke für die alten Passwörter |
| `AUTH_REQUIRED` | optional | `1` verweigert anonymes Spiel auch ausserhalb eines Hostings |

Keine davon beginnt mit `NEXT_PUBLIC_`. Der Browser erfährt beim Build nur `NEXT_PUBLIC_AUTH_MODE` (`neon`, `misconfigured` oder leer), gesetzt in `next.config.ts`. Ein Build auf Netlify ohne vollständige Auth Werte zeigt den Login mit Hinweis statt des Spiels, und der Server verweigert.

## Daten im Browser beim Adresswechsel

`localStorage` wandert nicht von der alten Vercel Adresse nach `goalglicker.netlify.app`. Das ist für angemeldete Spieler kein Verlust: Der Spielstand liegt im Profil (`cloud_saves`), und ein leerer Browser übernimmt immer den Cloud Stand (`planInitialSync` ergibt `use-cloud`). Der Server lehnt zusätzlich jede erste Speicherung (`baseVersion 0`) ab, solange schon ein Spielstand existiert, und ein leerer lokaler Stand wird nie hochgeladen. Der Service Worker speichert keine `/api/` oder `/auth/` Antworten. Nur ein Gast Spielstand, der nie in einem Konto war, bleibt im alten Browser; dafür gibt es bewusst keinen automatischen Weg.

## Netzverkehr und Free Plan

**Umgesetzt:**

* Unveränderter Cloud Spielstand wird in SQL entschieden (`getCloudSaveSince`): statt des ganzen Spielstands kommen nur die Metadaten aus der Datenbank. Gemessen lokal: 120'224 Bytes vorher, 148 Bytes nachher pro Abfrage; echter Durchschnitt in Supabase 156'924 Bytes, Maximum 446'628 Bytes.
* Session Prüfung wird pro Instanz 30 Sekunden wiederverwendet: statt bei jeder Abfrage (alle 1,5 Sekunden) höchstens zwei Anfragen pro Minute und Spieler an Neon Auth.
* Wartende Welt ohne Eingabe seit 30 Sekunden: Abfrage alle 4 statt 1,5 Sekunden, jede Eingabe stellt sofort zurück. Etwa 62 Prozent weniger Anfragen in diesem Zustand (Rechnung, nicht gemessen). Der Live Tick (1,5 Sekunden) bleibt unverändert, weil er die Spielsimulation treibt.
* Weniger Verbindungen pro Instanz (3 statt 5).
* Bestehend und erhalten: Hintergrund Tabs fragen nicht ab, `featuresKey` (md5 in PostgreSQL), leichte Abfragen ohne Features und Backup, bedingtes Laden des Backups, gzip.

**Gemessen** (lokal, `scripts/migration/measure-traffic.mts`, Route Handler direkt gegen PostgreSQL 16, ohne Netzwerk, neue Welt mit leeren Features):

| Anfrage | JSON | gesendet (gzip) | Serverzeit Median |
| :--- | ---: | ---: | ---: |
| Welt lesen, voll | 15'490 B | 2'698 B | 5,4 ms |
| Welt lesen, unverändert (`featuresKey`) | 1'178 B | 521 B | 4,4 ms |
| Weltenliste | 1'141 B | 507 B | 2,5 ms |
| Live Tick, unverändert | 1'178 B | 521 B | 4,2 ms |
| Klick | 1'230 B | 551 B | 6,3 ms |

Echte Welten (Supabase, gelesen am 2. November 2026): Features im Schnitt 302'523 Bytes, maximal 572'216 Bytes, Backup im Schnitt 303'016 Bytes. Jede Änderung der Features schickt das einmal aus der Datenbank zu jedem anderen Spieler der Welt.

**Schätzung, nicht gemessen** (Netlify Free: 300 Credits, 15 pro Produktionsdeploy, 2 pro 10'000 Anfragen, 20 pro GB, 10 pro GB Stunde; Neon Free: 100 CU Stunden, 5 GB Transfer, 1 GB Speicher; beide am 2. November 2026 auf den Preisseiten bestätigt). Annahmen: ein sichtbarer Live Spieler macht rund 3'000 Anfragen pro Stunde (Tick plus Klicks), 40 ms abgerechnete Laufzeit bei 1024 MB, rund 1 KB pro Antwort plus gelegentliche Feature Antworten.

| Posten pro aktiver Multiplayer Spielerstunde | Credits |
| :--- | ---: |
| Anfragen (3'000) | 0,60 |
| Rechenzeit (0,033 GB Stunden) | 0,33 |
| Bandbreite (rund 4 MB) | 0,08 |
| **Summe** | **rund 1,0** |

Von 300 Credits gehen bei vier Produktionsdeploys 60 ab, mit 25 Prozent Reserve bleiben rund 180: **etwa 180 Multiplayer Spielerstunden pro Monat, also rund 6 pro Tag** (zum Beispiel drei Spieler je zwei Stunden). Einzelspieler kostet ein Vielfaches weniger (eine Speicherung pro Minute). Neon ist dabei nicht die Grenze: rund 10 MB Datenbank Transfer pro Spielerstunde ergibt Platz für etwa 500 Stunden, und 100 CU Stunden bei 0,25 CU erlauben rund 400 wache Stunden. Diese Zahlen müssen auf Staging mit echten Welten gemessen werden. Grösste Hebel danach: Funktionsspeicher von 1024 auf 512 MB (halbiert die Rechenzeit Credits, falls Netlify das erlaubt) und ein langsamerer Live Tick bei Untätigkeit (berührt die Simulation, nur nach eigener Prüfung).

## Tests

| Befehl | Was |
| :--- | :--- |
| `npm run test:unit` | darunter `tests/neon-migration.test.ts` (alle neun Originalkonten, Konflikte, Gleichzeitigkeit, Replay, Wiederholung, Besitzercode, fehlende Konfiguration, Trennung der Konten), `tests/auth.test.ts`, `tests/account-profile.test.ts`, `tests/rate-limit.test.ts` |
| `npm run test:db` | Bindung und Übernahme unter Gleichzeitigkeit, Löschung, SQL Versionsprüfung, geteilte Rate Limits, RLS auf allen neuen Tabellen, gegen echtes PostgreSQL |
| `npm run test:account` | Chromium gegen einen Nachbau von Neon Auth (`tests/browser/mock-neon-auth.ts`, ohne Selbstlöschung wie das Original): Registrieren, Anmelden, zwei Geräte, Profil, Passwort ändern, Löschauftrag, gesperrter Google Login nach dem Löschen, Gast, **altes Passwort Konto, altes Google Konto über den echten SDK Verifier Austausch**, neues Google Konto, widerrufene Session, zwei Konten in einer Welt mit gleichzeitigen Klicks und Verweigerung fremder Spieler IDs |

Echte Neon Auth, echte Google Anmeldung, der Pooler und Netlify sind damit **nicht** geprüft; das gehört auf das Staging Deployment.

### Nachweis vom 2. November 2026

Lokal im Cloud Container (Node.js 22.23, PostgreSQL 16.10 als Scratch Datenbank, Chromium 1243). Typecheck, Lint, Audit, Datenbank und Browser Tests auf Commit `634727d`; `npm test` nach der Korrektur einer Testerwartung (`GET /api/account` meldet jetzt `mode`) erneut auf `8d98022`, der Anwendungscode ist zwischen beiden gleich.

| Befehl | Ergebnis |
| :--- | :--- |
| `npm run typecheck` | ohne Fehler |
| `npm run lint` | ohne Fehler und Warnungen |
| `npm audit --omit=dev --audit-level=high` | ohne Befund |
| `npm test` (Build, Unit, `next start`) | 446 + 42 + 3 Tests bestanden (auch nach dem Löschauftrag) |
| `npm run test:db` | 31 von 31, nach dem Löschauftrag 32 von 32 |
| `npm run test:browser` | 23 von 23 |
| `npm run test:account` | 14 von 14, nach dem Löschauftrag 15 von 15 |
| `scripts/migration/import-legacy-identities.mts` gegen simulierte Quelle | Abbruch bei fehlendem Spielstand, Probelauf, Import, Wiederholung ohne Änderung |
| `scripts/migration/runtime-role.sql` zweimal, dann App als `goal_clicker_app` | App Operationen gehen, DDL und Schreiben in `legacy_identities` verweigert |

### Staging vorbereitet (2. November 2026, mit Freigabe des Besitzers)

Auf `migration-staging` über die Neon Verbindung:

* Vorher festgehalten: 10:00:52 UTC, WAL Position `0/1DA8100` (Neon erlaubt keinen Snapshot eines Nicht Root Branches; Rückweg über Wiederherstellung auf diesen Zeitpunkt oder Entfernen der fünf neuen Tabellen).
* Migration 0007 eingespielt (eine Transaktion).
* Alte Logins importiert: 9 (Google 3, Benutzername 6), jedes Konto hat Profil und Spielstand; in einer Transaktion mit Prüfung, sonst Abbruch.
* Rolle `goal_clicker_app` angelegt, **noch ohne Passwort** (setzt der Besitzer), 10 Policies, RLS auf 10 Tabellen, kein BYPASSRLS.
* Prüfsummen (`to_jsonb`, md5) von `coop_rooms`, `player_accounts`, `profiles`, `cloud_saves` und `solo_travel` sind auf Supabase, Neon Staging (vor und nach den Änderungen) und Neon Produktion identisch. Letzter Schreibvorgang in Supabase: 30. Oktober 2026.

Gegen die **echte** Neon Auth von Staging mit den Server Funktionen dieses Codes (Wegwerf Login mit erzeugter Adresse, ohne Spielkonto):

| Aufruf | Ergebnis |
| :--- | :--- |
| `sign-up/email` | ok, Cookie `__Secure-neon-auth.session_token`, weitergegeben als `HttpOnly; Secure; SameSite=Lax` |
| zweites `sign-up/email` mit derselben Adresse | 422 `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`, im Code als „exists“ erkannt |
| `get-session` | Session gültig, Benutzer ID und Adresse stimmen |
| `list-accounts` | `providerId: credential`, `accountId` = Benutzer ID |
| `sign-in/email` falsch / richtig | 401 `INVALID_EMAIL_OR_PASSWORD` / ok, gleicher Benutzer |
| `change-password` mit falschem aktuellem Passwort | 400 `INVALID_PASSWORD` |
| gefälschtes Session Cookie | abgelehnt |
| `sign-out` | danach ist die Session ungültig |
| **`delete-user`** | **404, mit und ohne Passwort: Selbstlöschung gibt es in Managed Better Auth nicht.** Der Code meldet korrekt „nicht gelöscht“ und löscht nichts. Löschen geht nur als Admin (Neon API `/auth/users`, Neon CLI `neon neon-auth user delete`). |

Zwei Wegwerf Logins dieser Probe liegen noch in Staging Auth (ohne Spielkonto, ohne Zuordnung).

Vorher auf `migration-staging` nur gelesen (Neon MCP): 9 Profile, 9 Spielstände, 9 Verknüpfungen, 3 Welten, 39 Reisebelege, kein Drizzle Journal, 0007 noch nicht eingespielt, Neon Auth ohne Trusted Origins, Google mit geteilten Zugangsdaten, E-Mail Registrierung erlaubt, Pooler Host vorhanden bei `pooler_enabled=false`.

## Anbieter Schritte (ChatGPT Work oder Besitzer)

1. **Staging Deployment:** ein geschütztes Netlify Deployment (Branch Deploy des Branches dieser Arbeit), dessen Umgebungsvariablen **nur** auf `migration-staging` zeigen: `DATABASE_URL` (Pooler von `ep-long-shadow-b4ngl6x8`), `NEON_AUTH_BASE_URL` (Staging Auth), eigenes `NEON_AUTH_COOKIE_SECRET`, `LEGACY_SUPABASE_*`. Prüfen, dass der Kontext diese Werte wirklich bekommt (Branch Deploys erben nicht automatisch). Die tatsächlich von Netlify gemeldete Adresse verwenden.
2. **Trusted Origins** in Neon Auth von Staging: genau diese Staging Adresse. Produktion später nur `https://goalglicker.netlify.app`.
3. **0007 und Import** auf Staging: siehe [Datenbank](#datenbank), dann `verify-accounts.mts`.
4. **Laufzeitrolle** auf Staging anlegen, Passwort setzen, `DATABASE_URL` auf diese Rolle.
5. **Pooler prüfen:** eine Verbindung über den `-pooler` Host mit `select 1`, dann `npm run test:db` gegen eine leere Scratch Datenbank (nicht Staging) über den Pooler.
6. **Google:** geteilte Neon Zugangsdaten reichen für Staging. Für die Produktion einen eigenen OAuth Client, Weiterleitungs URI `{NEON_AUTH_BASE_URL}/callback/google` pro verwendetem Branch, alte Supabase Weiterleitung bestehen lassen.
7. Staging Tests von Hand: die 22 Punkte aus dem Auftrag, mindestens ein Google und ein Passwort Originalkonto echt übernehmen, zweites Gerät, Multiplayer mit zwei Konten.
8. **Verschlüsselte Sicherung** ausserhalb der Anbieter (`pg_dump` von Supabase und Neon, verschlüsselt, Wiederherstellung einmal in eine Scratch Datenbank getestet), Snapshot `snap-crimson-dawn-b4uf6sbi` einmal testweise in einen neuen Branch wiederherstellen.

## Freigabe für die Produktion

Erst umstellen, wenn alles erfüllt ist: neueste Datenkopie geprüft (`verify-accounts` auf Supabase und Neon Produktion gleich), verschlüsselte und wiederherstellbare Sicherung, alle neun Konten auf Staging übernehmbar, Staging Login, Multiplayer und Spielstand Tests bestanden, keine kritischen Sicherheitsbefunde, kein bekannter Datenverlust Fall, Pooler geprüft, Umgebung geprüft, Verbrauch gemessen, Wiederherstellung dokumentiert, **und der Besitzer stimmt ausdrücklich zu.**

## Umstellung der Produktion

1. Supabase in den Nur Lesen Betrieb bringen oder das alte Deployment abschalten, damit keine neuen Schreibvorgänge mehr dort landen. Zeitpunkt notieren.
2. `verify-accounts.mts` gegen Supabase und Neon `production`. Weichen die Prüfsummen ab, die geänderten Zeilen gezielt von Supabase nach Neon übernehmen (nur Zeilen, die nach dem Kopieren in Supabase geändert wurden), nie Staging Daten nach Produktion.
3. Neon Snapshot von `production` anlegen.
4. 0007 auf `production` einspielen, alte Logins importieren, Laufzeitrolle anlegen.
5. Netlify Produktionsvariablen setzen (Produktions Branch, eigenes Cookie Secret, Trusted Origin `https://goalglicker.netlify.app`, eigener Google Client).
6. Deploy des geprüften Commits auf `main`, Smoke Test: Login Google und Passwort, ein Originalkonto, Multiplayer.
7. Netlify Zugangsschutz erst danach und nur mit Zustimmung des Besitzers entfernen.

## Zurück, wenn etwas schiefgeht

* **Vor Schritt 6 der Umstellung:** nichts zu tun, die alte Umgebung läuft weiter.
* **Nach der Umstellung, ohne neue Schreibvorgänge:** vorheriges Netlify Deployment wieder veröffentlichen (Netlify *Publish deploy*), `auth_identities` bleibt harmlos liegen.
* **Nach neuen Schreibvorgängen auf Neon:** **nicht** auf den alten Supabase Stand zurückgehen. Neon Branch vom Snapshot aus Schritt 3 nur nach Abgleich der seither geänderten Zeilen wiederherstellen; Spielstände über `version`, Welten über `shared_state_version` vergleichen und jeweils den neueren behalten.
* Logins in Neon Auth gehen bei einem Rücksprung auf die alte Umgebung nicht verloren; die Spielkonten sind dieselben UUIDs.

## Offene Risiken

* **Login Löschung braucht den Besitzer:** `delete-user` gibt es in Managed Better Auth nicht. Umgesetzt ist der Löschauftrag (siehe oben); bis der Besitzer `finish-account-deletions.mts` laufen lässt, bleibt der gesperrte Login bei Neon Auth bestehen.
* Die übrigen Neon Auth Antworten sind auf Staging geprüft (siehe Nachweis); Google und der Verifier Austausch noch nicht.
* Google `sub` ist über OAuth Clients hinweg gleich (Google verwendet keine paarweisen Kennungen); mit den geteilten Neon Zugangsdaten auf Staging zu bestätigen.
* Neon Auth erlaubt die Registrierung mit E-Mail direkt an der Auth URL (`allow_sign_up`), unabhängig vom Proxy. Solche Logins bekommen kein Konto; im schlimmsten Fall blockiert jemand die Google Anmeldung einer Adresse, die er vorher selbst registriert hat (Verfügbarkeit, nicht Übernahme). Abschalten geht nicht, weil der Server selbst über diesen Endpunkt registriert.
* Neon Auth sieht alle Anfragen von den Netlify Servern aus; seine eigenen Rate Limits pro Adresse greifen deshalb für alle Spieler gemeinsam (Eigenschaft des SDK Proxys). Die eigenen Limits in PostgreSQL sind pro Spieler.
* Unterschiedliche Antwortzeit bei unbekanntem und bekanntem Benutzernamen (Zeitmessung). Benutzernamen sind in Welten sichtbar, der Gewinn ist klein.
* Supabase Free pausiert; dann bleibt nur der Besitzercode.
* Die Kostenschätzung oben ist eine Rechnung, keine Messung auf Netlify.
* `@neon/auth` 0.8.2 ist vom 30. Oktober 2026, also sehr neu.
