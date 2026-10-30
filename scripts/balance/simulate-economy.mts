// Prints passive income per league, first level paybacks and how long a pack takes to save when it opens.
// Only income per second counts (no clicks); the VAR and the random events hit the savings as in the game.
// Usage: npx tsx scripts/balance/simulate-economy.mts [minutesPerLeague]
import { UPGRADES } from "../../app/game/upgrades";
import { STAR_PACKS } from "../../app/feature-data";
import { getPackUnlockLeague, getUpgradeUnlockLeague } from "../../app/season-progression";
import { getFirstLevelPayback, medianSavingMinutes, simulateEconomy } from "./economy-model";

const minutesPerLeague = Number(process.argv[2] ?? 45);
const snapshots = simulateEconomy({ minutesPerLeague });
const format = (value: number) => value >= 1e9 ? `${(value / 1e9).toFixed(1)} Mrd` : value >= 1e6 ? `${(value / 1e6).toFixed(1)} Mio` : value >= 1e3 ? `${(value / 1e3).toFixed(1)}k` : value.toFixed(0);

console.log(`Gieriger Club, nur passives Einkommen, ${minutesPerLeague} Minuten pro Liga\n`);
console.log("Liga  Einkommen/s beim Start  Schnitt/s   Faktor");
snapshots.forEach((snapshot, index) => {
  const previous = snapshots[index - 1];
  const factor = previous ? (snapshot.averageIncomePerSecond / previous.averageIncomePerSecond).toFixed(2) : "";
  console.log(`${String(snapshot.league).padStart(4)}  ${format(snapshot.incomePerSecond).padStart(22)}  ${format(snapshot.averageIncomePerSecond).padStart(9)}   ${factor}`);
});
console.log("\nUpgrade               Liga  Amortisation erste Stufe");
for (const upgrade of UPGRADES.filter((item) => item.kind === "auto")) {
  console.log(`${upgrade.name.padEnd(22)}${String(getUpgradeUnlockLeague(upgrade.id)).padStart(4)}  ${(getFirstLevelPayback(upgrade.id) / 60).toFixed(1)} min`);
}
console.log("\nPack                  Liga  Preis        ohne VAR   mit VAR (Median)");
for (const pack of STAR_PACKS) {
  const league = getPackUnlockLeague(pack.id);
  const income = snapshots.find((snapshot) => snapshot.league === league)!.incomePerSecond;
  const plain = income > 0 ? (pack.price / income / 60).toFixed(1) : "-";
  const withVar = income > 0 ? medianSavingMinutes(income, pack.price).toFixed(1) : "-";
  console.log(`${pack.label.padEnd(22)}${String(league).padStart(4)}  ${format(pack.price).padEnd(11)}  ${plain.padStart(8)}   ${withVar.padStart(8)}`);
}
