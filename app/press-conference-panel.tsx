"use client";
import { fanMoodLabel, getPressConference } from './press-conference';
import type { GameFeatures } from './feature-data';

export function PressConferencePanel({ features, busy, reward, onAnswer, format }: { features: GameFeatures; busy: boolean; reward: number; onAnswer: (matchId: string, questionId: string, answerIndex: number) => void; format: (value: number) => string }) {
  const cup = features.cup, press = features.press;
  if (cup.active || !cup.careerMatchId) return null;
  const conference = getPressConference(press, cup, features.club.name);
  const answered = press.last?.matchId === cup.careerMatchId ? press.last : undefined;
  if (!conference && !answered) return null;
  const mood = <div className="fan-mood" aria-label={`Fanstimmung ${press.fanMood} von 100`}><span>Fanstimmung</span><div className="fan-mood-bar"><i style={{ width: `${press.fanMood}%` }} /></div><b>{fanMoodLabel(press.fanMood)}</b></div>;
  if (!conference && answered) {
    return <section className="press-conference answered" aria-label="Pressekonferenz">
      <p className="eyebrow">PRESSEKONFERENZ · BEANTWORTET</p>
      <blockquote>«{answered.answer}»</blockquote>
      <p className="press-effect">Wirkung auf die Fans: {answered.mood >= 0 ? '+' : ''}{answered.mood}</p>
      {mood}
    </section>;
  }
  return <section className="press-conference" aria-label="Pressekonferenz">
    <p className="eyebrow">PRESSEKONFERENZ · MEDIENPRÄMIE +{format(reward)} TORE</p>
    <h3>{conference!.text}</h3>
    <div className="press-answers">{conference!.answers.map((answer) => <button type="button" key={answer.index} disabled={busy} onClick={() => onAnswer(conference!.matchId, conference!.question.id, answer.index)}>{answer.text}</button>)}</div>
    {mood}
    <p className="press-hint">Deine Antwort beeinflusst die Stimmung der Fans im Stadion.</p>
  </section>;
}
