import assert from "node:assert/strict";
import test from "node:test";
import { formatNumber } from "../app/game/format";
import { STAR_RATING_FILTERS } from "../app/game/constants";
import { filterAndSortReserve, matchesReservePosition, matchesReserveRating } from "../app/game/reserve-filter";

test("formatNumber rounds before choosing the unit", () => {
  assert.equal(formatNumber(999), "999");
  assert.equal(formatNumber(1000), "1.0K");
  assert.equal(formatNumber(1500), "1.5K");
  assert.equal(formatNumber(9949), "9.9K");
  assert.equal(formatNumber(9960), "10K");
  assert.equal(formatNumber(99_499), "99K");
  assert.equal(formatNumber(999_499), "999K");
  assert.equal(formatNumber(999_600), "1.0M");
  assert.equal(formatNumber(1e6), "1.0M");
  assert.equal(formatNumber(999_999_999), "1.0B");
  assert.equal(formatNumber(1e9), "1.0B");
  assert.equal(formatNumber(1.2345e12), "1.2T");
  assert.equal(formatNumber(Infinity), "MAX");
  assert.equal(formatNumber(0), "0");
  assert.match(formatNumber(1e40), /e/);
});

test("reserve rating chips follow the card tiers and cover every rating", () => {
  assert.deepEqual(STAR_RATING_FILTERS.map((filter) => filter.label), ["Alle", "bis 70", "71 bis 79", "80 bis 85", "86 bis 89", "90+"]);
  for (const filter of STAR_RATING_FILTERS) assert.doesNotMatch(filter.label, /[–—]/);
  for (let rating = 40; rating <= 100; rating += 1) {
    const chips = STAR_RATING_FILTERS.filter((filter) => filter.id !== "all" && matchesReserveRating(rating, filter.id));
    assert.equal(chips.length, 1, `rating ${rating}`);
  }
  assert.ok(matchesReserveRating(55, "0-70"));
});

test("reserve position filter maps FC27 positions onto LAV, RAV and MS", () => {
  assert.ok(matchesReservePosition(["LV"], "LAV"));
  assert.ok(matchesReservePosition(["ST"], "MS"));
  assert.ok(matchesReservePosition(["RAV"], "RV"));
  assert.ok(!matchesReservePosition(["IV"], "LAV"));
  assert.ok(matchesReservePosition(["IV"], "all"));
});

test("reserve filters and sorts by the shown career rating", () => {
  const entries = [
    { id: "grown", name: "Gewachsen", positions: ["ST" as const], rating: 95 },
    { id: "plain", name: "Normal", positions: ["ST" as const], rating: 88 },
    { id: "low", name: "Starter", positions: ["IV" as const], rating: 57 },
  ];
  assert.deepEqual(filterAndSortReserve(entries, { search: "", ratingFilter: "all", positionFilter: "all" }).map((entry) => entry.id), ["grown", "plain", "low"]);
  assert.deepEqual(filterAndSortReserve(entries, { search: "", ratingFilter: "90-100", positionFilter: "all" }).map((entry) => entry.id), ["grown"]);
  assert.deepEqual(filterAndSortReserve(entries, { search: "", ratingFilter: "0-70", positionFilter: "all" }).map((entry) => entry.id), ["low"]);
  assert.deepEqual(filterAndSortReserve(entries, { search: "95", ratingFilter: "all", positionFilter: "MS" }).map((entry) => entry.id), ["grown"]);
});

test("league roadmap names every upgrade, pack and formation of its league", async () => {
  const { SEASON_MILESTONES, PACK_NAMES } = await import("../app/season-roadmap");
  const { getUpgradeUnlockLeague, getPackUnlockLeague, getFormationUnlockLeague, leagueForTier } = await import("../app/season-progression");
  const { UPGRADES } = await import("../app/game/upgrades");
  const { STAR_PACKS, SPECIAL_CARD_PACK, STAR_FORMATIONS } = await import("../app/feature-data");
  assert.equal(SEASON_MILESTONES.length, 15);
  const rewardsOf = (league: number) => SEASON_MILESTONES.find((milestone) => leagueForTier(milestone.season) === league)!.rewards;
  for (const upgrade of UPGRADES) {
    const league = getUpgradeUnlockLeague(upgrade.id);
    if (league === 15) continue; // summarised as "6 Basis Upgrades"
    assert.ok(rewardsOf(league).includes(upgrade.name), `${upgrade.name} in Liga ${league}`);
  }
  assert.ok(rewardsOf(15).includes(`${UPGRADES.filter((upgrade) => getUpgradeUnlockLeague(upgrade.id) === 15).length} Basis Upgrades`));
  for (const pack of [...STAR_PACKS, SPECIAL_CARD_PACK]) {
    assert.equal(PACK_NAMES[pack.id], pack.label);
    assert.ok(rewardsOf(getPackUnlockLeague(pack.id)).includes(pack.label), pack.label);
  }
  for (let league = 1; league <= 15; league += 1) {
    const count = STAR_FORMATIONS.filter((formation) => getFormationUnlockLeague(formation.id) === league).length;
    if (count) assert.ok(rewardsOf(league).some((reward) => reward.includes("Formation")), `Liga ${league}`);
  }
  assert.ok(rewardsOf(1).includes("Formation 5-4-1"));
});

test("kick off text uses the real match duration", async () => {
  const { beginSeasonCupMatch, beginCupMatch, initialGameFeatures, seasonMatchDuration, tournamentMatchDuration, TOURNAMENTS } = await import("../app/feature-data");
  const { formatCountdown } = await import("../app/game/format");
  for (const division of [1, 5, 13, 14, 15]) {
    const features = initialGameFeatures();
    features.seasonMode.division = division;
    const cup = beginSeasonCupMatch(features.cup, features.seasonMode, 1_000_000);
    assert.equal(cup.matchEndsAt - 1_000_000, seasonMatchDuration(division), `division ${division}`);
  }
  for (const tournament of TOURNAMENTS) {
    const cup = beginCupMatch(initialGameFeatures().cup, 1_000_000, tournament.id);
    assert.equal(cup.matchEndsAt - 1_000_000, tournamentMatchDuration(tournament.minimumRating), tournament.id);
  }
  assert.equal(formatCountdown(seasonMatchDuration(15), 0), "04:00");
  assert.equal(formatCountdown(seasonMatchDuration(3), 0), "03:30");
  const pageSource = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../app/page.tsx", import.meta.url), "utf8"));
  assert.doesNotMatch(pageSource, /06:00/);
});

test("album merges the custom and legendary groups without a double claim", async () => {
  const { claimAlbumReward, getAlbumGroups, initialCareerState } = await import("../app/career-data");
  const { initialGameFeatures, STAR_XI_ACTIVE_PLAYERS } = await import("../app/feature-data");
  const specials = STAR_XI_ACTIVE_PLAYERS.filter((player) => player.isCustom || player.cardType === "legendary").map((player) => player.id);
  assert.ok(specials.length > 0);
  const groups = getAlbumGroups(initialCareerState());
  assert.equal(groups.filter((group) => group.id === "custom" || group.id === "legendary").length, 1);

  const fresh = initialGameFeatures();
  fresh.career.collectedIds = [...specials];
  const before = fresh.starXI.fragments;
  assert.equal(claimAlbumReward(fresh, "legendary"), true);
  assert.equal(fresh.starXI.fragments, before + 5000);
  assert.equal(claimAlbumReward(fresh, "legendary"), false);
  assert.equal(claimAlbumReward(fresh, "custom"), false);
  assert.equal(fresh.starXI.fragments, before + 5000);

  for (const earlierClaims of [["custom"], ["legendary"], ["custom", "legendary"]]) {
    const saved = initialGameFeatures();
    saved.career.collectedIds = [...specials];
    saved.career.claimedAlbumRewards = [...earlierClaims];
    assert.equal(getAlbumGroups(saved.career).find((group) => group.id === "legendary")?.claimed, true);
    assert.equal(claimAlbumReward(saved, "legendary"), false);
    assert.equal(claimAlbumReward(saved, "custom"), false);
    assert.deepEqual(saved.career.claimedAlbumRewards, earlierClaims);
  }
});

test('the Fabrizio transfer window follows the theme: light by default, dark tokens only in the dark blocks', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  const tokens = [...css.matchAll(/--(tx-[a-z-]+):/g)].map((match) => match[1]);
  const names = [...new Set(tokens)];
  assert.ok(names.length >= 25, 'the window is described by theme tokens');
  const lightRoot = css.slice(css.indexOf('/* Fabrizio Romario transfer window'), css.indexOf('/* Stadion bei Nacht'));
  const darkMedia = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf(':root[data-theme="dark"]'));
  const darkForced = css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf(':root[data-theme="dark"]') + 6000);
  for (const name of names) {
    assert.ok(lightRoot.includes(`--${name}:`), `light value of ${name}`);
    assert.ok(darkMedia.includes(`--${name}:`), `dark value of ${name} for the system setting`);
    assert.ok(darkForced.includes(`--${name}:`), `dark value of ${name} for the chosen dark theme`);
  }
  // The light card is light, the dark card is the former near black night look, both with readable text colours.
  assert.match(lightRoot, /--tx-card-bg: linear-gradient\(150deg, #ffffff/);
  assert.match(darkMedia, /--tx-card-bg: linear-gradient\(150deg, rgba\(16,39,29,\.98\)/);
  assert.match(lightRoot, /--tx-card-text: var\(--text\)/);
  // No fixed dark or white colours are left in the transfer window rules themselves.
  // (The round FR avatar and the LIVE badge are bright green with dark text in both themes on purpose.)
  const rules = css.split('\n').filter((line) => (/^\.transfer-insider-/.test(line) || /^\.transfer-insider-card \./.test(line)) && !/^\.transfer-insider-reporter (> span|b) /.test(line));
  assert.ok(rules.length >= 20);
  for (const rule of rules) assert.doesNotMatch(rule, /#fff\b|rgba\(255,255,255|#0[0-9a-f]{5}|rgba\(2,10,7|rgba\(16,39,29/i, rule.slice(0, 90));
  // Every outcome keeps its own colours: offer, sale, failed and declined chips and card variants.
  for (const variant of ['sale', 'failed', 'offer', 'declined']) assert.match(css, new RegExp(`\\.transfer-insider-takeover\\.${variant} \\.transfer-insider-(card|result) \\{`));
});

test('Club & Mehr: the club identity is a section of its own, set apart from the save file card above it', async () => {
  const { readFile } = await import('node:fs/promises');
  const [page, css] = await Promise.all([readFile(new URL('../app/page.tsx', import.meta.url), 'utf8'), readFile(new URL('../app/globals.css', import.meta.url), 'utf8')]);
  assert.match(page, /<section className="club-identity" aria-label="Clubidentität">[\s\S]*Clubprofil speichern<\/button><\/div><\/section>/);
  assert.match(page, /className="club-preview" role="img" aria-label=\{`Vorschau deines Wappens/, 'the badge preview is a picture, not a lookalike button');
  assert.match(css, /\.club-identity \{ margin-top: 16px; padding: 16px; border: 1px solid var\(--line-soft\)/);
});

test('the iPhone and iPad header is a nearly opaque glass (WebKit only), so logo and icons keep their contrast', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /@supports \(-webkit-touch-callout: none\) \{\s*\.topbar \{ background: color-mix\(in srgb, var\(--surface-raised\) 94%, transparent\); \}/);
  // The rule comes after the glass header definition, so it wins on iOS only.
  assert.ok(css.indexOf('@supports (-webkit-touch-callout: none) {\n  .topbar') > css.indexOf('.topbar { top: 0; margin: 0 calc(var(--space-2) * -1)'));
});
