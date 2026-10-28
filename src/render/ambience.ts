import { VIEW_H, VIEW_W } from '../core/screen';
import type { RegionId } from '../data/regions';
import type { TileMap } from '../world/tilemap';
import { TILE, type TileKind } from '../world/tiles';
import type { View } from './lighting';

// Ambient life: water dripping off wall faces, ripples, dust in the light, Cistern spores,
// Pumpworks steam, rubbish rattling down the Galleries chutes, and embers from fires.
// Purely visual. Only spawns near the view, so it costs nothing off screen.

export type AmbientKind = 'drip' | 'splash' | 'ripple' | 'mote' | 'spore' | 'steam' | 'debris' | 'ember';
export type AmbientSound = 'drip' | 'clatter' | 'steam';

interface Bit {
  kind: AmbientKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  /** Where a falling bit lands. */
  floor: number;
  color: string;
  size: number;
  bounced?: boolean;
}

interface Profile {
  drips: number;
  ripples: number;
  motes: number;
  spores: number;
  steam: number;
  /** Rubbish showers per second, from the chutes. */
  debris: number;
  mote: string;
}

const PROFILES: Record<RegionId, Profile> = {
  burrow: { drips: 0.5, ripples: 0, motes: 5, spores: 0, steam: 0, debris: 0, mote: '#e8d8b0' },
  galleries: { drips: 1.1, ripples: 0, motes: 6, spores: 0, steam: 0, debris: 0.07, mote: '#d8d0b8' },
  cistern: { drips: 2.8, ripples: 2.5, motes: 2, spores: 4, steam: 0, debris: 0, mote: '#c8e8c8' },
  pumpworks: { drips: 0.8, ripples: 0, motes: 3, spores: 0, steam: 1.8, debris: 0, mote: '#e8c8a0' },
  coop: { drips: 0, ripples: 0, motes: 6, spores: 0, steam: 0, debris: 0, mote: '#f0d8a0' },
};

const RUBBISH = ['#cfc8b0', '#8a9096', '#9a5a30', '#6a4a2c', '#5aa07a', '#e8e0c8'];
const MAX_BITS = 260;

const wallish = (k: TileKind) => k === 'wall' || k === 'hole' || k === 'void';

export class Ambience {
  readonly bits: Bit[] = [];
  private readonly profile: Profile;
  private readonly faces: [number, number][] = [];
  private readonly water: [number, number][] = [];
  private readonly vents: [number, number][] = [];
  private readonly chutes: [number, number][] = [];
  private acc: Record<'drips' | 'ripples' | 'motes' | 'spores' | 'steam' | 'debris', number> = { drips: 0, ripples: 0, motes: 0, spores: 0, steam: 0, debris: 0 };

  constructor(
    region: RegionId,
    private readonly map: TileMap,
    private readonly rng: () => number = Math.random,
    private readonly onSound: (sound: AmbientSound, x: number, y: number) => void = () => {},
  ) {
    this.profile = PROFILES[region];
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        const k = map.kindAt(col, row);
        if (wallish(k) && !wallish(map.kindAt(col, row + 1)) && map.kindAt(col, row + 1) !== 'exit') {
          this.faces.push([col, row]);
          if (row <= 2) this.chutes.push([col, row]);
        }
        if (k === 'sludge') this.water.push([col, row]);
      }
    }
    for (const s of map.spawns) {
      if (s.def.id === 'steamValve' || s.def.id === 'copperMachine' || s.def.id === 'piston') this.vents.push([s.col, s.row]);
    }
    if (region === 'pumpworks') for (const f of this.faces) if ((f[0] * 7 + f[1] * 3) % 9 === 0) this.vents.push([f[0], f[1] + 1]);
  }

  /** Throw ambient bits at a spot (embers off a fire, steam off a pot). */
  emit(kind: AmbientKind, x: number, y: number, count = 1): void {
    for (let i = 0; i < count; i++) this.spawn(kind, x + (this.rng() - 0.5) * 4, y);
  }

  update(dt: number, view: View): void {
    const p = this.profile;
    this.tick('drips', p.drips, dt, () => this.fromSpots(this.faces, view, (c, r) => this.spawn('drip', c * TILE + 2 + this.rng() * 12, r * TILE + TILE)));
    this.tick('ripples', p.ripples, dt, () => this.fromSpots(this.water, view, (c, r) => this.spawn('ripple', c * TILE + 2 + this.rng() * 12, r * TILE + 2 + this.rng() * 12)));
    this.tick('spores', p.spores, dt, () => this.spawn('spore', view.x + this.rng() * VIEW_W, view.y + VIEW_H * (0.3 + this.rng() * 0.8)));
    this.tick('motes', p.motes, dt, () => this.spawn('mote', view.x + this.rng() * VIEW_W, view.y + this.rng() * VIEW_H));
    this.tick('steam', p.steam, dt, () => this.fromSpots(this.vents, view, (c, r) => this.spawn('steam', c * TILE + 4 + this.rng() * 8, r * TILE + 4)));
    this.tick('debris', p.debris, dt, () =>
      this.fromSpots(this.chutes, view, (c, r) => {
        const x = c * TILE + 4 + this.rng() * 8;
        for (let i = 0; i < 4 + Math.floor(this.rng() * 4); i++) this.spawn('debris', x + (this.rng() - 0.5) * 6, r * TILE + TILE - this.rng() * 4);
        this.onSound('clatter', x, r * TILE + TILE);
      }),
    );

    let w = 0;
    for (const b of this.bits) {
      b.life -= dt;
      if (b.life <= 0) continue;
      this.step(b, dt);
      if (b.life > 0) this.bits[w++] = b;
    }
    this.bits.length = w;
  }

  private tick(key: keyof Ambience['acc'], rate: number, dt: number, spawn: () => void): void {
    if (rate <= 0) return;
    this.acc[key] += rate * dt;
    while (this.acc[key] >= 1) {
      this.acc[key] -= 1;
      if (this.bits.length < MAX_BITS) spawn();
    }
  }

  /** Pick a spot near the view; skip quietly if a few tries miss. */
  private fromSpots(spots: readonly [number, number][], view: View, fn: (col: number, row: number) => void): void {
    if (spots.length === 0) return;
    for (let tries = 0; tries < 8; tries++) {
      const s = spots[Math.floor(this.rng() * spots.length)]!;
      const x = s[0] * TILE;
      const y = s[1] * TILE;
      if (x > view.x - 24 && x < view.x + VIEW_W + 8 && y > view.y - 24 && y < view.y + VIEW_H + 8) {
        fn(s[0], s[1]);
        return;
      }
    }
  }

  private spawn(kind: AmbientKind, x: number, y: number): void {
    const r = this.rng;
    const b: Bit = { kind, x, y, vx: 0, vy: 0, life: 1, max: 1, floor: y, color: '#ffffff', size: 1 };
    switch (kind) {
      case 'drip': {
        b.color = '#9ab8c0';
        b.floor = y + 6 + r() * 26;
        // Only fall onto open ground.
        const col = Math.floor(x / TILE);
        while (b.floor > y + 2 && wallish(this.map.kindAt(col, Math.floor(b.floor / TILE)))) b.floor -= 4;
        b.life = b.max = 2;
        break;
      }
      case 'splash':
        b.color = '#b8d0d8';
        b.vx = (r() - 0.5) * 40;
        b.vy = -20 - r() * 30;
        b.floor = y + 1;
        b.life = b.max = 0.3;
        break;
      case 'ripple':
        b.color = '#5a9a8a';
        b.life = b.max = 0.9 + r() * 0.4;
        break;
      case 'mote':
        b.color = this.profile.mote;
        b.vx = (r() - 0.5) * 6;
        b.vy = (r() - 0.5) * 4;
        b.life = b.max = 3 + r() * 3;
        break;
      case 'spore':
        b.color = r() < 0.7 ? '#b8f080' : '#e8ffb0';
        b.vx = (r() - 0.5) * 4;
        b.vy = -4 - r() * 5;
        b.life = b.max = 3 + r() * 3;
        break;
      case 'steam':
        b.color = '#d8d8d0';
        b.vx = (r() - 0.5) * 8;
        b.vy = -10 - r() * 8;
        b.size = 2;
        b.life = b.max = 1.2 + r() * 0.8;
        break;
      case 'debris':
        b.color = RUBBISH[Math.floor(r() * RUBBISH.length)]!;
        b.vx = (r() - 0.5) * 30;
        b.floor = y + 14 + r() * 24;
        b.life = b.max = 3;
        break;
      case 'ember':
        b.color = r() < 0.5 ? '#ffb040' : '#ff7030';
        b.vx = (r() - 0.5) * 10;
        b.vy = -14 - r() * 14;
        b.life = b.max = 0.6 + r() * 0.6;
        break;
    }
    this.bits.push(b);
  }

  private step(b: Bit, dt: number): void {
    switch (b.kind) {
      case 'drip':
        b.vy += 320 * dt;
        b.y += b.vy * dt;
        if (b.y >= b.floor) {
          b.life = 0;
          for (let i = 0; i < 3; i++) this.spawn('splash', b.x, b.floor);
          if (this.rng() < 0.25) this.onSound('drip', b.x, b.floor);
        }
        break;
      case 'splash':
      case 'ember':
        b.vy += (b.kind === 'splash' ? 220 : -8) * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.kind === 'splash' && b.y > b.floor) b.life = 0;
        break;
      case 'debris':
        if (b.y < b.floor || b.vy < 0) {
          b.vy += 260 * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.y >= b.floor && !b.bounced) {
            b.bounced = true;
            b.vy = -b.vy * 0.3;
            b.vx *= 0.4;
          } else if (b.y >= b.floor) {
            b.y = b.floor;
            b.vy = 0;
            b.vx = 0;
          }
        }
        break;
      case 'steam':
        b.size = 2 + (1 - b.life / b.max) * 5;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vx *= Math.exp(-1.5 * dt);
        break;
      default:
        b.x += (b.vx + (b.kind === 'spore' ? Math.sin(b.life * 3 + b.y) * 3 : 0)) * dt;
        b.y += b.vy * dt;
    }
  }

  /** Bits that sit in the world and get lit like it: water, steam, rubbish. */
  drawBack(ctx: CanvasRenderingContext2D, view: View): void {
    for (const b of this.bits) {
      const x = Math.round(b.x - view.x);
      const y = Math.round(b.y - view.y);
      if (x < -8 || y < -8 || x > VIEW_W + 8 || y > VIEW_H + 8) continue;
      const k = b.life / b.max;
      ctx.fillStyle = b.color;
      switch (b.kind) {
        case 'drip':
          ctx.globalAlpha = 0.8;
          ctx.fillRect(x, y - 1, 1, 2);
          break;
        case 'splash':
          ctx.globalAlpha = k;
          ctx.fillRect(x, y, 1, 1);
          break;
        case 'ripple': {
          const rad = 1 + (1 - k) * 5;
          ctx.globalAlpha = k * 0.7;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.fillRect(Math.round(x + Math.cos(a) * rad), Math.round(y + Math.sin(a) * rad * 0.5), 1, 1);
          }
          break;
        }
        case 'steam': {
          ctx.globalAlpha = 0.22 * k;
          const s = Math.round(b.size);
          ctx.fillRect(x - Math.floor(s / 2), y - Math.floor(s / 2), s, s);
          ctx.fillRect(x - Math.floor(s / 2) - 1, y - Math.floor(s / 2) + 1, s + 2, Math.max(1, s - 2));
          break;
        }
        case 'debris':
          ctx.globalAlpha = Math.min(1, k * 3);
          ctx.fillRect(x, y, 2, 1);
          break;
        default:
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Bits that glow: added after lighting so they show up in the dark. */
  drawGlow(ctx: CanvasRenderingContext2D, view: View): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bits) {
      if (b.kind !== 'mote' && b.kind !== 'spore' && b.kind !== 'ember') continue;
      const x = Math.round(b.x - view.x);
      const y = Math.round(b.y - view.y);
      if (x < 0 || y < 0 || x > VIEW_W || y > VIEW_H) continue;
      const k = b.life / b.max;
      const fade = Math.min(1, k * 3, (1 - k) * 4);
      ctx.globalAlpha = (b.kind === 'mote' ? 0.28 : b.kind === 'spore' ? 0.6 : 0.9) * fade;
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
  }
}
