"use client";

import type { TransferOffer } from "./feature-data";
import { TRANSFER_UNHAPPY_MATCHES, TRANSFER_UNHAPPY_PENALTY } from "./feature-data";
import { formatCountdown, formatNumber } from "./game/format";

/** Sell or keep buttons for a Fabrizio sale offer, with the time left to answer. */
export function TransferOfferActions({ offer, now, busy, onAnswer, onLater }: { offer: TransferOffer; now: number; busy: boolean; onAnswer: (accept: boolean) => void; onLater?: () => void }) {
  return <div className="transfer-offer-actions">
    <p>Behalten macht ihn {TRANSFER_UNHAPPY_MATCHES} Spiele unzufrieden (−{TRANSFER_UNHAPPY_PENALTY} OVR). Ohne Antwort verfällt das Angebot in {formatCountdown(offer.expiresAt, now)}.</p>
    <div>
      <button type="button" className="mode-primary" disabled={busy} onClick={() => onAnswer(true)}>{offer.fee > 0 ? `Verkaufen · +${formatNumber(offer.fee)} Goals` : "Gehen lassen"}</button>
      <button type="button" className="mode-secondary" disabled={busy} onClick={() => onAnswer(false)}>Behalten</button>
    </div>
    {onLater && <button type="button" className="transfer-offer-later" onClick={onLater}>Später entscheiden</button>}
  </div>;
}
