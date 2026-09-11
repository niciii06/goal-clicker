type FunnyNameContext = {
  position?: string;
  rating?: number;
};

// These are deliberately tiny spelling jokes. They keep the same number of
// characters and never add a nickname or a new word to a player's name.
const SAME_LENGTH_ALIASES: Readonly<Record<string, string>> = {
  "V. van Dijc": "V. van Donk",
  "L. Messi": "L. Messy",
  "Lionel Messi": "Lionel Messy",
  "K. Mbappo": "K. Mbappo",
  "Kylian Mbappo": "Kylian Mbappo",
  "Lamine Yamar": "Lamine Yamal",
  "Ronaldo Nazárioh": "Ronaldo Nazáriok",
  "S. Pecc": "S. Peck",
  "O. Becc": "O. Beck",
  "J. Gelhardd": "J. Gelhardt",
  "J. Rak-Sakyy": "J. Rak-Sakyi",
  "M. Amougoo": "M. Amougou",
  "C. Tengstedd": "C. Tengstedt",
  "I. Beboo": "I. Bebou",
  "Y. Gerhardd": "Y. Gerhardt",
  "R. Malinovskyy": "R. Malinovskyi",
  "D. Zagadoo": "D. Zagadu",
  "M. Vandevoordd": "M. Vandevoordt",
  "M. Batshuayy": "M. Batshuayi",
  "Endricc": "Endrick",
  "P. Lees-Meloo": "P. Lees-Melou",
  "D. Welbecc": "D. Welbeck",
  "D. Dibuss": "D. Dibusz",
  "O. Kossounoo": "O. Kossounou",
  "P. Groo": "P. Groz",
  "J. Burkardd": "J. Burkardt",
  "M. Mittelstädd": "M. Mittelstädt",
  "Y. Bounoo": "Y. Bounou",
  "J. Brandd": "J. Brandt",
  "N. Schlotterbecc": "N. Schlotterbeck",
  "P. Schicc": "P. Schick",
  "S. Andreoo": "S. Andreou",
  "G. Koyalipoo": "G. Koyalipou",
};

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const SAME_LENGTH_ALIAS_BY_NAME = new Map(
  Object.entries(SAME_LENGTH_ALIASES).map(([name, alias]) => [normalizeName(name), alias]),
);

/**
 * Returns a checked same-length alias. The seed/context parameters make the
 * helper safe to call from every card pool without changing game mechanics.
 */
export function getFunnyPlayerName(originalName: string, _seed: string, context: FunnyNameContext = {}) {
  void context;
  const alias = SAME_LENGTH_ALIAS_BY_NAME.get(normalizeName(originalName));
  return alias && [...alias].length === [...originalName].length ? alias : originalName;
}
