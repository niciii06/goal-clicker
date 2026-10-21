# Google Login einrichten (Supabase Auth)

Der Login läuft über Supabase Auth mit Google als Anbieter. Der Code ist fertig. Die folgenden Schritte kann nur der Besitzer erledigen, weil sie Konten und Geheimnisse betreffen. Platzhalter:

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

## Was der Code macht

| Teil | Datei |
| :--- | :--- |
| Login Button und Abmelden in der Kopfzeile | `app/account-panel.tsx` (`AccountChip`) |
| Start des Google Logins (PKCE) | `app/auth/browser.ts` |
| Rückkehr von Google, Code gegen Session Cookie tauschen | `app/auth/callback/route.ts` (`/auth/callback`) |
| Abmelden, Session beenden, Cookies löschen | `app/auth/signout/route.ts` (`POST /auth/signout`) |
| Session vor jeder Seite und API Anfrage auffrischen | `proxy.ts` |
| Token prüfen (Signatur, `getClaims`) | `app/auth/server.ts` |
| Spieler ID des Kontos bestimmen | `app/auth/player.ts`, `app/api/account/route.ts` |
| Verknüpfung Konto ↔ Spieler ID | Tabelle `player_accounts` (`db/schema.ts`, `drizzle/0001_player_accounts.sql`) |

### Spieler ID und bestehende Welten

Die bisherige Identität war **nicht** die E-Mail Adresse. Die Sites Version hat den ChatGPT Login nie verwendet (`app/chatgpt-auth.ts` war nirgends eingebunden). Jeder Browser hatte eine zufällige Spieler ID im `localStorage` (`goalClickerPlayerIdV3`), und Multiplayer Welten gehören dieser ID. In der Datenbank steht keine E-Mail Adresse. Eine automatische Zuordnung über die E-Mail ist deshalb nicht möglich.

Stattdessen gilt:

1. Beim **ersten Login** wird die Spieler ID dieses Browsers mit dem Google Konto verknüpft. Danach nutzt jedes Gerät mit demselben Google Konto diese Spieler ID und sieht dieselben Welten.
2. Wer den alten Spielstand als Datei mitbringt (Export auf der alten Seite, Import auf der neuen), bringt seine alte Spieler ID mit. Nach dem Import übernimmt das Konto diese ID, solange das Konto mit seiner bisherigen ID noch keine Welt hat. So hängen alte Welten am Google Konto.
3. Eine Spieler ID gehört höchstens einem Konto. Eine fremde, bereits verknüpfte ID kann nicht übernommen werden.
4. Multiplayer braucht einen Login. Der Einzelspieler funktioniert ohne Konto weiter, wie bisher nur im Browser gespeichert.
