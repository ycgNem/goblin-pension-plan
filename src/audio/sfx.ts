import { hiss, tone, type Voice } from './synth';

// Every sound effect, as a recipe. `p` is a pitch multiplier for a little variety.

type Recipe = (v: Voice, p: number) => void;

const bellPartials = (v: Voice, base: number, vol: number, dur: number): void => {
  tone(v, { type: 'sine', freq: base, dur, vol, attack: 0.002 });
  tone(v, { type: 'sine', freq: base * 2.76, dur: dur * 0.5, vol: vol * 0.35, attack: 0.002 });
  tone(v, { type: 'sine', freq: base * 5.4, dur: dur * 0.25, vol: vol * 0.15, attack: 0.002 });
};

export const SFX = {
  // Combat
  shoot: (v, p) => {
    tone(v, { type: 'square', freq: 520 * p, to: 260 * p, dur: 0.07, vol: 0.07 });
    hiss(v, { dur: 0.05, vol: 0.08, filter: 'highpass', freq: 3000 });
  },
  chargedShot: (v, p) => {
    tone(v, { type: 'sawtooth', freq: 300 * p, to: 80 * p, dur: 0.25, vol: 0.12 });
    hiss(v, { dur: 0.2, vol: 0.14, freq: 1800, to: 300 });
  },
  chargeReady: (v, p) => tone(v, { type: 'triangle', freq: 1320 * p, dur: 0.12, vol: 0.08 }),
  hit: (v, p) => {
    hiss(v, { dur: 0.06, vol: 0.12, freq: 2400 * p });
    tone(v, { type: 'triangle', freq: 220 * p, to: 160 * p, dur: 0.06, vol: 0.1 });
  },
  kill: (v, p) => {
    hiss(v, { dur: 0.18, vol: 0.16, freq: 1600, to: 200 });
    tone(v, { type: 'square', freq: 420 * p, to: 90 * p, dur: 0.14, vol: 0.08 });
  },
  hurt: (v, p) => {
    tone(v, { type: 'square', freq: 320 * p, to: 110 * p, dur: 0.16, vol: 0.12 });
    hiss(v, { dur: 0.12, vol: 0.12, freq: 900 });
  },
  roll: (v) => hiss(v, { dur: 0.2, vol: 0.06, filter: 'bandpass', freq: 600, to: 1600, q: 1.2, attack: 0.04 }),
  wallHit: (v, p) => hiss(v, { dur: 0.04, vol: 0.05, freq: 1200 * p }),
  ratSqueak: (v, p) => tone(v, { type: 'square', freq: 1900 * p, to: 2500 * p, dur: 0.06, vol: 0.035 }),
  slimeBlorp: (v, p) => tone(v, { type: 'sine', freq: 220 * p, to: 110 * p, dur: 0.16, vol: 0.12 }),
  spit: (v, p) => {
    hiss(v, { dur: 0.08, vol: 0.08, freq: 800 * p });
    tone(v, { type: 'sine', freq: 500 * p, to: 250 * p, dur: 0.08, vol: 0.06 });
  },
  clank: (v, p) => {
    tone(v, { type: 'square', freq: 1800 * p, to: 1500 * p, dur: 0.05, vol: 0.05 });
    tone(v, { type: 'triangle', freq: 2700 * p, dur: 0.12, vol: 0.05, delay: 0.01 });
    hiss(v, { dur: 0.03, vol: 0.05, filter: 'highpass', freq: 5000 });
  },
  beetleHiss: (v, p) => hiss(v, { dur: 0.3, vol: 0.07, filter: 'bandpass', freq: 2200 * p, to: 900 * p, q: 3 }),
  matronRoar: (v, p) => {
    tone(v, { type: 'sawtooth', freq: 70 * p, to: 45 * p, dur: 0.7, vol: 0.12, attack: 0.05 });
    tone(v, { type: 'square', freq: 105 * p, to: 60 * p, dur: 0.6, vol: 0.06, attack: 0.05 });
    hiss(v, { dur: 0.6, vol: 0.08, filter: 'bandpass', freq: 500, to: 250, q: 1, attack: 0.05 });
  },
  valveTurn: (v) => {
    for (let i = 0; i < 3; i++) tone(v, { type: 'square', freq: 260 - i * 30, dur: 0.05, vol: 0.05, delay: i * 0.07 });
    hiss(v, { dur: 1.1, vol: 0.12, filter: 'highpass', freq: 2200, attack: 0.08, delay: 0.15 });
  },
  miteClick: (v, p) => {
    for (let i = 0; i < 3; i++) hiss(v, { dur: 0.015, vol: 0.06, filter: 'highpass', freq: 4000 * p, delay: i * 0.05 });
  },
  down: (v) => {
    tone(v, { type: 'triangle', freq: 440, to: 110, dur: 0.6, vol: 0.12 });
    tone(v, { type: 'triangle', freq: 330, to: 80, dur: 0.7, vol: 0.08, delay: 0.1 });
  },

  // Scavenging and the pack
  search: (v, p) => hiss(v, { dur: 0.09, vol: 0.05, filter: 'bandpass', freq: 1400 * p, q: 2 }),
  pickup: (v, p) => {
    tone(v, { type: 'triangle', freq: 880 * p, dur: 0.07, vol: 0.08 });
    tone(v, { type: 'triangle', freq: 1320 * p, dur: 0.09, vol: 0.08, delay: 0.06 });
  },
  packFull: (v) => {
    tone(v, { type: 'square', freq: 200, dur: 0.1, vol: 0.06 });
    tone(v, { type: 'square', freq: 150, dur: 0.14, vol: 0.06, delay: 0.1 });
  },
  crateBreak: (v) => {
    hiss(v, { dur: 0.25, vol: 0.18, freq: 900, to: 200 });
    for (let i = 0; i < 3; i++) tone(v, { type: 'triangle', freq: 180 - i * 30, dur: 0.06, vol: 0.08, delay: i * 0.04 });
  },
  deposit: (v) => {
    for (let i = 0; i < 4; i++) hiss(v, { dur: 0.05, vol: 0.06, filter: 'bandpass', freq: 700 + i * 150, delay: i * 0.05 });
  },
  eat: (v) => {
    for (let i = 0; i < 3; i++) hiss(v, { dur: 0.06, vol: 0.07, filter: 'bandpass', freq: 500, q: 3, delay: i * 0.11 });
    tone(v, { type: 'triangle', freq: 660, to: 990, dur: 0.15, vol: 0.06, delay: 0.35 });
  },

  // Building and crafting
  craft: (v) => {
    for (let i = 0; i < 3; i++) {
      hiss(v, { dur: 0.04, vol: 0.12, filter: 'highpass', freq: 2500, delay: i * 0.12 });
      tone(v, { type: 'triangle', freq: 1400 + i * 120, dur: 0.06, vol: 0.05, delay: i * 0.12 });
    }
    tone(v, { type: 'sine', freq: 1046, dur: 0.4, vol: 0.08, delay: 0.38 });
  },
  build: (v) => {
    for (let i = 0; i < 5; i++) hiss(v, { dur: 0.06, vol: 0.14, freq: 1200, delay: i * 0.1 });
    tone(v, { type: 'triangle', freq: 523, dur: 0.18, vol: 0.1, delay: 0.55 });
    tone(v, { type: 'triangle', freq: 659, dur: 0.18, vol: 0.1, delay: 0.68 });
    tone(v, { type: 'triangle', freq: 784, dur: 0.4, vol: 0.1, delay: 0.81 });
  },
  levelUp: (v) => {
    [523, 659, 784, 1046].forEach((f, i) => tone(v, { type: 'square', freq: f, dur: 0.16, vol: 0.06, delay: i * 0.09 }));
    tone(v, { type: 'triangle', freq: 1046, dur: 0.6, vol: 0.08, delay: 0.36 });
  },
  stepDone: (v) => {
    [392, 523, 659, 784].forEach((f, i) => tone(v, { type: 'triangle', freq: f, dur: 0.3, vol: 0.09, delay: i * 0.12 }));
    bellPartials({ ...v, t: v.t + 0.5 }, 1046, 0.08, 1.4);
  },
  plant: (v) => hiss(v, { dur: 0.25, vol: 0.08, filter: 'bandpass', freq: 400, q: 1.5 }),
  generatorHum: (v) => {
    tone(v, { type: 'sawtooth', freq: 55, to: 110, dur: 0.6, vol: 0.06, attack: 0.1 });
    tone(v, { type: 'sine', freq: 220, to: 440, dur: 0.5, vol: 0.05, attack: 0.1 });
  },
  coins: (v, p) => {
    for (let i = 0; i < 3; i++) tone(v, { type: 'triangle', freq: (1500 + i * 260) * p, dur: 0.06, vol: 0.06, delay: i * 0.05 });
  },
  stamp: (v) => {
    tone(v, { type: 'square', freq: 120, to: 50, dur: 0.18, vol: 0.16 });
    hiss(v, { dur: 0.12, vol: 0.16, freq: 900, to: 200 });
  },

  // World
  shiftBell: (v) => {
    bellPartials(v, 220, 0.16, 3.2);
    bellPartials({ ...v, t: v.t + 1.1 }, 196, 0.12, 3);
  },
  drip: (v, p) => tone(v, { type: 'sine', freq: 1500 * p, to: 700 * p, dur: 0.07, vol: 0.05 }),
  doorWhoosh: (v) => hiss(v, { dur: 0.35, vol: 0.06, filter: 'bandpass', freq: 400, to: 1200, q: 0.8, attack: 0.1 }),
  steam: (v) => hiss(v, { dur: 0.8, vol: 0.06, filter: 'highpass', freq: 3000, attack: 0.1 }),

  // Stealth and people
  suspicious: (v) => tone(v, { type: 'triangle', freq: 600, to: 760, dur: 0.18, vol: 0.06 }),
  alert: (v) => {
    tone(v, { type: 'square', freq: 660, dur: 0.08, vol: 0.08 });
    tone(v, { type: 'square', freq: 990, dur: 0.16, vol: 0.08, delay: 0.08 });
  },
  lostYou: (v) => tone(v, { type: 'triangle', freq: 500, to: 380, dur: 0.25, vol: 0.05 }),
  whistle: (v) => {
    tone(v, { type: 'sine', freq: 1900, dur: 0.25, vol: 0.1 });
    tone(v, { type: 'sine', freq: 2300, dur: 0.45, vol: 0.1, delay: 0.25 });
  },
  throw: (v) => hiss(v, { dur: 0.15, vol: 0.05, filter: 'bandpass', freq: 900, to: 2000, q: 1 }),
  pebble: (v, p) => tone(v, { type: 'triangle', freq: 1700 * p, dur: 0.04, vol: 0.06 }),
  bottleSmash: (v) => {
    hiss(v, { dur: 0.3, vol: 0.14, filter: 'highpass', freq: 3500 });
    [2600, 3300, 4100].forEach((f, i) => tone(v, { type: 'sine', freq: f, dur: 0.12, vol: 0.04, delay: 0.02 + i * 0.04 }));
  },
  shieldCharge: (v) => hiss(v, { dur: 0.5, vol: 0.1, freq: 300, to: 1200, attack: 0.2 }),
  arrow: (v) => hiss(v, { dur: 0.12, vol: 0.08, filter: 'bandpass', freq: 2500, to: 1200, q: 2 }),
  fireBurst: (v) => {
    hiss(v, { dur: 0.5, vol: 0.16, freq: 1200, to: 150 });
    tone(v, { type: 'sawtooth', freq: 120, to: 50, dur: 0.4, vol: 0.08 });
  },
  footsteps: (v) => {
    for (let i = 0; i < 6; i++) hiss(v, { dur: 0.05, vol: 0.05, freq: 300, delay: i * 0.32 });
  },

  // Interface
  uiMove: (v) => tone(v, { type: 'square', freq: 1200, dur: 0.025, vol: 0.03 }),
  uiSelect: (v) => {
    tone(v, { type: 'square', freq: 660, dur: 0.05, vol: 0.05 });
    tone(v, { type: 'square', freq: 990, dur: 0.07, vol: 0.05, delay: 0.05 });
  },
  uiBack: (v) => tone(v, { type: 'square', freq: 500, to: 350, dur: 0.07, vol: 0.04 }),
  uiDenied: (v) => tone(v, { type: 'square', freq: 160, dur: 0.12, vol: 0.05 }),
  /** Dialogue blips: pitch carries each speaker's voice. */
  blip: (v, p) => tone(v, { type: 'square', freq: 420 * p, dur: 0.03, vol: 0.025 }),
  page: (v) => hiss(v, { dur: 0.18, vol: 0.05, filter: 'bandpass', freq: 2000, to: 800, q: 1 }),
  titleSting: (v) => {
    bellPartials(v, 293.66, 0.12, 2.5);
    bellPartials({ ...v, t: v.t + 0.3 }, 440, 0.1, 2.5);
    bellPartials({ ...v, t: v.t + 0.6 }, 587.33, 0.1, 3);
  },
} satisfies Record<string, Recipe>;

export type SfxId = keyof typeof SFX;
