// Reproducible performance baseline of the production build (npm run build, then npm run perf:baseline).
//
// It starts `next start` locally, opens the game in Chromium (mobile and desktop profile, cold cache, local anonymous
// play, no account, no database) and measures per scenario, several runs each:
//   LCP, FCP, CLS (Core Web Vitals), transferred bytes (JS and total), request count, and the longest input delay of
//   20 ball clicks as a stand in for INP (the real INP needs field data of real visitors).
// The result is printed as a Markdown table and written to the file given with --out. With --check the numbers are
// compared with scripts/qa/perf-budget.json and regressions are reported as warnings; the exit code stays 0, so a
// measurement on a noisy machine never blocks a deployment (use --strict to fail on a warning).
//
// Nothing here sends data anywhere and no real player data is read: the browser starts with an empty profile.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => { const index = args.indexOf(`--${name}`); return index >= 0 && args[index + 1] ? args[index + 1] : fallback; };
const RUNS = Number(option("runs", 3));
const PORT = Number(option("port", 8811));
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = option("out", "");
const BUDGET_FILE = new URL("./perf-budget.json", import.meta.url);

const PROFILES = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, cpuSlowdown: 4, network: { latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 } },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, cpuSlowdown: 1, network: null },
};
const SCENARIOS = [
  { id: "start", path: "/", label: "Erststart (Home)" },
  { id: "kader", path: "/kader", label: "Kader" },
  { id: "packs", path: "/packs", label: "Packshop" },
  { id: "spiele", path: "/spiele", label: "Spiele" },
];

async function waitForServer(timeout = 120000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { try { if ((await fetch(BASE)).ok) return; } catch { /* not yet */ } await new Promise((resolve) => setTimeout(resolve, 400)); }
  throw new Error(`Server on ${BASE} did not start`);
}

const median = (values) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0; };
const kb = (bytes) => Math.round(bytes / 102.4) / 10;

async function measure(browser, profile, scenario) {
  const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor, isMobile: profile.isMobile, hasTouch: profile.hasTouch, serviceWorkers: "block" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (profile.network) await cdp.send("Network.emulateNetworkConditions", { offline: false, ...profile.network });
  if (profile.cpuSlowdown > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuSlowdown });
  const types = new Map();
  let total = 0, requests = 0, scriptBytes = 0;
  cdp.on("Network.responseReceived", (event) => { types.set(event.requestId, event.type); });
  cdp.on("Network.loadingFinished", (event) => { const bytes = event.encodedDataLength ?? 0; total += bytes; requests++; if (types.get(event.requestId) === "Script") scriptBytes += bytes; });
  await page.addInitScript(() => {
    window.__perf = { lcp: 0, cls: 0, fcp: 0, events: [] };
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__perf.lcp = entry.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__perf.cls += entry.value; }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (entry.name === "first-contentful-paint") window.__perf.fcp = entry.startTime; }).observe({ type: "paint", buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__perf.events.push(entry.duration); }).observe({ type: "event", durationThreshold: 16, buffered: true });
  });
  const started = Date.now();
  await page.goto(BASE + scenario.path, { waitUntil: "load" });
  // Home shows the ball; every other tab is ready once the navigation and its panel are there.
  const ball = page.getByRole("button", { name: "Fussball anklicken" }).first();
  if (scenario.id === "start") await ball.waitFor({ state: "visible", timeout: 60000 });
  else await page.getByRole("button", { name: "Home", exact: true }).first().waitFor({ state: "visible", timeout: 60000 });
  const ready = Date.now() - started;
  await page.waitForLoadState("networkidle").catch(() => undefined);
  // 20 clicks on the ball: the worst input delay is the stand in for INP.
  if (scenario.id === "start") {
    for (let click = 0; click < 20; click++) { await ball.click({ force: true }).catch(() => undefined); await page.waitForTimeout(60); }
  }
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => ({ lcp: window.__perf.lcp, cls: window.__perf.cls, fcp: window.__perf.fcp, worstEvent: Math.max(0, ...window.__perf.events) }));
  await context.close();
  return { ...result, ready, totalBytes: total, scriptBytes, requests };
}

async function main() {
  if (!existsSync(".next/BUILD_ID")) throw new Error("Run npm run build first.");
  const server = spawn("node_modules/.bin/next", ["start", "-p", String(PORT), "-H", "127.0.0.1"], { stdio: "ignore", detached: true, env: { ...process.env, PORT: String(PORT) } });
  const browser = await (async () => { await waitForServer(); return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] }); })();
  const rows = [];
  try {
    for (const [profileName, profile] of Object.entries(PROFILES)) {
      for (const scenario of SCENARIOS) {
        const runs = [];
        for (let run = 0; run < RUNS; run++) runs.push(await measure(browser, profile, scenario));
        const pick = (key) => median(runs.map((value) => value[key]));
        rows.push({ profile: profileName, scenario: scenario.id, label: scenario.label, runs: RUNS, lcp: Math.round(pick("lcp")), fcp: Math.round(pick("fcp")), cls: Math.round(pick("cls") * 1000) / 1000, ready: Math.round(pick("ready")), worstEvent: Math.round(pick("worstEvent")), totalKB: kb(pick("totalBytes")), scriptKB: kb(pick("scriptBytes")), requests: Math.round(pick("requests")) });
      }
    }
  } finally {
    await browser.close();
    try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGTERM"); }
  }
  const commit = await new Promise((resolve) => { const git = spawn("git", ["rev-parse", "--short", "HEAD"]); let text = ""; git.stdout.on("data", (chunk) => { text += chunk; }); git.on("close", () => resolve(text.trim() || "unbekannt")); });
  const header = `| Profil | Szenario | LCP ms | FCP ms | CLS | bereit ms | längste Eingabe ms | JS KB | gesamt KB | Anfragen |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|`;
  const lines = rows.map((row) => `| ${row.profile} | ${row.label} | ${row.lcp} | ${row.fcp} | ${row.cls} | ${row.ready} | ${row.scenario === "start" ? row.worstEvent : "-"} | ${row.scriptKB} | ${row.totalKB} | ${row.requests} |`);
  const text = [`# Performance Baseline`, ``, `Commit ${commit}, Node ${process.version}, Chromium ${browser.version?.() ?? ""}, ${RUNS} Läufe je Zeile (Median), kalter Cache, lokaler \`next start\`, ohne Konto und Datenbank.`, `Mobil: 390 x 844, CPU 4 fach gedrosselt, Netz 1,6 Mbit/s und 150 ms Latenz. Desktop: 1280 x 800 ohne Drosselung.`, `"längste Eingabe" ist die längste Verarbeitung von 20 Ballklicks (Ersatz für INP, nur synthetisch).`, ``, header, ...lines, ``].join("\n");
  console.log(text);
  if (OUT) writeFileSync(OUT, text + "\n");
  if (flag("check") || flag("strict")) {
    const budget = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
    const warnings = [];
    for (const row of rows) {
      const limits = budget[`${row.profile}:${row.scenario}`];
      if (!limits) continue;
      for (const [key, limit] of Object.entries(limits)) if (row[key] > limit) warnings.push(`${row.profile} ${row.label}: ${key} ${row[key]} über dem Budget ${limit}`);
    }
    for (const warning of warnings) console.warn(`WARNUNG ${warning}`);
    if (!warnings.length) console.log("Alle Werte liegen im Budget.");
    if (flag("strict") && warnings.length) process.exit(1);
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
