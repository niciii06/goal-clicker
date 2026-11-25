'use client';
// An own player's injury pauses the match (app/interactive-match.ts sets lastInjury, status 'editing' and matchPaused).
// The substitutions then open by themselves, once per injury: the key is the injury's event id within this match, not
// its time (pauses shift createdAt). The handled key stays on this device, so a reload or a co-op update of the same
// injury does not open it again, while a new injury does. Ordinary pauses, half time and opponent injuries do nothing.
import { useEffect, useState } from 'react';
import type { GameFeatures } from './feature-data';
import { readPref, writePref } from './qol/prefs';

export const INJURY_HANDLED_KEY = 'goal-clicker-injury-handled';

export type PendingInjury = { key: string; playerId: string; player: string; slot: number };

/** The own-player injury that paused this match and still waits for a decision, or null. */
export function pendingOwnInjury(f: GameFeatures): PendingInjury | null {
  const c = f.cup, injury = c.lastInjury;
  if (!c.active || !c.matchPaused || !injury || c.phase === 'penalties') return null;
  if (c.simulation && c.simulation.status !== 'editing') return null;
  const slot = f.starXI.lineupIds.indexOf(injury.playerId);
  if (slot < 0 || c.sentOffPlayerIds.includes(injury.playerId)) return null;
  return { key: `${c.careerMatchId ?? c.tournamentId}|${injury.id}|${injury.playerId}`, playerId: injury.playerId, player: injury.player, slot };
}

/**
 * Calls `open` once for every new own-player injury and returns the injury while it waits for a decision. When the
 * injury it opened for is settled elsewhere (the other co-op seat substituted or played on), `close` runs once.
 */
export function useInjuryAutoOpen(f: GameFeatures, open: () => void, close?: () => void) {
  const injury = pendingOwnInjury(f);
  const [handled, setHandled] = useState<string | null>(() => readPref(INJURY_HANDLED_KEY));
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (injury && injury.key !== handled) { setHandled(injury.key); setOpenedFor(injury.key); open(); }
  else if (openedFor && injury?.key !== openedFor) { setOpenedFor(null); close?.(); }
  useEffect(() => { if (handled) writePref(INJURY_HANDLED_KEY, handled); }, [handled]);
  return injury;
}
