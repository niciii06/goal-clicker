// The performance baseline tooling: the budget file stays valid and complete. The measurement itself needs a build and
// a browser (npm run perf:baseline) and is not part of the unit tests, so a noisy machine never fails them.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('every measured scenario has a budget, and the budget is a plain set of positive limits', async () => {
  const [budgetText, script, doc, pkg] = await Promise.all(['../scripts/qa/perf-budget.json', '../scripts/qa/perf-baseline.mjs', '../docs/qa/perf-baseline.md', '../package.json'].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
  const budget = JSON.parse(budgetText) as Record<string, Record<string, number> | string>;
  const scenarios = [...script.matchAll(/id: "([a-z]+)", path:/g)].map((match) => match[1]);
  assert.deepEqual(scenarios, ['start', 'kader', 'packs', 'spiele']);
  for (const profile of ['mobile', 'desktop']) for (const scenario of scenarios) {
    const limits = budget[`${profile}:${scenario}`] as Record<string, number>;
    assert.ok(limits, `${profile}:${scenario} has a budget`);
    for (const [key, value] of Object.entries(limits)) { assert.ok(['scriptKB', 'totalKB', 'requests', 'cls', 'lcp'].includes(key), key); assert.ok(value > 0, `${profile}:${scenario}.${key}`); }
  }
  // Warnings only by default: the check never blocks unless --strict is asked for.
  assert.match(script, /if \(flag\("strict"\) && warnings\.length\) process\.exit\(1\);/);
  assert.match(script, /serviceWorkers: "block"/);
  assert.doesNotMatch(script, /fetch\((?!BASE)|XMLHttpRequest|navigator\.sendBeacon|https?:\/\/(?!127\.0\.0\.1)/, 'nothing is sent anywhere');
  assert.match(doc, /\| Profil \| Szenario \| LCP ms/);
  assert.match(JSON.parse(pkg).scripts['perf:baseline'], /perf-baseline\.mjs/);
});
