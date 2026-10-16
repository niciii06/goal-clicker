// Purely visual stadium layer for the 2D match: stands with fans, time of day and weather.
// Nothing here changes scores, events, fitness or the match clock.
import type { CupState } from './feature-data';
import type { FrameCelebration } from './interactive-frame-data';

export type AmbienceTime = 'day' | 'dusk' | 'night';
export type AmbienceWeather = 'clear' | 'cloudy' | 'rain' | 'snow';
export type Ambience = { time: AmbienceTime; weather: AmbienceWeather; seed: number; fanMood: number; venue: 'home' | 'away' | 'neutral' };

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

export function computeAmbience(cup: Pick<CupState, 'matchStartedAt' | 'fixture' | 'careerMatchId' | 'opponent'>, fanMood = 60, seedHint?: number): Ambience {
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
  return { time, weather, seed: seed >>> 0, fanMood: Math.max(0, Math.min(100, fanMood)), venue: cup.fixture?.neutral ? 'neutral' : cup.fixture?.away ? 'away' : 'home' };
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

/** Stands with fans, drawn before the pitch. Fans of the scoring team jump during a goal celebration. */
export function drawStands(ctx: CanvasRenderingContext2D, ambience: Ambience, colours: { club: string; opponent: string }, now: number, celebration?: FrameCelebration, animate = true) {
  const view = visibleWorld(ctx);
  const night = ambience.time === 'night';
  ctx.fillStyle = night ? '#121820' : '#2a3036';
  ctx.fillRect(view.left - 1, view.top - 1, view.right - view.left + 2, view.bottom - view.top + 2);
  // Tier stripes.
  ctx.fillStyle = night ? '#171e27' : '#323940';
  for (let y = BORDER.top - SEAT; y > view.top - SEAT; y -= SEAT * 2) ctx.fillRect(view.left, y - SEAT * .5, view.right - view.left, SEAT * .5);
  for (let y = BORDER.bottom + SEAT * .5; y < view.bottom + SEAT; y += SEAT * 2) ctx.fillRect(view.left, y, view.right - view.left, SEAT * .5);
  // Club fans fill most seats at home; at away matches our supporters sit in the away block.
  const homeColour = ambience.venue === 'away' ? colours.opponent : colours.club;
  const visitorColour = ambience.venue === 'away' ? colours.club : colours.opponent;
  const occupancy = .5 + ambience.fanMood * .0045;
  const jumping = celebration && celebration.progress < .75 ? (celebration.side === 'club' ? colours.club : colours.opponent) : undefined;
  const buckets = new Map<string, number[]>();
  const push = (colour: string, x: number, y: number) => { let list = buckets.get(colour); if (!list) { list = []; buckets.set(colour, list); } list.push(x, y); };
  const startX = Math.floor(view.left / SEAT), endX = Math.ceil(view.right / SEAT), startY = Math.floor(view.top / SEAT), endY = Math.ceil(view.bottom / SEAT);
  const t = animate ? now / 1000 : 0;
  for (let ix = startX; ix <= endX; ix++) {
    for (let iy = startY; iy <= endY; iy++) {
      const x = ix * SEAT, y = iy * SEAT;
      if (x > BORDER.left - .7 && x < BORDER.right + .7 && y > BORDER.top - .7 && y < BORDER.bottom + .7) continue;
      // Stairways split the stands into blocks.
      const behindGoal = x < BORDER.left || x > BORDER.right;
      if (behindGoal ? ((iy % 9) + 9) % 9 === 0 : ((ix % 12) + 12) % 12 === 0) continue;
      const h = hash(ix * 7919 + iy * 104729 + ambience.seed);
      if (h > occupancy) continue;
      const awayBlock = ambience.venue === 'neutral' ? x > 52.5 : y < BORDER.top && x > 70 && x < 104;
      let colour = awayBlock ? visitorColour : homeColour;
      if (h < .09) colour = '#e9eef2';
      else if (h > occupancy - .05) colour = '#7d8790';
      const own = colour === jumping;
      const phase = h * 40;
      const bob = animate ? (own ? Math.abs(Math.sin(t * 9 + phase)) * .55 : Math.sin(t * 2.2 + phase) * .05 * (.6 + ambience.fanMood / 100)) : 0;
      push(own && Math.sin(t * 6 + phase) > .4 ? shade(colour, .35) : colour, x - .37, y - .37 - bob);
    }
  }
  for (const [colour, list] of buckets) {
    ctx.fillStyle = night ? shade(colour, -.25) : colour;
    for (let i = 0; i < list.length; i += 2) ctx.fillRect(list[i], list[i + 1], .74, .74);
  }
  // Floodlight masts.
  for (const [x, y] of [[-6.5, -6.5], [111.5, -6.5], [-6.5, 74.5], [111.5, 74.5]]) {
    ctx.fillStyle = '#9aa4ad'; ctx.fillRect(x - .6, y - .6, 1.2, 1.2);
    if (ambience.time !== 'day') { ctx.fillStyle = 'rgba(255,248,214,.9)'; ctx.fillRect(x - .45, y - .45, .9, .9); }
  }
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
    for (const [x, y] of [[-6.5, -6.5], [111.5, -6.5], [-6.5, 74.5], [111.5, 74.5]]) {
      const glow = ctx.createRadialGradient(x, y, 1, x, y, 80);
      glow.addColorStop(0, 'rgba(255,250,225,.2)'); glow.addColorStop(1, 'rgba(255,250,225,0)');
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
