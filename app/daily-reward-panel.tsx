"use client";
import { DAILY_REWARD_DAYS, getDailyRewardAmount, getDailyRewardStatus } from './daily-reward';
import type { DailyRewardState } from './daily-reward';

function countdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function DailyRewardCard({ state, claimKey, now, passivePerSecond, clickPower, busy, coop, onClaim, format }: { state: DailyRewardState; claimKey: string; now: number; passivePerSecond: number; clickPower: number; busy: boolean; coop: boolean; onClaim: () => void; format: (value: number) => string }) {
  const status = getDailyRewardStatus(state, claimKey, now);
  const claimedThrough = status.claimedToday ? status.dayIndex : status.dayIndex - 1;
  return <section className={`daily-reward${status.available ? ' ready' : ''}`} aria-label="Tägliche Prämie">
    <div className="daily-reward-head">
      <div><p className="eyebrow">TÄGLICHE PRÄMIE{coop ? ' · FÜR DIE GANZE WELT' : ''}</p><h3>{status.available ? `Tag ${status.dayIndex} wartet` : coop ? 'Heute bereits abgeholt' : `Tag ${status.dayIndex} abgeholt`}</h3></div>
      <span className="daily-streak" title="Tage in Folge">🔥 {status.streak} {status.streak === 1 ? 'Tag' : 'Tage'}</span>
    </div>
    {status.broken && status.available && <p className="daily-reward-note">Die Serie wurde unterbrochen. Heute startet eine neue Serie.</p>}
    <ol className="daily-reward-days">{DAILY_REWARD_DAYS.map((day) => {
      const claimed = day.day <= claimedThrough, current = day.day === status.dayIndex && status.available;
      return <li key={day.day} className={`${claimed ? 'claimed' : ''}${current ? ' current' : ''}${day.pack ? ' pack' : ''}`} aria-current={current ? 'step' : undefined}>
        <small>Tag {day.day}</small>
        <strong>{claimed ? '✓' : day.pack ? '🎁' : '⚽'}</strong>
        <span>{format(getDailyRewardAmount(day, passivePerSecond, clickPower))}{day.pack === 'special' ? ' + Spezialpack' : day.pack ? ' + Pack' : ''}</span>
      </li>;
    })}</ol>
    {status.available
      ? <button type="button" className="daily-reward-claim" disabled={busy} onClick={onClaim}>Prämie abholen · +{format(getDailyRewardAmount(status.reward, passivePerSecond, clickPower))} Tore{status.reward.pack === 'special' ? ' + Spezialkarten-Pack' : status.reward.pack ? ' + Prämienpack' : ''}</button>
      : <p className="daily-reward-next" aria-live="off">Nächste Prämie in <b>{countdown(status.msUntilNext)}</b>. Morgen abholen, sonst beginnt die Serie neu.</p>}
  </section>;
}
