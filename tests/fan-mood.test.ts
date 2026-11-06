import assert from 'node:assert/strict';
import test from 'node:test';
import { beginSeasonCupMatch, cardPackRating, getStarXISelection, initialGameFeatures, normalizeGameFeatures, pauseGameFeatureTimers, setBestStarXI, STAR_XI_PLAYERS } from '../app/feature-data.ts';
import { prepareCareerMatch, recordCareerMatch } from '../app/career-data.ts';
import { DEFAULT_FAN_MOOD, FAN_MOOD_RESULT_CHANGE, applyMatchResultToFanMood } from '../app/press-conference.ts';
import { expectedHomeCrowd } from '../app/ticket-income.ts';

function finished(home: number, away: number, now = 1_000_000, penalties?: [number, number]) {
  let f = initialGameFeatures(now);
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => cardPackRating(p) < 95).slice(0, 200).map((p) => p.id) });
  f = normalizeGameFeatures(f);
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, now, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  f.cup.homeScore = home;
  f.cup.awayScore = away;
  if (penalties) {
    f.cup.penaltyHomeScore = penalties[0];
    f.cup.penaltyAwayScore = penalties[1];
    f.cup.penaltyEvents = [{ id: 'p1', side: 'home', taker: 'A', scored: penalties[0] > 0, homeScore: penalties[0], awayScore: penalties[1], createdAt: now } as never];
  }
  f.cup.active = false;
  return f;
}

test('a result moves the fan mood: win up, draw a little, loss down, with a drift to the middle', () => {
  assert.deepEqual(FAN_MOOD_RESULT_CHANGE, { win: 3, draw: 1, loss: -3 });
  assert.equal(applyMatchResultToFanMood(50, 'win'), 53);
  assert.equal(applyMatchResultToFanMood(50, 'draw'), 51);
  assert.equal(applyMatchResultToFanMood(50, 'loss'), 47);
  // One point back toward 50 for every full ten points away.
  assert.equal(applyMatchResultToFanMood(60, 'win'), 62);
  assert.equal(applyMatchResultToFanMood(95, 'draw'), 92);
  assert.equal(applyMatchResultToFanMood(20, 'loss'), 20);
  // Never outside 0 to 100, also from broken values.
  assert.equal(applyMatchResultToFanMood(100, 'win'), 98);
  assert.equal(applyMatchResultToFanMood(0, 'loss'), 2);
  assert.equal(applyMatchResultToFanMood(Number.NaN, 'win'), DEFAULT_FAN_MOOD + 2);
  // Long runs settle: wins around 80, losses around 20, draws a little above the middle.
  const run = (outcome: 'win' | 'draw' | 'loss') => Array.from({ length: 60 }).reduce<number>((mood) => applyMatchResultToFanMood(mood, outcome), 50);
  assert.ok(run('win') >= 78 && run('win') <= 82, `wins ${run('win')}`);
  assert.ok(run('loss') >= 18 && run('loss') <= 22, `losses ${run('loss')}`);
  assert.ok(run('draw') >= 50 && run('draw') <= 60, `draws ${run('draw')}`);
});

test('every finished match changes the fan mood exactly once', () => {
  const win = finished(2, 0);
  assert.equal(win.press.fanMood, DEFAULT_FAN_MOOD);
  recordCareerMatch(win, 1_200_000);
  assert.equal(win.press.fanMood, applyMatchResultToFanMood(DEFAULT_FAN_MOOD, 'win'));
  // Recording the same match again, also after a reload, changes nothing.
  recordCareerMatch(win, 1_300_000);
  const reloaded = normalizeGameFeatures(JSON.parse(JSON.stringify(win)));
  recordCareerMatch(reloaded, 1_400_000);
  const restored = pauseGameFeatureTimers(JSON.parse(JSON.stringify(win)), 20_000, 1_500_000);
  recordCareerMatch(restored, 1_600_000);
  assert.equal(win.press.fanMood, reloaded.press.fanMood);
  assert.equal(restored.press.fanMood, win.press.fanMood);

  const draw = finished(1, 1);
  recordCareerMatch(draw, 1_200_000);
  assert.equal(draw.press.fanMood, applyMatchResultToFanMood(DEFAULT_FAN_MOOD, 'draw'));
  const loss = finished(0, 3);
  recordCareerMatch(loss, 1_200_000);
  assert.equal(loss.press.fanMood, applyMatchResultToFanMood(DEFAULT_FAN_MOOD, 'loss'));
  // A shoot-out decides the match for the fans.
  const shootoutWin = finished(1, 1, 1_000_000, [5, 4]);
  recordCareerMatch(shootoutWin, 1_200_000);
  assert.equal(shootoutWin.press.fanMood, applyMatchResultToFanMood(DEFAULT_FAN_MOOD, 'win'));
  const shootoutLoss = finished(1, 1, 1_000_000, [3, 4]);
  recordCareerMatch(shootoutLoss, 1_200_000);
  assert.equal(shootoutLoss.press.fanMood, applyMatchResultToFanMood(DEFAULT_FAN_MOOD, 'loss'));
  // A running match changes nothing yet.
  const running = finished(3, 0);
  running.cup.active = true;
  recordCareerMatch(running, 1_200_000);
  assert.equal(running.press.fanMood, DEFAULT_FAN_MOOD);
});

test('the fan mood after a run of results fills or empties the home crowd', () => {
  const happy = initialGameFeatures(), angry = initialGameFeatures();
  for (let match = 0; match < 15; match++) {
    happy.press.fanMood = applyMatchResultToFanMood(happy.press.fanMood, 'win');
    angry.press.fanMood = applyMatchResultToFanMood(angry.press.fanMood, 'loss');
  }
  assert.ok(happy.press.fanMood > angry.press.fanMood + 40);
  assert.ok(expectedHomeCrowd(happy) > expectedHomeCrowd(angry));
});
