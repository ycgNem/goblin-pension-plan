/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BACKDROP_MARKS, TITLE_H, TITLE_W } from '../src/app/backdrops';
import { BASE_H, BASE_W } from '../src/core/screen';
import { REGIONS, REGION_IDS } from '../src/data/regions';
import { ITEM_IDS } from '../src/data/items';
import { SPEAKERS } from '../src/data/story';
import { DECOR_ICONS, ICON } from '../src/render/art/icons';
import { PORTRAIT_SIZE } from '../src/render/art/portraits';
import { hasProp } from '../src/render/art/props';
import { REGION_TERRAIN } from '../src/render/art/regions';
import type { BackdropArtDef, PortraitArtDef, PropArtDef, SheetDef, TilesetDef } from '../src/render/art/sheet-types';
import { BACKDROP_ART, ICON_ART, PORTRAIT_ART, PROP_ART, SHEETS, TILESETS } from '../src/render/art/sheets.gen';
import { neighborhood, patchCodes, pickTile, terrainCodes, waterCodes } from '../src/render/terrain';
import { TileMap } from '../src/world/tilemap';

// The packed art: every sheet and tileset is on disk at the size its metadata says, every clip the
// renderer asks for exists, and every map's walls resolve to a real tile on the dual grid.

/** Width and height from a packed PNG's IHDR chunk, or null if the file is missing. */
function pngSize(file: string): { width: number; height: number } | null {
  const path = new URL(`../src/assets/art/${file}`, import.meta.url);
  if (!existsSync(path)) return null;
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const sheets = Object.entries(SHEETS) as [string, SheetDef][];
const tilesets = Object.entries(TILESETS) as [string, TilesetDef][];

describe('art sheets', () => {
  it('every sheet image exists at the size of its cells', () => {
    for (const [name, s] of sheets) {
      const clips = Object.values(s.clips);
      const cols = Math.max(...clips.map((c) => c.frames));
      expect(pngSize(s.file), name).toEqual({ width: s.w * cols, height: s.h * clips.length });
      expect(s.ax >= 0 && s.ax < s.w && s.ay >= 0 && s.ay < s.h, `${name} anchor`).toBe(true);
    }
  });

  it('the goblin has every clip the renderer asks for', () => {
    const want = ['idle', 'walk', 'sneak', 'roll'].flatMap((a) => ['s', 'n', 'e'].map((d) => `${a}_${d}`));
    for (const clip of [...want, 'ko']) expect(clip in SHEETS.goblin.clips, clip).toBe(true);
  });

  it('every tileset image exists and holds its tiles', () => {
    for (const [name, t] of tilesets) {
      const size = pngSize(t.file);
      expect(size, name).not.toBeNull();
      for (const tile of t.tiles) expect(tile.x + t.size <= size!.width && tile.y + t.size <= size!.height, name).toBe(true);
    }
  });

  it('every generated prop is a real prop, with each state inside props.png', () => {
    const props = Object.entries(PROP_ART) as [string, PropArtDef][];
    if (props.length === 0) return;
    const size = pngSize('props.png');
    expect(size).not.toBeNull();
    for (const [id, p] of props) {
      expect(hasProp(id), id).toBe(true);
      expect('' in p.variants, `${id} has its usual state`).toBe(true);
      for (const [v, [x, y]] of Object.entries(p.variants)) expect(x + p.w <= size!.width && y + p.h <= size!.height, `${id}:${v}`).toBe(true);
      if (p.anchor) expect(p.anchor[0] < p.w && p.anchor[1] < p.h, `${id} anchor`).toBe(true);
      if (p.board) expect(p.board[0] + p.board[2] <= p.w && p.board[1] + p.board[3] <= p.h, `${id} board`).toBe(true);
    }
  });

  it('every item has a generated icon, and every icon is an item or a decoration', () => {
    const icons = Object.keys(ICON_ART);
    if (icons.length === 0) return;
    expect(pngSize('icons.png')).toEqual({ width: ICON * icons.length, height: ICON });
    for (const id of ITEM_IDS) expect(id in ICON_ART, id).toBe(true);
    for (const id of icons) expect((ITEM_IDS as readonly string[]).includes(id) || DECOR_ICONS[id] !== undefined, id).toBe(true);
  });

  it('every generated portrait is a speaker, with its mouth and eyes inside the bust', () => {
    const portraits = Object.entries(PORTRAIT_ART) as [string, PortraitArtDef][];
    if (portraits.length === 0) return;
    expect(pngSize('portraits.png')).toEqual({ width: PORTRAIT_SIZE * portraits.length, height: PORTRAIT_SIZE });
    const inside = (x: number, y: number, w: number, h: number) => x >= 0 && y >= 0 && x + w <= PORTRAIT_SIZE && y + h <= PORTRAIT_SIZE;
    for (const [id, p] of portraits) {
      expect(Object.values(SPEAKERS).some((s) => s.portrait === id), id).toBe(true);
      expect(inside(p.mouth[0], p.mouth[1], p.mouth[2], 2), `${id} mouth`).toBe(true);
      for (const [x, y, w, h] of p.eyes) expect(inside(x, y, w, h), `${id} eye`).toBe(true);
    }
  });

  it('every painted backdrop is the title or a panel at its size, with the marks its animation needs inside it', () => {
    for (const [id, b] of Object.entries(BACKDROP_ART) as [string, BackdropArtDef][]) {
      expect(id in BACKDROP_MARKS, id).toBe(true);
      expect(pngSize(b.file), id).toEqual({ width: b.w, height: b.h });
      expect([b.w, b.h], id).toEqual(id === 'title' ? [TITLE_W, TITLE_H] : [BASE_W, BASE_H]);
      for (const key of BACKDROP_MARKS[id as keyof typeof BACKDROP_MARKS]) expect(key in b.marks, `${id} needs ${key}`).toBe(true);
      for (const [key, [x = -1, y = -1, w = 0, h = 0]] of Object.entries(b.marks)) {
        expect(x >= 0 && x < b.w && y >= 0 && y < b.h, `${id} ${key}`).toBe(true);
        // A bell swings over the column just left of it, so that column has to be in the painting too.
        if (key.startsWith('bell')) expect(x >= 1 && x + w <= b.w && y + h <= b.h, `${id} ${key} box`).toBe(true);
      }
    }
  });
});

describe('generated terrain', () => {
  it('names real tilesets', () => {
    for (const [id, t] of Object.entries(REGION_TERRAIN)) {
      expect(t!.floor in TILESETS, `${id} floor`).toBe(true);
      expect(t!.walls in TILESETS, `${id} walls`).toBe(true);
    }
  });

  it('every display tile of every map finds an exact tile', () => {
    for (const id of REGION_IDS) {
      const t = REGION_TERRAIN[id];
      if (!t) continue;
      const map = new TileMap(REGIONS[id].map);
      const layers: [string, TilesetDef, Int8Array][] = [
        ['walls', TILESETS[t.walls], terrainCodes(map)],
        ['floor', TILESETS[t.floor], patchCodes(map, t.patches, t.invert)],
      ];
      if (t.water) layers.push(['water', TILESETS[t.water], waterCodes(map)]);
      for (const [layer, set, codes] of layers) {
        const misses: string[] = [];
        for (let j = -1; j < map.rows; j++) {
          for (let i = -1; i < map.cols; i++) {
            const hood = neighborhood(codes, map.cols, map.rows, i, j);
            if (!pickTile(set, hood).exact) misses.push(`(${i},${j}) ${hood.join('')}`);
          }
        }
        expect(misses, `${id} ${layer}`).toEqual([]);
      }
    }
  });
});
