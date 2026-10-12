# 2D match viewer audit · 12 October 2026

## Source and publication

The existing GitHub implementation at `beaaf98ebdf342bda73d2699ffe4c9334febecea` was ahead of ChatGPT Site version 125. Its six-minute match clock, match viewer, styling and integration were imported, then audited and corrected. Existing external hosting scripts on GitHub are retained; this update targets the existing ChatGPT Site.

## Corrections

* Regular matches last 360 seconds; extra time adds 120 seconds. Existing three-minute saves retain their clock.
* Goal, card and injury probabilities scale to match duration. Pack odds and reward amounts are unchanged.
* Clock freezes during injury pauses. Polling preserves fractional second remainders instead of silently skipping simulation seconds.
* Career reports use the actual match phase: 90 minutes for regular matches and 120 for extra time/penalties. Late substitutes no longer gain 30 phantom minutes or incorrectly update form.
* Missed and saved penalties no longer enter the goal. Recorded penalty directions and outcomes drive the visualization.
* Goalkeepers start near their own goal. Clubs switch ends at halftime and both extra-time boundaries.
* Injured, sent-off and substituted players disappear from the live lineup. Replay rosters are reconstructed from recorded entry/exit minutes, including after the original lineup has been restored at full time.
* Continuous formation-based passing and carrying trajectories connect ball movement with active player markers. Ground passes and lofted ball arcs have shared endpoints. Defensive targets follow shape, nearby pressing and current strategy.
* Stable event identifiers, timestamps and deterministic cosmetic seeds make repeated rendering and refreshed states reproducible without changing official results.
* Future events are not presented. Replays do not mutate game state and return automatically to live rendering after 6.5 seconds. The scoreboard continues to show the authoritative live result, with the replay minute separately labelled.
* Replays remain accessible after full time. The SVG retains pitch proportions and accessible player titles, and respects reduced motion.

## Verification

* `npm run typecheck`: passed.
* `npm run test`: passed, including the verified production build and artifact checks.
* Complete automated suite: 176 tests passed, 0 failed (135 TypeScript tests and 41 JavaScript tests).
* Added tests cover all 29 formations, unique actors, pitch bounds, goalkeeper location, home/away side changes, penalty outcomes, injury/red-card exclusions, historic replay roster, ball/player continuity, deterministic refresh, paused clocks, hidden future events, immutable replays, career minutes, fractional tick cadence and rendered scoreboard orientation.
* Browser QA, mobile screenshots, device FPS and two-client visual synchronization were unavailable in this execution environment. API concurrency and multiplayer integration are covered by the automated suite.

## Scope limitations relative to the complete Stage 3 specification

This is an improved event-driven tactical match viewer, not a completed full Stage 3 football action engine.

* Opponent IDs identify clubs; the authoritative engine does not provide an actual opponent eleven. Their markers have positional labels rather than invented real identities, ratings or fitness.
* Fitness is explicitly labelled an estimated visual workload and has no added gameplay effect; an authoritative stamina system has not been introduced.
* There are no authoritative shot/save, corner, free-kick or yellow-card events. Dedicated sequences and official statistics for these cannot be claimed as implemented. Recorded shootout saves are visualized.
* Passing and carrying are deterministic presentation trajectories, not a continuous physical football simulation. Goal scenes are reconstructed once a goal is officially recorded, with a short labelled presentation cut. Replays are reconstructed scenes, not recordings of a simulated physical trajectory.
* Shirt numbers are stable formation slot labels, because source data has no shirt numbers. Historic substitutions between identical role slots can only be reconstructed to the recorded role, not an unavailable historic slot identifier.
* Animation targets approximately 30 updates per second. A 60 FPS performance target has not been measured or verified. Camera zoom and highlight camera controls are not implemented.
* Tactics and substitutions continue through the existing authorized controls and positional eligibility logic; no duplicate gameplay bonuses or parallel match engine were added.

These limitations remain explicit rather than being described as complete Stage 3 delivery.
