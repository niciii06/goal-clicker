# Goal Clicker

Aktueller Spielcode mit Spielerpool, Saisons, Walkouts und Multiplayer. Release vom 16. Oktober 2026: Cup Auswärtsspiele mit neutralem Wembley Finale, Pfuschi/Di Certo, persistente Kader und Fabrizio Sperre, fünf Wechsel in drei Fenstern, feste Tor und Halbzeitpausen und entfernte manuelle Taktikauswahl.

* [Releasebericht und vollständige Prüfevidenz](docs/release-match-realism.md)
* [Aktuelles ChatGPT Sites Projektwissen](docs/chatgpt-sites-knowledge.md)
* [Konfigurationsreparatur und Sicherheitsprüfung](docs/config-security-repair.md)
* [Exportierte Projektdatei](chatgpt/goal-clicker-project-knowledge.md)

Verifikation: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; ergänzend `npm run verify:physics`. Der Build erzwingt maximal 500000 Bytes pro Client JavaScript Chunk. Sites Deployment und GitHub Quellstand besitzen getrennte Historien; ein GitHub Push veröffentlicht keine neue Site Version.

**Manuell bearbeiten und extern hosten:** [HOSTING.md](HOSTING.md). Die externe Cloudflare Konfiguration ist `wrangler.external.json`. Laufende Datenbankinhalte und Browser Spielstände sind nicht Teil dieses Repositories.
