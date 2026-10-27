// German pronouns for a player or a woman player. Texts write tokens such as {er}, {seine} or {der Spieler};
// pronounText fills them, and other placeholders such as {player} or {torschuetze} stay as they are.
type Gendered = { isWomen?: boolean } | null | undefined;

const MALE: Record<string, string> = {
  er: "er", Er: "Er", ihn: "ihn", ihm: "ihm", sein: "sein", Sein: "Sein", seine: "seine", seinen: "seinen", seiner: "seiner",
  Spieler: "Spieler", "der Spieler": "der Spieler", "Der Spieler": "Der Spieler", "den Spieler": "den Spieler", "diesem Spieler": "diesem Spieler",
};
const FEMALE: Record<string, string> = {
  er: "sie", Er: "Sie", ihn: "sie", ihm: "ihr", sein: "ihr", Sein: "Ihr", seine: "ihre", seinen: "ihren", seiner: "ihrer",
  Spieler: "Spielerin", "der Spieler": "die Spielerin", "Der Spieler": "Die Spielerin", "den Spieler": "die Spielerin", "diesem Spieler": "dieser Spielerin",
};

export function pronounText(text: string, player: Gendered) {
  const words = player?.isWomen ? FEMALE : MALE;
  return text.replace(/\{([^{}]+)\}/g, (token, key: string) => words[key] ?? token);
}
