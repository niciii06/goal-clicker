'use client';

import type { GameFeatures } from './feature-data';
import { dataText } from './i18n/data-text';
import { t } from './i18n/runtime';
import { getMsUntilNextWeek, getWeekNumber, getWeeklyGoalViews, weeklyRewardLabel } from './weekly-goals';

function remainingLabel(ms: number) {
  const hours = Math.max(1, Math.ceil(ms / 3600000));
  if (hours < 24) return t('data.weekly.hoursLeft', { count: hours });
  const days = Math.ceil(hours / 24);
  return t('data.weekly.daysLeft', { count: days });
}

/** The three goals of the Zurich week, in single player and co-op alike (the co-op world shares them). */
export function WeeklyGoalsPanel({ features, minigameWins, coop, busy, now, onClaim }: { features: GameFeatures; minigameWins: number; coop: boolean; busy: boolean; now: number; onClaim: (goalId: string) => void }) {
  const goals = getWeeklyGoalViews(features, minigameWins);
  const week = features.weekly?.week;
  const done = goals.filter((goal) => goal.claimed).length;
  return <div className="feature-panel weekly-goals">
    <div className="feature-panel-heading"><div><p className="eyebrow">{coop ? t("data.weekly.coopEyebrow") : t("data.weekly.eyebrow")}{week ? t('data.weekly.weekNumber', { week: getWeekNumber(week) }) : ''}</p><h3>{coop ? t("data.weekly.teamTitle") : t("data.weekly.title")}</h3></div><span className="feature-stat">{done} / {goals.length || 3} {t("data.weekly.claimedCaps")}</span></div>
    <p className="weekly-goals-note">{t('data.weekly.note')}{coop ? t("data.weekly.anyone") : ''}{t('data.weekly.newGoals', { time: remainingLabel(getMsUntilNextWeek(now)) })}</p>
    {goals.length ? <div className="mission-list">{goals.map((goal) => <div className={`mission-row${goal.claimed ? ' claimed' : ''}`} key={goal.id}>
      <div className="mission-copy"><strong>{goal.title}</strong><small>{goal.description}</small><div className="mission-progress" role="progressbar" aria-label={goal.title} aria-valuemin={0} aria-valuemax={goal.target} aria-valuenow={goal.progress}><span style={{ width: `${Math.min(100, (goal.progress / goal.target) * 100)}%` }} /></div><em>{goal.progress} / {goal.target} · {t('data.weekly.reward', { reward: dataText(weeklyRewardLabel(goal.reward)) })}</em></div>
      <button type="button" className="feature-buy-button" onClick={() => onClaim(goal.id)} disabled={goal.claimed || !goal.complete || busy}>{goal.claimed ? t("data.weekly.claimed") : goal.complete ? t("data.weekly.claim") : 'offen'}</button>
    </div>)}</div> : <p className="weekly-goals-note">{t("data.weekly.preparing")}</p>}
  </div>;
}
