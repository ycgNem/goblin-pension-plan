import { describe, expect, it } from 'vitest';
import type { Controls } from '../src/core/input';
import { CHARGED_SHOT, PLAYER } from '../src/data/combat';
import { xpForLevel } from '../src/data/skills';
import { applyDamage, createHealth, heal, setMax, tickHealth } from '../src/game/health';
import { Player } from '../src/game/player';
import { stepProjectile, type Projectile } from '../src/game/projectiles';
import { newSave } from '../src/game/save';
import { playerStats } from '../src/game/stats';
import { isSpent, markSpent, pruneSpent, shiftIndex } from '../src/game/world-state';
import { SHIFT_SECONDS } from '../src/data/economy';
import { lineOfSight } from '../src/world/sight';
import { TILE } from '../src/world/tiles';
import { room, testScene } from './helpers';

const shot = (x: number, y: number, vx: number, vy: number, extra: Partial<Projectile> = {}): Projectile => ({
  kind: 'scrap', owner: 'player', x, y, vx, vy, travelled: 0, range: 500, radius: 2, damage: 1, knockback: 0, dead: false, ...extra,
});

describe('health', () => {
  it('a hit lands, then i-frames block hits until they run out', () => {
    const h = createHealth(10);
    expect(applyDamage(h, 2, 0.9)).toBe(true);
    expect(h.hp).toBe(8);
    expect(applyDamage(h, 2, 0.9)).toBe(false);
    tickHealth(h, 0.89);
    expect(applyDamage(h, 2, 0.9)).toBe(false);
    tickHealth(h, 0.02);
    expect(applyDamage(h, 2, 0.9)).toBe(true);
    expect(h.hp).toBe(6);
  });

  it('never drops below zero or heals above max', () => {
    const h = createHealth(10);
    applyDamage(h, 99, 0);
    expect(h.hp).toBe(0);
    expect(applyDamage(h, 1, 0)).toBe(false);
    expect(heal(h, 99)).toBe(10);
    expect(h.hp).toBe(10);
    setMax(h, 6);
    expect(h.hp).toBe(6);
  });

  it('scrapping milestones: faster rolls at 2, an extra heart at 6', () => {
    const save = newSave();
    expect(playerStats(save)).toMatchObject({ maxHp: 10, rollCooldown: PLAYER.roll.cooldown });
    save.skillXp.scrapping = xpForLevel(2);
    expect(playerStats(save)).toMatchObject({ maxHp: 10, rollCooldown: PLAYER.roll.fastCooldown });
    save.skillXp.scrapping = xpForLevel(6);
    expect(playerStats(save).maxHp).toBe(12);
  });
});

describe('dodge roll', () => {
  const controls = (pressed: string[] = [], held: string[] = []): Controls => ({
    isDown: (code) => held.includes(code),
    wasPressed: (code) => pressed.includes(code),
    isMouseDown: () => false,
    moveAxis: () => ({ x: 1, y: 0 }),
  });

  it('ignores damage during its i-frames, then can be hit again', () => {
    const map = room(20, 5);
    const p = new Player();
    p.place(3 * TILE, 3 * TILE);
    const stats = playerStats(newSave());
    const actions = p.update(1 / 60, controls(['Space']), map, 999, 0, stats, 0.3);
    expect(actions.rolled).toBe(true);
    expect(p.invulnerable).toBe(true);
    expect(p.hurt(1, 0, 0)).toBe(false);

    for (let t = 0; t < PLAYER.roll.time + 0.05; t += 1 / 60) p.update(1 / 60, controls(), map, 999, 0, stats, 0.3);
    expect(p.rolling).toBe(false);
    expect(p.hurt(1, 0, 0)).toBe(true);
    expect(p.health.hp).toBe(9);
  });

  it('a roll pressed slightly early still comes out', () => {
    const map = room(20, 5);
    const p = new Player();
    p.place(3 * TILE, 3 * TILE);
    const stats = playerStats(newSave());
    const tick = (pressed: string[] = []) => p.update(1 / 60, controls(pressed), map, 999, 0, stats, 0.3);
    tick(['Space']);
    while (p.rolling) tick();
    // Press again a little before the cooldown is over, inside the buffer window.
    for (let s = 0; s < stats.rollCooldown - PLAYER.roll.buffer / 2; s += 1 / 60) tick();
    expect(p.rolling).toBe(false);
    tick(['Space']);
    for (let s = 0; s < PLAYER.roll.buffer && !p.rolling; s += 1 / 60) tick();
    expect(p.rolling).toBe(true);
  });
});

describe('charged shot', () => {
  const holding = (rightMouse: boolean): Controls => ({
    isDown: () => false,
    wasPressed: () => false,
    isMouseDown: (button = 0) => rightMouse && button === 2,
    moveAxis: () => ({ x: 0, y: 0 }),
  });

  /** Hold right mouse for `seconds`, then let go. Returns whether a charged shot came out. */
  function holdAndRelease(scrappingLevel: number, seconds: number): boolean {
    const map = room(10, 5);
    const p = new Player();
    p.place(3 * TILE, 3 * TILE);
    const save = newSave();
    save.skillXp.scrapping = xpForLevel(scrappingLevel);
    const stats = playerStats(save);
    for (let t = 0; t < seconds; t += 1 / 60) p.update(1 / 60, holding(true), map, 999, 0, stats, 0.3);
    return p.update(1 / 60, holding(false), map, 999, 0, stats, 0.3).charged;
  }

  it('needs Scrapping 4', () => {
    expect(holdAndRelease(3, 1)).toBe(false);
    expect(holdAndRelease(4, 1)).toBe(true);
  });

  it('needs a full charge', () => {
    expect(holdAndRelease(4, CHARGED_SHOT.chargeTime / 2)).toBe(false);
  });
});

describe('projectiles', () => {
  it('stop at walls', () => {
    const map = room(10, 3);
    const p = shot(2 * TILE, 2 * TILE, 300, 0);
    let result = stepProjectile(p, 1 / 60, map);
    for (let i = 0; i < 120 && result === 'flying'; i++) result = stepProjectile(p, 1 / 60, map);
    expect(result).toBe('wall');
    expect(p.x).toBeGreaterThanOrEqual(11 * TILE);
    expect(p.x).toBeLessThan(11 * TILE + 5);
  });

  it('fizzle at the end of their range', () => {
    const map = room(30, 3);
    const p = shot(2 * TILE, 2 * TILE, 300, 0, { range: 100 });
    let result = stepProjectile(p, 1 / 60, map);
    for (let i = 0; i < 120 && result === 'flying'; i++) result = stepProjectile(p, 1 / 60, map);
    expect(result).toBe('spent');
    expect(p.travelled).toBeCloseTo(100);
  });

  it('a player shot hits a creature once and is used up', () => {
    const t = testScene(room(14, 6, [['r', 10, 3]]));
    const rat = t.scene.creatures[0]!;
    t.scene.spawnProjectile(shot(rat.x - 60, rat.y, 270, 0));
    t.run(0.4, 9999, 9999);
    expect(rat.hp).toBe(rat.def.hp - 1);
    expect(t.scene.projectiles).toEqual([]);
  });

  it('enemy shots pass through a rolling goblin', () => {
    const t = testScene(room(14, 6));
    t.vulnerable = false;
    const gx = 7 * TILE;
    const gy = 3 * TILE + 8;
    t.scene.spawnProjectile(shot(gx - 40, gy, 110, 0, { owner: 'enemy', kind: 'gel', radius: 3, range: 110 }));
    t.run(0.45, gx, gy);
    expect(t.hits).toEqual([]);
    const blob = t.scene.projectiles[0];
    expect(blob?.x).toBeGreaterThan(gx);
  });
});

describe('line of sight', () => {
  const map = room(10, 6, [['#', 5, 1], ['#', 5, 2], ['#', 5, 3]]);
  const at = (col: number, row: number) => [col * TILE + 8, row * TILE + 8] as const;

  it('sees across open floor', () => {
    expect(lineOfSight(map, ...at(1, 5), ...at(9, 5))).toBe(true);
    expect(lineOfSight(map, ...at(2, 2), ...at(2, 2))).toBe(true);
  });

  it('is blocked by walls', () => {
    expect(lineOfSight(map, ...at(2, 2), ...at(8, 2))).toBe(false);
    expect(lineOfSight(map, ...at(8, 1), ...at(2, 3))).toBe(false);
  });

  it('sees around the end of a wall', () => {
    expect(lineOfSight(map, ...at(2, 5), ...at(8, 5))).toBe(true);
  });
});

describe('shift memory', () => {
  it('a defeated placement stays spent until the next shift', () => {
    const save = newSave();
    save.playTime = 10;
    markSpent(save, 'galleries:1,1');
    expect(isSpent(save, 'galleries:1,1')).toBe(true);
    expect(isSpent(save, 'galleries:2,2')).toBe(false);

    save.playTime = SHIFT_SECONDS + 1;
    expect(shiftIndex(save.playTime)).toBe(1);
    expect(isSpent(save, 'galleries:1,1')).toBe(false);
    pruneSpent(save);
    expect(save.spent).toEqual({});
  });

  it('the scene leaves spent creatures out', () => {
    const save = newSave();
    markSpent(save, 'galleries:4,3');
    const t = testScene(room(12, 6, [['r', 4, 3], ['r', 8, 3]]), 1, save);
    expect(t.scene.creatures.map((c) => c.placementKey)).toEqual(['galleries:8,3']);
  });
});
