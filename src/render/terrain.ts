import type { TileMap } from '../world/tilemap';
import type { TileKind } from '../world/tiles';
import type { TileDef, TilesetDef } from './art/sheet-types';

// Dual-grid terrain. Map cells are the corners of the display tiles: display tile (i, j) sits half
// a tile down and right of cell (i, j), and its four corners are cells (i, j), (i+1, j), (i, j+1),
// and (i+1, j+1). Each corner is floor, wall top, or wall face, and the tileset has a tile for each
// pattern of corners (with a ring of neighbors around them, for the faces). DOM-free, so tests can
// check that every map resolves.

export const FLOOR = 0;
export const WALL = 1;
/** The bottom row of a wall: drawn as its front face. */
export const FACE = 2;

function solidKind(kind: TileKind): boolean {
  return kind === 'wall' || kind === 'hole' || kind === 'void';
}

/**
 * Whether a cell counts as wall for terrain. Crawlspaces running through a wall (wall on both
 * sides of the pipe) are wall, so the wall stays whole around them and the pipe draws on top; a
 * crawl pipe lying in the open is floor. Off the map is wall, except beside an exit, where the
 * floor carries on out.
 */
function wallAt(map: TileMap, col: number, row: number): boolean {
  if (!map.inBounds(col, row)) {
    const near = map.kindAt(Math.max(0, Math.min(map.cols - 1, col)), Math.max(0, Math.min(map.rows - 1, row)));
    return near !== 'exit';
  }
  const kind = map.kindAt(col, row);
  if (solidKind(kind)) return true;
  const piped = kind === 'crawl' || (kind === 'exit' && [map.kindAt(col - 1, row), map.kindAt(col + 1, row), map.kindAt(col, row - 1), map.kindAt(col, row + 1)].includes('crawl'));
  if (piped) {
    const s = (c: number, r: number) => !map.inBounds(c, r) || solidKind(map.kindAt(c, r));
    return (s(col, row - 1) && s(col, row + 1)) || (s(col - 1, row) && s(col + 1, row));
  }
  return false;
}

/**
 * Terrain code per cell, with a one-cell border so neighborhoods never leave the array.
 * Index (col + 1) + (row + 1) * (cols + 2).
 */
export function terrainCodes(map: TileMap): Int8Array {
  const w = map.cols + 2;
  const h = map.rows + 2;
  const codes = new Int8Array(w * h);
  for (let row = -1; row <= map.rows; row++) {
    for (let col = -1; col <= map.cols; col++) {
      let code = FLOOR;
      if (wallAt(map, col, row)) {
        // A face needs wall above it to hang from; one-cell-thick walls stay plain tops.
        code = !wallAt(map, col, row + 1) && wallAt(map, col, row - 1) ? FACE : WALL;
      }
      codes[col + 1 + (row + 1) * w] = code;
    }
  }
  return codes;
}

function lattice(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise in [0, 1): blobs about `scale` cells across. */
export function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const top = lattice(x0, y0, seed) * (1 - sx) + lattice(x0 + 1, y0, seed) * sx;
  const bottom = lattice(x0, y0 + 1, seed) * (1 - sx) + lattice(x0 + 1, y0 + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

/**
 * Corners for a floor layer of two materials: the second one (the tileset's upper terrain: rubbish,
 * moss, rust) in noise-shaped patches covering roughly `coverage` of the floor. Patches keep a cell
 * clear of walls and water, whose tiles carry plain floor and would cut a patch off square. Same
 * layout as terrainCodes.
 */
export function patchCodes(map: TileMap, coverage: number, invert = false, seed = 1): Int8Array {
  const w = map.cols + 2;
  const base = invert ? 1 : 0;
  const codes = new Int8Array(w * (map.rows + 2)).fill(base);
  const blocked = (col: number, row: number) => wallAt(map, col, row) || waterAt(map, col, row);
  for (let row = -1; row <= map.rows; row++) {
    for (let col = -1; col <= map.cols; col++) {
      let near = false;
      for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1 && !near; dc++) near = blocked(col + dc, row + dr);
      if (near) continue;
      const n = valueNoise(col, row, 4.5, seed) * 0.75 + valueNoise(col, row, 1.7, seed + 9) * 0.25;
      if (n > 1 - coverage) codes[col + 1 + (row + 1) * w] = 1 - base;
    }
  }
  return codes;
}

/** Is this cell water: sludge, or a landmark standing in it (water on both sides)? */
export function waterAt(map: TileMap, col: number, row: number): boolean {
  const kind = map.kindAt(col, row);
  if (kind === 'sludge') return true;
  const wet = (k: TileKind) => k === 'sludge' || k === 'prop';
  return kind === 'prop' && wet(map.kindAt(col - 1, row)) && wet(map.kindAt(col + 1, row));
}

/** Corners for a water layer: 0 where there's water (the set's lower terrain), 1 elsewhere. */
export function waterCodes(map: TileMap): Int8Array {
  const w = map.cols + 2;
  const codes = new Int8Array(w * (map.rows + 2)).fill(1);
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) if (waterAt(map, col, row)) codes[col + 1 + (row + 1) * w] = 0;
  }
  return codes;
}

/** The 4x4 neighborhood of display tile (i, j): cells (i-1..i+2, j-1..j+2), row by row. */
export function neighborhood(codes: Int8Array, cols: number, rows: number, i: number, j: number): number[] {
  const w = cols + 2;
  const out: number[] = [];
  for (let r = j - 1; r <= j + 2; r++) {
    for (let c = i - 1; c <= i + 2; c++) {
      const cc = Math.max(-1, Math.min(cols, c));
      const rr = Math.max(-1, Math.min(rows, r));
      out.push(codes[cc + 1 + (rr + 1) * w]!);
    }
  }
  return out;
}

/**
 * The tile for a neighborhood: an exact pattern match if there is one (the most specific wins),
 * else the tile whose corners match, else the closest tile treating faces as wall. `exact` says
 * which it was, for tests.
 */
export function pickTile(set: TilesetDef, hood: readonly number[]): { tile: TileDef; exact: boolean } {
  let best: TileDef | null = null;
  let bestScore = -1;
  for (const t of set.tiles) {
    let ok = true;
    let score = 0;
    for (let k = 0; k < 16; k++) {
      const want = t.pattern[k]!;
      if (want === -1) continue;
      if (want !== hood[k]) {
        ok = false;
        break;
      }
      score++;
    }
    if (ok && score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  if (best) return { tile: best, exact: true };
  const corners = [hood[5]!, hood[6]!, hood[9]!, hood[10]!];
  const asWall = corners.map((c) => (c === FACE ? WALL : c));
  let fallback = set.tiles[0]!;
  let fallbackScore = -1;
  for (const t of set.tiles) {
    let score = 0;
    for (let k = 0; k < 4; k++) {
      if (t.corners[k] === corners[k]) score += 2;
      else if ((t.corners[k] === FACE ? WALL : t.corners[k]) === asWall[k]) score += 1;
    }
    if (score > fallbackScore) {
      fallback = t;
      fallbackScore = score;
    }
  }
  return { tile: fallback, exact: false };
}
