// Fabrizio offers, owner's decisions of 12 November 2026 (Notion «Fabrizio-Transfers»):
// keeping a player against a paid offer resets the milestones of exactly this card (instead of -2 OVR for three
// matches), an unanswered offer lapses without any consequence, special cards keep their upgrades and potential,
// fee-free contract ends stay automatic. Older saves keep working: their open offers and unhappy players are honoured.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acceptTransferOffer, declineTransferOffer, expireTransferOffer, getStarXIPlayer, initialGameFeatures, lockMatchSquad, normalizeGameFeatures,
  setBestStarXI, STAR_XI_PLAYERS, TRANSFER_DECLINE_REASONS, TRANSFER_OFFER_DURATION_MS, TRANSFER_UNHAPPY_MATCHES, TRANSFER_UNHAPPY_PENALTY,
  transferDeclinedLabel, transferKeepConsequence, transferUnhappyMatches,
} from '../app/feature-data.ts';
import type { GameFeatures, TransferOffer } from '../app/feature-data.ts';
import { emptyPlayerStats, getCareerCard, getMilestoneStats, getSpecialGrowth, hasPotential, prepareCareerMatch } from '../app/career-data.ts';

const NORMAL = STAR_XI_PLAYERS.filter((p) => !hasPotential(p) && p.rating <= 90);
const SPECIAL = STAR_XI_PLAYERS.filter((p) => hasPotential(p));

/** All cards owned, the offered card and one other card with milestones from 30 appearances and 12 goals. */
function club(playerId: string, otherId: string, now = 1000) {
  const features = initialGameFeatures(now);
  features.starXI = setBestStarXI({ ...features.starXI, ownedIds: STAR_XI_PLAYERS.map((p) => p.id) });
  for (const id of [playerId, otherId]) features.career.players[id] = { ...emptyPlayerStats(), appearances: 30, minutes: 2400, goals: 12, assists: 6, motm: 2, points: 40 };
  return normalizeGameFeatures(JSON.parse(JSON.stringify(features)));
}
function withOffer(features: GameFeatures, playerId: string, fee: number, createdAt = 2000): GameFeatures {
  const offer: TransferOffer = { id: `transfer-offer-${createdAt}-${playerId}`, outcome: 'offer', playerId, playerName: getStarXIPlayer(playerId)!.name, club: 'Testclub', headline: 'Angebot auf dem Tisch', message: '', reason: 'Kaufangebot', fee, createdAt, expiresAt: createdAt + TRANSFER_OFFER_DURATION_MS };
  return { ...features, transferSaga: { ...features.transferSaga, pendingOffer: offer } };
}
const reload = (features: GameFeatures) => normalizeGameFeatures(JSON.parse(JSON.stringify(features)));

test('keeping against a paid offer resets the milestones of exactly this card, nothing else', () => {
  const [card, other] = NORMAL;
  const before = club(card.id, other.id);
  const lostBonus = getCareerCard(before.career, card).bonus;
  assert.ok(lostBonus > 0, 'the card had milestones to lose');
  assert.match(transferKeepConsequence(before, { playerId: card.id, fee: 500 }), new RegExp(`Meilensteine zurück \\(−${lostBonus} OVR\\)`));

  const kept = declineTransferOffer(withOffer(before, card.id, 500), 3000);
  assert.equal(kept.error, undefined);
  assert.equal(kept.goalDelta, 0);
  assert.equal(kept.event?.outcome, 'declined');
  assert.equal(kept.event?.reason, TRANSFER_DECLINE_REASONS.kept);
  assert.equal(transferDeclinedLabel(kept.event!), 'BLEIBT · MEILENSTEINE ZURÜCKGESETZT');
  assert.match(kept.event!.message, new RegExp(`−${lostBonus} OVR`));
  const after = kept.features;
  assert.ok(after.starXI.ownedIds.includes(card.id), 'the player stays');
  assert.equal(after.transferSaga.pendingOffer, null);
  assert.equal(getCareerCard(after.career, card).bonus, 0);
  assert.equal(after.career.milestoneCards[card.id], undefined);
  assert.deepEqual(getMilestoneStats(after.career, card.id), { appearances: 0, minutes: 0, goals: 0, assists: 0, motm: 0 }, 'progress starts at zero');
  // No temporary penalty any more.
  assert.equal(transferUnhappyMatches(after, card.id), 0);
  // Everything else is untouched: lifetime statistics, album, the other card, its milestones.
  assert.deepEqual(after.career.players[card.id], before.career.players[card.id]);
  assert.deepEqual(after.career.collectedIds, before.career.collectedIds);
  assert.deepEqual(after.career.milestoneCards[other.id], before.career.milestoneCards[other.id]);
  assert.equal(getCareerCard(after.career, other).bonus, getCareerCard(before.career, other).bonus);
  assert.deepEqual(after.starXI.lineupIds, before.starXI.lineupIds);

  // A reload or co-op normalisation never brings the old milestones back from the old statistics.
  const reloaded = reload(reload(after));
  assert.equal(getCareerCard(reloaded.career, card).bonus, 0);
  assert.equal(reloaded.career.milestoneCards[card.id], undefined);
  // The next match has neither milestone bonus nor the old -2.
  reloaded.cup.matchStartedAt = 5000;
  prepareCareerMatch(reloaded);
  assert.ok((reloaded.cup.careerBonuses?.[card.id] ?? 0) >= 0, 'no penalty in the match');
  assert.notEqual(reloaded.cup.careerBonuses?.[card.id], -TRANSFER_UNHAPPY_PENALTY);

  // Only new matches count: 10 more appearances unlock the first appearance milestone again.
  const replayed = reload(reloaded);
  replayed.career.players[card.id] = { ...replayed.career.players[card.id], appearances: replayed.career.players[card.id].appearances + 10 };
  const regained = reload(replayed);
  assert.equal(getMilestoneStats(regained.career, card.id).appearances, 10);
  assert.ok(getCareerCard(regained.career, card).bonus >= 1, 'milestones grow again from new matches');
  assert.ok(getCareerCard(regained.career, card).bonus < lostBonus || lostBonus === 1);
});

test('keeping a player who was still unhappy from an older save ends that penalty: no double punishment', () => {
  const [card, other] = NORMAL;
  const features = withOffer(club(card.id, other.id), card.id, 800);
  features.transferSaga.unhappy = [{ playerId: card.id, club: 'Altclub', matchesLeft: 2 }];
  const kept = declineTransferOffer(reload(features), 3000).features;
  assert.equal(transferUnhappyMatches(kept, card.id), 0);
  assert.equal(getCareerCard(kept.career, card).bonus, 0);
});

test('special cards kept against a paid offer keep their growth, upgrades and potential', () => {
  const special = SPECIAL[0];
  assert.ok(special, 'the catalogue has special cards');
  const before = club(special.id, NORMAL[1].id);
  const growth = getSpecialGrowth(before.career, special);
  assert.ok(growth.levels > 0, 'the special card has grown');
  assert.match(transferKeepConsequence(before, { playerId: special.id, fee: 500 }), /Spezialkarte .* Upgrades und Potential/);
  const kept = declineTransferOffer(withOffer(before, special.id, 500), 3000);
  assert.equal(kept.event?.reason, TRANSFER_DECLINE_REASONS.keptSpecial);
  assert.equal(transferDeclinedLabel(kept.event!), 'BLEIBT · UPGRADES UND POTENTIAL BLEIBEN');
  assert.deepEqual(getSpecialGrowth(kept.features.career, special), growth);
  assert.deepEqual(kept.features.career.growthBase, before.career.growthBase);
  assert.deepEqual(kept.features.career.milestoneBase, before.career.milestoneBase);
  assert.deepEqual(kept.features.starXI, before.starXI);
  assert.deepEqual(getSpecialGrowth(reload(kept.features).career, special), growth);
  assert.equal(transferUnhappyMatches(kept.features, special.id), 0);
});

test('an unanswered paid offer lapses without reset and without penalty', () => {
  const [card, other] = NORMAL;
  const before = withOffer(club(card.id, other.id), card.id, 900);
  const expiresAt = before.transferSaga.pendingOffer!.expiresAt;
  assert.equal(expireTransferOffer(before, expiresAt - 1).event, null);
  const lapsed = expireTransferOffer(before, expiresAt);
  assert.equal(lapsed.event?.outcome, 'declined');
  assert.equal(lapsed.event?.headline, 'Angebot verfallen');
  assert.equal(lapsed.event?.reason, TRANSFER_DECLINE_REASONS.expired);
  assert.equal(transferDeclinedLabel(lapsed.event!), 'ANGEBOT VERFALLEN · BLEIBT');
  assert.match(lapsed.event!.message, /ohne Folgen/);
  assert.equal(lapsed.features.transferSaga.pendingOffer, null);
  assert.ok(lapsed.features.starXI.ownedIds.includes(card.id));
  assert.deepEqual(lapsed.features.career.milestoneCards, before.career.milestoneCards);
  assert.deepEqual(lapsed.features.career.milestoneBase, before.career.milestoneBase);
  assert.equal(transferUnhappyMatches(lapsed.features, card.id), 0);
  // A match stops the clock as before: the offer is not lapsed during it.
  const locked = normalizeGameFeatures(before);
  lockMatchSquad(locked, 'fixture-1', expiresAt - 1000);
  assert.equal(expireTransferOffer(locked, expiresAt + 999999).event, null);
});

test('an open fee-free offer from an older save stays answerable and keeping it costs nothing', () => {
  const [card, other] = NORMAL;
  const legacy = reload(withOffer(club(card.id, other.id), card.id, 0));
  assert.equal(legacy.transferSaga.pendingOffer?.fee, 0, 'the offer survives normalisation');
  assert.ok(legacy.starXI.ownedIds.includes(card.id), 'nobody is taken away retroactively');
  assert.equal(transferKeepConsequence(legacy, legacy.transferSaga.pendingOffer!), 'Behalten hat keine Folgen.');
  const kept = declineTransferOffer(legacy, 3000);
  assert.equal(kept.event?.reason, TRANSFER_DECLINE_REASONS.keptFree);
  assert.equal(transferDeclinedLabel(kept.event!), 'BLEIBT');
  assert.deepEqual(kept.features.career.milestoneCards, legacy.career.milestoneCards);
  assert.equal(transferUnhappyMatches(kept.features, card.id), 0);
  // Letting him go still works for such an offer: a contract end without Goals.
  const gone = acceptTransferOffer(legacy, 3000);
  assert.equal(gone.goalDelta, 0);
  assert.equal(gone.features.starXI.ownedIds.includes(card.id), false);
});

test('players made unhappy before the update keep their old penalty until it wears off', () => {
  const [card, other] = NORMAL;
  const old = club(card.id, other.id);
  old.transferSaga.unhappy = [{ playerId: card.id, club: 'Altclub', matchesLeft: TRANSFER_UNHAPPY_MATCHES }];
  const reloaded = reload(old);
  assert.equal(transferUnhappyMatches(reloaded, card.id), TRANSFER_UNHAPPY_MATCHES);
  reloaded.cup.matchStartedAt = 5000;
  prepareCareerMatch(reloaded);
  assert.equal(reloaded.cup.careerBonuses?.[card.id] ?? 0, getCareerCard(old.career, card).bonus - TRANSFER_UNHAPPY_PENALTY);
  assert.deepEqual(reloaded.career.milestoneCards[card.id], old.career.milestoneCards[card.id], 'their milestones are not reset retroactively');
  // Their old announcements still read as before.
  assert.equal(transferDeclinedLabel({ reason: TRANSFER_DECLINE_REASONS.legacyUnhappy }), `BLEIBT · ${TRANSFER_UNHAPPY_MATCHES} SPIELE UNZUFRIEDEN`);
});

test('an offer is answered once, never during a match, and selling still pays and removes the player', () => {
  const [card, other] = NORMAL;
  const offered = withOffer(club(card.id, other.id), card.id, 700);
  const kept = declineTransferOffer(offered, 3000);
  assert.ok(declineTransferOffer(kept.features, 3001).error, 'a second keep finds no offer');
  assert.ok(acceptTransferOffer(kept.features, 3001).error, 'and nothing can be sold afterwards');
  assert.equal(getCareerCard(declineTransferOffer(kept.features, 3001).features.career, card).bonus, 0);

  const during = normalizeGameFeatures(offered);
  lockMatchSquad(during, 'fixture-2', 2500);
  const blocked = declineTransferOffer(during, 3000);
  assert.match(blocked.error ?? '', /Spiels oder einer Reise/);
  assert.deepEqual(blocked.features.career.milestoneCards[card.id], offered.career.milestoneCards[card.id], 'nothing is reset while blocked');

  const sold = acceptTransferOffer(offered, 3000);
  assert.equal(sold.goalDelta, 700);
  assert.equal(sold.features.starXI.ownedIds.includes(card.id), false);
  assert.ok(sold.features.career.collectedIds.includes(card.id), 'the album keeps the card');
});

test('the offer text names the consequence for women players with their pronouns', () => {
  const woman = NORMAL.find((p) => p.isWomen);
  if (!woman) return;
  const features = club(woman.id, NORMAL.find((p) => p.id !== woman.id)!.id);
  assert.match(transferKeepConsequence(features, { playerId: woman.id, fee: 100 }), /ihre Meilensteine .* Sie muss/);
});
