import { VIEW_H, VIEW_W } from '../core/screen';
import type { ItemId } from '../data/items';
import { PAL } from '../render/palette';
import type { Hud } from './hud';

const LIFE = 3;
const MAX = 5;

interface Toast {
  text: string;
  color: string;
  icon?: ItemId;
  t: number;
  /** Repeats of the same message fold into one, with a count. */
  key?: string;
  qty?: number;
}

/** Short messages stacked above the bottom of the screen: pickups, level-ups, and so on. */
export class Toasts {
  private items: Toast[] = [];

  push(text: string, color: string = PAL.text, icon?: ItemId): void {
    // Saying the same thing again just keeps the one already up.
    const same = this.items.find((t) => !t.key && t.text === text);
    if (same) {
      same.t = Math.min(same.t, 0.2);
      return;
    }
    this.items.push({ text, color, icon, t: 0 });
    if (this.items.length > MAX) this.items.shift();
  }

  /** "+3 Scrap Metal": picking up more of the same item soon after adds to the same toast. */
  item(id: ItemId, qty: number, name: string): void {
    const key = `item:${id}`;
    const existing = this.items.find((t) => t.key === key && t.t < LIFE - 0.6);
    if (existing) {
      existing.qty = (existing.qty ?? 0) + qty;
      existing.text = `+${existing.qty} ${name}`;
      existing.t = Math.min(existing.t, 0.3);
      return;
    }
    this.items.push({ text: `+${qty} ${name}`, color: PAL.text, icon: id, t: 0, key, qty });
    if (this.items.length > MAX) this.items.shift();
  }

  update(dt: number): void {
    for (const t of this.items) t.t += dt;
    this.items = this.items.filter((t) => t.t < LIFE);
  }

  /** Stacked up the right-hand side, newest at the bottom, so the middle stays clear for story captions. */
  draw(hud: Hud): void {
    let y = VIEW_H - 32;
    const right = VIEW_W - 8;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const toast = this.items[i]!;
      const a = Math.min(1, (LIFE - toast.t) / 0.5, toast.t / 0.12);
      // New toasts slide in from the edge.
      const slide = Math.round((1 - Math.min(1, toast.t / 0.15)) * 12);
      hud.setAlpha(a);
      const w = hud.measure(toast.text, 8);
      if (toast.icon) hud.icon(toast.icon, Math.round(right - w - 14 + slide), Math.round(y) - 1);
      hud.text(toast.text, right + slide, y, { size: 8, color: toast.color, edge: 'outline', align: 'right' });
      y -= 12;
    }
    hud.setAlpha(1);
  }
}
