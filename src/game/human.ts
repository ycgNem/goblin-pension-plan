import { approach, clamp, lerp } from '../core/math';
import { HUMANS, type HumanAttack, type HumanDef, type HumanId } from '../data/enemies';
import { BARKS, type SpeakerId } from '../data/story';
import { moveBody, type Body } from '../world/collision';
import { lineOfSight } from '../world/sight';
import type { TileMap } from '../world/tilemap';
import { TILE } from '../world/tiles';
import type { Creature, Target } from './creature';
import type { Projectile } from './projectiles';

// People. They don't know where you are: they see in a cone, hear noises, get suspicious,
// and only turn hostile once the meter fills. Losing them always works: they search for a few
// seconds, give up, and walk back to what they were doing. They never use crawlspaces or exits.

export type Awareness = 'unaware' | 'suspicious' | 'searching' | 'hostile' | 'returning';
export type HumanTask = 'route' | 'work' | 'leave' | 'flee' | 'gone';
export type AttackPhase = 'ready' | 'windup' | 'active' | 'cooldown';

/** What people can tell about the goblin. `hidden` means it slipped into cover unseen. */
export interface GoblinSense {
  x: number;
  y: number;
  alive: boolean;
  hidden: boolean;
  sneaking: boolean;
  /** Current speed in px/s. */
  speed: number;
}

export interface HumanWorld {
  readonly map: TileMap;
  readonly goblin: GoblinSense;
  readonly creatures: readonly Creature[];
  /** Unit direction along a human-walkable route, or null if there's none. */
  humanRoute(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number } | null;
  hurtGoblin(damage: number, fromX: number, fromY: number): boolean;
  hurtCreature(c: Creature, damage: number, angle: number, knockback: number): void;
  spawnProjectile(p: Projectile): void;
  say(h: Human, text: string): void;
  /** Hostile for the first time this encounter. */
  spotted(h: Human): void;
  /** Hobb's whistle. */
  alarm(h: Human): void;
  /** A hero attack landed somewhere (for effects and sound). */
  attackEffect(h: Human, kind: HumanAttack, x: number, y: number): void;
  rng(): number;
}

export const HUMAN_SPEAKER: Record<HumanId, SpeakerId> = {
  paladin: 'aldous',
  ranger: 'wren',
  apprentice: 'pemberton',
  inspector: 'hobb',
  guard: 'guard',
};

/** How hard hero attacks hit creatures. */
export const VS_CREATURE: Record<HumanAttack, number> = { shieldCharge: 4, aimedShot: 3, fireCircle: 3, baton: 2 };

export const CHARGE_SPEED = 240;
export const FIRE_RADIUS = 22;
/** The ranger's aim line stops tracking this long before the shot. */
export const AIM_LOCK = 0.3;
const ARROW_SPEED = 330;
/** Chasing, people are faster than they patrol, but never as fast as a running goblin. */
const CHASE_FACTOR = 1.5;
/** Out of sight this long, a hostile human starts searching. */
const LOSE_SIGHT_AFTER = 0.5;
/** Longest a searcher walks toward the last sighting before searching where it stands. */
export const SEARCH_TRAVEL_MAX = 7;
/** People notice a goblin bumping into them, whichever way they face. */
const TOUCH_SENSE = 20;
const ARRIVE = 8;
const ACCEL = 500;
const FRICTION = 600;

function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export class Human implements Body {
  readonly def: HumanDef;
  readonly hw: number;
  readonly hh: number;
  vx = 0;
  vy = 0;
  /** Facing, in radians. Vision cones point this way. */
  face = Math.PI / 2;
  hp: number;
  flash = 0;
  awareness: Awareness = 'unaware';
  /** 0..1. Hostile at 1. */
  suspicion = 0;
  stateT = 0;
  task: HumanTask = 'route';
  /** Can see the goblin this tick. */
  sees = false;
  lastKnown = { x: 0, y: 0 };
  private unseen = 0;
  private searchPhase: 'travel' | 'look' = 'travel';
  private searchT = 0;
  private lookBase = 0;
  /** Route to walk, in world pixels. */
  waypoints: { x: number; y: number }[] = [];
  wp = 0;
  leader: Human | null = null;
  slot = { back: 0, side: 0 };
  /** Where to return to after a search. Moves along with the route. */
  home = { x: 0, y: 0 };
  /** The access point it came in by, and leaves by. */
  exit = { x: 0, y: 0 };
  workFace = Math.PI / 2;
  attack: AttackPhase = 'ready';
  attackT = 0;
  /** Direction of the current attack. */
  aim = 0;
  /** Where a fire circle lands. */
  aimAt = { x: 0, y: 0 };
  foe: Creature | 'goblin' | null = null;
  private chargeLeft = 0;
  private chargeHit = new Set<object>();
  private barkCd = 0;
  private hostileOnce = false;
  retreating = false;
  readonly target: Target;
  age = 0;

  constructor(readonly id: HumanId, public x: number, public y: number) {
    this.def = HUMANS[id];
    this.hw = this.hh = this.def.radius - 1;
    this.hp = this.def.hp;
    this.home = { x, y };
    this.exit = { x, y };
    this.target = { x, y, hw: this.hw, hh: this.hh, alive: true };
  }

  get gone(): boolean {
    return this.task === 'gone';
  }

  update(dt: number, w: HumanWorld): void {
    this.age += dt;
    this.stateT += dt;
    this.barkCd -= dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.gone) return;

    this.sees = this.canSee(w);
    this.updateAwareness(dt, w);
    this.target.x = this.x;
    this.target.y = this.y;
    this.target.alive = !this.gone;

    if (this.attack !== 'ready') {
      this.updateAttack(dt, w);
      if (this.attack === 'windup' || this.attack === 'active') return;
    }

    if (this.task === 'flee') {
      this.goToExit(dt, w, this.def.speed * 1.8);
      return;
    }
    switch (this.awareness) {
      case 'hostile':
        this.chase(dt, w);
        return;
      case 'searching':
        this.search(dt, w);
        return;
      case 'suspicious':
        this.coast(dt, w.map);
        this.turnToward(this.lastKnown.x, this.lastKnown.y, dt, 6);
        return;
      case 'returning':
        if (!this.walkTo(this.home.x, this.home.y, this.def.speed, dt, w) || this.dist(this.home) < ARRIVE) this.enter('unaware');
        return;
      case 'unaware':
        this.doTask(dt, w);
    }
  }

  // ---------------------------------------------------------------- senses

  canSee(w: HumanWorld): boolean {
    const g = w.goblin;
    if (!g.alive || g.hidden || this.retreating) return false;
    const dx = g.x - this.x;
    const dy = g.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= TOUCH_SENSE) return true;
    if (d > this.def.vision.range) return false;
    if (angleDiff(Math.atan2(dy, dx), this.face) > (this.def.vision.halfAngleDeg * Math.PI) / 180) return false;
    return lineOfSight(w.map, this.x, this.y - 4, g.x, g.y);
  }

  /** Suspicion gained per second while the goblin is in view. */
  suspicionRate(w: HumanWorld): number {
    const g = w.goblin;
    const d = Math.hypot(g.x - this.x, g.y - this.y);
    const off = angleDiff(Math.atan2(g.y - this.y, g.x - this.x), this.face) / ((this.def.vision.halfAngleDeg * Math.PI) / 180);
    const dist = lerp(1.7, 0.5, clamp(d / this.def.vision.range, 0, 1));
    const center = lerp(1.3, 0.7, clamp(off, 0, 1));
    const move = g.speed > 70 ? 1.35 : g.speed > 8 ? 1 : 0.65;
    const sneak = g.sneaking ? 0.5 : 1;
    const mood = this.awareness === 'returning' ? 0.5 : this.awareness === 'searching' ? 1.8 : 1;
    return (dist * center * move * sneak * mood) / this.def.suspicionTime;
  }

  /** A noise at (x, y). People look; loud noises get investigated. */
  hear(x: number, y: number, radius: number): void {
    if (this.gone || this.retreating || this.task === 'flee') return;
    if (Math.hypot(x - this.x, y - this.y) > radius) return;
    if (this.awareness === 'hostile') {
      if (!this.sees) this.lastKnown = { x, y };
      return;
    }
    this.lastKnown = { x, y };
    this.suspicion = Math.max(this.suspicion, 0.3);
    if (radius >= 90 || this.awareness === 'searching') this.startSearch();
    else if (this.awareness !== 'suspicious') this.enter('suspicious');
  }

  private updateAwareness(dt: number, w: HumanWorld): void {
    const g = w.goblin;
    if (this.sees) {
      this.lastKnown = { x: g.x, y: g.y };
      this.unseen = 0;
    } else this.unseen += dt;

    switch (this.awareness) {
      case 'unaware':
      case 'returning':
        if (this.sees) {
          this.suspicion += this.suspicionRate(w) * dt;
          if (this.suspicion > 0.04) this.enter('suspicious');
        }
        break;
      case 'suspicious':
        if (this.sees) {
          this.suspicion += this.suspicionRate(w) * dt;
          if (this.suspicion >= 1) this.becomeHostile(w);
          else if (this.stateT > 0.2 && this.barkCd <= 0) this.bark(w, 'suspicious');
        } else {
          this.suspicion -= 0.35 * dt;
          if (this.suspicion <= 0) {
            this.suspicion = 0;
            this.enter(this.dist(this.home) > ARRIVE * 2 ? 'returning' : 'unaware');
          }
        }
        break;
      case 'searching':
        if (this.sees) {
          this.suspicion += this.suspicionRate(w) * dt;
          if (this.suspicion >= 1) this.becomeHostile(w);
        }
        break;
      case 'hostile':
        if (!this.sees && this.unseen > LOSE_SIGHT_AFTER) this.startSearch();
        break;
    }
  }

  /** Straight to hostile: the goblin shot at them, or a teammate shouted. */
  becomeHostile(w: HumanWorld, x = w.goblin.x, y = w.goblin.y): void {
    if (this.gone || this.retreating) return;
    const first = this.awareness !== 'hostile';
    this.suspicion = 1;
    this.lastKnown = { x, y };
    this.unseen = this.sees ? 0 : this.unseen;
    if (!first) return;
    this.enter('hostile');
    if (this.def.flees) {
      this.task = 'flee';
      this.say(w, 'hobbFlee');
      w.alarm(this);
      return;
    }
    this.bark(w, this.id === 'guard' ? 'guardHostile' : 'hostile', true);
    if (!this.hostileOnce) w.spotted(this);
    this.hostileOnce = true;
  }

  private startSearch(): void {
    this.enter('searching');
    this.searchPhase = 'travel';
    this.searchT = 0;
  }

  private enter(a: Awareness): void {
    this.awareness = a;
    this.stateT = 0;
  }

  // ---------------------------------------------------------------- behaviors

  private chase(dt: number, w: HumanWorld): void {
    const g = w.goblin;
    const d = Math.hypot(g.x - this.x, g.y - this.y);
    this.turnToward(g.x, g.y, dt, 10);
    const a = this.def.attack;
    if (a && this.attack === 'ready' && this.sees && d <= a.range) {
      this.startAttack('goblin', g.x, g.y);
      return;
    }
    const want = a ? (a.kind === 'baton' ? 10 : a.range * 0.6) : 40;
    if (d > want) this.walkTo(this.lastKnown.x, this.lastKnown.y, this.def.speed * CHASE_FACTOR, dt, w);
    else this.coast(dt, w.map);
  }

  private search(dt: number, w: HumanWorld): void {
    if (this.searchPhase === 'travel') {
      this.searchT += dt;
      const arrived = this.dist(this.lastKnown) < ARRIVE;
      const moving = !arrived && this.walkTo(this.lastKnown.x, this.lastKnown.y, this.def.speed * 1.2, dt, w);
      if (arrived || !moving || this.searchT > SEARCH_TRAVEL_MAX) {
        this.searchPhase = 'look';
        this.searchT = 0;
        this.lookBase = this.face;
      }
      return;
    }
    this.searchT += dt;
    this.coast(dt, w.map);
    this.face = this.lookBase + Math.sin(this.searchT * 2.2) * 1.4;
    if (this.searchT >= this.def.searchTime) {
      this.suspicion = 0;
      this.enter('returning');
      this.bark(w, this.id === 'guard' ? 'guardLost' : 'lost', true);
    }
  }

  private doTask(dt: number, w: HumanWorld): void {
    switch (this.task) {
      case 'route': {
        if (this.engageCreatures(dt, w)) return;
        if (this.leader && !this.leader.gone) this.followLeader(dt, w);
        else this.followRoute(dt, w);
        return;
      }
      case 'work':
        if (this.engageCreatures(dt, w)) return;
        if (this.dist(this.home) > ARRIVE) {
          this.walkTo(this.home.x, this.home.y, this.def.speed, dt, w);
          return;
        }
        this.coast(dt, w.map);
        this.face = approachAngle(this.face, this.workFace, dt * 3);
        if (this.id === 'inspector' && this.barkCd <= 0 && w.rng() < 0.01) this.bark(w, 'hobbWork', true);
        return;
      case 'leave':
        this.goToExit(dt, w, this.def.speed * (this.retreating ? 1.6 : 1));
        return;
      default:
        return;
    }
  }

  private followRoute(dt: number, w: HumanWorld): void {
    const next = this.waypoints[this.wp];
    if (!next) {
      this.coast(dt, w.map);
      return;
    }
    this.walkTo(next.x, next.y, this.def.speed, dt, w);
    this.home = { x: this.x, y: this.y };
    if (this.dist(next) < ARRIVE) this.wp++;
  }

  private followLeader(dt: number, w: HumanWorld): void {
    const L = this.leader!;
    const fx = Math.cos(L.face);
    const fy = Math.sin(L.face);
    let tx = L.x - fx * this.slot.back - fy * this.slot.side;
    let ty = L.y - fy * this.slot.back + fx * this.slot.side;
    if (w.map.isBlocked(Math.floor(tx / TILE), Math.floor(ty / TILE), 'human')) {
      tx = L.x - fx * this.slot.back;
      ty = L.y - fy * this.slot.back;
    }
    const d = Math.hypot(tx - this.x, ty - this.y);
    if (d > 5) this.walkTo(tx, ty, this.def.speed * (d > 40 ? 1.4 : 1.05), dt, w);
    else {
      this.coast(dt, w.map);
      this.face = approachAngle(this.face, L.face, dt * 4);
    }
    this.home = { x: this.x, y: this.y };
  }

  private goToExit(dt: number, w: HumanWorld, speed: number): void {
    if (this.dist(this.exit) < ARRIVE + 2) {
      this.task = 'gone';
      return;
    }
    if (!this.walkTo(this.exit.x, this.exit.y, speed, dt, w)) this.task = 'gone';
  }

  /** Heroes fight creatures they run into. Returns true while busy with one. */
  private engageCreatures(dt: number, w: HumanWorld): boolean {
    const a = this.def.attack;
    if (!a || this.def.role === 'worker') return false;
    let best: Creature | null = null;
    let bestD = Infinity;
    for (const c of w.creatures) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - this.x, c.y - this.y);
      if (d < bestD && d < 140 && lineOfSight(w.map, this.x, this.y - 4, c.x, c.y)) {
        best = c;
        bestD = d;
      }
    }
    if (!best) return false;
    this.turnToward(best.x, best.y, dt, 10);
    if (this.attack === 'ready' && bestD <= a.range) {
      this.startAttack(best, best.x, best.y);
      return true;
    }
    if (bestD > a.range * 0.7) this.walkTo(best.x, best.y, this.def.speed * 1.2, dt, w);
    else this.coast(dt, w.map);
    return true;
  }

  // ---------------------------------------------------------------- attacks

  private startAttack(foe: Creature | 'goblin', x: number, y: number): void {
    this.attack = 'windup';
    this.attackT = 0;
    this.foe = foe;
    this.aim = Math.atan2(y - this.y, x - this.x);
    this.aimAt = { x, y };
    this.chargeHit.clear();
  }

  private foePos(w: HumanWorld): { x: number; y: number } | null {
    if (this.foe === 'goblin') return w.goblin.alive ? { x: w.goblin.x, y: w.goblin.y } : null;
    if (this.foe && !this.foe.dead) return { x: this.foe.x, y: this.foe.y };
    return null;
  }

  private updateAttack(dt: number, w: HumanWorld): void {
    const a = this.def.attack;
    if (!a) {
      this.attack = 'ready';
      return;
    }
    this.attackT += dt;
    switch (this.attack) {
      case 'windup': {
        this.coast(dt, w.map);
        const p = this.foePos(w);
        if (!p && this.foe !== 'goblin') {
          // The target died during the windup (another hero got it).
          this.attack = 'cooldown';
          this.attackT = a.cooldown * 0.7;
          return;
        }
        if (p) {
          const lockAt = a.kind === 'aimedShot' ? a.windup - AIM_LOCK : a.kind === 'fireCircle' ? 0 : a.windup * 0.7;
          if (this.attackT < lockAt) this.aim = Math.atan2(p.y - this.y, p.x - this.x);
        }
        if (a.kind !== 'fireCircle') this.face = this.aim;
        if (this.attackT >= a.windup) this.release(w, a.kind, a.damage, a.range);
        return;
      }
      case 'active':
        this.charge(dt, w, a.damage);
        return;
      case 'cooldown':
        this.coast(dt, w.map);
        if (this.attackT >= a.cooldown) this.attack = 'ready';
        return;
      default:
        return;
    }
  }

  private release(w: HumanWorld, kind: HumanAttack, damage: number, range: number): void {
    this.attackT = 0;
    switch (kind) {
      case 'shieldCharge':
        this.attack = 'active';
        this.chargeLeft = range;
        w.attackEffect(this, kind, this.x, this.y);
        return;
      case 'aimedShot':
        w.spawnProjectile({
          kind: 'arrow', owner: 'hero', x: this.x + Math.cos(this.aim) * 8, y: this.y - 6 + Math.sin(this.aim) * 8,
          vx: Math.cos(this.aim) * ARROW_SPEED, vy: Math.sin(this.aim) * ARROW_SPEED,
          travelled: 0, range: range + 40, radius: 2, damage, knockback: 60, dead: false,
        });
        w.attackEffect(this, kind, this.x, this.y);
        break;
      case 'fireCircle': {
        const { x, y } = this.aimAt;
        const g = w.goblin;
        if (g.alive && Math.hypot(g.x - x, g.y - y) <= FIRE_RADIUS) w.hurtGoblin(damage, x, y);
        for (const c of w.creatures) {
          if (!c.dead && Math.hypot(c.x - x, c.y - y) <= FIRE_RADIUS + c.radius) w.hurtCreature(c, VS_CREATURE.fireCircle, Math.atan2(c.y - y, c.x - x), 120);
        }
        w.attackEffect(this, kind, x, y);
        break;
      }
      case 'baton': {
        const reach = range + 6;
        const g = w.goblin;
        const inFront = (tx: number, ty: number) => Math.hypot(tx - this.x, ty - this.y) <= reach && angleDiff(Math.atan2(ty - this.y, tx - this.x), this.aim) < 1.1;
        if (g.alive && inFront(g.x, g.y)) w.hurtGoblin(damage, this.x, this.y);
        for (const c of w.creatures) if (!c.dead && inFront(c.x, c.y)) w.hurtCreature(c, VS_CREATURE.baton, this.aim, 100);
        w.attackEffect(this, kind, this.x + Math.cos(this.aim) * reach, this.y + Math.sin(this.aim) * reach);
        break;
      }
    }
    this.attack = 'cooldown';
  }

  /** The Paladin's shield charge: a straight dash that hits everything in the way once. */
  private charge(dt: number, w: HumanWorld, damage: number): void {
    const step = Math.min(CHARGE_SPEED * dt, this.chargeLeft);
    this.chargeLeft -= step;
    this.vx = Math.cos(this.aim) * CHARGE_SPEED;
    this.vy = Math.sin(this.aim) * CHARGE_SPEED;
    const hit = moveBody(this, Math.cos(this.aim) * step, Math.sin(this.aim) * step, w.map, 'human');
    const g = w.goblin;
    if (g.alive && !this.chargeHit.has(g) && Math.abs(g.x - this.x) < this.hw + 6 && Math.abs(g.y - this.y) < this.hh + 6) {
      this.chargeHit.add(g);
      w.hurtGoblin(damage, this.x, this.y);
    }
    for (const c of w.creatures) {
      if (c.dead || this.chargeHit.has(c)) continue;
      if (Math.hypot(c.x - this.x, c.y - this.y) < this.hw + c.radius + 2) {
        this.chargeHit.add(c);
        w.hurtCreature(c, VS_CREATURE.shieldCharge, this.aim, 220);
      }
    }
    if (hit.hitX || hit.hitY || this.chargeLeft <= 0) {
      this.vx *= 0.2;
      this.vy *= 0.2;
      this.attack = 'cooldown';
      this.attackT = 0;
    }
  }

  // ---------------------------------------------------------------- being hit

  /** Hit by something. The goblin's shots make them hostile on the spot. */
  takeHit(damage: number, w: HumanWorld, byGoblin: boolean): void {
    if (this.gone) return;
    this.hp -= damage;
    this.flash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0;
      this.retreating = true;
      return;
    }
    if (byGoblin) this.becomeHostile(w);
  }

  /** Give up and leave by the way they came. */
  retreat(): void {
    if (this.gone) return;
    this.retreating = true;
    this.task = 'leave';
    this.awareness = 'unaware';
    this.attack = 'ready';
  }

  // ---------------------------------------------------------------- movement

  /** Walk toward a point along a human route. False if there's no way there. */
  walkTo(tx: number, ty: number, speed: number, dt: number, w: HumanWorld): boolean {
    const dir = w.humanRoute(this.x, this.y, tx, ty);
    if (dir) this.steer(dir.x, dir.y, speed, dt, w.map);
    else if (Math.hypot(tx - this.x, ty - this.y) < TILE) this.steer(tx - this.x, ty - this.y, speed, dt, w.map);
    else {
      this.coast(dt, w.map);
      return false;
    }
    return true;
  }

  private steer(dx: number, dy: number, speed: number, dt: number, map: TileMap): void {
    const len = Math.hypot(dx, dy) || 1;
    this.vx = approach(this.vx, (dx / len) * speed, ACCEL * dt);
    this.vy = approach(this.vy, (dy / len) * speed, ACCEL * dt);
    this.move(dt, map);
    if (Math.hypot(this.vx, this.vy) > 6) this.face = approachAngle(this.face, Math.atan2(this.vy, this.vx), dt * 8);
  }

  private coast(dt: number, map: TileMap): void {
    this.vx = approach(this.vx, 0, FRICTION * dt);
    this.vy = approach(this.vy, 0, FRICTION * dt);
    this.move(dt, map);
  }

  private move(dt: number, map: TileMap): void {
    const hit = moveBody(this, this.vx * dt, this.vy * dt, map, 'human');
    if (hit.hitX) this.vx = 0;
    if (hit.hitY) this.vy = 0;
  }

  private turnToward(x: number, y: number, dt: number, rate: number): void {
    this.face = approachAngle(this.face, Math.atan2(y - this.y, x - this.x), dt * rate);
  }

  private dist(p: { x: number; y: number }): number {
    return Math.hypot(p.x - this.x, p.y - this.y);
  }

  // ---------------------------------------------------------------- speech

  private bark(w: HumanWorld, kind: BarkKind, force = false): void {
    if (!force && this.barkCd > 0) return;
    this.say(w, kind);
  }

  private say(w: HumanWorld, kind: BarkKind): void {
    this.barkCd = 4 + w.rng() * 2;
    w.say(this, pickBark(kind, this.id, w.rng));
  }
}

type BarkKind = keyof typeof BARKS;

function pickBark(kind: BarkKind, id: HumanId, rng: () => number): string {
  const lines: readonly string[] = id === 'inspector' && kind === 'suspicious' ? BARKS.hobbSuspicious : BARKS[kind];
  return lines[Math.floor(rng() * lines.length)]!;
}

/** Rotate angle `a` toward `b` by at most `step` radians. */
export function approachAngle(a: number, b: number, step: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}
