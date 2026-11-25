"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "./confirm-dialog";
import { PRESTIGE_GOAL_BONUS_PER_LEVEL, getPrestigeKeepCandidates, getPrestigeRetainedSpecials, getStarXIPositions } from "./feature-data";
import type { GameFeatures } from "./feature-data";
import { formatNumber } from "./game/format";
import { t } from "./i18n/runtime";
import { UPGRADES } from "./game/upgrades";
import { getCareerCard } from "./career-data";
import { getTravelTime } from "./game/clock";
import { coopRoleLabel } from "./game/coop";
import type { CoopPrestigeVote, CoopRoom } from "./game/types";
import { HomeCityPicker } from "./home-city-picker";
import { HOME_CITIES, homeCityOf } from "./home-cities";
import type { HomeCityId } from "./home-cities";

/** Goal income bonus in percent after `count` Prestiges: 10, 20, 30, … */
export const prestigeBonusPercent = (count: number) => Math.round(Math.max(0, count) * PRESTIGE_GOAL_BONUS_PER_LEVEL * 100);
const percent = prestigeBonusPercent;

/** "Prestige 2 · +20 % Tore" next to the goal counter; nothing before the first Prestige. */
export function prestigeBonusLabel(prestigeCount: number) {
  return prestigeCount > 0 ? t("prestige.bonusLabel", { count: prestigeCount, percent: percent(prestigeCount) }) : "";
}

/**
 * Choose the one normal card that stays and confirm the reset. Cancelling changes nothing; the game state is only
 * touched by onConfirm. `upgradeLevels`: all Club Office levels bought so far, they go back to 0.
 */
export function PrestigeDialog({ features, goals, upgradeLevels, busy, error, onConfirm, onCancel, voteMembers = 0 }: { features: GameFeatures; goals: number; upgradeLevels: number; busy: boolean; error: string; onConfirm: (keepNormalId: string | null, homeCity: HomeCityId) => void; onCancel: () => void; voteMembers?: number }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef, onCancel);
  const specials = getPrestigeRetainedSpecials(features);
  // The rating with milestone bonuses: exactly what the card keeps when it is chosen.
  const ratingOf = (player: Parameters<typeof getCareerCard>[1]) => getCareerCard(features.career, player).rating;
  // Favourites first, then by rating; the strongest one is chosen already, a search narrows long lists (Q71).
  const favorites = new Set(features.favoriteIds ?? []);
  const candidates = [...getPrestigeKeepCandidates(features)].sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)) || ratingOf(b) - ratingOf(a) || a.name.localeCompare(b.name));
  const [keepId, setKeepId] = useState<string | null>(() => candidates[0]?.id ?? null);
  // The new run may start in another home city: the only moment it can change.
  const [homeCity, setHomeCity] = useState<HomeCityId>(() => homeCityOf(features.seasonMode.homeCity).id);
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("de-CH");
  const shown = candidates.filter((player) => !query || player.name.toLocaleLowerCase("de-CH").includes(query) || player.id === keepId);
  const statusOf = (playerId: string) => [
    favorites.has(playerId) ? t("prestige.favorite") : "",
    features.transferSaga.loans.some((loan) => loan.playerId === playerId) ? t("prestige.onLoan") : "",
    Number(features.cup.injuredPlayerIds?.[playerId]) > 0 ? t("prestige.injured") : "",
    features.transferSaga.pendingOffer?.playerId === playerId ? t("prestige.offerOpen") : "",
  ].filter(Boolean);
  const next = features.seasonMode.prestigeCount + 1;
  const squadAfter = specials.length + (keepId ? 1 : 0);
  const canConfirm = !busy && (candidates.length === 0 || Boolean(keepId));
  return createPortal(<div className="account-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <div ref={dialogRef} className="account-dialog confirm-dialog prestige-dialog" role="dialog" aria-modal="true" aria-labelledby="prestige-dialog-title">
      <h2 id="prestige-dialog-title">{t("prestige.title", { next })}</h2>
      <p>{t("prestige.intro", { count: UPGRADES.length })}</p>
      <dl className="prestige-summary">
        <div><dt>{t("prestige.goalBonus")}</dt><dd>+{percent(next - 1)} % → <strong>{t("prestige.percentGoals", { percent: percent(next) })}</strong> {t("prestige.onClicksIncome")}</dd></div>
        <div><dt>{t("prestige.goalBalance")}</dt><dd>{formatNumber(goals)} → <strong>0</strong></dd></div>
        <div><dt>{t("prestige.upgrades")}</dt><dd>{t("prestige.levels", { count: upgradeLevels, levels: formatNumber(upgradeLevels) })} → <strong>{t("prestige.level0")}</strong>{t("prestige.rebuy")}</dd></div>
        <div><dt>{t("prestige.homeCity")}</dt><dd>{homeCityOf(features.seasonMode.homeCity).name} → <strong>{HOME_CITIES[homeCity].name}</strong>{t("prestige.homeCityNote")}</dd></div>
        <div><dt>{t("prestige.squad")}</dt><dd>{t("prestige.cards", { count: features.starXI.ownedIds.length })} → <strong>{t("prestige.cards", { count: squadAfter })}</strong>{t("prestige.othersStay")}</dd></div>
        <div><dt>{t("prestige.cardBonuses")}</dt><dd>{t("prestige.cardBonusesBody")}</dd></div>
      </dl>
      <h3>{t("prestige.specialsStay", { count: specials.length })}</h3>
      <p className="prestige-names">{specials.length ? specials.map((player) => player.name).join(", ") : t("prestige.noSpecials")}</p>
      <h3>{t("prestige.keepOne")}</h3>
      {candidates.length > 8 && <input className="mode-input prestige-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("prestige.searchCard")} aria-label={t("prestige.searchKeep")} />}
      {candidates.length ? <fieldset className="prestige-choices" aria-label={t("prestige.keepNormal")}>
        {shown.map((player) => <label key={player.id} className={keepId === player.id ? "selected" : ""}>
          <input type="radio" name="prestige-keep" value={player.id} checked={keepId === player.id} onChange={() => setKeepId(player.id)} />
          <b>{ratingOf(player)}</b><span>{player.name}</span><small>{getStarXIPositions(player).join(" / ")}{statusOf(player.id).map((status) => <em key={status} className="prestige-status-chip">{status}</em>)}</small>
        </label>)}
      </fieldset> : <p>{t("prestige.noNormal")}</p>}
      <HomeCityPicker value={homeCity} onChange={setHomeCity} name="prestige-home-city" legend={t("prestige.homeCityLegend")} />
      {voteMembers > 0 && <p className="prestige-vote-note" role="note">{voteMembers === 1 ? t("prestige.voteNoteOne", { seconds: PRESTIGE_VOTE_SECONDS }) : t("prestige.voteNoteMany", { count: voteMembers, seconds: PRESTIGE_VOTE_SECONDS })}</p>}
      {error && <p className="prestige-error" role="alert">{error}</p>}
      <div className="confirm-dialog-actions">
        <button type="button" className="mode-secondary" onClick={onCancel}>{t("prestige.cancel")}</button>
        <button type="button" className="mode-primary" disabled={!canConfirm} onClick={() => onConfirm(keepId, homeCity)}>{candidates.length && !keepId ? t("prestige.chooseCard") : voteMembers > 0 ? t("prestige.startVote") : t("prestige.start", { next })}</button>
      </div>
    </div>
  </div>, document.body);
}

/** How long the online members of a co-op world have to agree (the server's PRESTIGE_VOTE_MS). */
export const PRESTIGE_VOTE_SECONDS = 60;

/** Seconds left of a vote on the server synchronised clock. */
export function prestigeVoteSecondsLeft(vote: Pick<CoopPrestigeVote, "expiresAt">, now = getTravelTime()) {
  return Math.max(0, Math.ceil((vote.expiresAt - now) / 1000));
}

/**
 * The open co-op Prestige vote, shown to every member: who proposed it, which card stays, who agreed and who is
 * still asked. A member who must vote agrees or declines; the proposer can cancel; everybody else may hide it.
 */
export function PrestigeVoteDialog({ vote, room, busy, onApprove, onDecline, onHide }: { vote: CoopPrestigeVote; room: CoopRoom; busy: boolean; onApprove: () => void; onDecline: () => void; onHide: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef, onHide);
  const [, setTick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setTick((value) => value + 1), 1000); return () => window.clearInterval(timer); }, []);
  const seconds = prestigeVoteSecondsLeft(vote);
  const nameOf = (role: CoopRoom["players"][number]["role"]) => room.players.find((player) => player.role === role)?.name ?? coopRoleLabel(role);
  const card = vote.keepName ?? (vote.keepNormalId ? t("prestige.aNormalCard") : t("prestige.noNormalCard"));
  return createPortal(<div className="account-overlay" role="presentation">
    <div ref={dialogRef} className="account-dialog confirm-dialog prestige-dialog prestige-vote-dialog" role="alertdialog" aria-modal="true" aria-labelledby="prestige-vote-title" aria-describedby="prestige-vote-description">
      <h2 id="prestige-vote-title">{t("prestige.voteTitle", { next: vote.prestigeCount + 1 })}</h2>
      <div id="prestige-vote-description">
        <p>{vote.viewerIsProposer ? t("prestige.youProposed", { next: vote.prestigeCount + 1 }) : t("prestige.nameProposed", { name: vote.proposerName, next: vote.prestigeCount + 1 })}</p>
        <dl className="prestige-summary">
          <div><dt>{t("prestige.homeCity")}</dt><dd><strong>{homeCityOf(vote.homeCity).name}</strong></dd></div>
          <div><dt>{t("prestige.keptCard")}</dt><dd><strong>{card}</strong> {t("prestige.andAllSpecials")}</dd></div>
          <div><dt>{t("prestige.goalBonus")}</dt><dd>+{percent(vote.prestigeCount)} % → <strong>{t("prestige.percentGoals", { percent: percent(vote.prestigeCount + 1) })}</strong></dd></div>
          <div><dt>{t("prestige.agreed")}</dt><dd>{vote.approvedRoles.map(nameOf).join(", ") || t("prestige.nobodyYet")}</dd></div>
          <div><dt>{t("prestige.stillOpen")}</dt><dd>{vote.waitingRoles.length ? vote.waitingRoles.map(nameOf).join(", ") : t("prestige.nobodyStarting")}</dd></div>
        </dl>
        <p className="prestige-vote-timer" role="timer" aria-live="off">{t("prestige.voteTimer", { count: seconds })}</p>
      </div>
      <div className="confirm-dialog-actions">
        {vote.viewerMustVote ? <>
          <button type="button" className="mode-secondary" disabled={busy} onClick={onDecline}>{t("prestige.decline")}</button>
          <button type="button" className="mode-primary" disabled={busy} onClick={onApprove}>{t("prestige.approve")}</button>
        </> : vote.viewerIsProposer ? <>
          <button type="button" className="mode-secondary" onClick={onHide}>{t("prestige.hide")}</button>
          <button type="button" className="mode-secondary danger" disabled={busy} onClick={onDecline}>{t("prestige.cancelVote")}</button>
        </> : <>
          {!vote.viewerApproved && <button type="button" className="mode-secondary" disabled={busy} onClick={onDecline}>{t("prestige.decline")}</button>}
          <button type="button" className="mode-primary" onClick={onHide}>{vote.viewerApproved ? t("prestige.close") : t("prestige.hide")}</button>
        </>}
      </div>
    </div>
  </div>, document.body);
}
