// Pixel sprites defined as text: one string per row, one character per pixel, '.' transparent.
// Each character maps to a color through the sprite's palette. Frames are rendered to
// offscreen canvases the first time they're drawn, then reused.

export interface SpriteDef {
  w: number;
  h: number;
  palette: Readonly<Record<string, string>>;
  frames: readonly (readonly string[])[];
  /** The pixel that sits on the entity's position, usually between the feet. */
  anchor: readonly [number, number];
}

export interface DrawOptions {
  flip?: boolean;
  /** Draw as a solid silhouette of this color (hit flash, telegraph blink). */
  silhouette?: string;
  alpha?: number;
}

export class Sprite {
  private cache = new Map<string, HTMLCanvasElement>();

  constructor(readonly def: SpriteDef) {}

  get frameCount(): number {
    return this.def.frames.length;
  }

  /** Draw frame `frame` (wrapped) with its anchor at (x, y). */
  draw(ctx: CanvasRenderingContext2D, frame: number, x: number, y: number, opts: DrawOptions = {}): void {
    const f = ((frame % this.frameCount) + this.frameCount) % this.frameCount;
    const canvas = this.canvas(f, opts.flip ?? false, opts.silhouette);
    const ax = opts.flip ? this.def.w - 1 - this.def.anchor[0] : this.def.anchor[0];
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    ctx.drawImage(canvas, Math.round(x - ax), Math.round(y - this.def.anchor[1]));
    if (opts.alpha !== undefined) ctx.globalAlpha = 1;
  }

  private canvas(frame: number, flip: boolean, silhouette?: string): HTMLCanvasElement {
    const key = `${frame}:${flip}:${silhouette ?? ''}`;
    let c = this.cache.get(key);
    if (!c) {
      c = paint(this.def, frame, flip, silhouette);
      this.cache.set(key, c);
    }
    return c;
  }
}

function paint(def: SpriteDef, frame: number, flip: boolean, silhouette?: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = def.w;
  c.height = def.h;
  const ctx = c.getContext('2d')!;
  const rows = def.frames[frame] ?? [];
  rows.forEach((row, y) => {
    for (let x = 0; x < def.w; x++) {
      const ch = row[x] ?? '.';
      if (ch === '.' || ch === ' ') continue;
      const color = silhouette ?? def.palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(flip ? def.w - 1 - x : x, y, 1, 1);
    }
  });
  return c;
}

const registry = new Map<SpriteDef, Sprite>();

/** The shared Sprite for a definition. */
export function sprite(def: SpriteDef): Sprite {
  let s = registry.get(def);
  if (!s) {
    s = new Sprite(def);
    registry.set(def, s);
  }
  return s;
}

/** Problems with a sprite definition (wrong row widths, unknown colors). Used by tests. */
export function validateSprite(name: string, def: SpriteDef): string[] {
  const problems: string[] = [];
  def.frames.forEach((rows, f) => {
    if (rows.length !== def.h) problems.push(`${name}[${f}] has ${rows.length} rows, expected ${def.h}`);
    rows.forEach((row, y) => {
      if (row.length !== def.w) problems.push(`${name}[${f}] row ${y} is ${row.length} wide, expected ${def.w}: '${row}'`);
      for (const ch of row) {
        if (ch !== '.' && !(ch in def.palette)) problems.push(`${name}[${f}] row ${y} uses unknown color '${ch}'`);
      }
    });
  });
  return problems;
}

/** A one-pixel-wide line between two points, Bresenham style, so it stays crisp. */
export function pixelLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, size = 1): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 512; guard++) {
    ctx.fillRect(x, y, size, size);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** A filled ellipse made of one-pixel rows. */
export function pixelEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  const top = Math.floor(cy - ry);
  const bottom = Math.ceil(cy + ry);
  for (let y = top; y < bottom; y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const half = Math.round(rx * Math.sqrt(1 - dy * dy));
    if (half > 0) ctx.fillRect(Math.round(cx) - half, y, half * 2, 1);
  }
}
