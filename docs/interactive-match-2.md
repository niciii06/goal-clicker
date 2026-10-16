# Interactive Match Sim 2

Implemented 13 October 2026. This supersedes the earlier presentation-only match viewer for **new** fixtures.

## Audit and engine choice

The existing `advanceCupMatch` sampled goals independently per real second using `Math.random`. `match-broadcast.ts` added another seeded, non-scoring event stream. The renderer's `possessionNode` cycled nine preselected points. Consequently a visible missed shot, possession change, or passing sequence did not cause the actual next goal. The viewer also withheld an already-scored goal for 750–1150 ms. This architectural mismatch was removed for new fixtures, rather than adding guaranteed goals.

The original field-and-bench drag interface was inspected in commit `2506b08` (`Spielerwechsel per Drag and Drop`). Its formation card layout is retained in the new draft editor, with batch confirmation and tap/keyboard selection.

Source, licenses, dependency manifests and representative tests were inspected in:

| Candidate | Source observations | Integration decision |
| --- | --- | --- |
| https://github.com/haeretici/soccer-js | MIT license; fixed-step time helper; pitch entities also own rendering/canvas caches; simulator headless batch tests and seeded pseudo-random utilities; game utility RNG also includes Math.random. CommonJS modules and global Time/Settings require adaptation. | Larger physics/rendering ecosystem than this circle-based app needs. Not adopted. |
| https://github.com/eozgit/footballsim | MIT license; TypeScript iteration engine separates ball/player movement, injuries and goals; Vitest common/action/movement tests; common.ts has seedable Mulberry32 **module-global** matchRNG/setMatchSeed. | Headless integration possible, but concurrent Workers matches and saved checkpoint replay would require changing RNG ownership and providing a command/save adapter. Not adopted. |
| https://github.com/GallagherAiden/footballSimulationEngine | LICENSE says MIT while package metadata says ISC; asynchronous CommonJS iteration API; common.js imports Node fs and uses Math.random; Mocha/Chai common/action tests. | Browser/Worker dependency and deterministic-checkpoint adaptation required. Not adopted. |

No third-party engine code was copied and no external engine test suite was executed. A targeted, dependency-free action engine fits existing saves and progression. This decision is based on inspected code, not a claim that the alternatives cannot work.

## Architecture

`interactive-match.ts` is the authoritative play engine. `CupState.simulation` contains the match identity/seed, xorshift RNG checkpoint, committed action boundary, current play time, active players, formation anchors, ball, possession, assist eligibility, lifecycle, generation and small prepared action queue. Actions include start/end game seconds, actor/target, trajectory, outcome and before/after checkpoints. Coordinates use the existing 105 × 68 pitch units, independent of canvas dimensions.

The buffer now extends approximately 75–110 game seconds (5–7.3 real seconds) beyond current play to cover brief late updates. Twelve committed actions are retained for continuous delayed presentation. Prepared goals do not change scores, statistics, ticker or career records. Only completed action boundaries advance the committed checkpoint and update Cup goal/card/injury events and broadcast statistics. The complete engine runs without React or Canvas. RNG state is per match, never shared between requests. There are no asynchronous lookahead jobs; generation increments and synchronous invalidation prevent stale speculation surviving a command.

Pass options use relative progress, distance, pressure and passing lanes. Carries use control, shots use distance/angle, shooting, pressure, goalkeeper ability, fitness and form-adjusted strength. Tactics change forward risk, support and workload. Individual card attributes are used where present; overall rating is the bounded fallback. Player spacing, bounded destinations and role anchors retain shape. The renderer interpolates the actual action's positions and ball flight; it does not select decorative pass chains for new matches.

An assist is the previous successful teammate pass/cross to the scorer within 70 game seconds. Carrying, possession loss or a shot clears eligibility; an outgoing assist provider clears it on substitution. Own-team scorer/assist career impacts use the same committed goal event. Opponent scorer and assist identities survive normalization.

New matches include passes, carries, crosses, turnovers, tackles, shots/saves/misses/blocks/goals, simplified restarts, yellow/red cards and muscle injuries. Rare card/injury hazards reuse the existing game's match-length calibration. Dead-ball presentation is intentionally simplified; this is not a comprehensive offside/set-piece physics model. Fitness uses role, tactic and available stamina.

## Commands, clocks and UI

The existing one-second match update loop remains the sole clock driver. Client elapsed time uses a monotonic session anchor; authoritative server requests use server time. Six minutes = 5400 game seconds / 15, excluding editing/halftime pauses. Action scheduling and outcomes do not depend on frame rate.

Editing is requested at the next completed action boundary. The pending status is visible until then. The draft uses a separate lineup/tactic state. Validation checks the entire batch before mutation, including duplicate IDs, known owned/bench players, primary/secondary positions, departed/injured/suspended/dismissed players and the existing five-substitution allowance. Starter swaps do not consume substitutions. All incoming players, outgoing timestamps, bench changes and tactical changes apply together. Cancel resumes the unchanged committed lineup. Formation changes during a live match remain unavailable, consistent with existing game rules; compatible slot swaps work.

The same commands run locally and through the authenticated, optimistic-concurrency multiplayer API. The old direct live `star-lineup`/`cup-play` routes reject attempts to bypass the new editor. Multiplayer protocol 11 requires older tabs to reload while retaining room seats/saves.

The panel has one score/scorer display, 2D/ticker/statistics switching and one combined substitution/tactics entry point. Quick simulation has been removed at the user’s request, including the local handler and multiplayer action. The existing completed-match summary now also displays scorers and shot totals; the live canvas still unmounts at completion. Touch users can select a starter then bench card, or bench card then slot. All selection controls are buttons for keyboard operation. Desktop dragging remains available.

All matches now stop at the ordinary halftime and injury editing interactions. Existing saved `quick` flags are discarded during normalization. Headless tests may advance large time steps, but there is no user-facing fast-forward path. Existing career/tournament reward ledgers and inactive-match checks retain idempotent finalization.

## Persistence and compatibility

New fixtures are initialized through the existing `prepareCareerMatch` kickoff path. Existing in-progress fixtures without simulation version 2 keep the legacy engine until completion, including their saved three/six-minute timing and old injury controls. No existing match is silently replaced or deleted; the next fixture receives the new engine. Existing pack/economy/transfer/travel/scheduling rules are unchanged.

Saved speculation is discarded on normalization and regenerated from the committed RNG checkpoint. The current play time can lie between boundaries, and replaying the same checkpoint recreates the in-flight action. Explicit pauses survive reload; active matches retain their timing metadata across closed/hidden tabs and catch up in action order, stopping at required halftime/injury interaction. Rewards/history are recorded through existing completion paths only. Drafts that were not confirmed are local UI state and can be recreated after reload; there is no queued confirmed-but-unapplied command at an editing boundary.

## Verification actually executed

- Full `npm run test`: **215 passed, zero failed** (174 TypeScript tests; 41 JavaScript tests), including production build and deployment artifact validation.
- `npm run typecheck`: passed.
- ESLint on changed simulation/UI/API components: zero errors; three existing unused-import warnings in the page when included; new presentation/engine components have no lint errors or warnings.
- `git diff --check`: passed.
- New batch: 100 complete varied-formation/strength/seed fixtures, 300 paired-strength fixtures, and six seeds compared across normal playback, headless batches and a different update cadence. Renderer calls were executed on the normal path and checked for state immutability.
- The 100-fixture mixed-strength batch produced 300 goals (3.0/match), 14 draws, four 0:0 results, 1075 shots and 703 on-target shots. Twenty-five scorelines occurred. No stalled or invalid endpoints were observed.
- With identical tactics: 90-vs-90 (100 fixtures) produced 115:97 aggregate goals, 44 club wins and 25 draws; 90-vs-65 produced 180:35, 74 wins and 21 draws; 65-vs-90 produced 52:158, 15 wins and 20 draws. The initial larger equal-rating discrepancy came from different tactical settings; matching tactics reduced it. Formation and seed variation still affect individual outcomes. No probabilities were adjusted to force a target result distribution.
- Tests cover score/goal parity, unique IDs, valid actors, bounds, finite/nonnegative stats, replayed seed/checkpoint determinism, speculative-goal isolation, atomic multiple substitutions, invalid-batch rejection, tactic invalidation, save normalization, explicit editing/halftime pauses, hidden-tab catch-up, legacy saves and repeated completion/career recording.
- API regression actually executed editor pause/boundary completion, invalid and valid two-player batches, old-route rejection, normal finish, rejection of the removed fast-forward action, saved report and repeated finish without a second report. Legacy reward/derby/collection/concurrency tests remain in the full suite; their constructed legacy fixtures explicitly retain the old engine.
- Offline Canvas QA executed the production frame/drawing functions through one complete normal-cadence match, producing 5400 frames. Contact-sheet frames for kickoff, passing, carrying, shooting, crossing and the second half were visually inspected. The example finished 4:0. These are temporary QA outputs, not added application assets.

## Remaining verification limits

No browser session or real mobile device was tested in this execution environment. The Sites-managed workflow requires `$control-browser`, which is not available here, and instructs the agent to skip browser QA rather than start an improvised preview. Actual desktop dragging, mobile tapping/layout, focus behavior, real FPS and watching a six-minute match in a browser therefore remain unverified. Offline images and rendered-HTML tests do not substitute for those checks. No claim of zero bugs or guaranteed realism is made.


## Follow-up: freeze and ticker-clock repair

The version-130 renderer clamped time to the available lookahead and then to a newly received authoritative time, producing a hold followed by a position jump if updates arrived late. Its wall-clock anchor was also reset on UI time-prop changes, and the ticker displayed the last polled simulation minute directly.

`use-match-presentation.ts` now owns one persistent, monotonic presentation playhead for the pitch and ticker. Switching views preserves it. The first frame after a gap greater than 250 ms advances at most 50 ms of ordinary play plus bounded recovery; later frames catch up at no more than 1.2× speed. Ordinary 15/30/60 FPS uses the actual frame interval, so lower frame rates do not slow the match display. Returning from a hidden tab intentionally resets to the current state. This clock changes neither authoritative match time nor outcomes.

The larger lookahead absorbs brief polling delays. Validated committed action checkpoints survive normalization, so a delayed playhead can still interpolate the earlier action after a server update. The animation loop no longer reads layout on every frame; ResizeObserver/window resize refresh canvas bounds. Local match ticks operate on already-normalized game state, rather than normalizing the entire collection each second; completion still clones state before applying rewards/career mutations.

Targeted regressions cover a two-second stalled frame, consecutive ticker minutes under sparse updates, no display-clock rewind, equal time progression at 15/30/60 FPS, committed-history reload continuity and the absence/rejection of quick simulation. Existing seeded outcome distributions remain unchanged. Browser/device reproduction remains unavailable in this environment; these are code-level and headless checks, not a measured guarantee about the user’s hardware or network.


## Follow-up: independent drawing during main-thread work

Where supported, new matches now transfer their full-pitch canvas to a dedicated Web Worker using OffscreenCanvas. Its 30-FPS drawing loop and monotonic playback continue independently of React renders, save serialization and main-thread calculations. Only immutable match snapshots are sent; the worker never generates actions, commits events or awards rewards. The shared pure interpolation and pitch-drawing functions are reused. The production worker bundle is approximately 5.7 KB and contains neither React nor the player catalog. It publishes its presentation time back to the ticker clock.

Hidden-tab messages stop drawing. Resize/pointer messages preserve sizing and selection. Unsupported browsers, initialization failures and worker errors retain a fresh main-thread canvas fallback; terminating/unmounting removes listeners and stops the worker. Ordinary snapshots do not recreate the worker. Reduced-motion snapshots remain supported.

Loan lists are memoized and the hidden reserve list is no longer filtered/sorted during a match. A separate lightweight count preserves the reserve number in the pre-match summary.

Verification: full build/artifact validation, typecheck and 215 tests passed. A real Node worker ran the production worker entrypoint against a recording Canvas test context while the test’s main thread was deliberately CPU-blocked for 1.1 seconds. It executed 32 draw frames in the full suite (33 in the isolated run), with changing ball coordinates. A separate test compared worker interpolation against the existing renderer within floating-point tolerance and verified the input match was unchanged. The worker bundle was confirmed in the packaged client assets. This demonstrates independent scheduling and geometry generation, but is not an actual browser OffscreenCanvas/real-device frame-rate measurement. Browser validation remains open as documented above.
