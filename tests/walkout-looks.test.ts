import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { STAR_XI_PLAYERS } from '../app/feature-data.ts';
import { getStarCardTier, getWalkoutPresentation } from '../app/walkout-data.ts';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const figure = readFileSync(new URL('../app/walkout-figure.tsx', import.meta.url), 'utf8');
const walkouts = STAR_XI_PLAYERS.filter((player) => !['standard', 'rare'].includes(getStarCardTier(player)));
const byId = (id: string) => getWalkoutPresentation(STAR_XI_PLAYERS.find((player) => player.id === id)!);

test('every hair style of a walkout has a 3D hair piece and a drawn fallback', async () => {
  const { hairPiece } = await import('../app/walkout-3d.ts');
  for (const player of walkouts) {
    const look = getWalkoutPresentation(player);
    const body = look.body === 'women' ? 'women' : 'men';
    const { piece } = hairPiece(look.hair, body);
    assert.ok(look.hair === 'bald' || piece, `${player.name}: hair ${look.hair}`);
    if (piece) assert.ok(existsSync(new URL(`../public/walkout/hair-${piece}.glb`, import.meta.url)), `hair-${piece}.glb`);
    assert.ok(figure.includes(`case "${look.hair}"`), `${player.name}: drawn hair ${look.hair}`);
  }
  for (const file of ['body-men', 'body-women', 'clips', 'hair-beard']) assert.ok(existsSync(new URL(`../public/walkout/${file}.glb`, import.meta.url)), file);
});

test('signature looks make players recognisable', () => {
  assert.equal(byId('icon-ruud-gullit').hair, 'locs');
  assert.equal(byId('icon-ruud-gullit').beard, 'mustache');
  assert.equal(byId('icon-roberto-baggio').hair, 'pony');
  assert.ok(byId('icon-ronaldinho').headband);
  assert.ok(byId('icon-socrates').headband);
  assert.equal(byId('icon-petr-cech').helmet, true);
  assert.equal(byId('icon-david-beckham').tattoo, 'both');
  assert.equal(byId('star-lionel-messy').tattoo, 'left');
  assert.equal(byId('icon-sissi').hair, 'bald');
});

test('goalkeepers walk out in a keeper kit with gloves, outfield players do not', () => {
  for (const player of walkouts) {
    const look = getWalkoutPresentation(player);
    const keeper = player.positions.length > 0 && player.positions.every((position) => position === 'TW');
    if (player.id.startsWith('star-') && !player.sourceId) continue;
    assert.equal(Boolean(look.keeper), keeper, player.name);
    if (keeper) assert.ok(look.gloves, player.name);
  }
  assert.equal(byId('icon-lev-yashin').kitPrimary, '#151515');
});

test('women walk out with a women\'s figure and never with a beard', () => {
  const women = walkouts.filter((player) => player.isWomen);
  assert.ok(women.length >= 59);
  for (const player of women) {
    const look = getWalkoutPresentation(player);
    assert.equal(look.body, 'women', player.name);
    assert.equal(look.beard, 'clean', player.name);
  }
  assert.equal(getWalkoutPresentation(walkouts.find((player) => !player.isWomen && player.cardType === 'icon')!).body, undefined);
  assert.ok(css.includes('.wf.body-women'));
});
