import type { ItemId } from './items';

// Player and weapon tuning. Distances in world pixels, times in seconds,
// damage to the goblin in half-hearts, damage to creatures in hit points.

export const PLAYER = {
  /** Five hearts. Scrapping 6 adds one more. */
  baseHearts: 5,
  bonusHeartLevel: 6,
  /** Invulnerability after taking a hit. */
  hurtIframes: 0.9,
  hurtKnockback: 170,
  /** Seconds without control after a hit. */
  hurtStun: 0.15,
  roll: {
    time: 0.3,
    speed: 235,
    /** Invulnerable for this much of the roll. Enemy shots pass straight through. */
    iframes: 0.26,
    cooldown: 0.45,
    /** Scrapping 2: faster dodge recovery. */
    fastCooldown: 0.28,
    fastCooldownLevel: 2,
    /** A roll pressed this early during the cooldown still happens when it's ready. */
    buffer: 0.15,
  },
} as const;

export type ShotKind = 'scrap' | 'nail' | 'slimeShot' | 'charged';

export interface LauncherMode {
  name: string;
  shot: ShotKind;
  /** Seconds between shots while fire is held. */
  interval: number;
  count: number;
  /** Total cone width for multi-shot modes. */
  spreadDeg: number;
  speed: number;
  damage: number;
  range: number;
  knockback: number;
  /** Projectile radius. Defaults to 2. */
  radius?: number;
  slow?: { factor: number; time: number };
}

export const LAUNCHER_MODES = {
  basic: { name: 'Scrap Launcher', shot: 'scrap', interval: 0.32, count: 1, spreadDeg: 0, speed: 270, damage: 1, range: 170, knockback: 80 },
  nailSpread: { name: 'Nail Spread', shot: 'nail', interval: 0.5, count: 3, spreadDeg: 22, speed: 250, damage: 1, range: 110, knockback: 60 },
  slimeShot: { name: 'Slime Shot', shot: 'slimeShot', interval: 0.55, count: 1, spreadDeg: 0, speed: 200, damage: 1, range: 150, knockback: 40, slow: { factor: 0.6, time: 2 } },
} as const satisfies Record<string, LauncherMode>;

export type LauncherModeId = keyof typeof LAUNCHER_MODES;
export const LAUNCHER_MODE_IDS = Object.keys(LAUNCHER_MODES) as LauncherModeId[];

/** Scrapping 4: hold right mouse to charge, release to fire one heavy shot. Works with any mod. */
export const CHARGED_SHOT = {
  level: 4,
  chargeTime: 0.7,
  mode: { name: 'Charged Shot', shot: 'charged', interval: 0, count: 1, spreadDeg: 0, speed: 300, damage: 3, range: 200, knockback: 220, radius: 3 },
} as const satisfies { level: number; chargeTime: number; mode: LauncherMode };

/** Which equipped mod item switches the launcher into which mode. */
export const MOD_MODES: Partial<Record<ItemId, LauncherModeId>> = {
  modNailSpread: 'nailSpread',
  modSlimeShot: 'slimeShot',
};

/** At most this many creatures wind up or attack at once. The rest circle and wait their turn. */
export const MAX_ATTACKERS = 2;

/** Game feel. Keep these small: punctuation, not slow motion. */
export const FEEL = {
  hitstopKill: 0.045,
  hitstopHurt: 0.07,
  shakeHit: 0.6,
  shakeKill: 1.6,
  shakeHurt: 3.2,
  shakeDecay: 14,
  damageNumberTime: 0.7,
} as const;
