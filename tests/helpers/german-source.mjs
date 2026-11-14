// Source tests read app code and look for the German wording the player sees. Since the texts moved into the
// catalogue (docs/i18n-plan.md), the code says t("key", { name: value }) instead. germanSource() turns those calls back
// into what the code used to say, with the German catalogue text:
//   attr={t("k")}            -> attr="Text"
//   >{t("k")}<  {t("k")}     -> Text (JSX text)
//   t("k") / t('k')          -> "Text" / 'Text' (same quotes)
//   t("k", { a: expr, b })   -> `Text with ${expr} and ${b}` (plural messages: the "other" form)
//   localizeText(x), dataText(x) -> x
// so the existing assertions keep checking the same German wording.
// Plain JavaScript so that the .mjs tests (run without tsx) can use it too: the German catalogue is read from the
// catalogue files, one "key": value entry per line.
import { readFileSync } from 'node:fs';

const CATALOG = new Map();
for (const file of ['../../app/i18n/messages/de.ts', '../../app/i18n/messages/game.de.ts']) {
  for (const line of readFileSync(new URL(file, import.meta.url), 'utf8').split('\n')) {
    const entry = /^\s*"([\w.]+)":\s*(.+?),?\s*$/.exec(line);
    if (!entry) continue;
    const value = entry[2].startsWith('{') ? /other:\s*("(?:[^"\\]|\\.)*")/.exec(entry[2])?.[1] : entry[2];
    if (value?.startsWith('"')) CATALOG.set(entry[1], JSON.parse(value));
  }
}
const german = (key) => {
  const text = CATALOG.get(key);
  if (text === undefined) throw new Error(`germanSource: unknown key ${key}`);
  return text;
};

/** Index just after the bracket that closes the one at `open`, skipping strings and template literals. */
function closing(source, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const stack = [];
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < source.length && source[i] !== c; i++) if (source[i] === '\\') i++;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) { stack.pop(); if (!stack.length) return i + 1; }
  }
  return source.length;
}

/** Splits `{ a: x, b }` into [name, expression] pairs at the top level. */
function params(object) {
  const inner = object.trim().replace(/^\{/, '').replace(/\}$/, '');
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '"' || c === "'" || c === '`') { for (i++; i < inner.length && inner[i] !== c; i++) if (inner[i] === '\\') i++; continue; }
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) { parts.push(inner.slice(start, i)); start = i + 1; }
  }
  parts.push(inner.slice(start));
  return new Map(parts.map((p) => p.trim()).filter(Boolean).map((p) => {
    const colon = p.indexOf(':');
    return colon === -1 ? [p, p] : [p.slice(0, colon).trim(), p.slice(colon + 1).trim()];
  }));
}

export function germanSource(source) {
  let out = '';
  let i = 0;
  const call = /(?<![\w.$])(t|localizeText|dataText)\(/g;
  for (let match = call.exec(source); match; match = call.exec(source)) {
    const start = match.index;
    const end = closing(source, start + match[1].length);
    const args = source.slice(start + match[1].length + 1, end - 1);
    let replacement;
    if (match[1] !== 't') replacement = germanSource(args);
    else {
      const keyMatch = /^\s*(["'])([\w.]+)\1\s*(?:,([\s\S]*))?$/.exec(args);
      if (!keyMatch) { call.lastIndex = start + 2; continue; }
      const text = german(keyMatch[2]);
      if (keyMatch[3]) {
        const values = params(keyMatch[3]);
        replacement = '`' + text.replace(/\{(\w+)\}/g, (all, name) => (values.has(name) ? '${' + germanSource(values.get(name)) + '}' : all)) + '`';
      } else replacement = keyMatch[1] === "'" ? `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'` : JSON.stringify(text);
    }
    // attr={t("k")} -> attr="Text" and {t("k")} in JSX -> Text, only for plain texts.
    const before = source.slice(i, start);
    const wrapped = before.endsWith('{') && source[end] === '}';
    if (wrapped && /^["']/.test(replacement)) {
      const isAttr = /=\{$/.test(before);
      const plain = replacement.slice(1, -1).replace(/\\(.)/g, '$1');
      out += before.slice(0, -1) + (isAttr ? JSON.stringify(plain) : plain);
      i = end + 1;
    } else {
      out += before + replacement;
      i = end;
    }
    call.lastIndex = i;
  }
  return out + source.slice(i);
}
