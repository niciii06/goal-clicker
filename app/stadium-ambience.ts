// Purely visual stadium layer for the 2D match: stands with fans, time of day and weather.
// Nothing here changes scores, events, fitness or the match clock.
import type { CupState } from './feature-data';
import type { FrameCelebration } from './interactive-frame-data';
import type { StadiumProfile, StandType } from './stadium-profiles';

export type AmbienceTime = 'day' | 'dusk' | 'night';
export type AmbienceWeather = 'clear' | 'cloudy' | 'rain' | 'snow';
export type Ambience = { time: AmbienceTime; weather: AmbienceWeather; seed: number; fanMood: number; venue: 'home' | 'away' | 'neutral'; stadium?: StadiumProfile };

/** World units shown by the canvas: the 105 x 68 pitch, its run-off and a band of stands. */
export const STADIUM_VIEW = { width: 121, height: 84, centerX: 52.5, centerY: 34 };
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
const profileOf = (a: Ambience) => a.stadium ?? FALLBACK;

type Side = 'top' | 'bottom' | 'left' | 'right';
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

/** Floodlight positions for the stadium type. */
export function floodlightPositions(ambience: Ambience): [number, number][] {
  const p = profileOf(ambience);
  if (p.floodlights === 'poles') return p.category === 'amateur' ? [[8, -5.4], [97, -5.4], [8, 73.4], [97, 73.4]] : [[8, -5.6], [52.5, -5.6], [97, -5.6], [8, 73.6], [52.5, 73.6], [97, 73.6]];
  if (p.floodlights === 'roof') return [[10, -7.2], [35, -7.2], [70, -7.2], [95, -7.2], [10, 75.2], [35, 75.2], [70, 75.2], [95, 75.2]];
  return [[-6.5, -6.5], [111.5, -6.5], [-6.5, 74.5], [111.5, 74.5]];
}

/** Stands, terraces or open grass with fans, drawn before the pitch. Size and density follow the
 * stadium profile of the venue; fans of the scoring team jump during a goal celebration. */
export function drawStands(ctx: CanvasRenderingContext2D, ambience: Ambience, colours: { club: string; opponent: string }, now: number, celebration?: FrameCelebration, animate = true) {
  const view = visibleWorld(ctx), profile = profileOf(ambience);
  const night = ambience.time === 'night';
  const types = profile.stands, typeAt = (side: Side | null) => side ? types[side] : 'none';
  const corner = (x: number, y: number) => !sideAt(x, y) && (x < BORDER.left || x > BORDER.right) && (y < BORDER.top || y > BORDER.bottom);
  const bowl = profile.category === 'elite' || profile.category === 'national';
  // Ground: grass around open sides, concrete under stands.
  ctx.fillStyle = night ? '#16301f' : '#3d6b45';
  ctx.fillRect(view.left - 1, view.top - 1, view.right - view.left + 2, view.bottom - view.top + 2);
  const concrete = night ? '#141a22' : '#2c3238', step = night ? '#1a212b' : '#353c44', seat = night ? '#1d2532' : '#3a4656';
  for (const side of ['top', 'bottom', 'left', 'right'] as Side[]) {
    const type = types[side];
    if (type === 'none') continue;
    const depth = type === 'terrace' ? 3.2 : 30;
    const rect = side === 'top' ? [BORDER.left, BORDER.top - depth, BORDER.right - BORDER.left, depth] : side === 'bottom' ? [BORDER.left, BORDER.bottom, BORDER.right - BORDER.left, depth] : side === 'left' ? [BORDER.left - depth, BORDER.top, depth, BORDER.bottom - BORDER.top] : [BORDER.right, BORDER.top, depth, BORDER.bottom - BORDER.top];
    ctx.fillStyle = SEATED.has(type) ? seat : concrete;
    ctx.fillRect(rect[0], rect[1], rect[2], rect[3]);
    // Rows: a step line every two seats.
    ctx.fillStyle = step;
    for (let d = SEAT; d < depth; d += SEAT * 2) {
      if (side === 'top') ctx.fillRect(rect[0], BORDER.top - d - SEAT * .5, rect[2], SEAT * .45);
      else if (side === 'bottom') ctx.fillRect(rect[0], BORDER.bottom + d, rect[2], SEAT * .45);
      else if (side === 'left') ctx.fillRect(BORDER.left - d - SEAT * .5, rect[1], SEAT * .45, rect[3]);
      else ctx.fillRect(BORDER.right + d, rect[1], SEAT * .45, rect[3]);
    }
  }
  if (bowl) { ctx.fillStyle = seat; for (const [x, y] of [[view.left, view.top], [BORDER.right, view.top], [view.left, BORDER.bottom], [BORDER.right, BORDER.bottom]]) ctx.fillRect(x, y, Math.max(0, (x === view.left ? BORDER.left : view.right) - x), Math.max(0, (y === view.top ? BORDER.top : view.bottom) - y)); }
  // Fans. Attendance against capacity sets the density; open grass only has people at the rail.
  const fill = Math.max(.08, Math.min(1, profile.attendance / Math.max(1, profile.capacity)));
  const homeColour = ambience.venue === 'away' ? colours.opponent : colours.club;
  const visitorColour = ambience.venue === 'away' ? colours.club : colours.opponent;
  const jumping = celebration && celebration.progress < .75 ? (celebration.side === 'club' ? colours.club : colours.opponent) : undefined;
  const buckets = new Map<string, number[]>();
  const push = (colour: string, x: number, y: number) => { let list = buckets.get(colour); if (!list) { list = []; buckets.set(colour, list); } list.push(x, y); };
  const startX = Math.floor(view.left / SEAT), endX = Math.ceil(view.right / SEAT), startY = Math.floor(view.top / SEAT), endY = Math.ceil(view.bottom / SEAT);
  const t = animate ? now / 1000 : 0;
  for (let ix = startX; ix <= endX; ix++) {
    for (let iy = startY; iy <= endY; iy++) {
      const x = ix * SEAT, y = iy * SEAT;
      if (x > BORDER.left - .7 && x < BORDER.right + .7 && y > BORDER.top - .7 && y < BORDER.bottom + .7) continue;
      const side = sideAt(x, y), type = bowl && corner(x, y) ? 'stand' : typeAt(side), depth = depthAt(x, y);
      let chance: number;
      if (type === 'none') chance = depth < 1.6 ? fill * .55 : 0;
      else if (type === 'terrace') chance = depth > 3.2 ? 0 : fill * (depth < 1.4 ? 1.15 : .7);
      else chance = fill * (type === 'tiered' && depth > 1.8 && depth < 2.4 ? 0 : 1);
      // Stairways split seated stands into blocks.
      const behindGoal = x < BORDER.left || x > BORDER.right;
      if (SEATED.has(type as StandType) && (behindGoal ? ((iy % 9) + 9) % 9 === 0 : ((ix % 12) + 12) % 12 === 0)) continue;
      const h = hash(ix * 7919 + iy * 104729 + ambience.seed);
      if (h > chance) continue;
      const awayBlock = ambience.venue === 'neutral' ? x > 52.5 : y < BORDER.top && x > 70 && x < 104;
      let colour = awayBlock ? visitorColour : homeColour;
      if (h < chance * .14) colour = '#e9eef2';
      else if (h > chance * .9) colour = '#7d8790';
      const own = colour === jumping;
      const phase = h * 40;
      const bob = animate ? (own ? Math.abs(Math.sin(t * 9 + phase)) * .55 : Math.sin(t * 2.2 + phase) * .05 * (.6 + ambience.fanMood / 100)) : 0;
      const jitter = type === 'none' || type === 'terrace' ? (hash(ix * 31 + iy * 17) - .5) * .5 : 0;
      push(own && Math.sin(t * 6 + phase) > .4 ? shade(colour, .35) : colour, x - .37 + jitter, y - .37 - bob);
    }
  }
  for (const [colour, list] of buckets) {
    ctx.fillStyle = night ? shade(colour, -.25) : colour;
    for (let i = 0; i < list.length; i += 2) ctx.fillRect(list[i], list[i + 1], .74, .74);
  }
  // Tiered stands: the fascia of the upper tier.
  ctx.fillStyle = night ? 'rgba(160,170,185,.45)' : 'rgba(205,212,220,.8)';
  for (const side of ['top', 'bottom', 'left', 'right'] as Side[]) {
    if (types[side] !== 'tiered') continue;
    if (side === 'top') ctx.fillRect(view.left, BORDER.top - 2.15, view.right - view.left, .22);
    if (side === 'bottom') ctx.fillRect(view.left, BORDER.bottom + 1.93, view.right - view.left, .22);
    if (side === 'left') ctx.fillRect(BORDER.left - 2.15, view.top, .22, view.bottom - view.top);
    if (side === 'right') ctx.fillRect(BORDER.right + 1.93, view.top, .22, view.bottom - view.top);
  }
  // Roofs cover the outer part of covered and tiered stands.
  for (const side of ['top', 'bottom', 'left', 'right'] as Side[]) {
    const type = types[side];
    if (type !== 'covered' && type !== 'tiered') continue;
    // The canvas shows about four metres of stand, so roofs start close to the pitch to stay visible.
    const inner = type === 'tiered' ? 3.1 : 2.9;
    ctx.fillStyle = profile.signature === 'allianz' ? (night ? 'rgba(190,30,45,.55)' : 'rgba(225,235,240,.82)') : night ? 'rgba(10,14,20,.78)' : 'rgba(58,66,76,.86)';
    const r = side === 'top' ? [view.left, view.top, view.right - view.left, BORDER.top - inner - view.top] : side === 'bottom' ? [view.left, BORDER.bottom + inner, view.right - view.left, view.bottom - BORDER.bottom - inner] : side === 'left' ? [view.left, view.top, BORDER.left - inner - view.left, view.bottom - view.top] : [BORDER.right + inner, view.top, view.right - BORDER.right - inner, view.bottom - view.top];
    if (r[2] > 0 && r[3] > 0) ctx.fillRect(r[0], r[1], r[2], r[3]);
    ctx.fillStyle = night ? 'rgba(255,248,214,.55)' : 'rgba(235,240,245,.7)';
    if (side === 'top') ctx.fillRect(view.left, BORDER.top - inner - .25, view.right - view.left, .25);
    if (side === 'bottom') ctx.fillRect(view.left, BORDER.bottom + inner, view.right - view.left, .25);
    if (side === 'left') ctx.fillRect(BORDER.left - inner - .25, view.top, .25, view.bottom - view.top);
    if (side === 'right') ctx.fillRect(BORDER.right + inner, view.top, .25, view.bottom - view.top);
  }
  if (profile.signature === 'san-siro') {
    // San Siro: red roof girders and the cylindrical ramp towers at the corners.
    ctx.fillStyle = 'rgba(200,32,40,.85)';
    for (let x = 2; x < 104; x += 8.5) { ctx.fillRect(x, view.top, .7, BORDER.top - 3.1 - view.top); ctx.fillRect(x, BORDER.bottom + 3.1, .7, view.bottom - BORDER.bottom - 3.1); }
    for (const [x, y] of [[-7.5, -7.5], [112.5, -7.5], [-7.5, 75.5], [112.5, 75.5]]) {
      ctx.fillStyle = night ? '#2a2f36' : '#8d949b'; ctx.beginPath(); ctx.arc(x, y, 3.1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = night ? '#3c434c' : '#b5bcc2'; ctx.lineWidth = .35; ctx.beginPath(); ctx.arc(x, y, 2.1, 0, Math.PI * 1.6); ctx.stroke();
    }
  }
  if (profile.signature === 'wembley') { ctx.strokeStyle = night ? 'rgba(255,255,255,.75)' : '#ffffff'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-8, -9.5); ctx.quadraticCurveTo(52.5, -13.5, 113, -9.5); ctx.stroke(); }
  if (types.top === 'none' || types.left === 'none') {
    // Open grounds: a fence and a few trees.
    ctx.fillStyle = night ? '#0f2416' : '#2a5232';
    for (let i = 0; i < 9; i++) { const x = -8 + i * 15 + hash(ambience.seed + i) * 5, y = BORDER.top - 6.5 - hash(i * 13) * 2; if (types.top === 'none') { ctx.beginPath(); ctx.arc(x, y, 2.2 + hash(i) * .9, 0, Math.PI * 2); ctx.fill(); } }
    ctx.fillStyle = night ? '#5b6168' : '#c9cfd4';
    if (types.top === 'none') ctx.fillRect(BORDER.left - .3, BORDER.top - .55, BORDER.right - BORDER.left + .6, .14);
    if (types.left === 'none') ctx.fillRect(BORDER.left - .55, BORDER.top - .3, .14, BORDER.bottom - BORDER.top + .6);
    if (types.right === 'none') ctx.fillRect(BORDER.right + .41, BORDER.top - .3, .14, BORDER.bottom - BORDER.top + .6);
  }
  // Floodlights: poles on small grounds, corner masts, or lights under the roof.
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
    ctx.fillStyle = 'rgba(4,10,32,.46)'; ctx.fillRect(view.left, view.top, w, h);
    // Floodlights brighten the pitch again from the four corners; the stands stay dark.
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
