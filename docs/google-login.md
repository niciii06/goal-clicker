# Login einrichten: Google oder Benutzername und Passwort (Supabase Auth)

Ohne Login startet das Spiel nicht, sobald Supabase eingerichtet ist. Angemeldet wird über Supabase Auth, wahlweise mit Google oder mit Benutzername und Passwort. Es werden nie Mails verschickt. Jedes Konto hat ein Profil: einen Benutzernamen, den es nur einmal gibt, und einen Anzeigenamen. Google Konten legen es nach dem ersten Login an, Konten mit Passwort beim Registrieren. Der Code ist fertig. Die folgenden Schritte kann nur der Besitzer erledigen, weil sie Konten und Geheimnisse betreffen. Platzhalter:

* `<projekt-ref>`: die Kennung des Supabase Projekts, zu sehen in der Projekt URL `https://<projekt-ref>.supabase.co`
* `<domain>`: die endgültige Adresse der Seite, zum Beispiel `goal-clicker.vercel.app` oder eine eigene Domain
* `<team>`: der Vercel Team oder Konto Name, der in Preview Adressen vorkommt (`goal-clicker-git-<branch>-<team>.vercel.app`)

## 1. Google OAuth Client anlegen

1. In der [Google Cloud Console](https://console.cloud.google.com/) ein Projekt wählen oder anlegen.
2. *APIs und Dienste* → *OAuth Zustimmungsbildschirm*: App Name (Goal Clicker), Support E-Mail, Bereiche `openid`, `email`, `profile`. Für alle Google Konten freigeben: Veröffentlichungsstatus *In Produktion*.
3. *Anmeldedaten* → *Anmeldedaten erstellen* → *OAuth Client ID* → Typ *Webanwendung*.
4. **Autorisierte JavaScript Quellen**:
   * `https://<domain>`
   * `http://localhost:3000` (lokale Entwicklung)
5. **Autorisierte Weiterleitungs URI** (genau diese eine, Google leitet immer zu Supabase zurück):
   * `https://<projekt-ref>.supabase.co/auth/v1/callback`
6. Client ID und Client Secret notieren. Das Secret gehört **nur** in Supabase, nicht in Vercel und nicht ins Repository.

## 2. Supabase

1. *Authentication* → *Sign In / Providers* → *Google*: aktivieren, Client ID und Client Secret eintragen, speichern.
2. *Authentication* → *URL Configuration*:
   * **Site URL**: `https://<domain>`
   * **Redirect URLs** (Zulassungsliste, auf diese Adressen darf Supabase nach dem Login zurückleiten):
     * `https://<domain>/auth/callback`
     * `https://*-<team>.vercel.app/auth/callback` (Vercel Preview Deployments)
     * `http://localhost:3000/auth/callback` (lokal)
3. *Project Settings* → *API Keys*: die **Publishable Key** (`sb_publishable_...`) kopieren. Ältere Projekte zeigen stattdessen den `anon` Key, der funktioniert ebenfalls. Den `service_role` bzw. `secret` Key braucht die App nicht.

## 3. Vercel Umgebungsvariablen

Unter *Project Settings* → *Environment Variables* für *Production* und *Preview* setzen:

| Name | Wert |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<projekt-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | die Publishable Key aus Schritt 2.3 |
| `DATABASE_URL` | Transaction Pooler URL aus Supabase (*Connect*), Port 6543, mit `?sslmode=require` |

Nach dem Setzen neu deployen, weil `NEXT_PUBLIC_` Werte beim Build in den Browser Code übernommen werden. Ohne diese Werte verweigert ein Vercel Deployment den Multiplayer mit "Der Login ist auf diesem Server nicht eingerichtet", statt unangemeldete Welten zuzulassen.

## 4. Benutzername und Passwort

Dafür ist in Supabase nichts einzustellen. Supabase Auth braucht für ein Passwort Konto eine E-Mail Adresse; das Spiel erzeugt deshalb beim Registrieren eine Adresse `p-<zufall>@players.goal-clicker.vercel.app`, an die nie eine Mail geht. Angelegt wird das Konto bereits bestätigt durch die Datenbankfunktion `goal_clicker_private.create_password_user` (siehe [docs/supabase-datenbank.md](supabase-datenbank.md)), deshalb bleibt *Confirm email* in Supabase eingeschaltet und es braucht keinen Mailversand.

* **Registrieren** (`POST /api/register`): prüft Benutzername, Anzeigename und Passwort (8 bis 72 Zeichen), legt Login und Profil an und gibt die erzeugte Adresse zurück. Der Browser meldet sich damit bei Supabase an.
* **Anmelden** (`POST /api/login`): liefert zum Benutzernamen die erzeugte Adresse, der Browser meldet sich damit und dem Passwort bei Supabase an. Das Passwort sieht nur Supabase, und die Begrenzung der Anmeldeversuche gilt pro Gerät.
* **Passwort ändern**: unter *Club & Mehr* → *Profil*.
* **Passwort vergessen** gibt es nicht, weil keine Mailadresse bekannt ist. Im Notfall kann der Besitzer im Supabase Dashboard unter *Authentication* → *Users* beim betroffenen Login ein neues Passwort setzen (die Adresse steht in `profiles.login_email`).

Ein späterer Login per E-Mail bräuchte einen eigenen Mailversand (eigene Domain mit einem Dienst wie Resend) und Mailvorlagen mit `{{ .Token }}`.

## Was der Code macht

| Teil | Datei |
| :--- | :--- |
| Login Pflicht, Login Formulare, Profil anlegen, Auswahl zwischen zwei Spielständen | `app/account-gate.tsx` |
| Name, Speicherstand und Abmelden in der Kopfzeile, Profil Einstellungen im Club Tab | `app/account-panel.tsx` (`AccountChip`, `ProfilePanel`) |
| Google Login (PKCE), Anmelden und Registrieren mit Benutzername, Passwort ändern | `app/auth/browser.ts` |
| Regeln für Benutzername und Anzeigename | `app/profile-rules.ts` |
| Registrieren, Anmelden, Profil und Cloud Spielstand API (`/api/register`, `/api/login`, `/api/profile`, `/api/profile/username`, `/api/save`) | `app/account-api.ts` |
| Spielstand mit der Cloud abgleichen | `app/cloud-sync.ts`, `app/cloud-save-rules.ts` |
| Rückkehr von Google, Code gegen Session Cookie tauschen | `app/auth/callback/route.ts` (`/auth/callback`) |
| Session vor jeder Seite und API Anfrage auffrischen | `proxy.ts` |
| Token prüfen (Signatur, `getClaims`) | `app/auth/server.ts` |
| Spieler ID des Kontos bestimmen | `app/auth/player.ts`, `app/api/account/route.ts` |
| Tabellen `player_accounts`, `profiles`, `cloud_saves` | `db/schema.ts`, `drizzle/` |

### Profil

* **Benutzername**: 3 bis 20 Zeichen, Buchstaben ohne Umlaute, Zahlen und `_`. Eindeutig ohne Rücksicht auf Gross und Kleinschreibung (`username_key`). Änderbar alle 30 Tage, nur die Gross und Kleinschreibung des eigenen Namens jederzeit. Ein alter Name wird nach der Änderung sofort wieder frei.
* **Anzeigename**: 2 bis 18 Zeichen, jederzeit änderbar. Er ist auch der Name in allen Multiplayer Welten.
* **Profil löschen** (Club & Mehr): löscht Profil, Cloud Spielstand, die Verknüpfung zur Spieler ID und den Login selbst. Multiplayer Welten bleiben für die anderen Spieler bestehen.
* Wer sich mit Benutzername und Passwort anmeldet, meldet sich nach einer Namensänderung mit dem neuen Namen an.

### Spielstand in der Cloud

Der Einzelspieler Spielstand (Spiel, Layout, Vibration) liegt pro Konto in `cloud_saves`. Vor dem Spielstart lädt das Spiel ihn in den Browser, danach wird jede Änderung alle 15 Sekunden, beim Wechsel in den Hintergrund und beim Schliessen hochgeladen. Jede Speicherung erhöht `version`; ein Gerät kann nur die Version überschreiben, die es geladen hat.

Sind zwei Geräte gleichzeitig offen, entscheidet, wo wirklich gespielt wird (Klick oder Tastendruck seit der letzten Speicherung):

* Ein Gerät, auf dem seither niemand etwas gemacht hat, übernimmt einen neueren Stand still, spätestens wenn sein Tab wieder in den Vordergrund kommt.
* Hat das andere Gerät nur passive Tore gesammelt (`active = false`), überschreibt das gespielte Gerät dessen Stand.
* Nur wenn auf beiden Geräten gespielt wurde, fragt das Spiel, welcher Stand bleiben soll.

Beim ersten Login auf einem Gerät mit eigenem Fortschritt fragt das Spiel ebenfalls, falls im Profil schon ein anderer Stand liegt. Beim Abmelden wird zuerst gespeichert und danach der Spielstand auf diesem Gerät entfernt.

### Spieler ID und bestehende Welten

Die bisherige Identität war **nicht** die E-Mail Adresse. Die Sites Version hat den ChatGPT Login nie verwendet (`app/chatgpt-auth.ts` war nirgends eingebunden). Jeder Browser hatte eine zufällige Spieler ID im `localStorage` (`goalClickerPlayerIdV3`), und Multiplayer Welten gehören dieser ID. In der Datenbank steht keine E-Mail Adresse. Eine automatische Zuordnung über die E-Mail ist deshalb nicht möglich.

Stattdessen gilt:

1. Beim **ersten Login** wird die Spieler ID dieses Browsers mit dem Konto verknüpft. Danach nutzt jedes Gerät mit demselben Konto diese Spieler ID und sieht dieselben Welten.
2. Wer den alten Spielstand als Datei mitbringt (Export auf der alten Seite, Import auf der neuen), bringt seine alte Spieler ID mit. Nach dem Import übernimmt das Konto diese ID, solange das Konto mit seiner bisherigen ID noch keine Welt hat. So hängen alte Welten am Konto.
3. Eine Spieler ID gehört höchstens einem Konto. Eine fremde, bereits verknüpfte ID kann nicht übernommen werden.

## Tests

* `npm run test:unit` enthält `tests/account-profile.test.ts` (Regeln, API, Synchronisationsentscheide).
* `npm run test:db` prüft Profile und Cloud Spielstände gegen PostgreSQL, auch gleichzeitige Zugriffe.
* `npm run test:account` baut eine eigene Kopie nach `.next-account` und spielt Registrieren, Anmelden mit falschem und richtigem Passwort, doppelte Benutzernamen, Profil Einstellungen, zwei Geräte und Abmelden im Browser durch. Statt Supabase Auth läuft dabei `tests/browser/mock-auth-server.ts`; weil die Testdatenbank die Funktion zum Anlegen von Logins nicht hat, registriert die App dort über die Auth API. Braucht `TEST_DATABASE_URL` und Chromium. `ACCOUNT_TEST_REUSE_BUILD=1` überspringt den Build.
