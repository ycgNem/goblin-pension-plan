import type { CreatureId } from '../data/enemies';
import { lineOfSight } from '../world/sight';
import { TILE } from '../world/tiles';
import { Creature } from './creature';
import type { Scene, WorldObject } from './scene';

// A boss fight: the boss sleeps until you walk into its room, gets a second phase,
// calls adds out of vents, and can be flipped with steam from the valves on the wall.

/** The fight starts when the goblin is this close to the boss's lair and in sight of it. */
const WAKE_RANGE = 104;
/** Seconds a valve needs to build pressure again after a blast. */
export const VALVE_COOLDOWN = 7;
/** A steam blast: how long it lasts, how far it reaches down from the valve, and how wide it is. */
export const BLAST_TIME = 0.9;
const BLAST_REACH = 6 * TILE;
const BLAST_HALF_W = 26;
/** On waking, the boss rears up this long before it comes for you, so the title card can be read first. */
const WAKE_GRACE = 2.4;
/** Damage a blast does to each creature caught in it (other than the boss), once per blast. */
const BLAST_DAMAGE = 3;

export type BossEventKind = 'start' | 'phase2' | 'add' | 'steam' | 'flipped';

export interface SteamBlast {
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  /** Creatures this blast has already scalded. */
  scalded: Set<Creature>;
}

export interface Valve {
  obj: WorldObject;
  cooldown: number;
}

export class BossFight {
  started = false;
  phase: 1 | 2 = 1;
  readonly valves: Valve[];
  readonly vents: WorldObject[];
  readonly blasts: SteamBlast[] = [];
  private addT = 0;
  private readonly adds = new Set<Creature>();

  constructor(readonly boss: Creature, objects: readonly WorldObject[], private readonly report: (kind: BossEventKind, x: number, y: number) => void) {
    boss.asleep = true;
    this.valves = objects.filter((o) => o.kind === 'valve').map((obj) => ({ obj, cooldown: 0 }));
    this.vents = objects.filter((o) => o.kind === 'vent');
  }

  /** The fight is on: the boss is awake and alive. */
  get active(): boolean {
    return this.started && !this.boss.dead;
  }

  update(dt: number, scene: Scene): void {
    for (const v of this.valves) v.cooldown = Math.max(0, v.cooldown - dt);
    for (const b of this.blasts) b.t += dt;
    for (let i = this.blasts.length - 1; i >= 0; i--) if (this.blasts[i]!.t > BLAST_TIME + 0.6) this.blasts.splice(i, 1);
    for (const a of this.adds) if (a.dead) this.adds.delete(a);
    const boss = this.boss;
    if (boss.dead) {
      // With her gone, her mites scuttle back into the vents.
      for (const a of this.adds) scene.dismiss(a);
      this.adds.clear();
      return;
    }

    const g = scene.goblin;
    if (!this.started) {
      const home = boss.home;
      if (g.alive && Math.hypot(g.x - home.x, g.y - home.y) < WAKE_RANGE && lineOfSight(scene.map, g.x, g.y, boss.x, boss.y)) {
        this.started = true;
        boss.asleep = false;
        boss.alert(scene);
        boss.daze(WAKE_GRACE, scene);
        this.report('start', boss.x, boss.y);
      }
      return;
    }

    const def = boss.def.boss!;
    if (this.phase === 1 && boss.hp <= boss.def.hp * def.phase2At) {
      this.phase = 2;
      boss.turnBoost = def.enrage;
      boss.sealed = def.seals;
      // The first mite comes soon after the change, so the new phase is felt straight away.
      this.addT = def.addEvery - 2.5;
      this.report('phase2', boss.x, boss.y);
    }
    if (this.phase === 2) {
      this.addT += dt;
      if (this.addT >= def.addEvery && this.adds.size < def.maxAdds && this.vents.length > 0) {
        this.addT = 0;
        // Out of the vent furthest from the goblin, so an add never pops up in your face.
        const vent = [...this.vents].sort((a, b) => Math.hypot(b.x - g.x, b.y - g.y) - Math.hypot(a.x - g.x, a.y - g.y))[0]!;
        const add = new Creature(def.adds as CreatureId, vent.x, vent.y - 6, scene.rng);
        scene.addCreature(add);
        add.alert(scene);
        this.adds.add(add);
        this.report('add', vent.x, vent.y);
      }
    }

    for (const b of this.blasts) {
      if (b.t > BLAST_TIME) continue;
      if (boss.state !== 'stunned' && overlaps(b, boss.x, boss.y, boss.radius)) {
        boss.stun(def.stun);
        this.report('flipped', boss.x, boss.y);
      }
      for (const c of scene.creatures) {
        if (c === boss || c.dead || b.scalded.has(c) || !overlaps(b, c.x, c.y, c.radius)) continue;
        b.scalded.add(c);
        scene.damageCreature(c, BLAST_DAMAGE, Math.PI / 2);
      }
    }
  }

  private valve(obj: WorldObject): Valve | undefined {
    return this.valves.find((v) => v.obj === obj);
  }

  /** Valves only have pressure in the second phase, and need a while between blasts. */
  canTurn(obj: WorldObject): boolean {
    const v = this.valve(obj);
    return this.active && this.phase === 2 && v !== undefined && v.cooldown <= 0;
  }

  /** Seconds until a valve has pressure again (0 when it's ready or the fight isn't on). */
  cooldownLeft(obj: WorldObject): number {
    return this.valve(obj)?.cooldown ?? 0;
  }

  /** How a valve should look: building pressure, ready to turn, or just used. */
  valveState(obj: WorldObject): 'ready' | 'spent' | '' {
    const v = this.valve(obj);
    if (!v || !this.active || this.phase === 1) return '';
    return v.cooldown > 0 ? 'spent' : 'ready';
  }

  /** Turn a valve: steam blasts down from it across the room. Returns false if it had no pressure. */
  turn(obj: WorldObject): boolean {
    const v = this.valve(obj);
    if (!v || !this.canTurn(obj)) return false;
    v.cooldown = VALVE_COOLDOWN;
    this.blasts.push({ ...blastArea(obj), t: 0, scalded: new Set() });
    this.report('steam', obj.x, obj.y);
    return true;
  }
}

/** Where a valve's steam lands: a column straight down from it. */
export function blastArea(obj: WorldObject): { x: number; y: number; w: number; h: number } {
  return { x: obj.x - BLAST_HALF_W, y: obj.y - 8, w: BLAST_HALF_W * 2, h: BLAST_REACH };
}

function overlaps(b: SteamBlast, x: number, y: number, r: number): boolean {
  return x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h;
}
