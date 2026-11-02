// Special cards start at 80 and grow to their potential of 100 through their own matches (2 November 2026).
import assert from 'node:assert/strict';
import test from 'node:test';
import { GROWTH_POINTS_PER_LEVEL, MATCH_RESULT_POINTS, emptyPlayerStats, getCareerCard, getSpecialGrowth, normalizeCareerState } from '../app/career-data.ts';
import { STAR_XI_CUSTOM_PLAYERS, cardPackRating, getSpecialCardPackOdds, getStarXIFragmentCompensation, getStarXIPlayer, initialGameFeatures, normalizeGameFeatures, SPECIAL_PACK_HUNDRED_CHANCE } from '../app/feature-data.ts';

const stats = (points: number, appearances = 0, goals = 0) => ({ ...emptyPlayerStats(), points, appearances, goals });

test('all ten special cards start at 80 with potential 100, their pack tier and Pfuschi stay as before', () => {
  assert.equal(STAR_XI_CUSTOM_PLAYERS.length, 10);
  for (const card of STAR_XI_CUSTOM_PLAYERS) {
    assert.equal(card.rating, 80, card.name);
    assert.equal(card.potential, 100, card.name);
  }
  assert.deepEqual(STAR_XI_CUSTOM_PLAYERS.filter((card) => cardPackRating(card) === 100).length, 8);
  assert.deepEqual(STAR_XI_CUSTOM_PLAYERS.filter((card) => cardPackRating(card) === 67).map((card) => card.id).sort(), ['star-benxli', 'star-pfuschi']);
  const pfuschi = getStarXIPlayer('star-pfuschi')!;
  assert.equal(pfuschi.benchOnly, true);
  // Rarity, chance and duplicate compensation of the special card pack did not change.
  assert.equal(getSpecialCardPackOdds().hundredChance.toFixed(6), SPECIAL_PACK_HUNDRED_CHANCE.toFixed(6));
  assert.equal(getStarXIFragmentCompensation(getStarXIPlayer('star-di-certo')!), 5000);
  assert.equal(getStarXIFragmentCompensation(pfuschi), 600);
});

test('every 5 match points of the card add one OVR, appearances and goals alone add nothing, up to 100', () => {
  const card = getStarXIPlayer('star-goat-nicu')!;
  const career = normalizeCareerState({});
  assert.equal(getCareerCard(career, card).rating, 80);
  // 30 appearances and 20 goals without points (all lost) are still 80.
  career.players[card.id] = stats(0, 30, 20);
  assert.equal(getSpecialGrowth(career, card).rating, 80);
  career.players[card.id] = stats(4);
  assert.equal(getSpecialGrowth(career, card).pointsToNext, 1);
  career.players[card.id] = stats(5);
  assert.equal(getSpecialGrowth(career, card).rating, 81);
  career.players[card.id] = stats(99);
  assert.equal(getCareerCard(career, card).rating, 99);
  career.players[card.id] = stats(100);
  assert.equal(getCareerCard(career, card).rating, 100);
  career.players[card.id] = stats(900);
  const full = getCareerCard(career, card);
  assert.equal(full.rating, 100);
  assert.equal(full.bonus, 20);
  assert.equal(full.growth?.nextLevelPoints, null);
  assert.equal(GROWTH_POINTS_PER_LEVEL, 5);
  assert.deepEqual(MATCH_RESULT_POINTS, { win: 3, draw: 1, loss: 0 });
  // No milestones on top: special cards only grow through their potential.
  assert.equal(full.milestone, undefined);
  assert.equal(normalizeCareerState(JSON.parse(JSON.stringify(career))).milestoneCards[card.id], undefined);
});

test('saves and worlds from before start every special card at 0 points; later results count', () => {
  const card = getStarXIPlayer('star-di-certo')!;
  // An old save: many appearances and goals, but no points counter yet.
  const raw = { version: 2, players: { [card.id]: { ...emptyPlayerStats(), appearances: 120, goals: 40, points: undefined } }, milestoneCards: { [card.id]: ['position-defender-appearances-3'] } };
  const old = normalizeCareerState(raw);
  assert.equal(old.version, 3);
  assert.equal(getCareerCard(old, card).rating, 80, 'a former 100 starts at 80 like everyone');
  assert.deepEqual(old.growthBase[card.id], { points: 0 });
  const reloaded = normalizeCareerState(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(reloaded.growthBase, old.growthBase);
  reloaded.players[card.id] = { ...reloaded.players[card.id], points: 10 };
  assert.equal(getCareerCard(reloaded, card).rating, 82);
});

test('growth raises the rating once, also in the match simulation; form stays the amplified bonus', async () => {
  const features = initialGameFeatures();
  features.cup.careerBonuses = { 'star-di-certo': 20, 'icon-gianluigi-buffon': 20 };
  features.cup.careerGrowth = { 'star-di-certo': 25, 'icon-gianluigi-buffon': 3 };
  const restored = normalizeGameFeatures(JSON.parse(JSON.stringify(features)));
  // Form and milestones stay capped at +5, growth at the card's potential and only for cards that have one.
  assert.equal(restored.cup.careerBonuses?.['star-di-certo'], 5);
  assert.equal(restored.cup.careerGrowth?.['star-di-certo'], 20);
  assert.equal(restored.cup.careerGrowth?.['icon-gianluigi-buffon'], 0);
  const { substituteSimPlayer } = await import('../app/interactive-match.ts');
  const card = getStarXIPlayer('star-di-certo')!;
  const old = { id: 'x', name: 'x', rating: 70 } as Parameters<typeof substituteSimPlayer>[0];
  assert.equal(substituteSimPlayer(old, card, 0, 7).rating, 87, 'seven levels are seven rating points');
  assert.equal(substituteSimPlayer(old, card, 1, 7).rating, 90, 'a form point is still worth three');
});
