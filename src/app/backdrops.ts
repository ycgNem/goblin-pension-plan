import type { PanelArt } from '../data/story';
import { artImage } from '../render/art/assets';
import { drawProp } from '../render/art/props';
import type { BackdropArtDef } from '../render/art/sheet-types';
import { BACKDROP_ART } from '../render/art/sheets.gen';
import { art, type Painter } from '../render/paint';

// Backdrops for the title screen and the story intro: generated paintings when they're loaded,
// painted in code otherwise. Static layers are made once; title.ts and intro.ts animate on top
// (falling rubbish, bells, torches, steam) at the marks each backdrop gives.

/** The title backdrop is wider and taller than the base view, so it fills any window shape. */
export const TITLE_W = 640;
export const TITLE_H = 380;
/** Where the code backdrop's 480-wide composition starts inside the wide title backdrop. */
export const TITLE_OX = (TITLE_W - 480) / 2;
/** The camera's pan ends with this backdrop row at the bottom of the screen. */
export const TITLE_REST_BOTTOM = 340;
export const GROUND_Y = 132;

type Marks = Readonly<Record<string, readonly number[]>>;

/** Marks every painting has to give, by backdrop: the animation layer draws at them. */
export const BACKDROP_MARKS = {
  title: ['moon', 'chute', 'light', 'goblin', 'pot'],
  city: ['moon'],
  chute: ['chute', 'sky', 'glow'],
  heroes: ['eyes', 'party'],
  alcove: ['goblin', 'hole0', 'hole1'],
  notice: [],
  charter: [],
} as const satisfies Record<'title' | PanelArt, readonly string[]>;

/** A bell the animation layer swings. A painted one carries its empty belfry, to draw behind it. */
export interface Bell {
  x: number;
  y: number;
  w: number;
  h: number;
  patch?: HTMLCanvasElement;
}

/** Rock the bells: painted ones a pixel either way over their empty belfry, code ones as small gold bells. */
export function drawBells(ctx: CanvasRenderingContext2D, src: CanvasImageSource, bells: readonly Bell[], t: number, dx: number, dy: number): void {
  bells.forEach((b, i) => {
    const phase = Math.sin(t * 1.9 + i * 1.3);
    if (b.patch) {
      ctx.drawImage(b.patch, b.x + dx, b.y + dy);
      ctx.drawImage(src, b.x, b.y, b.w, b.h, b.x + dx + Math.round(phase), b.y + dy, b.w, b.h);
      return;
    }
    const swing = Math.round(phase * 2);
    ctx.fillStyle = '#c8a040';
    ctx.fillRect(b.x + dx - 2 + swing, b.y + dy, 5, 4);
    ctx.fillStyle = '#8a6a20';
    ctx.fillRect(b.x + dx - 3 + swing, b.y + dy + 4, 7, 1);
  });
}

/** A generated backdrop drawn onto a canvas (props go on top of it), or null if it isn't loaded. */
function painting(id: string): { canvas: HTMLCanvasElement; def: BackdropArtDef } | null {
  const def = (BACKDROP_ART as Partial<Record<string, BackdropArtDef>>)[id];
  const img = def && artImage(def.file);
  if (!def || !img) return null;
  const canvas = document.createElement('canvas');
  canvas.width = def.w;
  canvas.height = def.h;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return { canvas, def };
}

/** A painting's bells (marks bell0, bell1...), each with the column beside it stretched across as its empty belfry. */
function paintedBells(canvas: HTMLCanvasElement, marks: Marks): Bell[] {
  return Object.entries(marks)
    .filter(([k]) => /^bell\d+$/.test(k))
    .map(([, [x = 0, y = 0, w = 1, h = 1]]) => {
      const patch = document.createElement('canvas');
      patch.width = w;
      patch.height = h;
      const g = patch.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      g.drawImage(canvas, x - 1, y, 1, h, 0, 0, w, h);
      return { x, y, w, h, patch };
    });
}

const point = (m: readonly number[] | undefined): { x: number; y: number } => ({ x: m?.[0] ?? 0, y: m?.[1] ?? 0 });

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
function skyline(p: Painter, baseY: number, w: number, dark = '#17141f', lit = '#f0b050', ox = 0): [number, number][] {
  const bells: [number, number][] = [];
  let x = -6;
  while (x < w) {
    const bw = 14 + Math.floor(p.rng() * 26);
    const tower = bells.length < 3 && (x > ox + 70 + bells.length * 140 && x < ox + 110 + bells.length * 140);
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
  /** Where the 480-wide stage starts in the backdrop, and the row the camera's pan ends on. */
  ox: number;
  rest: number;
  /** The light map's darkness. */
  ambient: string;
  bells: Bell[];
  /** Rubbish falls down the chute between top and bottom, spread across its width. */
  chute: { x: number; top: number; bottom: number; w: number };
  goblin: { x: number; y: number };
  /** Where the steam leaves the pot. */
  pot: { x: number; y: number };
  lantern: { x: number; y: number };
  moon: { x: number; y: number };
}

/** Props set into the painted alcove, each at the mark of its own name. */
const TITLE_PROPS = [['bed', 'mattress'], ['sign', 'definitely'], ['storage', 'full'], ['pot', '']] as const;
/** Steam leaves the pot this far above its feet. */
const STEAM_UP = 14;

let titleCache: TitleArt | null = null;

/** The title screen: Bellmarket at dusk above, the dungeon below, and one lit alcove. */
export function titleArt(): TitleArt {
  titleCache ??= paintedTitle() ?? codeTitle();
  return titleCache;
}

function paintedTitle(): TitleArt | null {
  const p = painting('title');
  if (!p) return null;
  const m = p.def.marks;
  const bells = paintedBells(p.canvas, m);
  const g = p.canvas.getContext('2d')!;
  for (const [id, variant] of TITLE_PROPS) {
    const at = m[id];
    if (at) drawProp(g, id, variant, at[0] ?? 0, at[1] ?? 0);
  }
  const [x = 0, top = 0, bottom = 0, w = 6] = m.chute ?? [];
  const pot = point(m.pot);
  return {
    canvas: p.canvas,
    ox: p.def.ox ?? TITLE_OX,
    rest: p.def.rest ?? p.def.h,
    ambient: p.def.ambient ?? '#3c3848',
    bells,
    chute: { x, top, bottom, w },
    goblin: point(m.goblin),
    pot: { x: pot.x, y: pot.y - STEAM_UP },
    lantern: point(m.light),
    moon: point(m.moon),
  };
}

function codeTitle(): TitleArt {
  const W = TITLE_W;
  const ox = TITLE_OX;
  let bells: [number, number][] = [];
  const cx = ox + 300;
  const cy = 270;
  const canvas = art('backdrop:title', W, TITLE_H, (p) => {
    bands(p, 0, 0, W, GROUND_Y - 20, DUSK);
    stars(p, W, 60);
    p.ellipse(ox + 84, 30, 11, 11, '#f0e8c8');
    p.ellipse(ox + 88, 28, 9, 9, '#e0d4b0');
    p.px(ox + 80, 27, '#c8bc98');
    p.px(ox + 83, 33, '#c8bc98');
    // A far, hazy row of roofs, then the near skyline.
    skyline(p, GROUND_Y - 6, W, '#2a2034', '#7a5040');
    bells = skyline(p, GROUND_Y, W, undefined, undefined, ox);
    cobbles(p, GROUND_Y, W);
    earth(p, GROUND_Y + 8, TITLE_H, W);
    pipe(p, 0, W, GROUND_Y + 22);
    pipe(p, 0, ox + 200, GROUND_Y + 40, true);
    pipe(p, ox + 380, W, GROUND_Y + 56);
    // The rubbish chute from a street grate down to the Galleries.
    const ch = ox + 146;
    p.rect(ch, GROUND_Y - 1, 14, 3, '#5a5e64');
    for (let x = ch + 1; x < ch + 13; x += 3) p.vline(x, GROUND_Y - 1, 3, '#2a2c30');
    p.rect(ch + 2, GROUND_Y + 8, 10, 120, '#0a0806');
    p.vline(ch + 1, GROUND_Y + 8, 120, '#3a3430');
    p.vline(ch + 12, GROUND_Y + 8, 120, '#3a3430');
    p.ball(ch + 7, GROUND_Y + 132, 26, 9, '#4e463c', '#665c4c', '#38322b');
    p.speckle(ch - 16, GROUND_Y + 124, 46, 12, '#8a9096', 30);
    p.speckle(ch - 16, GROUND_Y + 124, 46, 12, '#9a5a30', 20);
    // Tunnels glowing green at the edges: the dungeon proper.
    for (const [tx, ty] of [[24, 230], [446, 300], [60, 316], [-50, 270], [540, 236], [500, 352]] as const) {
      p.ellipse(ox + tx, ty, 22, 14, '#0a0c0a');
      p.softEllipse(ox + tx, ty, 18, 11, '#1e3a22');
      p.softEllipse(ox + tx, ty + 2, 10, 6, '#2e5a32');
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
  return {
    canvas,
    ox,
    rest: TITLE_REST_BOTTOM,
    ambient: '#3c3848',
    bells: bells.map(([x, y]) => ({ x, y, w: 0, h: 0 })),
    chute: { x: ox + 153, top: GROUND_Y + 8, bottom: GROUND_Y + 124, w: 6 },
    goblin: { x: cx - 26, y: cy + 24 },
    pot: { x: cx - 10, y: cy + 24 - STEAM_UP },
    lantern: { x: cx + 18, y: cy - 2 },
    moon: { x: ox + 84, y: 30 },
  };
}

// ---------------------------------------------------------------- intro panels

export interface PanelInfo {
  canvas: HTMLCanvasElement;
  /** Points (x, y) and spans the animation layer uses; see BACKDROP_MARKS. */
  marks: Marks;
  bells: Bell[];
  /** A generated painting: it holds still, since zooming would smear its pixels. */
  painted: boolean;
  /** The light map's darkness. */
  ambient: string;
}

const panels = new Map<PanelArt, PanelInfo>();

export function panelArt(id: PanelArt): PanelInfo {
  let info = panels.get(id);
  if (!info) {
    info = paintedPanel(id) ?? codePanel(id);
    panels.set(id, info);
  }
  return info;
}

/** Notices and charters sit in warm lamplight; everywhere else is the cool dark of the dungeon. */
const codeAmbient = (id: PanelArt): string => (id === 'notice' || id === 'charter' ? '#5a4a40' : '#56506a');

function paintedPanel(id: PanelArt): PanelInfo | null {
  const p = painting(id);
  if (!p) return null;
  return { canvas: p.canvas, marks: p.def.marks, bells: paintedBells(p.canvas, p.def.marks), painted: true, ambient: p.def.ambient ?? codeAmbient(id) };
}

function codePanel(id: PanelArt): PanelInfo {
  const W = 480;
  const H = 270;
  const marks: Record<string, number[]> = {};
  let bells: [number, number][] = [];
  const canvas = art(`backdrop:intro:${id}`, W, H, (p) => {
    switch (id) {
      case 'city': {
        bands(p, 0, 0, W, 190, DUSK);
        stars(p, W, 90);
        p.ellipse(380, 46, 16, 16, '#f0e8c8');
        p.ellipse(385, 43, 13, 13, '#e0d4b0');
        skyline(p, 186, W, '#2a2034', '#7a5040');
        bells = skyline(p, 200, W);
        cobbles(p, 200, W);
        p.rect(0, 208, W, H - 208, '#1a1614');
        marks.moon = [380, 46];
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
        // x, top, bottom, width: rubbish falls the whole height of the panel.
        marks.chute = [240, 46, H, 20];
        marks.sky = [240, 40];
        marks.glow = [240, 268];
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
        // Where the party starts walking left from, at its feet.
        marks.party = [380, 188];
        break;
      }
      case 'alcove': {
        earth(p, 0, H, W);
        pipe(p, 0, W, 30);
        alcove(p, 240, 160, false);
        marks.goblin = [214, 188];
        // The holes in the back wall, and drips falling from x between two heights.
        marks.hole0 = [200, 142];
        marks.hole1 = [262, 142];
        for (let i = 0; i < 3; i++) marks[`drip${i}`] = [200 + i * 34, 132, 182];
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
  return { canvas, marks, bells: bells.map(([x, y]) => ({ x, y, w: 0, h: 0 })), painted: false, ambient: codeAmbient(id) };
}
