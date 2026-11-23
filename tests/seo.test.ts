// Notion SEO ticket, technical part: one canonical public address, robots.txt and a sitemap with the public start
// page only. Title, description and every visible text stay as they are until the product decision.
import assert from 'node:assert/strict';
import test from 'node:test';
import robots from '../app/robots.ts';
import sitemap from '../app/sitemap.ts';
import { SITE_URL } from '../app/site-url.ts';

test('the public address is the bare domain over https', () => {
  assert.equal(SITE_URL, 'https://goalclicker.ch');
});

test('robots.txt lets every crawler read the public page and keeps the API and the login callback out', () => {
  const result = robots();
  assert.deepEqual(result.rules, [{ userAgent: '*', allow: '/', disallow: ['/api/', '/auth/'] }]);
  assert.equal(result.sitemap, 'https://goalclicker.ch/sitemap.xml');
  assert.equal(result.host, undefined);
});

test('the sitemap lists only the public start page on the canonical address', () => {
  assert.deepEqual(sitemap(), [{ url: 'https://goalclicker.ch/' }]);
});

// The metadata itself (canonical, index, follow, unchanged title and description) is checked in the served HTML
// by tests/rendered-html.test.mjs, since app/layout.tsx imports the style sheets.
