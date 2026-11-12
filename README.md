# Goal Clicker

Aktueller Spielcode mit Spielerpool, Saisons, Walkouts und Multiplayer. Release vom 16. Oktober 2026: Cup Auswärtsspiele mit neutralem Wembley Finale, Pfuschi/Di Certo, persistente Kader und Fabrizio Sperre, fünf Wechsel in drei Fenstern, feste Tor und Halbzeitpausen und entfernte manuelle Taktikauswahl.

* [Prestige vom 3. November 2026: Kartenauswahl, Album bleibt, +20 % Tore pro Prestige](docs/prestige.md)
* [Balance Update vom 29. Oktober 2026: Packs nach Liga, seltene 100er, Upgrades](docs/balance-update.md)
* [Gameplay-, Reise- und Stadionupdate vom 19. Oktober 2026](docs/gameplay-travel-stadium-update.md)
* [Releasebericht und vollständige Prüfevidenz](docs/release-match-realism.md)
* [Projektwissen und Spielregeln (erste ChatGPT Sites Version mit Cloudflare)](docs/chatgpt-sites-knowledge.md)
* [Konfigurationsreparatur und Sicherheitsprüfung](docs/config-security-repair.md)
* [Hosting auf ChatGPT Sites mit Neon und Login](HOSTING.md)
* [Umzug auf Neon Auth und Neon (Übernahme der Konten; Netlify Teile historisch)](docs/neon-netlify-migration.md)
* [Datenbank und Datenübernahme](docs/supabase-datenbank.md)
* [Login einrichten (Google oder Benutzername), Profil und Cloud Spielstand](docs/google-login.md)

Verifikation: `npm run typecheck`, `npm run lint`, `npm test` (inklusive `next build`), `npm run test:db` mit einer Testdatenbank; ergänzend `npm run verify:physics`. Performance: `npm run build`, dann `npm run perf:baseline -- --check` misst LCP, CLS, Bytes und Anfragen gegen die Warnschwellen (siehe [docs/qa/perf-baseline.md](docs/qa/perf-baseline.md)). Ein GitHub Push veröffentlicht nichts: Die ChatGPT Site übernimmt den Stand von `main` erst, wenn der Besitzer sie dazu anweist (siehe [HOSTING.md](HOSTING.md)).

Browser Prüfung: `npm run test:browser` startet den Produktionsbuild mit `next start` und prüft mit Chromium alle Tabs auf Desktop und Handy (Fehler, Überlauf, überlappender oder schwer lesbarer Text) sowie Combo, tägliche Prämie, Live Spiel und Pressekonferenz. Der GitHub Workflow führt sie nach `npm test` aus. `npm run test:account` spielt zusätzlich Login, Übernahme der Originalkonten, Profil, Cloud Spielstand mit zwei Geräten und Multiplayer mit zwei Konten durch (Nachbau von Neon Auth, braucht eine Testdatenbank).

**Projektstruktur:** `app/game-app.tsx` enthält die App Komponente, `app/page.tsx` lädt sie als eigenes JavaScript Paket (mit allen Kartendaten) parallel zur Anmeldung; Typen, Konstanten, Wirtschaft, Spielstand, Formatierung, Koop Hilfen und kleine Komponenten liegen in `app/game/`. `app/feature-data.ts` enthält die Spiellogik; Typen, Kataloge und Texte liegen in `app/features/` und werden von `feature-data.ts` unverändert weiter exportiert. Reiserouten (`app/route-cache/`) lädt der Browser erst nach dem Start, und er bekommt eine schlanke Kopie der FC 27 Indien Daten; beides regeln die `imports` mit der Bedingung `browser` in `package.json`.

**Adressen:** Jeder Reiter hat eine eigene Adresse: `/home`, `/spiele`, `/saison`, `/kader`, `/karriere`, `/packs`, `/packs/album`, `/club`, `/club/fabrizio`, `/club/missionen`, `/club/rangliste`, `/club/verlauf` (Liste in `app/tab-routes.ts`). Alle zeigen dieselbe Seite (Rewrites in `next.config.ts`), deshalb lädt ein Reiterwechsel das Spiel nie neu; die Zurück Taste wechselt den Reiter.

**Tutorial:** Ein ganz neuer Club sieht nach dem Willkommenspack ein Begrüssungsfenster und danach eine Karte mit fünf Aufgaben (Ball, Verstärkung, Kader, erste Partie, Packshop), die sich selbst abhaken; die erste Partie zählt schon beim Anpfiff. Bestehende Spielstände sehen es nie, unter Club & Mehr lässt es sich erneut starten. Logik in `app/tutorial.ts`, Fortschritt im synchronisierten Schlüssel `goalClickerTutorialV1`.

**Stadion:** Das 2D Spiel zeigt immer das ganze Stadion, jeder Platz ist sichtbar (Fan oder leerer Sitz). Die Zuschauerzahl hängt von Stadion, Fanstimmung, Gegner, Derby, Tabelle, Pokalrunde, Wetter und Anstosszeit ab (`app/stadium-profiles.ts`, `app/match-stadium.ts`). Im Spiel laufen Stadionsounds (`app/match-audio.ts`): Fangemurmel, Pfiffe, Jubel, Raunen und Gesänge; die Aufnahmen sind CC0 (`public/sounds/LICENSES.md`).

**Reisen:** Die Mannschaft nimmt die schnellste Verbindung von Tür zu Tür: unter 80 km immer den Teambus, sonst Bus, Zug (Intercity ab Bern, EuroCity nach Mailand, TGV Lyria nach Paris) oder Flugzeug ab Zürich bzw. Genf. Busse fahren auf echten Strassen (OSRM), Züge auf echten Gleisen (BRouter, Fahrzeiten gerundet nach Fahrplan). `npx tsx scripts/travel/fetch-real-routes.mts` ergänzt fehlende Strecken im Routencache und teilt ihn neu auf; die Heimadresse wird dabei nie an einen Routingdienst geschickt.

**Hosting:** Die Produktion läuft nur auf ChatGPT Sites (Next.js 16), Daten in Neon (PostgreSQL), Login mit Google oder Benutzername über Neon Auth. Netlify und Vercel werden für die Produktion nicht mehr verwendet. Veröffentlicht wird der Stand von `main`, wenn der Besitzer die Site anweist, ihn zu übernehmen. Anleitung: [HOSTING.md](HOSTING.md). Laufende Datenbankinhalte und Browser Spielstände sind nicht Teil dieses Repositories.
