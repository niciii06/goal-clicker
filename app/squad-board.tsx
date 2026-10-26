'use client';
import type { CSSProperties, DragEvent, PointerEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { getStarXIPositions } from './feature-data';
import type { GameFeatures, StarXIPlayer } from './feature-data';
import { getCareerCard } from './career-data';
import { CareerPlayerBadge } from './career-panels';
import { StarXIPositionBadges } from './game/ui';
import type { SquadArea, SquadDragSource, SquadDropTarget } from './game/types';

// One set of squad components for the "Kader" tab and every in-match substitution view,
// so drag and drop, graphics and milestone ratings stay identical everywhere.
export const SQUAD_DRAG_MIME = 'application/x-goal-clicker-player';

export function formatStarXIPositions(player: Parameters<typeof getStarXIPositions>[0], compact = false) {
  return player.benchOnly ? `${player.symbol} Nur Bank` : player.id === 'star-goat-nicu' ? 'Alle Positionen' : getStarXIPositions(player).join(compact ? '/' : ' / ');
}

/** Rating shown on squad cards: the strongest unlocked milestone card, capped at 100. */
export function squadCardRating(features: GameFeatures, player: StarXIPlayer) {
  return getCareerCard(features.career, player).rating;
}

type SquadDragOptions = {
  canDrop: (source: SquadDragSource, target: SquadDropTarget) => boolean;
  onDrop: (source: SquadDragSource, target: SquadDropTarget) => void | Promise<void>;
  onBlocked?: () => void;
  locked?: (source: SquadDragSource) => boolean;
  /** The player picked by a first tap; its possible targets light up like during a drag. */
  picked?: () => SquadDragSource | null;
};

/** A tapped spot: the player on it (if any) and the place itself as a drop target (reserve cards have none). */
export type SquadPick = { source: SquadDragSource | null; target: SquadDropTarget | null };

const samePick = (a: SquadPick, b: SquadPick) => a.target && b.target
  ? a.target.area === b.target.area && a.target.index === b.target.index
  : !a.target && !b.target && a.source?.playerId === b.source?.playerId;

/**
 * Two taps instead of a drag, like in MADFUT: the first tap picks a player or a place, the second moves
 * or swaps them when that is allowed (in either direction). Otherwise the second tap becomes the new pick,
 * and tapping the picked spot again clears it.
 */
export function resolveSquadTap(picked: SquadPick | null, tapped: SquadPick, canDrop: SquadDragOptions['canDrop']): { move: [SquadDragSource, SquadDropTarget] } | { pick: SquadPick | null } {
  if (picked) {
    if (samePick(picked, tapped)) return { pick: null };
    if (picked.source && tapped.target && canDrop(picked.source, tapped.target)) return { move: [picked.source, tapped.target] };
    if (tapped.source && picked.target && canDrop(tapped.source, picked.target)) return { move: [tapped.source, picked.target] };
  }
  return { pick: tapped };
}

function dropTargetAt(x: number, y: number): SquadDropTarget | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-squad-area]');
  const area = element?.dataset.squadArea, index = Number(element?.dataset.squadIndex);
  return (area === 'lineup' || area === 'bench') && Number.isInteger(index) ? { area, index } : null;
}

export function useSquadDrag({ canDrop, onDrop, onBlocked, locked, picked }: SquadDragOptions) {
  const [dragging, setDragging] = useState<SquadDragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<SquadDropTarget | null>(null);
  // The ref sees the source at once; the state only after a render, which a busy live match view can delay
  // past the first dragover, where dataTransfer cannot be read.
  const activeSource = useRef<SquadDragSource | null>(null);
  const touch = useRef<{ source: SquadDragSource; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  function handleSquadDragStart(event: DragEvent<HTMLElement>, source: SquadDragSource) {
    if (locked?.(source)) {
      event.preventDefault();
      return;
    }
    activeSource.current = source;
    setDragging(source);
    setDropTarget(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(SQUAD_DRAG_MIME, JSON.stringify(source));
  }

  function readSquadDragSource(event: DragEvent<HTMLElement>) {
    if (activeSource.current) return activeSource.current;
    if (dragging) return dragging;
    try {
      const parsed = JSON.parse(event.dataTransfer.getData(SQUAD_DRAG_MIME)) as Partial<SquadDragSource>;
      if (typeof parsed.playerId !== 'string' || !['lineup', 'bench', 'reserve'].includes(String(parsed.area))) return null;
      return { playerId: parsed.playerId, area: parsed.area as SquadArea, index: Number.isInteger(parsed.index) ? Number(parsed.index) : null };
    } catch {
      return null;
    }
  }

  function handleSquadDragOver(event: DragEvent<HTMLElement>, target: SquadDropTarget) {
    const source = readSquadDragSource(event);
    if (!source || !canDrop(source, target)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget(target);
  }

  async function handleSquadDrop(event: DragEvent<HTMLElement>, target: SquadDropTarget) {
    event.preventDefault();
    const source = readSquadDragSource(event);
    activeSource.current = null;
    setDragging(null);
    setDropTarget(null);
    if (!source || !canDrop(source, target)) {
      onBlocked?.();
      return;
    }
    await onDrop(source, target);
  }

  function handleSquadDragEnd() {
    activeSource.current = null;
    setDragging(null);
    setDropTarget(null);
  }

  function squadDropClass(area: SquadDropTarget['area'], index: number) {
    const source = dragging ?? picked?.() ?? null;
    if (!source) return '';
    const target = { area, index } as SquadDropTarget;
    if (!dragging && source.area === area && source.index === index) return '';
    if (!canDrop(source, target)) return ' squad-drop-blocked';
    const active = dropTarget?.area === area && dropTarget.index === index;
    return ` squad-drop-ready${active ? ' squad-drop-active' : ''}`;
  }

  // Touch screens do not fire HTML drag events reliably; follow the finger with pointer events instead.
  function touchHandlers(source: SquadDragSource | null) {
    if (!source) return {};
    return {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType !== 'touch' || locked?.(source)) return;
        touch.current = { source, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const current = touch.current;
        if (!current || Math.hypot(event.clientX - current.x, event.clientY - current.y) < 12) return;
        if (!dragging) setDragging(current.source);
        const target = dropTargetAt(event.clientX, event.clientY);
        setDropTarget(target && canDrop(current.source, target) ? target : null);
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        const current = touch.current;
        touch.current = null;
        setDragging(null);
        setDropTarget(null);
        if (!current || Math.hypot(event.clientX - current.x, event.clientY - current.y) < 12) return;
        suppressClick.current = true;
        window.setTimeout(() => { suppressClick.current = false; }, 0);
        const target = dropTargetAt(event.clientX, event.clientY);
        if (!target || !canDrop(current.source, target)) {
          onBlocked?.();
          return;
        }
        void onDrop(current.source, target);
      },
      onPointerCancel: () => {
        touch.current = null;
        setDragging(null);
        setDropTarget(null);
      },
    };
  }

  /** True once after a touch drag, so the tap that ends the drag does not also select. */
  function consumeDragClick() {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  }

  return { dragging, dropTarget, handleSquadDragStart, handleSquadDragOver, handleSquadDrop, handleSquadDragEnd, squadDropClass, touchHandlers, consumeDragClick };
}

export type SquadDrag = ReturnType<typeof useSquadDrag>;

function matchRatingBadge(liveRating: number | null) {
  return liveRating !== null && <span className={`starxi-match-rating${liveRating < 6 ? ' poor' : liveRating >= 8 ? ' great' : ''}`}>NOTE {liveRating.toFixed(1)}</span>;
}

export function SquadPitchSlot({ features, drag, index, position, x, y, player, selected, liveRating, draggable, disabled, touchDrag = false, detail, onClick }: {
  features: GameFeatures; drag: SquadDrag; index: number; position: string; x: number; y: number; player: StarXIPlayer | null; selected: boolean; liveRating: number | null;
  draggable: boolean; disabled: boolean; touchDrag?: boolean; detail?: string; onClick: () => void;
}) {
  const sentOff = Boolean(player && features.cup.sentOffPlayerIds.includes(player.id));
  const injured = Boolean(player && Number(features.cup.injuredPlayerIds[player.id]) > 0);
  const slotStyle = { '--slot-x': `${x}%`, '--slot-y': `${y}%` } as CSSProperties;
  const dragSource: SquadDragSource | null = player ? { playerId: player.id, area: 'lineup', index } : null;
  return <button type="button" style={slotStyle} data-squad-area="lineup" data-squad-index={index} className={`starxi-pitch-slot${selected ? ' selected' : ''}${player ? ' filled' : ' empty'}${sentOff ? ' red-carded' : ''}${injured ? ' injured' : ''}${liveRating !== null && liveRating < 6 ? ' match-poor' : ''}${drag.dragging?.playerId === player?.id ? ' squad-dragging' : ''}${touchDrag && dragSource && draggable ? ' squad-touch-drag' : ''}${drag.squadDropClass('lineup', index)}`} onClick={() => { if (!drag.consumeDragClick()) onClick(); }} disabled={disabled} draggable={Boolean(dragSource && draggable)} onDragStart={(event) => dragSource && drag.handleSquadDragStart(event, dragSource)} onDragOver={(event) => drag.handleSquadDragOver(event, { area: 'lineup', index })} onDrop={(event) => void drag.handleSquadDrop(event, { area: 'lineup', index })} onDragEnd={drag.handleSquadDragEnd} {...(touchDrag && draggable ? drag.touchHandlers(dragSource) : {})} aria-pressed={selected} aria-label={`${position}: ${player?.name ?? 'offener Platz'}${sentOff ? ', Rote Karte' : injured ? ', verletzt' : player ? ', zum Wechseln ziehen' : ', Spieler hier ablegen'}`}>
    <span className="starxi-slot-position">{position}</span><strong>{player?.name ?? 'Offener Platz'}</strong>
    <small>{sentOff ? 'ROTE KARTE · NÄCHSTE PARTIE GESPERRT' : injured ? `VERLETZT · FEHLT NOCH ${features.cup.injuredPlayerIds[player?.id ?? '']} SPIELE` : player ? `OVR ${squadCardRating(features, player)} · ${formatStarXIPositions(player)}${detail ? ` · ${detail}` : ''}` : `Nur ${position}`}</small>
    {player && <CareerPlayerBadge features={features} player={player} compact />}{matchRatingBadge(liveRating)}
  </button>;
}

export function SquadBenchCard({ features, drag, index, player, selected, incompatible, liveRating, status, draggable, disabled, touchDrag = false, onClick }: {
  features: GameFeatures; drag: SquadDrag; index: number; player: StarXIPlayer; selected: boolean; incompatible: boolean; liveRating: number | null; status: string;
  draggable: boolean; disabled: boolean; touchDrag?: boolean; onClick: () => void;
}) {
  const dragSource: SquadDragSource = { playerId: player.id, area: 'bench', index };
  return <button type="button" data-squad-area="bench" data-squad-index={index} className={`starxi-player-card bank${selected ? ' selected' : ''}${incompatible ? ' incompatible' : ''}${liveRating !== null && liveRating < 6 ? ' match-poor' : ''}${drag.dragging?.playerId === player.id ? ' squad-dragging' : ''}${touchDrag && draggable ? ' squad-touch-drag' : ''}${drag.squadDropClass('bench', index)}`} onClick={() => { if (!drag.consumeDragClick()) onClick(); }} disabled={disabled} draggable={draggable} onDragStart={(event) => drag.handleSquadDragStart(event, dragSource)} onDragEnd={drag.handleSquadDragEnd} onDragOver={(event) => drag.handleSquadDragOver(event, { area: 'bench', index })} onDrop={(event) => void drag.handleSquadDrop(event, { area: 'bench', index })} {...(touchDrag && draggable ? drag.touchHandlers(dragSource) : {})} aria-pressed={selected}>
    <StarXIPositionBadges player={player} variant="compact" /><div><strong>{player.name}</strong><CareerPlayerBadge features={features} player={player} /><small>{liveRating !== null ? `NOTE ${liveRating.toFixed(1)} · ` : ''}{status}</small></div><b>{squadCardRating(features, player)}</b>
  </button>;
}

export function SquadBenchSlot({ drag, index, selected, disabled, onClick }: { drag: SquadDrag; index: number; selected: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" data-squad-area="bench" data-squad-index={index} className={`starxi-bank-slot${selected ? ' selected' : ''}${drag.squadDropClass('bench', index)}`} onClick={onClick} disabled={disabled} onDragOver={(event) => drag.handleSquadDragOver(event, { area: 'bench', index })} onDrop={(event) => void drag.handleSquadDrop(event, { area: 'bench', index })}><span>BANK {index + 1}</span><small>{selected ? 'gewählt' : drag.dragging ? 'hier ablegen' : 'frei'}</small></button>;
}

export function SquadPitchPanel({ status, controls, help, children }: { status: string; controls?: ReactNode; help: string; children: ReactNode }) {
  return <section className="starxi-pitch-panel" aria-label="Startelf Aufstellung">
    <div className="starxi-pitch-toolbar"><span>STARTELF · 11 PLÄTZE</span><small>{status}</small></div>
    {controls}
    <div className="starxi-pitch"><div className="starxi-pitch-markings" aria-hidden="true" /><div className="starxi-formation-grid">{children}</div></div>
    <p className="starxi-pitch-help">{help}</p>
  </section>;
}

export function SquadBenchPanel({ id, count, size, children }: { id?: string; count: number; size: number; children: ReactNode }) {
  return <section className="starxi-bank-panel" id={id} aria-label="Bank">
    <div className="starxi-subheading"><div><span className="eyebrow">BANK / LIVE WECHSEL</span><h4>Deine Bank</h4></div><strong>{count} / {size}</strong></div>
    <div className="starxi-bank-grid">{children}</div>
  </section>;
}
