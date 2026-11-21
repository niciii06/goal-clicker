"use client";
import { fanMoodLabel, fillPressText, getPressConference, PRESS_QUESTIONS } from './press-conference';
import type { CupState, GameFeatures } from './feature-data';
import { currentLocale, localizeText, t } from './i18n/runtime';
import type { MessageKey } from './i18n/translate';

// Questions and answers stay German in the game data (co-op server, saved answer); they are shown in the current
// language by question id (app/i18n/messages/press.*.ts). German shows exactly the text the game built.
function shown(german: string, key: string, cup: CupState, clubName: string) {
  if (currentLocale() === 'de') return german;
  return fillPressText(t(key as MessageKey), cup, clubName, t('press.noOpponent'));
}

/** The saved answer of this match in the current language: found by its question and the German text it was built from. */
function shownAnswer(answered: { questionId: string; answer: string }, cup: CupState, clubName: string) {
  const question = PRESS_QUESTIONS.find((item) => item.id === answered.questionId);
  const index = question?.answers.findIndex((answer) => fillPressText(answer.text, cup, clubName) === answered.answer) ?? -1;
  return question && index >= 0 ? shown(answered.answer, `press.a.${question.id}.${index}`, cup, clubName) : answered.answer;
}

export function PressConferencePanel({ features, busy, reward, onAnswer, format }: { features: GameFeatures; busy: boolean; reward: number; onAnswer: (matchId: string, questionId: string, answerIndex: number) => void; format: (value: number) => string }) {
  const cup = features.cup, press = features.press, club = features.club.name;
  if (cup.active || !cup.careerMatchId) return null;
  const conference = getPressConference(press, cup, club);
  const answered = press.last?.matchId === cup.careerMatchId ? press.last : undefined;
  if (!conference && !answered) return null;
  const mood = <div className="fan-mood" aria-label={t('press.fanMoodAria', { mood: press.fanMood })}><span>{t('press.fanMood')}</span><div className="fan-mood-bar"><i style={{ width: `${press.fanMood}%` }} /></div><b>{localizeText(fanMoodLabel(press.fanMood))}</b></div>;
  if (!conference && answered) {
    return <section className="press-conference answered" aria-label={t('press.title')}>
      <p className="eyebrow">{t('press.answeredEyebrow')}</p>
      <blockquote>«{shownAnswer(answered, cup, club)}»</blockquote>
      <p className="press-effect">{t('press.effect', { mood: `${answered.mood >= 0 ? '+' : ''}${answered.mood}` })}</p>
      {mood}
    </section>;
  }
  const id = conference!.question.id;
  return <section className="press-conference" aria-label={t('press.title')}>
    <p className="eyebrow">{t('press.rewardEyebrow', { reward: format(reward) })}</p>
    <h3>{shown(conference!.text, `press.q.${id}`, cup, club)}</h3>
    <div className="press-answers">{conference!.answers.map((answer) => <button type="button" key={answer.index} disabled={busy} onClick={() => onAnswer(conference!.matchId, id, answer.index)}>{shown(answer.text, `press.a.${id}.${answer.index}`, cup, club)}</button>)}</div>
    {mood}
    <p className="press-hint">{t('press.hint')}</p>
  </section>;
}
