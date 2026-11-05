// Small fixes from the independent review: cloud upload schema, prestige season stats, upgrade count text.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { uploadSchemaVersion } from '../app/game/save-schema.ts';
import { GAME_FEATURES_SCHEMA_VERSION, STAR_XI_PLAYERS } from '../app/feature-data.ts';
import { emptyPlayerStats, initialCareerState, rebaseCareerForPrestige } from '../app/career-data.ts';
import { STORAGE_KEY } from '../app/game/constants.ts';

test('a cloud upload announces at least the client schema, also for a save without schemaVersion', async () => {
  const withoutSchema = { [STORAGE_KEY]: JSON.stringify({ goals: 5, features: {} }) };
  assert.equal(uploadSchemaVersion(withoutSchema), GAME_FEATURES_SCHEMA_VERSION);
  assert.equal(uploadSchemaVersion({}), GAME_FEATURES_SCHEMA_VERSION);
  assert.equal(uploadSchemaVersion(null), GAME_FEATURES_SCHEMA_VERSION);
  const current = { [STORAGE_KEY]: JSON.stringify({ features: { schemaVersion: GAME_FEATURES_SCHEMA_VERSION } }) };
  assert.equal(uploadSchemaVersion(current), GAME_FEATURES_SCHEMA_VERSION);
  const newer = { [STORAGE_KEY]: JSON.stringify({ features: { schemaVersion: GAME_FEATURES_SCHEMA_VERSION + 2 } }) };
  assert.equal(uploadSchemaVersion(newer), GAME_FEATURES_SCHEMA_VERSION + 2);
  const sync = await readFile(new URL('../app/cloud-sync.ts', import.meta.url), 'utf8');
  assert.match(sync, /schemaVersion: uploadSchemaVersion\(keys\)/);
});

test('prestige keeps season stats only for retained cards, so awards cannot name discarded ones', () => {
  const [kept, gone] = STAR_XI_PLAYERS.map((p) => p.id);
  const career = initialCareerState();
  career.seasonPlayers = { [kept]: { ...emptyPlayerStats(), goals: 3 }, [gone]: { ...emptyPlayerStats(), goals: 9 } };
  career.players = { [kept]: { ...emptyPlayerStats(), goals: 3 }, [gone]: { ...emptyPlayerStats(), goals: 9 } };
  const next = rebaseCareerForPrestige(career, new Set([kept]));
  assert.deepEqual(Object.keys(next.seasonPlayers), [kept]);
  assert.equal(next.seasonPlayers[kept].goals, 3);
  assert.equal(next.players[gone].goals, 9, 'career totals stay');
  assert.ok(career.seasonPlayers[gone], 'the input is not changed');
});

test('the prestige dialog names the real number of upgrades', async () => {
  const dialog = await readFile(new URL('../app/prestige-dialog.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(dialog, /Alle 27 Upgrades/);
  assert.match(dialog, /Alle \{UPGRADES\.length\} Upgrades/);
});
