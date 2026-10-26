# Goal Clicker

Aktueller Spielcode mit Spielerpool, Saisons, Walkouts und Multiplayer. Release vom 16. Oktober 2026: Cup Auswärtsspiele mit neutralem Wembley Finale, Pfuschi/Di Certo, persistente Kader und Fabrizio Sperre, fünf Wechsel in drei Fenstern, feste Tor und Halbzeitpausen und entfernte manuelle Taktikauswahl.

* [Gameplay-, Reise- und Stadionupdate vom 19. Oktober 2026](docs/gameplay-travel-stadium-update.md)
* [Releasebericht und vollständige Prüfevidenz](docs/release-match-realism.md)
* [Projektwissen und Spielregeln (aus der ChatGPT Sites Zeit)](docs/chatgpt-sites-knowledge.md)
* [Konfigurationsreparatur und Sicherheitsprüfung](docs/config-security-repair.md)
* [Hosting auf Vercel mit Supabase und Login](HOSTING.md)
* [Datenbank und Datenübernahme](docs/supabase-datenbank.md)
* [Login einrichten (Google oder Benutzername), Profil und Cloud Spielstand](docs/google-login.md)

Verifikation: `npm run typecheck`, `npm run lint`, `npm test` (inklusive `next build`), `npm run test:db` mit einer Testdatenbank; ergänzend `npm run verify:physics`. Die frühere ChatGPT Sites Version hat eine eigene Historie; ein GitHub Push veröffentlicht keine neue Site Version.

Browser Prüfung: `npm run test:browser` startet den Produktionsbuild mit `next start` und prüft mit Chromium alle Tabs auf Desktop und Handy (Fehler, Überlauf, überlappender oder schwer lesbarer Text) sowie Combo, tägliche Prämie, Live Spiel und Pressekonferenz. Der GitHub Workflow führt sie nach `npm test` aus. `npm run test:account` spielt zusätzlich Login, Profil und Cloud Spielstand mit zwei Geräten durch (Ersatz für Supabase Auth, braucht eine Testdatenbank).

**Projektstruktur:** `app/page.tsx` enthält die App Komponente; Typen, Konstanten, Wirtschaft, Spielstand, Formatierung, Koop Hilfen und kleine Komponenten liegen in `app/game/`. `app/feature-data.ts` enthält die Spiellogik; Typen, Kataloge und Texte liegen in `app/features/` und werden von `feature-data.ts` unverändert weiter exportiert. Reiserouten (`app/route-cache/`) lädt der Browser erst nach dem Start, und er bekommt eine schlanke Kopie der FC 27 Indien Daten; beides regeln die `imports` mit der Bedingung `browser` in `package.json`.

**Adressen:** Jeder Reiter hat eine eigene Adresse: `/home`, `/spiele`, `/kader`, `/karriere`, `/packs`, `/packs/album`, `/club`, `/club/fabrizio`, `/club/missionen`, `/club/verlauf` (Liste in `app/tab-routes.ts`). Alle zeigen dieselbe Seite (Rewrites in `next.config.ts`), deshalb lädt ein Reiterwechsel das Spiel nie neu; die Zurück Taste wechselt den Reiter.

**Stadion:** Das 2D Spiel zeigt immer das ganze Stadion, jeder Platz ist sichtbar (Fan oder leerer Sitz). Die Zuschauerzahl hängt von Stadion, Fanstimmung, Gegner, Derby, Tabelle, Pokalrunde, Wetter und Anstosszeit ab (`app/stadium-profiles.ts`, `app/match-stadium.ts`). Im Spiel laufen Stadionsounds (`app/match-audio.ts`): Fangemurmel, Pfiffe, Jubel, Raunen und Gesänge; die Aufnahmen sind CC0 (`public/sounds/LICENSES.md`).

**Reisen:** Die Mannschaft nimmt die schnellste Verbindung von Tür zu Tür: unter 80 km immer den Teambus, sonst Bus, Zug (Intercity ab Bern, EuroCity nach Mailand, TGV Lyria nach Paris) oder Flugzeug ab Zürich bzw. Genf. Busse fahren auf echten Strassen (OSRM), Züge auf echten Gleisen (BRouter, Fahrzeiten gerundet nach Fahrplan). `npx tsx scripts/travel/fetch-real-routes.mts` ergänzt fehlende Strecken im Routencache und teilt ihn neu auf; die Heimadresse wird dabei nie an einen Routingdienst geschickt.

**Hosting:** Next.js 16 auf Vercel, Daten in Supabase (PostgreSQL), Login mit Google über Supabase Auth. Anleitung: [HOSTING.md](HOSTING.md). Laufende Datenbankinhalte und Browser Spielstände sind nicht Teil dieses Repositories.
