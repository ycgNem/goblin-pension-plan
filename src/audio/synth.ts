// Tiny synthesis helpers shared by sound effects and music. Everything is generated live:
// the game ships no audio files.

export interface Voice {
  ctx: AudioContext;
  out: AudioNode;
  noise: AudioBuffer;
  /** Start time in AudioContext seconds. */
  t: number;
}

export interface ToneOptions {
  type?: OscillatorType;
  freq: number;
  /** Slide to this frequency over the note. */
  to?: number;
  dur: number;
  vol?: number;
  attack?: number;
  delay?: number;
  detune?: number;
}

export function tone(v: Voice, o: ToneOptions): void {
  const t = v.t + (o.delay ?? 0);
  const osc = v.ctx.createOscillator();
  const gain = v.ctx.createGain();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + o.dur);
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);
  envelope(gain.gain, t, o.attack ?? 0.005, o.dur, o.vol ?? 0.2);
  osc.connect(gain).connect(v.out);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

export interface HissOptions {
  dur: number;
  vol?: number;
  filter?: BiquadFilterType;
  freq?: number;
  to?: number;
  q?: number;
  attack?: number;
  delay?: number;
}

export function hiss(v: Voice, o: HissOptions): void {
  const t = v.t + (o.delay ?? 0);
  const src = v.ctx.createBufferSource();
  src.buffer = v.noise;
  src.loop = true;
  const filter = v.ctx.createBiquadFilter();
  filter.type = o.filter ?? 'lowpass';
  filter.frequency.setValueAtTime(o.freq ?? 2000, t);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
  filter.Q.value = o.q ?? 0.7;
  const gain = v.ctx.createGain();
  envelope(gain.gain, t, o.attack ?? 0.003, o.dur, o.vol ?? 0.2);
  src.connect(filter).connect(gain).connect(v.out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + o.dur + 0.05);
}

/** Quick attack to `vol`, then an exponential fade to silence by `dur`. */
function envelope(p: AudioParam, t: number, attack: number, dur: number, vol: number): void {
  p.setValueAtTime(0.0001, t);
  p.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(attack, dur * 0.5));
  p.exponentialRampToValueAtTime(0.0001, t + dur);
}

const NOTE_INDEX: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

/** 'A4' → 440. Accepts sharps and flats: 'C#5', 'Bb3'. */
export function noteFreq(note: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!m) throw new Error(`Bad note '${note}'`);
  const semis = NOTE_INDEX[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * Math.pow(2, semis / 12);
}
