import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

type SourcePosition = { shortLabel: string };
type SourcePlayer = { id: number; overallRating: number; firstName: string; lastName: string; commonName: string | null; position: SourcePosition; alternatePositions?: SourcePosition[] | null; stats: Record<string, { value: number }> };
type IndiaSource = { items: SourcePlayer[] };

/** The browser only reads names, rating, positions and stat values; the full EA export stays on the server and in tests. */
export function slimIndiaSource<T extends IndiaSource>(source: T) {
  const { items, ...meta } = source;
  return {
    ...(meta as Omit<T, 'items'>),
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

// Client build only: large data that the first screen does not need is slimmed or loaded after start.
export function clientData(): Plugin {
  let root = process.cwd();
  const isClient = (plugin: unknown) => (plugin as { environment?: { name?: string } }).environment?.name === "client";
  return {
    name: "goal-clicker-client-data",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    resolveId(source, importer) {
      // Route geometry is only needed for travel previews; the game starts without waiting for it.
      if (isClient(this) && source === "./travel-route-cache" && importer?.replace(/\\/g, "/").endsWith("/app/journey-routing.ts")) {
        return resolve(root, "app/travel-route-cache-lazy.ts");
      }
      return null;
    },
    async load(id) {
      if (!isClient(this) || !id.replace(/\\/g, "/").split("?")[0].endsWith("/app/fc27-india-source.json")) return null;
      const source = JSON.parse(await readFile(resolve(root, "app/fc27-india-source.json"), "utf8")) as IndiaSource;
      return JSON.stringify(slimIndiaSource(source));
    },
  };
}
