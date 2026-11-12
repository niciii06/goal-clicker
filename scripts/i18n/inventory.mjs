// Rough inventory of German player facing texts still written directly in the code (docs/i18n-plan.md), and of the
// places that store German text inside saves or worlds. Read only; a heuristic for planning, not a guarantee.
//
//   node scripts/i18n/inventory.mjs [--all]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'i18n') walk(path); }
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
})('app');

const literal = /(["'`])((?:(?!\1)[^\\\n]|\\.){3,})\1|>([^<>{}\n]*[A-Za-zÄÖÜäöü]{3,}[^<>{}\n]*)</g;
const german = /[äöüÄÖÜß]|\b(der|die|das|und|nicht|ist|ein|eine|mit|für|auf|zu|Bitte|Spiel|Welt|Karte|Saison|Tore?|Spieler|Fragmente)\b/;
// Texts that end up in a save or a world: history entries, news headlines, gazette issues, press answers.
const persisted = /\b(addHistory|headline|gazette|pushNews|addNews)\b/;

let total = 0;
let persistedTotal = 0;
const rows = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let count = 0;
  let stored = 0;
  for (const line of lines) {
    if (/^\s*(\/\/|\*|import )/.test(line)) continue;
    let hits = 0;
    for (const match of line.matchAll(literal)) {
      const text = (match[2] ?? match[3] ?? '').trim();
      if (/^[\w\-./:#@ ]+$/.test(text) && !german.test(text)) continue;
      if (german.test(text)) hits++;
    }
    count += hits;
    if (hits && persisted.test(line)) stored += hits;
  }
  if (count) rows.push({ file, count, stored });
  total += count;
  persistedTotal += stored;
}
rows.sort((a, b) => b.count - a.count);
console.log(`Deutsche Texte im Code (Schätzung): ${total} in ${rows.length} Dateien; davon in Spielstand oder Welt gespeichert: ${persistedTotal}`);
for (const row of process.argv.includes('--all') ? rows : rows.slice(0, 20)) {
  console.log(`${String(row.count).padStart(5)}  ${row.stored ? `(${row.stored} gespeichert) ` : ''}${row.file}`);
}
