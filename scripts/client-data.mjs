// The browser only reads names, rating, positions and stat values of the FC 27 India export; the full
// export stays on the server and in tests. `npm run generate:client-data` writes the slim browser copy,
// which package.json "imports" (#fc27-india-source, condition "browser") hands to the client bundle.
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function slimIndiaSource(source) {
  const { items, ...meta } = source;
  return {
    ...meta,
    items: items.map((player) => ({
      id: player.id,
      overallRating: player.overallRating,
      firstName: player.firstName,
      lastName: player.lastName,
      commonName: player.commonName,
      position: { shortLabel: player.position.shortLabel },
      alternatePositions: (player.alternatePositions ?? []).map((position) => ({ shortLabel: position.shortLabel })),
      stats: Object.fromEntries(Object.entries(player.stats).map(([key, stat]) => [key, { value: stat.value }])),
    })),
  };
}

export const SOURCE = new URL("../app/fc27-india-source.json", import.meta.url);
export const CLIENT_COPY = new URL("../app/fc27-india-source.client.json", import.meta.url);

export async function renderClientCopy() {
  return `${JSON.stringify(slimIndiaSource(JSON.parse(await readFile(SOURCE, "utf8"))))}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await writeFile(CLIENT_COPY, await renderClientCopy());
}
