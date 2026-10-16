# Position milestones and Schrott-Pack

> Historischer Stand. Aktuelle Regeln und Freigabe: [Release verification](release-match-realism.md) und [Sites project knowledge](chatgpt-sites-knowledge.md).

## Implemented behaviour

Career schema version 2 fixes each card's milestone category from its catalogue primary position. Match-position changes and alternate positions do not alter the category. Existing lifetime statistics, unlocked legacy milestone IDs, accumulated album collections and claimed album rewards survive normalization. On migration from version 1, previously earned legacy entitlements are granted once before switching to positional thresholds. New tiers unlock automatically; the strongest version applies, bonuses never stack and OVR never exceeds 100. The existing album bulk-claim button continues to collect all complete unclaimed groups once.

| Category | Appearances (tiers 1/2/3) | Goals | Assists | Minutes |
| --- | --- | --- | --- | --- |
| TW | 10 / 25 / 100 | None | None | 450 / 1800 / 9000 |
| IV, LV, RV, LAV, RAV | 10 / 25 / 100 | 1 / 5 / 15 | 2 / 10 / 30 | None |
| ZDM, ZM, ZOM | 10 / 25 / 100 | 5 / 20 / 60 | 5 / 20 / 60 | None |
| LM, RM, LF, RF (LW/RW aliases) | 10 / 25 / 100 | 5 / 25 / 75 | 5 / 15 / 50 | None |
| ST, MS | 10 / 25 / 100 | 10 / 30 / 100 | 3 / 10 / 30 | None |

Each track grants +1 / +2 / +3 OVR for its tiers, using the existing automatic milestone-card mechanism. Clean sheets, tackles, saves and penalty saves have no existing reliable lifetime counters, so no new counters were invented. Early tiers need at most ten appearances for the participation reward; the top participation tier needs ten ten-game seasons if the player appears throughout. Offensive tiers are lifetime cumulative goals/assists and follow the existing match engine's recorded contributions. Requirement progress and remaining amounts appear on every card.

## Schrott-Pack: FC 27 update, 12 October 2026

Source: official EA ratings at https://www.ea.com/games/ea-sports-fc/ratings/nations-ratings/india/159 (all three pages, 218 records). Original source snapshot including EA IDs, names, ratings, primary and alternate positions, nationality, club, abilities and all available attributes is tracked in app/fc27-india-source.json. Empty optional fields stay empty.

Price stays 7,500 Tore. Rating groups contain 137 / 57 / 10 / 14 players and have probabilities 50% / 35% / 13% / 2%. Each draw selects a group, then a uniformly random player inside it. Ownership and squad positions never affect the draw. Duplicates use existing fragment compensation. Empty groups redistribute probability proportionally; source updates above 69 require an explicit rule update instead of silently excluding players.

The old 60 fictional cards are completely removed at the user's request. Save normalization removes their IDs from rosters and formations. Multiplayer protocol 6 prevents older clients from overwriting the new catalogue. The scrap album now contains the 218 real cards; previously claimed rewards remain claimed. Existing other pack definitions, prices and eligible player pools are preserved. No source restrictions or group odds appear in public pack metadata; normal cards show their normal data.

Validation: 100,000 production draws yielded 50,167 / 34,892 / 12,958 / 1,983. Chi-square across individual players was 216.957 (217 degrees of freedom), under the test threshold of 300. Every player was sampled and deterministic quantile checks confirm all players are reachable. Tests cover complete source matching, original attributes, save normalization, positional eligibility, milestone upgrades, albums, season match lifecycle, API charging/duplicates and legacy removal. Random pulls no longer guarantee a full team after eleven purchases. Formations requiring positions absent from the official pool still require compatible players from elsewhere; no positions are invented.

Interactive browser QA is unavailable; production build, server-rendered markup, game logic, saves and API handlers are checked.
