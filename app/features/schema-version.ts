// 9 (6 November 2026): weekly goals and the club chronicle. Older clients would drop both, so they must not save over it.
// Its own module so the save checks of the account screen do not load the game data (audit P13); feature-data.ts
// re-exports it.
export const GAME_FEATURES_SCHEMA_VERSION = 9;
