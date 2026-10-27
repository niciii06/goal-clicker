import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameFeatures } from '../app/feature-data';
import type { GameFeatures } from '../app/feature-data';
import { HOME_VENUE, VENUES } from '../app/travel-geography';
import { matchStadium } from '../app/match-stadium';
import { expectedHomeCrowd, getTicketIncome, recordTicketIncome, TICKET_PRICE_FLOOR } from '../app/ticket-income';

function finishedMatch(fixture: Partial<NonNullable<GameFeatures['cup']['fixture']>> = {}, mode: 'season' | 'tournament' = 'season'): GameFeatures {
  const features = initialGameFeatures(1000);
  features.cup.mode = mode;
  features.cup.matchStartedAt = 5000;
  features.cup.careerMatchId = 'career:season-1-1';
  features.cup.fixture = { id: 'season-1-1', away: false, venue: HOME_VENUE, opponentId: 'geo-1-1', ...fixture };
  return features;
}

test('season home matches sell the crowd the stadium shows', () => {
  const features = finishedMatch();
  const tickets = getTicketIncome(features, 0)!;
  assert.equal(tickets.attendance, matchStadium(features).attendance);
  assert.equal(tickets.capacity, matchStadium(features).capacity);
  assert.ok(tickets.attendance > 0);
  // Early on the ticket price is the floor.
  assert.equal(tickets.income, tickets.attendance * TICKET_PRICE_FLOOR);
});

test('the ticket price grows with the passive income', () => {
  const features = finishedMatch();
  const tickets = getTicketIncome(features, 1_000_000)!;
  assert.equal(tickets.income, Math.floor(tickets.attendance * 4000));
  assert.equal(getTicketIncome(features, Number.NaN)!.income, tickets.attendance * TICKET_PRICE_FLOOR);
});

test('away matches, neutral venues and tournaments bring no ticket income', () => {
  assert.equal(getTicketIncome(finishedMatch({ away: true, venue: VENUES.wembley }), 100), null);
  assert.equal(getTicketIncome(finishedMatch({ neutral: true, venue: VENUES.wembley }), 100), null);
  assert.equal(getTicketIncome(finishedMatch({}, 'tournament'), 100), null);
  const noFixture = finishedMatch();
  delete noFixture.cup.fixture;
  assert.equal(getTicketIncome(noFixture, 100), null);
});

test('happy fans fill the home ground and a higher league has a bigger one', () => {
  const unhappy = finishedMatch(); unhappy.press.fanMood = 0;
  const happy = finishedMatch(); happy.press.fanMood = 100;
  assert.ok(getTicketIncome(happy, 0)!.attendance > getTicketIncome(unhappy, 0)!.attendance);
  const top = finishedMatch(); top.seasonMode.division = 15;
  assert.ok(getTicketIncome(top, 0)!.capacity > getTicketIncome(finishedMatch(), 0)!.capacity);
  assert.ok(expectedHomeCrowd(top) > expectedHomeCrowd(finishedMatch()));
});

test('the takings go on the match report and into the history', () => {
  const features = finishedMatch();
  features.career.reports.push({ id: 'career:season-1-1', opponent: 'FC Test', homeScore: 2, awayScore: 1, mode: 'season', createdAt: 6000, motmId: null, players: [], derby: false, derbyReward: 0 });
  const tickets = getTicketIncome(features, 0)!;
  recordTicketIncome(features, tickets, 7000);
  assert.deepEqual(features.career.reports.at(-1)!.tickets, tickets);
  assert.equal(features.history.at(-1)?.title, 'Ticketeinnahmen');
});
