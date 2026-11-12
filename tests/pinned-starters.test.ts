// Pinned starters: "Beste Startelf" keeps a deliberately chosen, weaker card in the eleven (owner wish, Mikeyboy 80 against a 90).
import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameFeatures, normalizeGameFeatures, setBestStarXI, setStarXIFormation, STAR_XI_PLAYERS, togglePinnedStarter, getStarXIPlayer, MAX_PINNED_STARTERS } from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';

function club(): GameFeatures {
  const features = initialGameFeatures(1_000_000);
  features.starterSquadGranted = true;
  features.starXI.ownedIds = STAR_XI_PLAYERS.filter((player) => player.rating < 92 && !player.benchOnly && !player.isCustom).slice(0, 80).map((player) => player.id);
  features.starXI = setBestStarXI(features.starXI, [], { career: features.career });
  return normalizeGameFeatures(features);
}
const best = (features: GameFeatures, blocked: string[] = []) => setBestStarXI(features.starXI, blocked, { career: features.career, cup: features.cup });
/** A clearly weaker owned card that the plain best eleven leaves out, and the strongest card that would take its place. */
function weakFavourite(features: GameFeatures) {
  const inEleven = new Set(features.starXI.lineupIds);
  const candidates = features.starXI.ownedIds.filter((id) => !inEleven.has(id)).map((id) => getStarXIPlayer(id)!).sort((a, b) => a.rating - b.rating);
  const weak = candidates.find((player) => player.rating <= 80 && player.rating >= 70) ?? candidates[Math.floor(candidates.length / 2)];
  return weak;
}

test('a pinned weaker card stays in the starting eleven after "Beste Startelf"; unpinning returns to the plain best eleven', () => {
  const features = club();
  const plain = best(features).lineupIds;
  const weak = weakFavourite(features);
  assert.ok(!plain.includes(weak.id), 'without a pin the weaker card is left out');
  assert.equal(togglePinnedStarter(features, weak.id), 'pinned');
  const pinned = best(features);
  assert.ok(pinned.lineupIds.includes(weak.id), 'the pinned card is in the eleven');
  assert.equal(pinned.lineupIds.filter(Boolean).length, 11, 'a full valid eleven');
  const all = [...pinned.lineupIds, ...pinned.benchIds].filter(Boolean);
  assert.equal(new Set(all).size, all.length, 'nobody twice');
  // The rest is still optimised around the pin: only a few places differ from the plain best eleven.
  assert.ok(pinned.lineupIds.filter((id) => !plain.includes(id)).length <= 3, 'the other places keep their best cards');
  assert.equal(togglePinnedStarter(features, weak.id), 'unpinned');
  assert.deepEqual(best(features).lineupIds, plain, 'unpinning gives the normal best eleven back');
  assert.equal(features.starXI.pinnedPlayerIds, undefined, 'no empty list is left behind');
});

test('several pins give a valid eleven; a pin on an unavailable card never bypasses a ban, injury or loan', () => {
  const features = club();
  const weak = weakFavourite(features);
  const second = features.starXI.ownedIds.map((id) => getStarXIPlayer(id)!).filter((player) => player.id !== weak.id && !features.starXI.lineupIds.includes(player.id)).sort((a, b) => a.rating - b.rating)[5];
  togglePinnedStarter(features, weak.id); togglePinnedStarter(features, second.id);
  const eleven = best(features).lineupIds;
  assert.equal(eleven.filter(Boolean).length, 11);
  assert.ok(eleven.includes(weak.id) || eleven.includes(second.id), 'at least the placeable pins are in');
  // The same pins with the card unavailable (the caller passes banned, injured, loaned and suspended cards as blocked).
  const blocked = best(features, [weak.id]);
  assert.ok(!blocked.lineupIds.includes(weak.id) && !blocked.benchIds.includes(weak.id), 'a blocked pinned card stays out');
  assert.equal(blocked.lineupIds.filter(Boolean).length, 11, 'the eleven is still full');
  assert.deepEqual(blocked.pinnedPlayerIds, [weak.id, second.id], 'the pin itself is kept, it counts again when the card is back');
});

test('pins are saved with the club, loaded by older saves, limited, and lost when the card leaves', () => {
  const features = club();
  const weak = weakFavourite(features);
  assert.equal(togglePinnedStarter(features, 'not-a-card'), 'not-owned');
  togglePinnedStarter(features, weak.id);
  const reloaded = normalizeGameFeatures(JSON.parse(JSON.stringify(features)));
  assert.deepEqual(reloaded.starXI.pinnedPlayerIds, [weak.id], 'survives saving and loading');
  assert.deepEqual(best(reloaded).pinnedPlayerIds, [weak.id], 'and the best eleven keeps it');
  // An older save has no pins at all.
  const legacy = JSON.parse(JSON.stringify(features));
  delete legacy.starXI.pinnedPlayerIds;
  assert.equal(normalizeGameFeatures(legacy).starXI.pinnedPlayerIds, undefined);
  // A card the club no longer owns loses its pin on the next load.
  const sold = JSON.parse(JSON.stringify(features));
  sold.starXI.ownedIds = sold.starXI.ownedIds.filter((id: string) => id !== weak.id);
  assert.equal(normalizeGameFeatures(sold).starXI.pinnedPlayerIds, undefined);
  // At most one pin per place of the eleven.
  const full = club();
  for (const id of full.starXI.ownedIds.slice(0, MAX_PINNED_STARTERS)) assert.equal(togglePinnedStarter(full, id), 'pinned');
  assert.equal(togglePinnedStarter(full, full.starXI.ownedIds[MAX_PINNED_STARTERS]), 'limit');
  assert.equal(full.starXI.pinnedPlayerIds!.length, MAX_PINNED_STARTERS);
});

test('a formation change keeps the pin: the card is placed again where the new formation has a matching place', () => {
  const features = club();
  const weak = weakFavourite(features);
  togglePinnedStarter(features, weak.id);
  const changed = setStarXIFormation(best(features), '442');
  assert.deepEqual(changed.pinnedPlayerIds, [weak.id]);
  const again = setBestStarXI(changed, [], { career: features.career });
  assert.ok(again.lineupIds.includes(weak.id) || !weak.positions.some((position) => again.formationPositions.includes(position)), 'in the eleven, unless no place of the formation fits the card');
});
