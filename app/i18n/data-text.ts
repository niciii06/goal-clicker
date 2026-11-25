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
  // Match rating reasons saved in match reports (app/career-data.ts): "1 Tor", "3 Vorlagen"
  [/^(\d+) (Tor|Tore|Vorlage|Vorlagen)$/, (m) => t(m[2].startsWith("Tor") ? "data.reason.goals" : "data.reason.assists", { count: Number(m[1]) })],
  // League labels: "Liga 15 · Chaosliga"
  [/^Liga (\d+) · (.+)$/, (m) => t("data.leagueLabel", { league: m[1], name: localizeText(m[2]) })],
  [/^Liga (\d+)$/, (m) => t("data.league", { league: m[1] })],
  // Competition saved in match reports: "Saison 3"
  [/^Saison (\d+)$/, (m) => t("career.seasonNumber", { seasonNumber: m[1] })],
  // Upgrade effects: "+3 Tore pro Klick", "+1.200 Tore pro Sekunde"
  [/^\+([\d.]+) Tore pro (Klick|Sekunde)$/, (m) => t(m[2] === "Klick" ? "data.upgrade.perClick" : "data.upgrade.perSecond", { amount: m[1].replace(/\./g, ",") })],
  // Home grounds of the home cities: "Heimstadion Apfelbaum"
  [/^Heimstadion (.+)$/, (m) => t("data.homeGround", { name: m[1] })],
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

// Live match event names (app/match-visual-frame.ts eventLabel). Own table instead of the catalogue lookup: short words
// such as "Wechsel" or "Tor" exist elsewhere in the catalogue with another meaning.
const EVENT_KEYS: Record<string, MessageKey> = {
  "Tor": "viewer.event.goal", "Rote Karte": "viewer.event.card", "Verletzung": "viewer.event.injury", "Penalty": "viewer.event.penalty",
  "Spielaufbau": "viewer.event.buildUp", "Konter": "viewer.event.counter", "Flügelangriff": "viewer.event.wide", "Doppelpass": "viewer.event.combination",
  "Torschuss": "viewer.event.shot", "Ecke": "viewer.event.corner", "Freistoss": "viewer.event.freeKick", "Einwurf": "viewer.event.throwIn",
  "Gelbe Karte": "viewer.event.yellow", "Wechsel": "viewer.event.substitution", "Abseits · indirekter Freistoss": "viewer.event.offside", "Spielereignis": "viewer.event.other",
};
export function eventText(label: string) {
  const key = EVENT_KEYS[label];
  return key ? t(key) : label;
}
