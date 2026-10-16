import assert from 'node:assert/strict';
import test from 'node:test';
import { claimDailyReward, DAILY_REWARD_DAYS, getDailyRewardStatus, getRewardDay, getDailyRewardAmount, normalizeDailyRewards } from '../app/daily-reward.ts';
import { answerPressConference, getPressConference, getPressContexts, normalizePress, PRESS_QUESTIONS } from '../app/press-conference.ts';
import { initialGameFeatures, STAR_XI_PLAYERS, setBestStarXI, beginSeasonCupMatch, getStarXISelection, advanceCupMatch, resumeCupMatch, normalizeGameFeatures } from '../app/feature-data.ts';
import type { CupState } from '../app/feature-data.ts';
import { prepareCareerMatch } from '../app/career-data.ts';
import { GOAL_CELEBRATION_SECONDS } from '../app/interactive-match.ts';
import { CELEBRATION_SHARE, readInteractiveFrame } from '../app/interactive-frame-data.ts';
import { computeAmbience, STADIUM_VIEW } from '../app/stadium-ambience.ts';

const day = (iso: string) => Date.parse(iso);

test('daily reward day changes at midnight in Zurich, not UTC', () => {
  assert.equal(getRewardDay(day('2026-10-16T21:59:00Z')), '2026-10-16');
  assert.equal(getRewardDay(day('2026-10-16T22:01:00Z')), '2026-10-17');
  assert.equal(getRewardDay(day('2026-01-10T22:59:00Z')), '2026-01-10');
  assert.equal(getRewardDay(day('2026-01-10T23:01:00Z')), '2026-01-11');
});

test('daily reward streak grows on consecutive days, blocks a second claim and restarts after a gap', () => {
  const first = claimDailyReward({}, 'solo', 10, 5, day('2026-10-16T08:00:00Z'))!;
  assert.equal(first.dayIndex, 1); assert.equal(first.streak, 1);
  assert.equal(claimDailyReward(first.state, 'solo', 10, 5, day('2026-10-16T20:00:00Z')), null);
  const second = claimDailyReward(first.state, 'solo', 10, 5, day('2026-10-17T06:00:00Z'))!;
  assert.equal(second.dayIndex, 2); assert.equal(second.streak, 2);
  const broken = getDailyRewardStatus(second.state, 'solo', day('2026-10-19T10:00:00Z'));
  assert.equal(broken.broken, true); assert.equal(broken.streak, 1); assert.equal(broken.dayIndex, 1);
  // Other claimers in a shared world are independent.
  assert.equal(getDailyRewardStatus(second.state, 'guest', day('2026-10-17T07:00:00Z')).available, true);
});

test('day seven grants a reward pack and the cycle starts over afterwards', () => {
  let state = {}; let claim;
  for (let i = 0; i < 7; i++) { claim = claimDailyReward(state, 'host', 0, 0, day(`2026-10-${String(10 + i).padStart(2, '0')}T12:00:00Z`))!; state = claim.state; }
  assert.equal(claim!.dayIndex, 7); assert.equal(claim!.pack?.packId, 'reward-2'); assert.equal(claim!.pack?.id, 'daily-host-2026-10-16');
  const eighth = claimDailyReward(state, 'host', 0, 0, day('2026-10-17T12:00:00Z'))!;
  assert.equal(eighth.dayIndex, 1); assert.equal(eighth.streak, 8); assert.equal(eighth.pack, undefined);
});

test('daily reward amounts scale with production and keep a floor for new clubs', () => {
  assert.equal(getDailyRewardAmount(DAILY_REWARD_DAYS[0], 0, 0), DAILY_REWARD_DAYS[0].floor);
  assert.equal(getDailyRewardAmount(DAILY_REWARD_DAYS[0], 1000, 1), 1000 * 5 * 60);
  assert.deepEqual(normalizeDailyRewards({ solo: { day: '2026-10-16', streak: 3 }, intruder: { day: 'x', streak: 1 }, guest: { day: 'bad', streak: 1 } }), { solo: { day: '2026-10-16', streak: 3 } });
  const features = normalizeGameFeatures({ dailyRewards: { solo: { day: '2026-10-16', streak: 2 } } });
  assert.deepEqual(features.dailyRewards, { solo: { day: '2026-10-16', streak: 2 } });
  assert.equal(features.press.fanMood, 60);
});

function finishedCup(id: string, home: number, away: number, extra: Partial<CupState> = {}): CupState {
  const f = initialGameFeatures(1000000);
  return { ...f.cup, active: false, matchStartedAt: 1000000, careerMatchId: id, opponent: 'FC Tabellenkeller', homeScore: home, awayScore: away, matchEvents: home ? [{ id: 'g1', side: 'home', scorerId: 'x', scorer: 'Mia Hamms', minute: 12, createdAt: 1, homeScore: 1, awayScore: 0, ratingImpacts: {} }] : [], ...extra };
}

test('press conference pool is large, well formed and context aware', () => {
  assert.ok(PRESS_QUESTIONS.length >= 50, `only ${PRESS_QUESTIONS.length} questions`);
  assert.equal(new Set(PRESS_QUESTIONS.map((question) => question.id)).size, PRESS_QUESTIONS.length);
  for (const question of PRESS_QUESTIONS) assert.equal(new Set(question.answers.map((answer) => answer.text)).size, 3, question.id);
  const loss = finishedCup('m-loss', 0, 2);
  assert.ok(getPressContexts(loss).has('niederlage'));
  for (let i = 0; i < 40; i++) {
    const conference = getPressConference(undefined, { ...loss, careerMatchId: `loss-${i}` }, 'FC Arbeitszeitbetrug')!;
    assert.ok(!conference.question.contexts.includes('sieg') && !conference.question.contexts.includes('torschuetze'), conference.question.id);
    assert.doesNotMatch(conference.text, /\{|\}/);
  }
});

test('press conference avoids recently asked questions and only runs once per match', () => {
  let press = normalizePress(undefined); const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    const cup = finishedCup(`win-${i}`, 2, 0);
    const conference = getPressConference(press, cup, 'FC Arbeitszeitbetrug')!;
    assert.ok(!seen.slice(-12).includes(conference.question.id), `${conference.question.id} repeated`);
    seen.push(conference.question.id);
    const result = answerPressConference(press, cup, 'FC Arbeitszeitbetrug', cup.careerMatchId!, conference.question.id, conference.answers[0].index)!;
    press = result.press;
    assert.equal(getPressConference(press, cup, 'FC Arbeitszeitbetrug'), null);
    assert.equal(answerPressConference(press, cup, 'FC Arbeitszeitbetrug', cup.careerMatchId!, conference.question.id, 0), null);
    assert.ok(press.fanMood >= 0 && press.fanMood <= 100);
  }
  const cup = finishedCup('wrong', 1, 1);
  const conference = getPressConference(press, cup, 'X')!;
  assert.equal(answerPressConference(press, cup, 'X', 'wrong', conference.question.id, 5), null);
  assert.equal(answerPressConference(press, cup, 'X', 'other-match', conference.question.id, 0), null);
  assert.equal(getPressConference(press, { ...cup, active: true }, 'X'), null);
});

function liveFixture(seed: number) {
  const f = initialGameFeatures(1000000 + seed);
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.map((p) => p.id) });
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, 1000000 + seed, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  return f;
}

test('goal celebration: scorer runs to a corner flag, the ball rests in the net and the kickoff positions are reached', () => {
  let found = false;
  for (let seed = 1; seed < 12 && !found; seed++) {
    const f = liveFixture(seed);
    for (let i = 0; i < 400 && f.cup.active && !found; i++) {
      if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
      f.cup = advanceCupMatch(f.cup, 85, Math.min(f.cup.matchEndsAt, f.cup.lastTickAt + 1500), Math.random, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup;
      const sim = f.cup.simulation; if (!sim) break;
      const actions = [...sim.recent, ...sim.buffer];
      const goal = actions.find((a) => a.kind === 'shot' && a.outcome === 'goal');
      const restart = goal && actions.find((a) => a.kind === 'restart' && a.start === goal.end);
      if (!goal || !restart || restart.end - restart.start < GOAL_CELEBRATION_SECONDS - 1) continue;
      found = true;
      const at = (share: number) => readInteractiveFrame(sim, restart.start + (restart.end - restart.start) * share);
      const party = at(.5);
      assert.equal(party.celebration?.scorerId, goal.actor);
      const scorer = party.players.find((p) => p.id === goal.actor)!;
      assert.ok((scorer.x < 10 || scorer.x > 95) && (scorer.y < 10 || scorer.y > 58), `scorer not at a corner: ${scorer.x},${scorer.y}`);
      assert.deepEqual(party.ball, restart.from);
      const end = at(1);
      for (const p of end.players) { const target = restart.after.players.find((q) => q.id === p.id)!; assert.ok(Math.hypot(p.x - target.x, p.y - target.y) < 1e-9); }
      for (const p of at(CELEBRATION_SHARE * .7).players) assert.ok(p.x >= 0 && p.x <= 105 && p.y >= 0 && p.y <= 68, 'player left the pitch');
      // The celebration does not cost more stamina than a normal restart.
      for (const p of restart.after.players) { const before = restart.before.players.find((q) => q.id === p.id)!; assert.ok(before.fitness - p.fitness < 1, `${p.id} lost ${before.fitness - p.fitness}`); }
    }
  }
  assert.ok(found, 'no goal with celebration found');
});

test('stadium ambience is deterministic per match, night at late kickoffs and snow only in winter', () => {
  const base = initialGameFeatures(1000000).cup;
  const nightCup = { ...base, careerMatchId: 'night', matchStartedAt: day('2026-10-16T20:30:00Z') };
  assert.deepEqual(computeAmbience(nightCup, 70), computeAmbience(nightCup, 70));
  assert.equal(computeAmbience(nightCup).time, 'night');
  assert.equal(computeAmbience({ ...nightCup, matchStartedAt: day('2026-07-16T10:00:00Z') }).time, 'day');
  for (let i = 0; i < 200; i++) assert.notEqual(computeAmbience({ ...base, careerMatchId: `summer-${i}`, matchStartedAt: day('2026-07-16T12:00:00Z') }).weather, 'snow');
  assert.ok(Array.from({ length: 200 }, (_, i) => computeAmbience({ ...base, careerMatchId: `winter-${i}`, matchStartedAt: day('2026-01-16T12:00:00Z') }).weather).includes('snow'));
  assert.ok(STADIUM_VIEW.width > 113 && STADIUM_VIEW.height > 76);
});
