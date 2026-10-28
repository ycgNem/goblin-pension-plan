import { clamp, damp } from '../core/math';
import { VIEW_H, VIEW_W } from '../core/screen';
import type { TileMap } from '../world/tilemap';

/**
 * The camera may look this far above the top of the map, so the top rows can sit below the
 * HUD (hearts and the objective) instead of under it.
 */
export const HUD_TOP = 36;

/** Top-left corner of the view in world pixels. Smoothly follows a target and clamps to the map. */
export class Camera {
  x = 0;
  y = 0;

  follow(tx: number, ty: number, map: TileMap, dt: number): void {
    const t = damp(10, dt);
    this.x += (this.targetX(tx, map) - this.x) * t;
    this.y += (this.targetY(ty, map) - this.y) * t;
  }

  snap(tx: number, ty: number, map: TileMap): void {
    this.x = this.targetX(tx, map);
    this.y = this.targetY(ty, map);
  }

  private targetX(tx: number, map: TileMap): number {
    // Maps narrower than the view are centered.
    if (map.widthPx <= VIEW_W) return (map.widthPx - VIEW_W) / 2;
    return clamp(tx - VIEW_W / 2, 0, map.widthPx - VIEW_W);
  }

  private targetY(ty: number, map: TileMap): number {
    const free = VIEW_H - map.heightPx;
    // Short maps are centered, but never tucked up under the HUD if there's room below it.
    if (free >= 0) return -Math.min(free, Math.max(free / 2, HUD_TOP));
    return clamp(ty - VIEW_H / 2, -HUD_TOP, map.heightPx - VIEW_H);
  }

  /** Rounded offset for drawing, so tiles stay on whole pixels. */
  get drawX(): number {
    return Math.round(this.x);
  }

  get drawY(): number {
    return Math.round(this.y);
  }
}
