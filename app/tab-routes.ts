// One address per main tab and sub tab, e.g. /kader or /club/missionen. All of them serve the single
// game page (see the rewrites in next.config.ts), so switching tabs never reloads or remounts the game.
export const TAB_PATHS = {
  home: '/home', cup: '/spiele', squad: '/kader', career: '/karriere', packs: '/packs', album: '/packs/album',
  club: '/club', fabrizio: '/club/fabrizio', missions: '/club/missionen', leaderboard: '/club/rangliste', history: '/club/verlauf',
} as const;

export type RoutedTab = keyof typeof TAB_PATHS;

/** The tab for an address; the start page and unknown paths open Home. Case and a trailing slash do not matter. */
export function tabForPath(pathname: string): RoutedTab {
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return (Object.keys(TAB_PATHS) as RoutedTab[]).find((tab) => TAB_PATHS[tab] === path) ?? 'home';
}

/** Lower case spellings like /Kader lead to the real address. */
export function canonicalTabPath(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '');
  const known = Object.values(TAB_PATHS).find((value) => value === path.toLowerCase());
  return known && known !== path ? known : null;
}
