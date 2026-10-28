import type { Input } from '../core/input';
import { PAL } from '../render/palette';
import type { Hud } from './hud';

/** A window over the game: dialogue, menus, cards. The top one gets the input. */
export interface Overlay {
  /** Freeze the world while this is open. */
  readonly pauses: boolean;
  /** Set to close it. */
  done: boolean;
  update(dt: number, input: Input): void;
  draw(hud: Hud, time: number): void;
}

export const UI = {
  gold: PAL.homeGlow,
  text: PAL.text,
  dim: PAL.textDim,
  faint: '#6a6858',
  good: '#8ae05a',
  bad: '#e8806a',
  warn: PAL.warn,
  ink: '#2a1a10',
  inkDim: '#6a5440',
} as const;

export const confirmPressed = (input: Input): boolean =>
  input.wasPressed('KeyE') || input.wasPressed('Enter') || input.wasPressed('Space') || input.wasPressed('NumpadEnter');

export const backPressed = (input: Input): boolean => input.wasPressed('Escape') || input.wasMousePressed(2);

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/**
 * Keyboard and mouse navigation for a vertical list. Call `update` each tick with last frame's
 * item rectangles (record them while drawing with `place`).
 */
export class ListNav {
  index = 0;
  private rects: Rect[] = [];
  private lastMouse = { x: -1, y: -1 };

  constructor(public count: number) {}

  /** Returns the index picked this tick (keyboard or click), or null. */
  update(input: Input, onMove?: () => void): number | null {
    if (this.count <= 0) return null;
    const before = this.index;
    if (input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) this.index = (this.index - 1 + this.count) % this.count;
    if (input.wasPressed('KeyS') || input.wasPressed('ArrowDown')) this.index = (this.index + 1) % this.count;
    const m = input.mouse;
    const moved = m.x !== this.lastMouse.x || m.y !== this.lastMouse.y;
    this.lastMouse = { x: m.x, y: m.y };
    const hover = this.rects.findIndex((r) => inRect(r, m.x, m.y));
    if (hover >= 0 && moved) this.index = hover;
    this.index = Math.min(this.index, this.count - 1);
    if (this.index !== before) onMove?.();
    if (hover >= 0 && input.wasMousePressed(0)) return hover;
    if (confirmPressed(input)) return this.index;
    return null;
  }

  beginPlacing(): void {
    this.rects = [];
  }

  place(r: Rect): void {
    this.rects.push(r);
  }
}

/** A heading with a rule under it. */
export function heading(hud: Hud, text: string, x: number, y: number, w: number, color: string = UI.gold): void {
  hud.text(text, x, y, { font: 'head', size: 8, color });
  hud.divider(x, y + 11, w);
}

/** A row of [key] label hints. Returns the total width. */
export function keyHints(hud: Hud, items: readonly (readonly [string, string])[], x: number, y: number, align: 'left' | 'right' | 'center' = 'left'): number {
  const widths = items.map(([k, label]) => Math.max(9, Math.ceil(hud.measure(k, 6, 'head')) + 5) + 3 + Math.ceil(hud.measure(label, 7)) + 9);
  const total = widths.reduce((a, b) => a + b, 0) - 9;
  let cx = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
  items.forEach(([k, label], i) => {
    const kw = hud.key(k, cx, y);
    hud.text(label, cx + kw + 3, y + 1, { size: 7, color: UI.dim });
    cx += widths[i]!;
  });
  return total;
}

/** A selection marker: a little pointing hand made of pixels. */
export function cursor(hud: Hud, x: number, y: number, time: number): void {
  const bob = Math.round(Math.sin(time * 8));
  hud.fill(x + bob, y + 2, 4, 1, UI.gold);
  hud.fill(x + bob + 1, y + 1, 2, 3, UI.gold);
  hud.fill(x + bob + 3, y, 1, 5, UI.gold);
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
