// Pack downloaded art into the sheets the game loads.
//   node scripts/art/pack.ts
//
// Reads art/sheets.json and the frames under art/raw/, then writes:
//   src/assets/art/<sheet>.png      one row per clip, one column per frame, every cell the same size
//   src/assets/art/tiles_<name>.png  a tileset, with its wall tops recolored if asked
//   src/assets/art/props.png         every prop in every state, packed onto one image
//   src/assets/art/portraits.png     the dialogue busts in a row
//   src/assets/art/icons.png         item and decoration icons, 16x16, in a row
//   src/assets/art/backdrop_<id>.png the title and intro paintings
//   src/render/art/sheets.gen.ts     cell sizes, anchors, clips, tile corners, and prop boxes for the renderer
//
// Frames of different canvas sizes are aligned on their centers (PixelLab centers characters on
// bigger animation canvases), cropped to the box every frame of the sheet fits in, and anchored at
// the feet of the anchor frame: the bottom of its opaque pixels, centered on the bottom rows.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blit, createImage, decodePng, encodePng, opaqueBounds, type Image } from './png.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const RAW = join(ROOT, 'art', 'raw');
const OUT = join(ROOT, 'src', 'assets', 'art');
const GEN = join(ROOT, 'src', 'render', 'art', 'sheets.gen.ts');

interface SheetSpec {
  /** Folder under art/raw/. */
  src: string;
  /** Clip name -> a folder of frames (sorted by name) or one PNG, relative to src, without '.png'. */
  clips: Record<string, string | string[]>;
  /** The frame whose feet set the anchor. Defaults to the first clip's first frame. */
  anchorFrom?: string;
  /** Explicit anchor in cell pixels, or 'center' for creatures drawn around their middle. */
  anchor?: [number, number] | 'center';
  /** Transparent margin around the cropped box. */
  pad?: number;
}

interface TilesetSpec {
  src: string;
  /**
   * The standard generator leaves the low ground of a raised (cliff) set as a flat red placeholder.
   * 'clear' makes it transparent, so a floor layer drawn underneath shows through, and turns its
   * darker red rim into a soft shadow at the foot of the walls. A list of colors recolors it
   * instead: the rim becomes the first, and the fill is speckled from the rest in 2px clusters.
   */
  fill?: 'clear' | string[];
  /** Multiply every pixel's red, green, and blue, to sit a set into its region's palette. */
  tint?: [number, number, number];
  /** Pull colors toward grey before tinting, 0 (none) to 1 (fully grey). */
  desaturate?: number;
}

interface PropSpec {
  /** Variant ('' is the prop's usual state) -> one PNG under art/raw/, without '.png'. */
  variants: Record<string, string>;
  /** Anchor in the cropped box. Left out, the game keeps the hand-drawn prop's proportions. */
  anchor?: [number, number];
  /** Where code draws into the prop (a sign's lettering, the hatch window), as x, y, w, h in box pixels. */
  board?: [number, number, number, number];
}

interface PortraitSpec {
  /** One 40x40 PNG under art/raw/, without '.png'. */
  src: string;
  mouth: [number, number, number];
  eyes: [number, number, number, number][];
  /** Lid color for blinks. Left out, it's the pixel just above the first eye. */
  lid?: string;
}

interface BackdropSpec {
  /** One PNG under art/raw/, or several of the same width stacked top to bottom, without '.png'. */
  src: string | string[];
  /** Crop to this height, evenly from the top and bottom. */
  h?: number;
  ox?: number;
  rest?: number;
  ambient?: string;
  /** Points [x, y] and boxes [x, y, w, h], in packed pixels. */
  marks: Record<string, number[]>;
}

interface Spec {
  sheets: Record<string, SheetSpec>;
  tilesets: Record<string, TilesetSpec>;
  props?: Record<string, PropSpec>;
  portraits?: Record<string, PortraitSpec>;
  /** Item or decoration id -> one 16x16 PNG under art/raw/, without '.png'. */
  icons?: Record<string, string>;
  /** Title and intro paintings, by backdrop id. */
  backdrops?: Record<string, BackdropSpec>;
}

const spec = JSON.parse(readFileSync(join(ROOT, 'art', 'sheets.json'), 'utf8')) as Spec;
mkdirSync(OUT, { recursive: true });

function framesOf(base: string, ref: string | string[]): string[] {
  if (Array.isArray(ref)) return ref.flatMap((r) => framesOf(base, r));
  const path = join(RAW, base, ref);
  if (existsSync(`${path}.png`)) return [`${path}.png`];
  if (existsSync(path) && statSync(path).isDirectory()) {
    return readdirSync(path)
      .filter((f) => f.endsWith('.png'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((f) => join(path, f));
  }
  throw new Error(`No frames at ${path}`);
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The anchor of one frame: the lowest opaque row, centered on the opaque pixels of its bottom three rows. */
function feet(img: Image): [number, number] {
  const b = opaqueBounds(img, 8);
  if (!b) return [img.width >> 1, img.height - 1];
  let sum = 0;
  let count = 0;
  for (let y = Math.max(b.y0, b.y1 - 2); y <= b.y1; y++) {
    for (let x = b.x0; x <= b.x1; x++) {
      if (img.data[(y * img.width + x) * 4 + 3]! > 8) {
        sum += x;
        count++;
      }
    }
  }
  return [Math.round(sum / count), b.y1];
}

const out: string[] = [];
out.push('// Generated by scripts/art/pack.ts from art/sheets.json. Do not edit by hand.');
out.push('');
out.push("import type { BackdropArtDef, PortraitArtDef, PropArtDef, SheetDef, TilesetDef } from './sheet-types';");
out.push('');
out.push('export const SHEETS = {');

for (const [name, s] of Object.entries(spec.sheets)) {
  const clips = Object.entries(s.clips).map(([clip, ref]) => ({ clip, files: framesOf(s.src, ref) }));
  const decoded = new Map<string, Image>();
  for (const c of clips) for (const f of c.files) if (!decoded.has(f)) decoded.set(f, decodePng(readFileSync(f)));
  const canvasW = Math.max(...[...decoded.values()].map((i) => i.width));
  const canvasH = Math.max(...[...decoded.values()].map((i) => i.height));
  // Center every frame on one shared canvas, then find the box all of them fit in.
  const offset = (img: Image): [number, number] => [(canvasW - img.width) >> 1, (canvasH - img.height) >> 1];
  let x0 = canvasW;
  let y0 = canvasH;
  let x1 = -1;
  let y1 = -1;
  for (const img of decoded.values()) {
    const b = opaqueBounds(img);
    if (!b) continue;
    const [ox, oy] = offset(img);
    x0 = Math.min(x0, b.x0 + ox);
    y0 = Math.min(y0, b.y0 + oy);
    x1 = Math.max(x1, b.x1 + ox);
    y1 = Math.max(y1, b.y1 + oy);
  }
  const pad = s.pad ?? 1;
  x0 -= pad;
  y0 -= pad;
  x1 += pad;
  y1 += pad;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const cols = Math.max(...clips.map((c) => c.files.length));
  const sheet = createImage(w * cols, h * clips.length);
  clips.forEach((c, row) => {
    c.files.forEach((f, col) => {
      const img = decoded.get(f)!;
      const [ox, oy] = offset(img);
      blit(img, 0, 0, img.width, img.height, sheet, col * w + ox - x0, row * h + oy - y0);
    });
  });
  let anchor = s.anchor === 'center' ? ([w >> 1, h >> 1] as [number, number]) : s.anchor;
  if (!anchor) {
    const from = s.anchorFrom ? framesOf(s.src, s.anchorFrom)[0]! : clips[0]!.files[0]!;
    const img = decoded.get(from) ?? decodePng(readFileSync(from));
    const [fx, fy] = feet(img);
    const [ox, oy] = offset(img);
    anchor = [fx + ox - x0, fy + oy - y0];
  }
  writeFileSync(join(OUT, `${name}.png`), encodePng(sheet));
  const clipList = clips.map((c, row) => `${c.clip}: { row: ${row}, frames: ${c.files.length} }`).join(', ');
  out.push(`  ${name}: { file: '${name}.png', w: ${w}, h: ${h}, ax: ${anchor[0]}, ay: ${anchor[1]}, clips: { ${clipList} } },`);
  console.log(`${name}: ${clips.length} clips, ${cols} columns, cell ${w}x${h}, anchor ${anchor.join(',')}`);
}
out.push('} as const satisfies Record<string, SheetDef>;');
out.push('');
out.push('export const TILESETS = {');

interface PackedTile {
  x: number;
  y: number;
  /** NW, NE, SW, SE: 0 lower, 1 upper, 2 transition (wall face). */
  corners: number[];
  pattern: number[];
}

/** Columns of corners (top, bottom) that the game's terrain can produce. A face always hangs from wall over floor. */
const COLUMNS: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2], [2, 0]];

/**
 * A raised set has 25 tiles, which leaves out corner patterns the maps still use, such as a wall's
 * bottom edge stepping down diagonally. Build each missing pattern from two half tiles: the left
 * half from a tile whose left column matches, the right half from one whose right column does,
 * preferring straight runs (both columns alike) so faces line up. Appends them to the image.
 */
function synthesizeSteps(img: Image, tiles: PackedTile[], size: number): Image {
  const has = (c: number[]) => tiles.some((t) => t.corners.every((v, k) => v === c[k]));
  const half = (top: number, bottom: number, side: 'left' | 'right'): PackedTile | undefined => {
    const match = (t: PackedTile) => (side === 'left' ? t.corners[0] === top && t.corners[2] === bottom : t.corners[1] === top && t.corners[3] === bottom);
    return tiles.find((t) => match(t) && t.corners[0] === t.corners[1] && t.corners[2] === t.corners[3]) ?? tiles.find(match);
  };
  const made: { corners: number[]; left: PackedTile; right: PackedTile }[] = [];
  for (const [nw, sw] of COLUMNS) {
    for (const [ne, se] of COLUMNS) {
      const corners = [nw, ne, sw, se];
      if (has(corners)) continue;
      const left = half(nw, sw, 'left');
      const right = half(ne, se, 'right');
      if (left && right) made.push({ corners, left, right });
    }
  }
  if (made.length === 0) return img;
  const perRow = Math.floor(img.width / size);
  const out = createImage(img.width, img.height + Math.ceil(made.length / perRow) * size);
  blit(img, 0, 0, img.width, img.height, out, 0, 0);
  made.forEach((m, n) => {
    const x = (n % perRow) * size;
    const y = img.height + Math.floor(n / perRow) * size;
    blit(img, m.left.x, m.left.y, size / 2, size, out, x, y);
    blit(img, m.right.x + size / 2, m.right.y, size / 2, size, out, x + size / 2, y);
    const pattern = Array<number>(16).fill(-1);
    [pattern[5], pattern[6], pattern[9], pattern[10]] = m.corners as [number, number, number, number];
    tiles.push({ x, y, corners: m.corners, pattern });
  });
  return out;
}

interface RawTile {
  corners: Record<'NW' | 'NE' | 'SW' | 'SE', 'lower' | 'upper' | 'transition'>;
  pattern_4x4: Record<'row_0' | 'row_1' | 'row_2' | 'row_3', number[]>;
  bounding_box: { x: number; y: number; width: number; height: number };
}

for (const [name, t] of Object.entries(spec.tilesets)) {
  const dir = join(RAW, t.src);
  const img = decodePng(readFileSync(join(dir, 'sheet.png')));
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as {
    tile_size: { width: number; height: number };
    tileset_data: { tiles: RawTile[] };
  };
  if (t.fill === 'clear') {
    for (let i = 0; i < img.data.length; i += 4) {
      const [r, g, b] = [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
      if (r < 60 || r < g * 1.6 || r < b * 1.6) continue;
      img.data.set(r < 95 ? [0, 0, 0, 120] : [0, 0, 0, 0], i);
    }
  } else if (t.fill) {
    const [rim, ...fill] = t.fill.map(hex);
    for (let i = 0; i < img.data.length; i += 4) {
      const [r, g, b] = [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
      if (r < 60 || r < g * 1.6 || r < b * 1.6) continue;
      if (r < 95 || fill.length === 0) {
        img.data.set(rim!, i);
        continue;
      }
      const px = (i / 4) % img.width;
      const py = Math.floor(i / 4 / img.width);
      // Tile-periodic noise, so neighboring tiles still meet seamlessly.
      const n = Math.abs(Math.sin(((px % 16) >> 1) * 12.9898 + ((py % 16) >> 1) * 78.233) * 43758.5453) % 1;
      img.data.set(fill[n < 0.6 ? 0 : n < 0.85 ? Math.min(1, fill.length - 1) : fill.length - 1]!, i);
    }
  }
  if (t.tint || t.desaturate) {
    const tint = t.tint ?? [1, 1, 1];
    const d = t.desaturate ?? 0;
    for (let i = 0; i < img.data.length; i += 4) {
      const grey = img.data[i]! * 0.3 + img.data[i + 1]! * 0.59 + img.data[i + 2]! * 0.11;
      for (let k = 0; k < 3; k++) img.data[i + k] = Math.min(255, Math.round((img.data[i + k]! * (1 - d) + grey * d) * tint[k]!));
    }
  }
  const code = { lower: 0, upper: 1, transition: 2 } as const;
  const size = meta.tile_size.width;
  const tiles: PackedTile[] = meta.tileset_data.tiles.map((tile) => {
    const b = tile.bounding_box;
    const p = tile.pattern_4x4;
    const c = tile.corners;
    return {
      x: b.x,
      y: b.y,
      corners: [code[c.NW], code[c.NE], code[c.SW], code[c.SE]],
      pattern: [...p.row_0, ...p.row_1, ...p.row_2, ...p.row_3].map((v) => (v === 255 ? -1 : v)),
    };
  });
  const sheetImg = tiles.some((t) => t.corners.includes(2)) ? synthesizeSteps(img, tiles, size) : img;
  writeFileSync(join(OUT, `tiles_${name}.png`), encodePng(sheetImg));
  out.push(`  ${name}: { file: 'tiles_${name}.png', size: ${size}, tiles: [`);
  for (const t of tiles) out.push(`    { x: ${t.x}, y: ${t.y}, corners: [${t.corners.join(', ')}], pattern: [${t.pattern.join(', ')}] },`);
  out.push('  ] },');
  console.log(`tileset ${name}: ${tiles.length} tiles`);
}
out.push('} as const satisfies Record<string, TilesetDef>;');
out.push('');

// Props: every variant of a prop is cropped to one shared box (canvases aligned on their centers),
// so a prop changes state without shifting, then the boxes are shelf-packed onto props.png.
const ATLAS_W = 256;
const props = Object.entries(spec.props ?? {}).map(([name, p]) => {
  const variants = Object.entries(p.variants).map(([variant, ref]) => {
    const img = decodePng(readFileSync(framesOf('', ref)[0]!));
    // Generated sprites can carry a faint alpha fringe; pixel art is opaque or not.
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i]! <= 8) img.data[i] = 0;
    return { variant, img };
  });
  const cw = Math.max(...variants.map((v) => v.img.width));
  const ch = Math.max(...variants.map((v) => v.img.height));
  const offset = (img: Image): [number, number] => [(cw - img.width) >> 1, (ch - img.height) >> 1];
  let [x0, y0, x1, y1] = [cw, ch, -1, -1];
  for (const { img } of variants) {
    const b = opaqueBounds(img);
    if (!b) throw new Error(`prop ${name}: an empty variant`);
    const [ox, oy] = offset(img);
    [x0, y0, x1, y1] = [Math.min(x0, b.x0 + ox), Math.min(y0, b.y0 + oy), Math.max(x1, b.x1 + ox), Math.max(y1, b.y1 + oy)];
  }
  return { name, spec: p, variants, offset, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
});
const cells = props.flatMap((prop) => prop.variants.map((v) => ({ prop, v, x: 0, y: 0 })));
cells.sort((a, b) => b.prop.h - a.prop.h || b.prop.w - a.prop.w);
let [shelfX, shelfY, shelfH] = [0, 0, 0];
for (const c of cells) {
  if (shelfX + c.prop.w > ATLAS_W) [shelfX, shelfY, shelfH] = [0, shelfY + shelfH, 0];
  [c.x, c.y] = [shelfX, shelfY];
  shelfX += c.prop.w;
  shelfH = Math.max(shelfH, c.prop.h);
}
out.push('export const PROP_ART = {');
if (cells.length > 0) {
  const atlas = createImage(ATLAS_W, shelfY + shelfH);
  for (const c of cells) {
    const [ox, oy] = c.prop.offset(c.v.img);
    blit(c.v.img, c.prop.x0 - ox, c.prop.y0 - oy, c.prop.w, c.prop.h, atlas, c.x, c.y);
  }
  writeFileSync(join(OUT, 'props.png'), encodePng(atlas));
  for (const prop of props) {
    const at = (v: string) => cells.find((c) => c.prop === prop && c.v.variant === v)!;
    const variants = prop.variants.map(({ variant }) => `'${variant}': [${at(variant).x}, ${at(variant).y}]`).join(', ');
    const extra = [
      prop.spec.anchor ? `, anchor: [${prop.spec.anchor.join(', ')}]` : '',
      prop.spec.board ? `, board: [${prop.spec.board.join(', ')}]` : '',
    ].join('');
    out.push(`  ${prop.name}: { w: ${prop.w}, h: ${prop.h}, variants: { ${variants} }${extra} },`);
  }
  console.log(`props: ${props.length} props, ${cells.length} variants, atlas ${ATLAS_W}x${shelfY + shelfH}`);
}
out.push('} as const satisfies Record<string, PropArtDef>;');
out.push('');

// Portraits: one row of 40x40 busts. Talking and blinking are drawn over them by code.
const PORTRAIT = 40;
const portraits = Object.entries(spec.portraits ?? {});
out.push('export const PORTRAIT_ART = {');
if (portraits.length > 0) {
  const strip = createImage(PORTRAIT * portraits.length, PORTRAIT);
  portraits.forEach(([name, p], i) => {
    const img = decodePng(readFileSync(framesOf('', p.src)[0]!));
    if (img.width !== PORTRAIT || img.height !== PORTRAIT) throw new Error(`portrait ${name}: ${img.width}x${img.height}, not ${PORTRAIT}`);
    blit(img, 0, 0, PORTRAIT, PORTRAIT, strip, i * PORTRAIT, 0);
    const [ex, ey] = p.eyes[0]!;
    const at = ((ey - 1) * PORTRAIT + ex) * 4;
    const lid = p.lid ?? `#${[0, 1, 2].map((k) => img.data[at + k]!.toString(16).padStart(2, '0')).join('')}`;
    const eyes = p.eyes.map((e) => `[${e.join(', ')}]`).join(', ');
    out.push(`  ${name}: { x: ${i * PORTRAIT}, mouth: [${p.mouth.join(', ')}], eyes: [${eyes}], lid: '${lid}' },`);
  });
  writeFileSync(join(OUT, 'portraits.png'), encodePng(strip));
  console.log(`portraits: ${portraits.length}`);
}
out.push('} as const satisfies Record<string, PortraitArtDef>;');
out.push('');

// Icons: one row of 16x16 cells, by item or decoration id.
const ICON = 16;
const icons = Object.entries(spec.icons ?? {});
out.push('/** Column of each icon on icons.png (16x16 cells). */');
out.push('export const ICON_ART = {');
if (icons.length > 0) {
  const strip = createImage(ICON * icons.length, ICON);
  icons.forEach(([id, ref], i) => {
    const img = decodePng(readFileSync(framesOf('', ref)[0]!));
    if (img.width !== ICON || img.height !== ICON) throw new Error(`icon ${id}: ${img.width}x${img.height}, not ${ICON}`);
    for (let k = 3; k < img.data.length; k += 4) if (img.data[k]! <= 8) img.data[k] = 0;
    blit(img, 0, 0, ICON, ICON, strip, i * ICON, 0);
    out.push(`  ${id}: ${i},`);
  });
  writeFileSync(join(OUT, 'icons.png'), encodePng(strip));
  console.log(`icons: ${icons.length}`);
}
out.push('} as const satisfies Record<string, number>;');
out.push('');

// Backdrops: one image each, its parts stacked top to bottom, with the marks the animation layer uses.
const backdrops = Object.entries(spec.backdrops ?? {});
out.push('export const BACKDROP_ART = {');
for (const [id, b] of backdrops) {
  const parts = (Array.isArray(b.src) ? b.src : [b.src]).map((ref) => decodePng(readFileSync(framesOf('', ref)[0]!)));
  const w = parts[0]!.width;
  if (parts.some((p) => p.width !== w)) throw new Error(`backdrop ${id}: its parts differ in width`);
  const full = parts.reduce((sum, p) => sum + p.height, 0);
  const h = b.h ?? full;
  const img = createImage(w, h);
  let y = -Math.floor((full - h) / 2);
  for (const p of parts) {
    blit(p, 0, 0, w, p.height, img, 0, y);
    y += p.height;
  }
  const file = `backdrop_${id}.png`;
  writeFileSync(join(OUT, file), encodePng(img));
  const extra = [
    b.ox !== undefined ? `, ox: ${b.ox}` : '',
    b.rest !== undefined ? `, rest: ${b.rest}` : '',
    b.ambient ? `, ambient: '${b.ambient}'` : '',
  ].join('');
  const marks = Object.entries(b.marks).map(([k, v]) => `${k}: [${v.join(', ')}]`).join(', ');
  out.push(`  ${id}: { file: '${file}', w: ${w}, h: ${h}${extra}, marks: { ${marks} } },`);
}
if (backdrops.length > 0) console.log(`backdrops: ${backdrops.length}`);
out.push('} as const satisfies Record<string, BackdropArtDef>;');
out.push('');
out.push('export type SheetId = keyof typeof SHEETS;');
out.push('export type TilesetId = keyof typeof TILESETS;');
writeFileSync(GEN, `${out.join('\n')}\n`);
console.log(`wrote ${GEN}`);
