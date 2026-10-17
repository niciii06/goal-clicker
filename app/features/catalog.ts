// Static game catalogues: formations, tournaments, transfer players, special and icon cards (re-exported by app/feature-data.ts).
import type { CoopMission, StarFormationDefinition, StarFormationId, StarXIPlayer, TournamentDefinition, TransferPlayer, YBPlayerSeed } from "./types";
import type { StarPosition } from "../fc26-player-pool";
import { FC27_INDIA_PROFILES } from "../scrap-pack";
import { getFC27Positions } from "../fc27-positions";
import { getFC27Rating } from "../fc27-ratings";
import { getFunnyPlayerName } from "../funny-player-names";

export const STAR_POSITIONS: readonly StarPosition[] = ["TW", "LV", "LAV", "IV", "RV", "RAV", "ZDM", "ZM", "ZOM", "LM", "RM", "LF", "RF", "MS", "ST"];

export const STAR_POSITION_NAMES: Record<StarPosition, string> = {
  TW: "Torwart",
  LV: "Linker Verteidiger",
  LAV: "Linker Aussenverteidiger",
  IV: "Innenverteidiger",
  RV: "Rechter Verteidiger",
  RAV: "Rechter Aussenverteidiger",
  ZDM: "Zentrales defensives Mittelfeld",
  ZM: "Zentrales Mittelfeld",
  ZOM: "Zentrales offensives Mittelfeld",
  LM: "Linkes Mittelfeld",
  RM: "Rechtes Mittelfeld",
  LF: "Linker Flügel",
  RF: "Rechter Flügel",
  MS: "Mittelstürmer",
  ST: "Stürmer",
};

export function defineStarFormation(id: StarFormationId, label: string, rows: readonly (readonly StarPosition[])[]): StarFormationDefinition {
  const laidOutRows = rows.map((positions, rowIndex) => {
    const y = rows.length === 1 ? 50 : 11 + rowIndex * (80 / (rows.length - 1));
    return positions.map((position, positionIndex) => ({
      position,
      x: ((positionIndex + 1) / (positions.length + 1)) * 100,
      y,
    }));
  });
  return { id, label, slots: [...laidOutRows].reverse().flat() };
}

export const BACK_THREE = ["IV", "IV", "IV"] as const;

export const BACK_FOUR = ["LV", "IV", "IV", "RV"] as const;

export const BACK_FIVE = ["LAV", "IV", "IV", "IV", "RAV"] as const;

export const GOALKEEPER = ["TW"] as const;

export const STAR_FORMATIONS: readonly StarFormationDefinition[] = [
  defineStarFormation("3142", "3-1-4-2", [["ST", "ST"], ["LM", "ZM", "ZM", "RM"], ["ZDM"], BACK_THREE, GOALKEEPER]),
  defineStarFormation("3412", "3-4-1-2", [["ST", "ST"], ["ZOM"], ["LM", "ZM", "ZM", "RM"], BACK_THREE, GOALKEEPER]),
  defineStarFormation("3421", "3-4-2-1", [["ST"], ["LF", "RF"], ["LM", "ZM", "ZM", "RM"], BACK_THREE, GOALKEEPER]),
  defineStarFormation("352", "3-5-2", [["ST", "ST"], ["LM", "ZOM", "RM"], ["ZDM", "ZDM"], BACK_THREE, GOALKEEPER]),
  defineStarFormation("343", "3-4-3", [["LF", "ST", "RF"], ["LM", "ZM", "ZM", "RM"], BACK_THREE, GOALKEEPER]),
  defineStarFormation("41212", "4-1-2-1-2 (Breit)", [["ST", "ST"], ["ZOM"], ["LM", "RM"], ["ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("41212-2", "4-1-2-1-2 (Eng)", [["ST", "ST"], ["ZOM"], ["ZM", "ZM"], ["ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4132", "4-1-3-2", [["ST", "ST"], ["LM", "ZM", "RM"], ["ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4141", "4-1-4-1", [["ST"], ["LM", "ZM", "ZM", "RM"], ["ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4213", "4-2-1-3", [["LF", "ST", "RF"], ["ZOM"], ["ZDM", "ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4222", "4-2-2-2", [["ST", "ST"], ["ZOM", "ZOM"], ["ZDM", "ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4231", "4-2-3-1 (Eng)", [["ST"], ["ZOM", "ZOM", "ZOM"], ["ZDM", "ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4231-2", "4-2-3-1 (Breit)", [["ST"], ["LM", "ZOM", "RM"], ["ZDM", "ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("424", "4-2-4", [["LF", "ST", "ST", "RF"], ["ZM", "ZM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4312", "4-3-1-2", [["ST", "ST"], ["ZOM"], ["ZM", "ZM", "ZM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4321", "4-3-2-1", [["ST"], ["LF", "RF"], ["ZM", "ZM", "ZM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("433", "4-3-3", [["LF", "ST", "RF"], ["ZM", "ZM", "ZM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("433-2", "4-3-3 (2) Holding", [["LF", "ST", "RF"], ["ZM", "ZM"], ["ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("433-3", "4-3-3 (3) Defensiv", [["LF", "ST", "RF"], ["ZM"], ["ZDM", "ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("433-4", "4-3-3 (4) Offensiv", [["LF", "ST", "RF"], ["ZOM"], ["ZM", "ZM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4411-2", "4-4-1-1 (2)", [["ST"], ["ZOM"], ["LM", "ZM", "ZM", "RM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("442", "4-4-2", [["ST", "ST"], ["LM", "ZM", "ZM", "RM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("442-2", "4-4-2 (2) Holding", [["ST", "ST"], ["LM", "ZDM", "ZDM", "RM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("451", "4-5-1", [["ST"], ["LM", "ZM", "ZM", "ZM", "RM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("451-2", "4-5-1 (2) Offensiv", [["ST"], ["ZOM"], ["LM", "ZM", "ZM", "RM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("5212", "5-2-1-2", [["ST", "ST"], ["ZOM"], ["ZM", "ZM"], BACK_FIVE, GOALKEEPER]),
  defineStarFormation("523", "5-2-3", [["LF", "ST", "RF"], ["ZM", "ZM"], BACK_FIVE, GOALKEEPER]),
  defineStarFormation("532", "5-3-2", [["ST", "ST"], ["ZM", "ZM", "ZM"], BACK_FIVE, GOALKEEPER]),
  defineStarFormation("541", "5-4-1", [["ST"], ["LM", "ZM", "ZM", "RM"], BACK_FIVE, GOALKEEPER]),
] as const;

export function getStarFormation(id: unknown) {
  return STAR_FORMATIONS.find((formation) => formation.id === id) ?? STAR_FORMATIONS.find((formation) => formation.id === "433")!;
}

export const STAR_XI_FORMATION_POSITIONS: readonly StarPosition[] = getStarFormation("433").slots.map((slot) => slot.position);
export const TOURNAMENT_OPPONENT_MULTIPLIER = 4;
export const TOURNAMENT_SEEDS: readonly TournamentDefinition[] = [
  {
    id: "stadium",
    label: "Stadionpokal",
    trophyName: "Stadionpokal",
    trophyIcon: "🏆",
    description: "Drei Spiele am Stück · 12 mögliche Gegner für deine erste Star XI.",
    minimumRating: 55,
    rounds: 3,
    opponents: [
      { id: "stadium-servette-genevois", name: "Servette Genevois", rating: 56, strategyId: "ballbesitz", scorers: ["Dereck Kutesa", "Enzo Crivelli", "Miroslav Stevanovic"] },
      { id: "stadium-fc-sionais", name: "FC Sionais", rating: 57, strategyId: "konter", scorers: ["Benjamin Kololli", "Dejan Sorgic", "Joël Schmied"] },
      { id: "stadium-fc-thoune", name: "FC Thoune", rating: 57, strategyId: "angriff", scorers: ["Marc Gut", "Miguel Castroman", "Kreshnik Hajrizi"] },
      { id: "stadium-fc-winterthure", name: "FC Winterthure", rating: 58, strategyId: "ballbesitz", scorers: ["Matteo Di Giusto", "Aldin Turkes", "Nishan Burkart"] },
      { id: "stadium-fc-luzerne", name: "FC Luzerne", rating: 59, strategyId: "konter", scorers: ["Lars Villiger", "Luca Jaquez", "Pius Dorn"] },
      { id: "stadium-fc-st-gallo", name: "FC St. Gallo", rating: 60, strategyId: "angriff", scorers: ["Chadrac Akolo", "Willem Geubbels", "Jordi Quintilla"] },
      { id: "stadium-fc-lausanne", name: "FC Lausanne", rating: 60, strategyId: "ballbesitz", scorers: ["Alvyn Sanches", "Kaly Sene", "Brighton Labeau"] },
      { id: "stadium-grasshopper-zurich", name: "Grasshopper Zürich", rating: 61, strategyId: "konter", scorers: ["Giotto Morandi", "Pascal Schürpf", "Awer Mabil"] },
      { id: "stadium-fc-lugano", name: "FC Lugano", rating: 62, strategyId: "angriff", scorers: ["Mattia Bottani", "Shkelqim Vladi", "Ignacio Aliseda"] },
      { id: "stadium-bsc-young-burs", name: "BSC Young Burs", rating: 63, strategyId: "angriff", scorers: ["Cédric Ittan", "Joël Monteiroh", "Filip Ugrinic"] },
      { id: "stadium-fc-zurique", name: "FC Zurique", rating: 64, strategyId: "ballbesitz", scorers: ["Jonathan Okita", "Bledian Krasniqi", "Antonio Marchesano"] },
      { id: "stadium-fc-basilea", name: "FC Basilea", rating: 68, strategyId: "konter", scorers: ["Xherdan Shaqiry", "Albian Ajati", "Kevin Carloso"] },
    ],
    accent: "#16845b",
  },
  {
    id: "champions",
    label: "Champions Cup",
    trophyName: "Champions Pokal",
    trophyIcon: "🏆",
    description: "Vier Runden · 16 mögliche Gegner auf internationalem Topniveau.",
    minimumRating: 74,
    rounds: 4,
    opponents: [
      { id: "champions-benfica-lissabonne", name: "Benfica Lissabonne", rating: 74, strategyId: "ballbesitz", scorers: ["Angel Di Maria", "Vangelis Pavlidis", "Rafa Silvaz"] },
      { id: "champions-ajax-amsterdamo", name: "Ajax Amsterdamo", rating: 74, strategyId: "angriff", scorers: ["Brian Brobbey", "Steven Berghuiss", "Kenneth Taylor"] },
      { id: "champions-porto-alegre", name: "Porto Alegre", rating: 75, strategyId: "konter", scorers: ["Pepê Costao", "Samu Omorodion", "Galeno"] },
      { id: "champions-psv-eindhoven", name: "PSV Eindhoven", rating: 75, strategyId: "ballbesitz", scorers: ["Luuk de Jong", "Noa Lang", "Johan Bakayoko"] },
      { id: "champions-borussia-dortmundt", name: "Borussia Dortmundt", rating: 76, strategyId: "ballbesitz", scorers: ["Serhou Girassy", "Karim Adejemi", "Julian Brandto"] },
      { id: "champions-rb-leipziga", name: "RB Leipziga", rating: 77, strategyId: "angriff", scorers: ["Benjamin Sesko", "Lois Openda", "Xavi Simons"] },
      { id: "champions-napoli-italiano", name: "Napoli Italiano", rating: 77, strategyId: "konter", scorers: ["Romelu Lukaku", "Khvicha Kvaradona", "Scott McTominay"] },
      { id: "champions-juventus-turino", name: "Juventus Turino", rating: 78, strategyId: "ballbesitz", scorers: ["Dusan Vlahovic", "Kenan Yildiz", "Teun Koopmeiners"] },
      { id: "champions-monaco-asm", name: "AS Monaco", rating: 78, strategyId: "konter", scorers: ["Folarin Balogun", "Takumi Minamino", "Breel Embolo"] },
      { id: "champions-chelsea-londra", name: "Chelsea Londra", rating: 79, strategyId: "angriff", scorers: ["Cole Palmer", "Nicolas Jackson", "Christopher Nkunku"] },
      { id: "champions-inter-milano", name: "Inter Milano", rating: 79, strategyId: "ballbesitz", scorers: ["Lautaro Martinezo", "Marcus Thuram", "Nicolo Barella"] },
      { id: "champions-tottenham-hotspur", name: "Tottenham Hotspur", rating: 80, strategyId: "konter", scorers: ["Heung-min Son", "James Maddison", "Dominic Solanke"] },
      { id: "champions-ac-milana", name: "AC Milana", rating: 80, strategyId: "angriff", scorers: ["Rafael Leao", "Kristjan Pulisik", "Santiago Gimenez"] },
      { id: "champions-barceloneta", name: "FC Barceloneta", rating: 82, strategyId: "ballbesitz", scorers: ["Robert Lewandowski", "Lamine Yamalo", "Raphinha"] },
      { id: "champions-atletico-madrido", name: "Atlético Madrido", rating: 84, strategyId: "konter", scorers: ["Antwan Griezman", "Julián Alvares", "Alexander Sorloth"] },
      { id: "champions-arsenal-londra", name: "Arsenal Londra", rating: 88, strategyId: "ballbesitz", scorers: ["Bukayo Sako", "Martin Odegard", "Kai Hawertz"] },
    ],
    accent: "#0071e3",
  },
  {
    id: "world",
    label: "Weltmeisterschaft",
    trophyName: "Weltpokal",
    trophyIcon: "🌍",
    description: "Sechs Runden · 24 mögliche Gegner aus der Weltspitze.",
    minimumRating: 86,
    rounds: 6,
    opponents: [
      { id: "world-napoli-italiano", name: "Napoli Italiano", rating: 86, strategyId: "konter", scorers: ["Romelu Lukaku", "Khvicha Kvaradona", "Scott McTominay"] },
      { id: "world-benfica-lissabonne", name: "Benfica Lissabonne", rating: 86, strategyId: "ballbesitz", scorers: ["Angel Di Maria", "Vangelis Pavlidis", "Rafa Silvaz"] },
      { id: "world-porto-alegre", name: "Porto Alegre", rating: 86, strategyId: "angriff", scorers: ["Pepê Costao", "Samu Omorodion", "Galeno"] },
      { id: "world-psv-eindhoven", name: "PSV Eindhoven", rating: 86, strategyId: "ballbesitz", scorers: ["Luuk de Jong", "Noa Lang", "Johan Bakayoko"] },
      { id: "world-ajax-amsterdam", name: "Ajax Amsterdam", rating: 86, strategyId: "konter", scorers: ["Brian Brobbey", "Steven Berghuiss", "Kenneth Taylor"] },
      { id: "world-galatasaray", name: "Galatasaray", rating: 86, strategyId: "angriff", scorers: ["Victor Osimhen", "Mauro Icardi", "Dries Mertens"] },
      { id: "world-borussia-dortmundt", name: "Borussia Dortmundt", rating: 87, strategyId: "ballbesitz", scorers: ["Serhou Girassy", "Karim Adejemi", "Julian Brandto"] },
      { id: "world-tottenham-hotspur", name: "Tottenham Hotspur", rating: 87, strategyId: "konter", scorers: ["Heung-min Son", "James Maddison", "Dominic Solanke"] },
      { id: "world-juventus-turino", name: "Juventus Turino", rating: 87, strategyId: "ballbesitz", scorers: ["Dusan Vlahovic", "Kenan Yildiz", "Teun Koopmeiners"] },
      { id: "world-inter-miami", name: "Inter Miami", rating: 87, strategyId: "angriff", scorers: ["Lionel Messy", "Luis Suarezo", "Jordi Alba"] },
      { id: "world-paris-saint-german", name: "Paris Saint German", rating: 88, strategyId: "angriff", scorers: ["Ousmane Dembelé", "Khvicha Kvaradona", "Bradley Barcolá"] },
      { id: "world-chelsea-londra", name: "Chelsea Londra", rating: 88, strategyId: "ballbesitz", scorers: ["Cole Palmer", "Nicolas Jackson", "Christopher Nkunku"] },
      { id: "world-ac-milana", name: "AC Milana", rating: 88, strategyId: "konter", scorers: ["Rafael Leao", "Kristjan Pulisik", "Santiago Gimenez"] },
      { id: "world-bayer-leverkusen", name: "Bayer Leverkusen", rating: 88, strategyId: "ballbesitz", scorers: ["Florian Wirtz", "Victor Boniface", "Patrik Schick"] },
      { id: "world-atletico-madrido", name: "Atlético Madrido", rating: 89, strategyId: "konter", scorers: ["Antwan Griezman", "Julián Alvares", "Alexander Sorloth"] },
      { id: "world-manchester-united", name: "Manchester United", rating: 89, strategyId: "angriff", scorers: ["Bruno Fernandes", "Rasmus Hojlundo", "Alejandro Garnacho"] },
      { id: "world-inter-milano", name: "Inter Milano", rating: 90, strategyId: "ballbesitz", scorers: ["Lautaro Martinezo", "Marcus Thuram", "Nicolo Barella"] },
      { id: "world-arsenal-londra", name: "Arsenal Londra", rating: 90, strategyId: "ballbesitz", scorers: ["Bukayo Sako", "Martin Odegard", "Kai Hawertz"] },
      { id: "world-liverpuhl-fc", name: "Liverpuhl FC", rating: 91, strategyId: "ballbesitz", scorers: ["Mohamed Salahm", "Luis Diazo", "Darwin Nunez"] },
      { id: "world-fc-barceloneta", name: "FC Barceloneta", rating: 92, strategyId: "angriff", scorers: ["Robert Lewandowski", "Lamine Yamalo", "Raphinha"] },
      { id: "world-bayern-muenchan", name: "Bayern Münchan", rating: 94, strategyId: "konter", scorers: ["Harry Kané", "Jamal Musiala", "Michael Olisé"] },
      { id: "world-manchester-cite", name: "Manchester Cité", rating: 96, strategyId: "ballbesitz", scorers: ["Erling Haland", "Phil Fodenh", "Kevin de Bruyne"] },
      { id: "world-real-madreto", name: "Real Madreto", rating: 98, strategyId: "angriff", scorers: ["Kylian Mbappo", "Vinícius Juniora", "Jude Bellingam"] },
      { id: "world-galacticos-xi", name: "Galácticos XI", rating: 99, strategyId: "konter", scorers: ["Cristiano Rinaldo", "Lionel Messy", "Ronaldo Nazárioh"] },
    ],
    accent: "#c69214",
  },
];

export const TOURNAMENTS: readonly TournamentDefinition[] = TOURNAMENT_SEEDS.map((tournament) => ({
  ...tournament,
  opponents: tournament.opponents.map((opponent) => ({
    ...opponent,
    scorers: opponent.scorers.map((scorer) => getFunnyPlayerName(scorer, `tournament-scorer:${scorer}`, { position: "ST", rating: opponent.rating })),
  })),
}));
export const TRANSFER_PLAYERS: TransferPlayer[] = [
  { id: "turbo", name: "Luca Turbo", position: "Flügel", rating: 78, price: 1800, clickBonus: 3, passiveBonus: 0, incomeBonus: 0, accent: "#0071e3" },
  { id: "wall", name: "Nora Wand", position: "Torhüterin", rating: 82, price: 3200, clickBonus: 0, passiveBonus: 30, incomeBonus: 0, accent: "#16845b" },
  { id: "maestro", name: "Milo Maestro", position: "Mittelfeld", rating: 86, price: 7500, clickBonus: 0, passiveBonus: 120, incomeBonus: 0.03, accent: "#8b5cf6" },
  { id: "finisher", name: "Sofia Finisher", position: "Sturm", rating: 89, price: 15000, clickBonus: 15, passiveBonus: 0, incomeBonus: 0, accent: "#d12c54" },
  { id: "engine", name: "Dario Dauerläufer", position: "Box to Box", rating: 91, price: 42000, clickBonus: 20, passiveBonus: 350, incomeBonus: 0, accent: "#e85d04" },
  { id: "captain", name: "Amira Captain", position: "Leaderin", rating: 94, price: 110000, clickBonus: 60, passiveBonus: 600, incomeBonus: 0.05, accent: "#c69214" },
  { id: "wonderkid", name: "Noah Wonderkid", position: "Talent", rating: 96, price: 280000, clickBonus: 120, passiveBonus: 1200, incomeBonus: 0.08, accent: "#0071e3" },
  { id: "legend", name: "Die Legende", position: "Ikone", rating: 99, price: 900000, clickBonus: 300, passiveBonus: 4000, incomeBonus: 0.12, accent: "#1d1d1f" },
];

export function specialAttributes(rating: number) {
  const template = structuredClone(FC27_INDIA_PROFILES[0].attributes);
  template.overallRating = rating;
  for (const stat of Object.values(template.stats)) stat.value = rating;
  return template;
}
// The YB cards are kept in the shared pool as well. Two of
// them already exist in the imported base dataset; the source-id list below
// covers the complete YB set so it cannot silently lose a player when the
// dataset changes.
export const YB_FC26_SOURCE_IDS = [
  "215556", "260272", "258924", "220665", "251617", "256726", "234913", "225853",
  "229900", "193468", "251532", "252526", "225533", "258230", "270371", "75499", "257319",
] as const;

export const YB_FC26_PLAYER_SEEDS: readonly YBPlayerSeed[] = [
  ["215556", "Edimilson Fernandis", 74, ["ZDM", "IV", "ZM"], "CH"],
  ["258924", "Joël Monteiroh", 73, ["LM", "RM", "ZM", "LF"], "CH"],
  ["220665", "Gregory Wüthricha", 73, ["IV"], "CH"],
  ["251617", "Armin Gigovik", 72, ["ZM", "ZDM"], "BA"],
  ["234913", "Christian Fassnachtt", 72, ["RM", "LM", "ST", "RF"], "CH"],
  ["225853", "Rayan Ravelosonn", 71, ["ZM", "ZDM"]],
  ["229900", "Sandro Lauperr", 70, ["IV", "ZDM", "ZM"], "CH"],
  ["193468", "Loris Benitto", 70, ["IV"], "CH"],
  ["251532", "Meschack Eliá", 70, ["ST"]],
  ["252526", "Darian Malesz", 70, ["RM", "LM", "ZOM", "ST"], "CH"],
  ["225533", "Chris Bediaa", 70, ["ST"], "CI"],
  ["258230", "Jaouen Hadjamm", 69, ["LV"], "FR"],
  ["270371", "Ryan Andrewz", 68, ["RV", "RM"], "EN"],
  ["75499", "Dominik Pechh", 68, ["ZM"], "CZ"],
  ["257319", "Alan Virginiuz", 68, ["RM", "LM", "RF"], "FR"],
];

export const YB_FC26_PLAYERS: StarXIPlayer[] = YB_FC26_PLAYER_SEEDS.map(([sourceId, name, previousRating, positions, countryCode]) => {
  const rating = getFC27Rating(sourceId, previousRating);
  const updatedPositions = getFC27Positions(sourceId, positions);
  return {
    id: `yb-${sourceId}`,
    sourceId,
    countryCode,
    name: getFunnyPlayerName(name, `yb-${sourceId}`, { position: updatedPositions[0], rating }),
    position: updatedPositions[0],
    positions: [...updatedPositions],
    rating,
    price: Math.round(Math.min(1500000000, 5000 * 1.28 ** (rating - 70))),
    accent: "#f4c400",
  };
});

export const GOAL_POSITION_WEIGHTS: Record<StarPosition, number> = {
  TW: 0.06,
  LV: 0.45,
  LAV: 0.55,
  IV: 0.34,
  RV: 0.45,
  RAV: 0.55,
  ZDM: 0.65,
  ZM: 1.25,
  ZOM: 2,
  LM: 1.9,
  RM: 1.9,
  LF: 3.2,
  RF: 3.2,
  MS: 4,
  ST: 4.8,
};

export const ASSIST_POSITION_WEIGHTS: Record<StarPosition, number> = {
  TW: 0.02,
  LV: 0.65,
  LAV: 0.9,
  IV: 0.22,
  RV: 0.65,
  RAV: 0.9,
  ZDM: 0.85,
  ZM: 1.8,
  ZOM: 2.8,
  LM: 2.35,
  RM: 2.35,
  LF: 1.85,
  RF: 1.85,
  MS: 1.55,
  ST: 1.2,
};

export const DEFENSIVE_FAULT_WEIGHTS: Record<StarPosition, number> = {
  TW: 1.8,
  LV: 1.45,
  LAV: 1.35,
  IV: 2.55,
  RV: 1.45,
  RAV: 1.35,
  ZDM: 1.05,
  ZM: 0.55,
  ZOM: 0.24,
  LM: 0.38,
  RM: 0.38,
  LF: 0.12,
  RF: 0.12,
  MS: 0.1,
  ST: 0.08,
};

export const MISSION_TEMPLATES: Omit<CoopMission, "claimed">[] = [
  { id: "team-goals", title: "Druckphase", description: "Sammelt gemeinsam Tore in dieser Saison", kind: "goals", target: 2500, reward: 2500 },
  { id: "team-clicks", title: "Doppelpass", description: "Klickt gemeinsam 250 Mal", kind: "clicks", target: 250, reward: 1800 },
  { id: "team-tournament", title: "Turnierstarter", description: "Gewinnt zwei Turnierrunden", kind: "cupWins", target: 2, reward: 3000 },
  { id: "team-cup", title: "Pokalhungrig", description: "Gewinnt eine Pokalrunde", kind: "cupWins", target: 1, reward: 4500 },
];
