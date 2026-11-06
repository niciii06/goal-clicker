"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "./confirm-dialog";
import { PRESTIGE_GOAL_BONUS_PER_LEVEL, getPrestigeKeepCandidates, getPrestigeRetainedSpecials, getStarXIPositions } from "./feature-data";
import type { GameFeatures } from "./feature-data";
import { formatNumber } from "./game/format";
import { UPGRADES } from "./game/upgrades";
import { getCareerCard } from "./career-data";
import { getTravelTime } from "./game/clock";
import { coopRoleLabel } from "./game/coop";
import type { CoopPrestigeVote, CoopRoom } from "./game/types";

/** Goal income bonus in percent after `count` Prestiges: 20, 40, 60, … */
export const prestigeBonusPercent = (count: number) => Math.round(Math.max(0, count) * PRESTIGE_GOAL_BONUS_PER_LEVEL * 100);
const percent = prestigeBonusPercent;

/** "Prestige 2 · +40 % Tore" next to the goal counter; nothing before the first Prestige. */
export function prestigeBonusLabel(prestigeCount: number) {
  return prestigeCount > 0 ? `Prestige ${prestigeCount} · +${percent(prestigeCount)} % Tore` : "";
}

/**
 * Choose the one normal card that stays and confirm the reset. Cancelling changes nothing; the game state is only
 * touched by onConfirm. `upgradeLevels`: all Club Office levels bought so far, they go back to 0.
 */
export function PrestigeDialog({ features, goals, upgradeLevels, busy, error, onConfirm, onCancel, voteMembers = 0 }: { features: GameFeatures; goals: number; upgradeLevels: number; busy: boolean; error: string; onConfirm: (keepNormalId: string | null) => void; onCancel: () => void; voteMembers?: number }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef, onCancel);
  const specials = getPrestigeRetainedSpecials(features);
  // The rating with milestone bonuses: exactly what the card keeps when it is chosen.
  const ratingOf = (player: Parameters<typeof getCareerCard>[1]) => getCareerCard(features.career, player).rating;
  const candidates = [...getPrestigeKeepCandidates(features)].sort((a, b) => ratingOf(b) - ratingOf(a) || a.name.localeCompare(b.name));
  const [keepId, setKeepId] = useState<string | null>(null);
  const next = features.seasonMode.prestigeCount + 1;
  const squadAfter = specials.length + (keepId ? 1 : 0);
  const canConfirm = !busy && (candidates.length === 0 || Boolean(keepId));
  return createPortal(<div className="account-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <div ref={dialogRef} className="account-dialog confirm-dialog prestige-dialog" role="dialog" aria-modal="true" aria-labelledby="prestige-dialog-title">
      <h2 id="prestige-dialog-title">Prestige {next} starten?</h2>
      <p>Der Aufstiegslauf beginnt wieder in Saison 1. Alle {UPGRADES.length} Upgrades im Club Office starten wieder bei Stufe 0. Freischaltungen, Fragmente, ungeöffnete Packs und Vereinssterne bleiben.</p>
      <dl className="prestige-summary">
        <div><dt>Torbonus</dt><dd>+{percent(next - 1)} % → <strong>+{percent(next)} % Tore</strong> auf Klicks und passives Einkommen</dd></div>
        <div><dt>Torkontostand</dt><dd>{formatNumber(goals)} → <strong>0</strong></dd></div>
        <div><dt>Upgrades</dt><dd>{formatNumber(upgradeLevels)} {upgradeLevels === 1 ? "Stufe" : "Stufen"} → <strong>Stufe 0</strong>. Freigeschaltete Upgrades kannst du sofort wieder kaufen.</dd></div>
        <div><dt>Kader</dt><dd>{features.starXI.ownedIds.length} Karten → <strong>{squadAfter} Karten</strong>. Alle anderen bleiben im Album («Nicht im Kader»).</dd></div>
        <div><dt>Kartenboni</dt><dd>Spezialkarten und die gewählte Karte behalten Meilensteine und Wachstum. Abgegebene Karten verlieren ihre Verbesserungen: Ziehst du sie wieder, starten sie mit ihrer Grundwertung. Statistiken und abgeholte Albumprämien bleiben.</dd></div>
      </dl>
      <h3>Spezialkarten bleiben ({specials.length})</h3>
      <p className="prestige-names">{specials.length ? specials.map((player) => player.name).join(", ") : "Keine Spezialkarten im Kader."}</p>
      <h3>Eine normale Karte behalten</h3>
      {candidates.length ? <fieldset className="prestige-choices" aria-label="Normale Karte behalten">
        {candidates.map((player) => <label key={player.id} className={keepId === player.id ? "selected" : ""}>
          <input type="radio" name="prestige-keep" value={player.id} checked={keepId === player.id} onChange={() => setKeepId(player.id)} />
          <b>{ratingOf(player)}</b><span>{player.name}</span><small>{getStarXIPositions(player).join(" / ")}</small>
        </label>)}
      </fieldset> : <p>Du hast keine normale Karte im Kader. Du startest nur mit deinen Spezialkarten.</p>}
      {voteMembers > 0 && <p className="prestige-vote-note" role="note">Koop Abstimmung: {voteMembers === 1 ? "Dein Mitspieler, der gerade online ist, muss" : `Alle ${voteMembers} Mitspieler, die gerade online sind, müssen`} innerhalb von {PRESTIGE_VOTE_SECONDS} Sekunden zustimmen. Wer offline ist, wird nicht gefragt. Alle sehen deine behaltene Karte.</p>}
      {error && <p className="prestige-error" role="alert">{error}</p>}
      <div className="confirm-dialog-actions">
        <button type="button" className="mode-secondary" onClick={onCancel}>Abbrechen</button>
        <button type="button" className="mode-primary" disabled={!canConfirm} onClick={() => onConfirm(keepId)}>{candidates.length && !keepId ? "Karte wählen" : voteMembers > 0 ? "Abstimmung starten" : `Prestige ${next} starten`}</button>
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
  const card = vote.keepName ?? (vote.keepNormalId ? "eine normale Karte" : "keine normale Karte");
  return createPortal(<div className="account-overlay" role="presentation">
    <div ref={dialogRef} className="account-dialog confirm-dialog prestige-dialog prestige-vote-dialog" role="alertdialog" aria-modal="true" aria-labelledby="prestige-vote-title" aria-describedby="prestige-vote-description">
      <h2 id="prestige-vote-title">Prestige {vote.prestigeCount + 1}: Abstimmung</h2>
      <div id="prestige-vote-description">
        <p>{vote.viewerIsProposer ? "Du hast" : `${vote.proposerName} hat`} Prestige {vote.prestigeCount + 1} für die ganze Welt vorgeschlagen. Der Aufstiegslauf beginnt wieder in Saison 1, der Torkontostand geht auf 0 und alle Upgrades starten wieder bei Stufe 0.</p>
        <dl className="prestige-summary">
          <div><dt>Behaltene Karte</dt><dd><strong>{card}</strong> und alle Spezialkarten</dd></div>
          <div><dt>Torbonus</dt><dd>+{percent(vote.prestigeCount)} % → <strong>+{percent(vote.prestigeCount + 1)} % Tore</strong></dd></div>
          <div><dt>Zugestimmt</dt><dd>{vote.approvedRoles.map(nameOf).join(", ") || "noch niemand"}</dd></div>
          <div><dt>Noch offen</dt><dd>{vote.waitingRoles.length ? vote.waitingRoles.map(nameOf).join(", ") : "niemand, Prestige startet gleich"}</dd></div>
        </dl>
        <p className="prestige-vote-timer" role="timer" aria-live="off">Noch {seconds} {seconds === 1 ? "Sekunde" : "Sekunden"}. Wer offline ist, blockiert nicht. Eine Ablehnung beendet die Abstimmung für alle.</p>
      </div>
      <div className="confirm-dialog-actions">
        {vote.viewerMustVote ? <>
          <button type="button" className="mode-secondary" disabled={busy} onClick={onDecline}>Ablehnen</button>
          <button type="button" className="mode-primary" disabled={busy} onClick={onApprove}>Zustimmen</button>
        </> : vote.viewerIsProposer ? <>
          <button type="button" className="mode-secondary" onClick={onHide}>Ausblenden</button>
          <button type="button" className="mode-secondary danger" disabled={busy} onClick={onDecline}>Abstimmung abbrechen</button>
        </> : <>
          {!vote.viewerApproved && <button type="button" className="mode-secondary" disabled={busy} onClick={onDecline}>Ablehnen</button>}
          <button type="button" className="mode-primary" onClick={onHide}>{vote.viewerApproved ? "Schliessen" : "Ausblenden"}</button>
        </>}
      </div>
    </div>
  </div>, document.body);
}
