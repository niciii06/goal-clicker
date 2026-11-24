// Shared measuring helper of the isolated theme audits (theme-audit-all-states.test.ts, theme-audit-account-states.test.ts).
import type { Page } from 'playwright-core';

export type Finding = { kind: 'contrast' | 'surface' | 'overflow'; at: string; detail: string };
/** Measures what is on screen right now. Only elements inside the viewport are looked at. */
export function measure(page: Page, scheme: 'light' | 'dark'): Promise<{ findings: Finding[]; unmeasured: number }> {
  return page.evaluate((theme) => {
    const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const rgba = (c: string) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
    const lum = (c: { r: number; g: number; b: number }) => { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
    const over = (top: { r: number; g: number; b: number; a: number }, under: { r: number; g: number; b: number }) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a) });
    const page = theme === 'dark' ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
    const label = (el: Element) => `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') || '').split(' ').filter(Boolean).slice(0, 2).join('.')}`;
    /** The background colour seen behind an element; a gradient or image makes it unknown (null). */
    const backdrop = (el: Element) => {
      const chain: Element[] = []; for (let n: Element | null = el; n; n = n.parentElement) chain.push(n);
      let colour = page, unknown = false;
      for (const n of chain.reverse()) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage !== 'none') { unknown = true; }
        const bg = rgba(cs.backgroundColor); if (bg.a > 0) { colour = over(bg, colour); unknown = unknown && bg.a < 1; }
      }
      return unknown ? null : colour;
    };
    const visible = (el: Element) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
    let unmeasured = 0;
    const findings: { kind: 'contrast' | 'surface' | 'overflow'; at: string; detail: string }[] = [];
    const seen = new Set<string>();
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0);
      // Inactive controls are exempt from the contrast rule (WCAG 1.4.3); text without a letter or digit is an emoji, whose colour is its own.
      const hasWords = [...el.childNodes].some((n) => n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.textContent || ''));
      if (own && hasWords && !el.closest('[disabled], [aria-disabled="true"]')) {
        const bg = backdrop(el);
        if (!bg) unmeasured++;
        if (bg) {
          const fg = rgba(cs.color), text = over({ ...fg, a: fg.a * Number(cs.opacity) }, bg);
          const a = lum(text), b = lum(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
          const size = parseFloat(cs.fontSize), large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
          const key = `${label(el)}|${ratio.toFixed(1)}`;
          if (ratio < (large ? 3 : 4.5) && !seen.has(key)) { seen.add(key); findings.push({ kind: 'contrast', at: label(el), detail: `"${(el.textContent || '').trim().slice(0, 28)}" ${ratio.toFixed(2)}:1 (${size}px)` }); }
        }
      }
      const bgc = rgba(cs.backgroundColor);
      if (bgc.a >= 0.85 && r.width * r.height >= 9000 && cs.backgroundImage === 'none') {
        const L = lum(bgc);
        const wrong = theme === 'dark' ? L > 0.55 : L < 0.1;
        const key = `S|${label(el)}`;
        if (wrong && !seen.has(key)) { seen.add(key); findings.push({ kind: 'surface', at: label(el), detail: `${theme === 'dark' ? 'light' : 'dark'} surface rgb(${bgc.r},${bgc.g},${bgc.b}) ${Math.round(r.width)}x${Math.round(r.height)}` }); }
      }
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) findings.push({ kind: 'overflow', at: 'page', detail: `scrollWidth ${document.documentElement.scrollWidth} > ${innerWidth}` });
    return { findings, unmeasured };
  }, scheme);
}

