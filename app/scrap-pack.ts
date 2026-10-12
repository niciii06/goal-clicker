import type { StarPosition } from './fc26-player-pool';
import source from './fc27-india-source.json';

const positions: Record<string, StarPosition> = { GK:'TW', LB:'LV', CB:'IV', RB:'RV', CDM:'ZDM', CM:'ZM', CAM:'ZOM', LM:'LM', RM:'RM', LW:'LF', RW:'RF', ST:'ST' };
export const FC27_INDIA_PROFILES = source.items.map(player => {
  const playable = [player.position, ...(player.alternatePositions ?? [])].map(p => {
    const mapped = positions[p.shortLabel];
    if (!mapped) throw new Error(`Unsupported source position: ${p.shortLabel}`);
    return mapped;
  });
  return { sourceId:String(player.id), name:player.commonName || `${player.firstName} ${player.lastName}`.trim(), rating:player.overallRating, positions:[...new Set(playable)], attributes:player };
});

// Shared rating probabilities for selection and public pack display.
export const SCRAP_RATING_GROUPS = [
  { minRating:0, maxRating:54, chance:0.50 },
  { minRating:55, maxRating:59, chance:0.35 },
  { minRating:60, maxRating:64, chance:0.13 },
  { minRating:65, maxRating:69, chance:0.02 },
] as const;

export function drawScrapPlayer<T extends { rating:number }>(players:readonly T[], random:()=>number):T {
  const groups = SCRAP_RATING_GROUPS.map(group => ({...group, players:players.filter(p => p.rating>=group.minRating && p.rating<=group.maxRating)})).filter(group => group.players.length);
  const total = groups.reduce((sum, group) => sum+group.chance, 0);
  if (!total) throw new Error('No eligible pack players');
  // Fail closed if a future source adds ratings beyond the configured ranges.
  if (groups.reduce((sum, group) => sum+group.players.length, 0)!==players.length) throw new Error('Pack rating rules do not cover the source');
  const bounded = () => Math.max(0, Math.min(1-Number.EPSILON, random()));
  let roll = bounded()*total;
  const group = groups.find(g => { roll-=g.chance; return roll<0; }) ?? groups[groups.length-1];
  return group.players[Math.floor(bounded()*group.players.length)];
}
