import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/repair-lockfile.mjs", import.meta.url));

test("lockfile repair handles supported endings, is idempotent and preserves invalid input", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "goal-lockfile-test-"));
  const lockfile = path.join(directory, "package-lock.json");
  const valid = JSON.stringify({ packages: { "": { devDependencies: { typescript: "5.9.3" } } } }, null, 2);
  const run = () => spawnSync(process.execPath, [script], { cwd: directory, encoding: "utf8" });
  try {
    const oneMissing = valid.slice(0, -1).trimEnd();
    const twoMissing = oneMissing.slice(0, -1).trimEnd();
    for (const content of [valid, oneMissing, twoMissing, '{"lockfileVersion":3}']) {
      writeFileSync(lockfile, content);
      const result = run();
      assert.equal(result.status, 0, result.stderr);
      const repaired = readFileSync(lockfile, "utf8");
      const expected = JSON.parse(valid);
      expected.packages[""].devDependencies.tsx = "4.22.1";
      assert.deepEqual(JSON.parse(repaired), content.includes("packages") ? expected : { lockfileVersion: 3 });
      assert.equal(run().status, 0);
      assert.equal(readFileSync(lockfile, "utf8"), repaired);
    }
    writeFileSync(lockfile, "{invalid");
    assert.notEqual(run().status, 0);
    assert.equal(readFileSync(lockfile, "utf8"), "{invalid");
  } finally {
    unlinkSync(lockfile);
    rmdirSync(directory);
  }
});

test("lockfile root dependencies match the package manifest", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const lockfile = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  assert.deepEqual(lockfile.packages[""].dependencies, manifest.dependencies);
  assert.deepEqual(lockfile.packages[""].devDependencies, manifest.devDependencies);
});
