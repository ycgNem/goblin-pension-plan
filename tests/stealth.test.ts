import { describe, expect, it } from 'vitest';
import { newSave } from '../src/game/save';
import { Human, type HumanWorld } from '../src/game/human';
import { Scene, type SceneEvents } from '../src/game/scene';
import { TILE } from '../src/world/tiles';
import type { TileMap } from '../src/world/tilemap';
import { room, seededRng } from './helpers';

interface Goblin {
  x: number;
  y: number;
  hidden?: boolean;
  sneaking?: boolean;
  speed?: number;
}

function stage(map: TileMap, seed = 3) {
  const log = { spotted: 0, alarms: 0, hits: 0 };
  const events: SceneEvents = {
    hurtPlayer: () => {
      log.hits++;
      return true;
    },
    creatureHit: () => {},
    creatureKilled: () => {},
    spotted: () => log.spotted++,
    alarm: () => log.alarms++,
  };
  const scene = new Scene('galleries', map, newSave(), events, seededRng(seed));
  const run = (seconds: number, g: Goblin, each?: () => void) => {
    for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
      scene.update(1 / 60, { alive: true, hidden: false, sneaking: false, speed: 0, ...g });
      each?.();
    }
  };
  return { scene, log, run };
}

/** A person standing at (col, row), looking east, minding their own business. */
function guard(scene: Scene, id: ConstructorParameters<typeof Human>[0], col: number, row: number): Human {
  const h = new Human(id, col * TILE + TILE / 2, row * TILE + TILE / 2);
  h.task = 'work';
  h.face = h.workFace = 0;
  scene.humans.push(h);
  return h;
}

describe('stealth', () => {
  it('a goblin that slipped into cover unseen is never noticed, even up close', () => {
    const { scene, run } = stage(room(14, 7));
    const h = guard(scene, 'paladin', 3, 4);
    run(6, { x: h.x + 14, y: h.y, hidden: true });
    expect(h.awareness).toBe('unaware');
    expect(h.suspicion).toBe(0);
  });

  it('standing in plain view fills the meter and turns them hostile', () => {
    const { scene, log, run } = stage(room(14, 7));
    const h = guard(scene, 'paladin', 3, 4);
    run(0.3, { x: h.x + 60, y: h.y });
    expect(h.awareness).toBe('suspicious');
    run(2.5, { x: h.x + 60, y: h.y });
    expect(h.awareness).toBe('hostile');
    expect(log.spotted).toBe(1);
  });

  it('nobody notices what is behind them', () => {
    const { scene, run } = stage(room(14, 7));
    const h = guard(scene, 'paladin', 8, 4);
    run(4, { x: h.x - 50, y: h.y });
    expect(h.awareness).toBe('unaware');
  });

  it('sneaking halves how fast suspicion builds', () => {
    const { scene } = stage(room(14, 7));
    const h = guard(scene, 'ranger', 3, 4);
    const world = (sneaking: boolean) => ({ goblin: { x: h.x + 70, y: h.y, alive: true, hidden: false, sneaking, speed: 30 } }) as unknown as HumanWorld;
    expect(h.suspicionRate(world(true)) / h.suspicionRate(world(false))).toBeCloseTo(0.5);
  });

  it('a pursuit always ends: they search, give up, and go back', () => {
    const { scene, run } = stage(room(14, 7));
    const h = guard(scene, 'paladin', 3, 4);
    const start = { x: h.x, y: h.y };
    run(3, { x: h.x + 60, y: h.y });
    expect(h.awareness).toBe('hostile');
    // Into cover. Searching takes a while, but never forever.
    let ended = -1;
    let t = 0;
    run(16, { x: 12 * TILE, y: 6 * TILE, hidden: true }, () => {
      t += 1 / 60;
      if (ended < 0 && (h.awareness === 'returning' || h.awareness === 'unaware')) ended = t;
    });
    expect(ended).toBeGreaterThan(0);
    expect(ended).toBeLessThan(15);
    run(10, { x: 12 * TILE, y: 6 * TILE, hidden: true });
    expect(h.awareness).toBe('unaware');
    expect(Math.hypot(h.x - start.x, h.y - start.y)).toBeLessThan(TILE * 2);
  });

  it('a pebble makes them look; a smashed bottle sends them to search', () => {
    const { scene, run } = stage(room(14, 7));
    const h = guard(scene, 'paladin', 3, 4);
    scene.noise(h.x + 40, h.y + 30, 60);
    expect(h.awareness).toBe('suspicious');
    run(4, { x: 12 * TILE, y: 6 * TILE, hidden: true });
    expect(h.awareness).not.toBe('hostile');

    const other = guard(scene, 'apprentice', 3, 2);
    scene.noise(other.x + 60, other.y + 40, 130);
    expect(other.awareness).toBe('searching');
  });

  it('noises out of earshot change nothing', () => {
    const { scene } = stage(room(14, 7));
    const h = guard(scene, 'paladin', 2, 2);
    scene.noise(12 * TILE, 6 * TILE, 60);
    expect(h.awareness).toBe('unaware');
  });

  it('people never follow a goblin into a crawlspace', () => {
    // A wall down the middle of the room, with a goblin-sized gap.
    const stamps: [string, number, number][] = [];
    for (let row = 1; row <= 5; row++) stamps.push([row === 3 ? 'c' : '#', 8, row]);
    const map = room(14, 5, stamps);
    const { scene, run } = stage(map);
    const h = guard(scene, 'paladin', 5, 3);
    let entered = false;
    // The goblin waits just past the gap, in full view, for long enough to be charged at.
    run(12, { x: 10 * TILE + 8, y: 3 * TILE + 8 }, () => {
      const kind = map.kindAt(Math.floor(h.x / TILE), Math.floor(h.y / TILE));
      if (kind === 'crawl' || kind === 'wall') entered = true;
    });
    expect(h.awareness).toBe('hostile');
    expect(entered).toBe(false);
    expect(h.x).toBeLessThan(8 * TILE);
  });

  it('the pipe inspector runs and whistles instead of fighting', () => {
    const { scene, log, run } = stage(room(14, 7));
    const h = guard(scene, 'inspector', 3, 4);
    h.exit = { x: 2 * TILE, y: 2 * TILE };
    run(4, { x: h.x + 30, y: h.y });
    expect(log.alarms).toBe(1);
    expect(log.hits).toBe(0);
    expect(['flee', 'gone']).toContain(h.task);
  });
});
