import type { Vec2 } from './math';

/** Internal resolution. Everything in the world is drawn at this size and scaled up. */
export const VIEW_W = 480;
export const VIEW_H = 270;

/**
 * Two stacked canvases: a low-res game canvas scaled by a whole number (crisp pixels),
 * and a full-resolution UI canvas on top so text stays sharp.
 */
export class Screen {
  readonly game: CanvasRenderingContext2D;
  readonly ui: CanvasRenderingContext2D;
  /** Whole-number scale from game pixels to CSS pixels. */
  scale = 1;
  /** Scale from game pixels to UI canvas pixels (includes devicePixelRatio). */
  uiScale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(private gameCanvas: HTMLCanvasElement, private uiCanvas: HTMLCanvasElement) {
    gameCanvas.width = VIEW_W;
    gameCanvas.height = VIEW_H;
    this.game = gameCanvas.getContext('2d')!;
    this.ui = uiCanvas.getContext('2d')!;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.scale = Math.max(1, Math.floor(Math.min(w / VIEW_W, h / VIEW_H)));
    const cssW = VIEW_W * this.scale;
    const cssH = VIEW_H * this.scale;
    this.offsetX = Math.floor((w - cssW) / 2);
    this.offsetY = Math.floor((h - cssH) / 2);

    for (const c of [this.gameCanvas, this.uiCanvas]) {
      c.style.width = `${cssW}px`;
      c.style.height = `${cssH}px`;
      c.style.left = `${this.offsetX}px`;
      c.style.top = `${this.offsetY}px`;
    }

    const dpr = window.devicePixelRatio || 1;
    this.uiCanvas.width = Math.round(cssW * dpr);
    this.uiCanvas.height = Math.round(cssH * dpr);
    this.uiScale = this.scale * dpr;
    this.game.imageSmoothingEnabled = false;
  }

  /** Convert a mouse event's client position to game-canvas pixels. */
  toGamePx = (clientX: number, clientY: number): Vec2 => ({
    x: (clientX - this.offsetX) / this.scale,
    y: (clientY - this.offsetY) / this.scale,
  });
}
