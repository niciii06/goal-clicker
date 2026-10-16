# Goal Clicker match viewer: Stage 3 extension

> Historischer Stand. Aktuelle Regeln und Freigabe: [Release verification](release-match-realism.md) und [Sites project knowledge](chatgpt-sites-knowledge.md).

Updated 12 October 2026. This supersedes the initial version-126 audit. The project now includes persisted match actions, full game lineups, fitness, standards, saves and direct match controls in addition to the six-minute clock.

## Completed behavior

* Regular play: 360 real seconds for 90 match minutes. Extra time: another 120 seconds for 30 match minutes. Saved three-minute matches retain their original schedule.
* Match presentation: full-pitch Canvas renderer, all active players and a ball, proportionate 105 × 68 geometry, goalkeeper colors, jersey numbers, grass stripes, goals, penalty areas, arcs and center circle.
* All 29 existing formations and their supported secondary positions. Actual injured, substituted and sent-off players disappear. Replay reconstruction retains the match formation, historic role slots and numbers across substitutions and later squad changes.
* Both teams have game lineups, names, numbers, roles, fitness and ratings. Opponent game XIs are deterministically generated from existing card data with eligible positions and nearby ratings. They are fictional-game squads, not claims about real clubs' current rosters. Existing club-relative scoreboard fields are translated correctly for away fixtures.
* Player motion is limited by speed and acceleration, with local separation, formation anchors, ball-oriented support, nearby pressing, defensive shape and tactical workloads. Available sprint and stamina attributes are reused; overall rating provides documented fallbacks when individual attributes do not exist.
* Passing/carrying scenes cover short combinations, forward/through passes, wide crosses, lofted trajectories, backwards circulation and one-touch return passes. Counter and possession patterns differ; the defending team's own tactical strategy controls its pressing shape.
* The authoritative match tick records corners, free kicks, throw-ins, unsuccessful shots, blocks, goalkeeper saves and yellow cards in a separate deterministic action stream. It never consumes the scoring engine's random source and never invents goals. Goal, injury and red-card decisions remain with the original match simulator.
* Standards have separate setup and movement: corner delivery/header, a free-kick wall and shot, touchline throws, normal shots, saves, misses and goalkeeper distribution. Ball endpoints reflect the recorded outcome.
* Goal metadata chooses position-appropriate finishes including one-on-ones, driven shots, long shots, headers/crosses, rebounds, corners, free kicks and penalties. Existing scorer and assist contributions remain authoritative. Captions show the scorer, minute and a recorded assist where available.
* Goal scores are never inferred from ball coordinates. Live confirmed goals are presented with ball-in-net/celebration and restart; highlights reconstruct their buildup and finish without anticipating future official goals. Normal lead-in action is presentation, not another results engine.
* Shootouts use the recorded shot/keeper directions and outcomes. Saves and misses cannot be rendered as goals. Shootout goals stay separate from regular career scoring and rewards.
* Fitness is retained in the authoritative match state. Playing time, role, strategy and known stamina attributes determine workload. It freezes during injury pauses, survives refresh, and new substitutes enter at 100. It affects visual movement; existing result balance is preserved.
* Statistics show recorded shots/on-target, saves, corners, free kicks, cards and clock-based action possession. Processing the same tick or restoring JSON cannot count them twice.
* Existing live notes, tactics, injury pauses, suspensions and substitution eligibility remain in use. Tactics and compatible bench substitutions can now be requested directly inside the viewer through those same authorized handlers.
* Live, fitness, ratings, statistics, tactics, substitutions and highlights tabs. A larger dialog view with Escape and focus trapping; touch player selection; full-pitch, ball-following and highlight cameras. Responsive layouts put the pitch first on smaller screens.
* Replay is a separate, bounded presentation clock. It never alters the game, official score, rewards or match completion and returns to the live view automatically. Highlights stay available after the final whistle.
* Canvas animation is independent of React's slower information refresh. It targets 60 FPS, reports measured render FPS, caps timestep/velocity, reduces motion on request and stops drawing in hidden tabs. Returning uses the current authoritative state; device FPS cannot decide a winner.
* New multiplayer clients use protocol 8. Existing room data and seats are preserved; older clients get the standard reload message. Match events, fitness and statistics are saved with the existing room/save JSON; no schema migration or paid API is required.

## Architecture and compatibility

`feature-data.ts` remains the scoring authority. `match-broadcast.ts` extends the saved event/fitness/statistics infrastructure. `match-viewer.tsx` maps lineups and recorded events to deterministic scenes and provides UI. `match-pitch-canvas.tsx` owns drawing and bounded cosmetic motion.

The new fields are optional and validated. Legacy saves without them migrate on their next match tick. Roster selection is cached as bounded, deterministic, public card-data derivation; event and fitness state is never shared between matches.

Pack probabilities, prices, career progression, transfer rules, home/away scheduling, tournament rules, prizes and currency reward amounts are unchanged. The six-minute version's career-minute bug, unsuccessful-penalty animation, pause-clock handling and fractional tick processing remain fixed.

## Verification

* `npm run typecheck`: passed.
* Full `npm run test`: 188 passed, 0 failed, including 147 TypeScript tests and 41 JavaScript tests, production build and deployment artifact validation.
* Focused viewer/broadcast checks rerun after final presentation refinements: all passed.
* Tests cover all formations, source-card positional eligibility, clock/legacy timing, authoritative statistics and fitness, idempotent replayed ticks, refresh, substitutions/historic slots, hidden future events, standard/shot outcomes, goal-pattern normalization, immutable rendering, bounded motion, accessible markup and malformed saves.
* Existing API integration and optimistic-concurrency tests cover shared room actions, rewards, kickoff/completion, migrations, transfers, packs and progression.
* `scripts/render-match-qa.ts` generated 480 frames using the production Canvas drawing functions. Representative build-up, corner/header, free-kick/save and missed-shot frames were inspected. The optional QA script uses the execution environment's `@napi-rs/canvas`; it is not an app dependency or build requirement.

## Verification limits

Actual browser input, mobile screenshots, two simultaneous human client views and real-device FPS were unavailable because the supported managed browser-control capability was not available. Automated HTML, motion, event, API and saved-state checks plus offline production-rendered frames do not replace those device checks.

The motion is an event-driven 2D presentation with formation/tactical behavior. Replays reconstruct recorded scenes rather than store full video. Existing scoring outcomes remain authoritative. No unverified real-world opponent roster or unavailable FC27 technical attribute is asserted.
