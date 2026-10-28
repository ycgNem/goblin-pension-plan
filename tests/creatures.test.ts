import { describe, expect, it } from 'vitest';
import { MAX_ATTACKERS } from '../src/data/combat';
import { CREATURES } from '../src/data/enemies';
import { countAttackers } from '../src/game/creature';
import { TILE } from '../src/world/tiles';
import { room, testScene } from './helpers';

const center = (col: number, row: number) => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

describe('creatures', () => {
  it('a slime splits into its slimelets, and slimelets do not split again', () => {
    const t = testScene(room(12, 8, [['s', 6, 4]]));
    const slime = t.scene.creatures[0]!;
    slime.takeHit(99, 0, 0, t.scene);
    t.run(1 / 60, 9999, 9999);

    const split = CREATURES.slime.splitsInto;
    expect(t.killed.map((c) => c.id)).toEqual(['slime']);
    expect(t.scene.creatures.map((c) => c.id)).toEqual(Array(split.count).fill(split.creature));

    for (const c of t.scene.creatures) c.takeHit(99, 0, 0, t.scene);
    t.run(1 / 60, 9999, 9999);
    expect(t.scene.creatures).toEqual([]);
  });

  it('a rat never bites before its windup finishes', () => {
    const t = testScene(room(12, 8, [['r', 5, 4]]));
    const goblin = center(6, 4);
    t.run(3, goblin.x, goblin.y);
    expect(t.hits.length).toBeGreaterThan(0);
    expect(t.hits[0]!).toBeGreaterThanOrEqual(CREATURES.drainRat.windup);
  });

  it(`no more than ${MAX_ATTACKERS} creatures wind up or attack at once`, () => {
    const t = testScene(room(14, 10, [['r', 5, 4], ['r', 9, 4], ['r', 5, 7], ['r', 9, 7], ['r', 7, 3]]));
    const goblin = center(7, 5);
    let worst = 0;
    for (let i = 0; i < 600; i++) {
      t.run(1 / 60, goblin.x, goblin.y);
      worst = Math.max(worst, countAttackers(t.scene.creatures));
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(MAX_ATTACKERS);
  });

  it('a hit interrupts a light creature mid-windup, but not a heavy one', () => {
    const rats = testScene(room(12, 8, [['r', 5, 4]]));
    const rat = rats.scene.creatures[0]!;
    rats.run(2 / 60, rat.x + 20, rat.y);
    expect(rat.state).toBe('windup');
    rat.takeHit(1, 0, 0, rats.scene);
    expect(rat.state).toBe('approach');
    expect(rat.stagger).toBeGreaterThan(0);

    const slimes = testScene(room(12, 8, [['s', 5, 4]]));
    const slime = slimes.scene.creatures[0]!;
    slimes.run(2 / 60, slime.x + 20, slime.y);
    expect(slime.state).toBe('windup');
    slime.takeHit(1, 0, 0, slimes.scene);
    expect(slime.state).toBe('windup');
  });

  it('gives up and goes home when the goblin is gone', () => {
    const t = testScene(room(16, 8, [['r', 3, 4]]));
    const rat = t.scene.creatures[0]!;
    const home = { x: rat.x, y: rat.y };
    t.run(1, rat.x + 60, rat.y);
    expect(rat.state).not.toBe('idle');
    t.run(8, rat.x + 60, rat.y, false);
    expect(rat.state).toBe('idle');
    expect(Math.hypot(rat.x - home.x, rat.y - home.y)).toBeLessThan(30);
  });

  it('pack members join in when one spots the goblin', () => {
    // A wall hides the goblin from the second rat, but it's close enough to hear the first.
    const t = testScene(room(16, 8, [['r', 4, 2], ['r', 4, 6], ['#', 3, 4], ['#', 4, 4], ['#', 5, 4], ['#', 6, 4]]));
    const [first, second] = t.scene.creatures;
    t.run(1 / 60, first!.x + 60, first!.y);
    expect(first!.state).toBe('approach');
    expect(second!.state).toBe('approach');
  });

  it('a chaser that loses sight finds its way around a wall', () => {
    // A wall splits the room, with a gap at the bottom. The rat starts on the left, the goblin is on the right.
    const wall: [string, number, number][] = [1, 2, 3, 4, 5, 6].map((row) => ['#', 8, row]);
    const t = testScene(room(16, 8, [['r', 4, 2], ...wall]));
    const rat = t.scene.creatures[0]!;
    const goblin = center(13, 2);
    t.scene.target.x = goblin.x;
    t.scene.target.y = goblin.y;
    rat.alert(t.scene);
    t.run(4, goblin.x, goblin.y);
    expect(rat.x).toBeGreaterThan(9 * TILE);
  });

  it('touching a creature does no damage: only its telegraphed attack does', () => {
    const t = testScene(room(12, 8, [['s', 6, 4]]));
    const slime = t.scene.creatures[0]!;
    // Stand right on top of it for most of its windup.
    t.run(CREATURES.slime.windup - 0.1, slime.x, slime.y);
    expect(t.hits).toEqual([]);
  });

  it('creatures remember their map placement, so a kill lasts until the next shift', () => {
    const t = testScene(room(12, 8, [['r', 6, 4]]));
    expect(t.scene.creatures[0]!.placementKey).toBe('galleries:6,4');
  });
});
