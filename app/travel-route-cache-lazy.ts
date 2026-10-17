// Browser build only (see build/client-data-plugin.ts): the route geometry is fetched right after
// the game started instead of blocking the first screen. Server code and tests import the full cache.
import type fullRoutes from './travel-route-cache';

const routes: Record<string, unknown> = {};
let pending: Promise<boolean> | undefined;

/** Starts the background download once; resolves to true when exact routes are available. */
export function loadRouteCache(): Promise<boolean> {
  pending ??= import('./travel-route-cache')
    .then((module) => { Object.assign(routes, module.default); return true; })
    .catch(() => { pending = undefined; return false; });
  return pending;
}

export default routes as typeof fullRoutes;
