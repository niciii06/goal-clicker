// The Fabrizio ledger as its own component (modularisation step 2): same cards, symbols, texts and order as before.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TransferLedger } from '../app/transfer-ledger.tsx';
import * as runtime from '../app/i18n/runtime.ts';

const event = (id: number, outcome: string, fee = 0, playerName: string | undefined = `Spieler ${id}`) => ({ id: `e${id}`, outcome, club: 'FC Basel', fee, playerName, createdAt: 1_800_000_000_000 + id * 60_000 });

test('loans and the newest twelve transfer events, with the same symbols and texts', () => {
  runtime.resetLocaleForTests();
  runtime.chooseLocale('de');
  const archive = [event(1, 'sale', 5_000_000), event(2, 'return'), event(3, 'declined'), event(4, 'loan'), event(5, 'sale', 0), ...Array.from({ length: 10 }, (_, i) => event(10 + i, 'loan'))];
  const html = renderToStaticMarkup(createElement(TransferLedger, { loans: [{ loan: { playerId: 'p1', club: 'FC Zürich', status: 'active' }, player: { name: 'Lea Keller' } }] as never, archive: archive as never }));
  assert.match(html, /<span>1<\/span>/, 'one loan');
  assert.match(html, /<span>L<\/span><div><strong>Lea Keller<\/strong><small>FC Zürich · /);
  assert.match(html, /<span>15<\/span>/, 'all fifteen events counted');
  assert.equal((html.match(/<article key=|<article/g) ?? []).length, 1 + 12, 'one loan and the newest twelve events');
  assert.ok(html.indexOf('Spieler 19') < html.indexOf('Spieler 10'), 'newest first');
  assert.doesNotMatch(html, /Spieler 1<|Spieler 2<|Spieler 3</, 'older than twelve are not listed');
  runtime.resetLocaleForTests();
});

test('every outcome keeps its symbol, and empty cards show their hints', () => {
  runtime.resetLocaleForTests();
  runtime.chooseLocale('de');
  const html = renderToStaticMarkup(createElement(TransferLedger, { loans: [], archive: [event(1, 'sale', 5_000_000), event(2, 'return'), event(3, 'declined'), event(4, 'loan')] as never }));
  for (const symbol of ['↗', '↙', '✋', '⇄']) assert.ok(html.includes(`<span>${symbol}</span>`), symbol);
  const empty = renderToStaticMarkup(createElement(TransferLedger, { loans: [], archive: [] }));
  assert.equal((empty.match(/transfer-ledger-empty/g) ?? []).length, 2);
  runtime.resetLocaleForTests();
});

test('the game screen only places the ledger', async () => {
  const page = await readFile(new URL('../app/game-app.tsx', import.meta.url), 'utf8');
  assert.match(page, /<TransferLedger loans=\{currentTransferLoans\} archive=\{displayGame\.features\.transferSaga\.archive\} \/>/);
  assert.doesNotMatch(page, /transfer-ledger-card|transferArchive/);
});
