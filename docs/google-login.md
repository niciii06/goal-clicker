# Login einrichten: Google oder Benutzername und Passwort (Neon Auth)

Ohne Login startet das Spiel nicht, sobald Neon Auth eingerichtet ist. Angemeldet wird über Neon Auth (Managed Better Auth), wahlweise mit Google oder mit Benutzername und Passwort. Es werden nie Mails verschickt. Jedes Konto hat ein Profil mit einem Benutzernamen, den es nur einmal gibt, und einem Anzeigenamen. Wie die neun Konten aus Supabase übernommen werden: [neon-netlify-migration.md](neon-netlify-migration.md).

## 1. Neon Auth pro Branch

In der Neon Console: Projekt `sparkling-sea-00072876` → Branch → *Auth* → *Configuration*.

* **Auth URL** kopieren: das ist `NEON_AUTH_BASE_URL` für die Umgebung, die auf diesen Branch zeigt.
* **Trusted origins:** genau die Adressen, von denen das Spiel geladen wird. Staging: die Adresse des Staging Deployments, wie Netlify sie meldet. Produktion: `https://goalglicker.netlify.app`. `localhost` nur für Entwicklung.
* **Email and password:** eingeschaltet, ohne Bestätigungsmail (die Adressen sind erzeugt und empfangen nichts).
* **Google:** für Staging genügen die geteilten Neon Zugangsdaten. Für die Produktion einen eigenen OAuth Client.

## 2. Eigener Google OAuth Client (Produktion)

1. In der [Google Cloud Console](https://console.cloud.google.com/) *Anmeldedaten* → *OAuth Client ID* → *Webanwendung*.
2. **Autorisierte Weiterleitungs URI:** `{NEON_AUTH_BASE_URL}/callback/google`, für jeden verwendeten Branch. Die alte Supabase Weiterleitung `https://iocdsjgmgkqdkojmciyx.supabase.co/auth/v1/callback` bleibt stehen, solange die alte Umgebung als Rückweg dient.
3. Client ID und Secret nur in Neon Auth eintragen, nie in Netlify oder im Repository.

Der Google `sub` eines Kontos ist bei allen OAuth Clients gleich; darüber werden die drei alten Google Konten erkannt.

## 3. Netlify

`NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (mindestens 32 zufällige Zeichen, `openssl rand -base64 32`) und `DATABASE_URL` pro Kontext setzen, danach neu deployen. Ohne diese Werte zeigt das Spiel den Login mit dem Hinweis, dass er nicht eingerichtet ist, und der Server verweigert Multiplayer und Konto Aufrufe.

## Benutzername und Passwort

Neon Auth braucht für ein Passwort Konto eine E-Mail Adresse. Der Server erzeugt deshalb `p-<zufall>@players.goal-clicker.vercel.app` und legt den Login selbst an; die Adresse verlässt den Server nie.

* **Registrieren** (`POST /api/register`): prüft Benutzername, Anzeigename und Passwort (8 bis 72 Zeichen), legt Login, Spielkonto und Profil an und meldet den Browser an.
* **Anmelden** (`POST /api/login`): der Server meldet mit der Adresse hinter dem Benutzernamen bei Neon Auth an. Falsche Namen und falsche Passwörter sehen gleich aus. Ein altes Konto aus Supabase wird dabei einmalig übernommen.
* **Passwort ändern:** im Konto Fenster (👤), mit dem aktuellen Passwort; andere Geräte werden abgemeldet.
* **Passwort vergessen:** gibt es nicht per Mail. Der Besitzer kann mit `scripts/migration/issue-recovery-code.mts` einen einmaligen Code für ein noch nicht übernommenes Originalkonto ausstellen.

### Google verknüpfen

Ein Benutzername Konto kann im Konto Fenster Google verknüpfen. Danach öffnen beide denselben Spielstand. Rückkehr über `/auth/callback?link=google`, das Spiel meldet `?google=verknuepft`, `vergeben`, `abgebrochen` oder `fehler`. Ein Google Konto, das schon zu einem anderen Spielerkonto gehört (auch als alter Login eines Originalkontos), wird nicht verknüpft.

## Was der Code macht

| Teil | Datei |
| :--- | :--- |
| Login Pflicht, Formulare, Wiederherstellungscode, Profil anlegen | `app/account-gate.tsx` |
| Konto Fenster, Passwort ändern, Google verknüpfen | `app/account-panel.tsx` |
| Browser: Google über das SDK, Benutzername über den Server | `app/auth/browser.ts` |
| Einstellungen, Fail Closed (`authMode`) | `app/auth/config.ts` |
| Session prüfen, Neon Auth Aufrufe, Cookies | `app/auth/server.ts`, `app/auth/neon-accounts.ts`, `app/auth/neon-sdk.ts` |
| Login → Spielkonto (Google Übernahme, neue Konten) | `app/auth/identity.ts` |
| Spieler ID des Kontos | `app/auth/player.ts`, `app/api/account/route.ts` |
| Vorübergehende Brücke und Besitzercodes | `app/auth/legacy-bridge.ts`, `app/auth/recovery-code.ts`, `app/api/recovery/route.ts` |
| Registrieren, Anmelden, Profil, Löschen, Cloud Spielstand | `app/account-api.ts` |
| Auth Proxy für das SDK (nur erlaubte Aufrufe) | `app/api/auth/[...path]/route.ts` |
| Rückkehr von Google, Verifier Austausch | `app/auth/callback/route.ts`, `proxy.ts` |
| Tabellen | `db/schema.ts`, `drizzle/0007_neon_auth_identities.sql` |

### Profil

* **Benutzername**: 3 bis 20 Zeichen, Buchstaben ohne Umlaute, Zahlen und `_`, eindeutig ohne Rücksicht auf Gross und Kleinschreibung, änderbar alle 30 Tage.
* **Anzeigename**: 2 bis 18 Zeichen, jederzeit änderbar, auch der Name in allen Welten.
* **Profil löschen**: zuerst der Login bei Neon Auth, dann Profil, Spielstand und Verknüpfungen. Welten bleiben für die anderen.

### Spielstand in der Cloud

Unverändert: `cloud_saves` pro Spielkonto mit `version` und `active_version`, Upload jede Minute und beim Verlassen, ein Gerät überschreibt nur die Version, die es geladen hat, ein nur passiv gespieltes Gerät überschreibt nie echten Fortschritt. Ein leerer Browser (zum Beispiel auf der neuen Adresse) übernimmt immer den Stand aus der Cloud.

## Tests

* `npm run test:unit`: `tests/neon-migration.test.ts`, `tests/auth.test.ts`, `tests/account-profile.test.ts`.
* `npm run test:db`: Bindung, Übernahme, Löschung und Spielstände gegen PostgreSQL, auch gleichzeitig.
* `npm run test:account`: Chromium gegen `tests/browser/mock-neon-auth.ts`, inklusive Übernahme beider Arten von Originalkonten. Braucht `TEST_DATABASE_URL`; `ACCOUNT_TEST_REUSE_BUILD=1` überspringt den Build.
