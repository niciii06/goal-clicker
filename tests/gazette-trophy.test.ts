// Gazette archive and trophy room as their own components (modularisation step 3). The stored German front pages
// read in English when English is chosen: every headline, both straplines with and without penalties, both bodies.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GazetteArchive, gazetteText } from '../app/gazette-archive.tsx';
import { TrophyRoom } from '../app/trophy-room.tsx';
import { initialGameFeatures, normalizeGameFeatures, publishTournamentGazette } from '../app/feature-data.ts';
import { GAZETTE_CHAMPION_HEADLINES, GAZETTE_EXIT_HEADLINES } from '../app/features/news-data.ts';
import * as runtime from '../app/i18n/runtime.ts';

const issues = () => {
  const features = normalizeGameFeatures(initialGameFeatures(1_800_000_000_000));
  return [[true, false], [true, true], [false, false], [false, true]].map(([won, tieBreak], index) => publishTournamentGazette(features, { tournamentId: 'stadium', tournamentWon: won, homeScore: 2, awayScore: 1, opponent: 'FC Basel', completedRound: 2, tieBreak } as never, 1_800_000_000_000 + index * 60_000, () => 0.3).issue);
};

test('every stored headline has an English line', () => {
  runtime.resetLocaleForTests();
  runtime.chooseLocale('en');
  for (const headline of [...GAZETTE_CHAMPION_HEADLINES, ...GAZETTE_EXIT_HEADLINES]) {
    const english = runtime.localizeText(headline);
    assert.notEqual(english, headline, headline);
    assert.doesNotMatch(english, /[ÄÖÜ]/, headline);
  }
  runtime.resetLocaleForTests();
});

test('strapline and body of won and lost runs, with and without penalties, read in English', () => {
  runtime.resetLocaleForTests();
  runtime.chooseLocale('en');
  const lines = issues().map(gazetteText);
  assert.match(lines[0].strapline, / win the Stadium Cup\.$/);
  assert.match(lines[1].strapline, / win the Stadium Cup on penalties\.$/);
  assert.match(lines[2].strapline, / go out in round 2\.$/);
  assert.match(lines[3].strapline, / go out in round 2 on penalties\.$/);
  assert.match(lines[0].body, /^2:1 against FC Basel\. The trophy is here/);
  assert.match(lines[2].body, /^2:1 against FC Basel\. The dream ends early/);
  for (const line of lines) assert.doesNotMatch(`${line.headline} ${line.strapline} ${line.body}`, /gewinnt|scheidet|gegen|Trophäe|Traum/);
  runtime.chooseLocale('de');
  const german = issues().map(gazetteText);
  assert.match(german[1].strapline, / gewinnt Stadionpokal nach Elfmeterschiessen\.$/);
  runtime.resetLocaleForTests();
});

test('the archive lists the newest first in the chosen language', () => {
  runtime.resetLocaleForTests();
  runtime.chooseLocale('en');
  const html = renderToStaticMarkup(createElement(GazetteArchive, { issues: issues() }));
  assert.ok(html.indexOf('on penalties.</p>') < html.indexOf('in round 2.</p>'), 'newest first');
  assert.doesNotMatch(html, /gewinnt|scheidet/);
  assert.equal(renderToStaticMarkup(createElement(GazetteArchive, { issues: [] })), '');
  runtime.resetLocaleForTests();
});

test('the trophy room counts every cup', () => {
  runtime.resetLocaleForTests();
  runtime.chooseLocale('de');
  const html = renderToStaticMarkup(createElement(TrophyRoom, { trophies: { stadium: 2, champions: 1, world: 0 } }));
  assert.match(html, /<span>3 /, 'total of all cups');
  assert.equal((html.match(/trophy-card earned/g) ?? []).length, 2);
  assert.equal((html.match(/trophy-card locked/g) ?? []).length, 1);
  runtime.resetLocaleForTests();
});

test('the game screen only places both components and localizes the special edition', async () => {
  const page = await readFile(new URL('../app/game-app.tsx', import.meta.url), 'utf8');
  assert.match(page, /<TrophyRoom trophies=\{displayGame\.features\.cup\.trophies\} \/>/);
  assert.match(page, /<GazetteArchive issues=\{displayGame\.features\.gazetteIssues\} \/>/);
  assert.doesNotMatch(page, /totalTrophies|className="gazette-archive"|\{gazetteAnnouncement\.(headline|strapline|body)\}/);
});
