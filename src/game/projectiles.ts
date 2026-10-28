import type { ShotKind } from '../data/combat';
import type { TileMap } from '../world/tilemap';
import { TILE } from '../world/tiles';

export type ProjectileKind = ShotKind | 'gel' | 'arrow';

export interface Projectile {
  kind: ProjectileKind;
  /** player: the goblin's shots. enemy: creature spit. hero: arrows, which hit creatures and the goblin. */
  owner: 'player' | 'enemy' | 'hero';
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Distance travelled so far, and how far it can go. */
  travelled: number;
  range: number;
  radius: number;
  damage: number;
  knockback: number;
  slow?: { factor: number; time: number };
  dead: boolean;
}

/** Sub-step size, so fast shots can't skip over a wall. */
const STEP = 4;

/** Advance a projectile. Returns 'wall' when it hits something solid and 'spent' at the end of its range. */
export function stepProjectile(p: Projectile, dt: number, map: TileMap): 'flying' | 'wall' | 'spent' {
  const speed = Math.hypot(p.vx, p.vy);
  if (speed === 0) return 'spent';
  const ux = p.vx / speed;
  const uy = p.vy / speed;
  let remaining = speed * dt;
  while (remaining > 0) {
    const d = Math.min(STEP, remaining, p.range - p.travelled);
    p.x += ux * d;
    p.y += uy * d;
    p.travelled += d;
    remaining -= d;
    if (map.blocksSight(Math.floor(p.x / TILE), Math.floor(p.y / TILE))) return 'wall';
    if (p.travelled >= p.range) return 'spent';
  }
  return 'flying';
}
