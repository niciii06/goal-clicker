# Position milestones and Schrott-Pack

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

## Pack and necessary compatibility changes

Schrott-Pack costs exactly 7,500 units of the existing currency, displayed as Tore in this game. It unlocks from the initial season and draws one normal base card with rating 40–64 (100%); stars, special cards, icons, legends, rare reveals and walkouts have 0% probability.

The existing catalogue had no eligible cards. Added 60 stable weak base-card definitions: four per supported primary position. Their fixed IDs and ratings are resolved by the same player lookup and save normalization as every existing card. Existing players and all existing pack prices, odds and season unlocks are unchanged.

Candidates are uniform within the currently eligible subset. Until the current formation can be filled, eligible cards are those that increase the maximum number of matching lineup slots. Unowned cards are always preferred, so duplicates cannot block the first eleven. With a complete eleven, all remaining unowned scrap cards are equally likely; after all 60 are owned, each has a 1/60 duplicate chance and the existing compensation mechanism awards 15 fragments. Fixed per-position odds would be misleading because the candidate subset changes with the roster.

If adding a scrap card leaves an incomplete lineup, the existing best-eleven function moves compatible multi-position cards so the usable new slot is actually occupied. Full lineups remain unchanged. Cards can otherwise be moved to lineup, bench and reserve through existing controls.

Added a separate scrap album group (500 fragments once) to keep the existing base collection's completion requirements unchanged. The existing all-claim mechanism handles it normally. Added a synchronous local purchase guard to prevent rapid clicks from reusing a stale opening. Multiplayer protocol is now 5 so outdated clients cannot normalize away new card IDs or tier IDs. Persistent database schema and storage keys are unchanged. No transfer, Fabrizio, tournament or travel rules were changed.

## Verification

- npm run typecheck: passed.
- npm test: passed, including production build and artifact validation; 96 TypeScript tests plus 41 existing JavaScript tests, 137 total.
- git diff --check: passed.
- Coverage includes every position group, multiple positions, legacy entitlements/stats/claims, normalization idempotence, all-claim rewards, exact price, strict card eligibility, pool exhaustion, normal bench use, every formation, mixed-position rosters, concurrent API purchases, insufficient funds, persistent eleven-purchase flow, API season kickoff/finish, existing packs, tournaments and travel regressions.
- Earlygame simulation: zero starting cards and currency; three clicks/second, existing production functions, only season-one upgrades. No critical hits, streak multiplier, minigames, gifts, missions or random-event income. Eleven cards after 992 seconds (16m32s); pack spending 82,500; upgrade spending 3,968; remaining currency 34; team rating 53. Used boots level 12 and technique level 6. Existing season rules allow this weak eleven; tournament strength requirements remain unchanged.
- This is a reproducible automated progression scenario, not an elapsed-time human playtest. Upgrade decisions use a 90-second payback cutoff. Clicking speed and upgrade choices change the actual time. The unchanged standard reveal can be dismissed immediately.
- Interactive browser QA unavailable in this environment; server-rendered markup, game logic, save normalization and real API handlers were tested.
