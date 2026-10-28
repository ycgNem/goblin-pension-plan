import type { TileMap } from './tilemap';
import { TILE, type Mover } from './tiles';

/** An axis-aligned box given by its center and half extents, in world pixels. */
export interface Body {
  x: number;
  y: number;
  hw: number;
  hh: number;
}

const EPS = 0.001;

function tileRange(min: number, max: number): [number, number] {
  return [Math.floor(min / TILE), Math.floor((max - EPS) / TILE)];
}

/** Is any tile under the box blocked for this mover? */
export function overlapsBlocked(map: TileMap, x: number, y: number, hw: number, hh: number, mover: Mover): boolean {
  const [c0, c1] = tileRange(x - hw, x + hw);
  const [r0, r1] = tileRange(y - hh, y + hh);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (map.isBlocked(c, r, mover)) return true;
    }
  }
  return false;
}

/** Largest distance moved per sub-step. Under half a tile, so fast moves (rolls, knockback) can't tunnel. */
const MAX_STEP = TILE / 2 - 1;

/** Move a body by (dx, dy) one axis at a time, stopping flush against blocked tiles. */
export function moveBody(body: Body, dx: number, dy: number, map: TileMap, mover: Mover): { hitX: boolean; hitY: boolean } {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_STEP));
  let hitX = false;
  let hitY = false;
  for (let i = 0; i < steps; i++) {
    const hit = moveStep(body, hitX ? 0 : dx / steps, hitY ? 0 : dy / steps, map, mover);
    hitX ||= hit.hitX;
    hitY ||= hit.hitY;
  }
  return { hitX, hitY };
}

function moveStep(body: Body, dx: number, dy: number, map: TileMap, mover: Mover): { hitX: boolean; hitY: boolean } {
  let hitX = false;
  let hitY = false;

  if (dx !== 0) {
    body.x += dx;
    if (overlapsBlocked(map, body.x, body.y, body.hw, body.hh, mover)) {
      hitX = true;
      body.x = dx > 0
        ? Math.floor((body.x + body.hw) / TILE) * TILE - body.hw - EPS
        : (Math.floor((body.x - body.hw) / TILE) + 1) * TILE + body.hw + EPS;
    }
  }

  if (dy !== 0) {
    body.y += dy;
    if (overlapsBlocked(map, body.x, body.y, body.hw, body.hh, mover)) {
      hitY = true;
      body.y = dy > 0
        ? Math.floor((body.y + body.hh) / TILE) * TILE - body.hh - EPS
        : (Math.floor((body.y - body.hh) / TILE) + 1) * TILE + body.hh + EPS;
    }
  }

  return { hitX, hitY };
}
