"use client";

import type { GameFeatures, TransferOffer } from "./feature-data";
import { getStarXIPlayer, transferKeepOutcome } from "./feature-data";
import { pronounText } from "./player-pronouns";
import { formatCountdown, formatNumber } from "./game/format";
import { t } from "./i18n/runtime";

/** The consequence of keeping, in the current language (German exactly as transferKeepConsequence words it). */
function keepConsequence(features: Pick<GameFeatures, "career">, offer: TransferOffer) {
  const outcome = transferKeepOutcome(features, offer);
  if (outcome.kind === "none") return t("transfer.keepNoConsequence");
  if (outcome.kind === "special") return pronounText(t("transfer.keepSpecial"), outcome.player);
  return pronounText(outcome.bonus > 0 ? t("transfer.keepResetBonus", { bonus: outcome.bonus }) : t("transfer.keepReset"), outcome.player);
}

/**
 * Sell or keep buttons for a Fabrizio sale offer, with the time left to answer. The consequence of keeping is
 * stated before the choice; selling stays the primary button, keeping (which can reset milestones) the secondary.
 */
export function TransferOfferActions({ offer, features, now, busy, onAnswer, onLater }: { offer: TransferOffer; features: Pick<GameFeatures, "career">; now: number; busy: boolean; onAnswer: (accept: boolean) => void; onLater?: () => void }) {
  const player = offer.playerId ? getStarXIPlayer(offer.playerId) : null;
  return <div className="transfer-offer-actions">
    <p>{keepConsequence(features, offer)} {pronounText(t("transfer.expiresIn", { time: formatCountdown(offer.expiresAt, now) }), player)}</p>
    <div>
      <button type="button" className="mode-primary" disabled={busy} onClick={() => onAnswer(true)}>{offer.fee > 0 ? t("transfer.sellFor", { fee: formatNumber(offer.fee) }) : t("transfer.letGo")}</button>
      <button type="button" className="mode-secondary" disabled={busy} onClick={() => onAnswer(false)}>{t("transfer.keep")}</button>
    </div>
    {onLater && <button type="button" className="transfer-offer-later" onClick={onLater}>{t("transfer.decideLater")}</button>}
  </div>;
}
