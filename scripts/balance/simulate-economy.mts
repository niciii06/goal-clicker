// Prints income per league, first level paybacks, how long a pack takes to save when it opens (passive, one active
// player, co-op with two and four active players), what the click upgrades really add after their share caps, and
// whole careers with pack purchases, matches, match rewards and event pauses.
// The pack target is the passive median: income per second only, with the VAR and the random events as in the game.
// Usage: npx tsx scripts/balance/simulate-economy.mts [minutesPerLeague] [careers]
import { UPGRADES } from "../../app/game/upgrades";
import { STAR_PACKS, STARTER_SQUAD_UNLOCK_CLICKS } from "../../app/feature-data";
import { getPackUnlockLeague, getUpgradeUnlockLeague } from "../../app/season-progression";
import { activeClicks, clickUpgradeReport, getFirstLevelPayback, savingMinutes, simulateEconomy } from "./economy-model";
import { MATCH_SECONDS, OFFICE_SECONDS, PLAY_MINUTES_PER_DAY, TRAVEL_SECONDS, simulateCareer, summarizeCareers } from "./progression-model";

const minutesPerLeague = Number(process.argv[2] ?? 45);
const careers = Number(process.argv[3] ?? 25);
const format = (value: number) => value >= 1e9 ? `${(value / 1e9).toFixed(1)} Mrd` : value >= 1e6 ? `${(value / 1e6).toFixed(1)} Mio` : value >= 1e3 ? `${(value / 1e3).toFixed(1)}k` : value.toFixed(0);
const minutes = (value: number) => Number.isFinite(value) ? value.toFixed(1) : "-";
const modes = [
  { label: "passiv", clicks: 0 },
  { label: "1 aktiv", clicks: activeClicks(3) },
  { label: "Koop 2", clicks: activeClicks(3, 2) },
  { label: "Koop 4", clicks: activeClicks(3, 4) },
];
const snapshots = Object.fromEntries(modes.map((mode) => [mode.label, simulateEconomy({ minutesPerLeague, clicksPerSecond: mode.clicks })]));
const passive = snapshots.passiv;

console.log(`Gieriger Club, ${minutesPerLeague} Minuten pro Liga. Aktiv = 3 Klicks pro Sekunde mit voller Combo pro Spieler.\n`);
console.log("Liga  passiv/s beim Start  Schnitt/s   Faktor   1 aktiv/s   Koop 2/s   Koop 4/s");
passive.forEach((snapshot, index) => {
  const previous = passive[index - 1];
  const factor = previous ? (snapshot.averageIncomePerSecond / previous.averageIncomePerSecond).toFixed(2) : "";
  const others = modes.slice(1).map((mode) => format(snapshots[mode.label][index].incomePerSecond).padStart(10)).join(" ");
  console.log(`${String(snapshot.league).padStart(4)}  ${format(snapshot.incomePerSecond).padStart(19)}  ${format(snapshot.averageIncomePerSecond).padStart(9)}   ${factor.padStart(6)}  ${others}`);
});
console.log("\nUpgrade               Liga  Amortisation erste Stufe (passiv)");
for (const upgrade of UPGRADES.filter((item) => item.kind === "auto")) {
  console.log(`${upgrade.name.padEnd(22)}${String(getUpgradeUnlockLeague(upgrade.id)).padStart(4)}  ${(getFirstLevelPayback(upgrade.id) / 60).toFixed(1)} min`);
}
console.log("\nPack beim Freischalten, Minuten Median / P90 (10 % der Durchläufe warten länger), mit VAR und Ereignissen");
console.log(`Pack                  Liga  Preis       ${modes.map((mode) => mode.label.padStart(13)).join("")}`);
for (const pack of STAR_PACKS.filter((item) => item.id !== "scrap")) {
  const league = getPackUnlockLeague(pack.id);
  const cells = modes.map((mode) => {
    const stats = savingMinutes(snapshots[mode.label].find((snapshot) => snapshot.league === league)!.incomePerSecond, pack.price);
    return `${minutes(stats.median)} / ${minutes(stats.p90)}`.padStart(13);
  }).join("");
  console.log(`${pack.label.padEnd(22)}${String(league).padStart(4)}  ${format(pack.price).padEnd(10)}  ${cells}`);
}
for (const [id, league] of [["worldclass", 11], ["ballondor", 9], ["captain", 6]] as const) {
  const upgrade = UPGRADES.find((item) => item.id === id)!;
  console.log(`\n${upgrade.name} ab Liga ${league}: Mehrertrag pro Stufe nach dem Deckel (1 / 3 Klicks pro Sekunde, volle Combo)`);
  for (const row of clickUpgradeReport(id, league)) {
    console.log(`  Stufe ${row.level}  Preis ${format(row.cost).padEnd(9)}  +${format(row.gainOneClick).padEnd(9)}  +${format(row.gainThreeClicks).padEnd(9)}  Amortisation ${(row.payback / 60).toFixed(1)} min`);
  }
}
console.log(`\nKarrieren (${careers} pro Modus): ${OFFICE_SECONDS / 60} min Büro, ${TRAVEL_SECONDS / 60} min Reise, ${MATCH_SECONDS / 60} min Partie pro Spieltag, eine Tagesprämie pro ${PLAY_MINUTES_PER_DAY} min Spielzeit.`);
console.log(`Volle Startelf: Starterkader nach ${STARTER_SQUAD_UNLOCK_CLICKS} Klicks, also nach ${(STARTER_SQUAD_UNLOCK_CLICKS / 60).toFixed(1)} min bei 1 Klick pro Sekunde.`);
for (const mode of modes.slice(0, 2)) {
  const summary = summarizeCareers(Array.from({ length: careers }, (_, index) => simulateCareer({ clicksPerSecond: mode.clicks, seed: index + 1 })));
  console.log(`\n${mode.label}: Liga  Minuten in der Liga (Median / P90)  Wartezeit nächstes Pack (Median / P90)  Teamrating`);
  for (const row of summary) console.log(`${String(row.league).padStart(4)}   ${`${minutes(row.minutes.median)} / ${minutes(row.minutes.p90)}`.padStart(16)}   ${`${minutes(row.packWait.median)} / ${minutes(row.packWait.p90)}`.padStart(20)}   ${row.squadRating.toFixed(1)}`);
}
