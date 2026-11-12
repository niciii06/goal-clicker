"use client";

import type { GameFeatures, TransferOffer } from "./feature-data";
import { getStarXIPlayer, transferKeepConsequence } from "./feature-data";
import { pronounText } from "./player-pronouns";
import { formatCountdown, formatNumber } from "./game/format";

/**
 * Sell or keep buttons for a Fabrizio sale offer, with the time left to answer. The consequence of keeping is
 * stated before the choice; selling stays the primary button, keeping (which can reset milestones) the secondary.
 */
export function TransferOfferActions({ offer, features, now, busy, onAnswer, onLater }: { offer: TransferOffer; features: Pick<GameFeatures, "career">; now: number; busy: boolean; onAnswer: (accept: boolean) => void; onLater?: () => void }) {
  const player = offer.playerId ? getStarXIPlayer(offer.playerId) : null;
  return <div className="transfer-offer-actions">
    <p>{transferKeepConsequence(features, offer)} Ohne Antwort verfällt das Angebot in {formatCountdown(offer.expiresAt, now)}, {pronounText("{er} bleibt dann ohne Folgen.", player)}</p>
    <div>
      <button type="button" className="mode-primary" disabled={busy} onClick={() => onAnswer(true)}>{offer.fee > 0 ? `Verkaufen · +${formatNumber(offer.fee)} Goals` : "Gehen lassen"}</button>
      <button type="button" className="mode-secondary" disabled={busy} onClick={() => onAnswer(false)}>Behalten</button>
    </div>
    {onLater && <button type="button" className="transfer-offer-later" onClick={onLater}>Später entscheiden</button>}
  </div>;
}
