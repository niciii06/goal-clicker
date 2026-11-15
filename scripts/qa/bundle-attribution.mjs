// Bundle analysis (docs/qa/bundle-analysis.md): bytes of each client chunk attributed to its source files via the
// source maps of an ANALYSIS build. Read only; nothing in the app changes.
//   1. In a scratch copy set productionBrowserSourceMaps: true in next.config.ts (never commit it), run npx next build.
//   2. node scripts/qa/bundle-attribution.mjs <that copy> out.json
// Per source: raw bytes and gzip of its generated code compressed on its own (a little above its share in the chunk).
// JSON modules inlined as JSON.parse('…') are counted on their own and matched to their file by length.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
const W = process.argv[2]; const { SourceMapConsumer } = createRequire(path.join(W, 'package.json'))('source-map-js');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const dir = W + '/.next/static/chunks';
const norm = (s) => { const m = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(s); if (m) return 'npm:' + m[1]; return s.replace(/^turbopack:\/\/\/?(\[project\]\/)?/, '').replace(/\.\[json\]\.cjs\/.*$/, ''); };
const rows = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const code = fs.readFileSync(path.join(dir, f), 'utf8'); const buf = Buffer.from(code);
  const ref = /sourceMappingURL=(\S+)\s*$/.exec(code); const mf = ref && path.join(dir, ref[1]);
  const ranges = {};
  // JSON.parse('...') literals belong to the JSON module listed in the map; attribute them by size match
  for (const m of code.matchAll(/JSON\.parse\('/g)) { const s = m.index + 12, e = code.indexOf("')", s); (ranges['JSON@' + (e - s)] ??= []).push([Buffer.byteLength(code.slice(0, s)), Buffer.byteLength(code.slice(0, e))]); }
  if (mf && fs.existsSync(mf)) {
    const map = JSON.parse(fs.readFileSync(mf, 'utf8')); const c = new SourceMapConsumer(map);
    const lines = code.split('\n'); const ls = []; let acc = 0; for (const l of lines) { ls.push(acc); acc += Buffer.byteLength(l) + 1; }
    const segs = []; c.eachMapping((m) => segs.push({ line: m.generatedLine - 1, col: m.generatedColumn, src: norm(m.source || '?') }));
    segs.sort((a, b) => a.line - b.line || a.col - b.col);
    const jsonRanges = Object.entries(ranges).flatMap(([, r]) => r);
    for (let i = 0; i < segs.length; i++) { const s = segs[i], n = segs[i + 1]; let a = ls[s.line] + s.col, b = n && n.line === s.line ? ls[n.line] + n.col : ls[s.line] + Buffer.byteLength(lines[s.line] || '');
      for (const [ja, jb] of jsonRanges) { if (a < jb && b > ja) { if (a < ja) (ranges[s.src] ??= []).push([a, ja]); a = Math.max(a, jb); } }
      if (b > a) (ranges[s.src] ??= []).push([a, b]); }
    const jsonSources = (map.sources || []).filter((x) => /\.json/.test(x)).map(norm);
    for (const k of Object.keys(ranges).filter((k) => k.startsWith('JSON@'))) { const len = Number(k.slice(5)); const guess = jsonSources.find((js) => { try { return JSON.stringify(readJson(path.join(W, js))).length + 10 > len && JSON.stringify(readJson(path.join(W, js))).length - 10 < len; } catch { return false; } }); ranges[(guess || 'JSON-Literal') + ' (JSON)'] = ranges[k]; delete ranges[k]; }
  }
  for (const [src, rs] of Object.entries(ranges)) { const part = Buffer.concat(rs.map(([a, b]) => buf.subarray(a, b))); rows.push({ chunk: f, src, raw: part.length, gzip: zlib.gzipSync(part, { level: 9 }).length }); }
  if (!Object.keys(ranges).length) rows.push({ chunk: f, src: '(ohne Source Map)', raw: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length });
}
fs.writeFileSync(process.argv[3], JSON.stringify(rows));
const by = {};
for (const r of rows) { const e = (by[r.src] ??= { raw: 0, gzip: 0 }); e.raw += r.raw; e.gzip += r.gzip; }
for (const [src, v] of Object.entries(by).sort((a, b) => b[1].gzip - a[1].gzip).slice(0, 30)) console.log(`${(v.raw / 1024).toFixed(0).padStart(6)} KB roh ${(v.gzip / 1024).toFixed(1).padStart(7)} KB gzip  ${src}`);
