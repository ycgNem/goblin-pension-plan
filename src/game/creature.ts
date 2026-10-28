import { approach, clamp } from '../core/math';
import { MAX_ATTACKERS } from '../data/combat';
import { CREATURES, type CreatureBehavior, type CreatureDef, type CreatureId } from '../data/enemies';
import { moveBody, type Body } from '../world/collision';
import { lineOfSight } from '../world/sight';
import type { TileMap } from '../world/tilemap';
import type { Projectile } from './projectiles';

/** Behaviors built so far. Beetles and the Pump Matron arrive in M6; until then their spawns stay dormant. */
export const ACTIVE_BEHAVIORS: ReadonlySet<CreatureBehavior> = new Set<CreatureBehavior>(['rat', 'slime', 'slimelet', 'mite']);

export type CreatureState = 'idle' | 'approach' | 'windup' | 'attack' | 'recover' | 'return';

/** Whoever creatures are after. For now that's always the goblin. */
export interface Target {
  x: number;
  y: number;
  hw: number;
  hh: number;
  alive: boolean;
}

/** What a creature can sense and affect. */
export interface CreatureWorld {
  readonly map: TileMap;
  readonly target: Target;
  readonly creatures: readonly Creature[];
  /** Returns false if the hit didn't land (rolling, invulnerable, already down). */
  hurtTarget(damage: number, fromX: number, fromY: number): boolean;
  spawnProjectile(p: Projectile): void;
  /** Unit direction along a walkable route from one point toward another, or null if there's none. */
  route(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number } | null;
  rng(): number;
}

const ACCEL = 600;
const FRICTION = 700;
/** Aim stops tracking this long before an attack fires, so a late sidestep dodges it. */
export const AIM_LOCK = 0.15;
/** Seconds out of sight before a chaser gives up. */
const GIVE_UP_AFTER = 3;
/** How far from home a creature will chase. */
const LEASH = 260;
/** Pack members this close join in when one of them spots the goblin. Wide enough to cover a nest. */
const PACK_RADIUS = 150;
/** How long an interrupted windup leaves a creature reeling. */
const STAGGER = 0.15;
/** Crashing into a wall mid-lunge makes the recovery this much longer. */
const WALL_RECOVER = 1.5;
/** A creature that can't find its way home within this long settles where it is. */
const RETURN_GIVE_UP = 6;

export function countAttackers(creatures: readonly Creature[]): number {
  let n = 0;
  for (const c of creatures) if (!c.dead && c.attacking) n++;
  return n;
}

/**
 * idle → approach → windup → attack → recover → approach ...
 * Creatures only deal damage during a telegraphed attack, never by touch.
 */
export class Creature implements Body {
  readonly def: CreatureDef;
  readonly hw: number;
  readonly hh: number;
  vx = 0;
  vy = 0;
  hp: number;
  state: CreatureState = 'idle';
  /** Seconds in the current state. */
  stateT = 0;
  /** Seconds alive, for animation. */
  age = 0;
  /** Direction of the current or upcoming attack, in radians. */
  aim = 0;
  /** Which way it's facing, for drawing. */
  face = 0;
  /** White hit flash. */
  flash = 0;
  stagger = 0;
  slowT = 0;
  slowFactor = 1;
  dead = false;
  private homeX: number;
  private homeY: number;
  private hasHit = false;
  private hitWall = false;
  private lastSeenX: number;
  private lastSeenY: number;
  private unseen = 0;
  private wanderX: number;
  private wanderY: number;
  private wanderT = 0;
  /** Flank angle, so pack members close in from different sides. */
  private readonly flank: number;
  /** Which way to circle while waiting for a turn to attack. */
  private readonly orbit: number;

  constructor(
    readonly id: CreatureId,
    public x: number,
    public y: number,
    rng: () => number,
    /** The map placement it came from, so a kill is remembered until the next shift. */
    readonly placementKey: string | null = null,
  ) {
    this.def = CREATURES[id];
    this.hw = this.hh = this.def.radius - 1;
    this.hp = this.def.hp;
    this.homeX = this.lastSeenX = this.wanderX = x;
    this.homeY = this.lastSeenY = this.wanderY = y;
    this.flank = (rng() - 0.5) * 1.4;
    this.orbit = rng() < 0.5 ? -1 : 1;
  }

  get radius(): number {
    return this.def.radius;
  }

  get attacking(): boolean {
    return this.state === 'windup' || this.state === 'attack';
  }

  update(dt: number, w: CreatureWorld): void {
    this.age += dt;
    this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.slowT = Math.max(0, this.slowT - dt);

    if (this.stagger > 0) {
      this.stagger -= dt;
      this.coast(dt, w.map);
      return;
    }

    const t = w.target;
    const dx = t.x - this.x;
    const dy = t.y - this.y;
    const dist = Math.hypot(dx, dy);
    // Once on the hunt, creatures keep track of the goblin from further away.
    const calm = this.state === 'idle' || this.state === 'return';
    const sightRange = calm ? this.def.aggroRange : this.def.aggroRange * 1.6;
    const sees = t.alive && dist <= sightRange && lineOfSight(w.map, this.x, this.y, t.x, t.y);
    if (sees) {
      this.lastSeenX = t.x;
      this.lastSeenY = t.y;
      this.unseen = 0;
    } else {
      this.unseen += dt;
    }

    switch (this.state) {
      case 'idle':
        if (sees) this.alert(w);
        else this.wander(dt, w);
        break;
      case 'return':
        if (sees) this.alert(w);
        else this.goHome(dt, w);
        break;
      case 'approach':
        this.chase(dt, w, dist, sees);
        break;
      case 'windup':
        this.coast(dt, w.map);
        if (t.alive && this.stateT < this.def.windup - AIM_LOCK) this.aim = Math.atan2(dy, dx);
        this.face = this.aim;
        if (this.stateT >= this.def.windup) this.release(w);
        break;
      case 'attack':
        this.lunge(dt, w);
        break;
      case 'recover':
        this.coast(dt, w.map);
        if (this.stateT >= this.def.recover * (this.hitWall ? WALL_RECOVER : 1)) this.enter('approach');
        break;
    }
  }

  /** Apply a hit. Returns true if it was fatal. */
  takeHit(damage: number, angle: number, knockback: number, w: CreatureWorld, slow?: { factor: number; time: number }): boolean {
    if (this.dead) return false;
    this.hp -= damage;
    this.flash = 0.1;
    const k = knockback * this.def.knockbackTaken;
    this.vx += Math.cos(angle) * k;
    this.vy += Math.sin(angle) * k;
    if (slow) {
      this.slowT = slow.time;
      this.slowFactor = slow.factor;
    }
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    if (this.state === 'windup' && !this.def.heavy) {
      this.stagger = STAGGER;
      this.enter('approach');
    } else if (this.state === 'idle' || this.state === 'return') {
      this.alert(w);
    }
    return false;
  }

  /** Spot the goblin. Pack members nearby join in. */
  alert(w: CreatureWorld): void {
    if (this.state !== 'idle' && this.state !== 'return') return;
    this.enter('approach');
    this.lastSeenX = w.target.x;
    this.lastSeenY = w.target.y;
    this.unseen = 0;
    if (!this.def.pack) return;
    for (const other of w.creatures) {
      if (other !== this && other.id === this.id && Math.hypot(other.x - this.x, other.y - this.y) <= PACK_RADIUS) {
        other.alert(w);
      }
    }
  }

  /** Reel for a moment (fresh from a split), then give chase. */
  daze(seconds: number, w: CreatureWorld): void {
    this.lastSeenX = w.target.x;
    this.lastSeenY = w.target.y;
    this.unseen = 0;
    this.hitWall = false;
    this.state = 'recover';
    this.stateT = this.def.recover - seconds;
  }

  private enter(state: CreatureState): void {
    this.state = state;
    this.stateT = 0;
  }

  private chase(dt: number, w: CreatureWorld, dist: number, sees: boolean): void {
    const t = w.target;
    const fromHome = Math.hypot(this.x - this.homeX, this.y - this.homeY);
    if (!t.alive || this.unseen > GIVE_UP_AFTER || fromHome > LEASH) {
      this.enter('return');
      return;
    }

    const speed = this.def.speed * this.speedFactor();
    if (!sees) {
      // Head for where the goblin was last seen, around whatever is in the way.
      this.travel(this.lastSeenX, this.lastSeenY, speed, dt, w);
      return;
    }

    const toward = Math.atan2(t.y - this.y, t.x - this.x);
    const spit = this.def.spit;
    if (spit && dist < spit.keepAway) {
      this.steerAngle(toward + Math.PI, speed, dt, w.map);
      return;
    }
    if (dist <= this.def.attackRange) {
      if (countAttackers(w.creatures) < MAX_ATTACKERS) {
        this.aim = toward;
        this.face = toward;
        this.enter('windup');
        this.coast(dt, w.map);
      } else {
        // Wait for a turn, circling at a polite distance.
        this.steerAngle(toward + this.orbit * Math.PI * 0.5, speed * 0.5, dt, w.map);
      }
      return;
    }
    // Close in, curving out to the flank while still far away.
    const flank = this.flank * clamp((dist - this.def.attackRange) / 80, 0, 1);
    this.steerAngle(toward + flank, speed, dt, w.map);
  }

  private release(w: CreatureWorld): void {
    this.hasHit = false;
    this.hitWall = false;
    const { spit, lunge } = this.def;
    if (spit) {
      const cos = Math.cos(this.aim);
      const sin = Math.sin(this.aim);
      w.spawnProjectile({
        kind: 'gel', owner: 'enemy',
        x: this.x + cos * this.def.radius, y: this.y + sin * this.def.radius,
        vx: cos * spit.speed, vy: sin * spit.speed,
        travelled: 0, range: spit.range, radius: 3, damage: this.def.damage, knockback: 0, dead: false,
      });
      this.enter('recover');
    } else if (lunge) {
      this.enter('attack');
    } else {
      this.enter('recover');
    }
  }

  private lunge(dt: number, w: CreatureWorld): void {
    const lunge = this.def.lunge;
    if (!lunge) {
      this.enter('recover');
      return;
    }
    const slow = this.slowT > 0 ? this.slowFactor : 1;
    this.vx = Math.cos(this.aim) * lunge.speed * slow;
    this.vy = Math.sin(this.aim) * lunge.speed * slow;
    const hit = moveBody(this, this.vx * dt, this.vy * dt, w.map, 'creature');

    if (!this.hasHit && w.target.alive && this.touches(w.target)) {
      this.hasHit = w.hurtTarget(this.def.damage, this.x, this.y);
      if (this.hasHit) {
        this.endLunge();
        return;
      }
    }
    if (hit.hitX || hit.hitY) {
      this.hitWall = true;
      this.vx = 0;
      this.vy = 0;
      this.enter('recover');
      return;
    }
    if (this.stateT >= lunge.time) this.endLunge();
  }

  private endLunge(): void {
    this.vx *= 0.25;
    this.vy *= 0.25;
    this.enter('recover');
  }

  private touches(t: Target): boolean {
    return Math.abs(t.x - this.x) < t.hw + this.hw && Math.abs(t.y - this.y) < t.hh + this.hh;
  }

  private wander(dt: number, w: CreatureWorld): void {
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 1.5 + w.rng() * 1.5;
      const a = w.rng() * Math.PI * 2;
      const r = w.rng() * 20;
      this.wanderX = this.homeX + Math.cos(a) * r;
      this.wanderY = this.homeY + Math.sin(a) * r;
    }
    const dx = this.wanderX - this.x;
    const dy = this.wanderY - this.y;
    if (Math.hypot(dx, dy) > 2) this.steer(dx, dy, this.def.speed * 0.3, dt, w.map);
    else this.coast(dt, w.map);
  }

  private goHome(dt: number, w: CreatureWorld): void {
    if (Math.hypot(this.homeX - this.x, this.homeY - this.y) < 4 || this.stateT > RETURN_GIVE_UP) {
      // Back home (or somehow stuck): settle in and lick its wounds.
      this.homeX = this.x;
      this.homeY = this.y;
      this.hp = this.def.hp;
      this.enter('idle');
      return;
    }
    this.travel(this.homeX, this.homeY, this.def.speed * 0.7, dt, w);
  }

  /** Walk toward a point, routing around walls and props. */
  private travel(tx: number, ty: number, speed: number, dt: number, w: CreatureWorld): void {
    const dir = w.route(this.x, this.y, tx, ty);
    if (dir) this.steer(dir.x, dir.y, speed, dt, w.map);
    else this.steer(tx - this.x, ty - this.y, speed, dt, w.map);
  }

  /** Slow effects, and the hop rhythm of slimes. */
  private speedFactor(): number {
    const slow = this.slowT > 0 ? this.slowFactor : 1;
    const b = this.def.behavior;
    const hop = b === 'slime' || b === 'slimelet' ? 0.35 + 0.65 * Math.max(0, Math.sin(this.age * 7)) : 1;
    return slow * hop;
  }

  private steer(dx: number, dy: number, speed: number, dt: number, map: TileMap): void {
    const len = Math.hypot(dx, dy);
    const tx = len > 0 ? (dx / len) * speed : 0;
    const ty = len > 0 ? (dy / len) * speed : 0;
    this.vx = approach(this.vx, tx, ACCEL * dt);
    this.vy = approach(this.vy, ty, ACCEL * dt);
    this.move(dt, map);
    if (Math.hypot(this.vx, this.vy) > 5) this.face = Math.atan2(this.vy, this.vx);
  }

  private steerAngle(angle: number, speed: number, dt: number, map: TileMap): void {
    this.steer(Math.cos(angle), Math.sin(angle), speed, dt, map);
  }

  private coast(dt: number, map: TileMap): void {
    this.vx = approach(this.vx, 0, FRICTION * dt);
    this.vy = approach(this.vy, 0, FRICTION * dt);
    this.move(dt, map);
  }

  private move(dt: number, map: TileMap): void {
    const hit = moveBody(this, this.vx * dt, this.vy * dt, map, 'creature');
    if (hit.hitX) this.vx = 0;
    if (hit.hitY) this.vy = 0;
  }
}
