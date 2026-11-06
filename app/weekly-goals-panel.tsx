'use client';

import type { GameFeatures } from './feature-data';
import { getMsUntilNextWeek, getWeekNumber, getWeeklyGoalViews, weeklyRewardLabel } from './weekly-goals';

function remainingLabel(ms: number) {
  const hours = Math.max(1, Math.ceil(ms / 3600000));
  if (hours < 24) return `noch ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
  const days = Math.ceil(hours / 24);
  return `noch ${days} ${days === 1 ? 'Tag' : 'Tage'}`;
}

/** The three goals of the Zurich week, in single player and co-op alike (the co-op world shares them). */
export function WeeklyGoalsPanel({ features, minigameWins, coop, busy, now, onClaim }: { features: GameFeatures; minigameWins: number; coop: boolean; busy: boolean; now: number; onClaim: (goalId: string) => void }) {
  const goals = getWeeklyGoalViews(features, minigameWins);
  const week = features.weekly?.week;
  const done = goals.filter((goal) => goal.claimed).length;
  return <div className="feature-panel weekly-goals">
    <div className="feature-panel-heading"><div><p className="eyebrow">{coop ? 'KOOP / WOCHENZIELE' : 'WOCHENZIELE'}{week ? ` / KW ${getWeekNumber(week)}` : ''}</p><h3>{coop ? 'Drei Ziele für euer Team.' : 'Drei Ziele für diese Woche.'}</h3></div><span className="feature-stat">{done} / {goals.length || 3} ABGEHOLT</span></div>
    <p className="weekly-goals-note">Jeden Montag gibt es neue Ziele, passend zu deiner besten Liga. Es zählt nur, was in dieser Woche passiert{coop ? ', egal wer im Team es schafft' : ''}. Neue Ziele {remainingLabel(getMsUntilNextWeek(now))}.</p>
    {goals.length ? <div className="mission-list">{goals.map((goal) => <div className={`mission-row${goal.claimed ? ' claimed' : ''}`} key={goal.id}>
      <div className="mission-copy"><strong>{goal.title}</strong><small>{goal.description}</small><div className="mission-progress" role="progressbar" aria-label={goal.title} aria-valuemin={0} aria-valuemax={goal.target} aria-valuenow={goal.progress}><span style={{ width: `${Math.min(100, (goal.progress / goal.target) * 100)}%` }} /></div><em>{goal.progress} / {goal.target} · Prämie: {weeklyRewardLabel(goal.reward)}</em></div>
      <button type="button" className="feature-buy-button" onClick={() => onClaim(goal.id)} disabled={goal.claimed || !goal.complete || busy}>{goal.claimed ? 'Abgeholt' : goal.complete ? 'Abholen' : 'offen'}</button>
    </div>)}</div> : <p className="weekly-goals-note">Die Ziele dieser Woche werden vorbereitet.</p>}
  </div>;
}
