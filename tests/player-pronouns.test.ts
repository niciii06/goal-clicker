import assert from 'node:assert/strict';
import test from 'node:test';
import { pronounText } from '../app/player-pronouns.ts';
import { getStarXIPlayer, initialGameFeatures, resolveTransferInsiderEvent, setBestStarXI, STAR_XI_PLAYERS } from '../app/feature-data.ts';
import { getPressConference } from '../app/press-conference.ts';
import type { CupGoalEvent } from '../app/feature-data.ts';

const putellas = STAR_XI_PLAYERS.find((player) => player.sourceId === '227203' && player.isWomen)!;
const man = STAR_XI_PLAYERS.find((player) => !player.isWomen && player.cardType !== 'icon')!;

test('pronoun tokens follow the player, other placeholders stay', () => {
  assert.equal(pronounText('{Er} kann mehr. Ich fordere {ihn}, {sein} Vertrag läuft, {der Spieler} bleibt.', putellas), 'Sie kann mehr. Ich fordere sie, ihr Vertrag läuft, die Spielerin bleibt.');
  assert.equal(pronounText('{Er} kann mehr. Ich fordere {ihn}.', man), 'Er kann mehr. Ich fordere ihn.');
  assert.equal(pronounText('{player} und {torschuetze}', putellas), '{player} und {torschuetze}');
  assert.equal(pronounText('{er}', null), 'er');
});

function conferenceAbout(scorerId: string) {
  const features = initialGameFeatures(1000);
  const scorer = getStarXIPlayer(scorerId)!;
  const goal = { id: 'goal-1', side: 'home', scorer: scorer.name, scorerId, minute: 10, createdAt: 2000 } as unknown as CupGoalEvent;
  features.cup = { ...features.cup, active: false, matchStartedAt: 1000, homeScore: 1, awayScore: 0, matchEvents: [goal] };
  // Every match id picks another question; look for one about the scorer.
  for (let i = 0; i < 400; i++) {
    const conference = getPressConference(features.press, { ...features.cup, careerMatchId: `career:test-${i}` }, 'FC Test');
    if (conference?.question.id.startsWith('tor-')) return conference;
  }
  throw new Error('no scorer question');
}

test('press questions about a woman scorer say sie and ihr', () => {
  const conference = conferenceAbout(putellas.id);
  const text = [conference.text, ...conference.answers.map((answer) => answer.text)].join(' ');
  assert.match(text, new RegExp(putellas.name));
  // "ihn" may still mean the celebration ("wir haben ihn geprobt"), so it is checked where it means the player.
  assert.doesNotMatch(text, /\b(Er|er|ihm|seine|seinen|Sein)\b|fordere ihn|werde ihn/);
  assert.doesNotMatch(text, /\{/);
  const male = conferenceAbout(man.id);
  assert.doesNotMatch([male.text, ...male.answers.map((answer) => answer.text)].join(' '), /\{|\bsie\b/);
});

test('Fabrizio talks about a woman player as her', () => {
  const features = initialGameFeatures(1000);
  features.starXI = setBestStarXI({ ...features.starXI, ownedIds: [putellas.id, ...STAR_XI_PLAYERS.filter((player) => !player.isWomen).slice(0, 30).map((player) => player.id)] });
  // On the bench no position check moves her away.
  if (!features.starXI.lineupIds.includes(putellas.id)) features.starXI.benchIds = [putellas.id, ...features.starXI.benchIds.filter((id) => id !== putellas.id).slice(1)];
  // The second draw picks the squad player; try them until Fabrizio asks for Putellas.
  let offer = null;
  for (let pick = 0; pick < 100 && offer?.playerId !== putellas.id; pick++) {
    const values = [0.31, pick / 100, 0, 0.6, 0]; let index = 0;
    offer = resolveTransferInsiderEvent(features, () => values[index++] ?? 0.5, 2000).event;
  }
  assert.equal(offer?.playerId, putellas.id);
  if (!offer) return;
  assert.equal(offer.headline, 'Sie will ablösefrei weg');
  assert.match(offer.message, /Lässt du sie gehen oder behältst du sie\?/);
});
