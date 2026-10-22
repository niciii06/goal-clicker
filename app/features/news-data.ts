// Texts for transfer rumours and the tournament gazette.


/**
 * Clubs that ask Fabrizio Romario about a player, by the rating range they realistically sign from. A 55 rated
 * player hears from Indian Super League and small Swiss clubs, never from Manchester Cité.
 */
export const TRANSFER_CLUB_TIERS = [
  { minRating: 85, maxRating: 100, clubs: ["Real Madreto", "FC Barceloneta", "Manchester Cité", "Bayern Münchan", "Liverpuhl FC", "Paris Saint German", "Galácticos XI"] },
  { minRating: 80, maxRating: 88, clubs: ["Inter Milano", "Arsenal Londra", "Atlético Madrido", "Borussia Dortmundt", "AC Milano", "Juventas Turin", "Tottenhem Hotspur"] },
  { minRating: 74, maxRating: 82, clubs: ["Ajacks Amsterdam", "Benfico Lissabon", "Sevilla Sol", "Olympique Marsala", "PSV Eindhofen", "Sporting Lissabona", "Galatasarai Istanbul"] },
  { minRating: 67, maxRating: 76, clubs: ["FC Basilea", "Young Boyz Bern", "Club Brügge Blau", "Celtik Glasgow", "Rapid Wienna", "Feyenoordt", "Dinamo Zagrep"] },
  { minRating: 59, maxRating: 69, clubs: ["FC Thun am See", "Grasshopper Zürch", "Sturm Gratz", "Lech Posnan", "Dundee Unitet", "Bengalooru FC", "Mohun Bagaan"] },
  { minRating: 0, maxRating: 61, clubs: ["FC Aarau Kicker", "SC Kriens 1944", "Kerala Blastors", "FC Goa Strand", "Mumbay City", "Odisha Tigers", "Hyderabad Hawks"] },
] as const;

/** Every club Fabrizio knows, for a rumour without a known player. */
export const TRANSFER_INTERESTED_CLUBS = TRANSFER_CLUB_TIERS.flatMap((tier) => tier.clubs);

/** The clubs that would really sign a player with this rating. */
export function transferClubsForRating(rating: number) {
  const fitting = TRANSFER_CLUB_TIERS.filter((tier) => rating >= tier.minRating && rating <= tier.maxRating);
  return fitting.length ? fitting.flatMap((tier) => tier.clubs) : [...TRANSFER_CLUB_TIERS.at(-1)!.clubs];
}

export const GAZETTE_CHAMPION_HEADLINES = [
  "DER POKAL GEHÖRT UNS",
  "DIE NACHT GEHÖRT DEM CLUB",
  "CHAMPIONS AUF DEM RASEN",
  "EIN TURNIER, EIN THRON",
  "DAS STADION BEBT NOCH IMMER",
  "TROPHÄE GESICHERT, STIMME VERLOREN",
  "DER BUS BRAUCHT EIN OFFENES DACH",
  "KONFETTI BIS MORGEN FRÜH",
] as const;

export const GAZETTE_EXIT_HEADLINES = [
  "AUS, ABER NICHT LEISE",
  "DER POKAL FÄHRT OHNE UNS",
  "DRAMA BIS ZUM SCHLUSSPFIFF",
  "HEUTE KEIN KONFETTI",
  "DIE KABINE IST VERDÄCHTIG STILL",
  "KNAPP DANEBEN IST AUCH VORBEI",
  "DER TRAUM MACHT EINE PAUSE",
  "ROMARIO SUCHT SCHON VERSTÄRKUNG",
] as const;
