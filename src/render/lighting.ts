import { clamp } from '../core/math';
import { VIEW_H, VIEW_W } from '../core/screen';

/** Top-left of the visible area in world pixels, already rounded and shaken. */
export interface View {
  x: number;
  y: number;
}

export interface Light {
  x: number;
  y: number;
  /** Radius in world pixels. */
  r: number;
  color: string;
  /** Intensity, 0..1. */
  a: number;
  /** How much it flickers, 0..1. */
  flicker?: number;
  seed?: number;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Brightness steps in a light's falloff. Ordered dithering blends between them, for a pixel-art look. */
const BANDS = 7;

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A smooth 0..1 flicker multiplier for a light, from overlapping sine waves. */
export function flickerAt(light: Light, time: number): number {
  const f = light.flicker ?? 0;
  if (f === 0) return 1;
  const s = light.seed ?? light.x * 0.37 + light.y * 0.11;
  const n = Math.sin(time * 11 + s) * 0.45 + Math.sin(time * 17.3 + s * 2.1) * 0.3 + Math.sin(time * 4.7 + s * 0.7) * 0.25;
  return 1 - f * (0.5 + 0.5 * n);
}

/**
 * A light map multiplied over the scene: the region's darkness, plus every light added on top.
 * Lights are banded and dithered sprites, so light pools read as pixel art rather than airbrush.
 */
export class Lighting {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprites = new Map<string, HTMLCanvasElement>();

  constructor() {
    this.canvas.width = VIEW_W;
    this.canvas.height = VIEW_H;
    this.ctx = this.canvas.getContext('2d')!;
  }

  private sprite(color: string, r: number): HTMLCanvasElement {
    const key = `${color}:${r}`;
    let c = this.sprites.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    const size = r * 2;
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const img = g.createImageData(size, size);
    const [cr, cg, cb] = hexRgb(color);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
        if (d >= 1) continue;
        const v = Math.pow(1 - d, 1.5) * BANDS;
        const base = Math.floor(v);
        const step = v - base > (BAYER4[(y % 4) * 4 + (x % 4)]! + 0.5) / 16 ? 1 : 0;
        const q = Math.min(1, (base + step) / BANDS);
        const i = (y * size + x) * 4;
        img.data[i] = cr;
        img.data[i + 1] = cg;
        img.data[i + 2] = cb;
        img.data[i + 3] = Math.round(q * 255);
      }
    }
    g.putImageData(img, 0, 0);
    this.sprites.set(key, c);
    return c;
  }

  /** Multiply the light map over everything drawn so far. `base` is the region's darkness. */
  render(target: CanvasRenderingContext2D, view: View, base: string, lights: readonly Light[], time: number): void {
    const l = this.ctx;
    l.globalCompositeOperation = 'source-over';
    l.globalAlpha = 1;
    l.fillStyle = base;
    l.fillRect(0, 0, VIEW_W, VIEW_H);
    l.globalCompositeOperation = 'lighter';
    for (const light of lights) {
      const r = Math.max(2, Math.round(light.r));
      const sx = Math.round(light.x - view.x);
      const sy = Math.round(light.y - view.y);
      if (sx < -r || sy < -r || sx > VIEW_W + r || sy > VIEW_H + r) continue;
      l.globalAlpha = clamp(light.a * flickerAt(light, time), 0, 1);
      l.drawImage(this.sprite(light.color, r), sx - r, sy - r);
    }
    l.globalAlpha = 1;
    l.globalCompositeOperation = 'source-over';

    target.save();
    target.globalCompositeOperation = 'multiply';
    target.drawImage(this.canvas, 0, 0);
    target.restore();
  }

  /** Soft halos around the brightest lights, added after the multiply so they read as glow. */
  glow(target: CanvasRenderingContext2D, view: View, lights: readonly Light[], time: number, strength = 0.22): void {
    target.save();
    target.globalCompositeOperation = 'lighter';
    for (const light of lights) {
      if (light.a < 0.5) continue;
      const r = Math.max(2, Math.round(light.r * 0.35));
      const sx = Math.round(light.x - view.x);
      const sy = Math.round(light.y - view.y);
      if (sx < -r || sy < -r || sx > VIEW_W + r || sy > VIEW_H + r) continue;
      target.globalAlpha = clamp(light.a * strength * flickerAt(light, time), 0, 1);
      target.drawImage(this.sprite(light.color, r), sx - r, sy - r);
    }
    target.restore();
  }
}

let vignette: HTMLCanvasElement | null = null;

/** A permanent soft darkening at the screen edges, for a framed, cinematic look. */
export function drawFrameVignette(ctx: CanvasRenderingContext2D): void {
  if (!vignette) {
    vignette = document.createElement('canvas');
    vignette.width = VIEW_W;
    vignette.height = VIEW_H;
    const g = vignette.getContext('2d')!;
    const grad = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.drawImage(vignette, 0, 0);
}

/** Colored edge glow: red when hurt or spotted. */
export function drawEdgeGlow(ctx: CanvasRenderingContext2D, strength: number, rgb = '224, 64, 48'): void {
  if (strength <= 0) return;
  const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.6);
  g.addColorStop(0, `rgba(${rgb}, 0)`);
  g.addColorStop(1, `rgba(${rgb}, ${0.55 * Math.min(1, strength)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
