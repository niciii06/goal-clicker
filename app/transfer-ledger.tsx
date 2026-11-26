"use client";
// The two ledger cards of the «Fabrizio» tab, moved out of game-app.tsx (Notion: Monolithische UI schrittweise
// modularisieren, step 2): players currently out on loan and the last twelve transfer events, newest first.
// Display only; the transfer rules stay in feature-data.
import { memo, useMemo } from "react";
import type { StarXIPlayer, TransferInsiderEvent, TransferLoan } from "./features/types";
import { formatHistoryTime, formatNumber } from "./game/format";
import { t } from "./i18n/runtime";

const OUTCOME_SYMBOL: Partial<Record<TransferInsiderEvent["outcome"], string>> = { sale: "↗", return: "↙", declined: "✋" };

function archiveLine(event: TransferInsiderEvent) {
  if (event.outcome === "return") return t("fabrizio.backFrom", { club: event.club });
  if (event.outcome === "declined") return t("fabrizio.keptWanted", { club: event.club });
  const action = event.outcome === "sale" ? t("fabrizio.soldTo", { club: event.club }) : t("fabrizio.loanedToClub", { club: event.club });
  return `${action}${event.fee > 0 ? t("fabrizio.feeSuffix", { fee: formatNumber(event.fee) }) : event.outcome === "sale" ? t("fabrizio.freeSuffix") : ""}`;
}

export const TransferLedger = memo(function TransferLedger({ loans, archive }: { loans: readonly { loan: TransferLoan; player: StarXIPlayer }[]; archive: readonly TransferInsiderEvent[] }) {
  const recent = useMemo(() => [...archive].reverse(), [archive]);
  return <div className="transfer-ledger-grid">
    <section className="transfer-ledger-card">
      <div className="transfer-ledger-heading"><div><p className="eyebrow">{t("fabrizio.loanStationsEyebrow")}</p><h4>{t("fabrizio.currentlyLoaned")}</h4></div><span>{loans.length}</span></div>
      {loans.length ? <div className="transfer-ledger-list">{loans.map(({ loan, player }) => <article key={`loan-${loan.playerId}`}>
        <span>{player?.name.slice(0, 1) ?? "?"}</span>
        <div><strong>{player?.name ?? t("fabrizio.unknownPlayer")}</strong><small>{loan.club} · {loan.status === "active" ? t("fabrizio.returnsAfterMatch") : t("fabrizio.missesNextSeasonMatch")}</small></div>
        <b>{t("fabrizio.loanCaps")}</b>
      </article>)}</div> : <div className="transfer-ledger-empty">{t("fabrizio.noLoans")}</div>}
    </section>
    <section className="transfer-ledger-card">
      <div className="transfer-ledger-heading"><div><p className="eyebrow">{t("fabrizio.ledgerEyebrow")}</p><h4>{t("fabrizio.history")}</h4></div><span>{recent.length}</span></div>
      {recent.length ? <div className="transfer-ledger-list archive">{recent.slice(0, 12).map((event) => <article key={`archive-${event.id}`}>
        <span>{OUTCOME_SYMBOL[event.outcome] ?? "⇄"}</span>
        <div><strong>{event.playerName ?? t("fabrizio.severalPlayers")}</strong><small>{archiveLine(event)}</small></div>
        <b>{formatHistoryTime(event.createdAt)}</b>
      </article>)}</div> : <div className="transfer-ledger-empty">{t("fabrizio.noDeparturesYet")}</div>}
    </section>
  </div>;
});
