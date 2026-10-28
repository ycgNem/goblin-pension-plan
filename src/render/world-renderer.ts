import { hash2 } from '../core/math';
import { VIEW_H, VIEW_W } from '../core/screen';
import type { RegionId } from '../data/regions';
import type { TileMap } from '../world/tilemap';
import { TILE, type TileKind } from '../world/tiles';
import type { View } from './lighting';
import { PAL } from './palette';

export type { View } from './lighting';

export interface BakeOptions {
  region: RegionId;
  /** Burrow only: the holes have been patched (Board Patch). */
  holesPatched: boolean;
}

type FloorPattern = 'flags' | 'dirt' | 'wet' | 'plates' | 'planks';
type FacePattern = 'bricks' | 'rough' | 'blocks' | 'panels' | 'plaster';

interface RegionStyle {
  floor: readonly string[];
  grout: string;
  top: string;
  topHi: string;
  face: readonly string[];
  faceHi: string;
  faceLo: string;
  mortar: string;
  floorPattern: FloorPattern;
  facePattern: FacePattern;
  water: readonly [string, string, string];
}

const STYLES: Record<RegionId, RegionStyle> = {
  burrow: {
    floor: ['#4a3b2e', '#45372b', '#504032', '#3f3227'], grout: '#3a2d22',
    top: '#1f1b18', topHi: '#3c342c', face: ['#4d4238', '#544838', '#463c33'], faceHi: '#6a5a48', faceLo: '#352c25', mortar: '#2a221c',
    floorPattern: 'dirt', facePattern: 'rough', water: ['#1a2a26', '#24403a', '#3c6a5e'],
  },
  galleries: {
    floor: ['#3e423a', '#3a3e36', '#44483f', '#363931'], grout: '#2a2d27',
    top: '#1b1d1a', topHi: '#353830', face: ['#46473e', '#4c4c42', '#40413a'], faceHi: '#5e5f52', faceLo: '#33342e', mortar: '#25261f',
    floorPattern: 'flags', facePattern: 'bricks', water: ['#1e2a26', '#2a3c36', '#46645a'],
  },
  cistern: {
    floor: ['#2f3c36', '#2b3732', '#34423b', '#28332e'], grout: '#1f2924',
    top: '#151c19', topHi: '#2a3830', face: ['#34453c', '#38493f', '#2f3f37'], faceHi: '#4a5e50', faceLo: '#26332d', mortar: '#1b2520',
    floorPattern: 'wet', facePattern: 'blocks', water: ['#122a28', '#1c403c', '#3c7468'],
  },
  pumpworks: {
    floor: ['#3e3833', '#3a342f', '#433c36', '#36302b'], grout: '#2a2420',
    top: '#1c1917', topHi: '#3a332e', face: ['#4a3d34', '#503f34', '#44382f'], faceHi: '#62503f', faceLo: '#382e27', mortar: '#29211c',
    floorPattern: 'plates', facePattern: 'panels', water: ['#1e1e1a', '#2c2a24', '#4a463a'],
  },
  coop: {
    floor: ['#5c4232', '#553b2c', '#614636', '#4f3729'], grout: '#3a2a1e',
    top: '#231a14', topHi: '#4a3628', face: ['#7a5a42', '#80604a', '#74553f'], faceHi: '#94745a', faceLo: '#5a4232', mortar: '#3a281e',
    floorPattern: 'planks', facePattern: 'plaster', water: ['#1e2a26', '#2a3c36', '#46645a'],
  },
};

const SOCKS = ['#c04040', '#e0c050', '#40a0c0', '#e8e0d0', '#60b060', '#a060c0'];

function isWallish(kind: TileKind): boolean {
  return kind === 'wall' || kind === 'hole' || kind === 'void';
}

function pick<T>(list: readonly T[], n: number): T {
  return list[Math.min(list.length - 1, Math.floor(n * list.length))]!;
}

/**
 * Draws the world's terrain. Each region has its own floor, wall, and water style, with
 * contact shadows under walls. Terrain is baked once per region load; water and exit
 * markers animate on top. Rebake when something that changes how terrain looks changes.
 */
export class WorldRenderer {
  private readonly baked: HTMLCanvasElement = document.createElement('canvas');
  private style: RegionStyle = STYLES.burrow;
  private water: { col: number; row: number }[] = [];
  private exits: { x: number; y: number; dx: number; dy: number }[] = [];

  bake(map: TileMap, opts: BakeOptions): void {
    this.style = STYLES[opts.region];
    this.baked.width = map.widthPx;
    this.baked.height = map.heightPx;
    const ctx = this.baked.getContext('2d')!;
    ctx.clearRect(0, 0, map.widthPx, map.heightPx);
    this.water = [];
    this.exits = [];
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) this.drawTile(ctx, map, col, row, opts);
    }
    if (opts.region === 'coop') this.drawBunting(ctx, map);
    if (opts.region === 'burrow') drawBurrowDressing(ctx, map, opts.holesPatched);
  }

  drawTerrain(ctx: CanvasRenderingContext2D, view: View, time: number): void {
    ctx.fillStyle = PAL.void;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.drawImage(this.baked, -view.x, -view.y);

    // Water shimmer: a few bright pixels drifting across each visible tile.
    const [, , hi] = this.style.water;
    ctx.fillStyle = hi;
    for (const w of this.water) {
      const x = w.col * TILE - view.x;
      const y = w.row * TILE - view.y;
      if (x < -TILE || y < -TILE || x > VIEW_W || y > VIEW_H) continue;
      const n = hash2(w.col, w.row);
      for (let i = 0; i < 2; i++) {
        const px = (n * 97 + i * 7 + time * (5 + i * 3)) % 14;
        const py = 3 + ((n * 31 + i * 6) % 10);
        const a = 0.35 + 0.35 * Math.sin(time * 2 + n * 9 + i);
        ctx.globalAlpha = a;
        ctx.fillRect(Math.round(x + 1 + px), Math.round(y + py), 2, 1);
      }
    }
    ctx.globalAlpha = 1;

    // Exit markers: chevrons that pulse outward, pointing the way through.
    for (const e of this.exits) {
      const cx = e.x - view.x;
      const cy = e.y - view.y;
      if (cx < -TILE || cy < -TILE || cx > VIEW_W + TILE || cy > VIEW_H + TILE) continue;
      const t = (time * 1.6) % 1;
      for (let i = 0; i < 2; i++) {
        const k = (t + i * 0.5) % 1;
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.7;
        chevron(ctx, cx + e.dx * (k * 8 - 4), cy + e.dy * (k * 8 - 4), e.dx, e.dy, '#f4e8c0');
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawTile(ctx: CanvasRenderingContext2D, map: TileMap, col: number, row: number, opts: BakeOptions): void {
    const kind = map.kindAt(col, row);
    const x = col * TILE;
    const y = row * TILE;
    const n = hash2(col, row);

    switch (kind) {
      case 'void':
        ctx.fillStyle = PAL.void;
        ctx.fillRect(x, y, TILE, TILE);
        return;
      case 'wall':
      case 'hole':
        this.drawWall(ctx, map, col, row, n);
        if (kind === 'hole') drawHole(ctx, x, y, opts.holesPatched, n);
        return;
      case 'sludge':
        this.drawWater(ctx, map, col, row);
        return;
      case 'crawl':
        drawPipe(ctx, map, col, row);
        return;
      case 'prop':
        // Under a landmark. Statues stand in water when the water reaches them.
        if (['sludge', 'prop'].includes(map.kindAt(col - 1, row)) && ['sludge', 'prop'].includes(map.kindAt(col + 1, row))) {
          this.drawWater(ctx, map, col, row);
          return;
        }
        break;
      case 'exit':
        this.drawExit(ctx, map, col, row);
        return;
      default:
        break;
    }

    this.drawFloor(ctx, x, y, col, row, n);
    if (kind === 'moss') drawMoss(ctx, x, y, n);
    if (kind === 'gate') drawGate(ctx, x, y, map.gateOpen);
    this.contactShadow(ctx, map, col, row);
  }

  private drawFloor(ctx: CanvasRenderingContext2D, x: number, y: number, col: number, row: number, n: number): void {
    const s = this.style;
    switch (s.floorPattern) {
      case 'dirt': {
        ctx.fillStyle = s.floor[0]!;
        ctx.fillRect(x, y, TILE, TILE);
        for (let j = 0; j < TILE; j += 2) {
          for (let i = 0; i < TILE; i += 2) {
            const h = hash2(col * 8 + i, row * 8 + j);
            if (h < 0.55) continue;
            ctx.fillStyle = pick(s.floor, h);
            ctx.fillRect(x + i, y + j, 2, 2);
          }
        }
        if (n > 0.7) {
          const px = x + Math.floor(n * 12) + 2;
          const py = y + Math.floor(hash2(row, col) * 12) + 2;
          ctx.fillStyle = '#6a5848';
          ctx.fillRect(px, py, 2, 1);
          ctx.fillStyle = '#2e241c';
          ctx.fillRect(px, py + 1, 2, 1);
        }
        break;
      }
      case 'flags':
      case 'wet': {
        ctx.fillStyle = s.grout;
        ctx.fillRect(x, y, TILE, TILE);
        const offset = row % 2 === 0 ? 0 : 4;
        for (let sy = 0; sy < TILE; sy += 8) {
          for (let sx = -offset; sx < TILE; sx += 8) {
            const h = hash2(col * 3 + Math.floor((sx + offset) / 8), row * 3 + sy / 8);
            const x0 = Math.max(x, x + sx + 1);
            const x1 = Math.min(x + TILE, x + sx + 8);
            ctx.fillStyle = pick(s.floor, h);
            ctx.fillRect(x0, y + sy + 1, x1 - x0, 7);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(x0, y + sy + 1, x1 - x0, 1);
            if (h > 0.88) {
              ctx.fillStyle = s.grout;
              ctx.fillRect(x0 + 2, y + sy + 4, 3, 1);
              ctx.fillRect(x0 + 4, y + sy + 5, 1, 2);
            }
          }
        }
        if (s.floorPattern === 'wet' && n > 0.78) {
          ctx.fillStyle = '#3e5a52';
          ctx.fillRect(x + 3 + Math.floor(n * 6), y + 9, 6, 2);
          ctx.fillStyle = '#5a7a70';
          ctx.fillRect(x + 4 + Math.floor(n * 6), y + 9, 2, 1);
        }
        if (s.floorPattern === 'flags' && n > 0.82) {
          // Rubbish from the chutes: paper, glass, bone.
          const h = hash2(row * 7, col * 13);
          ctx.fillStyle = h < 0.4 ? '#cfc8b0' : h < 0.7 ? '#5aa07a' : '#e8e0c8';
          ctx.fillRect(x + 2 + Math.floor(h * 10), y + 4 + Math.floor(n * 8), h < 0.4 ? 3 : 1, h < 0.4 ? 2 : 1);
        }
        break;
      }
      case 'plates': {
        ctx.fillStyle = pick(s.floor, n);
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = s.grout;
        ctx.fillRect(x + TILE - 1, y, 1, TILE);
        ctx.fillRect(x, y + TILE - 1, TILE, 1);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.fillRect(x, y, TILE - 1, 1);
        for (const [rx, ry] of [[2, 2], [12, 2], [2, 12], [12, 12]] as const) {
          ctx.fillStyle = '#5c544a';
          ctx.fillRect(x + rx, y + ry, 1, 1);
          ctx.fillStyle = '#26201c';
          ctx.fillRect(x + rx + 1, y + ry + 1, 1, 1);
        }
        if (n > 0.6) {
          ctx.fillStyle = '#5a3a24';
          const rx = x + 3 + Math.floor(n * 9);
          ctx.fillRect(rx, y + 3, 1, 6 + Math.floor(n * 5));
          ctx.fillRect(rx + 1, y + 5, 1, 3);
        }
        if (n < 0.06) {
          // A drain grate.
          ctx.fillStyle = '#141210';
          ctx.fillRect(x + 4, y + 4, 8, 8);
          ctx.fillStyle = '#4a443c';
          for (let i = 5; i < 12; i += 2) ctx.fillRect(x + i, y + 4, 1, 8);
        }
        break;
      }
      case 'planks': {
        for (let i = 0; i < 4; i++) {
          const h = hash2(col, row * 4 + i);
          ctx.fillStyle = pick(s.floor, h);
          ctx.fillRect(x, y + i * 4, TILE, 4);
          ctx.fillStyle = s.grout;
          ctx.fillRect(x, y + i * 4 + 3, TILE, 1);
          const seam = Math.floor(h * 14) + 1;
          if ((col + i) % 3 === 0) {
            ctx.fillRect(x + seam, y + i * 4, 1, 3);
            ctx.fillStyle = '#8a7a60';
            ctx.fillRect(x + seam + 1, y + i * 4 + 1, 1, 1);
          }
          ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
          ctx.fillRect(x + Math.floor(h * 9), y + i * 4 + 1, 4, 1);
        }
        break;
      }
    }
  }

  /** Floors darken where walls meet them: under a wall's face, and a little at the sides. */
  private contactShadow(ctx: CanvasRenderingContext2D, map: TileMap, col: number, row: number): void {
    const x = col * TILE;
    const y = row * TILE;
    if (isWallish(map.kindAt(col, row - 1))) {
      for (const [i, a] of [[0, 0.42], [1, 0.3], [2, 0.18], [3, 0.08]] as const) {
        ctx.fillStyle = `rgba(0, 0, 0, ${a})`;
        ctx.fillRect(x, y + i, TILE, 1);
      }
    }
    for (const [dc, edge] of [[-1, 0], [1, TILE - 1]] as const) {
      if (!isWallish(map.kindAt(col + dc, row))) continue;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
      ctx.fillRect(x + edge, y, 1, TILE);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(x + edge - dc, y, 1, TILE);
    }
  }

  private drawWall(ctx: CanvasRenderingContext2D, map: TileMap, col: number, row: number, n: number): void {
    const s = this.style;
    const x = col * TILE;
    const y = row * TILE;
    const face = !isWallish(map.kindAt(col, row + 1));
    ctx.fillStyle = s.top;
    ctx.fillRect(x, y, TILE, TILE);
    // Texture on the wall top.
    for (let i = 0; i < 4; i++) {
      const h = hash2(col * 5 + i, row * 7);
      ctx.fillStyle = h > 0.5 ? s.topHi : '#0c0d0b';
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x + Math.floor(h * 14), y + Math.floor(hash2(row + i, col) * (face ? 5 : 14)), 2, 1);
    }
    ctx.globalAlpha = 1;
    // A lit rim wherever the wall top meets open floor.
    ctx.fillStyle = s.topHi;
    const topH = face ? 6 : TILE;
    if (!isWallish(map.kindAt(col, row - 1))) ctx.fillRect(x, y, TILE, 1);
    if (!isWallish(map.kindAt(col - 1, row))) ctx.fillRect(x, y, 1, topH);
    if (!isWallish(map.kindAt(col + 1, row))) ctx.fillRect(x + TILE - 1, y, 1, topH);
    if (face) this.drawFace(ctx, x, y + 6, col, row, n);
  }

  /** The front face of a wall: 10 pixels of brick, stone, plate, or plaster. */
  private drawFace(ctx: CanvasRenderingContext2D, x: number, y: number, col: number, row: number, n: number): void {
    const s = this.style;
    const H = 10;
    ctx.fillStyle = s.mortar;
    ctx.fillRect(x, y, TILE, H);
    switch (s.facePattern) {
      case 'bricks':
      case 'rough':
      case 'blocks': {
        const bw = s.facePattern === 'blocks' ? 8 : s.facePattern === 'rough' ? 6 : 8;
        const bh = s.facePattern === 'blocks' ? 5 : 4;
        for (let course = 0; course * bh < H; course++) {
          const off = (course + row) % 2 === 0 ? 0 : bw / 2;
          for (let bx = -off; bx < TILE; bx += bw) {
            const h = hash2(col * 9 + Math.floor((bx + off) / bw) + course * 31, row * 5 + course);
            const x0 = Math.max(x, x + bx + (s.facePattern === 'rough' ? Math.floor(h * 2) : 1));
            const x1 = Math.min(x + TILE, x + bx + bw);
            const y0 = y + course * bh + 1;
            const y1 = Math.min(y + H, y + (course + 1) * bh);
            ctx.fillStyle = pick(s.face, h);
            ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
            ctx.fillRect(x0, y0, x1 - x0, 1);
          }
        }
        if (s.facePattern === 'blocks') {
          // Moss creeping down from the top, and a water stain.
          ctx.fillStyle = '#4a6a3a';
          for (let i = 0; i < 4; i++) {
            const h = hash2(col * 11 + i, row);
            if (h < 0.45) ctx.fillRect(x + Math.floor(h * 30) % TILE, y, 1, 1 + Math.floor(h * 4));
          }
          if (n > 0.7) {
            ctx.fillStyle = 'rgba(20, 40, 36, 0.4)';
            ctx.fillRect(x + Math.floor(n * 10), y + 2, 3, H - 2);
          }
        }
        if (s.facePattern === 'rough' && n > 0.65) {
          // Roots pushing through.
          ctx.fillStyle = '#5a4030';
          const rx = x + Math.floor(n * 12) + 1;
          ctx.fillRect(rx, y, 1, 5);
          ctx.fillRect(rx + 1, y + 4, 1, 3);
        }
        if (s.facePattern === 'bricks' && n < 0.12) {
          // A rubbish chute mouth.
          ctx.fillStyle = '#5a5e64';
          ctx.fillRect(x + 3, y + 1, 10, 7);
          ctx.fillStyle = '#0a0b0a';
          ctx.fillRect(x + 4, y + 2, 8, 5);
        }
        break;
      }
      case 'panels': {
        ctx.fillStyle = pick(s.face, n);
        ctx.fillRect(x, y + 1, TILE, H - 1);
        ctx.fillStyle = s.mortar;
        ctx.fillRect(x + TILE - 1, y, 1, H);
        ctx.fillStyle = '#7a6a5a';
        ctx.fillRect(x + 2, y + 2, 1, 1);
        ctx.fillRect(x + 12, y + 2, 1, 1);
        if (n < 0.4) {
          // A pipe running along the wall.
          ctx.fillStyle = n < 0.15 ? '#c87533' : '#6a7076';
          ctx.fillRect(x, y + 5, TILE, 3);
          ctx.fillStyle = n < 0.15 ? '#f0a060' : '#a8aeb4';
          ctx.fillRect(x, y + 5, TILE, 1);
          ctx.fillStyle = '#2a2420';
          ctx.fillRect(x, y + 8, TILE, 1);
          if (n < 0.08) {
            ctx.fillStyle = '#a03020';
            ctx.fillRect(x + 6, y + 3, 4, 2);
          }
        }
        ctx.fillStyle = '#6a3a20';
        if (n > 0.75) ctx.fillRect(x + Math.floor(n * 12), y + 3, 1, 6);
        break;
      }
      case 'plaster': {
        ctx.fillStyle = pick(s.face, n);
        ctx.fillRect(x, y, TILE, H - 3);
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(x, y + H - 3, TILE, 3);
        ctx.fillStyle = '#6a4a30';
        ctx.fillRect(x, y + H - 3, TILE, 1);
        if (n > 0.7) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
          ctx.fillRect(x + Math.floor(n * 10), y + 1, 4, 3);
        }
        break;
      }
    }
    ctx.fillStyle = s.faceHi;
    ctx.fillRect(x, y, TILE, 1);
    ctx.fillStyle = s.faceLo;
    ctx.fillRect(x, y + H - 1, TILE, 1);
  }

  private drawWater(ctx: CanvasRenderingContext2D, map: TileMap, col: number, row: number): void {
    const [deep, mid, hi] = this.style.water;
    const x = col * TILE;
    const y = row * TILE;
    const wet = (k: TileKind) => k === 'sludge' || k === 'prop';
    const open = [map.kindAt(col - 1, row), map.kindAt(col + 1, row), map.kindAt(col, row - 1), map.kindAt(col, row + 1)].every(wet);
    ctx.fillStyle = open ? deep : mid;
    ctx.fillRect(x, y, TILE, TILE);
    if (open) {
      ctx.fillStyle = mid;
      for (let i = 0; i < 3; i++) {
        const h = hash2(col * 3 + i, row * 7);
        ctx.fillRect(x + Math.floor(h * 12), y + 2 + i * 5, 4, 1);
      }
    }
    // A wet stone lip wherever the water meets dry floor.
    ctx.fillStyle = hi;
    ctx.globalAlpha = 0.5;
    if (!wet(map.kindAt(col, row - 1))) ctx.fillRect(x, y, TILE, 1);
    if (!wet(map.kindAt(col - 1, row))) ctx.fillRect(x, y, 1, TILE);
    if (!wet(map.kindAt(col + 1, row))) ctx.fillRect(x + TILE - 1, y, 1, TILE);
    ctx.globalAlpha = 1;
    if (!wet(map.kindAt(col, row - 1)) && isWallish(map.kindAt(col, row - 1))) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(x, y, TILE, 3);
    }
    this.water.push({ col, row });
  }

  private drawExit(ctx: CanvasRenderingContext2D, map: TileMap, col: number, row: number): void {
    const x = col * TILE;
    const y = row * TILE;
    const out = (dc: number, dr: number) => {
      const k = map.kindAt(col + dc, row + dr);
      return k === 'void' || !map.inBounds(col + dc, row + dr);
    };
    const [dx, dy] = out(1, 0) ? [1, 0] : out(-1, 0) ? [-1, 0] : out(0, 1) ? [0, 1] : [0, -1];
    const piped = [map.kindAt(col - 1, row), map.kindAt(col + 1, row), map.kindAt(col, row - 1), map.kindAt(col, row + 1)].includes('crawl');
    if (piped) drawPipe(ctx, map, col, row);
    else this.drawFloor(ctx, x, y, col, row, hash2(col, row));
    // Fade into darkness toward the way out.
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = `rgba(5, 6, 5, ${0.1 + i * 0.1})`;
      if (dx !== 0) ctx.fillRect(dx > 0 ? x + 8 + i : x + 7 - i, y, 1, TILE);
      else ctx.fillRect(x, dy > 0 ? y + 8 + i : y + 7 - i, TILE, 1);
    }
    this.exits.push({ x: x + TILE / 2, y: y + TILE / 2, dx, dy });
  }

  private drawBunting(ctx: CanvasRenderingContext2D, map: TileMap): void {
    // Strings of socks along the Cooperative's wall faces.
    for (let row = 0; row < map.rows - 1; row++) {
      for (let col = 0; col < map.cols; col++) {
        if (!isWallish(map.kindAt(col, row)) || isWallish(map.kindAt(col, row + 1))) continue;
        const x = col * TILE;
        const y = row * TILE + 8;
        for (let i = 0; i < TILE; i++) {
          const sag = Math.sin((((col * TILE + i) % 48) / 48) * Math.PI) * 2;
          ctx.fillStyle = '#d8d0b8';
          ctx.fillRect(x + i, Math.round(y + sag), 1, 1);
          if ((col * TILE + i) % 6 === 3) {
            ctx.fillStyle = SOCKS[(col * 3 + i) % SOCKS.length]!;
            const sy = Math.round(y + sag + 1);
            ctx.fillRect(x + i, sy, 2, 3);
            ctx.fillRect(x + i + 1, sy + 3, 2, 1);
          }
        }
      }
    }
  }
}

function chevron(ctx: CanvasRenderingContext2D, cx: number, cy: number, dx: number, dy: number, color: string): void {
  ctx.fillStyle = color;
  for (let i = -2; i <= 2; i++) {
    const back = 2 - Math.abs(i);
    if (dx !== 0) ctx.fillRect(Math.round(cx + dx * back), Math.round(cy + i), 1, 1);
    else ctx.fillRect(Math.round(cx + i), Math.round(cy + dy * back), 1, 1);
  }
}

function drawMoss(ctx: CanvasRenderingContext2D, x: number, y: number, n: number): void {
  ctx.fillStyle = PAL.moss;
  ctx.fillRect(x + 2 + Math.floor(n * 6), y + 3, 5, 3);
  ctx.fillRect(x + 8, y + 9 + Math.floor(n * 4), 4, 2);
  ctx.fillStyle = '#6a8a4a';
  ctx.fillRect(x + 3 + Math.floor(n * 6), y + 3, 2, 1);
}

function drawPipe(ctx: CanvasRenderingContext2D, map: TileMap, col: number, row: number): void {
  const x = col * TILE;
  const y = row * TILE;
  ctx.fillStyle = '#121412';
  ctx.fillRect(x, y, TILE, TILE);
  const horizontal = !isWallish(map.kindAt(col - 1, row)) || !isWallish(map.kindAt(col + 1, row));
  ctx.fillStyle = '#1e201c';
  for (let i = 1; i < TILE; i += 4) {
    if (horizontal) ctx.fillRect(x + i, y + 3, 1, TILE - 6);
    else ctx.fillRect(x + 3, y + i, TILE - 6, 1);
  }
  const rim = (dx: number, dy: number, rx: number, ry: number, w: number, h: number) => {
    if (!isWallish(map.kindAt(col + dx, row + dy))) return;
    ctx.fillStyle = PAL.rust;
    ctx.fillRect(x + rx, y + ry, w, h);
    ctx.fillStyle = PAL.rustLight;
    ctx.fillRect(x + rx, y + ry, w === TILE ? TILE : 1, h === TILE ? TILE : 1);
  };
  rim(0, -1, 0, 0, TILE, 2);
  rim(0, 1, 0, TILE - 2, TILE, 2);
  rim(-1, 0, 0, 0, 2, TILE);
  rim(1, 0, TILE - 2, 0, 2, TILE);
}

function drawGate(ctx: CanvasRenderingContext2D, x: number, y: number, open: boolean): void {
  if (open) {
    ctx.fillStyle = '#0c0d0c';
    ctx.fillRect(x, y, TILE, 2);
    ctx.fillStyle = '#6a7076';
    for (let i = 1; i < TILE; i += 4) ctx.fillRect(x + i, y + 2, 2, 2);
    return;
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(x, y + 13, TILE, 3);
  for (let i = 1; i < TILE; i += 4) {
    ctx.fillStyle = '#6a7076';
    ctx.fillRect(x + i, y, 2, TILE - 1);
    ctx.fillStyle = '#a8aeb4';
    ctx.fillRect(x + i, y, 1, TILE - 1);
    ctx.fillStyle = '#c8ccd0';
    ctx.fillRect(x + i, y + TILE - 2, 2, 1);
  }
  ctx.fillStyle = '#5a5e64';
  ctx.fillRect(x, y + 4, TILE, 2);
  ctx.fillRect(x, y + 10, TILE, 2);
  ctx.fillStyle = '#8a9096';
  ctx.fillRect(x, y + 4, TILE, 1);
  ctx.fillRect(x, y + 10, TILE, 1);
}

function drawHole(ctx: CanvasRenderingContext2D, x: number, y: number, patched: boolean, n: number): void {
  if (patched) {
    // A neat new patch of brick, with a small brass plaque. Legally a wall.
    ctx.fillStyle = '#2e2620';
    ctx.fillRect(x + 2, y + 6, 12, 10);
    for (let course = 0; course < 3; course++) {
      const off = course % 2 ? 3 : 0;
      for (let bx = 2 - off; bx < 14; bx += 6) {
        const x0 = Math.max(x + 2, x + bx + 1);
        const x1 = Math.min(x + 14, x + bx + 6);
        ctx.fillStyle = course === 1 ? '#7a6450' : '#6e5a48';
        ctx.fillRect(x0, y + 7 + course * 3, x1 - x0, 2);
      }
    }
    ctx.fillStyle = '#c8a040';
    ctx.fillRect(x + 6, y + 11, 4, 2);
    ctx.fillStyle = '#f0d070';
    ctx.fillRect(x + 6, y + 11, 4, 1);
    return;
  }
  // A ragged hole through the wall face, leaking green dungeon light, with two sad planks across it.
  ctx.fillStyle = '#060a06';
  ctx.fillRect(x + 3, y + 6, 10, 9);
  ctx.fillRect(x + 2, y + 8, 12, 5);
  ctx.fillStyle = '#2f5a24';
  ctx.fillRect(x + 4, y + 8, 8, 5);
  ctx.fillStyle = '#6fa04a';
  ctx.fillRect(x + 6, y + 9, 3, 2);
  ctx.fillStyle = '#9ad06a';
  ctx.fillRect(x + 7, y + 9, 1, 1);
  ctx.fillStyle = PAL.timber;
  ctx.fillRect(x + 1, y + 8, 14, 2);
  ctx.fillRect(x + 2, y + 12 + (n > 0.5 ? 1 : 0), 12, 2);
  ctx.fillStyle = PAL.timberLight;
  ctx.fillRect(x + 1, y + 8, 14, 1);
  ctx.fillStyle = '#c8c8c0';
  ctx.fillRect(x + 2, y + 9, 1, 1);
  ctx.fillRect(x + 13, y + 9, 1, 1);
}

// ---------------------------------------------------------------- set dressing

const CHALK = 'rgba(214, 208, 190, 0.6)';
const CHALK_RED = 'rgba(220, 120, 110, 0.6)';

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * Forty years of somebody living here, baked into the Burrow's floor and walls: a braided rug
 * worn through where the goblin always stands, a day count in chalk, a drawing of a house,
 * roots, cobwebs, and the small rubbish of a life. Puddles sit under the leaks until they're patched.
 */
function drawBurrowDressing(ctx: CanvasRenderingContext2D, map: TileMap, patched: boolean): void {
  const open = (col: number, row: number) => !isWallish(map.kindAt(col, row));

  // The rug, in front of the pot.
  drawRug(ctx, 14 * TILE + 8, 6 * TILE + 2, 42, 14);

  // Under each hole: a puddle while it leaks, a tide mark once it's patched.
  for (let col = 0; col < map.cols; col++) {
    if (map.kindAt(col, 1) !== 'hole' || !open(col, 2)) continue;
    const cx = col * TILE + 8;
    const cy = 2 * TILE + 6;
    for (let y = -3; y <= 3; y++) {
      for (let x = -7; x <= 7; x++) {
        const d = (x / 7.5) ** 2 + (y / 3.2) ** 2;
        if (d > 1) continue;
        if (patched) {
          if (d > 0.7) dot(ctx, cx + x, cy + y, 'rgba(30, 22, 16, 0.35)');
        } else dot(ctx, cx + x, cy + y, d > 0.75 ? '#2c302a' : '#20261f');
      }
    }
    if (!patched) {
      dot(ctx, cx - 4, cy - 2, '#5a6e64', 3, 1);
      dot(ctx, cx + 2, cy, '#46584f', 2, 1);
      // Drips that missed the puddle.
      dot(ctx, cx + 9, cy + 3, '#2a2e28', 2, 1);
      dot(ctx, cx - 10, cy + 1, '#2a2e28');
    }
  }

  // A day count in chalk, by the bed. It stopped being a count a long time ago.
  const fy = TILE + 8;
  for (let group = 0; group < 3; group++) {
    const tx = 5 * TILE + 2 + group * 10;
    const strokes = group === 2 ? 3 : 4;
    for (let s = 0; s < strokes; s++) dot(ctx, tx + s * 2, fy + 1, CHALK, 1, 5);
    if (group < 2) for (let i = 0; i < 8; i++) dot(ctx, tx - 1 + i, fy + 5 - Math.floor(i * 0.6), CHALK);
  }

  // A drawing of a house, with a goblin in front of it, and a heart.
  const hx = 15 * TILE + 3;
  for (let i = 0; i < 5; i++) {
    dot(ctx, hx + i, fy + 4 - i, CHALK);
    dot(ctx, hx + 8 - i, fy + 4 - i, CHALK);
  }
  dot(ctx, hx + 1, fy + 4, CHALK, 7, 1);
  dot(ctx, hx + 1, fy + 5, CHALK, 1, 4);
  dot(ctx, hx + 7, fy + 5, CHALK, 1, 4);
  dot(ctx, hx + 1, fy + 8, CHALK, 7, 1);
  dot(ctx, hx + 4, fy + 6, CHALK, 1, 2);
  dot(ctx, hx + 6, fy - 1, CHALK, 1, 3);
  const gx = hx + 13;
  dot(ctx, gx, fy + 3, CHALK, 3, 2);
  dot(ctx, gx - 2, fy + 2, CHALK, 2, 1);
  dot(ctx, gx + 3, fy + 2, CHALK, 2, 1);
  dot(ctx, gx + 1, fy + 5, CHALK, 1, 2);
  dot(ctx, gx, fy + 7, CHALK);
  dot(ctx, gx + 2, fy + 7, CHALK);
  dot(ctx, gx + 6, fy + 1, CHALK_RED);
  dot(ctx, gx + 8, fy + 1, CHALK_RED);
  dot(ctx, gx + 6, fy + 2, CHALK_RED, 3, 1);
  dot(ctx, gx + 7, fy + 3, CHALK_RED);

  // A pipe along the top of the back wall, sweating.
  const py = TILE + 1;
  dot(ctx, 14 * TILE, py, '#3a3f42', 7 * TILE, 3);
  dot(ctx, 14 * TILE, py, '#5e666a', 7 * TILE, 1);
  for (let c = 14; c <= 21; c++) {
    dot(ctx, c * TILE - 1, py - 1, '#2a2e30', 3, 5);
    dot(ctx, c * TILE, py - 1, '#6e767a');
  }
  dot(ctx, 17 * TILE + 9, py + 3, '#4a6a70', 1, 2);

  // Roots, coming through between the stones.
  for (const [col, len] of [[8, 7], [11, 5], [18, 9], [22, 4]] as const) {
    if (!isWallish(map.kindAt(col, 1)) || !open(col, 2)) continue;
    let x = col * TILE + 4 + Math.floor(hash2(col, 3) * 8);
    for (let i = 0; i < len; i++) {
      dot(ctx, x, 2 * TILE - 2 + i, i === len - 1 ? '#8a6a48' : '#4e3626');
      if (hash2(col, i) > 0.7) x += hash2(i, col) > 0.5 ? 1 : -1;
    }
  }

  // Cobwebs in the corners nobody reaches.
  for (let row = 1; row < map.rows - 1; row++) {
    for (let col = 1; col < map.cols - 1; col++) {
      if (!open(col, row) || map.spawns.some((s) => s.col === col && s.row === row)) continue;
      const up = isWallish(map.kindAt(col, row - 1));
      const down = isWallish(map.kindAt(col, row + 1));
      const left = isWallish(map.kindAt(col - 1, row));
      const right = isWallish(map.kindAt(col + 1, row));
      if (up && left) drawWeb(ctx, col * TILE, row * TILE, 1, 1);
      else if (up && right) drawWeb(ctx, (col + 1) * TILE - 1, row * TILE, -1, 1);
      else if (down && right) drawWeb(ctx, (col + 1) * TILE - 1, (row + 1) * TILE - 1, -1, -1);
    }
  }

  // Straw from the bed, and the small rubbish of a long life.
  for (let i = 0; i < 14; i++) {
    const x = 2 * TILE + Math.floor(hash2(i, 41) * 30);
    const y = 3 * TILE + Math.floor(hash2(41, i) * 9);
    dot(ctx, x, y, i % 3 ? '#a89060' : '#c8b078', 2 + (i % 2), 1);
  }
  const junk: [number, number, (x: number, y: number) => void][] = [
    // A bottle cap.
    [21, 4, (x, y) => {
      dot(ctx, x, y, '#a83a2a', 3, 2);
      dot(ctx, x, y, '#e08a6a');
    }],
    // One sock. The other one is at the Cooperative.
    [22, 8, (x, y) => {
      dot(ctx, x, y, '#c04040', 2, 3);
      dot(ctx, x, y + 1, '#e8e0d0', 2, 1);
      dot(ctx, x + 1, y + 3, '#c04040', 3, 1);
    }],
    // A letter that was answered.
    [9, 3, (x, y) => {
      dot(ctx, x, y, '#cfc8b0', 4, 3);
      dot(ctx, x + 1, y + 1, '#8a8470', 2, 1);
    }],
    // A fish skeleton.
    [17, 10, (x, y) => {
      dot(ctx, x, y + 1, '#d8d0b8', 6, 1);
      for (let i = 1; i < 5; i += 2) {
        dot(ctx, x + i, y, '#b8b098');
        dot(ctx, x + i, y + 2, '#b8b098');
      }
      dot(ctx, x + 6, y, '#d8d0b8', 1, 3);
    }],
    // Half a cup.
    [6, 6, (x, y) => {
      dot(ctx, x, y, '#8a9aa8', 3, 2);
      dot(ctx, x, y, '#b8c8d0');
    }],
    // Wax from forty years of candles.
    [19, 3, (x, y) => {
      dot(ctx, x, y, '#e8dcb0', 2, 1);
      dot(ctx, x + 4, y + 2, '#e8dcb0');
      dot(ctx, x - 2, y + 3, '#d8c898');
    }],
  ];
  for (const [col, row, draw] of junk) {
    if (open(col, row)) draw(col * TILE + 4 + Math.floor(hash2(col, row) * 6), row * TILE + 5 + Math.floor(hash2(row, col) * 6));
  }

  // A path worn into the dirt, from the passage to the rug.
  for (let x = 17 * TILE; x < 25 * TILE; x += 2) {
    const h = hash2(x, 6);
    if (h > 0.45) dot(ctx, x, 6 * TILE + 4 + Math.floor(h * 8), 'rgba(150, 120, 90, 0.18)', 2, 1);
  }
}

/** A braided rag rug: concentric bands, a darker braid, frayed ends, worn in the middle. */
function drawRug(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  const bands = ['#5a2e24', '#8a5232', '#6e4a3a', '#a06a3a', '#7a3a2e', '#b07a48'];
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const d = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2);
      if (d > 1) continue;
      const band = Math.min(bands.length - 1, Math.floor((1 - d) * bands.length * 1.4));
      dot(ctx, cx + x, cy + y, bands[band]!);
      if ((Math.floor((x + 40) / 2) + y) % 3 === 0) dot(ctx, cx + x, cy + y, 'rgba(0, 0, 0, 0.16)');
      if (Math.hypot(x + 6, (y - 1) * 2.4) < 7 && hash2(x + 100, y + 100) > 0.45) dot(ctx, cx + x, cy + y, 'rgba(60, 44, 32, 0.5)');
    }
  }
  for (let x = -rx; x <= rx; x++) {
    const edge = Math.round(ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)));
    dot(ctx, cx + x, cy + edge + 1, 'rgba(0, 0, 0, 0.25)');
    if (hash2(x, 7) > 0.8) dot(ctx, cx + x, cy + edge + 2, '#7a4a30');
    if (hash2(x, 9) > 0.85) dot(ctx, cx + x, cy - edge - 1, '#8a5a36');
  }
}

/** A corner cobweb: two edge threads, a diagonal, and two cross threads. */
function drawWeb(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number): void {
  const c = 'rgba(220, 220, 210, 0.22)';
  for (let i = 0; i < 9; i++) {
    dot(ctx, x + dx * i, y, c);
    dot(ctx, x, y + dy * i, c);
    if (i < 7) dot(ctx, x + dx * i, y + dy * i, c);
  }
  for (const r of [3, 6]) {
    for (let i = 0; i <= r; i++) dot(ctx, x + dx * i, y + dy * (r - i), c);
  }
}
