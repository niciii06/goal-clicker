# Match center and navigation update

> Historischer Stand. Aktuelle Regeln und Freigabe: [Release verification](release-match-realism.md) und [Sites project knowledge](chatgpt-sites-knowledge.md).

The match center now owns one scoreboard, one chronological event feed with replay controls, and one team decision interface. The three tabs are Match, Team and Statistics. Fitness and player ratings are combined in Team; existing tactics, substitutions, cameras and interactive penalty shootouts remain available. Goals use a brief pitch-local celebration; red cards and ordinary random events use automatic, non-blocking notifications. Random-event consequences continue through the original reducers, independently of display or dismissal. Their queue no longer discards older waiting events, and the bell opens the existing persisted history.

The six primary navigation areas are Home, Matches, Squad, Career, Packs & Album, and Club & More. Packs/Album and Club/Fabrizio/Missions/History use secondary navigation. Squad management is separate from match selection; live substitutions stay in the match center. A live game remains reachable from the labelled Matches tab. Main sections change without reloading the page. Existing Home upgrades, layout customization, minigames and records remain available.

The animated viewer mounts only while cup.active is true, which includes injury pauses, extra time and penalties. Completion unmounts the canvas and shows an inline summary with recorded performances, important events and relevant reward/progression history. Season tables and tournament newspapers no longer block the screen.

Career supports eleven data-backed sort orders, combinable position/primary-secondary-position, rating, form, squad and availability filters, search and reset. Sorting is remembered locally. The compact archive retains the last ten completed matches, drops the oldest detail at the eleventh completion and leaves aggregate statistics untouched. New reports retain original XI, bench, competition, home/away metadata where known, event summaries and penalty result. Legacy reports display only the information originally saved. The active match never shows the historical rating archive.

Injury resume shifts the paused match timeline before play continues, including through a substitution. Refresh also shifts recorded presentation event timestamps with the match timers. Match identities and rating seeds remain unchanged; existing processed-match and tournament-reward ledgers prevent repeated career entries or prizes. Existing storage keys, database schema, currencies, pack odds, transfer rates, match duration, simulation outcomes and Fabrizio presentation remain unchanged.

## Validation

- Full npm run test: 191 passed, zero failed (150 TypeScript tests, 41 JavaScript tests), including production build and Worker artifact validation.
- npm run typecheck: passed.
- ESLint on modified UI/game files: zero errors, five pre-existing unused-variable warnings.
- Full-project ESLint has existing errors in unchanged Canvas and travel components; it is not clean. The newly introduced effect warning was corrected.
- New regressions cover archive eviction while retaining aggregate statistics, old eight-report saves, archive hiding during live play, pause/resume continuity, refreshed scene timestamps and the three-tab match UI.
- Existing tests cover multiplayer concurrency, idempotent completion/rewards, substitutions, saved-state recovery, transfers, packs, career progression, clocks, Canvas motion, replays and score orientation.
- git diff --check: passed.

Browser QA became available on retry. The production site was opened, and the updated local preview was tested with isolated synthetic saves at desktop width and an iframe viewport of 390 pixels. Checked six-area navigation, live three-tab match center, automatic notification appearance/dismissal, selecting and confirming a substitution (counter increased to 1/5; incoming player displayed with 100% fitness), completed-match summary with no live canvas, rating sort, position filtering and exactly ten archived reports. Visual findings corrected: remove explanatory pre-match copy above the live pitch, keep new controls and summaries consistent with the original light theme, improve narrow scoreboard wrapping. A real iPhone/Safari and simultaneous two-client visual session were not tested. Cloud-browser Canvas FPS is not a reliable real-device benchmark.
