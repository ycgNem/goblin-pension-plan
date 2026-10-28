import { describe, expect, it } from 'vitest';
import { HOME_REGION, REGIONS, REGION_IDS, START_REGION } from '../src/data/regions';
import { moveBody } from '../src/world/collision';
import { FlowField } from '../src/world/pathing';
import { TileMap } from '../src/world/tilemap';
import { blocks, TILE, type Mover } from '../src/world/tiles';

/** Tiles a mover can reach from (col, row), as "col,row" keys. */
function reachable(map: TileMap, col: number, row: number, mover: Mover): Set<string> {
  const seen = new Set<string>([`${col},${row}`]);
  const queue: [number, number][] = [[col, row]];
  while (queue.length) {
    const [c, r] = queue.shift()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc;
      const nr = r + dr;
      const key = `${nc},${nr}`;
      if (seen.has(key) || map.isBlocked(nc, nr, mover)) continue;
      seen.add(key);
      queue.push([nc, nr]);
    }
  }
  return seen;
}

describe.each(REGION_IDS)('region %s', (id) => {
  const region = REGIONS[id];
  const map = TileMap.forRegion(id);

  it('has a link for every exit on its map, and an exit for every link', () => {
    const onMap = map.exits.map((e) => e.glyph).sort();
    expect(onMap).toEqual(Object.keys(region.exits).sort());
    expect(new Set(onMap).size, 'duplicate exit glyphs').toBe(onMap.length);
  });

  it('links are two-way', () => {
    for (const [glyph, link] of Object.entries(region.exits)) {
      const back = REGIONS[link.to].exits[link.exit];
      expect(back, `${id}:${glyph} -> ${link.to}:${link.exit}`).toEqual(expect.objectContaining({ to: id, exit: glyph }));
    }
  });

  it('has somewhere to stand next to every exit', () => {
    for (const e of map.exits) expect(map.arrivalTile(e.glyph), `exit ${e.glyph}`).toBeDefined();
  });

  it('with gates open, a goblin can reach every exit and every placed thing', () => {
    map.gateOpen = true;
    const start = map.arrivalTile(map.exits[0]!.glyph)!;
    const seen = reachable(map, start.col, start.row, 'goblin');
    for (const e of map.exits) expect(seen.has(`${e.col},${e.row}`), `exit ${e.glyph}`).toBe(true);
    for (const s of map.spawns) {
      if (s.def.solid) continue;
      expect(seen.has(`${s.col},${s.row}`), `${s.def.label} at ${s.col},${s.row}`).toBe(true);
    }
  });

  it('with gates closed, every ungated exit is still connected and gated exits are cut off', () => {
    map.gateOpen = false;
    const gated = new Set(region.gatedExits ?? []);
    const open = map.exits.filter((e) => !gated.has(e.glyph));
    const start = map.arrivalTile(open[0]!.glyph)!;
    const seen = reachable(map, start.col, start.row, 'goblin');
    for (const e of open) expect(seen.has(`${e.col},${e.row}`), `exit ${e.glyph}`).toBe(true);
    for (const e of map.exits.filter((x) => gated.has(x.glyph))) {
      expect(seen.has(`${e.col},${e.row}`), `gated exit ${e.glyph} should be cut off`).toBe(false);
    }
  });

  it('safe regions contain no hostile spawns', () => {
    if (!region.safe) return;
    expect(map.spawns.filter((s) => s.def.kind === 'creature' || s.def.kind === 'human')).toEqual([]);
  });
});

describe('world', () => {
  it('the start region has a new-game spawn', () => {
    expect(TileMap.forRegion(START_REGION).spawnOf('player')).toBeDefined();
  });

  it('every region is reachable from the Burrow through ungated exits', () => {
    const seen = new Set([START_REGION]);
    const queue = [START_REGION];
    while (queue.length) {
      const id = queue.shift()!;
      const gated = new Set(REGIONS[id].gatedExits ?? []);
      for (const [glyph, link] of Object.entries(REGIONS[id].exits)) {
        if (gated.has(glyph) || seen.has(link.to)) continue;
        seen.add(link.to);
        queue.push(link.to);
      }
    }
    expect([...seen].sort()).toEqual([...REGION_IDS].sort());
  });

  it('rejects unknown glyphs', () => {
    expect(() => new TileMap(['#?#'])).toThrow(/Unknown map glyph/);
  });

  it('home is a safe region', () => {
    expect(REGIONS[HOME_REGION].safe).toBe(true);
  });

  it('only the goblin leaves through exits; humans also stay out of crawlspaces', () => {
    expect(blocks('exit', 'goblin', false)).toBe(false);
    expect(blocks('exit', 'creature', false)).toBe(true);
    expect(blocks('exit', 'human', false)).toBe(true);
    expect(blocks('crawl', 'creature', false)).toBe(false);
    expect(blocks('crawl', 'human', false)).toBe(true);
  });
});

describe('pathing', () => {
  const map = new TileMap([
    '#######',
    '#..#..#',
    '#..#..#',
    '#.....#',
    '###c###',
    '#.....#',
    '#######',
  ]);

  it('routes around walls, not through them', () => {
    const field = new FlowField(map, 5, 1, 'creature');
    expect(field.stepsFrom(1, 1)).toBe(8);
    // From the top-left room, the way to the top-right room starts by heading down to the gap.
    const dir = field.direction(1 * TILE + 8, 1 * TILE + 8)!;
    expect(dir.y).toBeGreaterThan(0);
  });

  it('respects who fits where: humans have no route through a crawlspace', () => {
    expect(new FlowField(map, 1, 5, 'creature').stepsFrom(1, 1)).toBeGreaterThan(0);
    expect(new FlowField(map, 1, 5, 'human').stepsFrom(1, 1)).toBe(-1);
    expect(new FlowField(map, 1, 5, 'human').direction(1 * TILE + 8, 1 * TILE + 8)).toBeNull();
  });
});

describe('collision', () => {
  const map = new TileMap([
    '#####',
    '#...#',
    '#c..#',
    '#####',
  ]);

  it('stops flush against walls', () => {
    const body = { x: 2.5 * TILE, y: 1.5 * TILE, hw: 5, hh: 4 };
    moveBody(body, 40, 0, map, 'goblin');
    expect(body.x + body.hw).toBeLessThanOrEqual(4 * TILE);
    expect(body.x + body.hw).toBeGreaterThan(4 * TILE - 0.01);
  });

  it('lets goblins into crawlspaces and keeps humans out', () => {
    const goblin = { x: 2.5 * TILE, y: 2.5 * TILE, hw: 5, hh: 4 };
    for (let i = 0; i < 10; i++) moveBody(goblin, -2, 0, map, 'goblin');
    expect(Math.floor(goblin.x / TILE)).toBe(1);

    const human = { x: 2.5 * TILE, y: 2.5 * TILE, hw: 6, hh: 6 };
    for (let i = 0; i < 10; i++) moveBody(human, -2, 0, map, 'human');
    expect(human.x - human.hw).toBeGreaterThanOrEqual(2 * TILE);
  });
});
