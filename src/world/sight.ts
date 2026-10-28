import type { TileMap } from './tilemap';
import { TILE } from './tiles';

/**
 * Can a point at (x0, y0) see a point at (x1, y1)? Walks every tile the segment crosses
 * (Amanatides & Woo grid traversal) and fails on the first one that blocks sight.
 */
export function lineOfSight(map: TileMap, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let col = Math.floor(x0 / TILE);
  let row = Math.floor(y0 / TILE);
  const stepCol = dx > 0 ? 1 : -1;
  const stepRow = dy > 0 ? 1 : -1;
  // Fraction of the segment needed to cross one whole tile on each axis.
  const deltaCol = dx !== 0 ? TILE / Math.abs(dx) : Infinity;
  const deltaRow = dy !== 0 ? TILE / Math.abs(dy) : Infinity;
  // Fraction of the segment at which it first crosses into the next column / row.
  let nextCol = dx !== 0 ? (dx > 0 ? (col + 1) * TILE - x0 : x0 - col * TILE) / Math.abs(dx) : Infinity;
  let nextRow = dy !== 0 ? (dy > 0 ? (row + 1) * TILE - y0 : y0 - row * TILE) / Math.abs(dy) : Infinity;

  for (;;) {
    if (Math.min(nextCol, nextRow) >= 1) return true;
    if (nextCol < nextRow) {
      col += stepCol;
      nextCol += deltaCol;
    } else {
      row += stepRow;
      nextRow += deltaRow;
    }
    if (map.blocksSight(col, row)) return false;
  }
}
