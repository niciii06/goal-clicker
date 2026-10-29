// Prints income per league, first level paybacks and pack prices in minutes of income.
// Usage: npx tsx scripts/balance/simulate-economy.mts [clicksPerSecond] [minutesPerLeague]
import { UPGRADES } from "../../app/game/upgrades";
import { STAR_PACKS } from "../../app/feature-data";
import { getPackUnlockLeague, getUpgradeUnlockLeague } from "../../app/season-progression";
import { getFirstLevelPayback, simulateEconomy } from "./economy-model";

const clicksPerSecond = Number(process.argv[2] ?? 4);
const minutesPerLeague = Number(process.argv[3] ?? 45);
const snapshots = simulateEconomy({ clicksPerSecond, minutesPerLeague });
const format = (value: number) => value >= 1e9 ? `${(value / 1e9).toFixed(1)} Mrd` : value >= 1e6 ? `${(value / 1e6).toFixed(1)} Mio` : value >= 1e3 ? `${(value / 1e3).toFixed(1)}k` : value.toFixed(0);

console.log(`Gieriger Club, ${clicksPerSecond} Klicks pro Sekunde, ${minutesPerLeague} Minuten pro Liga\n`);
console.log("Liga  Einkommen/h (Schnitt)   Faktor");
snapshots.forEach((snapshot, index) => {
  const previous = snapshots[index - 1];
  const factor = previous ? (snapshot.averageIncomePerSecond / previous.averageIncomePerSecond).toFixed(2) : "";
  console.log(`${String(snapshot.league).padStart(4)}  ${format(snapshot.averageIncomePerSecond * 3600).padStart(21)}   ${factor}`);
});
console.log("\nUpgrade               Liga  Amortisation erste Stufe");
for (const upgrade of UPGRADES.filter((item) => item.kind === "auto")) {
  console.log(`${upgrade.name.padEnd(22)}${String(getUpgradeUnlockLeague(upgrade.id)).padStart(4)}  ${(getFirstLevelPayback(upgrade.id, clicksPerSecond) / 60).toFixed(1)} min`);
}
console.log("\nPack                  Liga  Preis        Minuten Einkommen");
for (const pack of STAR_PACKS) {
  const league = getPackUnlockLeague(pack.id);
  const income = snapshots.find((snapshot) => snapshot.league === league)!.averageIncomePerSecond;
  console.log(`${pack.label.padEnd(22)}${String(league).padStart(4)}  ${format(pack.price).padEnd(11)}  ${(pack.price / income / 60).toFixed(1)}`);
}
