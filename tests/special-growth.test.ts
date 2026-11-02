// Special cards start at 80 and grow to their potential of 100 through their own matches (2 November 2026).
import assert from 'node:assert/strict';
import test from 'node:test';
import { GROWTH_POINTS_PER_LEVEL, emptyPlayerStats, getCareerCard, getSpecialGrowth, normalizeCareerState } from '../app/career-data.ts';
import { STAR_XI_CUSTOM_PLAYERS, cardPackRating, getSpecialCardPackOdds, getStarXIFragmentCompensation, getStarXIPlayer, initialGameFeatures, normalizeGameFeatures, SPECIAL_PACK_HUNDRED_CHANCE } from '../app/feature-data.ts';

const stats = (appearances: number, goals = 0, assists = 0, motm = 0) => ({ ...emptyPlayerStats(), appearances, goals, assists, motm });

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

test('every 10 points of its own matches add one OVR, up to 100 and not beyond', () => {
  const card = getStarXIPlayer('star-goat-nicu')!;
  const career = normalizeCareerState({});
  assert.equal(getCareerCard(career, card).rating, 80);
  // Einsatz 1, Tor 2, Vorlage 1, Spieler des Spiels 3.
  career.players[card.id] = stats(4, 2, 1, 1);
  const growth = getSpecialGrowth(career, card);
  assert.equal(growth.points, 4 + 4 + 1 + 3);
  assert.equal(growth.rating, 81);
  assert.equal(growth.pointsToNext, 2 * GROWTH_POINTS_PER_LEVEL - 12);
  career.players[card.id] = stats(500, 300, 100, 50);
  const full = getCareerCard(career, card);
  assert.equal(full.rating, 100);
  assert.equal(full.bonus, 20);
  assert.equal(full.growth?.nextLevelPoints, null);
  // No milestones on top: special cards only grow through their potential.
  assert.equal(full.milestone, undefined);
  assert.equal(normalizeCareerState(JSON.parse(JSON.stringify(career))).milestoneCards[card.id], undefined);
});

test('saves and worlds from before start every special card at 0 points; later matches count', () => {
  const card = getStarXIPlayer('star-di-certo')!;
  const old = normalizeCareerState({ version: 2, players: { [card.id]: stats(120, 40, 30, 10) }, milestoneCards: { [card.id]: ['position-defender-appearances-3'] } });
  assert.equal(old.version, 3);
  assert.equal(getCareerCard(old, card).rating, 80, 'a former 100 starts at 80 like everyone');
  assert.deepEqual(old.growthBase[card.id], { appearances: 120, goals: 40, assists: 30, motm: 10 });
  // The starting point survives reloads, and only what comes after counts.
  const reloaded = normalizeCareerState(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(reloaded.growthBase, old.growthBase);
  reloaded.players[card.id] = stats(130, 41, 30, 10);
  assert.equal(getSpecialGrowth(reloaded, card).points, 12);
  assert.equal(getCareerCard(reloaded, card).rating, 81);
});

test('a match may carry the full growth of a special card, a normal card stays capped', () => {
  const features = initialGameFeatures();
  features.cup.careerBonuses = { 'star-di-certo': 20, 'icon-gianluigi-buffon': 20 };
  const restored = normalizeGameFeatures(JSON.parse(JSON.stringify(features)));
  assert.equal(restored.cup.careerBonuses?.['star-di-certo'], 20);
  assert.equal(restored.cup.careerBonuses?.['icon-gianluigi-buffon'], 5);
});
