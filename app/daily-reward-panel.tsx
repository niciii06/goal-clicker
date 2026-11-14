"use client";
import { DAILY_REWARD_DAYS, getDailyRewardAmount, getDailyRewardStatus } from './daily-reward';
import type { DailyRewardState } from './daily-reward';
import { t } from './i18n/runtime';

function countdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function DailyRewardCard({ state, claimKey, now, passivePerSecond, clickPower, busy, coop, onClaim, format }: { state: DailyRewardState; claimKey: string; now: number; passivePerSecond: number; clickPower: number; busy: boolean; coop: boolean; onClaim: () => void; format: (value: number) => string }) {
  const status = getDailyRewardStatus(state, claimKey, now);
  const claimedThrough = status.claimedToday ? status.dayIndex : status.dayIndex - 1;
  return <section className={`daily-reward${status.available ? ' ready' : ''}`} aria-label={t("daily.label")}>
    <div className="daily-reward-head">
      <div><p className="eyebrow">{t("daily.eyebrow")}{coop ? t("daily.wholeWorld") : ''}</p><h3>{status.available ? t("daily.dayWaits", { dayIndex: status.dayIndex }) : coop ? t("daily.alreadyClaimed") : t("daily.dayClaimed", { dayIndex: status.dayIndex })}</h3></div>
      <span className="daily-streak" title={t("daily.streak")}>🔥 {status.streak} {status.streak === 1 ? t("daily.day") : t("daily.days")}</span>
    </div>
    {status.broken && status.available && <p className="daily-reward-note">{t("daily.broken")}</p>}
    <ol className="daily-reward-days">{DAILY_REWARD_DAYS.map((day) => {
      const claimed = day.day <= claimedThrough, current = day.day === status.dayIndex && status.available;
      return <li key={day.day} className={`${claimed ? 'claimed' : ''}${current ? ' current' : ''}${day.pack ? ' pack' : ''}`} aria-current={current ? 'step' : undefined}>
        <small>{t("daily.day")} {day.day}</small>
        <strong>{claimed ? '✓' : day.pack ? '🎁' : '⚽'}</strong>
        <span>{format(getDailyRewardAmount(day, passivePerSecond, clickPower))}{day.pack === 'special' ? t("daily.plusSpecialPack") : day.pack ? t("daily.plusPack") : ''}</span>
      </li>;
    })}</ol>
    {status.available
      ? <button type="button" className="daily-reward-claim" disabled={busy} onClick={onClaim}>{t("daily.claim")}{format(getDailyRewardAmount(status.reward, passivePerSecond, clickPower))} Tore{status.reward.pack === 'special' ? t("daily.plusSpecialCardPack") : status.reward.pack ? t("daily.plusRewardPack") : ''}</button>
      : <p className="daily-reward-next" aria-live="off">{t("daily.nextIn")} <b>{countdown(status.msUntilNext)}</b>{t("daily.tomorrow")}</p>}
  </section>;
}
