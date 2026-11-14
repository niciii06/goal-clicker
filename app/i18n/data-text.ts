// Game data texts at the place they are shown (docs/i18n-plan.md, Etappe 5). The data itself stays German: it is
// shared with the co-op server, compared in code and partly written into saves (history, packs), so English must
// never reach it. dataText() takes such a German text and returns it in the current language: first an exact
// catalogue entry, then the few built texts with numbers (pack odds, league labels, roadmap rewards). Anything it does
// not know stays as it is, so names of players, clubs and places pass through untouched.
import { currentLocale, localizeText, t } from "./runtime";
import type { MessageKey } from "./translate";

const ODDS_TIERS: Record<string, MessageKey> = {
  "Gewöhnlich": "data.tierCommon", "Profi": "data.tierPro", "Selten": "data.tierRare", "Walkout": "data.tierWalkout", "Top Walkout": "data.tierTopWalkout", "Legendär": "data.tierLegendary",
};

type Rule = [RegExp, (match: RegExpExecArray) => string];
const RULES: Rule[] = [
  // Pack odds rows: "Gewöhnlich 55–59", "Gewöhnlich bis 70", "Legendär 100"
  [/^(Gewöhnlich|Profi|Selten|Top Walkout|Walkout|Legendär) (bis )?([\d–]+)$/, (m) => `${t(ODDS_TIERS[m[1]])} ${m[2] ? t("data.upTo", { value: m[3] }) : m[3]}`],
  // League labels: "Liga 15 · Chaosliga"
  [/^Liga (\d+) · (.+)$/, (m) => t("data.leagueLabel", { league: m[1], name: localizeText(m[2]) })],
  [/^Liga (\d+)$/, (m) => t("data.league", { league: m[1] })],
  // Weekly rewards: "1’000 Fragmente"
  [/^([\d’'.,]+) Fragmente$/, (m) => t("data.fragmentsAmount", { amount: m[1].replace(/[’'.]/g, ",") })],
  // Roadmap rewards (app/season-roadmap.ts)
  [/^(\d+) Basis Upgrades$/, (m) => t("data.baseUpgrades", { count: Number(m[1]) })],
  [/^(\d+) neue Formationen$/, (m) => t("data.newFormations", { count: Number(m[1]) })],
  [/^(\d+) Formationen$/, (m) => t("data.formations", { count: Number(m[1]) })],
  [/^Formation (.+)$/, (m) => t("data.formation", { name: dataText(m[1]) })],
  // Formation labels: "4-3-3 (4) Offensiv", "4-2-3-1 (Eng)"
  [/^\d(?:-\d)+.*(?:Breit|Eng|Defensiv|Offensiv)/, (m) => m[0].replace("Breit", t("data.wide")).replace("Eng", t("data.narrow")).replace("Defensiv", t("data.defensive")).replace("Offensiv", t("data.attacking"))],
];

export function dataText(text: string | null | undefined): string {
  if (!text) return text ?? "";
  if (currentLocale() === "de") return text;
  const known = localizeText(text);
  if (known !== text) return known;
  for (const [pattern, build] of RULES) {
    const match = pattern.exec(text);
    if (match) return build(match);
  }
  return text;
}
