// Purely visual stadium layer for the 2D match: stands with fans, time of day and weather.
// Nothing here changes scores, events, fitness or the match clock.
import type { CupState } from './feature-data';
import type { FrameCelebration } from './interactive-frame-data';
import type { StadiumProfile, StandType } from './stadium-profiles';

export type AmbienceTime = 'day' | 'dusk' | 'night';
export type AmbienceWeather = 'clear' | 'cloudy' | 'rain' | 'snow';
export type Ambience = { time: AmbienceTime; weather: AmbienceWeather; seed: number; fanMood: number; venue: 'home' | 'away' | 'neutral'; stadium?: StadiumProfile };

const BORDER = { left: -4, top: -4, right: 109, bottom: 72 };
const SEAT = 1.25;

function hash(n: number) {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function zurichClock(at: number) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', month: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(at));
  return { hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 12), month: Number(parts.find((p) => p.type === 'month')?.value ?? 6) };
}

export function computeAmbience(cup: Pick<CupState, 'matchStartedAt' | 'fixture' | 'careerMatchId' | 'opponent'>, fanMood = 60, seedHint?: number, stadium?: StadiumProfile): Ambience {
  const startedAt = cup.matchStartedAt || Date.now();
  const venue = cup.fixture?.venue;
  const { hour: zurichHour, month: zurichMonth } = zurichClock(startedAt);
  // Local time at the venue, approximated from its longitude relative to Bern.
  const offset = venue && Number.isFinite(venue.lon) ? Math.round((venue.lon - 7.4) / 15) : 0;
  const hour = ((zurichHour + offset) % 24 + 24) % 24;
  const month = venue && venue.lat < 0 ? ((zurichMonth + 5) % 12) + 1 : zurichMonth;
  const winter = month === 12 || month <= 2, summer = month >= 6 && month <= 8;
  const time: AmbienceTime = hour >= 21 || hour < 6 || (winter && hour >= 18) ? 'night' : hour >= 18 || hour < 8 || (winter && hour >= 16) ? 'dusk' : 'day';
  let seed = seedHint ?? 0;
  if (!seed) for (const c of `${cup.careerMatchId ?? ''}:${startedAt}:${cup.opponent}`) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const roll = hash(seed) * 100;
  const weather: AmbienceWeather = winter
    ? roll < 40 ? 'clear' : roll < 65 ? 'cloudy' : roll < 75 ? 'rain' : 'snow'
    : summer
      ? roll < 65 ? 'clear' : roll < 85 ? 'cloudy' : 'rain'
      : roll < 45 ? 'clear' : roll < 70 ? 'cloudy' : 'rain';
  return { time, weather, seed: seed >>> 0, fanMood: Math.max(0, Math.min(100, fanMood)), venue: cup.fixture?.neutral ? 'neutral' : cup.fixture?.away ? 'away' : 'home', stadium };
}

export function ambienceLabel(a: Ambience) {
  const time = a.time === 'night' ? 'Flutlicht' : a.time === 'dusk' ? 'Abenddämmerung' : 'Tageslicht';
  const weather = a.weather === 'rain' ? 'Regen' : a.weather === 'snow' ? 'Schneefall' : a.weather === 'cloudy' ? 'bewölkt' : 'klar';
  return `${time} · ${weather}`;
}

function visibleWorld(ctx: CanvasRenderingContext2D) {
  const m = ctx.getTransform(), w = ctx.canvas.width, h = ctx.canvas.height;
  if (!m.a || !m.d) return { left: -20, top: -12, right: 125, bottom: 80 };
  return { left: (0 - m.e) / m.a, top: (0 - m.f) / m.d, right: (w - m.e) / m.a, bottom: (h - m.f) / m.d };
}

function shade(hex: string, amount: number) {
  const value = /^#([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!value) return hex;
  const n = parseInt(value, 16), f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amount * (amount > 0 ? 255 - c : c))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Matches saved before stadium profiles keep the former look: a medium stadium all around. */
const FALLBACK: Pick<StadiumProfile, 'category' | 'stands' | 'tiers' | 'roof' | 'floodlights' | 'boards' | 'capacity' | 'attendance' | 'signature'> = { category: 'pro-medium', stands: { top: 'stand', bottom: 'stand', left: 'stand', right: 'stand' }, tiers: 1, roof: false, floodlights: 'masts', boards: true, capacity: 20000, attendance: 13000 };
type StadiumShape = Pick<StadiumProfile, 'category' | 'stands'>;
const profileOf = (a: Ambience) => a.stadium ?? FALLBACK;

type Side = 'top' | 'bottom' | 'left' | 'right';
const SIDES: Side[] = ['top', 'bottom', 'left', 'right'];
function sideAt(x: number, y: number): Side | null {
  if (y < BORDER.top) return x < BORDER.left || x > BORDER.right ? null : 'top';
  if (y > BORDER.bottom) return x < BORDER.left || x > BORDER.right ? null : 'bottom';
  if (x < BORDER.left) return 'left';
  if (x > BORDER.right) return 'right';
  return null;
}
/** Metres from the pitch-side border outward, for a point outside the run-off. */
function depthAt(x: number, y: number) {
  return Math.max(BORDER.top - y, y - BORDER.bottom, BORDER.left - x, x - BORDER.right);
}
const SEATED = new Set<StandType>(['stand', 'covered', 'tiered']);
const isBowl = (p: StadiumShape) => p.category === 'elite' || p.category === 'national';

/** Depth of the stands in metres. Rows are drawn wider apart than in reality so that the whole
 * ground fits on screen next to a readable pitch. */
const STAND_DEPTH: Record<StadiumProfile['category'], number> = { amateur: 3, regional: 5, 'pro-small': 7, 'pro-medium': 9, national: 11.5, elite: 14 };
function sideDepth(p: StadiumShape, side: Side) {
  const type = p.stands[side];
  if (type === 'none') return 3;
  if (type === 'terrace') return Math.min(4.5, STAND_DEPTH[p.category]);
  return STAND_DEPTH[p.category] * (type === 'stand' ? .8 : 1);
}

/** Outer edge of the stadium in world metres. */
export function stadiumBounds(profile?: StadiumShape) {
  const p = profile ?? FALLBACK;
  return { left: BORDER.left - sideDepth(p, 'left'), top: BORDER.top - sideDepth(p, 'top'), right: BORDER.right + sideDepth(p, 'right'), bottom: BORDER.bottom + sideDepth(p, 'bottom') };
}

/** World units shown by the full camera: the whole stadium with a narrow margin. */
export function stadiumView(profile?: StadiumShape) {
  const b = stadiumBounds(profile), margin = 1.5;
  return { width: b.right - b.left + margin * 2, height: b.bottom - b.top + margin * 2, centerX: (b.left + b.right) / 2, centerY: (b.top + b.bottom) / 2 };
}
/** The view of matches saved before stadium profiles. */
export const STADIUM_VIEW = stadiumView();

/** Day of the week at the venue (0 Sunday), for the crowd. */
export function venueWeekday(cup: Pick<CupState, 'matchStartedAt' | 'fixture'>) {
  const at = cup.matchStartedAt || Date.now(), lon = cup.fixture?.venue?.lon;
  const offset = Number.isFinite(lon) ? Math.round(((lon as number) - 7.4) / 15) : 0;
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', weekday: 'short' }).format(new Date(at + offset * 3600000));
  return Math.max(0, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day));
}

/** Floodlight positions for the stadium type. */
export function floodlightPositions(ambience: Ambience): [number, number][] {
  const p = profileOf(ambience), b = stadiumBounds(p);
  if (p.floodlights === 'poles') {
    const top = Math.max(b.top + .6, BORDER.top - 2.6), bottom = Math.min(b.bottom - .6, BORDER.bottom + 2.6);
    return p.category === 'amateur' ? [[8, top], [97, top], [8, bottom], [97, bottom]] : [[8, top], [52.5, top], [97, top], [8, bottom], [52.5, bottom], [97, bottom]];
  }
  if (p.floodlights === 'roof') return [10, 35, 70, 95].flatMap((x): [number, number][] => [[x, b.top + .7], [x, b.bottom - .7]]);
  return [[b.left + 1.2, b.top + 1.2], [b.right - 1.2, b.top + 1.2], [b.left + 1.2, b.bottom - 1.2], [b.right - 1.2, b.bottom - 1.2]];
}

type Spot = { x: number; y: number; kind: 'seat' | 'standing' | 'rail'; away: boolean; score: number };
type Crowd = { seats: Spot[]; fans: (Spot & { team: 'home' | 'away'; tone: number })[] };
const crowdCache = new Map<string, Crowd>();

/**
 * Every seat and standing place of the ground, and who is in it. The share of filled places is the
 * attendance against the capacity. People fill the places near the pitch, the main stand and the home
 * end first, and some blocks stay emptier than others, so a half-empty ground looks like one.
 */
function stadiumCrowd(ambience: Ambience): Crowd {
  const p = profileOf(ambience), key = `${p.category}:${JSON.stringify(p.stands)}:${p.attendance}:${p.capacity}:${ambience.seed}:${ambience.venue}`;
  const cached = crowdCache.get(key);
  if (cached) return cached;
  const b = stadiumBounds(p), bowl = isBowl(p), seats: Spot[] = [];
  const pref: Record<Side, number> = { bottom: 0, left: -.04, top: .07, right: .1 };
  for (let ix = Math.ceil(b.left / SEAT); ix * SEAT < b.right - .4; ix++) {
    for (let iy = Math.ceil(b.top / SEAT); iy * SEAT < b.bottom - .4; iy++) {
      const x = ix * SEAT, y = iy * SEAT;
      if (x > BORDER.left - .7 && x < BORDER.right + .7 && y > BORDER.top - .7 && y < BORDER.bottom + .7) continue;
      const side = sideAt(x, y);
      if (!side && !bowl) continue;
      const type: StandType = side ? p.stands[side] : 'tiered', depth = depthAt(x, y);
      const max = side ? sideDepth(p, side) : Math.min(sideDepth(p, x < BORDER.left ? 'left' : 'right'), sideDepth(p, y < BORDER.top ? 'top' : 'bottom'));
      if (depth > max - .3) continue;
      if (type === 'none' && depth > 1.6) continue;
      if (type === 'terrace' && depth > max - .5) continue;
      // Stairways split seated stands into blocks; tiered stands have a walkway between the tiers.
      const behindGoal = x < BORDER.left || x > BORDER.right;
      if (SEATED.has(type) && (behindGoal ? ((iy % 9) + 9) % 9 === 0 : ((ix % 12) + 12) % 12 === 0)) continue;
      if (type === 'tiered' && Math.abs(depth - max * .5) < .6) continue;
      const along = side === 'left' || side === 'right' ? y : x, block = `${side ?? 'corner'}:${Math.floor(along / 15)}:${depth > max * .5 ? 1 : 0}`;
      let blockHash = 0; for (const c of block) blockHash = Math.imul(blockHash ^ c.charCodeAt(0), 16777619) >>> 0;
      const score = depth / max * .55 + (side ? pref[side] : .2) + hash(blockHash + ambience.seed) * .32 + hash(ix * 7919 + iy * 104729 + ambience.seed) * .3;
      const away = ambience.venue === 'neutral' ? x > 52.5 : x > BORDER.right && y > 16 && y < 52;
      seats.push({ x, y, kind: type === 'none' ? 'rail' : type === 'terrace' ? 'standing' : 'seat', away, score });
    }
  }
  const fill = Math.max(.04, Math.min(1, p.attendance / Math.max(1, p.capacity)));
  const total = Math.round(seats.length * fill), awayPlaces = seats.filter((s) => s.away).sort((a, c) => a.score - c.score);
  const awayFans = Math.min(awayPlaces.length, Math.round(total * (ambience.venue === 'neutral' ? .5 : .08)));
  const homePlaces = seats.filter((s) => !s.away).sort((a, c) => a.score - c.score);
  const fans = [...homePlaces.slice(0, total - awayFans).map((s) => ({ ...s, team: 'home' as const })), ...awayPlaces.slice(0, awayFans).map((s) => ({ ...s, team: 'away' as const }))]
    .map((s, i) => ({ ...s, tone: hash(i * 2654435761 + ambience.seed) }));
  const crowd = { seats, fans };
  if (crowdCache.size > 6) crowdCache.clear();
  crowdCache.set(key, crowd);
  return crowd;
}

/** Number of places and of people in the ground as drawn, for tests and the crowd noise. */
export function crowdSummary(ambience: Ambience) {
  const crowd = stadiumCrowd(ambience);
  return { places: crowd.seats.length, fans: crowd.fans.length, away: crowd.fans.filter((f) => f.team === 'away').length };
}

/** Stands with every seat visible: fans in their colours, empty seats in the colour of the stand.
 * Size follows the stadium profile of the venue; fans of the scoring team jump during a goal celebration. */
export function drawStands(ctx: CanvasRenderingContext2D, ambience: Ambience, colours: { club: string; opponent: string }, now: number, celebration?: FrameCelebration, animate = true) {
  const view = visibleWorld(ctx), profile = profileOf(ambience), b = stadiumBounds(profile), bowl = isBowl(profile);
  const night = ambience.time === 'night', dim = (c: string) => night ? shade(c, -.18) : c;
  const homeColour = ambience.venue === 'away' ? colours.opponent : colours.club;
  const visitorColour = ambience.venue === 'away' ? colours.club : colours.opponent;
  const open = profile.category === 'amateur' || profile.category === 'regional';
  // Surroundings, then the stand surfaces: concrete for terraces, a seat tray for seated stands.
  ctx.fillStyle = open ? (night ? '#16301f' : '#3d6b45') : night ? '#161d22' : '#262f35';
  ctx.fillRect(view.left - 1, view.top - 1, view.right - view.left + 2, view.bottom - view.top + 2);
  if (open) { ctx.fillStyle = night ? '#16301f' : '#3d6b45'; ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top); }
  const tray = night ? '#2b333d' : '#4a545f', concrete = night ? '#3a3f45' : '#6d747b';
  const seatColour = dim(shade(homeColour, homeColour.toLowerCase() === '#1d1d1f' ? .22 : -.5));
  const standRect = (side: Side): [number, number, number, number] => side === 'top' ? [BORDER.left, b.top, BORDER.right - BORDER.left, BORDER.top - b.top] : side === 'bottom' ? [BORDER.left, BORDER.bottom, BORDER.right - BORDER.left, b.bottom - BORDER.bottom] : side === 'left' ? [b.left, BORDER.top, BORDER.left - b.left, BORDER.bottom - BORDER.top] : [BORDER.right, BORDER.top, b.right - BORDER.right, BORDER.bottom - BORDER.top];
  for (const side of SIDES) {
    const type = profile.stands[side];
    if (type === 'none') continue;
    const [x, y, w, h] = standRect(side);
    ctx.fillStyle = SEATED.has(type) ? tray : concrete;
    ctx.fillRect(x, y, w, h);
  }
  if (bowl) { ctx.fillStyle = tray; for (const [x, y, w, h] of [[b.left, b.top, BORDER.left - b.left, BORDER.top - b.top], [BORDER.right, b.top, b.right - BORDER.right, BORDER.top - b.top], [b.left, BORDER.bottom, BORDER.left - b.left, b.bottom - BORDER.bottom], [BORDER.right, BORDER.bottom, b.right - BORDER.right, b.bottom - BORDER.bottom]]) ctx.fillRect(x, y, w, h); }
  const crowd = stadiumCrowd(ambience);
  // Empty seats stay visible as seats; standing places and the rail show bare concrete or grass.
  ctx.fillStyle = seatColour;
  for (const s of crowd.seats) if (s.kind === 'seat') ctx.fillRect(s.x - .34, s.y - .34, .68, .68);
  const jumping = celebration && celebration.progress < .75 ? (celebration.side === 'club' ? colours.club : colours.opponent) : undefined;
  const buckets = new Map<string, number[]>();
  const push = (colour: string, x: number, y: number) => { let list = buckets.get(colour); if (!list) { list = []; buckets.set(colour, list); } list.push(x, y); };
  const t = animate ? now / 1000 : 0;
  for (const f of crowd.fans) {
    const team = f.team === 'away' ? visitorColour : homeColour;
    // Mostly the team colour, some white and dark shirts and the lighter second colour.
    const colour = f.tone < .7 ? team : f.tone < .84 ? '#e9eef2' : f.tone < .92 ? '#22262b' : shade(team, .35);
    const own = team === jumping, phase = f.tone * 40;
    const bob = animate ? (own ? Math.abs(Math.sin(t * 9 + phase)) * .55 : Math.sin(t * 2.2 + phase) * .05 * (.6 + ambience.fanMood / 100)) : 0;
    const jitter = f.kind === 'seat' ? 0 : (hash(Math.round(f.x * 31 + f.y * 17)) - .5) * .5;
    push(own && Math.sin(t * 6 + phase) > .4 ? shade(colour, .35) : colour, f.x - .37 + jitter, f.y - .37 - bob);
  }
  for (const [colour, list] of buckets) {
    ctx.fillStyle = colour.startsWith('#') ? dim(colour) : colour;
    for (let i = 0; i < list.length; i += 2) ctx.fillRect(list[i], list[i + 1], .74, .74);
  }
  // Tiered stands: the fascia of the upper tier along the walkway.
  ctx.fillStyle = night ? 'rgba(160,170,185,.55)' : 'rgba(215,221,228,.85)';
  for (const side of SIDES) {
    if (profile.stands[side] !== 'tiered') continue;
    const d = sideDepth(profile, side) * .5;
    if (side === 'top') ctx.fillRect(bowl ? b.left : BORDER.left, BORDER.top - d - .11, (bowl ? b.right - b.left : BORDER.right - BORDER.left), .22);
    if (side === 'bottom') ctx.fillRect(bowl ? b.left : BORDER.left, BORDER.bottom + d - .11, (bowl ? b.right - b.left : BORDER.right - BORDER.left), .22);
    if (side === 'left') ctx.fillRect(BORDER.left - d - .11, bowl ? b.top : BORDER.top, .22, bowl ? b.bottom - b.top : BORDER.bottom - BORDER.top);
    if (side === 'right') ctx.fillRect(BORDER.right + d - .11, bowl ? b.top : BORDER.top, .22, bowl ? b.bottom - b.top : BORDER.bottom - BORDER.top);
  }
  // The outer wall closes the stands.
  if (!open) {
    ctx.strokeStyle = profile.signature === 'allianz' && night ? 'rgba(230,40,55,.9)' : night ? 'rgba(150,160,172,.7)' : 'rgba(222,228,234,.9)';
    ctx.lineWidth = .45;
    if (bowl) ctx.strokeRect(b.left + .22, b.top + .22, b.right - b.left - .44, b.bottom - b.top - .44);
    else for (const side of SIDES) { if (profile.stands[side] === 'none') continue; const [x, y, w, h] = standRect(side); ctx.strokeRect(x + .22, y + .22, w - .44, h - .44); }
  }
  if (profile.signature === 'san-siro') {
    // San Siro: the cylindrical ramp towers at the corners.
    for (const [x, y] of [[b.left + 2.6, b.top + 2.6], [b.right - 2.6, b.top + 2.6], [b.left + 2.6, b.bottom - 2.6], [b.right - 2.6, b.bottom - 2.6]]) {
      ctx.fillStyle = night ? '#2a2f36' : '#8d949b'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(200,32,40,.85)'; ctx.lineWidth = .35; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 1.6); ctx.stroke();
    }
  }
  if (profile.signature === 'wembley') { ctx.strokeStyle = night ? 'rgba(255,255,255,.75)' : '#ffffff'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(b.left + 3, b.top + 2.5); ctx.quadraticCurveTo(52.5, b.top - 3, b.right - 3, b.top + 2.5); ctx.stroke(); }
  if (profile.stands.top === 'none' || profile.stands.left === 'none') {
    // Open grounds: a fence and a few trees.
    ctx.fillStyle = night ? '#0f2416' : '#2a5232';
    if (profile.stands.top === 'none') for (let i = 0; i < 9; i++) { const x = -8 + i * 15 + hash(ambience.seed + i) * 5, y = b.top + .4 + hash(i * 13) * .8; ctx.beginPath(); ctx.arc(x, y, 1.3 + hash(i) * .6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = night ? '#5b6168' : '#c9cfd4';
    if (profile.stands.top === 'none') ctx.fillRect(BORDER.left - .3, BORDER.top - .55, BORDER.right - BORDER.left + .6, .14);
    if (profile.stands.left === 'none') ctx.fillRect(BORDER.left - .55, BORDER.top - .3, .14, BORDER.bottom - BORDER.top + .6);
    if (profile.stands.right === 'none') ctx.fillRect(BORDER.right + .41, BORDER.top - .3, .14, BORDER.bottom - BORDER.top + .6);
  }
  // Floodlights: poles on small grounds, corner masts, or lights along the top of the stands.
  for (const [x, y] of floodlightPositions(ambience)) {
    const size = profile.floodlights === 'poles' ? .7 : profile.floodlights === 'roof' ? .55 : 1.2;
    ctx.fillStyle = '#9aa4ad'; ctx.fillRect(x - size / 2, y - size / 2, size, size);
    if (ambience.time !== 'day') { ctx.fillStyle = 'rgba(255,248,214,.9)'; ctx.fillRect(x - size * .38, y - size * .38, size * .76, size * .76); }
  }
}

const BOARD_COLOURS = ['#0b5cad', '#e30613', '#f2c200', '#1d1d1f', '#0a8f5a', '#ff6a00'];
/** Advertising boards, dugouts, technical areas and the tunnel: drawn on the run-off after the pitch. */
export function drawPitchside(ctx: CanvasRenderingContext2D, ambience: Ambience) {
  const p = profileOf(ambience), night = ambience.time === 'night';
  if (p.boards) {
    const segment = p.category === 'regional' ? 9 : 6;
    let i = Math.floor(ambience.seed % BOARD_COLOURS.length);
    for (let x = 1; x < 104; x += segment) {
      const w = Math.min(segment - .3, 104 - x);
      ctx.fillStyle = BOARD_COLOURS[i++ % BOARD_COLOURS.length];
      ctx.fillRect(x, -2.3, w, .75);
      if (x + w < 36 || x > 69) ctx.fillRect(x, 70.2, w, .75);
    }
    for (const x of [-2.4, 106.6]) for (let y = 4; y < 64; y += segment) { if (y > 26 && y < 42) continue; ctx.fillStyle = BOARD_COLOURS[i++ % BOARD_COLOURS.length]; ctx.fillRect(x, y, .75, Math.min(segment - .3, 64 - y)); }
  } else {
    ctx.fillStyle = night ? 'rgba(200,205,210,.35)' : 'rgba(235,238,240,.75)';
    ctx.fillRect(-1.6, -1.6, 108.2, .12); ctx.fillRect(-1.6, 69.5, 108.2, .12);
  }
  // Technical areas and benches in front of the main stand, the tunnel between them.
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = .14; ctx.setLineDash([.6, .5]);
  ctx.strokeRect(38, 68.5, 8, 1.6); ctx.strokeRect(59, 68.5, 8, 1.6); ctx.setLineDash([]);
  for (const x of [38.5, 59.5]) {
    ctx.fillStyle = p.category === 'amateur' ? (night ? '#4b3b2a' : '#8a6a46') : night ? '#202834' : '#3b4656';
    ctx.fillRect(x, 70.3, 7, p.category === 'amateur' ? .6 : 1.4);
    if (p.category !== 'amateur') { ctx.fillStyle = 'rgba(190,220,240,.35)'; ctx.fillRect(x, 70.3, 7, .35); }
  }
  if (p.category !== 'amateur') { ctx.fillStyle = night ? '#07090c' : '#15191e'; ctx.fillRect(50.3, 70.6, 4.4, 1.4); }
}

/** Light and sky tint over stands and pitch, drawn after the pitch and before the players. */
export function drawAtmosphere(ctx: CanvasRenderingContext2D, ambience: Ambience) {
  const view = visibleWorld(ctx), w = view.right - view.left, h = view.bottom - view.top;
  if (ambience.weather === 'cloudy' || ambience.weather === 'rain') { ctx.fillStyle = ambience.weather === 'rain' ? 'rgba(40,52,66,.16)' : 'rgba(70,80,92,.1)'; ctx.fillRect(view.left, view.top, w, h); }
  if (ambience.weather === 'snow') { ctx.fillStyle = 'rgba(240,246,255,.1)'; ctx.fillRect(0, 0, 105, 68); }
  if (ambience.time === 'dusk') { ctx.fillStyle = 'rgba(255,130,60,.08)'; ctx.fillRect(view.left, view.top, w, h); ctx.fillStyle = 'rgba(20,20,60,.08)'; ctx.fillRect(view.left, view.top, w, h); }
  if (ambience.time === 'night') {
    ctx.fillStyle = 'rgba(4,10,32,.34)'; ctx.fillRect(view.left, view.top, w, h);
    // Floodlights brighten the pitch again; the stands get a little of the light too.
    const lights = floodlightPositions(ambience), strength = .8 / Math.sqrt(lights.length / 4);
    for (const [x, y] of lights) {
      const glow = ctx.createRadialGradient(x, y, 1, x, y, 80);
      glow.addColorStop(0, `rgba(255,250,225,${(.2 * strength).toFixed(3)})`); glow.addColorStop(1, 'rgba(255,250,225,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 105, 68);
      const halo = ctx.createRadialGradient(x, y, .2, x, y, 7);
      halo.addColorStop(0, 'rgba(255,252,230,.85)'); halo.addColorStop(1, 'rgba(255,252,230,0)');
      ctx.fillStyle = halo; ctx.fillRect(x - 7, y - 7, 14, 14);
    }
  }
}

/** Rain or snow above everything else. */
export function drawWeather(ctx: CanvasRenderingContext2D, ambience: Ambience, now: number, animate = true) {
  if (ambience.weather !== 'rain' && ambience.weather !== 'snow') return;
  const view = visibleWorld(ctx), w = view.right - view.left, h = view.bottom - view.top, t = animate ? now / 1000 : 0;
  if (ambience.weather === 'rain') {
    ctx.strokeStyle = 'rgba(200,222,255,.38)'; ctx.lineWidth = .14; ctx.beginPath();
    for (let i = 0; i < 160; i++) {
      const x = view.left + ((hash(i * 31 + ambience.seed) * w + t * 9) % w), y = view.top + ((hash(i * 17 + 3) * h + t * 55) % h);
      ctx.moveTo(x, y); ctx.lineTo(x - .5, y + 1.9);
    }
    ctx.stroke();
    return;
  }
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath();
  for (let i = 0; i < 120; i++) {
    const x = view.left + ((hash(i * 13 + ambience.seed) * w + Math.sin(t * .8 + i) * 1.5 + w) % w), y = view.top + ((hash(i * 29 + 7) * h + t * 5) % h), r = .14 + hash(i) * .2;
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** "TOR!" banner and confetti during a goal celebration of the interactive engine. */
export function drawCelebration(ctx: CanvasRenderingContext2D, celebration: FrameCelebration | undefined, scorer: string, colours: { club: string; opponent: string }, now: number, animate = true) {
  if (!celebration || celebration.progress >= .7) return;
  const p = celebration.progress, alpha = Math.min(1, p / .08, (.7 - p) / .12), club = celebration.side === 'club';
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  if (club && animate) {
    for (let i = 0; i < 70; i++) {
      const x = hash(i * 3 + 1) * 105, fall = (hash(i * 5 + 2) * 68 + p * 90 + Math.sin(now / 300 + i) * 2) % 72 - 4;
      ctx.fillStyle = i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? colours.club : '#ffd447';
      ctx.fillRect(x, fall, .7, .38);
    }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${club ? 9 : 6}px system-ui, sans-serif`;
  ctx.lineWidth = .9; ctx.strokeStyle = 'rgba(4,20,12,.85)';
  ctx.strokeText(club ? 'TOR!' : 'Gegentor', 52.5, 26); ctx.fillStyle = club ? '#ffffff' : '#e3e7ea'; ctx.fillText(club ? 'TOR!' : 'Gegentor', 52.5, 26);
  if (scorer) { ctx.font = '700 3.2px system-ui, sans-serif'; ctx.lineWidth = .5; ctx.strokeText(scorer, 52.5, 33.5); ctx.fillStyle = club ? colours.club === '#1d1d1f' ? '#ffffff' : shade(colours.club, .55) : '#e3e7ea'; ctx.fillText(scorer, 52.5, 33.5); }
  ctx.restore();
}
