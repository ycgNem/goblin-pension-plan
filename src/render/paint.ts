// A tiny pixel painter for procedural art: props, portraits, title illustrations.
// Everything is drawn in whole pixels, then optionally outlined, then cached as a canvas.

export const OUTLINE = '#0e0f0d';

/** Small seeded RNG (mulberry32), so procedural art comes out the same every time. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// A 3x5 pixel font for signs, notices, and labels painted into the world. Rows are separated by '|'.
export const GLYPHS: Record<string, string> = {
  A: '.#.|#.#|###|#.#|#.#', B: '##.|#.#|##.|#.#|##.', C: '.##|#..|#..|#..|.##', D: '##.|#.#|#.#|#.#|##.',
  E: '###|#..|##.|#..|###', F: '###|#..|##.|#..|#..', G: '.##|#..|#.#|#.#|.##', H: '#.#|#.#|###|#.#|#.#',
  I: '###|.#.|.#.|.#.|###', J: '..#|..#|..#|#.#|.#.', K: '#.#|#.#|##.|#.#|#.#', L: '#..|#..|#..|#..|###',
  M: '#.#|###|###|#.#|#.#', N: '##.|#.#|#.#|#.#|#.#', O: '.#.|#.#|#.#|#.#|.#.', P: '##.|#.#|##.|#..|#..',
  Q: '.#.|#.#|#.#|##.|.##', R: '##.|#.#|##.|#.#|#.#', S: '.##|#..|.#.|..#|##.', T: '###|.#.|.#.|.#.|.#.',
  U: '#.#|#.#|#.#|#.#|###', V: '#.#|#.#|#.#|#.#|.#.', W: '#.#|#.#|###|###|#.#', X: '#.#|#.#|.#.|#.#|#.#',
  Y: '#.#|#.#|.#.|.#.|.#.', Z: '###|..#|.#.|#..|###',
  '0': '###|#.#|#.#|#.#|###', '1': '.#.|##.|.#.|.#.|###', '2': '##.|..#|.#.|#..|###', '3': '##.|..#|.#.|..#|##.',
  '4': '#.#|#.#|###|..#|..#', '5': '###|#..|##.|..#|##.', '6': '.##|#..|###|#.#|###', '7': '###|..#|.#.|.#.|.#.',
  '8': '###|#.#|###|#.#|###', '9': '###|#.#|###|..#|##.',
  '!': '.#.|.#.|.#.|...|.#.', '.': '...|...|...|...|.#.', '-': '...|...|###|...|...', ':': '...|.#.|...|.#.|...',
  ',': '...|...|...|.#.|#..', '/': '..#|..#|.#.|#..|#..', '?': '##.|..#|.#.|...|.#.', "'": '.#.|.#.|...|...|...',
  '#': '#.#|###|#.#|###|#.#',
};

const NARROW = new Set(['!', '.', ':', "'", ',']);

function glyphBits(ch: string): string | undefined {
  return GLYPHS[ch]?.replaceAll('|', '');
}

export class Painter {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  constructor(readonly w: number, readonly h: number, readonly rng: () => number = seeded(1)) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
  }

  px(x: number, y: number, c: string): void {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  rect(x: number, y: number, w: number, h: number, c: string): void {
    if (w <= 0 || h <= 0) return;
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  hline(x: number, y: number, len: number, c: string): void {
    this.rect(x, y, len, 1, c);
  }

  vline(x: number, y: number, len: number, c: string): void {
    this.rect(x, y, 1, len, c);
  }

  /** A one-pixel line (Bresenham), so diagonals stay crisp. */
  line(x0: number, y0: number, x1: number, y1: number, c: string): void {
    this.ctx.fillStyle = c;
    let x = Math.round(x0);
    let y = Math.round(y0);
    const tx = Math.round(x1);
    const ty = Math.round(y1);
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 1024; guard++) {
      this.ctx.fillRect(x, y, 1, 1);
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

  /** Filled ellipse. Pixel (x, y) is in when its center is. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): void {
    this.eachInEllipse(cx, cy, rx, ry, (x, y) => this.px(x, y, c));
  }

  /**
   * Filled ellipse with three-tone shading: light from the top left, shade to the bottom right.
   * `hi` and `lo` widen or narrow the light and dark bands.
   */
  ball(cx: number, cy: number, rx: number, ry: number, base: string, light: string, dark: string, hi = 0.55, lo = 0.45): void {
    this.eachInEllipse(cx, cy, rx, ry, (x, y, nx, ny) => {
      const d = nx + ny;
      this.px(x, y, d < -hi ? light : d > lo ? dark : base);
    });
  }

  /** A soft ellipse: solid in the middle, every other pixel toward the edge. Good for light pools. */
  softEllipse(cx: number, cy: number, rx: number, ry: number, c: string): void {
    this.eachInEllipse(cx, cy, rx, ry, (x, y, nx, ny) => {
      if (nx * nx + ny * ny > 0.55 && (x + y) % 2 !== 0) return;
      this.px(x, y, c);
    });
  }

  /** One-pixel ellipse outline. */
  ring(cx: number, cy: number, rx: number, ry: number, c: string): void {
    const inside = (x: number, y: number): boolean => {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      return nx * nx + ny * ny <= 1;
    };
    this.eachInEllipse(cx, cy, rx, ry, (x, y) => {
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) this.px(x, y, c);
    });
  }

  private eachInEllipse(cx: number, cy: number, rx: number, ry: number, fn: (x: number, y: number, nx: number, ny: number) => void): void {
    if (rx <= 0 || ry <= 0) return;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) fn(x, y, nx, ny);
      }
    }
  }

  /** Filled polygon (even-odd scanline fill). */
  poly(points: readonly (readonly [number, number])[], c: string): void {
    if (points.length < 3) return;
    const ys = points.map((p) => p[1]);
    const top = Math.floor(Math.min(...ys));
    const bottom = Math.ceil(Math.max(...ys));
    for (let y = top; y <= bottom; y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i]!;
        const b = points[(i + 1) % points.length]!;
        if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) {
          xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const x0 = Math.round(xs[i]!);
        const x1 = Math.round(xs[i + 1]!);
        if (x1 > x0) this.rect(x0, y, x1 - x0, 1, c);
      }
    }
  }

  /** Checkerboard dither over a rectangle: a cheap two-tone blend. */
  dither(x: number, y: number, w: number, h: number, c: string, phase = 0): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) if ((i + j + phase) % 2 === 0) this.px(x + i, y + j, c);
    }
  }

  /** `count` random pixels of a color inside a rectangle. */
  speckle(x: number, y: number, w: number, h: number, c: string, count: number): void {
    for (let i = 0; i < count; i++) this.px(x + Math.floor(this.rng() * w), y + Math.floor(this.rng() * h), c);
  }

  /** Text in the built-in 3x5 pixel font (uppercase). */
  text(str: string, x: number, y: number, c: string): void {
    let cx = x;
    for (const ch of str.toUpperCase()) {
      if (ch === ' ') {
        cx += 2;
        continue;
      }
      const bits = glyphBits(ch);
      if (!bits) continue;
      const narrow = NARROW.has(ch);
      for (let r = 0; r < 5; r++) {
        for (let k = 0; k < 3; k++) if (bits[r * 3 + k] === '#') this.px(cx + k - (narrow ? 1 : 0), y + r, c);
      }
      cx += narrow ? 2 : 4;
    }
  }

  static textWidth(str: string): number {
    let w = 0;
    for (const ch of str.toUpperCase()) w += ch === ' ' || NARROW.has(ch) ? 2 : 4;
    return Math.max(0, w - 1);
  }

  /** Give every opaque shape a one-pixel outline on its outside. */
  outline(c: string = OUTLINE, diagonals = false): void {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const d = img.data;
    const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < this.w && y < this.h && d[(y * this.w + x) * 4 + 3]! > 100;
    const marks: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (solid(x, y)) continue;
        const edge = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1) ||
          (diagonals && (solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1)));
        if (edge) marks.push(x, y);
      }
    }
    for (let i = 0; i < marks.length; i += 2) this.px(marks[i]!, marks[i + 1]!, c);
  }

  /** Darken the bottom `rows` rows of everything opaque, for a grounded look. */
  groundShade(rows: number, c = 'rgba(0, 0, 0, 0.25)'): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'source-atop';
    this.ctx.fillStyle = c;
    this.ctx.fillRect(0, this.h - rows, this.w, rows);
    this.ctx.restore();
  }
}

const cache = new Map<string, HTMLCanvasElement>();

/** Paint something once and keep the canvas. The key names the art and its variant. */
export function art(key: string, w: number, h: number, draw: (p: Painter) => void): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    const p = new Painter(w, h, seeded(hashString(key)));
    draw(p);
    c = p.canvas;
    cache.set(key, c);
  }
  return c;
}
