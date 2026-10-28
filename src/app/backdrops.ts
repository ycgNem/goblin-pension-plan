import type { PanelArt } from '../data/story';
import { drawProp } from '../render/art/props';
import { art, type Painter } from '../render/paint';

// Painted backdrops for the title screen and the story intro. Static layers are painted once;
// title.ts and intro.ts animate on top (falling rubbish, bells, torches, steam).

export const TITLE_H = 340;
export const GROUND_Y = 132;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Vertical bands between colors, with ordered dithering at each seam. */
function bands(p: Painter, x: number, y: number, w: number, h: number, colors: readonly string[]): void {
  const n = colors.length - 1;
  for (let j = 0; j < h; j++) {
    const t = (j / Math.max(1, h - 1)) * n;
    const i = Math.min(n - 1, Math.floor(t));
    const f = t - i;
    for (let k = 0; k < w; k++) {
      const threshold = (BAYER4[((y + j) % 4) * 4 + ((x + k) % 4)]! + 0.5) / 16;
      p.px(x + k, y + j, f > threshold ? colors[i + 1]! : colors[i]!);
    }
  }
}

const DUSK = ['#120f24', '#1d1838', '#33224a', '#5a2c4c', '#8a3c44', '#c86a40', '#e89a50'];

function stars(p: Painter, w: number, h: number): void {
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(p.rng() * w);
    const y = Math.floor(p.rng() * h);
    p.px(x, y, p.rng() < 0.2 ? '#fff4d8' : '#8a88a8');
  }
}

/** Bellmarket's rooftops and bell towers against the sky. Returns the bell positions. */
function skyline(p: Painter, baseY: number, w: number, dark = '#17141f', lit = '#f0b050'): [number, number][] {
  const bells: [number, number][] = [];
  let x = -6;
  while (x < w) {
    const bw = 14 + Math.floor(p.rng() * 26);
    const tower = bells.length < 3 && (x > 70 + bells.length * 140 && x < 110 + bells.length * 140);
    const bh = tower ? 64 + p.rng() * 16 : 18 + Math.floor(p.rng() * 30);
    const top = baseY - bh;
    p.rect(x, top, bw, bh, dark);
    if (tower) {
      const cx = x + Math.floor(bw / 2);
      p.poly([[x - 2, top + 1], [cx, top - 22], [x + bw + 2, top + 1]], dark);
      p.rect(cx - 4, top + 6, 9, 10, '#0c0a12');
      bells.push([cx, top + 8]);
      p.vline(cx, top - 30, 8, dark);
    } else if (p.rng() < 0.45) {
      p.poly([[x, top], [x + bw / 2, top - 8 - p.rng() * 6], [x + bw, top]], dark);
    }
    if (p.rng() < 0.4) p.rect(x + 3, top - 6, 3, 6, dark);
    for (let wy = top + 4; wy < baseY - 3; wy += 6) {
      for (let wx = x + 3; wx < x + bw - 2; wx += 5) if (p.rng() < 0.22) p.rect(wx, wy, 2, 3, lit);
    }
    x += bw + (p.rng() < 0.3 ? 2 : 0);
  }
  return bells;
}

function cobbles(p: Painter, y: number, w: number): void {
  p.rect(0, y, w, 8, '#3a3430');
  for (let x = 0; x < w; x += 5) {
    p.rect(x + (Math.floor(x / 5) % 2), y + 1, 4, 3, '#4e4640');
    p.rect(x + 2 - (Math.floor(x / 5) % 2), y + 5, 4, 2, '#463e38');
  }
  p.hline(0, y, w, '#6a6058');
}

function earth(p: Painter, y0: number, y1: number, w: number): void {
  p.rect(0, y0, w, y1 - y0, '#16120f');
  for (let i = 0; i < 9; i++) {
    const sy = y0 + 10 + i * ((y1 - y0) / 9);
    for (let x = 0; x < w; x++) p.px(x, sy + Math.round(Math.sin(x * 0.03 + i) * 3), i % 2 ? '#1e1814' : '#120e0c');
  }
  p.speckle(0, y0, w, y1 - y0, '#2a221c', 300);
}

function pipe(p: Painter, x0: number, x1: number, y: number, copper = false): void {
  const [base, hi, lo] = copper ? ['#a86a30', '#e09a58', '#6a3a18'] : ['#4a4e54', '#7a8086', '#2a2c30'];
  p.rect(x0, y, x1 - x0, 4, base);
  p.hline(x0, y, x1 - x0, hi);
  p.hline(x0, y + 3, x1 - x0, lo);
  for (let x = x0 + 12; x < x1; x += 28) {
    p.rect(x, y - 1, 3, 6, lo);
    p.vline(x, y - 1, 6, hi);
  }
}

/** The Burrow, cut away: a lit alcove in the rock. `warm` chooses lantern light or the cold green start. */
function alcove(p: Painter, cx: number, cy: number, warm: boolean): void {
  p.ellipse(cx, cy, 78, 34, '#0a0806');
  p.ellipse(cx, cy, 75, 31, warm ? '#2e2218' : '#1c241e');
  // Light pooling in the middle.
  const glow = warm ? ['#4a3220', '#5e3e26', '#74502e'] : ['#24302a', '#2c3a32', '#34443a'];
  glow.forEach((c, i) => {
    const rx = 64 - i * 18;
    const ry = 26 - i * 7;
    p.softEllipse(cx, cy + 4, rx, ry, c);
  });
  p.rect(cx - 74, cy + 20, 148, 12, warm ? '#3a2a1c' : '#202820');
  p.hline(cx - 70, cy + 20, 140, warm ? '#5a4030' : '#2e3a30');
  if (!warm) {
    // Holes in the back wall, leaking green.
    for (const hx of [cx - 40, cx + 22]) {
      p.ellipse(hx, cy - 18, 5, 4, '#0a120a');
      p.ellipse(hx, cy - 18, 3, 2, '#4a8a3a');
      p.hline(hx - 6, cy - 19, 12, '#6a4a2c');
    }
  }
}

export interface TitleArt {
  canvas: HTMLCanvasElement;
  bells: [number, number][];
  chute: { x: number; top: number; bottom: number };
  goblin: { x: number; y: number };
  pot: { x: number; y: number };
  lantern: { x: number; y: number };
}

let titleCache: TitleArt | null = null;

/** The title screen: Bellmarket at dusk above, the dungeon below, and one lit alcove. */
export function titleArt(): TitleArt {
  if (titleCache) return titleCache;
  const W = 480;
  let bells: [number, number][] = [];
  const cx = 300;
  const cy = 270;
  const canvas = art('backdrop:title', W, TITLE_H, (p) => {
    bands(p, 0, 0, W, GROUND_Y - 20, DUSK);
    stars(p, W, 60);
    p.ellipse(84, 30, 11, 11, '#f0e8c8');
    p.ellipse(88, 28, 9, 9, '#e0d4b0');
    p.px(80, 27, '#c8bc98');
    p.px(83, 33, '#c8bc98');
    // A far, hazy row of roofs, then the near skyline.
    skyline(p, GROUND_Y - 6, W, '#2a2034', '#7a5040');
    bells = skyline(p, GROUND_Y, W);
    cobbles(p, GROUND_Y, W);
    earth(p, GROUND_Y + 8, TITLE_H, W);
    pipe(p, 0, W, GROUND_Y + 22);
    pipe(p, 0, 200, GROUND_Y + 40, true);
    pipe(p, 380, W, GROUND_Y + 56);
    // The rubbish chute from a street grate down to the Galleries.
    p.rect(146, GROUND_Y - 1, 14, 3, '#5a5e64');
    for (let x = 147; x < 159; x += 3) p.vline(x, GROUND_Y - 1, 3, '#2a2c30');
    p.rect(148, GROUND_Y + 8, 10, 120, '#0a0806');
    p.vline(147, GROUND_Y + 8, 120, '#3a3430');
    p.vline(158, GROUND_Y + 8, 120, '#3a3430');
    p.ball(153, GROUND_Y + 132, 26, 9, '#4e463c', '#665c4c', '#38322b');
    p.speckle(130, GROUND_Y + 124, 46, 12, '#8a9096', 30);
    p.speckle(130, GROUND_Y + 124, 46, 12, '#9a5a30', 20);
    // Tunnels glowing green at the edges: the dungeon proper.
    for (const [tx, ty] of [[24, 230], [446, 300], [60, 316]] as const) {
      p.ellipse(tx, ty, 22, 14, '#0a0c0a');
      p.softEllipse(tx, ty, 18, 11, '#1e3a22');
      p.softEllipse(tx, ty + 2, 10, 6, '#2e5a32');
    }
    alcove(p, cx, cy, true);
  });
  // Props are painted onto the backdrop afterwards, so they sit in the alcove.
  const g = canvas.getContext('2d')!;
  drawProp(g, 'bed', 'mattress', cx - 62, cy + 22);
  drawProp(g, 'sign', 'definitely', cx + 42, cy + 2);
  drawProp(g, 'storage', 'full', cx + 52, cy + 24);
  drawProp(g, 'pot', '', cx - 10, cy + 24);
  drawProp(g, 'lantern', '', cx + 18, cy + 22);
  titleCache = {
    canvas,
    bells,
    chute: { x: 153, top: GROUND_Y + 8, bottom: GROUND_Y + 124 },
    goblin: { x: cx - 26, y: cy + 24 },
    pot: { x: cx - 10, y: cy + 10 },
    lantern: { x: cx + 18, y: cy - 2 },
  };
  return titleCache;
}

// ---------------------------------------------------------------- intro panels

export interface PanelInfo {
  canvas: HTMLCanvasElement;
  /** Points of interest for the animation layer. */
  marks: Record<string, [number, number]>;
}

const panels = new Map<PanelArt, PanelInfo>();

export function panelArt(id: PanelArt): PanelInfo {
  const cached = panels.get(id);
  if (cached) return cached;
  const W = 480;
  const H = 270;
  const marks: Record<string, [number, number]> = {};
  const canvas = art(`backdrop:intro:${id}`, W, H, (p) => {
    switch (id) {
      case 'city': {
        bands(p, 0, 0, W, 190, DUSK);
        stars(p, W, 90);
        p.ellipse(380, 46, 16, 16, '#f0e8c8');
        p.ellipse(385, 43, 13, 13, '#e0d4b0');
        skyline(p, 186, W, '#2a2034', '#7a5040');
        const bells = skyline(p, 200, W);
        bells.forEach((b, i) => (marks[`bell${i}`] = b));
        cobbles(p, 200, W);
        p.rect(0, 208, W, H - 208, '#1a1614');
        break;
      }
      case 'chute': {
        p.rect(0, 0, W, H, '#100c0a');
        bands(p, 0, 0, W, 40, ['#2a2236', '#4a3040', '#7a4440']);
        skyline(p, 40, W, '#17141f', '#c08040');
        cobbles(p, 40, W);
        earth(p, 48, H, W);
        p.rect(222, 38, 36, 4, '#5a5e64');
        for (let x = 224; x < 256; x += 4) p.vline(x, 38, 4, '#2a2c30');
        p.rect(226, 48, 28, 222, '#060404');
        p.vline(225, 48, 222, '#3a3430');
        p.vline(254, 48, 222, '#3a3430');
        pipe(p, 0, 226, 80);
        pipe(p, 254, W, 110, true);
        p.softEllipse(240, 268, 70, 30, '#1e3a22');
        p.softEllipse(240, 268, 36, 16, '#2e5a32');
        marks.chute = [240, 50];
        break;
      }
      case 'heroes': {
        p.rect(0, 0, W, H, '#14110e');
        // A long corridor: brick wall above, flagstones below.
        for (let y = 20; y < 140; y += 8) {
          for (let x = -((y / 8) % 2) * 8; x < W; x += 16) {
            p.rect(x + 1, y + 1, 15, 7, p.rng() < 0.5 ? '#3a3630' : '#34302a');
          }
        }
        p.rect(0, 140, W, 4, '#24201c');
        for (let y = 144; y < H; y += 10) {
          for (let x = -((y / 10) % 2) * 10; x < W; x += 20) p.rect(x + 1, y + 1, 19, 9, p.rng() < 0.5 ? '#2e2a26' : '#2a2622');
        }
        p.ball(90, 236, 70, 26, '#4e463c', '#665c4c', '#38322b');
        p.speckle(30, 220, 120, 30, '#8a9096', 50);
        p.speckle(30, 220, 120, 30, '#9a5a30', 30);
        marks.eyes = [96, 224];
        marks.party = [300, 160];
        break;
      }
      case 'alcove': {
        earth(p, 0, H, W);
        pipe(p, 0, W, 30);
        alcove(p, 240, 160, false);
        marks.goblin = [214, 188];
        break;
      }
      case 'notice': {
        p.rect(0, 0, W, H, '#5a3e28');
        for (let y = 0; y < H; y += 6) p.hline(0, y, W, '#4a3220');
        p.rect(60, 18, 360, 200, '#a87848');
        p.speckle(60, 18, 360, 200, '#8a5e34', 600);
        break;
      }
      case 'charter': {
        p.rect(0, 0, W, H, '#2a1c14');
        p.rect(0, 150, W, 120, '#5a3820');
        p.hline(0, 150, W, '#9a6a3a');
        for (let y = 154; y < H; y += 7) p.hline(0, y, W, '#4e3018');
        p.softEllipse(240, 120, 200, 90, '#3a2818');
        p.softEllipse(240, 120, 120, 60, '#4a3220');
        marks.doc = [240, 120];
        break;
      }
    }
  });
  const info = { canvas, marks };
  panels.set(id, info);
  return info;
}
