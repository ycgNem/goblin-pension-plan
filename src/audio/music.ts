import { hiss, noteFreq, tone, type Voice } from './synth';

// A small step sequencer and the game's tracks. Notation: tokens separated by spaces.
// 'C4' starts a note, '-' holds the previous one, '.' is a rest. Channels can differ in
// length; each loops on its own, which gives longer phrases for free.

export type Instrument = 'lead' | 'pluck' | 'bass' | 'pad' | 'bell' | 'hat' | 'kick' | 'drip';

export interface Channel {
  inst: Instrument;
  vol: number;
  notes: string;
  /** Only plays at or above this layer (the Burrow theme grows as the home gets cozier). */
  layer?: number;
}

export interface Track {
  bpm: number;
  /** 2 = eighth notes, 4 = sixteenths. */
  stepsPerBeat: number;
  channels: Channel[];
}

/** Bars of eighth notes, written one bar per string so tracks stay readable. */
const bars = (...b: string[]): string => b.join(' ');

export const TRACKS = {
  title: {
    bpm: 72,
    stepsPerBeat: 2,
    channels: [
      { inst: 'pad', vol: 0.05, notes: bars('D3 - - - - - - -', 'Bb2 - - - - - - -', 'F3 - - - - - - -', 'C3 - - - - - - -', 'D3 - - - - - - -', 'Bb2 - - - - - - -', 'G2 - - - - - - -', 'A2 - - - - - - -') },
      { inst: 'pad', vol: 0.04, notes: bars('A3 - - - - - - -', 'F3 - - - - - - -', 'C4 - - - - - - -', 'G3 - - - - - - -', 'A3 - - - - - - -', 'F3 - - - - - - -', 'D3 - - - - - - -', 'E3 - - - - - - -') },
      { inst: 'bass', vol: 0.12, notes: bars('D2 - - - D2 - A2 -', 'Bb1 - - - Bb1 - F2 -', 'F2 - - - F2 - C3 -', 'C2 - - - C2 - G2 -', 'D2 - - - D2 - A2 -', 'Bb1 - - - Bb1 - F2 -', 'G1 - - - G1 - D2 -', 'A1 - - - A1 - E2 -') },
      { inst: 'pluck', vol: 0.1, notes: bars('D5 . F5 . A5 - G5 F5', 'E5 . D5 . F5 - - .', 'C5 . F5 . A5 . C6 A5', 'G5 - - . E5 . C5 .', 'D5 . F5 . A5 - D6 .', 'C6 . A5 . F5 - D5 .', 'Bb5 . A5 . G5 . F5 .', 'E5 - C#5 - A4 - - .') },
      { inst: 'bell', vol: 0.05, notes: bars('D6 - - - - - - -', '. . . . . . . .', '. . . . . . . .', '. . . . . . . .', 'F6 - - - - - - -', '. . . . . . . .', '. . . . . . . .', '. . . . . . . .') },
    ],
  },
  burrow: {
    bpm: 84,
    stepsPerBeat: 2,
    channels: [
      { inst: 'bass', vol: 0.11, notes: bars('F2 - - - C2 - - -', 'D2 - - - A1 - - -', 'Bb1 - - - F2 - - -', 'C2 - - - G1 - - -', 'F2 - - - C2 - - -', 'A1 - - - E2 - - -', 'Bb1 - - - F2 - - -', 'C2 - - - C2 - E2 -') },
      { inst: 'pluck', vol: 0.07, notes: bars('F4 A4 C5 A4 F4 A4 C5 A4', 'D4 F4 A4 F4 D4 F4 A4 F4', 'Bb3 D4 F4 D4 Bb3 D4 F4 D4', 'C4 E4 G4 E4 C4 E4 G4 E4', 'F4 A4 C5 A4 F4 A4 C5 A4', 'A3 C4 E4 C4 A3 C4 E4 C4', 'Bb3 D4 F4 D4 Bb3 D4 F4 D4', 'C4 E4 G4 Bb4 C4 E4 G4 Bb4') },
      { inst: 'lead', vol: 0.045, layer: 1, notes: bars('. . A5 - G5 - F5 -', 'A5 - - - . . . .', '. . D5 - F5 - Bb5 -', 'A5 - - - G5 - - -', '. . A5 - C6 - A5 -', 'E5 - - - . . . .', '. . D5 - F5 - D6 -', 'C6 - - - - - . .') },
      { inst: 'pad', vol: 0.035, layer: 2, notes: bars('A3 - - - - - - -', 'F3 - - - - - - -', 'D4 - - - - - - -', 'E3 - - - - - - -', 'C4 - - - - - - -', 'E3 - - - - - - -', 'F3 - - - - - - -', 'G3 - - - - - - -') },
      { inst: 'bell', vol: 0.04, layer: 3, notes: bars('C6 - - - - - - -', '. . . . . . . .', 'D6 - - - - - - -', '. . . . . . . .', 'C6 - - - - - - -', '. . . . . . . .', 'F6 - - - - - - -', '. . . . . . . .') },
    ],
  },
  dungeon: {
    bpm: 60,
    stepsPerBeat: 2,
    channels: [
      { inst: 'pad', vol: 0.045, notes: bars('A2 - - - - - - -', '- - - - - - - -', '- - - - - - - -', '- - - - - - - -', 'F2 - - - - - - -', '- - - - - - - -', '- - - - - - - -', '- - - - - - - -') },
      { inst: 'pad', vol: 0.03, notes: bars('E3 - - - - - - -', '- - - - - - - -', '- - - - - - - -', '- - - - - - - -', 'C3 - - - - - - -', '- - - - - - - -', '- - - - - - - -', '- - - - - - - -') },
      { inst: 'pluck', vol: 0.06, notes: bars('A4 . . . . . . .', '. . . . E5 . . .', '. . . . . . . .', 'D5 . . . . . C5 .', '. . . . . . . .', 'A4 . . . . . . .', '. . G4 . . . . .', '. . . . . . . .', '. . . . . . . .', 'E5 . . . . . . .', '. . . . . . D5 .', '. . . . . . . .') },
      { inst: 'drip', vol: 0.05, notes: bars('C7 . . . . . . .', '. . . . . . . .', '. . . G6 . . . .', '. . . . . . . .', '. . . . . . . .', '. E7 . . . . . .', '. . . . . . . .') },
    ],
  },
  coop: {
    bpm: 104,
    stepsPerBeat: 2,
    channels: [
      { inst: 'bass', vol: 0.11, notes: bars('G2 . D3 . G2 . D3 .', 'C3 . G2 . C3 . G2 .', 'D3 . A2 . D3 . A2 .', 'G2 . D3 . G2 . B2 .') },
      { inst: 'pluck', vol: 0.06, notes: bars('. B3 . B3 . B3 . B3', '. C4 . E4 . C4 . E4', '. D4 . F#4 . D4 . F#4', '. B3 . D4 . B3 . D4') },
      { inst: 'lead', vol: 0.045, notes: bars('G4 A4 B4 - D5 - B4 -', 'C5 - E5 - D5 C5 B4 -', 'A4 B4 C5 - A4 - F#4 -', 'G4 - - - D4 - - -', 'B4 C5 D5 - G5 - D5 -', 'E5 - C5 - D5 - B4 -', 'C5 B4 A4 - F#4 - A4 -', 'G4 - - - . . . .') },
    ],
  },
  danger: {
    bpm: 128,
    stepsPerBeat: 2,
    channels: [
      { inst: 'kick', vol: 0.18, notes: bars('C2 . . . C2 . . .') },
      { inst: 'hat', vol: 0.05, notes: bars('. C7 . C7 . C7 . C7') },
      { inst: 'bass', vol: 0.12, notes: bars('A1 A1 . A1 C2 . A1 .', 'G1 G1 . G1 E1 . G1 .') },
      { inst: 'lead', vol: 0.04, notes: bars('A4 . . . . . . .', 'C5 . . . B4 . . .', 'A4 . . . . . E5 .', 'D5 . C5 . B4 . . .') },
    ],
  },
} satisfies Record<string, Track>;

export type TrackId = keyof typeof TRACKS;

interface NoteEvent {
  step: number;
  len: number;
  freq: number;
}

interface ParsedChannel {
  channel: Channel;
  length: number;
  events: Map<number, NoteEvent>;
}

function parse(channel: Channel): ParsedChannel {
  const tokens = channel.notes.trim().split(/\s+/);
  const events = new Map<number, NoteEvent>();
  let last: NoteEvent | null = null;
  tokens.forEach((tok, step) => {
    if (tok === '-') {
      if (last) last.len++;
    } else if (tok === '.') {
      last = null;
    } else {
      last = { step, len: 1, freq: noteFreq(tok) };
      events.set(step, last);
    }
  });
  return { channel, length: tokens.length, events };
}

/** Plays one track, scheduling slightly ahead of time so timing stays tight. */
export class Sequencer {
  private readonly channels: ParsedChannel[];
  private readonly stepDur: number;
  private step = 0;
  private nextTime: number;

  constructor(track: Track, private readonly out: AudioNode, private readonly makeVoice: (out: AudioNode, t: number) => Voice, startAt: number) {
    this.channels = track.channels.map(parse);
    this.stepDur = 60 / track.bpm / track.stepsPerBeat;
    this.nextTime = startAt;
  }

  schedule(now: number, layer: number): void {
    // Catch up gently if the tab was asleep, instead of firing a burst of old notes.
    if (this.nextTime < now - 0.25) this.nextTime = now;
    while (this.nextTime < now + 0.2) {
      for (const pc of this.channels) {
        if ((pc.channel.layer ?? 0) > layer) continue;
        const ev = pc.events.get(this.step % pc.length);
        if (ev) play(this.makeVoice(this.out, this.nextTime), pc.channel, ev.freq, ev.len * this.stepDur);
      }
      this.step++;
      this.nextTime += this.stepDur;
    }
  }
}

function play(v: Voice, ch: Channel, freq: number, dur: number): void {
  const vol = ch.vol;
  switch (ch.inst) {
    case 'lead':
      tone(v, { type: 'square', freq, dur: dur * 0.95, vol, attack: 0.02 });
      tone(v, { type: 'square', freq, dur: dur * 0.95, vol: vol * 0.5, attack: 0.02, detune: 8 });
      break;
    case 'pluck':
      tone(v, { type: 'triangle', freq, dur: Math.min(0.45, dur + 0.2), vol, attack: 0.003 });
      break;
    case 'bass':
      tone(v, { type: 'triangle', freq, dur: dur * 0.9, vol, attack: 0.01 });
      break;
    case 'pad':
      tone(v, { type: 'sawtooth', freq, dur: dur + 0.6, vol, attack: Math.min(0.6, dur * 0.4), detune: -6 });
      tone(v, { type: 'sawtooth', freq, dur: dur + 0.6, vol, attack: Math.min(0.6, dur * 0.4), detune: 6 });
      break;
    case 'bell':
      tone(v, { type: 'sine', freq, dur: 2.2, vol, attack: 0.002 });
      tone(v, { type: 'sine', freq: freq * 2.76, dur: 0.8, vol: vol * 0.3, attack: 0.002 });
      break;
    case 'hat':
      hiss(v, { dur: 0.04, vol, filter: 'highpass', freq: 7000 });
      break;
    case 'kick':
      tone(v, { type: 'sine', freq: 120, to: 40, dur: 0.18, vol, attack: 0.002 });
      break;
    case 'drip':
      tone(v, { type: 'sine', freq, to: freq * 0.5, dur: 0.08, vol, attack: 0.002 });
      break;
  }
}
