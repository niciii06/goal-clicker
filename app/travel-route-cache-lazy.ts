// Browser build only (package.json "imports", condition "browser"): the route geometry is fetched after the game
// started instead of blocking the first screen. The browser loads the shared part (Bern and every leg that does not
// leave from another home city) plus the part of the club's home city; server code and tests import the full cache
// (travel-route-cache.ts). The parts are written by scripts/travel/route-fetch-lib.mts.
import type fullRoutes from './travel-route-cache';

const routes: Record<string, unknown> = {};
const PARTS = {
  base: () => import('./route-cache/base.json'),
  zurich: () => import('./route-cache/zurich.json'),
  basel: () => import('./route-cache/basel.json'),
  geneve: () => import('./route-cache/geneve.json'),
} as const;
type Part = keyof typeof PARTS;
const pending = new Map<Part, Promise<boolean>>();

function loadPart(part: Part) {
  let task = pending.get(part);
  if (!task) {
    task = PARTS[part]()
      .then((module) => { Object.assign(routes, module.default); return true; })
      .catch(() => { pending.delete(part); return false; });
    pending.set(part, task);
  }
  return task;
}

/** Starts the background download once per part; resolves to true when the routes of this home city are there. */
export function loadRouteCache(homeCity?: unknown): Promise<boolean> {
  const parts: Part[] = ['base'];
  if (typeof homeCity === 'string' && homeCity !== 'base' && homeCity in PARTS) parts.push(homeCity as Part);
  return Promise.all(parts.map(loadPart)).then((loaded) => loaded.every(Boolean));
}

export default routes as typeof fullRoutes;
