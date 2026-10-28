import { clamp } from '../core/math';
import { VIEW_H, VIEW_W } from '../core/screen';
import type { ItemId } from '../data/items';
import { ITEM_ICONS } from '../render/art/icons';
import { PAL } from '../render/palette';
import { sprite, type SpriteDef } from '../render/sprites';

export type FontKind = 'body' | 'head';

const FAMILY: Record<FontKind, string> = {
  body: '"Pixelify Sans", ui-monospace, monospace',
  head: 'Silkscreen, "Pixelify Sans", monospace',
};

export interface TextStyle {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  font?: FontKind;
  /** 'shadow' (default) for text on panels, 'outline' for text over the world. */
  edge?: 'shadow' | 'outline' | 'none';
  bold?: boolean;
}

export type PanelStyle = 'dark' | 'paper' | 'wood' | 'inset' | 'light';

interface PanelColors {
  body: string;
  outer: string;
  hi: string;
  lo: string;
  rivet?: string;
}

const PANELS: Record<PanelStyle, PanelColors> = {
  dark: { body: 'rgba(15, 17, 15, 0.93)', outer: '#050605', hi: '#7a7058', lo: '#3a362c', rivet: '#b0a070' },
  paper: { body: '#dccca2', outer: '#3a2e20', hi: '#f0e4c0', lo: '#b09a70' },
  wood: { body: '#5a3e28', outer: '#1a120a', hi: '#8a6440', lo: '#3e2a1a', rivet: '#c8a040' },
  inset: { body: 'rgba(0, 0, 0, 0.42)', outer: 'rgba(0, 0, 0, 0)', hi: '#0a0b0a', lo: '#4e4c40' },
  light: { body: 'rgba(40, 44, 36, 0.95)', outer: '#050605', hi: '#a89870', lo: '#4a4636' },
};

/**
 * Pixelify Sans has an "fi" ligature that reads as "A" at small sizes ("Anished").
 * Canvas text has no portable switch for ligatures, so break them with a zero-width non-joiner.
 */
function noLigatures(str: string): string {
  return str.includes('f') ? str.replace(/f(?=[fil])/g, 'f‌') : str;
}

const HEART = ['.oo...oo.', 'oRRo.oRRo', 'oRWRoRRDo', 'oRRRRRRDo', '.oRRRRDo.', '..oRRDo..', '...oDo...', '....o....'];

/**
 * Drawing helpers in game pixels (0..480 x 0..270), on two layers:
 * `px` is the low-res game canvas (panels, icons, pixel art) and `ui` is the full-resolution
 * canvas on top (text). A panel wipes the text layer under it, so stacked windows layer correctly.
 */
export class Hud {
  private alpha = 1;

  constructor(readonly px: CanvasRenderingContext2D, readonly ui: CanvasRenderingContext2D, private getScale: () => number) {}

  begin(): void {
    this.ui.setTransform(1, 0, 0, 1, 0, 0);
    this.ui.clearRect(0, 0, this.ui.canvas.width, this.ui.canvas.height);
    this.origin(0, 0);
    this.ui.textBaseline = 'top';
    this.ui.imageSmoothingEnabled = false;
    this.setAlpha(1);
  }

  /** Move (0, 0) for everything drawn after this, on both layers. Screens laid out on a centered stage use it. */
  origin(x: number, y: number): void {
    const s = this.getScale();
    this.ui.setTransform(s, 0, 0, s, x * s, y * s);
    this.px.setTransform(1, 0, 0, 1, x, y);
  }

  // ---------------------------------------------------------------- text

  private font(size: number, font: FontKind, bold = false): string {
    return `${bold ? 'bold ' : ''}${size}px ${FAMILY[font]}`;
  }

  text(raw: string, x: number, y: number, style: TextStyle = {}): number {
    const ctx = this.ui;
    const str = noLigatures(raw);
    const size = style.size ?? 8;
    const font = style.font ?? 'body';
    ctx.font = this.font(size, font, style.bold);
    ctx.textAlign = style.align ?? 'left';
    // Small numbers lose their counters under a drop shadow (a 5 reads as an 8), so bare numbers go without.
    const edge = style.edge ?? (/^[\d\s/×+%:.,-]+$/.test(str) ? 'none' : 'shadow');
    if (edge === 'outline') {
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1.4, size * 0.3);
      ctx.strokeStyle = 'rgba(6, 7, 6, 0.92)';
      ctx.strokeText(str, x, y);
    } else if (edge === 'shadow') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillText(str, x + size / 10, y + size / 10);
    }
    ctx.fillStyle = style.color ?? PAL.text;
    ctx.fillText(str, x, y);
    return ctx.measureText(str).width;
  }

  measure(str: string, size = 8, font: FontKind = 'body', bold = false): number {
    this.ui.font = this.font(size, font, bold);
    return this.ui.measureText(noLigatures(str)).width;
  }

  /** Break text into lines no wider than `maxW`. Honors explicit line breaks. */
  wrap(str: string, maxW: number, size = 8, font: FontKind = 'body'): string[] {
    const out: string[] = [];
    for (const para of str.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && this.measure(next, size, font) > maxW) {
          out.push(line);
          line = word;
        } else line = next;
      }
      out.push(line);
    }
    return out;
  }

  setAlpha(a: number): void {
    this.alpha = clamp(a, 0, 1);
    this.ui.globalAlpha = this.alpha;
    this.px.globalAlpha = this.alpha;
  }

  // ---------------------------------------------------------------- pixel layer

  fill(x: number, y: number, w: number, h: number, color: string): void {
    this.px.fillStyle = color;
    this.px.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** Remove any text already drawn in this rectangle. */
  clearText(x: number, y: number, w: number, h: number): void {
    this.ui.clearRect(x, y, w, h);
  }

  /** A framed window. Corners are notched and the edge is bevelled, like a riveted plate. */
  panel(x: number, y: number, w: number, h: number, style: PanelStyle = 'dark'): void {
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);
    const c = PANELS[style];
    const g = this.px;
    g.fillStyle = c.body;
    g.fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle = c.outer;
    g.fillRect(x + 1, y, w - 2, 1);
    g.fillRect(x + 1, y + h - 1, w - 2, 1);
    g.fillRect(x, y + 1, 1, h - 2);
    g.fillRect(x + w - 1, y + 1, 1, h - 2);
    g.fillStyle = c.hi;
    g.fillRect(x + 2, y + 1, w - 4, 1);
    g.fillRect(x + 1, y + 2, 1, h - 4);
    g.fillStyle = c.lo;
    g.fillRect(x + 2, y + h - 2, w - 4, 1);
    g.fillRect(x + w - 2, y + 2, 1, h - 4);
    if (c.rivet && w >= 16 && h >= 12) {
      g.fillStyle = c.rivet;
      for (const [rx, ry] of [[x + 3, y + 3], [x + w - 4, y + 3], [x + 3, y + h - 4], [x + w - 4, y + h - 4]] as const) g.fillRect(rx, ry, 1, 1);
    }
    if (style === 'paper') {
      g.fillStyle = 'rgba(120, 90, 50, 0.18)';
      for (let i = 0; i < (w * h) / 40; i++) {
        const hx = (i * 7919) % (w - 4);
        const hy = (i * 104729) % (h - 4);
        g.fillRect(x + 2 + hx, y + 2 + hy, 1, 1);
      }
    }
    this.clearText(x, y, w, h);
  }

  /** A horizontal divider inside a panel. */
  divider(x: number, y: number, w: number, color = 'rgba(122, 112, 88, 0.6)'): void {
    this.fill(x, y, w, 1, color);
  }

  sprite(def: SpriteDef, x: number, y: number, frame = 0, opts: { flip?: boolean; silhouette?: string } = {}): void {
    sprite(def).draw(this.px, frame, x, y, { ...opts, alpha: this.alpha < 1 ? this.alpha : undefined });
  }

  icon(item: ItemId, x: number, y: number): void {
    this.sprite(ITEM_ICONS[item], x, y);
  }

  /** Pixel hearts, two half-hearts each. A half heart fills its left side. */
  hearts(hp: number, max: number, x: number, y: number, pulse = 0): void {
    const g = this.px;
    for (let i = 0; i < max / 2; i++) {
      const fill = clamp(hp - i * 2, 0, 2);
      const hx = Math.round(x + i * 10);
      const last = fill > 0 && hp - i * 2 <= 2;
      const hy = Math.round(y - (last ? pulse : 0));
      HEART.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          const ch = row[c];
          if (ch === '.' || ch === undefined) continue;
          const full = fill === 2 || (fill === 1 && c <= 4);
          g.fillStyle =
            ch === 'o' ? '#140808'
            : !full ? (ch === 'D' ? '#241616' : '#3a2424')
            : ch === 'W' ? '#ffb8b0'
            : ch === 'D' ? '#a82424'
            : '#e83c3c';
          g.fillRect(hx + c, hy + r, 1, 1);
        }
      });
    }
  }

  /** A keycap with a label in it. Returns its width. */
  key(label: string, x: number, y: number): number {
    const w = Math.max(9, Math.ceil(this.measure(label, 6, 'head')) + 5);
    x = Math.round(x);
    y = Math.round(y);
    const g = this.px;
    g.fillStyle = '#0a0a08';
    g.fillRect(x + 1, y, w - 2, 10);
    g.fillRect(x, y + 1, w, 8);
    g.fillStyle = '#8a8270';
    g.fillRect(x + 1, y + 1, w - 2, 8);
    g.fillStyle = '#d8d0b8';
    g.fillRect(x + 1, y + 1, w - 2, 6);
    g.fillStyle = '#f0ead8';
    g.fillRect(x + 2, y + 1, w - 4, 1);
    this.clearText(x, y, w, 10);
    this.text(label, x + w / 2, y + 1.5, { size: 6, font: 'head', color: '#1c1a14', align: 'center', edge: 'none' });
    return w;
  }

  /** A progress bar. */
  bar(x: number, y: number, w: number, h: number, frac: number, fg: string, bg = '#1a1c18'): void {
    this.fill(x, y, w, h, '#050605');
    this.fill(x + 1, y + 1, w - 2, h - 2, bg);
    const fw = Math.round((w - 2) * clamp(frac, 0, 1));
    if (fw > 0) {
      this.fill(x + 1, y + 1, fw, h - 2, fg);
      this.fill(x + 1, y + 1, fw, 1, 'rgba(255, 255, 255, 0.28)');
    }
  }

  /** A box of lines that sizes itself to its contents. Used for debug info and labels. */
  textBox(lines: { text: string; color?: string; size?: number }[], x: number, y: number, pad = 4): void {
    const lineH = (size: number) => size + 3;
    const w = Math.ceil(Math.max(...lines.map((l) => this.measure(l.text, l.size ?? 7)))) + pad * 2;
    const h = lines.reduce((sum, l) => sum + lineH(l.size ?? 7), 0) + pad * 2 - 2;
    const bx = Math.min(Math.round(x), VIEW_W - w - 2);
    const by = Math.min(Math.round(y), VIEW_H - h - 2);
    this.panel(bx, by, w, h);
    let cy = by + pad;
    for (const l of lines) {
      this.text(l.text, bx + pad, cy, { size: l.size ?? 7, color: l.color ?? PAL.text });
      cy += lineH(l.size ?? 7);
    }
  }

  /** Darken everything drawn so far, both layers, across the whole view. Draw it last for fades. */
  fade(alpha: number, color = '#050605'): void {
    if (alpha <= 0) return;
    const s = this.getScale();
    this.ui.save();
    this.ui.setTransform(s, 0, 0, s, 0, 0);
    this.ui.globalAlpha = clamp(alpha, 0, 1);
    this.ui.fillStyle = color;
    this.ui.fillRect(0, 0, VIEW_W, VIEW_H);
    this.ui.restore();
  }
}
