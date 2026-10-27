// Ticket income of season home matches: the crowd the stadium shows (fan mood, opponent, derby, table,
// weather and kick-off time) times a ticket price that grows with the club's passive income.
import type { CareerMatchReport } from './career-data';
import { addHistory } from './feature-data';
import type { GameFeatures } from './feature-data';
import { formatNumber } from './game/format';
import { matchStadium } from './match-stadium';
import { stadiumProfile } from './stadium-profiles';

export const TICKET_PRICE_FLOOR = 5;
export const TICKET_PRICE_PER_PASSIVE_GOAL = 0.004;
export type TicketIncome = NonNullable<CareerMatchReport['tickets']>;

/**
 * Takings of the season match in `features.cup` while its fixture is still set, or null for away matches,
 * neutral venues and tournaments. Must run before recordSeasonModeMatch moves the table on to the next fixture.
 */
export function getTicketIncome(features: GameFeatures, passivePerSecond: number): TicketIncome | null {
  const cup = features.cup, fixture = cup.fixture;
  if (cup.mode !== 'season' || !fixture || fixture.away || fixture.neutral) return null;
  const { attendance, capacity } = matchStadium(features);
  const price = Math.max(TICKET_PRICE_FLOOR, (Number.isFinite(passivePerSecond) ? Math.max(0, passivePerSecond) : 0) * TICKET_PRICE_PER_PASSIVE_GOAL);
  return { attendance, capacity, income: Math.floor(attendance * price) };
}

/** Puts the takings on the match report and in the history; the caller adds `income` to the goals. */
export function recordTicketIncome(features: GameFeatures, tickets: TicketIncome, now: number) {
  const report = features.career.reports.find((entry) => entry.id === features.cup.careerMatchId);
  if (report) report.tickets = tickets;
  addHistory(features, { title: 'Ticketeinnahmen', detail: `${tickets.attendance.toLocaleString('de-CH')} Zuschauer · +${formatNumber(tickets.income)} Tore`, tone: 'positive' }, now);
}

/** Rough crowd of the next home match before kick-off: own ground and fan mood, without the match factors. */
export function expectedHomeCrowd(features: Pick<GameFeatures, 'seasonMode' | 'press'>) {
  return stadiumProfile(undefined, { home: true, homeDivision: features.seasonMode.division, fanMood: features.press.fanMood, seed: 'preview' }).attendance;
}
