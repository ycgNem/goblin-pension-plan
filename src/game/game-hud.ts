import { actionLabel } from '../core/keys';
import { clamp } from '../core/math';
import { VIEW_H, VIEW_W } from '../core/screen';
import { SHIFT_SECONDS } from '../data/economy';
import { ITEMS, type ItemBag, type ItemDef, type ItemId } from '../data/items';
import { RECIPES, type RecipeDef } from '../data/recipes';
import { HINTS, type HintId } from '../data/story';
import { UPGRADES } from '../data/upgrades';
import type { View } from '../render/lighting';
import { PAL } from '../render/palette';
import { BUTTON_ICON, CHECK_ICON } from '../render/art/icons';
import type { Hud } from '../ui/hud';
import { formatTime, keyHints, UI } from '../ui/overlay';
import type { FloatText } from './effects';
import { haveCount } from './inventory';
import type { SaveData } from './save';
import type { Bubble } from './scene';

// The in-game HUD: hearts, the pinned objective, a tracked recipe, prompts, speech bubbles,
// banners, warnings, and hints. Everything here only reads state.

export interface BigBanner {
  kicker: string;
  title: string;
  sub?: string;
  color: string;
  t: number;
  life: number;
}

/** Timed announcements, one big banner at a time. */
export class Banners {
  private queue: BigBanner[] = [];
  region: { name: string; subtitle: string; t: number } | null = null;
  caption: { text: string; t: number; life: number } | null = null;
  warning: { text: string; t: number; life: number } | null = null;
  hint: { id: HintId; t: number; life: number } | null = null;

  big(kicker: string, title: string, color: string, sub?: string, life = 3.2): void {
    this.queue.push({ kicker, title, sub, color, t: 0, life });
  }

  get busy(): boolean {
    return this.queue.length > 0;
  }

  update(dt: number): void {
    // A big banner waits for the region name to clear, so the two never stack.
    const b = this.region ? undefined : this.queue[0];
    if (b) {
      b.t += dt;
      if (b.t >= b.life) this.queue.shift();
    }
    if (this.region && (this.region.t += dt) > 2.8) this.region = null;
    if (this.caption && (this.caption.t += dt) > this.caption.life) this.caption = null;
    if (this.warning && (this.warning.t += dt) > this.warning.life) this.warning = null;
    if (this.hint && (this.hint.t += dt) > this.hint.life) this.hint = null;
  }

  /** `quiet` while a window is open: only the big announcements show. */
  draw(hud: Hud, quiet = false): void {
    if (this.region && !quiet) {
      const r = this.region;
      const a = clamp(r.t / 0.3, 0, 1) * clamp((2.8 - r.t) / 0.6, 0, 1);
      hud.setAlpha(a);
      const y = 40 - (1 - a) * 3;
      hud.text(r.name.toUpperCase(), VIEW_W / 2, y, { font: 'head', size: 16, align: 'center', edge: 'outline', color: '#f0ead8' });
      hud.fill(VIEW_W / 2 - 50, y + 20, 100, 1, 'rgba(240, 160, 64, 0.7)');
      hud.text(r.subtitle, VIEW_W / 2, y + 25, { size: 8, align: 'center', edge: 'outline', color: PAL.textDim });
      hud.setAlpha(1);
    }
    const b = this.region ? undefined : this.queue[0];
    if (b) {
      const a = clamp(b.t / 0.25, 0, 1) * clamp((b.life - b.t) / 0.5, 0, 1);
      const pop = 1 - clamp(b.t / 0.18, 0, 1);
      hud.setAlpha(a);
      const w = Math.max(hud.measure(b.title, 12, 'head'), hud.measure(b.sub ?? '', 8)) + 40;
      const x = Math.round(VIEW_W / 2 - w / 2);
      const y = Math.round(64 - pop * 6);
      hud.panel(x, y, w, b.sub ? 44 : 34);
      hud.fill(x + 3, y + 3, w - 6, 1, b.color);
      hud.text(b.kicker, VIEW_W / 2, y + 6, { font: 'head', size: 6, align: 'center', color: b.color });
      hud.text(b.title, VIEW_W / 2, y + 15, { font: 'head', size: 12, align: 'center', color: '#f8f2e0' });
      if (b.sub) hud.text(b.sub, VIEW_W / 2, y + 31, { size: 8, align: 'center', color: UI.dim });
      hud.setAlpha(1);
    }
    if (this.warning) {
      const w = this.warning;
      const a = clamp(w.t / 0.3, 0, 1) * clamp((w.life - w.t) / 0.5, 0, 1);
      hud.setAlpha(a);
      const tw = hud.measure(w.text, 8) + 30;
      const x = Math.round(VIEW_W / 2 - tw / 2);
      hud.panel(x, 4, tw, 16);
      hud.fill(x + 2, 6, 3, 12, Math.floor(w.t * 4) % 2 === 0 ? '#e05040' : '#7a2a20');
      hud.fill(x + tw - 5, 6, 3, 12, Math.floor(w.t * 4) % 2 === 0 ? '#e05040' : '#7a2a20');
      hud.text(w.text, VIEW_W / 2, 8, { size: 8, align: 'center', color: '#f0c8a0' });
      hud.setAlpha(1);
    }
    if (this.caption && !quiet) {
      const c = this.caption;
      const a = clamp(c.t / 0.6, 0, 1) * clamp((c.life - c.t) / 0.8, 0, 1);
      hud.setAlpha(a);
      const lines = hud.wrap(c.text, 320, 8);
      lines.forEach((l, i) => hud.text(l, VIEW_W / 2, VIEW_H - 64 + i * 11, { size: 8, align: 'center', edge: 'outline', color: '#e8dcc0' }));
      hud.setAlpha(1);
    }
    if (this.hint && !quiet) {
      const h = this.hint;
      const def = HINTS[h.id];
      const a = clamp(h.t / 0.3, 0, 1) * clamp((h.life - h.t) / 0.5, 0, 1);
      hud.setAlpha(a);
      const labels = def.keys.map((k) => (k === 'LMB' ? k : actionLabel(k)));
      const keysW = labels.reduce((sum, k) => sum + Math.max(9, Math.ceil(hud.measure(k, 6, 'head')) + 5) + 2, 0);
      const w = keysW + hud.measure(def.text, 8) + 20;
      const x = 6;
      const y = VIEW_H - 24;
      hud.panel(x, y, w, 18, 'light');
      let kx = x + 6;
      for (const k of labels) kx += hud.key(k, kx, y + 4) + 2;
      hud.text(def.text, kx + 4, y + 5, { size: 8 });
      hud.setAlpha(1);
    }
  }
}

/** Where a HUD panel sits, in view pixels. */
export interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function drawObjective(hud: Hud, title: string, text: string, done: number, total: number, flash: number): PanelRect {
  const w = Math.max(hud.measure(text, 8), 110) + 14;
  hud.panel(4, 16, w, 26);
  if (flash > 0) hud.fill(5, 17, w - 2, 24, `rgba(240, 192, 64, ${flash * 0.25})`);
  hud.text(title, 10, 20, { font: 'head', size: 6, color: UI.gold });
  if (total > 0) hud.text(`${done}/${total}`, w - 2, 20, { font: 'head', size: 6, color: UI.dim, align: 'right' });
  hud.text(text, 10, 29, { size: 8 });
  return { x: 4, y: 16, w, h: 26 };
}

/** The pinned recipe or upgrade: what it needs, what you have, and where to find the rest. */
export function drawTracked(hud: Hud, save: SaveData): PanelRect | null {
  const t = save.tracked;
  if (!t) return null;
  const r: RecipeDef | null = t.kind === 'recipe' ? RECIPES[t.id] : null;
  const name = r ? r.name : UPGRADES[t.id as keyof typeof UPGRADES].name;
  const cost: ItemBag = r ? r.inputs : UPGRADES[t.id as keyof typeof UPGRADES].cost;
  const items = Object.keys(cost) as ItemId[];
  const h = 18 + items.length * 17;
  const w = 150;
  const y = 46;
  hud.panel(4, y, w, h);
  hud.text(`TRACKING: ${name}`, 10, y + 4, { font: 'head', size: 6, color: UI.warn });
  items.forEach((id, i) => {
    const need = cost[id] ?? 0;
    const have = haveCount(save, id, true);
    const iy = y + 18 + i * 17;
    hud.icon(id, 7, iy - 4);
    const done = have >= need;
    hud.text(`${Math.min(have, need)}/${need}`, 26, iy, { size: 7, color: done ? UI.good : UI.bad });
    if (done) hud.sprite(CHECK_ICON, 49, iy + 1);
    else hud.text((ITEMS[id] as ItemDef).source ?? ITEMS[id].name, 49, iy, { size: 7, color: UI.dim });
  });
  return { x: 4, y, w, h };
}

export function drawHearts(hud: Hud, hp: number, max: number, time: number): void {
  const low = hp <= 2;
  const pulse = low ? Math.max(0, Math.sin(time * 7)) * 1.5 : 0;
  hud.hearts(hp, max, 6, 5, pulse);
}

/** What the throw key throws, beside the hearts: a pebble is free, everything else shows how many are left. Returns its right edge. */
export function drawThrowable(hud: Hud, kind: 'pebble' | 'bottle' | 'stinkbrew', count: number, x: number): number {
  const y = 3;
  const kx = x + hud.key(actionLabel('throw'), x, y) + 3;
  if (kind === 'pebble') {
    hud.fill(kx + 2, y + 4, 3, 3, '#a8a090');
    hud.fill(kx + 3, y + 3, 2, 1, '#c8c0b0');
    hud.text('pebble', kx + 8, y + 1, { size: 7, color: UI.faint, edge: 'outline' });
    return kx + 8 + Math.ceil(hud.measure('pebble', 7));
  }
  hud.icon(kind, kx - 2, y - 3);
  const label = `×${count}`;
  hud.text(label, kx + 15, y + 1, { size: 7, color: kind === 'stinkbrew' ? '#c8e070' : UI.text, edge: 'outline' });
  return kx + 15 + Math.ceil(hud.measure(label, 7));
}

/** The launcher mod that's on, after the throwable. */
export function drawMod(hud: Hud, mod: ItemId, x: number): void {
  hud.icon(mod, x, 0);
  hud.text(ITEMS[mod].name, x + 17, 4, { size: 7, color: '#b8d8f0', edge: 'outline' });
}

export function drawButtons(hud: Hud, buttons: number): void {
  if (buttons <= 0) return;
  hud.sprite(BUTTON_ICON, VIEW_W - 44, 5);
  hud.text(String(buttons), VIEW_W - 34, 5, { size: 8, color: '#f0d070', edge: 'outline' });
}

/** A small bell and the time until the next Shift Bell. */
export function drawShiftClock(hud: Hud, playTime: number): void {
  const left = SHIFT_SECONDS - (playTime % SHIFT_SECONDS);
  const urgent = left < 30;
  hud.fill(VIEW_W - 79, 18, 5, 4, urgent ? '#f0c040' : '#a89060');
  hud.fill(VIEW_W - 80, 22, 7, 1, urgent ? '#f0c040' : '#a89060');
  hud.text(`Bell ${formatTime(left)}`, VIEW_W - 70, 16, { size: 7, color: urgent ? UI.warn : UI.faint, edge: 'outline' });
}

/** "[E] Search Junk pile", over whatever you'd interact with. Holding shows a progress ring. */
export function drawPrompt(hud: Hud, view: View, x: number, y: number, verb: string, label: string, progress: number, locked: string | null): void {
  const sx = Math.round(x - view.x);
  const sy = Math.round(y - view.y);
  const text = locked ?? `${verb} ${label}`;
  const tw = Math.ceil(hud.measure(text, 7));
  const w = tw + (locked ? 10 : 20);
  const px = clamp(sx - Math.round(w / 2), 2, VIEW_W - w - 2);
  const py = clamp(sy - 32, 2, VIEW_H - 16);
  hud.panel(px, py, w, 14, locked ? 'dark' : 'light');
  if (!locked) hud.key('E', px + 3, py + 2);
  hud.text(text, px + (locked ? 5 : 15), py + 3, { size: 7, color: locked ? UI.bad : UI.text });
  if (progress > 0) {
    // A ring of pixels filling clockwise around the spot.
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
      const on = i / steps < progress;
      hud.fill(sx + Math.round(Math.cos(a) * 9), sy - 6 + Math.round(Math.sin(a) * 9), on ? 2 : 1, on ? 2 : 1, on ? UI.gold : 'rgba(255, 255, 255, 0.3)');
    }
  }
}

export function drawBubbles(hud: Hud, view: View, bubbles: readonly Bubble[]): void {
  for (const b of bubbles) {
    const a = clamp(b.t / 0.15, 0, 1) * clamp((b.life - b.t) / 0.3, 0, 1);
    hud.setAlpha(a);
    const lines = hud.wrap(b.text, 120, 7);
    const w = Math.ceil(Math.max(...lines.map((l) => hud.measure(l, 7)))) + 10;
    const h = lines.length * 9 + 6;
    const x = clamp(Math.round(b.x - view.x - w / 2), 2, VIEW_W - w - 2);
    const y = clamp(Math.round(b.y - view.y - 40 - h), 2, VIEW_H - h - 2);
    hud.fill(x + 1, y, w - 2, h, '#f4eee0');
    hud.fill(x, y + 1, w, h - 2, '#f4eee0');
    hud.fill(x + 1, y + h, w - 2, 1, '#8a8070');
    const tx = clamp(Math.round(b.x - view.x), x + 4, x + w - 5);
    hud.fill(tx - 1, y + h, 3, 2, '#f4eee0');
    hud.fill(tx, y + h + 2, 1, 1, '#f4eee0');
    hud.clearText(x, y, w, h);
    lines.forEach((l, i) => hud.text(l, x + 5, y + 3 + i * 9, { size: 7, color: '#2a2018', edge: 'none' }));
  }
  hud.setAlpha(1);
}

export function drawDamageNumbers(hud: Hud, view: View, texts: readonly FloatText[], life: number): void {
  for (const t of texts) {
    const k = t.t / life;
    hud.setAlpha(1 - k * k);
    hud.text(t.text, t.x - view.x, t.y - view.y - k * 10, { size: 8, color: t.color, align: 'center', edge: 'outline', font: 'head' });
  }
  hud.setAlpha(1);
}

/** An arrow at the screen edge pointing toward the way home, when it's off screen. */
export function drawHomeArrow(hud: Hud, view: View, tx: number, ty: number, time: number): void {
  const sx = tx - view.x;
  const sy = ty - view.y;
  if (sx > 8 && sy > 8 && sx < VIEW_W - 8 && sy < VIEW_H - 8) return;
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const ex = clamp(cx + Math.cos(a) * 400, 12, VIEW_W - 12);
  const ey = clamp(cy + Math.sin(a) * 400, 30, VIEW_H - 30);
  const pulse = 0.6 + 0.4 * Math.sin(time * 4);
  hud.setAlpha(pulse);
  for (let i = 0; i < 6; i++) {
    const back = i;
    const spread = Math.floor(i / 1.5);
    for (let s = -spread; s <= spread; s++) {
      hud.fill(Math.round(ex - Math.cos(a) * back - Math.sin(a) * s), Math.round(ey - Math.sin(a) * back + Math.cos(a) * s), 1, 1, UI.gold);
    }
  }
  hud.text('home', ex - Math.cos(a) * 14, ey - Math.sin(a) * 14 - 4, { size: 6, align: 'center', color: UI.gold, edge: 'outline' });
  hud.setAlpha(1);
}

export function drawControlsStrip(hud: Hud): void {
  keyHints(hud, [[actionLabel('pack'), 'Pack'], [actionLabel('pause'), 'Pause']], VIEW_W - 4, VIEW_H - 13, 'right');
}

/** A boss's health along the bottom of the screen, with a notch where its second phase starts. */
export function drawBossBar(hud: Hud, name: string, hp: number, max: number, phase2At: number, time: number, flash: boolean): void {
  const w = 220;
  const x = Math.round(VIEW_W / 2 - w / 2);
  const y = VIEW_H - 34;
  hud.text(name.toUpperCase(), VIEW_W / 2, y - 10, { font: 'head', size: 7, color: '#f0c0a0', align: 'center', edge: 'outline' });
  const frac = clamp(hp / max, 0, 1);
  hud.bar(x, y, w, 7, frac, flash && Math.floor(time * 16) % 2 === 0 ? '#ffffff' : frac <= phase2At ? '#e05030' : '#c84a2a', '#2a1210');
  hud.fill(x + Math.round(w * phase2At), y - 1, 1, 9, '#f0d070');
}
