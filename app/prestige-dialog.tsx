"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "./confirm-dialog";
import { PRESTIGE_GOAL_BONUS_PER_LEVEL, getPrestigeKeepCandidates, getPrestigeRetainedSpecials, getStarXIPositions } from "./feature-data";
import type { GameFeatures } from "./feature-data";
import { formatNumber } from "./game/format";
import { getCareerCard } from "./career-data";

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
export function PrestigeDialog({ features, goals, upgradeLevels, busy, error, onConfirm, onCancel }: { features: GameFeatures; goals: number; upgradeLevels: number; busy: boolean; error: string; onConfirm: (keepNormalId: string | null) => void; onCancel: () => void }) {
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
      <p>Der Aufstiegslauf beginnt wieder in Saison 1. Alle 27 Upgrades im Club Office starten wieder bei Stufe 0. Freischaltungen, Fragmente, ungeöffnete Packs und Vereinssterne bleiben.</p>
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
      {error && <p className="prestige-error" role="alert">{error}</p>}
      <div className="confirm-dialog-actions">
        <button type="button" className="mode-secondary" onClick={onCancel}>Abbrechen</button>
        <button type="button" className="mode-primary" disabled={!canConfirm} onClick={() => onConfirm(keepId)}>{candidates.length && !keepId ? "Karte wählen" : `Prestige ${next} starten`}</button>
      </div>
    </div>
  </div>, document.body);
}
