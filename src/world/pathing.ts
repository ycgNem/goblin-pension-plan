import type { TileMap } from './tilemap';
import { TILE, type Mover } from './tiles';

const ORTHOGONAL = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const ALL_DIRECTIONS = [...ORTHOGONAL, [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/**
 * Steps from every reachable tile to one target tile, for one kind of mover (a breadth-first flow field).
 * Maps are small, so building one costs next to nothing; callers cache them by target tile.
 */
export class FlowField {
  private readonly steps: Int32Array;

  constructor(private readonly map: TileMap, col: number, row: number, mover: Mover) {
    this.steps = new Int32Array(map.cols * map.rows).fill(-1);
    if (!map.inBounds(col, row) || map.isBlocked(col, row, mover)) return;
    const queue = [row * map.cols + col];
    this.steps[row * map.cols + col] = 0;
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head]!;
      const c = i % map.cols;
      const r = (i - c) / map.cols;
      for (const [dc, dr] of ORTHOGONAL) {
        const nc = c + dc;
        const nr = r + dr;
        if (!map.inBounds(nc, nr) || map.isBlocked(nc, nr, mover)) continue;
        const ni = nr * map.cols + nc;
        if (this.steps[ni] !== -1) continue;
        this.steps[ni] = this.steps[i]! + 1;
        queue.push(ni);
      }
    }
  }

  /** Steps to the target from a tile, or -1 if there's no way there. */
  stepsFrom(col: number, row: number): number {
    return this.map.inBounds(col, row) ? this.steps[row * this.map.cols + col]! : -1;
  }

  /** Unit direction from (x, y) toward the next tile on a shortest route, or null if there's no route. */
  direction(x: number, y: number): { x: number; y: number } | null {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    const here = this.stepsFrom(c, r);
    if (here < 0) return null;
    let best = here;
    let bc = c;
    let br = r;
    for (const [dc, dr] of ALL_DIRECTIONS) {
      // No cutting corners: a diagonal step needs both tiles beside it open.
      if (dc !== 0 && dr !== 0 && (this.stepsFrom(c + dc, r) < 0 || this.stepsFrom(c, r + dr) < 0)) continue;
      const s = this.stepsFrom(c + dc, r + dr);
      if (s >= 0 && s < best) {
        best = s;
        bc = c + dc;
        br = r + dr;
      }
    }
    const tx = bc * TILE + TILE / 2 - x;
    const ty = br * TILE + TILE / 2 - y;
    const len = Math.hypot(tx, ty);
    return len > 0.5 ? { x: tx / len, y: ty / len } : null;
  }
}
