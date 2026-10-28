import type { ItemId } from './items';

// Creatures fight in the open. Humans have vision, awareness, and long telegraphs.
// Distances are in world pixels (one tile = 16px). Damage to the goblin is in half-hearts.

export interface Drop {
  item: ItemId;
  min: number;
  max: number;
  chance: number;
}

export type CreatureBehavior = 'rat' | 'slime' | 'slimelet' | 'mite' | 'beetle' | 'matron';

export interface CreatureDef {
  name: string;
  desc: string;
  behavior: CreatureBehavior;
  /** Placeholder body color, and the color of its death burst. */
  color: string;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  /** Seconds of visible warning before an attack lands. */
  windup: number;
  xp: number;
  drops: readonly Drop[];
  /** Starts chasing when the goblin is this close and in sight. */
  aggroRange: number;
  /** Starts its windup at this distance. */
  attackRange: number;
  /** Seconds of recovery after an attack: the punish window. */
  recover: number;
  /** Dash attacks: bites, hops, charges. */
  lunge?: { speed: number; time: number };
  /** Ranged attacks: one blob aimed at the goblin, fired from at least `keepAway` away. */
  spit?: { speed: number; range: number; keepAway: number };
  /** Hits don't knock heavy creatures out of their windup. */
  heavy?: boolean;
  /** Multiplier on knockback received. */
  knockbackTaken: number;
  /** Pack members join in when one of them spots the goblin. */
  pack?: boolean;
  /** Shots that hit the front 120 degrees are deflected. */
  armoredFront?: boolean;
  splitsInto?: { creature: string; count: number };
}

export const CREATURES = {
  drainRat: {
    name: 'Drain Rat', behavior: 'rat', color: '#8a6a58', hp: 3, speed: 80, radius: 5, damage: 1, windup: 0.45, xp: 6,
    desc: 'Fast, in packs. Flashes before it bites.',
    drops: [{ item: 'bone', min: 1, max: 1, chance: 0.6 }],
    aggroRange: 120, attackRange: 34, recover: 0.55, lunge: { speed: 230, time: 0.16 }, knockbackTaken: 0.4, pack: true,
  },
  slime: {
    name: 'Slime', behavior: 'slime', color: '#6fd06f', hp: 6, speed: 30, radius: 7, damage: 1, windup: 0.6, xp: 8,
    desc: 'Slow. Splits when popped.',
    drops: [{ item: 'slimeGel', min: 1, max: 2, chance: 1 }],
    aggroRange: 90, attackRange: 30, recover: 0.8, lunge: { speed: 120, time: 0.3 }, heavy: true, knockbackTaken: 0.5,
    splitsInto: { creature: 'slimelet', count: 2 },
  },
  slimelet: {
    name: 'Slimelet', behavior: 'slimelet', color: '#8fe07f', hp: 2, speed: 30, radius: 4, damage: 1, windup: 0.8, xp: 2,
    desc: 'Spits short gel blobs. Small and cross.',
    drops: [{ item: 'slimeGel', min: 1, max: 1, chance: 0.3 }],
    aggroRange: 120, attackRange: 95, recover: 1.1, spit: { speed: 110, range: 110, keepAway: 48 }, knockbackTaken: 1.3,
  },
  boneMite: {
    name: 'Bone Mite', behavior: 'mite', color: '#e8e0c8', hp: 4, speed: 40, radius: 5, damage: 1, windup: 0.5, xp: 10,
    desc: 'Shakes, then charges in a straight line.',
    drops: [{ item: 'bone', min: 1, max: 2, chance: 0.8 }],
    aggroRange: 120, attackRange: 80, recover: 0.8, lunge: { speed: 210, time: 0.4 }, heavy: true, knockbackTaken: 0.7,
  },
  scrapbackBeetle: {
    name: 'Scrapback Beetle', behavior: 'beetle', color: '#b0703a', hp: 10, speed: 26, radius: 8, damage: 2, windup: 0.7, xp: 18,
    desc: 'Armored front. Soft behind. Turns slowly.',
    armoredFront: true,
    drops: [{ item: 'scrap', min: 1, max: 2, chance: 1 }, { item: 'copper', min: 1, max: 1, chance: 0.25 }],
    aggroRange: 100, attackRange: 28, recover: 0.9, lunge: { speed: 140, time: 0.2 }, heavy: true, knockbackTaken: 0.2,
  },
  pumpMatron: {
    name: 'The Pump Matron', behavior: 'matron', color: '#d0482a', hp: 80, speed: 50, radius: 20, damage: 3, windup: 0.9, xp: 120,
    desc: 'Grew the pump flywheel into her shell. Very protective of it.',
    armoredFront: true,
    drops: [{ item: 'flywheelCoil', min: 1, max: 1, chance: 1 }, { item: 'copper', min: 3, max: 3, chance: 1 }],
    aggroRange: 200, attackRange: 120, recover: 1.4, lunge: { speed: 260, time: 0.6 }, heavy: true, knockbackTaken: 0,
  },
} as const satisfies Record<string, CreatureDef>;

export type CreatureId = keyof typeof CREATURES;

export type HumanRole = 'hero' | 'worker' | 'guard';
export type HumanAttack = 'shieldCharge' | 'aimedShot' | 'fireCircle' | 'baton';

export interface HumanDef {
  name: string;
  role: HumanRole;
  hp: number;
  speed: number;
  radius: number;
  vision: { range: number; halfAngleDeg: number };
  /** Seconds of continuous sight (at the cone center, close up) for suspicion to fill. */
  suspicionTime: number;
  /** Seconds a hostile NPC searches after losing sight before going back to its route. */
  searchTime: number;
  attack?: { kind: HumanAttack; damage: number; windup: number; cooldown: number; range: number };
  /** Workers flee and whistle instead of fighting. */
  flees?: boolean;
}

export const HUMANS = {
  paladin: {
    name: 'Paladin', role: 'hero', hp: 40, speed: 42, radius: 7,
    vision: { range: 120, halfAngleDeg: 40 }, suspicionTime: 1.2, searchTime: 6,
    attack: { kind: 'shieldCharge', damage: 3, windup: 0.8, cooldown: 2.5, range: 96 },
  },
  ranger: {
    name: 'Ranger', role: 'hero', hp: 24, speed: 46, radius: 6,
    vision: { range: 150, halfAngleDeg: 30 }, suspicionTime: 1.0, searchTime: 6,
    attack: { kind: 'aimedShot', damage: 2, windup: 1.3, cooldown: 2.2, range: 160 },
  },
  apprentice: {
    name: 'Apprentice', role: 'hero', hp: 18, speed: 40, radius: 6,
    vision: { range: 110, halfAngleDeg: 45 }, suspicionTime: 1.4, searchTime: 6,
    attack: { kind: 'fireCircle', damage: 2, windup: 1.2, cooldown: 3.0, range: 120 },
  },
  inspector: {
    name: 'Pipe Inspector', role: 'worker', hp: 10, speed: 34, radius: 6,
    vision: { range: 90, halfAngleDeg: 50 }, suspicionTime: 1.6, searchTime: 4, flees: true,
  },
  guard: {
    name: 'Watch Guard', role: 'guard', hp: 20, speed: 36, radius: 7,
    vision: { range: 100, halfAngleDeg: 40 }, suspicionTime: 1.4, searchTime: 3,
    attack: { kind: 'baton', damage: 2, windup: 0.7, cooldown: 1.6, range: 18 },
  },
} as const satisfies Record<string, HumanDef>;

export type HumanId = keyof typeof HUMANS;
