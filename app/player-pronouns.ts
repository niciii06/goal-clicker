// Pronouns for a player or a woman player. German texts write tokens such as {er}, {seine} or {der Spieler}, English
// texts {he}, {his} or {him}; pronounText fills them, and other placeholders such as {player} or {torschuetze} stay as
// they are. The tokens are not message placeholders (app/i18n/translate.ts placeholders() leaves them out).
type Gendered = { isWomen?: boolean } | null | undefined;

const MALE: Record<string, string> = {
  er: "er", Er: "Er", ihn: "ihn", ihm: "ihm", sein: "sein", Sein: "Sein", seine: "seine", seinen: "seinen", seiner: "seiner",
  Spieler: "Spieler", "der Spieler": "der Spieler", "Der Spieler": "Der Spieler", "den Spieler": "den Spieler", "diesem Spieler": "diesem Spieler",
  he: "he", He: "He", him: "him", his: "his", His: "His", himself: "himself",
};
const FEMALE: Record<string, string> = {
  er: "sie", Er: "Sie", ihn: "sie", ihm: "ihr", sein: "ihr", Sein: "Ihr", seine: "ihre", seinen: "ihren", seiner: "ihrer",
  Spieler: "Spielerin", "der Spieler": "die Spielerin", "Der Spieler": "Die Spielerin", "den Spieler": "die Spielerin", "diesem Spieler": "dieser Spielerin",
  he: "she", He: "She", him: "her", his: "her", His: "Her", himself: "herself",
};

/** Every pronoun token of both languages, so the catalogue checks do not take them for placeholders. */
export const PRONOUN_TOKENS: ReadonlySet<string> = new Set(Object.keys(MALE));

export function pronounText(text: string, player: Gendered) {
  const words = player?.isWomen ? FEMALE : MALE;
  return text.replace(/\{([^{}]+)\}/g, (token, key: string) => words[key] ?? token);
}
