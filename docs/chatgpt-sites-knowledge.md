# Goal Clicker – ChatGPT Sites project knowledge

Release date: 2026-10-16.
GitHub source release: `697b342ff57d05a764f5a5fcf538065806e4bdf7`.
Repository: https://github.com/niciii06/goal-clicker
Hosting target: ChatGPT Sites; Vinext/Vite, React 19, Cloudflare Worker and D1.
Site project: `appgprj_6a70b280862c8191b97f48b9b21cefb9`.

## Competition and player rules

- All newly generated player fixtures in the three Cups are away fixtures and require travel.
- Only the final of the highest-ranked Cup uses neutral Wembley (51.5560, -0.2795).
- Existing league scheduling and active/historical fixture snapshots are preserved.
- Pfuschi (`star-pfuschi`): rating 1, all existing attributes 1, no position; bench eligible only. Excluded from starting XI, automatic pickers, substitutions, active actors and match rating.
- Di Certo (`star-di-certo`): rating 100, primary ZM, secondary ZDM; uses the normal active-player system and existing special-card draw.
- Opponent red cards persist by roster ID. Remaining actors rebalance into defensive lines; emergency goalkeeper coverage and further dismissals are supported. No replacement actor is added.
- Goal overlay: exactly 4000 ms after the visual shot lead; clock/engine freeze and automatic kickoff by the conceding team.
- Halftime: exactly 10000 ms at minute 45; automatic restart, with substitutions available.
- Maximum five substitutions across three in-play windows; a batch consumes one window. Halftime uses no in-play window. Ineligible players, re-entry and replacement of a dismissed player are rejected.
- The three manual tactical selectors and their strength/fitness modifiers are removed. Legacy `strategyId` values still normalize safely; obsolete `cup-play` actions return HTTP 410.

## Travel and timers

- New itineraries store multimodal infrastructure geometry and provenance. Road and rail corridors use the existing OSM cache; missing links are labelled **Routenverlauf geschätzt** in text and dashed geometry.
- `TRAVEL_CONFIG.acceleration = 60`: gameTravelSeconds = realSeconds / 60. No three-minute geographical ceiling is introduced.
- Travel starts at Bümplizstrasse 45, Bern. The map scrolls smoothly into view once per journey, respecting reduced motion.
- Departure snapshots nominated XI and bench IDs. Injured or suspended nominations and players outside the locked squad are rejected.
- Fabrizio, event and VAR timer remainders freeze on departure, persist through serialization/reconnect, and resume once after match completion. No trip-abort UI currently exists.
- Existing journeys retain original timestamps and stored geometry. Legacy saves use optional-field defaults without reset.

## Architecture and validation

- `match-visual-frame.ts`: pure deterministic frame targets; `match-motion.ts`: shared bounded actor/ball presentation pipeline; the canvas and CLI physics audit use the same `MatchPresentation`.
- Pitch canvas and travel map load through dynamic imports with accessible SSR/loading fallbacks.
- Canonical route JSON is preserved. Seven imported cache parts reconstruct identical geometry, ordering and metadata; a regression checks exact data equality.
- All client JavaScript chunks must be <=500000 bytes; `validate-artifact.sh` enforces this limit. No warning threshold was raised.
- Main and API segments declare dynamic rendering explicitly. Artifact validation uses stable `node:module.register`.
- Builds use installed/local inputs without build-process proxy variables; installation and runtime network settings are retained.
- Verification: 223 tests passed, zero skipped; typecheck, lint and production build passed without warnings. Four full matches exercise frame continuity, pauses, restart and reload.
- Active-play ball distance must satisfy `distance <= 55 * deltaSeconds + 1e-7` metres. Whistled set pieces, kickoff and pauses are excluded by event/state, never by observed jump size. A negative control rejects an artificial active-play teleport.
- This verifies rendered ball continuity; it does not claim a complete new 22-body collision engine or a completed worldwide stadium audit.

## Hosting provenance

The GitHub release and the live Sites repository have independent histories.
The Site was inspected at version 132, source `ac4b92d301d283def774cdac2f8bca1271865971`, with separate Interactive Match Sim 2.0 / worker changes.
This task updates GitHub release code and repository-based Sites knowledge. It does not replace that live Site deployment or discard its separate work.
Before a later application deployment, reconcile both source histories and validate the integrated result; updating GitHub main does not automatically publish a Sites version.

Real time interactive browser verification was bypassed due to the headless CLI environment; verification is established via the 480 generated canvas frames and DOM component test suites.
