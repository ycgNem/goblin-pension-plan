import { clamp } from '../core/math';
import { CREATURES, type CreatureDef, type CreatureId } from '../data/enemies';
import type { ItemId } from '../data/items';
import { NODES, type NodeId } from '../data/nodes';
import type { RegionId } from '../data/regions';
import { moveBody } from '../world/collision';
import { FlowField } from '../world/pathing';
import { lineOfSight } from '../world/sight';
import type { TileMap } from '../world/tilemap';
import { TILE, type Mover } from '../world/tiles';
import { BossFight, type BossEventKind } from './boss';
import { Creature, type Cloud, type CreatureWorld, type Target } from './creature';
import { Effects, FX } from './effects';
import { Human, VS_CREATURE, type GoblinSense, type HumanWorld } from './human';
import { stepProjectile, type Projectile } from './projectiles';
import type { SaveData } from './save';
import { isSpent, placementKey, shiftIndex } from './world-state';

export type SceneSound =
  | 'hit' | 'kill' | 'ratSqueak' | 'slimeBlorp' | 'spit' | 'miteClick' | 'wallHit' | 'crateBreak'
  | 'arrow' | 'fireBurst' | 'shieldCharge' | 'alert' | 'whistle' | 'pickup' | 'clank';

/** How the scene reports back to the game. Everything past the first three is optional (tests skip them). */
export interface SceneEvents {
  /** The goblin was hit. Returns false if it didn't land (rolling, invulnerable, down). */
  hurtPlayer(damage: number, fromX: number, fromY: number): boolean;
  creatureHit(c: Creature, damage: number, fatal: boolean): void;
  creatureKilled(c: Creature, byPlayer: boolean): void;
  /** A pickup touched the goblin. Returns how many fit in the pack. */
  pickup?(item: ItemId, qty: number): number;
  /** A shot broke something open (crates). */
  objectBroken?(o: WorldObject): void;
  spotted?(h: Human): void;
  alarm?(h: Human): void;
  sound?(id: SceneSound, x: number, y: number): void;
  /** A shot bounced off an armored front. */
  deflected?(c: Creature): void;
  boss?(kind: BossEventKind, x: number, y: number): void;
}

export type ObjectKind = 'node' | 'station' | 'npc' | 'access' | 'valve' | 'vent' | 'landmark' | 'letter' | 'heap' | 'hole' | 'post';

/** Anything placed in the world that isn't alive: drawn depth-sorted, and maybe interactable. */
export interface WorldObject {
  kind: ObjectKind;
  id: string;
  glyph: string;
  col: number;
  row: number;
  /** World position of its base. */
  x: number;
  y: number;
  /** Shift memory key. */
  key: string;
  label: string;
  /** Used up this shift (searched, smashed, harvested). */
  spent: boolean;
  /** Seconds of wobble left, after a hit or a search. */
  shake: number;
}

export interface Pickup {
  item: ItemId;
  qty: number;
  x: number;
  y: number;
  /** Height above the ground, for the pop-out arc. */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  /** Seconds before it tries the pack again after finding it full. */
  wait: number;
  dead: boolean;
  /** Put down on purpose: it stays put until the goblin has walked away from it. */
  dropped?: boolean;
}

export interface Noise {
  x: number;
  y: number;
  r: number;
  t: number;
}

export interface StinkCloud extends Cloud {
  t: number;
  life: number;
}

export interface Bubble {
  text: string;
  who: Human | null;
  x: number;
  y: number;
  t: number;
  life: number;
}

/** Stinkbrew: how big the cloud is and how long it hangs about. */
export const CLOUD_RADIUS = 42;
export const CLOUD_LIFE = 12;
const MAGNET_RANGE = 44;
/** How far the goblin has to walk from something it dropped before it'll pick it up again. */
const DROP_CLEAR = MAGNET_RANGE + 8;
const COLLECT_RANGE = 9;
const NOISE_TIME = 0.6;

/**
 * Everything in the current region: creatures, people, objects, pickups, projectiles, effects.
 * Rebuilt on every region entry. No DOM in here, so tests can run it.
 */
export class Scene implements CreatureWorld, HumanWorld {
  readonly creatures: Creature[] = [];
  readonly humans: Human[] = [];
  readonly objects: WorldObject[] = [];
  readonly pickups: Pickup[] = [];
  readonly projectiles: Projectile[] = [];
  readonly noises: Noise[] = [];
  readonly bubbles: Bubble[] = [];
  /** Where adventurers have defeated creatures in this scene. */
  readonly heroKills: { x: number; y: number }[] = [];
  readonly clouds: StinkCloud[] = [];
  readonly effects = new Effects();
  /** The boss fight in this region, if it has one. */
  boss: BossFight | null = null;
  /** The goblin, as creatures see it. */
  private readonly goblinTarget: Target = { x: 0, y: 0, hw: 5, hh: 4, alive: true };
  /** Whoever the creature being updated is after. */
  target: Target = this.goblinTarget;
  readonly goblin: GoblinSense = { x: 0, y: 0, alive: true, hidden: false, sneaking: false, speed: 0 };
  private readonly locks = new Map<Creature, Target>();
  private readonly killers = new Map<Creature, 'player' | 'hero'>();
  private readonly routes = new Map<string, FlowField>();

  constructor(
    readonly regionId: RegionId,
    readonly map: TileMap,
    readonly save: SaveData,
    private readonly events: SceneEvents,
    readonly rng: () => number = Math.random,
  ) {
    for (const p of map.spawns) {
      if (p.def.kind === 'player') continue;
      const key = placementKey(regionId, p.col, p.row);
      if (p.def.kind === 'creature') {
        if (isSpent(save, key)) continue;
        const id = p.def.id as CreatureId;
        const boss = (CREATURES[id] as CreatureDef).boss;
        if (boss && save.flags[boss.flag]) {
          // Beaten, but its prize was left behind: it's waiting where the boss fell asleep.
          if (!save.flags[boss.prize.flag]) this.spawnPickup(boss.prize.item as ItemId, 1, p.col * TILE + TILE / 2, p.row * TILE + TILE / 2, 0.2);
          continue;
        }
        this.creatures.push(new Creature(id, p.col * TILE + TILE / 2, p.row * TILE + TILE / 2, this.rng, key));
        continue;
      }
      if (p.def.kind === 'landmark') {
        // One object per 2x2 landmark (its top-left tile), standing at the bottom middle of the footprint.
        const left = map.glyphs[p.row * map.cols + p.col - 1] === p.glyph;
        const up = map.glyphs[(p.row - 1) * map.cols + p.col] === p.glyph;
        if (left || up) continue;
        const o = this.addObject('landmark', p.def.id, p.glyph, p.col, p.row, key, p.def.label);
        o.x = (p.col + 1) * TILE;
        o.y = (p.row + 2) * TILE - 2;
        continue;
      }
      const kind: ObjectKind =
        p.def.kind === 'human' ? 'post'
        : p.def.kind === 'node' ? 'node'
        : p.def.kind === 'letter' ? 'letter'
        : p.def.kind;
      const o = this.addObject(kind, p.def.id, p.glyph, p.col, p.row, key, p.def.label);
      if (kind === 'node') o.spent = isSpent(save, key);
    }
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        const k = map.kindAt(col, row);
        if (k === 'hide') this.addObject('heap', 'heap', 'h', col, row, placementKey(regionId, col, row), 'Tall rubbish');
        if (k === 'hole') this.addObject('hole', 'hole', '+', col, row, placementKey(regionId, col, row), 'Hole in the wall');
      }
    }
    const shift = shiftIndex(save.playTime);
    for (const e of save.eventNodes) {
      if (e.region !== regionId || e.shift !== shift) continue;
      const o = this.addObject('node', e.node, '', e.col, e.row, e.key, NODES[e.node].name);
      o.spent = isSpent(save, e.key);
    }
    const boss = this.creatures.find((c) => c.def.boss);
    if (boss) this.boss = new BossFight(boss, this.objects, (kind, x, y) => this.events.boss?.(kind, x, y));
  }

  private addObject(kind: ObjectKind, id: string, glyph: string, col: number, row: number, key: string, label: string): WorldObject {
    const o: WorldObject = { kind, id, glyph, col, row, x: col * TILE + TILE / 2, y: row * TILE + TILE - 3, key, label, spent: false, shake: 0 };
    this.objects.push(o);
    return o;
  }

  /** Add an event leftover to the live scene. */
  addEventNode(node: NodeId, col: number, row: number, key: string): void {
    this.addObject('node', node, '', col, row, key, NODES[node].name);
    this.effects.burst(col * TILE + 8, row * TILE + 10, 8, FX.dust, 40, this.rng, 0.5);
  }

  // ---------------------------------------------------------------- update

  update(dt: number, goblin: { x: number; y: number; alive: boolean; hidden?: boolean; sneaking?: boolean; speed?: number }): void {
    const g = this.goblin;
    g.x = this.goblinTarget.x = goblin.x;
    g.y = this.goblinTarget.y = goblin.y;
    g.alive = this.goblinTarget.alive = goblin.alive;
    g.hidden = goblin.hidden ?? false;
    g.sneaking = goblin.sneaking ?? false;
    g.speed = goblin.speed ?? 0;

    for (const c of this.creatures) {
      if (c.dead) continue;
      this.target = this.pickTarget(c);
      c.update(dt, this);
    }
    this.target = this.goblinTarget;
    this.boss?.update(dt, this);
    for (const h of this.humans) h.update(dt, this);
    this.separate();
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.reap();
    this.effects.update(dt);
    for (const o of this.objects) o.shake = Math.max(0, o.shake - dt);

    for (const n of this.noises) n.t += dt;
    removeWhere(this.noises, (n) => n.t >= NOISE_TIME);
    for (const c of this.clouds) c.t += dt;
    removeWhere(this.clouds, (c) => c.t >= c.life);
    for (const b of this.bubbles) {
      b.t += dt;
      if (b.who) {
        b.x = b.who.x;
        b.y = b.who.y;
      }
    }
    removeWhere(this.bubbles, (b) => b.t >= b.life || (b.who !== null && b.who.gone));
    removeWhere(this.humans, (h) => h.gone);
  }

  /** Creatures go after whoever is closest and in sight: usually the goblin, sometimes a hero. */
  private pickTarget(c: Creature): Target {
    const locked = this.locks.get(c);
    if (locked && locked !== this.goblinTarget && locked.alive) return locked;
    let best = this.goblinTarget;
    let bestD = this.goblinTarget.alive ? Math.hypot(c.x - this.goblin.x, c.y - this.goblin.y) : Infinity;
    for (const h of this.humans) {
      if (h.gone || h.retreating) continue;
      const d = Math.hypot(c.x - h.x, c.y - h.y);
      if (d < bestD && d <= c.def.aggroRange && lineOfSight(this.map, c.x, c.y, h.x, h.y)) {
        best = h.target;
        bestD = d;
      }
    }
    if (best !== this.goblinTarget) this.locks.set(c, best);
    else this.locks.delete(c);
    return best;
  }

  private humanFor(t: Target): Human | undefined {
    return this.humans.find((h) => h.target === t);
  }

  hurtTarget(damage: number, fromX: number, fromY: number): boolean {
    if (this.target === this.goblinTarget) return this.events.hurtPlayer(damage, fromX, fromY);
    const h = this.humanFor(this.target);
    if (!h) return false;
    h.takeHit(damage, this, false);
    this.effects.burst(h.x, h.y - 6, 5, FX.hurt, 40, this.rng);
    return true;
  }

  spawnProjectile(p: Projectile): void {
    this.projectiles.push(p);
  }

  addCreature(c: Creature): void {
    this.creatures.push(c);
    this.effects.burst(c.x, c.y, 10, FX.dust, 50, this.rng, 0.5);
  }

  /** Take a creature out of the fight without a kill: no loot, no xp. */
  dismiss(c: Creature): void {
    removeWhere(this.creatures, (x) => x === c);
    this.locks.delete(c);
    this.effects.burst(c.x, c.y, 8, FX.dust, 40, this.rng, 0.4);
  }

  /** Hurt a creature on the goblin's behalf (steam from a valve it turned). */
  damageCreature(c: Creature, damage: number, angle: number): void {
    if (c.dead) return;
    const fatal = c.takeHit(damage, angle, 60, this);
    this.killers.set(c, 'player');
    this.effects.number(c.x, c.y - c.radius - 3, String(damage), fatal ? FX.killNumber : FX.number);
    this.events.creatureHit(c, damage, fatal);
  }

  cloudAt(x: number, y: number): Cloud | null {
    for (const c of this.clouds) if (Math.hypot(x - c.x, y - c.y) < c.r) return c;
    return null;
  }

  /** A Stinkbrew bottle breaks here. */
  addCloud(x: number, y: number): void {
    this.clouds.push({ x, y, r: CLOUD_RADIUS, t: 0, life: CLOUD_LIFE });
  }

  route(fromX: number, fromY: number, toX: number, toY: number, mover: Mover = 'creature'): { x: number; y: number } | null {
    const col = Math.floor(toX / TILE);
    const row = Math.floor(toY / TILE);
    const key = `${mover}:${this.map.gateOpen}:${col},${row}`;
    let field = this.routes.get(key);
    if (!field) {
      if (this.routes.size >= 48) this.routes.clear();
      field = new FlowField(this.map, col, row, mover);
      this.routes.set(key, field);
    }
    return field.direction(fromX, fromY);
  }

  // ---------------------------------------------------------------- HumanWorld

  humanRoute(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number } | null {
    return this.route(fromX, fromY, toX, toY, 'human');
  }

  hurtGoblin(damage: number, fromX: number, fromY: number): boolean {
    return this.events.hurtPlayer(damage, fromX, fromY);
  }

  hurtCreature(c: Creature, damage: number, angle: number, knockback: number): void {
    if (c.dead) return;
    const fatal = c.takeHit(damage, angle, knockback, this);
    this.killers.set(c, 'hero');
    this.effects.spray(c.x, c.y, angle, 1.6, 5, FX.spark, 70, this.rng);
    this.effects.number(c.x, c.y - c.radius - 3, String(damage), FX.heroNumber);
    this.events.creatureHit(c, damage, fatal);
    this.events.sound?.(fatal ? 'kill' : 'hit', c.x, c.y);
  }

  say(h: Human, text: string): void {
    removeWhere(this.bubbles, (b) => b.who === h);
    this.bubbles.push({ text, who: h, x: h.x, y: h.y, t: 0, life: 2.4 + text.length * 0.03 });
  }

  /** A speech bubble from someone who isn't on screen as a person (heroes up at the grate). */
  sayAt(text: string, x: number, y: number): void {
    this.bubbles.push({ text, who: null, x, y, t: 0, life: 2.6 + text.length * 0.03 });
  }

  spotted(h: Human): void {
    this.events.sound?.('alert', h.x, h.y);
    this.events.spotted?.(h);
    // A shout brings the rest of the party in.
    for (const other of this.humans) {
      if (other !== h && !other.gone && other.def.role !== 'worker' && Math.hypot(other.x - h.x, other.y - h.y) < 200) {
        other.becomeHostile(this, h.lastKnown.x, h.lastKnown.y);
      }
    }
  }

  alarm(h: Human): void {
    this.events.sound?.('whistle', h.x, h.y);
    this.events.alarm?.(h);
  }

  attackEffect(_h: Human, kind: keyof typeof VS_CREATURE, x: number, y: number): void {
    switch (kind) {
      case 'shieldCharge':
        this.events.sound?.('shieldCharge', x, y);
        this.noise(x, y, 80);
        break;
      case 'aimedShot':
        this.events.sound?.('arrow', x, y);
        break;
      case 'fireCircle':
        this.events.sound?.('fireBurst', x, y);
        this.effects.burst(x, y, 22, FX.fire, 70, this.rng, 0.5);
        this.effects.burst(x, y, 10, FX.spark, 40, this.rng, 0.7);
        this.noise(x, y, 110);
        break;
      case 'baton':
        this.events.sound?.('hit', x, y);
        break;
    }
  }

  // ---------------------------------------------------------------- noise and pickups

  /** A sound people can hear, shown as an expanding ring. */
  noise(x: number, y: number, radius: number): void {
    this.noises.push({ x, y, r: radius, t: 0 });
    for (const h of this.humans) h.hear(x, y, radius);
  }

  /** Draw idle creatures near a fight toward it: the side passages empty out. */
  pullCreatures(x: number, y: number, radius: number): void {
    const hero = this.humans.find((h) => !h.gone && !h.retreating && h.def.role === 'hero');
    if (!hero) return;
    for (const c of this.creatures) {
      if (c.dead || c.state !== 'idle' || Math.hypot(c.x - x, c.y - y) > radius) continue;
      this.locks.set(c, hero.target);
      this.target = hero.target;
      c.alert(this);
    }
    this.target = this.goblinTarget;
  }

  spawnPickup(item: ItemId, qty: number, x: number, y: number, spread = 1): void {
    const a = this.rng() * Math.PI * 2;
    const s = (20 + this.rng() * 30) * spread;
    this.pickups.push({ item, qty, x, y, z: 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: 70 + this.rng() * 30, t: 0, wait: 0, dead: false });
  }

  /** Something lying still on the floor: left from an earlier visit, or dropped on purpose. */
  placePickup(item: ItemId, qty: number, x: number, y: number, dropped = false): void {
    this.pickups.push({ item, qty, x, y, z: 0, vx: 0, vy: 0, vz: 0, t: 1, wait: 0, dead: false, dropped });
  }

  private updatePickups(dt: number): void {
    const g = this.goblin;
    for (const p of this.pickups) {
      p.t += dt;
      p.wait = Math.max(0, p.wait - dt);
      if (p.dropped && Math.hypot(g.x - p.x, g.y - p.y) > DROP_CLEAR) p.dropped = false;
      if (p.z > 0 || p.vz > 0) {
        p.vz -= 260 * dt;
        p.z += p.vz * dt;
        if (p.z <= 0) {
          p.z = 0;
          p.vz = Math.abs(p.vz) > 40 ? -p.vz * 0.35 : 0;
        }
      }
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (g.alive && p.t > 0.45 && p.wait === 0 && !p.dropped && d < MAGNET_RANGE) {
        const pull = 260 * (1 - d / MAGNET_RANGE) + 60;
        p.vx += ((g.x - p.x) / (d || 1)) * pull * dt * 6;
        p.vy += ((g.y - p.y) / (d || 1)) * pull * dt * 6;
      }
      const drag = Math.exp(-5 * dt);
      p.vx *= drag;
      p.vy *= drag;
      const body = { x: p.x, y: p.y, hw: 2, hh: 2 };
      moveBody(body, p.vx * dt, p.vy * dt, this.map, 'goblin');
      p.x = body.x;
      p.y = body.y;
      if (g.alive && p.t > 0.45 && p.wait === 0 && !p.dropped && d < COLLECT_RANGE && this.events.pickup) {
        const got = this.events.pickup(p.item, p.qty);
        p.qty -= got;
        if (p.qty <= 0) p.dead = true;
        else {
          p.wait = 2.5;
          p.vx = (p.x - g.x) * 4;
          p.vy = (p.y - g.y) * 4;
        }
      }
    }
    removeWhere(this.pickups, (p) => p.dead);
  }

  // ---------------------------------------------------------------- projectiles

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      const result = stepProjectile(p, dt, this.map);
      if (p.owner === 'player') {
        const victim = this.creatures.find((c) => !c.dead && Math.hypot(c.x - p.x, c.y - p.y) <= c.radius + p.radius);
        if (victim) {
          if (victim.deflects(Math.atan2(-p.vy, -p.vx))) this.deflect(victim, p);
          else this.hitCreature(victim, p);
          p.dead = true;
          continue;
        }
        const person = this.humans.find((h) => !h.gone && Math.abs(h.x - p.x) <= h.hw + p.radius && Math.abs(h.y - 6 - p.y) <= h.hh + 8);
        if (person) {
          person.takeHit(p.damage, this, true);
          this.effects.spray(p.x, p.y, Math.atan2(-p.vy, -p.vx), 1.6, 4, FX.spark, 60, this.rng);
          this.events.sound?.('hit', p.x, p.y);
          p.dead = true;
          continue;
        }
        const crate = this.objects.find((o) => o.kind === 'node' && !o.spent && (NODES[o.id as NodeId] as { smashable?: boolean } | undefined)?.smashable && Math.abs(o.x - p.x) < 7 && p.y > o.y - 12 && p.y < o.y + 2);
        if (crate && this.events.objectBroken) {
          this.events.objectBroken(crate);
          p.dead = true;
          continue;
        }
      } else if (p.owner === 'hero') {
        const victim = this.creatures.find((c) => !c.dead && Math.hypot(c.x - p.x, c.y - p.y) <= c.radius + p.radius);
        if (victim) {
          this.hurtCreature(victim, VS_CREATURE.aimedShot, Math.atan2(p.vy, p.vx), p.knockback);
          p.dead = true;
          continue;
        }
        if (this.goblinTarget.alive && circleHitsBox(p, this.goblinTarget) && this.events.hurtPlayer(p.damage, p.x - p.vx, p.y - p.vy)) {
          p.dead = true;
          continue;
        }
      } else if (this.goblinTarget.alive && circleHitsBox(p, this.goblinTarget)) {
        // A rolling or invulnerable goblin lets enemy shots pass straight through.
        if (this.events.hurtPlayer(p.damage, p.x - p.vx, p.y - p.vy)) {
          this.effects.burst(p.x, p.y, 6, FX.gel, 50, this.rng);
          p.dead = true;
          continue;
        }
      }
      if (result !== 'flying') {
        p.dead = true;
        this.impact(p, result === 'wall');
      }
    }
    removeWhere(this.projectiles, (p) => p.dead);
  }

  private hitCreature(c: Creature, p: Projectile): void {
    const angle = Math.atan2(p.vy, p.vx);
    const fatal = c.takeHit(p.damage, angle, p.knockback, this, p.slow);
    this.killers.set(c, 'player');
    this.effects.spray(p.x, p.y, angle + Math.PI, 1.6, 4, FX.spark, 70, this.rng);
    this.effects.number(c.x, c.y - c.radius - 3, String(p.damage), fatal ? FX.killNumber : FX.number);
    this.events.creatureHit(c, p.damage, fatal);
  }

  /** A shot bounces off armor: sparks, a clank, no damage. */
  private deflect(c: Creature, p: Projectile): void {
    const back = Math.atan2(-p.vy, -p.vx);
    this.effects.spray(p.x, p.y, back, 1.4, 6, FX.spark, 90, this.rng, 0.25);
    this.effects.spray(p.x, p.y, back, 0.8, 2, '#ffffff', 60, this.rng, 0.15);
    this.events.sound?.('clank', p.x, p.y);
    this.events.deflected?.(c);
  }

  private impact(p: Projectile, wall: boolean): void {
    const gooey = p.kind === 'gel' || p.kind === 'slimeShot';
    const color = gooey ? FX.gel : wall ? FX.dust : FX.spark;
    this.effects.spray(p.x, p.y, Math.atan2(-p.vy, -p.vx), 2.2, wall ? 5 : 2, color, 45, this.rng);
    if (wall && p.owner === 'player') this.events.sound?.('wallHit', p.x, p.y);
  }

  /** Remove the dead, with a burst, and split anything that splits. */
  private reap(): void {
    const dead = this.creatures.filter((c) => c.dead);
    if (dead.length === 0) return;
    removeWhere(this.creatures, (c) => c.dead);
    for (const c of dead) {
      this.effects.burst(c.x, c.y, c.def.behavior === 'slime' ? 14 : 9, c.def.color, 60, this.rng, 0.45);
      this.locks.delete(c);
      if (this.killers.get(c) === 'hero') this.heroKills.push({ x: c.x, y: c.y });
      this.events.creatureKilled(c, this.killers.get(c) !== 'hero');
      this.killers.delete(c);
      const split = c.def.splitsInto;
      if (!split) continue;
      for (let i = 0; i < split.count; i++) {
        const a = (i / split.count) * Math.PI * 2 + this.rng() * 0.6;
        const child = new Creature(split.creature as CreatureId, c.x, c.y, this.rng);
        child.vx = Math.cos(a) * 90;
        child.vy = Math.sin(a) * 90;
        child.daze(0.5, this);
        this.creatures.push(child);
      }
    }
  }

  /** Keep creatures from stacking, and make them yield to the goblin instead of shoving it. */
  private separate(): void {
    const list = this.creatures;
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        const push = overlap(a.x, a.y, b.x, b.y, a.radius + b.radius - 2, this.rng);
        if (!push) continue;
        moveBody(a, -push.x / 2, -push.y / 2, this.map, 'creature');
        moveBody(b, push.x / 2, push.y / 2, this.map, 'creature');
      }
      // Mid-lunge creatures are allowed to reach the goblin: that's how the bite lands.
      if (this.goblinTarget.alive && a.state !== 'attack') {
        const push = overlap(this.goblinTarget.x, this.goblinTarget.y, a.x, a.y, a.radius + 5, this.rng);
        if (push) moveBody(a, push.x, push.y, this.map, 'creature');
      }
    }
    // People don't walk through each other either.
    for (let i = 0; i < this.humans.length; i++) {
      for (let j = i + 1; j < this.humans.length; j++) {
        const a = this.humans[i]!;
        const b = this.humans[j]!;
        const push = overlap(a.x, a.y, b.x, b.y, a.hw + b.hw + 2, this.rng);
        if (!push) continue;
        moveBody(a, -push.x / 2, -push.y / 2, this.map, 'human');
        moveBody(b, push.x / 2, push.y / 2, this.map, 'human');
      }
    }
  }
}

/** How far to push b away from a so they're `min` apart, or null if they already are. */
function overlap(ax: number, ay: number, bx: number, by: number, min: number, rng: () => number): { x: number; y: number } | null {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy);
  if (d >= min) return null;
  if (d < 0.01) {
    const a = rng() * Math.PI * 2;
    return { x: Math.cos(a) * min, y: Math.sin(a) * min };
  }
  return { x: (dx / d) * (min - d), y: (dy / d) * (min - d) };
}

function circleHitsBox(p: { x: number; y: number; radius: number }, t: Target): boolean {
  const cx = clamp(p.x, t.x - t.hw, t.x + t.hw);
  const cy = clamp(p.y, t.y - t.hh, t.y + t.hh);
  return Math.hypot(p.x - cx, p.y - cy) <= p.radius;
}

function removeWhere<T>(list: T[], gone: (item: T) => boolean): void {
  let w = 0;
  for (const item of list) if (!gone(item)) list[w++] = item;
  list.length = w;
}
