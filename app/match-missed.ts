import { getCupRegularDurationMs, getStarXIPlayer } from './feature-data';
import type { CupState } from './feature-data';

/** A simulated match keeps running while the app is closed; these are the scenes the player did not see. */
export type MissedMatchEntry = { id: string; minute: number; at: number; text: string };

/** First line of the banner; the summary replaces it once the match has caught up. */
export const MATCH_RAN_WHILE_AWAY = 'Deine Partie lief weiter, während du weg warst.';

/** True when the saved match was still running in play: it went on while nobody was on the page. */
export function matchRanWhileAway(cup: CupState) {
  return cup.active && Boolean(cup.simulation) && !cup.matchPaused && cup.phase !== 'penalties' && cup.simulation?.status !== 'completed';
}

/** True once the match has caught up with the moment the player came back (or cannot advance any further). */
export function missedMatchCaughtUp(cup: CupState, until: number) {
  const sim = cup.simulation;
  if (!cup.active || cup.matchPaused || cup.phase === 'penalties' || !sim || sim.status !== 'running') return true;
  const playedUntil = cup.matchStartedAt + sim.time * getCupRegularDurationMs(cup) / 5400;
  return playedUntil >= Math.min(until, cup.matchEndsAt) - 2000;
}

/** Goals, cards, injuries and substitutions of the match between `since` and `until`, in match order. */
export function getMissedMatchEvents(cup: CupState, since: number, until: number): MissedMatchEntry[] {
  const inWindow = (at: number) => at > since && at <= until;
  const entries = new Map<string, MissedMatchEntry>();
  const add = (id: string, minute: number, at: number, text: string) => { if (inWindow(at) && !entries.has(id)) entries.set(id, { id, minute, at, text }); };
  for (const goal of cup.matchEvents) {
    add(`goal:${goal.id}`, goal.minute, goal.createdAt, goal.side === 'home' ? `Tor durch ${goal.scorer} (${goal.homeScore}:${goal.awayScore})` : `Gegentor durch ${goal.scorer} (${goal.homeScore}:${goal.awayScore})`);
  }
  for (const card of cup.cardEvents) {
    add(`card:${card.id}`, card.minute, card.createdAt, card.side === 'home' ? `Rote Karte für ${card.player}` : `Rote Karte für ${card.player} (${cup.opponent})`);
  }
  for (const injury of cup.injuryEvents) {
    add(`injury:${injury.id}`, injury.minute, injury.createdAt, `${injury.player} verletzt sich`);
  }
  for (const event of cup.broadcast?.events ?? []) {
    if (event.kind === 'yellow') add(`yellow:${event.id}`, event.minute, event.at, event.side === 'club' ? `Gelbe Karte für ${event.player}` : `Gelbe Karte für ${event.player} (${cup.opponent})`);
    if (event.kind === 'substitution') {
      const outgoing = event.side === 'club' ? getStarXIPlayer(event.secondaryId ?? '')?.name : cup.broadcast?.opponentXI.find((p) => p.id === event.secondaryId)?.name;
      const text = `${event.player} kommt${outgoing ? ` für ${outgoing}` : ''}`;
      add(`sub:${event.id}`, event.minute, event.at, event.side === 'club' ? `Wechsel: ${text}` : `Wechsel bei ${cup.opponent}: ${text}`);
    }
  }
  return [...entries.values()].sort((a, b) => a.at - b.at || a.minute - b.minute);
}

/** Short banner text: what happened while away, at most `limit` scenes, then the state the match is in now. */
export function summarizeMissedMatch(cup: CupState, since: number, until: number, limit = 6) {
  const events = getMissedMatchEvents(cup, since, until);
  const shown = events.slice(0, limit).map((e) => `${e.minute}′ ${e.text}`);
  const more = events.length - shown.length;
  const missed = shown.length ? ` Was du verpasst hast: ${shown.join(' · ')}${more > 0 ? ` · und ${more} weitere` : ''}.` : ' Verpasst hast du keine Tore, Karten, Verletzungen oder Wechsel.';
  const state = !cup.active ? ` Schlusspfiff: ${cup.homeScore}:${cup.awayScore} gegen ${cup.opponent}.`
    : cup.phase === 'penalties' ? ' Jetzt wartet das Elfmeterschiessen auf dich.'
      : cup.simulation?.status === 'halftime' ? ` Halbzeit beim Stand von ${cup.homeScore}:${cup.awayScore}, die zweite Hälfte wartet auf dich.`
        : cup.matchPaused ? ' Die Partie ist unterbrochen und wartet auf dich.'
          : ` Stand jetzt: ${cup.homeScore}:${cup.awayScore}.`;
  return `${MATCH_RAN_WHILE_AWAY}${missed}${state}`;
}
