import type { Vec2 } from './math';

/** The designed resolution. Menus, cards, and the title are laid out at this size. */
export const BASE_W = 480;
export const BASE_H = 270;
/** The view grows past the base size to fill wider or taller windows, up to these limits. */
const MAX_W = 640;
const MAX_H = 384;

/**
 * Size of the visible game area in game pixels: the base size, stretched along one axis to
 * match the window's shape, so the game fills the screen with no bars. Live bindings: read
 * them at draw time, never into a module-level constant.
 */
export let VIEW_W = BASE_W;
export let VIEW_H = BASE_H;

/** Top-left of a centered BASE_W x BASE_H stage inside the view, for screens laid out at the base size. */
export function stageOrigin(): Vec2 {
  return { x: Math.round((VIEW_W - BASE_W) / 2), y: Math.round((VIEW_H - BASE_H) / 2) };
}

/**
 * Two stacked canvases fill the window. The game is drawn to a low-res offscreen canvas,
 * scaled up by a whole number with no smoothing, then smoothed down to the exact window size
 * ("sharp bilinear"), so pixels stay crisp and even at any scale. Text goes on a
 * full-resolution UI canvas on top, so it stays sharp.
 */
export class Screen {
  readonly game: CanvasRenderingContext2D;
  readonly ui: CanvasRenderingContext2D;
  private readonly lowres = document.createElement('canvas');
  private readonly upscaled = document.createElement('canvas');
  private readonly up: CanvasRenderingContext2D;
  private readonly display: CanvasRenderingContext2D;
  /** Scale from game pixels to CSS pixels. Not always a whole number. */
  scale = 1;
  /** Scale from game pixels to UI canvas pixels (includes devicePixelRatio). */
  uiScale = 1;
  private offsetX = 0;
  private offsetY = 0;
  /** Whole-number upscale used before the final smooth resize. */
  private k = 1;

  constructor(private readonly displayCanvas: HTMLCanvasElement, private readonly uiCanvas: HTMLCanvasElement) {
    this.game = this.lowres.getContext('2d')!;
    this.up = this.upscaled.getContext('2d')!;
    this.display = displayCanvas.getContext('2d')!;
    this.ui = uiCanvas.getContext('2d')!;
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('fullscreenchange', () => this.resize());
    this.resize();
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const aspect = w / h;
    if (aspect >= BASE_W / BASE_H) {
      VIEW_H = BASE_H;
      VIEW_W = Math.min(MAX_W, Math.round((BASE_H * aspect) / 2) * 2);
    } else {
      VIEW_W = BASE_W;
      VIEW_H = Math.min(MAX_H, Math.round(BASE_W / aspect / 2) * 2);
    }
    this.scale = Math.min(w / VIEW_W, h / VIEW_H);
    const cssW = Math.round(VIEW_W * this.scale);
    const cssH = Math.round(VIEW_H * this.scale);
    this.offsetX = Math.floor((w - cssW) / 2);
    this.offsetY = Math.floor((h - cssH) / 2);
    const dpr = window.devicePixelRatio || 1;

    for (const c of [this.displayCanvas, this.uiCanvas]) {
      c.style.width = `${cssW}px`;
      c.style.height = `${cssH}px`;
      c.style.left = `${this.offsetX}px`;
      c.style.top = `${this.offsetY}px`;
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);
    }
    this.lowres.width = VIEW_W;
    this.lowres.height = VIEW_H;
    this.k = Math.max(1, Math.ceil(this.scale * dpr - 0.01));
    this.upscaled.width = VIEW_W * this.k;
    this.upscaled.height = VIEW_H * this.k;
    this.uiScale = this.scale * dpr;
    // Resizing a canvas resets its context state.
    this.game.imageSmoothingEnabled = false;
    this.up.imageSmoothingEnabled = false;
    this.display.imageSmoothingEnabled = true;
    this.display.imageSmoothingQuality = 'medium';
  }

  /** Copy the finished low-res frame to the window. Call once per frame, after drawing. */
  present(): void {
    this.up.drawImage(this.lowres, 0, 0, this.upscaled.width, this.upscaled.height);
    this.display.drawImage(this.upscaled, 0, 0, this.displayCanvas.width, this.displayCanvas.height);
  }

  /** Convert a mouse event's client position to view pixels. */
  toGamePx = (clientX: number, clientY: number): Vec2 => ({
    x: (clientX - this.offsetX) / this.scale,
    y: (clientY - this.offsetY) / this.scale,
  });
}

// ---------------------------------------------------------------- fullscreen

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null && document.fullscreenElement !== undefined;
}

/** Keyboard Lock (Chromium) lets a single Esc reach the game in fullscreen; holding Esc still leaves. */
interface KeyboardLock {
  lock?(codes?: string[]): Promise<void>;
  unlock?(): void;
}

/** Enter or leave fullscreen. Needs a recent key press or click, so call it from input handling. */
export function setFullscreen(on: boolean): void {
  try {
    if (on && !isFullscreen()) {
      const req = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
      void req
        ?.then(() => (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard?.lock?.(['Escape']))
        .catch(() => {
          // Refused (no user gesture, or blocked in an embedded frame): the window-filling view still works.
        });
    } else if (!on && isFullscreen()) {
      (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard?.unlock?.();
      void document.exitFullscreen?.().catch(() => {});
    }
  } catch {
    // Fullscreen isn't available here.
  }
}
