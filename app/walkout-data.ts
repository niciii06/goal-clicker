import type { StarXIPlayer } from "./feature-data";

export type WalkoutHair = "afro" | "bald" | "braids" | "buzz" | "crop" | "curls" | "fade" | "locs" | "medium" | "mohawk" | "pony" | "slick" | "waves";
export type WalkoutBeard = "clean" | "full" | "goatee" | "short" | "stubble";
export type WalkoutFace = "angular" | "long" | "oval" | "round" | "square";
export type WalkoutCelebration = "arms" | "calm" | "fist" | "jump" | "point" | "siu";
export type StarCardTier = "standard" | "rare" | "walkout" | "icon" | "legendary";

export type WalkoutPresentation = {
  countryCode: string;
  country: string;
  flag: string;
  skin: string;
  hair: WalkoutHair;
  hairColor: string;
  beard: WalkoutBeard;
  face: WalkoutFace;
  height: number;
  build: number;
  celebration: WalkoutCelebration;
  kitPrimary: string;
  kitSecondary: string;
  boots: string;
};

type RawProfile = readonly [
  sourceId: string,
  countryCode: string,
  skin: string,
  hair: WalkoutHair,
  hairColor: string,
  beard: WalkoutBeard,
  face: WalkoutFace,
  height: number,
  build: number,
  celebration: WalkoutCelebration,
];

const COUNTRY: Record<string, { name: string; flag: string; kit: [string, string] }> = {
  AR: { name: "Argentinien", flag: "🇦🇷", kit: ["#75aadb", "#ffffff"] },
  BA: { name: "Bosnien und Herzegowina", flag: "🇧🇦", kit: ["#0033a0", "#ffcc00"] },
  BE: { name: "Belgien", flag: "🇧🇪", kit: ["#e31b23", "#111111"] },
  BR: { name: "Brasilien", flag: "🇧🇷", kit: ["#ffdf00", "#009c3b"] },
  BG: { name: "Bulgarien", flag: "🇧🇬", kit: ["#ffffff", "#00966e"] },
  CH: { name: "Schweiz", flag: "🇨🇭", kit: ["#d71920", "#ffffff"] },
  CM: { name: "Kamerun", flag: "🇨🇲", kit: ["#007a5e", "#ce1126"] },
  CO: { name: "Kolumbien", flag: "🇨🇴", kit: ["#fcd116", "#003893"] },
  CZ: { name: "Tschechien", flag: "🇨🇿", kit: ["#d7141a", "#ffffff"] },
  CI: { name: "Elfenbeinküste", flag: "🇨🇮", kit: ["#f77f00", "#ffffff"] },
  DK: { name: "Dänemark", flag: "🇩🇰", kit: ["#c60c30", "#ffffff"] },
  DE: { name: "Deutschland", flag: "🇩🇪", kit: ["#f5f5f5", "#111111"] },
  EC: { name: "Ecuador", flag: "🇪🇨", kit: ["#ffdd00", "#034ea2"] },
  EG: { name: "Ägypten", flag: "🇪🇬", kit: ["#ce1126", "#ffffff"] },
  EN: { name: "England", flag: "🏴", kit: ["#f4f4f4", "#14213d"] },
  ES: { name: "Spanien", flag: "🇪🇸", kit: ["#c60b1e", "#ffc400"] },
  FR: { name: "Frankreich", flag: "🇫🇷", kit: ["#143c8c", "#ffffff"] },
  GE: { name: "Georgien", flag: "🇬🇪", kit: ["#ffffff", "#e21b23"] },
  GN: { name: "Guinea", flag: "🇬🇳", kit: ["#ce1126", "#fcd116"] },
  HU: { name: "Ungarn", flag: "🇭🇺", kit: ["#cd2a3e", "#ffffff"] },
  HR: { name: "Kroatien", flag: "🇭🇷", kit: ["#ffffff", "#e31b23"] },
  IE: { name: "Irland", flag: "🇮🇪", kit: ["#169b62", "#ffffff"] },
  IT: { name: "Italien", flag: "🇮🇹", kit: ["#0066bc", "#ffffff"] },
  JP: { name: "Japan", flag: "🇯🇵", kit: ["#183a8f", "#ffffff"] },
  MA: { name: "Marokko", flag: "🇲🇦", kit: ["#c1272d", "#006233"] },
  MX: { name: "Mexiko", flag: "🇲🇽", kit: ["#006847", "#ffffff"] },
  NG: { name: "Nigeria", flag: "🇳🇬", kit: ["#008751", "#ffffff"] },
  NL: { name: "Niederlande", flag: "🇳🇱", kit: ["#f36c21", "#111111"] },
  NI: { name: "Nordirland", flag: "🇬🇧", kit: ["#1d6b44", "#ffffff"] },
  NO: { name: "Norwegen", flag: "🇳🇴", kit: ["#ba0c2f", "#00205b"] },
  PL: { name: "Polen", flag: "🇵🇱", kit: ["#ffffff", "#dc143c"] },
  PT: { name: "Portugal", flag: "🇵🇹", kit: ["#b5102d", "#046a38"] },
  RO: { name: "Rumänien", flag: "🇷🇴", kit: ["#fcd116", "#002b7f"] },
  RS: { name: "Serbien", flag: "🇷🇸", kit: ["#c6363c", "#ffffff"] },
  RU: { name: "Russland", flag: "🇷🇺", kit: ["#ffffff", "#d52b1e"] },
  SC: { name: "Schottland", flag: "🏴", kit: ["#172b4d", "#ffffff"] },
  SE: { name: "Schweden", flag: "🇸🇪", kit: ["#fecd00", "#006aa7"] },
  SI: { name: "Slowenien", flag: "🇸🇮", kit: ["#ffffff", "#005da4"] },
  KR: { name: "Südkorea", flag: "🇰🇷", kit: ["#e6002d", "#111111"] },
  TR: { name: "Türkei", flag: "🇹🇷", kit: ["#e30a17", "#ffffff"] },
  UA: { name: "Ukraine", flag: "🇺🇦", kit: ["#ffd700", "#0057b7"] },
  US: { name: "USA", flag: "🇺🇸", kit: ["#1f3c88", "#ffffff"] },
  UY: { name: "Uruguay", flag: "🇺🇾", kit: ["#5bc0eb", "#111111"] },
  WA: { name: "Wales", flag: "🏴", kit: ["#d30731", "#ffffff"] },
  GH: { name: "Ghana", flag: "🇬🇭", kit: ["#ffffff", "#ce1126"] },
};

const S1 = "#f3c6a5";
const S2 = "#d99a72";
const S3 = "#b8734f";
const S4 = "#8f5539";
const S5 = "#613824";
const BLACK = "#171310";
const BROWN = "#4a3024";
const LIGHT_BROWN = "#80604b";
const BLOND = "#d8bd73";

type PhysicalBuild = "lean" | "normal" | "stocky" | "unique";
type PhysicalProfile = readonly [heightCm: number, weightKg: number, bodyType: PhysicalBuild];

// Physical data for the base-card walkouts. These values are kept separate from
// the hand-authored block-character styling so height and build stay tied to
// the player record instead of being estimated from the portrait.
const FC26_PHYSICAL_BY_SOURCE_ID: Record<string, PhysicalProfile> = {
  "231747": [182, 75, "unique"],
  "209331": [175, 72, "unique"],
  "239085": [195, 94, "unique"],
  "252371": [186, 75, "normal"],
  "231443": [178, 67, "unique"],
  "231866": [190, 82, "normal"],
  "203376": [193, 92, "unique"],
  "235212": [181, 73, "lean"],
  "212831": [193, 91, "unique"],
  "239053": [182, 74, "unique"],
  "256630": [177, 71, "normal"],
  "230621": [196, 90, "unique"],
  "202126": [188, 86, "unique"],
  "212622": [177, 75, "normal"],
  "277643": [180, 72, "lean"],
  "251854": [174, 60, "lean"],
  "233419": [176, 68, "lean"],
  "192119": [200, 96, "unique"],
  "238794": [176, 73, "lean"],
  "255253": [172, 64, "lean"],
  "233731": [192, 77, "lean"],
  "246669": [178, 65, "lean"],
  "232580": [190, 87, "normal"],
  "256790": [184, 72, "lean"],
  "200389": [188, 87, "unique"],
  "231478": [174, 72, "unique"],
  "188545": [185, 81, "unique"],
  "237383": [190, 75, "unique"],
  "239837": [176, 72, "normal"],
  "212198": [179, 69, "unique"],
  "257534": [185, 76, "lean"],
  "234378": [185, 80, "normal"],
  "220901": [183, 75, "normal"],
  "228702": [181, 74, "unique"],
  "246191": [170, 71, "normal"],
  "241486": [180, 75, "normal"],
  "213331": [195, 94, "stocky"],
  "192985": [181, 75, "unique"],
  "247635": [183, 70, "normal"],
  "256079": [178, 73, "normal"],
  "215698": [191, 89, "normal"],
  "222665": [178, 68, "lean"],
  "207865": [183, 75, "normal"],
  "224232": [175, 68, "normal"],
  "215441": [187, 82, "normal"],
  "241651": [189, 94, "stocky"],
  "232293": [186, 77, "normal"],
  "243715": [193, 85, "normal"],
  "177683": [183, 77, "normal"],
  "205452": [190, 85, "lean"],
  "247851": [182, 74, "lean"],
  "235073": [195, 88, "normal"],
  "208128": [178, 69, "normal"],
  "237678": [194, 95, "normal"],
  "158023": [169, 67, "unique"],
  "247827": [184, 73, "lean"],
  "192448": [187, 85, "unique"],
  "256516": [181, 67, "lean"],
  "252145": [180, 70, "normal"],
  "211110": [177, 75, "unique"],
  "239818": [187, 82, "normal"],
  "241096": [181, 79, "unique"],
  "231281": [180, 69, "unique"],
  "240638": [185, 73, "lean"],
  "256196": [188, 81, "normal"],
  "194765": [176, 67, "unique"],
  "243014": [171, 75, "stocky"],
  "239580": [187, 84, "stocky"],
  "204963": [173, 73, "unique"],
  "20801": [187, 85, "unique"],
  "271421": [181, 79, "normal"],
  "229558": [186, 90, "stocky"],
  "244260": [179, 72, "lean"],
  "193080": [192, 76, "unique"],
  "202811": [195, 88, "stocky"],
  "210257": [188, 86, "unique"],
  "226268": [175, 76, "normal"],
  "226271": [189, 70, "lean"],
  "199503": [186, 80, "normal"],
  "200104": [183, 78, "unique"],
  "204525": [182, 76, "normal"],
  "272834": [174, 66, "normal"],
  "165153": [185, 81, "normal"],
  "241084": [180, 73, "unique"],
  "228093": [192, 80, "normal"],
  "215914": [168, 70, "unique"],
  "247819": [191, 86, "normal"],
  "237692": [171, 70, "unique"],
  "185122": [193, 86, "normal"],
  "234236": [191, 87, "normal"],
  "246104": [190, 77, "lean"],
  "243812": [174, 64, "lean"],
  "237238": [193, 88, "normal"],
  "230869": [190, 89, "normal"],
  "216393": [176, 72, "normal"],
  "251570": [176, 71, "normal"],
  "278046": [184, 78, "normal"],
  "259532": [193, 85, "normal"],
  "236772": [186, 74, "lean"],
  "239231": [175, 66, "lean"],
  "234577": [187, 81, "normal"],
  "252154": [191, 83, "normal"],
  "247090": [178, 76, "normal"],
};

function physicalScale(sourceId: string, fallbackHeight: number, fallbackBuild: number) {
  const physical = FC26_PHYSICAL_BY_SOURCE_ID[sourceId];
  if (!physical) return { height: fallbackHeight, build: fallbackBuild };
  const [heightCm, weightKg, bodyType] = physical;
  const bmi = weightKg / ((heightCm / 100) ** 2);
  const bodyAdjustment = bodyType === "lean" ? -.035 : bodyType === "stocky" ? .05 : 0;
  return {
    height: Math.max(.9, Math.min(1.12, heightCm / 182)),
    build: Math.max(.84, Math.min(1.12, .94 + ((bmi - 22) * .035) + bodyAdjustment)),
  };
}

// Every base-card walkout has its own fixed body and face profile. Nothing is rolled at
// render time, so a player keeps the same recognisable block-character appearance.
const RAW_PROFILES: readonly RawProfile[] = [
  ["231747", "FR", S4, "buzz", BLACK, "clean", "round", 1.00, 1.03, "arms"],
  ["209331", "EG", S3, "curls", BLACK, "full", "angular", 0.96, 0.92, "point"],
  ["239085", "NO", S1, "pony", BLOND, "clean", "long", 1.10, 1.06, "calm"],
  ["252371", "EN", S4, "curls", BLACK, "stubble", "long", 1.05, 1.00, "arms"],
  ["231443", "FR", S5, "buzz", BLACK, "clean", "oval", 0.95, 0.92, "fist"],
  ["231866", "ES", S2, "crop", BROWN, "short", "square", 1.06, 1.04, "calm"],
  ["203376", "NL", S4, "buzz", BLACK, "goatee", "long", 1.11, 1.08, "fist"],
  ["235212", "MA", S3, "fade", BLACK, "stubble", "angular", 0.97, 0.93, "point"],
  ["212831", "BR", S2, "slick", BROWN, "full", "square", 1.05, 1.05, "fist"],
  ["239053", "UY", S1, "crop", LIGHT_BROWN, "stubble", "long", 1.02, 0.98, "fist"],
  ["256630", "DE", S1, "crop", BROWN, "clean", "oval", 0.97, 0.88, "arms"],
  ["230621", "IT", S2, "slick", BLACK, "full", "long", 1.10, 1.03, "fist"],
  ["202126", "EN", S1, "crop", LIGHT_BROWN, "short", "square", 1.03, 1.02, "point"],
  ["212622", "DE", S1, "crop", BROWN, "clean", "angular", 0.96, 0.92, "fist"],
  ["277643", "ES", S3, "curls", BLACK, "clean", "oval", 0.94, 0.84, "point"],
  ["251854", "ES", S1, "crop", BROWN, "clean", "round", 0.93, 0.84, "calm"],
  ["233419", "BR", S3, "braids", BLACK, "goatee", "angular", 0.96, 0.90, "jump"],
  ["192119", "BE", S1, "crop", BROWN, "stubble", "long", 1.12, 1.04, "fist"],
  ["238794", "BR", S5, "fade", BLACK, "clean", "angular", 0.94, 0.87, "jump"],
  ["255253", "PT", S1, "crop", BLACK, "stubble", "oval", 0.94, 0.87, "calm"],
  ["233731", "SE", S4, "buzz", BLACK, "clean", "long", 1.08, 0.92, "calm"],
  ["246669", "EN", S5, "curls", BLACK, "clean", "round", 0.95, 0.90, "point"],
  ["232580", "BR", S5, "fade", BLACK, "full", "square", 1.05, 1.06, "fist"],
  ["256790", "DE", S3, "curls", BLACK, "clean", "long", 0.98, 0.84, "arms"],
  ["200389", "SI", S1, "buzz", BROWN, "full", "square", 1.04, 1.02, "calm"],
  ["231478", "AR", S2, "fade", BLACK, "full", "angular", 0.96, 0.94, "fist"],
  ["188545", "PL", S1, "slick", BROWN, "clean", "square", 1.00, 0.98, "fist"],
  ["237383", "IT", S2, "fade", BLACK, "short", "long", 1.05, 1.00, "calm"],
  ["239837", "AR", S1, "crop", BROWN, "stubble", "round", 0.97, 0.94, "fist"],
  ["212198", "PT", S1, "crop", BLACK, "full", "angular", 0.96, 0.93, "fist"],
  ["257534", "EN", S1, "curls", BROWN, "short", "angular", 0.96, 0.88, "calm"],
  ["234378", "EN", S1, "slick", LIGHT_BROWN, "clean", "square", 1.03, 1.02, "fist"],
  ["220901", "ES", S1, "crop", BROWN, "full", "round", 0.99, 0.97, "fist"],
  ["228702", "NL", S1, "medium", BLOND, "clean", "long", 0.98, 0.88, "calm"],
  ["246191", "AR", S2, "crop", BLACK, "stubble", "round", 0.96, 0.96, "arms"],
  ["241486", "FR", S4, "braids", BLACK, "goatee", "angular", 0.98, 0.94, "fist"],
  ["213331", "DE", S4, "buzz", BLACK, "short", "square", 1.07, 1.08, "calm"],
  ["192985", "BE", S1, "crop", BLOND, "short", "long", 1.00, 0.96, "arms"],
  ["247635", "GE", S1, "medium", BLACK, "full", "angular", 1.00, 0.93, "arms"],
  ["256079", "EC", S4, "buzz", BLACK, "clean", "round", 0.95, 0.96, "fist"],
  ["215698", "FR", S4, "buzz", BLACK, "full", "long", 1.04, 1.02, "fist"],
  ["222665", "NO", S1, "medium", BLOND, "clean", "angular", 0.96, 0.88, "calm"],
  ["207865", "BR", S3, "curls", BLACK, "full", "round", 1.04, 1.05, "fist"],
  ["224232", "IT", S2, "crop", BLACK, "stubble", "square", 0.96, 0.95, "fist"],
  ["215441", "GN", S5, "buzz", BLACK, "clean", "long", 1.01, 0.96, "arms"],
  ["241651", "SE", S2, "slick", BROWN, "clean", "square", 1.08, 1.08, "calm"],
  ["232293", "NG", S5, "buzz", BLACK, "clean", "long", 1.06, 1.02, "arms"],
  ["243715", "FR", S5, "fade", BLACK, "clean", "long", 1.06, 0.98, "fist"],
  ["177683", "CH", S1, "medium", BROWN, "stubble", "round", 0.95, 0.96, "calm"],
  ["205452", "DE", S3, "buzz", BLACK, "full", "square", 1.05, 1.05, "fist"],
  ["247851", "BR", S3, "curls", BLACK, "short", "round", 0.96, 0.95, "arms"],
  ["235073", "CH", S1, "medium", BROWN, "short", "long", 1.07, 1.01, "fist"],
  ["208128", "TR", S2, "slick", BLACK, "full", "angular", 0.96, 0.92, "calm"],
  ["237678", "FR", S5, "buzz", BLACK, "clean", "long", 1.07, 1.07, "fist"],
  ["158023", "AR", S1, "crop", BROWN, "short", "round", 0.94, 0.88, "point"],
  ["247827", "FR", S3, "locs", BLACK, "clean", "oval", 0.97, 0.88, "point"],
  ["192448", "DE", S1, "crop", LIGHT_BROWN, "stubble", "long", 1.05, 0.96, "fist"],
  ["256516", "ES", S4, "locs", BLACK, "clean", "long", 0.98, 0.90, "arms"],
  ["252145", "PT", S4, "buzz", BLACK, "clean", "angular", 0.97, 0.91, "point"],
  ["211110", "AR", S1, "slick", BLACK, "stubble", "oval", 0.94, 0.89, "point"],
  ["239818", "PT", S2, "crop", BLACK, "full", "square", 1.05, 1.06, "fist"],
  ["241096", "IT", S1, "medium", BLACK, "stubble", "angular", 1.00, 0.98, "calm"],
  ["231281", "EN", S2, "fade", BLACK, "goatee", "long", 0.98, 0.91, "point"],
  ["240638", "NL", S3, "slick", BLACK, "goatee", "long", 1.01, 0.96, "calm"],
  ["256196", "EC", S4, "fade", BLACK, "clean", "long", 1.03, 1.01, "fist"],
  ["194765", "FR", S1, "medium", LIGHT_BROWN, "stubble", "angular", 0.95, 0.90, "arms"],
  ["243014", "CM", S4, "bald", BLACK, "full", "square", 0.99, 1.03, "fist"],
  ["239580", "BR", S2, "bald", BLACK, "full", "square", 1.05, 1.08, "fist"],
  ["204963", "ES", S1, "crop", BROWN, "full", "square", 0.97, 0.97, "fist"],
  ["20801", "PT", S2, "crop", BLACK, "clean", "angular", 1.03, 1.04, "siu"],
  ["271421", "FR", S4, "curls", BLACK, "clean", "round", 0.94, 0.87, "jump"],
  ["229558", "FR", S5, "buzz", BLACK, "short", "square", 1.07, 1.08, "fist"],
  ["244260", "ES", S1, "crop", BROWN, "clean", "round", 0.96, 0.88, "point"],
  ["193080", "ES", S1, "slick", BROWN, "short", "long", 1.06, 0.98, "fist"],
  ["202811", "AR", S2, "fade", BLACK, "full", "square", 1.04, 1.05, "arms"],
  ["210257", "BR", S3, "fade", BLACK, "short", "round", 1.04, 1.00, "fist"],
  ["226268", "IT", S2, "slick", BLACK, "full", "angular", 0.96, 0.93, "calm"],
  ["226271", "ES", S1, "crop", BLACK, "stubble", "long", 0.97, 0.91, "calm"],
  ["199503", "CH", S1, "crop", BLACK, "clean", "square", 1.00, 1.02, "fist"],
  ["200104", "KR", S1, "crop", BLACK, "clean", "round", 0.95, 0.89, "arms"],
  ["204525", "ES", S1, "crop", BROWN, "short", "long", 1.05, 1.01, "calm"],
  ["272834", "PT", S3, "curls", BLACK, "clean", "round", 0.94, 0.86, "calm"],
  ["165153", "FR", S2, "buzz", BLACK, "full", "round", 1.00, 1.02, "calm"],
  ["241084", "CO", S3, "fade", BLACK, "goatee", "long", 0.96, 0.92, "arms"],
  ["228093", "FR", S4, "fade", BLACK, "full", "long", 1.05, 1.03, "fist"],
  ["215914", "FR", S5, "bald", BLACK, "clean", "round", 0.93, 0.88, "calm"],
  ["247819", "DE", S1, "crop", BLOND, "clean", "long", 1.08, 1.05, "fist"],
  ["237692", "EN", S4, "fade", BLACK, "short", "round", 0.94, 0.88, "point"],
  ["185122", "HU", S1, "bald", BROWN, "full", "round", 1.04, 1.02, "fist"],
  ["234236", "CZ", S1, "crop", BROWN, "stubble", "long", 1.08, 1.03, "calm"],
  ["246104", "NL", S3, "curls", BLACK, "clean", "long", 1.03, 0.94, "calm"],
  ["243812", "BR", S4, "fade", BLACK, "short", "angular", 0.97, 0.94, "arms"],
  ["237238", "SC", S1, "crop", BROWN, "stubble", "square", 1.02, 1.05, "fist"],
  ["230869", "ES", S1, "fade", BROWN, "full", "long", 1.05, 1.00, "fist"],
  ["216393", "BE", S2, "buzz", BLACK, "goatee", "round", 0.98, 0.96, "calm"],
  ["251570", "FR", S3, "curls", BLACK, "short", "round", 0.97, 0.94, "point"],
  ["278046", "ES", S1, "crop", BROWN, "clean", "long", 1.01, 0.96, "fist"],
  ["259532", "ES", S1, "crop", BROWN, "short", "long", 1.07, 1.02, "fist"],
  ["236772", "HU", S1, "medium", BROWN, "stubble", "long", 1.02, 0.94, "arms"],
  ["239231", "ES", S1, "curls", BROWN, "short", "long", 0.95, 0.90, "arms"],
  ["234577", "PT", S2, "crop", BLACK, "short", "square", 1.03, 1.00, "fist"],
  ["252154", "IT", S1, "crop", BROWN, "stubble", "long", 1.06, 1.01, "fist"],
  ["247090", "AR", S1, "crop", BLACK, "stubble", "angular", 0.98, 0.95, "fist"],
];

const PROFILE_BY_SOURCE_ID = new Map(RAW_PROFILES.map((raw) => [raw[0], raw]));

function fromRaw(raw: RawProfile): WalkoutPresentation {
  const [, countryCode, skin, hair, hairColor, beard, face, height, build, celebration] = raw;
  const country = COUNTRY[countryCode] ?? COUNTRY.CH;
  const physical = physicalScale(raw[0], height, build);
  return {
    countryCode,
    country: country.name,
    flag: country.flag,
    skin,
    hair,
    hairColor,
    beard,
    face,
    height: physical.height,
    build: physical.build,
    celebration,
    kitPrimary: country.kit[0],
    kitSecondary: country.kit[1],
    boots: Number(raw[0]) % 3 === 0 ? "#f6ff00" : Number(raw[0]) % 3 === 1 ? "#f5f5f5" : "#111111",
  };
}

const GOAT_PROFILE: WalkoutPresentation = {
  countryCode: "CH",
  country: "Schweiz",
  flag: "🇨🇭",
  skin: S1,
  hair: "crop",
  hairColor: BLOND,
  beard: "clean",
  face: "angular",
  height: 1.04,
  build: 1.03,
  celebration: "arms",
  kitPrimary: "#d71920",
  kitSecondary: "#ffffff",
  boots: "#d8b64c",
};

const SPECIAL_PROFILE_BY_PLAYER_ID: Record<string, WalkoutPresentation> = {
  "star-goat-nicu": GOAT_PROFILE,
  "star-flurin-fabrice": {
    ...GOAT_PROFILE,
    hair: "medium",
    hairColor: LIGHT_BROWN,
    face: "long",
    height: .98,
    build: .84,
    celebration: "jump",
  },
  "star-benxli": { ...GOAT_PROFILE, hair: "buzz", hairColor: BROWN, beard: "clean", face: "square", height: 1.03, build: 1.05, celebration: "fist", kitPrimary: "#166534", kitSecondary: "#ffffff", boots: "#111111" },
  "star-maetthu": {
    ...GOAT_PROFILE,
    skin: S1,
    hair: "bald",
    hairColor: BLACK,
    beard: "full",
    face: "round",
    height: 1.03,
    build: 1.1,
    celebration: "arms",
  },
  "star-champ-simu": {
    ...GOAT_PROFILE,
    hair: "pony",
    hairColor: BLACK,
    beard: "short",
    face: "long",
    height: 1.06,
    build: .92,
    celebration: "arms",
  },
  "star-silvuz": { ...GOAT_PROFILE, hair: "crop", hairColor: BROWN, beard: "clean", face: "oval", height: 1.04, build: .98, celebration: "point", kitPrimary: "#d71920", kitSecondary: "#ffffff", boots: "#ffffff" },
  "star-nedu-mann-yesss": {
    ...GOAT_PROFILE,
    countryCode: "BA",
    country: "Bosnien und Herzegowina",
    flag: "🇧🇦",
    skin: S1,
    hair: "slick",
    hairColor: BLACK,
    beard: "full",
    face: "round",
    height: 1.03,
    build: 1.1,
    celebration: "arms",
    kitPrimary: "#0033a0",
    kitSecondary: "#ffcc00",
    boots: "#ffffff",
  },
};

type WalkoutBodyProfile = Pick<WalkoutPresentation, "skin" | "hair" | "hairColor" | "beard" | "face" | "height" | "build" | "celebration">;

// Di Santo's body is fixed from the supplied reference, while the kit remains
// the regular in-game country kit instead of copying the reference clothing.
const SPECIAL_BODY_PROFILE_BY_PLAYER_ID: Record<string, WalkoutBodyProfile> = {
  "star-di-santo": {
    skin: S2,
    hair: "slick",
    hairColor: BLACK,
    beard: "short",
    face: "angular",
    height: 1.04,
    build: 1.02,
    celebration: "arms",
  },
};

function fromSpecialBody(player: StarXIPlayer, body: WalkoutBodyProfile): WalkoutPresentation {
  const countryCode = player.countryCode && COUNTRY[player.countryCode] ? player.countryCode : "CH";
  const country = COUNTRY[countryCode];
  return {
    countryCode,
    country: country.name,
    flag: country.flag,
    ...body,
    kitPrimary: country.kit[0],
    kitSecondary: country.kit[1],
    boots: "#f5f5f5",
  };
}

type IconAppearance = readonly [
  skin: string,
  hair: WalkoutHair,
  hairColor: string,
  beard: WalkoutBeard,
  face: WalkoutFace,
  height: number,
  build: number,
  celebration: WalkoutCelebration,
];

// Every FC26 Icon has a fixed, reference-checked prime-era appearance. Keeping
// this map separate from the generated player pool prevents an Icon from
// inheriting a random skin tone, haircut or body shape when the pool changes.
const ICON_APPEARANCE_BY_PLAYER_ID: Record<string, IconAppearance> = {
  "icon-pele": [S4, "crop", BLACK, "clean", "round", .97, .94, "jump"],
  "icon-diego-maradona": [S2, "curls", BLACK, "clean", "round", .90, .98, "arms"],
  "icon-ronaldo": [S3, "buzz", BLACK, "clean", "round", 1.02, 1.05, "arms"],
  "icon-zinedine-zidane": [S1, "bald", BLACK, "stubble", "long", 1.07, 1.01, "calm"],
  "icon-johan-cruyff": [S1, "medium", BROWN, "clean", "long", 1.01, .87, "point"],
  "icon-mia-hamm": [S1, "pony", BROWN, "clean", "oval", .96, .88, "arms"],
  "icon-ronaldinho": [S4, "locs", BLACK, "goatee", "round", .99, .94, "point"],
  "icon-nadine-angerer": [S1, "crop", BLOND, "clean", "square", 1.03, .96, "fist"],
  "icon-franz-beckenbauer": [S1, "medium", LIGHT_BROWN, "clean", "long", 1.02, .91, "calm"],
  "icon-bobby-charlton": [S1, "slick", LIGHT_BROWN, "clean", "long", .99, .91, "fist"],
  "icon-garrincha": [S3, "crop", BLACK, "clean", "round", .93, .91, "jump"],
  "icon-andres-iniesta": [S1, "bald", BROWN, "clean", "oval", .94, .87, "calm"],
  "icon-paolo-maldini": [S2, "medium", BLACK, "stubble", "angular", 1.06, .98, "calm"],
  "icon-gerd-muller": [S1, "medium", BROWN, "short", "round", .95, 1.03, "fist"],
  "icon-birgit-prinz": [S1, "pony", BLOND, "clean", "long", 1.03, .98, "fist"],
  "icon-ferenc-puskas": [S1, "slick", BLACK, "clean", "round", .95, 1.01, "fist"],
  "icon-lev-yashin": [S1, "slick", BLACK, "clean", "square", 1.07, 1.01, "arms"],
  "icon-alex-morgan": [S1, "pony", BROWN, "clean", "oval", .97, .88, "arms"],
  "icon-roberto-baggio": [S1, "pony", BLACK, "goatee", "angular", .98, .89, "calm"],
  "icon-franco-baresi": [S1, "crop", BLACK, "clean", "square", .98, .94, "fist"],
  "icon-gianluigi-buffon": [S1, "slick", BLACK, "stubble", "long", 1.10, 1.03, "fist"],
  "icon-cafu": [S4, "bald", BLACK, "clean", "round", .98, .94, "arms"],
  "icon-carlos-alberto": [S4, "crop", BLACK, "clean", "square", 1.00, .97, "fist"],
  "icon-eusebio": [S4, "crop", BLACK, "clean", "round", .97, .98, "arms"],
  "icon-thierry-henry": [S4, "bald", BLACK, "stubble", "long", 1.06, .98, "calm"],
  "icon-zlatan-ibrahimovic": [S1, "pony", BLACK, "full", "angular", 1.12, 1.07, "arms"],
  "icon-oliver-kahn": [S1, "crop", BLOND, "clean", "square", 1.08, 1.05, "fist"],
  "icon-homare-sawa": [S2, "medium", BLACK, "clean", "oval", .95, .86, "arms"],
  "icon-marco-van-basten": [S1, "medium", BROWN, "clean", "long", 1.08, .98, "calm"],
  "icon-xavi": [S2, "crop", BLACK, "stubble", "round", .94, .89, "point"],
  "icon-zico": [S2, "curls", BLACK, "clean", "round", .95, .90, "arms"],
  "icon-camille-abily": [S1, "pony", BROWN, "clean", "oval", .96, .88, "point"],
  "icon-dennis-bergkamp": [S1, "slick", BLOND, "clean", "long", 1.06, .97, "calm"],
  "icon-george-best": [S1, "medium", BLACK, "clean", "angular", .96, .89, "arms"],
  "icon-iker-casillas": [S2, "crop", BLACK, "stubble", "round", .99, .93, "fist"],
  "icon-alessandro-del-piero": [S2, "slick", BLACK, "stubble", "angular", .98, .90, "point"],
  "icon-julie-foudy": [S1, "pony", BROWN, "clean", "oval", .98, .91, "fist"],
  "icon-ruud-gullit": [S4, "locs", BLACK, "goatee", "long", 1.09, 1.04, "arms"],
  "icon-toni-kroos": [S1, "crop", BLOND, "stubble", "long", 1.03, .97, "calm"],
  "icon-lothar-matthaus": [S1, "crop", BROWN, "clean", "square", .98, .96, "fist"],
  "icon-aya-miyama": [S2, "medium", BLACK, "clean", "round", .91, .84, "point"],
  "icon-bobby-moore": [S1, "slick", BLOND, "clean", "square", 1.02, .95, "calm"],
  "icon-andrea-pirlo": [S1, "medium", BROWN, "full", "long", 1.00, .90, "calm"],
  "icon-raul": [S2, "crop", BLACK, "goatee", "long", .98, .90, "point"],
  "icon-rivaldo": [S4, "bald", BLACK, "clean", "long", 1.04, .96, "arms"],
  "icon-rivellino": [S2, "medium", BLACK, "short", "round", .96, .92, "point"],
  "icon-roberto-carlos": [S4, "bald", BLACK, "clean", "round", .93, 1.04, "fist"],
  "icon-lotta-schelin": [S1, "pony", BLOND, "clean", "long", 1.04, .91, "arms"],
  "icon-caroline-seger": [S1, "pony", BLOND, "clean", "long", 1.02, .92, "arms"],
  "icon-gabriel-batistuta": [S2, "medium", BLACK, "stubble", "angular", 1.04, 1.03, "fist"],
  "icon-emilio-butragueno": [S1, "crop", BLACK, "clean", "round", .94, .86, "point"],
  "icon-fabio-cannavaro": [S2, "bald", BLACK, "clean", "square", .96, .98, "fist"],
  "icon-eric-cantona": [S2, "bald", BLACK, "stubble", "angular", 1.06, 1.04, "calm"],
  "icon-didier-drogba": [S5, "bald", BLACK, "clean", "square", 1.08, 1.08, "fist"],
  "icon-kenny-dalglish": [S1, "medium", BLACK, "clean", "round", .98, .91, "arms"],
  "icon-samuel-etoo": [S5, "buzz", BLACK, "clean", "long", .99, .96, "fist"],
  "icon-luis-figo": [S2, "slick", BLACK, "stubble", "angular", 1.01, .95, "point"],
  "icon-philipp-lahm": [S1, "crop", BROWN, "clean", "round", .94, .88, "calm"],
  "icon-hugo-sanchez": [S2, "curls", BLACK, "clean", "round", .96, .91, "jump"],
  "icon-jairzinho": [S4, "afro", BLACK, "clean", "round", .98, .94, "arms"],
  "icon-kaka": [S2, "slick", BROWN, "clean", "long", 1.04, .92, "point"],
  "icon-gary-lineker": [S1, "crop", BROWN, "clean", "square", .99, .94, "fist"],
  "icon-marcelo": [S3, "afro", BLACK, "full", "round", .96, .95, "arms"],
  "icon-alessandro-nesta": [S2, "medium", BLACK, "clean", "long", 1.07, .97, "calm"],
  "icon-ruud-van-nistelrooy": [S1, "slick", BLACK, "stubble", "long", 1.07, 1.00, "fist"],
  "icon-carles-puyol": [S2, "medium", BLACK, "clean", "square", .98, .97, "fist"],
  "icon-peter-schmeichel": [S1, "crop", BLOND, "clean", "square", 1.11, 1.08, "fist"],
  "icon-alan-shearer": [S1, "crop", BROWN, "clean", "square", 1.02, 1.03, "fist"],
  "icon-kelly-smith": [S1, "pony", LIGHT_BROWN, "clean", "oval", .96, .89, "arms"],
  "icon-socrates": [S3, "medium", BLACK, "full", "long", 1.08, .94, "calm"],
  "icon-steffi-jones": [S4, "locs", BLACK, "clean", "angular", 1.02, .96, "fist"],
  "icon-hristo-stoichkov": [S1, "crop", BLACK, "stubble", "square", .99, .99, "fist"],
  "icon-francesco-totti": [S2, "slick", BROWN, "stubble", "angular", 1.02, .97, "point"],
  "icon-javier-zanetti": [S2, "slick", BLACK, "clean", "long", 1.01, .96, "fist"],
  "icon-gareth-bale": [S1, "slick", BLACK, "stubble", "long", 1.04, .97, "arms"],
  "icon-david-beckham": [S1, "slick", LIGHT_BROWN, "stubble", "angular", 1.02, .96, "arms"],
  "icon-laurent-blanc": [S1, "bald", BLACK, "clean", "long", 1.09, 1.01, "calm"],
  "icon-petr-cech": [S1, "crop", BLACK, "clean", "long", 1.11, 1.02, "fist"],
  "icon-giorgio-chiellini": [S1, "bald", BLACK, "stubble", "long", 1.08, 1.06, "fist"],
  "icon-marcel-desailly": [S5, "buzz", BLACK, "clean", "square", 1.06, 1.08, "fist"],
  "icon-rio-ferdinand": [S4, "buzz", BLACK, "clean", "long", 1.09, 1.04, "calm"],
  "icon-steven-gerrard": [S1, "crop", BROWN, "stubble", "square", 1.02, 1.00, "fist"],
  "icon-gheorghe-hagi": [S1, "medium", BLACK, "clean", "round", .96, .91, "point"],
  "icon-fernando-hierro": [S2, "medium", BLACK, "full", "angular", 1.06, 1.03, "fist"],
  "icon-geoff-hurst": [S1, "crop", BROWN, "clean", "square", 1.02, 1.00, "fist"],
  "icon-mario-kempes": [S1, "medium", BLACK, "clean", "long", 1.03, .94, "arms"],
  "icon-miroslav-klose": [S1, "crop", BROWN, "clean", "long", 1.05, .96, "jump"],
  "icon-ronald-koeman": [S1, "crop", BLOND, "clean", "round", 1.02, 1.00, "fist"],
  "icon-michael-laudrup": [S1, "medium", BROWN, "clean", "long", 1.03, .92, "calm"],
  "icon-pavel-nedved": [S1, "medium", BLOND, "clean", "long", 1.00, .94, "arms"],
  "icon-michael-owen": [S1, "crop", BROWN, "clean", "round", .96, .88, "arms"],
  "icon-marinette-pichon": [S1, "crop", BROWN, "clean", "oval", .96, .90, "fist"],
  "icon-franck-ribery": [S1, "crop", BROWN, "stubble", "angular", .96, .91, "fist"],
  "icon-juan-roman-riquelme": [S2, "medium", BLACK, "clean", "long", 1.00, .91, "calm"],
  "icon-wayne-rooney": [S1, "crop", BROWN, "stubble", "round", .97, 1.04, "fist"],
  "icon-paul-scholes": [S1, "crop", LIGHT_BROWN, "clean", "round", .97, .91, "fist"],
  "icon-bastian-schweinsteiger": [S1, "crop", BLOND, "stubble", "square", 1.03, 1.00, "fist"],
  "icon-andriy-shevchenko": [S1, "crop", LIGHT_BROWN, "clean", "long", 1.02, .94, "arms"],
  "icon-lilian-thuram": [S5, "bald", BLACK, "clean", "square", 1.04, 1.05, "fist"],
  "icon-edwin-van-der-sar": [S1, "crop", BROWN, "clean", "long", 1.13, 1.01, "calm"],
  "icon-robin-van-persie": [S1, "slick", BLACK, "stubble", "long", 1.04, .94, "arms"],
  "icon-patrick-vieira": [S5, "bald", BLACK, "clean", "long", 1.10, 1.05, "fist"],
  "icon-john-barnes": [S4, "medium", BLACK, "clean", "round", 1.00, 1.00, "arms"],
  "icon-dunga": [S2, "crop", BLACK, "clean", "square", .98, .97, "fist"],
  "icon-patrick-kluivert": [S4, "buzz", BLACK, "clean", "long", 1.08, 1.00, "arms"],
  "icon-frank-lampard": [S1, "crop", BROWN, "clean", "square", 1.02, 1.00, "fist"],
  "icon-claude-makelele": [S5, "bald", BLACK, "clean", "round", .97, .96, "calm"],
  "icon-emmanuel-petit": [S1, "pony", BLOND, "clean", "long", 1.06, .98, "fist"],
  "icon-robert-pires": [S2, "medium", BLACK, "goatee", "long", 1.05, .92, "calm"],
  "icon-frank-rijkaard": [S4, "locs", BLACK, "goatee", "long", 1.08, 1.01, "calm"],
  "icon-ian-rush": [S1, "medium", BLACK, "stubble", "long", 1.01, .91, "fist"],
  "icon-davor-suker": [S1, "medium", BLACK, "clean", "long", 1.00, .91, "point"],
  "icon-fernando-torres": [S1, "crop", BLOND, "clean", "long", 1.04, .94, "arms"],
  "icon-nemanja-vidic": [S1, "crop", BLACK, "clean", "square", 1.06, 1.06, "fist"],
  "icon-ian-wright": [S5, "bald", BLACK, "clean", "round", .96, .95, "arms"],
  "icon-xabi-alonso": [S1, "slick", BROWN, "full", "angular", 1.02, .96, "calm"],
  "icon-cha-bum-kun": [S2, "crop", BLACK, "clean", "round", 1.01, .96, "arms"],
  "icon-gianfranco-zola": [S2, "crop", BLACK, "clean", "round", .93, .87, "point"],
  "icon-ashley-cole": [S4, "buzz", BLACK, "clean", "long", .98, .93, "calm"],
  "icon-sol-campbell": [S5, "bald", BLACK, "clean", "square", 1.08, 1.10, "fist"],
  "icon-hernan-crespo": [S2, "medium", BLACK, "clean", "long", 1.03, .97, "arms"],
  "icon-michael-essien": [S5, "buzz", BLACK, "clean", "square", 1.00, 1.04, "fist"],
  "icon-gennaro-gattuso": [S2, "medium", BLACK, "full", "square", .98, 1.01, "fist"],
  "icon-luis-hernandez": [S2, "pony", BLOND, "clean", "long", .99, .91, "arms"],
  "icon-roy-keane": [S1, "crop", BLACK, "clean", "square", 1.00, 1.00, "fist"],
  "icon-henrik-larsson": [S1, "locs", LIGHT_BROWN, "goatee", "long", 1.00, .94, "arms"],
  "icon-sissi": [S3, "curls", BLACK, "clean", "oval", .94, .86, "point"],
  "icon-juan-sebastian-veron": [S2, "bald", BLACK, "goatee", "angular", 1.03, 1.00, "calm"],
  "icon-gianluca-zambrotta": [S2, "medium", BROWN, "clean", "square", 1.01, .97, "fist"],
};

function fromIconAppearance(player: StarXIPlayer, appearance: IconAppearance): WalkoutPresentation {
  const [skin, hair, hairColor, beard, face, height, build, celebration] = appearance;
  const countryCode = player.countryCode && COUNTRY[player.countryCode] ? player.countryCode : "CH";
  const country = COUNTRY[countryCode];
  return {
    countryCode,
    country: country.name,
    flag: country.flag,
    skin,
    hair,
    hairColor,
    beard,
    face,
    height,
    build,
    celebration,
    kitPrimary: country.kit[0],
    kitSecondary: country.kit[1],
    boots: "#d7dce5",
  };
}

export function getStarCardTier(player: StarXIPlayer): StarCardTier {
  if (player.cardType === "legendary") return "legendary";
  if (player.cardType === "icon") return "icon";
  if (player.rating >= 86) return "walkout";
  if (player.rating >= 80) return "rare";
  return "standard";
}

function fallbackProfile(player: StarXIPlayer): WalkoutPresentation {
  const numericSourceId = Number(player.sourceId);
  let seed = Number.isFinite(numericSourceId) && numericSourceId > 0 ? numericSourceId : 2166136261;
  if (!(Number.isFinite(numericSourceId) && numericSourceId > 0)) {
    for (let index = 0; index < player.id.length; index += 1) {
      seed ^= player.id.charCodeAt(index);
      seed = Math.imul(seed, 16777619) >>> 0;
    }
  }
  const countries = Object.keys(COUNTRY);
  const hairs: WalkoutHair[] = ["buzz", "crop", "curls", "fade", "medium", "waves"];
  const beards: WalkoutBeard[] = ["clean", "stubble", "short"];
  const faces: WalkoutFace[] = ["oval", "round", "angular", "long", "square"];
  return fromRaw([
    String(seed),
    player.countryCode && COUNTRY[player.countryCode] ? player.countryCode : countries[seed % countries.length],
    [S1, S2, S3, S4, S5][seed % 5],
    hairs[seed % hairs.length],
    [BLACK, BROWN, LIGHT_BROWN, BLOND][seed % 4],
    beards[seed % beards.length],
    faces[seed % faces.length],
    0.94 + (seed % 17) / 100,
    0.86 + (seed % 21) / 100,
    ["arms", "calm", "fist", "jump", "point"][seed % 5] as WalkoutCelebration,
  ]);
}

export function getWalkoutPresentation(player: StarXIPlayer) {
  const special = SPECIAL_PROFILE_BY_PLAYER_ID[player.id];
  if (special) return special;
  const specialBody = SPECIAL_BODY_PROFILE_BY_PLAYER_ID[player.id];
  if (specialBody) return fromSpecialBody(player, specialBody);
  const iconAppearance = ICON_APPEARANCE_BY_PLAYER_ID[player.id];
  if (iconAppearance) return fromIconAppearance(player, iconAppearance);
  const raw = player.sourceId ? PROFILE_BY_SOURCE_ID.get(player.sourceId) : undefined;
  return raw ? fromRaw(raw) : fallbackProfile(player);
}

export const AUTHENTIC_WALKOUT_PROFILE_COUNT = RAW_PROFILES.length;
export const AUTHENTIC_WALKOUT_SOURCE_IDS = new Set(RAW_PROFILES.map((profile) => profile[0]));
export const AUTHENTIC_ICON_PROFILE_COUNT = Object.keys(ICON_APPEARANCE_BY_PLAYER_ID).length;
export const AUTHENTIC_ICON_PLAYER_IDS = new Set(Object.keys(ICON_APPEARANCE_BY_PLAYER_ID));
