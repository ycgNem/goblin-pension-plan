import { describe, expect, it } from 'vitest';
import { CREATURES } from '../src/data/enemies';
import { BLAST_TIME, VALVE_COOLDOWN } from '../src/game/boss';
import { Creature } from '../src/game/creature';
import type { Projectile } from '../src/game/projectiles';
import { newSave } from '../src/game/save';
import { CLOUD_RADIUS, type WorldObject } from '../src/game/scene';
import { TILE } from '../src/world/tiles';
import { room, testScene, type TestScene } from './helpers';

const center = (col: number, row: number) => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

const shot = (x: number, y: number, vx: number, vy: number): Projectile => ({
  kind: 'scrap', owner: 'player', x, y, vx, vy, travelled: 0, range: 500, radius: 2, damage: 1, knockback: 0, dead: false,
});

/** Smallest signed difference between two angles. */
const angleDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));

const MATRON = CREATURES.pumpMatron;

/** A Pump Room: the Matron in the middle, two valves on the top wall, two vents along the bottom. */
function pumpRoom(save = newSave()): TestScene {
  return testScene(room(22, 12, [['v', 6, 1], ['v', 17, 1], ['B', 11, 5], ['u', 3, 12], ['u', 20, 12]]), 3, save);
}

function matronOf(t: TestScene): Creature {
  const m = t.scene.creatures.find((c) => c.def.boss);
  if (!m) throw new Error('no Matron in the scene');
  return m;
}

const valves = (t: TestScene): WorldObject[] => t.scene.objects.filter((o) => o.kind === 'valve');
const mites = (t: TestScene): Creature[] => t.scene.creatures.filter((c) => c.id === 'boneMite' && !c.dead);

/** Wake her with the goblin just inside the room, then drop her into phase two. */
function phaseTwo(t: TestScene): Creature {
  const m = matronOf(t);
  const near = center(11, 9);
  t.run(0.1, near.x, near.y);
  m.hp = Math.floor(MATRON.hp * MATRON.boss.phase2At);
  t.run(0.05, near.x, near.y);
  return m;
}

describe('Scrapback Beetle', () => {
  it('shots off its armored front bounce off; shots into its back land', () => {
    const t = testScene(room(20, 7, [['b', 10, 4]]));
    const beetle = t.scene.creatures[0]!;
    beetle.asleep = true;
    beetle.face = 0;
    const hp = beetle.hp;

    // From the east, straight at its face.
    t.scene.spawnProjectile(shot(beetle.x + 70, beetle.y, -270, 0));
    t.run(0.4, 9999, 9999);
    expect(beetle.hp).toBe(hp);
    expect(t.scene.projectiles).toEqual([]);

    // From the west, into its soft back.
    t.scene.spawnProjectile(shot(beetle.x - 70, beetle.y, 270, 0));
    t.run(0.4, 9999, 9999);
    expect(beetle.hp).toBe(hp - 1);
  });

  it('turns toward you slowly, and only attacks once it has come round', () => {
    const t = testScene(room(20, 7, [['b', 12, 4]]));
    const beetle = t.scene.creatures[0]!;
    beetle.face = 0;
    // Behind it, in easy range.
    const g = { x: beetle.x - 40, y: beetle.y };
    t.run(0.25, g.x, g.y);
    expect(beetle.state).toBe('approach');
    expect(Math.abs(angleDiff(beetle.face, Math.PI))).toBeGreaterThan(Math.PI / 2);

    let firstWindup = -1;
    for (let i = 0; i < 240 && firstWindup < 0; i++) {
      t.run(1 / 60, g.x, g.y);
      if (beetle.state === 'windup') firstWindup = t.time;
    }
    expect(firstWindup).toBeGreaterThan(0.25);
    expect(Math.abs(angleDiff(beetle.face, Math.atan2(g.y - beetle.y, g.x - beetle.x)))).toBeLessThan(0.5);
  });
});

describe('the Pump Matron', () => {
  it('sleeps until the goblin walks into her room, then wakes', () => {
    const t = pumpRoom();
    const m = matronOf(t);
    const start = { x: m.x, y: m.y };
    t.run(3, 9999, 9999);
    expect(t.scene.boss?.started).toBe(false);
    expect({ x: m.x, y: m.y }).toEqual(start);

    const near = center(11, 9);
    t.run(0.1, near.x, near.y);
    expect(t.scene.boss?.active).toBe(true);
    expect(m.state).not.toBe('idle');
  });

  it(`turns to phase two at ${MATRON.boss.phase2At * 100}% health and calls mites out of the vent farthest from you, two at most`, () => {
    const t = pumpRoom();
    const m = phaseTwo(t);
    expect(t.scene.boss?.phase).toBe(2);
    expect(m.dead).toBe(false);

    // Standing by the left vent: the first mite comes out of the right one.
    const byLeftVent = center(4, 11);
    let first: Creature | undefined;
    for (let i = 0; i < 60 * 8 && !first; i++) {
      t.run(1 / 60, byLeftVent.x, byLeftVent.y);
      first = mites(t)[0];
    }
    expect(first, 'a mite came out within 8 seconds').toBeDefined();
    expect(first!.home.x).toBeGreaterThan(15 * TILE);

    for (let s = 0; s < 40; s++) {
      t.run(1, byLeftVent.x, byLeftVent.y);
      expect(mites(t).length).toBeLessThanOrEqual(MATRON.boss.maxAdds);
    }
    expect(mites(t).length).toBe(MATRON.boss.maxAdds);
  });

  it('valves have pressure only in phase two; a blast flips her, and on her back she takes double damage', () => {
    const t = pumpRoom();
    const fight = t.scene.boss!;
    const [valve] = valves(t);
    const m = matronOf(t);
    const near = center(11, 9);
    t.run(0.1, near.x, near.y);
    expect(fight.canTurn(valve!)).toBe(false);
    expect(fight.turn(valve!)).toBe(false);

    phaseTwo(t);
    // Walk her under the left valve and blast her.
    m.x = valve!.x;
    m.y = valve!.y + 3 * TILE;
    const below = { x: valve!.x, y: valve!.y + 6 * TILE };
    expect(fight.turn(valve!)).toBe(true);
    t.run(0.1, below.x, below.y);
    expect(m.state).toBe('stunned');
    expect(m.deflects(angleDiff(m.face, 0))).toBe(false);

    const hp = m.hp;
    m.takeHit(1, 0, 0, t.scene);
    expect(m.hp).toBe(hp - MATRON.boss.bellyDamage);

    // The valve needs time to build pressure again, and she gets back up.
    expect(fight.canTurn(valve!)).toBe(false);
    t.run(MATRON.boss.stun + 0.2, below.x, below.y);
    expect(m.state).not.toBe('stunned');
    t.run(VALVE_COOLDOWN, 9999, 9999);
    expect(fight.canTurn(valve!)).toBe(true);
  });

  it('in phase two she seals her shell: shots from behind bounce off too, until steam flips her', () => {
    const t = pumpRoom();
    const m = phaseTwo(t);
    expect(m.sealed).toBe(true);
    expect(m.deflects(m.face + Math.PI)).toBe(true);
    m.stun(1);
    expect(m.deflects(m.face)).toBe(false);
    expect(m.deflects(m.face + Math.PI)).toBe(false);
  });

  it('steam scalds her mites too', () => {
    const t = pumpRoom();
    phaseTwo(t);
    const [valve] = valves(t);
    const mite = new Creature('boneMite', valve!.x, valve!.y + 2 * TILE, t.scene.rng);
    t.scene.addCreature(mite);
    t.scene.boss!.turn(valve!);
    t.run(BLAST_TIME, 9999, 9999);
    // Once per blast, not once per frame.
    expect(mite.hp).toBe(CREATURES.boneMite.hp - 3);
  });

  it('when she falls, her mites slink back into the vents: no kills, no loot', () => {
    const t = pumpRoom();
    const m = phaseTwo(t);
    const byLeftVent = center(4, 11);
    t.run(12, byLeftVent.x, byLeftVent.y);
    expect(mites(t).length).toBeGreaterThan(0);
    m.takeHit(999, 0, 0, t.scene);
    t.run(0.1, byLeftVent.x, byLeftVent.y);
    expect(t.killed.map((c) => c.id)).toEqual(['pumpMatron']);
    expect(mites(t)).toEqual([]);
  });

  it('once beaten she never comes back, and her prize waits in the lair until it is picked up', () => {
    const save = newSave();
    save.flags.matronDefeated = true;
    const t = pumpRoom(save);
    expect(t.scene.creatures.some((c) => c.def.boss)).toBe(false);
    expect(t.scene.boss).toBeNull();
    expect(t.scene.pickups.map((p) => p.item)).toEqual([MATRON.boss.prize.item]);

    save.flags[MATRON.boss.prize.flag] = true;
    expect(pumpRoom(save).scene.pickups).toEqual([]);
  });
});

describe('Stinkbrew', () => {
  it('creatures will not come into the cloud after a goblin standing in it', () => {
    const t = testScene(room(20, 9, [['r', 4, 5], ['r', 16, 5]]));
    const spot = center(10, 5);
    t.scene.addCloud(spot.x, spot.y);
    let closest = Infinity;
    for (let i = 0; i < 60 * 8; i++) {
      t.run(1 / 60, spot.x, spot.y);
      for (const c of t.scene.creatures) closest = Math.min(closest, Math.hypot(c.x - spot.x, c.y - spot.y));
    }
    expect(t.hits).toEqual([]);
    expect(closest).toBeGreaterThan(CLOUD_RADIUS - 8);
  });
});
