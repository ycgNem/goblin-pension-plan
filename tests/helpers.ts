import type { Creature } from '../src/game/creature';
import { newSave, type SaveData } from '../src/game/save';
import { Scene, type SceneEvents } from '../src/game/scene';
import { TileMap } from '../src/world/tilemap';

/** Small seeded RNG (mulberry32), so AI tests are repeatable. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A walled room, `w` by `h` inside, with extra glyphs stamped in at (col, row). */
export function room(w: number, h: number, stamps: [string, number, number][] = []): TileMap {
  const rows = [
    '#'.repeat(w + 2),
    ...Array.from({ length: h }, () => `#${'.'.repeat(w)}#`),
    '#'.repeat(w + 2),
  ];
  for (const [glyph, col, row] of stamps) {
    const line = rows[row]!;
    rows[row] = line.slice(0, col) + glyph + line.slice(col + 1);
  }
  return new TileMap(rows);
}

export interface TestScene {
  scene: Scene;
  save: SaveData;
  /** Times (in seconds since the start) at which a hit on the goblin landed. */
  hits: number[];
  killed: Creature[];
  /** Advance the scene with the goblin standing at (x, y). */
  run(seconds: number, x: number, y: number, alive?: boolean): void;
  /** Whether hits on the goblin land. Set false to simulate a roll or i-frames. */
  vulnerable: boolean;
  time: number;
}

export function testScene(map: TileMap, seed = 1, save: SaveData = newSave()): TestScene {
  const t: TestScene = {
    save,
    hits: [],
    killed: [],
    vulnerable: true,
    time: 0,
    scene: undefined as unknown as Scene,
    run(seconds, x, y, alive = true) {
      const dt = 1 / 60;
      for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
        t.time += dt;
        t.scene.update(dt, { x, y, alive });
      }
    },
  };
  const events: SceneEvents = {
    hurtPlayer: () => {
      if (!t.vulnerable) return false;
      t.hits.push(t.time);
      return true;
    },
    creatureHit: () => {},
    creatureKilled: (c) => t.killed.push(c),
  };
  t.scene = new Scene('galleries', map, save, events, seededRng(seed));
  return t;
}
