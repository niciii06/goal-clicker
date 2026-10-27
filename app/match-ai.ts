// Situational decisions for the 2D match engine: team shape, off-ball movement and the options of
// the ball carrier. Everything here is pure and deterministic: the caller passes the checkpoint and
// its seeded random numbers, so a match replays identically after a reload.
import type { SimCheckpoint, SimPlayer, SimPoint } from './interactive-match';

/** Simulated match seconds that one second of on-screen play stands for. Plays are compressed:
 * a league match shows 90 minutes in about 3.5 to 4 minutes, so the screen runs a little faster
 * than this factor and every play summarises a short phase of the game. */
export const SIM_SECONDS_PER_VISUAL_SECOND = 18;
export const PITCH = { length: 105, width: 68, goalY: 34, postHalf: 3.66, boxDepth: 16.5, boxHalf: 20.16 } as const;

export type Role = 'keeper' | 'centre-back' | 'full-back' | 'holding' | 'midfield' | 'attacking-mid' | 'wide' | 'striker';
export type PassStyle = 'short' | 'progressive' | 'through' | 'long' | 'cross' | 'clearance';
export type SetPiece = 'throw-in' | 'goal-kick' | 'corner' | 'free-kick' | 'penalty';
export type CarrierOption =
  | { kind: 'shot'; point: SimPoint; utility: number; quality: number }
  | { kind: 'pass'; style: PassStyle; target: SimPlayer; point: SimPoint; utility: number; success: number; lane: number; distance: number; offside: boolean }
  | { kind: 'carry'; point: SimPoint; utility: number; success: number; challenger?: SimPlayer }
  | { kind: 'hold'; point: SimPoint; utility: number };

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const dist = (a: SimPoint, b: SimPoint) => Math.hypot(a.x - b.x, a.y - b.y);

export function roleOf(p: Pick<SimPlayer, 'role'>): Role {
  switch (p.role) {
    case 'TW': return 'keeper';
    case 'IV': return 'centre-back';
    case 'LV': case 'RV': case 'LAV': case 'RAV': return 'full-back';
    case 'ZDM': return 'holding';
    case 'ZM': return 'midfield';
    case 'ZOM': return 'attacking-mid';
    case 'LM': case 'RM': case 'LF': case 'RF': return 'wide';
    default: return 'striker';
  }
}

/** +1 when the side attacks the goal at x = 105. */
export const attackDirection = (c: SimCheckpoint, side: SimPlayer['side']) => side === 'club' ? c.direction : -c.direction;
/** Distance from the side's own goal line toward the goal it attacks (0 to 105). */
export const progressOf = (c: SimCheckpoint, side: SimPlayer['side'], x: number) => attackDirection(c, side) > 0 ? x : PITCH.length - x;
export const xFromProgress = (c: SimCheckpoint, side: SimPlayer['side'], progress: number) => attackDirection(c, side) > 0 ? progress : PITCH.length - progress;
export const attackedGoal = (c: SimCheckpoint, side: SimPlayer['side']): SimPoint => ({ x: attackDirection(c, side) > 0 ? PITCH.length : 0, y: PITCH.goalY });
export const insidePitch = (p: SimPoint, margin = 1): SimPoint => ({ x: clamp(p.x, margin, PITCH.length - margin), y: clamp(p.y, margin, PITCH.width - margin) });
export const inBox = (c: SimCheckpoint, side: SimPlayer['side'], p: SimPoint) => progressOf(c, side, p.x) >= PITCH.length - PITCH.boxDepth && Math.abs(p.y - PITCH.goalY) <= PITCH.boxHalf;

/** Running speed on screen in metres per second, from pace and remaining fitness. */
export function runSpeed(p: SimPlayer) {
  const base = 4.2 + p.pace * .04;
  return base * (.7 + .3 * clamp(p.fitness, 0, 100) / 100) * (roleOf(p) === 'keeper' ? .75 : 1);
}

/** How strongly opponents press a point: 1 per opponent standing on it, fading out at 14 m. */
export function pressureAt(players: readonly SimPlayer[], side: SimPlayer['side'], at: SimPoint) {
  return players.reduce((n, q) => q.active && q.side !== side ? n + Math.max(0, 1 - dist(q, at) / 14) : n, 0);
}
function nearestDistance(players: readonly SimPlayer[], side: SimPlayer['side'], at: SimPoint) {
  let best = Infinity;
  for (const q of players) if (q.active && q.side !== side) best = Math.min(best, dist(q, at));
  return best;
}
/** Progress of the second last opponent (usually the last outfield defender): the offside line. */
export function offsideLine(c: SimCheckpoint, attackingSide: SimPlayer['side']) {
  const depths = c.players.filter(q => q.active && q.side !== attackingSide).map(q => progressOf(c, attackingSide, q.x)).sort((a, b) => b - a);
  return Math.max(PITCH.length / 2, depths[1] ?? PITCH.length / 2);
}

/** Chance of scoring from a point from geometry alone: distance and visible goal mouth. */
export function goalGeometry(c: SimCheckpoint, side: SimPlayer['side'], from: SimPoint) {
  const goal = attackedGoal(c, side), dx = Math.max(.5, Math.abs(goal.x - from.x)), dy = Math.abs(from.y - goal.y), d = Math.hypot(dx, dy);
  const angle = Math.atan2(2 * PITCH.postHalf * dx, dx * dx + dy * dy - PITCH.postHalf ** 2), central = Math.atan2(2 * PITCH.postHalf * d, d * d - PITCH.postHalf ** 2);
  return (1.1 * Math.exp(-d / 8) + .025) * clamp(angle / Math.max(.0001, central), .15, 1) * clamp(angle / .45, .25, 1);
}
/** Threat of having the ball at a point, for the attacking side (roughly 0 to 0.5): territory plus
 * the scoring chance from there, so the byline is worth little and the zone in front of goal a lot. */
export function positionValue(c: SimCheckpoint, side: SimPlayer['side'], at: SimPoint) {
  return .02 + .24 * Math.min(1, progressOf(c, side, at.x) / 88) ** 1.6 + 1.6 * goalGeometry(c, side, at);
}
/** Cost of losing the ball at a point: highest in front of the own goal. */
export function turnoverCost(c: SimCheckpoint, side: SimPlayer['side'], at: SimPoint) {
  return .06 + .2 * (1 - progressOf(c, side, at.x) / PITCH.length);
}

/** Expected goal probability of a shot from a point (about 0.3 from the penalty spot). */
export function shotQuality(c: SimCheckpoint, shooter: SimPlayer, from: SimPoint = shooter) {
  const goal = attackedGoal(c, shooter.side);
  let q = goalGeometry(c, shooter.side, from);
  for (const q2 of c.players) {
    if (!q2.active || q2.side === shooter.side || roleOf(q2) === 'keeper') continue;
    const t = projection(from, goal, q2);
    if (t > 0 && t < 1 && dist(q2, lerp(from, goal, t)) < 1.4 && dist(q2, from) < 9) q *= .84;
    if (dist(q2, from) < 1.8) q *= .88;
  }
  const keeper = c.players.find(p => p.active && p.side !== shooter.side && roleOf(p) === 'keeper');
  q *= (.72 + shooter.shooting / 160) * (.8 + shooter.fitness / 500) * (keeper ? 1.38 - keeper.keeping / 280 : 1.5);
  return clamp(q, .008, .82);
}

export const lerp = (a: SimPoint, b: SimPoint, t: number): SimPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
/** Position of the closest point to `p` along the segment a to b, as a fraction of the segment. */
export function projection(a: SimPoint, b: SimPoint, p: SimPoint) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  return l2 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1) : 0;
}

export const PASS_SPEED: Record<PassStyle, number> = { short: 15, progressive: 17, through: 17, long: 21, cross: 19, clearance: 23 };
/** Seconds on screen until the ball reaches a fraction of its path. */
export const flightSeconds = (distance: number, style: PassStyle) => .3 + distance / PASS_SPEED[style];

export type LaneThreat = { player: SimPlayer; risk: number; point: SimPoint };
/** Opponents who can reach the ball path before the ball passes them. */
export function laneThreats(c: SimCheckpoint, side: SimPlayer['side'], from: SimPoint, to: SimPoint, style: PassStyle) {
  const threats: LaneThreat[] = [];
  const d = dist(from, to);
  for (const q of c.players) {
    if (!q.active || q.side === side) continue;
    if (roleOf(q) === 'keeper' && !inBox(c, q.side === 'club' ? 'opponent' : 'club', to) && style !== 'through') continue;
    const t = projection(from, to, q), point = lerp(from, to, t), lateral = dist(q, point);
    // Lofted balls can only be won near their landing point.
    if ((style === 'long' || style === 'cross' || style === 'clearance') && t < .8) continue;
    // Interception uses real football time (a ground pass covers about 18 m per second), not screen time.
    const reach = 1 + runSpeed(q) * .5 * (d * t) / 18;
    if (lateral < reach) threats.push({ player: q, risk: clamp((reach - lateral) / reach, 0, 1) * (.65 + q.defending / 280), point });
  }
  return threats;
}

function laneSafety(threats: readonly LaneThreat[]) { return threats.reduce((n, t) => n * (1 - t.risk * .55), 1); }

// Success of one play in the compressed match (each play stands for a short passing sequence).
const PASS_BASE: Record<PassStyle, number> = { short: .86, progressive: .78, through: .66, long: .6, cross: .56, clearance: .5 };

export function evaluatePass(c: SimCheckpoint, carrier: SimPlayer, target: SimPlayer, setPiece?: SetPiece): Extract<CarrierOption, { kind: 'pass' }> | null {
  const dir = attackDirection(c, carrier.side), ballProg = progressOf(c, carrier.side, c.ball.x), targetProg = progressOf(c, carrier.side, target.x);
  const targetRole = roleOf(target);
  let point: SimPoint = { x: target.x, y: target.y }, style: PassStyle = 'short';
  const wide = Math.abs(c.ball.y - PITCH.goalY) > 14 && ballProg > 74;
  const line = offsideLine(c, carrier.side);
  if (setPiece === 'corner' || (wide && inBox(c, carrier.side, target) && targetRole !== 'keeper')) {
    style = 'cross';
    point = insidePitch({ x: target.x + dir * .8, y: target.y + (PITCH.goalY - target.y) * .2 });
  } else if (['striker', 'wide', 'attacking-mid'].includes(targetRole) && targetProg > ballProg + 4 && targetProg > line - 4 && targetProg < PITCH.length - 9 && setPiece !== 'throw-in') {
    style = 'through';
    point = insidePitch({ x: xFromProgress(c, carrier.side, Math.min(PITCH.length - 7, Math.max(targetProg, line) + 6)), y: target.y + (PITCH.goalY - target.y) * .15 }, 2);
  }
  const d = dist(c.ball, point);
  if (style === 'short' && d > 30) style = 'long';
  else if (style === 'short' && progressOf(c, carrier.side, point.x) - ballProg > 9) style = 'progressive';
  if (setPiece === 'throw-in' && d > 26) return null;
  if (d < 3 || d > (roleOf(carrier) === 'keeper' ? 62 : 52)) return null;
  // Offside: a receiver beyond the line when the ball is played (through balls go behind it in time).
  const offside = setPiece !== 'throw-in' && setPiece !== 'goal-kick' && setPiece !== 'corner' && targetProg > Math.max(line, ballProg) + .5 && targetProg > PITCH.length / 2;
  const threats = laneThreats(c, carrier.side, c.ball, point, style);
  // Near goal, attackers' late movement and body feints win the half metre the coarse
  // positions cannot show, so lanes and receivers there are a little less covered.
  const separation = progressOf(c, carrier.side, point.x) > 68 ? .45 : 1;
  const lane = 1 - (1 - laneSafety(threats)) * separation;
  const receiverPressure = c.players.filter(q => q.active && q.side !== carrier.side && dist(q, point) < 3.5).length * separation;
  // A receiver who cannot reach the ball in time makes the pass far less likely to arrive.
  const reachable = dist(target, point) <= runSpeed(target) * flightSeconds(d, style) * 1.2 + 1;
  const passerPressure = setPiece ? 0 : pressureAt(c.players, carrier.side, carrier);
  const success = offside ? .04 : clamp((PASS_BASE[style] + (carrier.passing - 75) * .003 - Math.max(0, d - 16) * .005) * lane * (1 - receiverPressure * .1) * (1 - passerPressure * .07) * (reachable ? 1 : .45), .05, .95);
  const space = Math.min(9, nearestDistance(c.players, carrier.side, point));
  // A cut-back from the byline to a team mate in front of goal is one of the best chances in football.
  const cutBack = ballProg > 86 && Math.abs(c.ball.y - PITCH.goalY) > 8 && Math.abs(point.y - PITCH.goalY) < 9 && progressOf(c, carrier.side, point.x) > 80 ? .06 : 0;
  const value = positionValue(c, carrier.side, point) + space * .006 + cutBack + (inBox(c, carrier.side, point) ? .08 : 0) + (targetRole === 'keeper' ? -.03 : 0);
  // Players look for progress: square and backward balls only win when nothing better is on,
  // and less so the longer the team has kept the ball without getting anywhere.
  const gain = progressOf(c, carrier.side, point.x) - ballProg, urgency = Math.max(0, c.chain - 2) * .015;
  const utility = success * (value + gain * .003) - (1 - success) * turnoverCost(c, carrier.side, c.ball) - (style === 'cross' ? .01 : 0) - (gain < 3 ? urgency : 0);
  return { kind: 'pass', style, target, point, utility, success, lane, distance: d, offside };
}

/** Candidate dribbles into the space ahead, scored by gained threat and the chance to keep the ball. */
export function evaluateCarries(c: SimCheckpoint, carrier: SimPlayer): Extract<CarrierOption, { kind: 'carry' }>[] {
  const dir = attackDirection(c, carrier.side), result: Extract<CarrierOption, { kind: 'carry' }>[] = [];
  const pressure = pressureAt(c.players, carrier.side, carrier);
  for (const angle of [0, -.5, .5, -1.05, 1.05]) {
    const length = 7 + Math.min(8, nearestDistance(c.players, carrier.side, carrier)) * .7;
    const point = insidePitch({ x: carrier.x + Math.cos(angle) * length * dir, y: carrier.y + Math.sin(angle) * length }, 2);
    if (dist(point, carrier) < 3) continue;
    let challenger: SimPlayer | undefined, closest = Infinity;
    for (const q of c.players) {
      if (!q.active || q.side === carrier.side || roleOf(q) === 'keeper') continue;
      const t = projection(carrier, point, q), lateral = dist(q, lerp(carrier, point, t));
      if (lateral < 3.4 && lateral < closest) { closest = lateral; challenger = q; }
    }
    const duel = challenger ? 1 / (1 + Math.exp(-((carrier.control - challenger.defending) / 12 + .35))) : 1;
    const success = clamp(duel * (1 - pressure * .1) + (carrier.control - 75) * .002, .2, .93);
    const space = Math.min(9, nearestDistance(c.players, carrier.side, point));
    const gain = progressOf(c, carrier.side, point.x) - progressOf(c, carrier.side, carrier.x);
    const utility = success * (positionValue(c, carrier.side, point) + space * .005 + gain * .003 + (inBox(c, carrier.side, point) ? .06 : 0)) - (1 - success) * turnoverCost(c, carrier.side, carrier) + (pressure < .35 ? .008 : -.01);
    result.push({ kind: 'carry', point, utility, success, challenger });
  }
  return result;
}

export function carrierOptions(c: SimCheckpoint, carrier: SimPlayer, setPiece?: SetPiece): CarrierOption[] {
  const role = roleOf(carrier), mates = c.players.filter(p => p.active && p.side === carrier.side && p.id !== carrier.id);
  const options: CarrierOption[] = [];
  if (setPiece === 'penalty') return [{ kind: 'shot', point: attackedGoal(c, carrier.side), utility: 1, quality: .76 }];
  const prog = progressOf(c, carrier.side, carrier.x);
  if (role !== 'keeper' && setPiece !== 'throw-in' && setPiece !== 'corner' && setPiece !== 'goal-kick' && prog > 62) {
    const quality = setPiece === 'free-kick' ? Math.min(.09, shotQuality(c, carrier) * .45) : shotQuality(c, carrier);
    // Shooting is tempting close to goal; long shots are possible but rarely the best choice.
    // Shooting needs a real chance: speculative efforts from distance are rarely worth the ball.
    if (quality >= .03 || setPiece === 'free-kick') options.push({ kind: 'shot', point: attackedGoal(c, carrier.side), quality, utility: quality * 8 - .035 });
  }
  for (const mate of mates) { const pass = evaluatePass(c, carrier, mate, setPiece); if (pass) options.push(pass); }
  if (!setPiece && role !== 'keeper') options.push(...evaluateCarries(c, carrier));
  if (!options.length) options.push({ kind: 'hold', point: { ...carrier }, utility: 0 });
  return options;
}

/** Decision noise: strong players pick the best option more often (softmax temperature). */
export function decisionTemperature(p: SimPlayer) {
  const rating = (p.rating * 2 + p.passing + p.control) / 4;
  return clamp(.012 + (96 - rating) * .0009, .012, .05);
}

export function chooseOption(options: readonly CarrierOption[], temperature: number, roll: number) {
  const best = Math.max(...options.map(o => o.utility));
  const weights = options.map(o => Math.exp((o.utility - best) / temperature));
  let n = roll * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) { n -= weights[i]; if (n <= 0) return options[i]; }
  return options[options.length - 1];
}

// Off-ball positioning -----------------------------------------------------------------------

type Shape = { min: number; max: number };
const SHAPE: Record<Role, { attack: Shape; defend: Shape }> = {
  keeper: { attack: { min: 1, max: 14 }, defend: { min: 1, max: 6 } },
  'centre-back': { attack: { min: 8, max: 57 }, defend: { min: 5, max: 40 } },
  'full-back': { attack: { min: 10, max: 85 }, defend: { min: 5, max: 44 } },
  holding: { attack: { min: 18, max: 70 }, defend: { min: 10, max: 52 } },
  midfield: { attack: { min: 22, max: 86 }, defend: { min: 14, max: 58 } },
  'attacking-mid': { attack: { min: 30, max: 92 }, defend: { min: 22, max: 64 } },
  wide: { attack: { min: 30, max: 97 }, defend: { min: 18, max: 66 } },
  striker: { attack: { min: 38, max: 98 }, defend: { min: 34, max: 70 } },
};

/** Target position of every active player for the coming action. `fixed` players (ball carrier,
 * receiver) are positioned by the action itself. */
export function shapeTargets(c: SimCheckpoint, carrier: SimPlayer, fixed: ReadonlySet<string>): Map<string, SimPoint> {
  const targets = new Map<string, SimPoint>(), att = carrier.side;
  const ball = c.ball;
  for (const side of ['club', 'opponent'] as const) {
    const attacking = side === att, ballProg = progressOf(c, side, ball.x);
    const shift = attacking ? clamp((ballProg - 35) * .75, -4, 38) : clamp((ballProg - 55) * .45, -20, 5);
    const pull = attacking ? .2 : .26;
    for (const p of c.players) {
      if (!p.active || p.side !== side || fixed.has(p.id)) continue;
      const role = roleOf(p), band = attacking ? SHAPE[role].attack : SHAPE[role].defend;
      if (role === 'keeper') {
        const prog = attacking ? clamp(2 + ballProg * .11, 2, 13) : clamp(2.2 + (ballProg > 55 ? 2 : 0) - (ballProg < 18 ? 1 : 0), 1.2, 5.5);
        targets.set(p.id, { x: xFromProgress(c, side, prog), y: clamp(PITCH.goalY + (ball.y - PITCH.goalY) * (ballProg < 30 ? .28 : .12), PITCH.goalY - 4.5, PITCH.goalY + 4.5) });
        continue;
      }
      let prog = clamp(progressOf(c, side, p.anchor.x) + shift, band.min, band.max);
      let y = p.anchor.y + (ball.y - p.anchor.y) * pull;
      if (attacking && (role === 'wide' || role === 'full-back')) y += Math.sign(p.anchor.y - PITCH.goalY) * 6;
      // Forwards stay level with the last defender, so a through ball is onside.
      if (attacking && ['striker', 'wide', 'attacking-mid'].includes(role)) prog = Math.min(prog, Math.max(offsideLine(c, side) - .6, progressOf(c, side, ball.x)));
      targets.set(p.id, insidePitch({ x: xFromProgress(c, side, prog), y }, 1.5));
    }
  }
  // Attack: the two nearest team mates offer a passing option in open space.
  const mates = c.players.filter(p => p.active && p.side === att && p.id !== carrier.id && !fixed.has(p.id) && roleOf(p) !== 'keeper').sort((a, b) => dist(a, carrier) - dist(b, carrier));
  const dir = attackDirection(c, att), taken: SimPoint[] = [];
  for (const supporter of mates.slice(0, 2)) {
    let best: SimPoint | undefined, score = -Infinity;
    for (const angle of [-1.2, -.6, 0, .6, 1.2, 2.3, -2.3]) {
      const spot = insidePitch({ x: carrier.x + Math.cos(angle) * 13 * dir, y: carrier.y + Math.sin(angle) * 13 }, 2.5);
      if (taken.some(t => dist(t, spot) < 7)) continue;
      // Open space that is also dangerous: in the final third that means central, in front of goal.
      const s = Math.min(9, nearestDistance(c.players, att, spot)) * .6 + positionValue(c, att, spot) * 30 + (progressOf(c, att, spot.x) - progressOf(c, att, carrier.x)) * .06 - dist(supporter, spot) * .18;
      if (s > score) { score = s; best = spot; }
    }
    if (best) { taken.push(best); targets.set(supporter.id, best); }
  }
  // Attack: the most advanced forward runs along the offside line into the biggest gap.
  const runner = c.players.filter(p => p.active && p.side === att && !fixed.has(p.id) && ['striker', 'wide'].includes(roleOf(p))).sort((a, b) => progressOf(c, att, b.x) - progressOf(c, att, a.x))[0];
  if (runner && progressOf(c, att, ball.x) > 38) {
    const line = offsideLine(c, att), defenders = c.players.filter(q => q.active && q.side !== att).map(q => q.y).sort((a, b) => a - b);
    let gapY = runner.y, gap = 0;
    for (let i = 0; i <= defenders.length; i++) {
      const a = defenders[i - 1] ?? 4, b = defenders[i] ?? 64, mid = (a + b) / 2;
      if (b - a > gap && Math.abs(mid - runner.y) < 20) { gap = b - a; gapY = mid; }
    }
    targets.set(runner.id, insidePitch({ x: xFromProgress(c, att, Math.min(PITCH.length - 8, line - .6)), y: gapY }, 2));
  }
  // Defence: one presser closes the carrier down, one covers behind; markers stay goal side.
  const defenders = c.players.filter(p => p.active && p.side !== att && roleOf(p) !== 'keeper' && !fixed.has(p.id)).sort((a, b) => dist(a, carrier) - dist(b, carrier));
  const ownGoal = attackedGoal(c, att);
  const [presser, cover] = defenders;
  if (presser) { const toGoal = dist(carrier, ownGoal) || 1; targets.set(presser.id, insidePitch({ x: carrier.x + (ownGoal.x - carrier.x) / toGoal * 1.6, y: carrier.y + (ownGoal.y - carrier.y) / toGoal * 1.6 })); }
  if (cover) targets.set(cover.id, insidePitch(lerp(carrier, ownGoal, clamp(7 / (dist(carrier, ownGoal) || 1), 0, .6))));
  const marked = new Set<string>();
  for (const marker of defenders.slice(2)) {
    const role = roleOf(marker);
    if (!['centre-back', 'full-back', 'holding'].includes(role)) continue;
    const home = targets.get(marker.id) ?? marker;
    const threat = c.players.filter(q => q.active && q.side === att && q.id !== carrier.id && !marked.has(q.id) && roleOf(q) !== 'keeper' && progressOf(c, att, q.x) > 48 && dist(q, home) < 15).sort((a, b) => dist(a, home) - dist(b, home))[0];
    if (!threat) continue;
    marked.add(threat.id);
    const toGoal = dist(threat, ownGoal) || 1;
    targets.set(marker.id, insidePitch({ x: threat.x + (ownGoal.x - threat.x) / toGoal * 1.8, y: threat.y + (ownGoal.y - threat.y) / toGoal * 1.8 }));
  }
  return targets;
}

/** Moves players toward their targets within their running range and keeps them apart. */
export function movePlayersToward(c: SimCheckpoint, targets: ReadonlyMap<string, SimPoint>, visualSeconds: number, fixed: ReadonlySet<string>) {
  const start = new Map(c.players.map((p) => [p.id, { x: p.x, y: p.y }]));
  for (const p of c.players) {
    if (!p.active || fixed.has(p.id)) continue;
    const target = targets.get(p.id);
    if (!target) continue;
    const d = dist(p, target), step = Math.min(d, runSpeed(p) * visualSeconds);
    if (d > 0) { p.x += (target.x - p.x) / d * step; p.y += (target.y - p.y) / d * step; }
  }
  // Keep a little distance between bodies; fixed players are never pushed.
  for (let pass = 0; pass < 2; pass++) for (const p of c.players) {
    if (!p.active || fixed.has(p.id)) continue;
    for (const q of c.players) {
      if (!q.active || q.id === p.id) continue;
      const d = dist(p, q);
      if (d > 0 && d < 1.7) { p.x += (p.x - q.x) / d * (1.7 - d) * .5; p.y += (p.y - q.y) / d * (1.7 - d) * .5; }
    }
    const inside = insidePitch(p, 1.2);
    p.x = inside.x; p.y = inside.y;
  }
  // Making room never outruns a player: in a short play (just before a whistle) bodies may stay close instead.
  for (const p of c.players) {
    const from = start.get(p.id);
    if (!from || !p.active || fixed.has(p.id)) continue;
    const moved = dist(from, p), limit = runSpeed(p) * visualSeconds;
    if (moved > limit) { p.x = from.x + (p.x - from.x) * limit / moved; p.y = from.y + (p.y - from.y) * limit / moved; }
  }
}
