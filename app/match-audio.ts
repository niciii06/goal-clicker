// Stadium sound for live matches: crowd murmur, referee whistles, goal cheers, groans, "oohs" and chants.
// Crowd recordings are CC0 (see public/sounds/LICENSES.md); whistles, the roar and claps are synthesised.
// Sound only: nothing here changes the match.
import type { CupState } from './feature-data';
import type { SimAction } from './interactive-match';

export type SoundCue =
  | { kind: 'kickoff' } | { kind: 'halftime' } | { kind: 'fulltime' }
  | { kind: 'goal'; home: boolean }
  | { kind: 'chance'; home: boolean; save: boolean }
  | { kind: 'foul' } | { kind: 'card'; red: boolean; againstHome: boolean };

type Team = 'club' | 'opponent';

/** The side the home crowd supports: the opponent's fans fill the ground on away days. */
export function homeTeamOf(cup: Pick<CupState, 'fixture'>): Team {
  return cup.fixture?.away ? 'opponent' : 'club';
}

/** Sounds for the simulation actions that finished between two moments of match time (seconds). */
export function simulationCues(actions: readonly SimAction[], from: number, to: number, home: Team): SoundCue[] {
  const cues: SoundCue[] = [];
  const seen = new Set<string>();
  for (const action of actions) {
    if (seen.has(action.id) || action.end <= from || action.end > to) continue;
    seen.add(action.id);
    if (action.kind === 'shot') {
      if (action.outcome === 'goal') cues.push({ kind: 'goal', home: action.side === home });
      else cues.push({ kind: 'chance', home: action.side === home, save: action.outcome === 'save' });
    } else if (action.kind === 'foul' || action.kind === 'injury') cues.push({ kind: 'foul' });
    else if (action.kind === 'yellow' || action.kind === 'red') cues.push({ kind: 'card', red: action.kind === 'red', againstHome: action.side !== home });
  }
  return cues;
}

/** Sounds for matches without the interactive simulation: goals and cards by wall time. */
export function legacyCues(cup: Pick<CupState, 'matchEvents' | 'cardEvents' | 'fixture'>, from: number, to: number): SoundCue[] {
  const home = homeTeamOf(cup), cues: SoundCue[] = [];
  for (const goal of cup.matchEvents) {
    const at = goal.createdAt + 750;
    if (at > from && at <= to) cues.push({ kind: 'goal', home: (goal.side === 'home' ? 'club' : 'opponent') === home });
  }
  for (const card of cup.cardEvents) if (card.createdAt > from && card.createdAt <= to) cues.push({ kind: 'card', red: card.card === 'red', againstHome: (card.side === 'home' ? 'club' : 'opponent') === home });
  return cues;
}

let sharedContext: AudioContext | null = null;
/** One audio context for the whole game; browsers allow only a few and start them muted until a tap. */
export function gameAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!sharedContext) {
    const AudioClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioClass) return null;
    sharedContext = new AudioClass();
  }
  if (sharedContext.state === 'suspended') void sharedContext.resume().catch(() => {});
  return sharedContext;
}

const SAMPLE_URLS = { murmur: '/sounds/crowd-murmur.mp3', applause: '/sounds/crowd-applause.mp3', ooh: '/sounds/crowd-ooh.mp3' } as const;
type SampleName = keyof typeof SAMPLE_URLS;
const sampleCache = new Map<SampleName, Promise<AudioBuffer | null>>();
function loadSample(ctx: AudioContext, name: SampleName) {
  let promise = sampleCache.get(name);
  if (!promise) {
    promise = fetch(SAMPLE_URLS[name]).then((r) => r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))
      .then((data) => new Promise<AudioBuffer>((resolve, reject) => ctx.decodeAudioData(data, resolve, reject))).catch(() => null);
    sampleCache.set(name, promise);
  }
  return promise;
}

/**
 * The sound of one match. `size` (0 to 1) is how full and big the ground is: a village pitch with
 * sixty people murmurs quietly, a sold-out bowl roars.
 */
export class StadiumAudio {
  private master: GainNode;
  private bed: GainNode;
  private noise: AudioBuffer;
  private samples: Partial<Record<SampleName, AudioBuffer>> = {};
  private loops: AudioBufferSourceNode[] = [];
  private intensity = 0;
  private stopped = false;

  constructor(private ctx: AudioContext, private size: number) {
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // A goal stacks roar, applause and voices; the compressor keeps that from clipping.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14; limiter.knee.value = 10; limiter.ratio.value = 6; limiter.attack.value = .01; limiter.release.value = .3;
    this.master.connect(limiter).connect(ctx.destination);
    this.bed = ctx.createGain();
    this.bed.gain.value = .0001;
    this.bed.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Loads the crowd recordings without starting the constant crowd (for short effects like pack openings). */
  async load() {
    const names = Object.keys(SAMPLE_URLS) as SampleName[];
    const buffers = await Promise.all(names.map((name) => loadSample(this.ctx, name)));
    names.forEach((name, i) => { const buffer = buffers[i]; if (buffer) this.samples[name] = buffer; });
  }

  async start() {
    await this.load();
    if (this.stopped) return;
    // The constant crowd: the murmur recording (or filtered noise without it) plus a low rumble.
    const murmur = this.samples.murmur;
    if (murmur) this.loop(murmur, this.bed, 1);
    const rumble = this.ctx.createBiquadFilter();
    rumble.type = 'lowpass'; rumble.frequency.value = 420;
    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.value = murmur ? .35 : .9;
    rumble.connect(rumbleGain).connect(this.bed);
    this.loop(this.noise, rumble, 1);
    this.setIntensity(0);
  }

  private loop(buffer: AudioBuffer, target: AudioNode, rate: number) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer; source.loop = true; source.playbackRate.value = rate;
    // MP3 encoders add a few milliseconds of silence at both ends; skip them so the loop has no gap.
    if (buffer.duration > 1) { source.loopStart = .06; source.loopEnd = buffer.duration - .06; }
    source.connect(target);
    source.start(this.ctx.currentTime, buffer.duration > 1 ? .06 + Math.random() * (buffer.duration - 1) : 0);
    this.loops.push(source);
  }

  setEnabled(on: boolean) {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(on ? 1 : 0, now, .25);
  }

  /** 0 for midfield play, 1 for the ball in front of a goal: the crowd gets louder. */
  setIntensity(value: number) {
    this.intensity = Math.max(0, Math.min(1, value));
    const level = (.05 + .3 * this.size) * (.75 + .5 * this.intensity);
    this.bed.gain.setTargetAtTime(level, this.ctx.currentTime, .6);
  }

  private envelope(peak: number, attack: number, hold: number, release: number, delay = 0) {
    const gain = this.ctx.createGain(), t = this.ctx.currentTime + delay;
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + attack);
    gain.gain.setValueAtTime(Math.max(.0002, peak), t + attack + hold);
    gain.gain.exponentialRampToValueAtTime(.0001, t + attack + hold + release);
    gain.connect(this.master);
    return { gain, t, end: t + attack + hold + release };
  }

  private play(buffer: AudioBuffer | undefined, target: AudioNode, at: number, end: number, rate = 1, offset = 0) {
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer; source.playbackRate.value = rate;
    source.connect(target);
    source.start(at, Math.min(offset, Math.max(0, buffer.duration - .1)));
    source.stop(end + .05);
  }

  /** A referee's pea whistle: a high tone that trills. */
  whistle(length: number, delay = 0, volume = .16) {
    const { gain, t, end } = this.envelope(volume, .015, length, .08, delay);
    const trill = this.ctx.createGain();
    trill.gain.value = .55;
    const lfo = this.ctx.createOscillator(), depth = this.ctx.createGain();
    lfo.frequency.value = 27 + Math.random() * 6; depth.gain.value = .45;
    lfo.connect(depth).connect(trill.gain);
    trill.connect(gain);
    for (const [freq, level] of [[2870, .7], [3010, .5], [5900, .12]] as const) {
      const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
      osc.frequency.setValueAtTime(freq * (1 + (Math.random() - .5) * .01), t);
      g.gain.value = level; osc.connect(g).connect(trill);
      osc.start(t); osc.stop(end + .05);
    }
    lfo.start(t); lfo.stop(end + .05);
  }

  /** Many hands clapping at once. */
  claps(count: number, spacing: number, delay = 0, volume = .3) {
    for (let i = 0; i < count; i++) {
      const at = delay + i * spacing;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 1300; filter.Q.value = .8;
      const { gain, t, end } = this.envelope(volume * (.6 + .4 * this.size), .004, .01, .12, at);
      filter.connect(gain);
      for (let layer = 0; layer < 3; layer++) this.play(this.noise, filter, t + Math.random() * .03, end, 1, Math.random());
    }
  }

  /** A crowd going "ooh": the recorded voice, layered with small shifts in pitch and timing. */
  ooh(volume = .5, pitch = 1, length = 1.6, delay = 0) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 2400;
    const { gain, t, end } = this.envelope(volume * (.35 + .65 * this.size), .12, length * .45, length * .55, delay);
    filter.connect(gain);
    const voices = this.samples.ooh ? 8 : 0;
    for (let i = 0; i < voices; i++) this.play(this.samples.ooh, filter, t + Math.random() * .14, end, pitch * (.86 + i * .04), 0);
    if (!voices) { const band = this.ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 520 * pitch; band.Q.value = 3; band.connect(filter); this.play(this.noise, band, t, end); }
  }

  /** The roar after a goal for the home crowd, or a short cheer from the away block. */
  cheer(home: boolean) {
    const strength = home ? .6 + .4 * this.size : .25 + .15 * this.size;
    const roar = this.ctx.createBiquadFilter();
    roar.type = 'bandpass'; roar.frequency.value = 900; roar.Q.value = .6;
    const { gain, t, end } = this.envelope(.55 * strength, .25, 2.2, 3.8);
    roar.connect(gain);
    this.play(this.samples.murmur ?? this.noise, roar, t, end, 1.12, Math.random() * 8);
    this.play(this.noise, roar, t, end, 1, Math.random());
    const applause = this.envelope(.7 * strength, .4, 3, 4, .6);
    this.play(this.samples.applause, applause.gain, applause.t, applause.end, 1, Math.random() * 6);
    this.ooh(.55 * strength, 1.3, 2.2, .05);
  }

  groan() {
    this.ooh(.45, .78, 1.4);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 700;
    const { gain, t, end } = this.envelope(.18 * this.size, .3, .6, 1.4, .2);
    filter.connect(gain);
    this.play(this.noise, filter, t, end, 1, Math.random());
  }

  applause(volume: number, length: number, delay = 0) {
    const { gain, t, end } = this.envelope(volume * (.3 + .7 * this.size), .3, length, 1.6, delay);
    this.play(this.samples.applause, gain, t, end, 1, Math.random() * 8);
  }

  /** A home end chant: "oh oh oh" to a simple tune, then rhythmic clapping. */
  chant() {
    const tune = [1, 1, 1.12, 1, .89, 1, 1.12, 1.26];
    tune.forEach((pitch, i) => this.ooh(.32, pitch, .42, i * .46));
    this.claps(3, .5, tune.length * .46 + .1, .26);
    this.claps(3, .25, tune.length * .46 + 1.7, .26);
  }

  /** Rising filtered noise: the tension before a reveal. */
  riser(length: number, delay = 0, volume = .22) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.Q.value = 2.5;
    const { gain, t, end } = this.envelope(volume, length * .9, .02, .25, delay);
    filter.frequency.setValueAtTime(220, t);
    filter.frequency.exponentialRampToValueAtTime(3200, t + length);
    filter.connect(gain);
    this.play(this.noise, filter, t, end, 1, Math.random());
  }

  /** A fast swish of air as something flies in. */
  whoosh(delay = 0, volume = .22) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.Q.value = 1.4;
    const { gain, t, end } = this.envelope(volume, .12, .05, .35, delay);
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + .2);
    filter.frequency.exponentialRampToValueAtTime(900, t + .5);
    filter.connect(gain);
    this.play(this.noise, filter, t, end, 1, Math.random());
  }

  /** A deep hit, like a drum in an arena. */
  boom(delay = 0, volume = .55) {
    const { gain, t, end } = this.envelope(volume, .006, .04, .9, delay);
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + .5);
    osc.connect(gain); osc.start(t); osc.stop(end + .05);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 900;
    const hit = this.envelope(volume * .5, .002, .02, .18, delay);
    filter.connect(hit.gain);
    this.play(this.noise, filter, hit.t, hit.end, 1, Math.random());
  }

  /** A bright shimmer for a good card. */
  chime(delay = 0, volume = .14, notes = [1046.5, 1318.5, 1568, 2093]) {
    notes.forEach((freq, i) => {
      const { gain, t, end } = this.envelope(volume, .01, .05, 1.1, delay + i * .07);
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, t);
      osc.connect(gain); osc.start(t); osc.stop(end + .05);
    });
  }

  /** Pyrotechnics: hissing launches and crackling bursts. */
  fireworks(count: number, delay = 0, volume = .2) {
    for (let i = 0; i < count; i++) {
      const at = delay + i * (.18 + Math.random() * .2);
      const hiss = this.ctx.createBiquadFilter();
      hiss.type = 'highpass'; hiss.frequency.value = 3000;
      const launch = this.envelope(volume * .5, .05, .25, .2, at);
      hiss.connect(launch.gain);
      this.play(this.noise, hiss, launch.t, launch.end, 1, Math.random());
      for (let k = 0; k < 6; k++) {
        const crack = this.ctx.createBiquadFilter();
        crack.type = 'bandpass'; crack.frequency.value = 1800 + Math.random() * 2500; crack.Q.value = 3;
        const pop = this.envelope(volume * (.6 + Math.random() * .4), .002, .005, .06, at + .5 + Math.random() * .35);
        crack.connect(pop.gain);
        this.play(this.noise, crack, pop.t, pop.end, 1, Math.random());
      }
    }
  }

  cue(cue: SoundCue) {
    if (cue.kind === 'kickoff') { this.whistle(.55); this.applause(.35, 1.2); }
    else if (cue.kind === 'halftime') { this.whistle(.28); this.whistle(.85, .45); this.applause(.4, 2); }
    else if (cue.kind === 'fulltime') { this.whistle(.3); this.whistle(.3, .45); this.whistle(1.1, .9); this.applause(.6, 4, 1.2); }
    else if (cue.kind === 'goal') { if (!cue.home) this.groan(); this.cheer(cue.home); }
    else if (cue.kind === 'chance') { this.ooh(cue.home ? .55 : .3, cue.home ? 1 : .9); if (cue.save) this.applause(cue.home ? .2 : .32, .6, .5); }
    else if (cue.kind === 'foul') this.whistle(.32, 0, .13);
    else if (cue.kind === 'card') { this.whistle(cue.red ? .7 : .35); if (cue.againstHome) this.groan(); else this.applause(.25, .8, .3); }
  }

  stop() {
    this.stopped = true;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, .15);
    window.setTimeout(() => { for (const source of this.loops) { try { source.stop(); } catch { /* already stopped */ } } this.master.disconnect(); }, 700);
  }
}

/** How full and big the ground is, 0 to 1, for the loudness of the crowd. */
export function crowdSize(attendance: number) {
  return Math.max(0, Math.min(1, Math.sqrt(Math.max(0, attendance) / 40000)));
}

export type PackRevealTier = 'standard' | 'rare' | 'walkout' | 'icon' | 'legendary';

/**
 * Sound for a pack opening, timed to the animation: a short shimmer for a normal card, a riser and a
 * chime for a rare one, and for a walkout tension, a hit for the flag, the positions and the rating, then
 * fireworks and the crowd when the player walks out. Returns a function that stops it early.
 */
export function playPackReveal(tier: PackRevealTier, options: { top?: boolean; delay?: number } = {}) {
  const ctx = gameAudioContext();
  if (!ctx) return () => {};
  const fx = new StadiumAudio(ctx, 1);
  fx.setEnabled(true);
  const timers: number[] = [];
  const at = (ms: number, run: () => void) => { timers.push(window.setTimeout(run, ms + (options.delay ?? 0))); };
  void fx.load().then(() => {
    if (tier === 'standard') at(0, () => fx.chime(0, .08, [784, 988, 1175]));
    else if (tier === 'rare') { at(0, () => fx.riser(.6, 0, .16)); at(600, () => { fx.boom(0, .3); fx.chime(); fx.applause(.25, .8); }); }
    else {
      const name = options.top ? 8000 : 6200, walk = options.top ? 5500 : 4500;
      at(0, () => { fx.riser(1, 0, .2); fx.boom(.5, .25); });
      at(1000, () => { fx.whoosh(); fx.boom(.05, .5); });
      at(2900, () => fx.whoosh(0, .16));
      at(3350, () => fx.riser(.2, 0, .18));
      at(3550, () => { fx.boom(0, .7); fx.ooh(.5, 1.05, 1.8); if (tier !== 'walkout') fx.chime(.1, .12); });
      at(walk, () => { fx.fireworks(options.top ? 7 : 4); fx.applause(.35, 2.5); });
      at(name, () => { fx.cheer(true); fx.chime(0, .1); });
    }
    // Let the last sound ring out, then release the nodes.
    at(tier === 'standard' ? 2500 : tier === 'rare' ? 4000 : (options.top ? 8000 : 6200) + 7000, () => fx.stop());
  });
  return () => { timers.forEach((timer) => window.clearTimeout(timer)); fx.stop(); };
}
