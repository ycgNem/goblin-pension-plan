import { artImage } from './art/assets';
import type { SheetDef } from './art/sheet-types';
import type { DrawOptions } from './sprites';

// Image-based sprites, packed by scripts/art/pack.ts: one row per clip, one cell per frame, and an
// anchor between the feet. Same contract as Sprite (draw by anchor, flip, silhouette, alpha), so
// entities move from string sprites to sheets one call at a time.

export class SheetSprite {
  private cache = new Map<string, HTMLCanvasElement>();

  constructor(readonly def: SheetDef) {}

  /** False until the image has loaded (and always in tests): draw the code fallback instead. */
  get ready(): boolean {
    return artImage(this.def.file) !== undefined;
  }

  has(clip: string): boolean {
    return clip in this.def.clips;
  }

  frames(clip: string): number {
    return this.def.clips[clip]?.frames ?? 1;
  }

  /** Draw a frame of a clip (wrapped) with its anchor at (x, y). Unknown clips draw nothing. */
  draw(ctx: CanvasRenderingContext2D, clip: string, frame: number, x: number, y: number, opts: DrawOptions = {}): void {
    const c = this.def.clips[clip];
    const img = artImage(this.def.file);
    if (!c || !img) return;
    const f = ((Math.floor(frame) % c.frames) + c.frames) % c.frames;
    const flip = opts.flip ?? false;
    const flipY = opts.flipY ?? false;
    const ax = flip ? this.def.w - 1 - this.def.ax : this.def.ax;
    // Mirrored top to bottom, the creature turns about its middle rather than its feet.
    const ay = flipY ? this.def.h - 1 - this.def.ay : this.def.ay;
    const dx = Math.round(x - ax);
    const dy = Math.round(y - ay);
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    if (!flip && !flipY && !opts.silhouette) ctx.drawImage(img, f * this.def.w, c.row * this.def.h, this.def.w, this.def.h, dx, dy, this.def.w, this.def.h);
    else ctx.drawImage(this.cell(img, c.row, f, flip, flipY, opts.silhouette), dx, dy);
    if (opts.alpha !== undefined) ctx.globalAlpha = 1;
  }

  /** A cached copy of one cell, mirrored and/or filled with one color. */
  private cell(img: HTMLImageElement, row: number, frame: number, flip: boolean, flipY: boolean, silhouette?: string): HTMLCanvasElement {
    const key = `${row}:${frame}:${flip}:${flipY}:${silhouette ?? ''}`;
    let c = this.cache.get(key);
    if (c) return c;
    const { w, h } = this.def;
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.translate(flip ? w : 0, flipY ? h : 0);
    ctx.scale(flip ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(img, frame * w, row * h, w, h, 0, 0, w, h);
    if (silhouette) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = silhouette;
      ctx.fillRect(0, 0, w, h);
    }
    this.cache.set(key, c);
    return c;
  }
}

const registry = new Map<SheetDef, SheetSprite>();

/** The shared SheetSprite for a definition. */
export function sheet(def: SheetDef): SheetSprite {
  let s = registry.get(def);
  if (!s) {
    s = new SheetSprite(def);
    registry.set(def, s);
  }
  return s;
}
