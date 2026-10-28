import type { Input } from '../core/input';
import { VIEW_H, VIEW_W } from '../core/screen';
import { EVENTS, type EventId } from '../data/events';
import { ITEMS, type ItemBag, type ItemId } from '../data/items';
import { REGIONS, type RegionId } from '../data/regions';
import { SKILLS, type SkillId } from '../data/skills';
import { GUILD_SURVEY, LETTER, SPEAKERS, UNION_RAT_LINE } from '../data/story';
import { CHECK_ICON } from '../render/art/icons';
import { portrait } from '../render/art/portraits';
import type { Receipt } from '../game/defeat';
import type { Hud } from './hud';
import { backPressed, confirmPressed, formatTime, heading, keyHints, UI, type Overlay } from './overlay';

/** Shared base: a card that closes on confirm (after a short beat, so a held key doesn't skip it). */
abstract class Card implements Overlay {
  readonly pauses = true;
  done = false;
  protected t = 0;

  constructor(private readonly onClose: () => void = () => {}) {}

  update(dt: number, input: Input): void {
    this.t += dt;
    if (this.t > 0.35 && (confirmPressed(input) || backPressed(input) || input.wasMousePressed(0))) this.close();
  }

  protected close(): void {
    if (this.done) return;
    this.done = true;
    this.onClose();
  }

  /** Slides up a few pixels as it opens. */
  protected get rise(): number {
    return Math.round(Math.max(0, 1 - this.t / 0.18) * 8);
  }

  abstract draw(hud: Hud, time: number): void;
}

// ---------------------------------------------------------------- Grubb's letter

export class LetterOverlay extends Card {
  draw(hud: Hud): void {
    const w = 300;
    const x = (VIEW_W - w) / 2;
    const bodies = LETTER.body.map((p) => hud.wrap(p, w - 36, 8));
    const lineCount = bodies.reduce((n, b) => n + b.length, 0);
    const h = 74 + lineCount * 11 + bodies.length * 5 + 26;
    const y = Math.round((VIEW_H - h) / 2) + this.rise;
    hud.fade(0.45);
    hud.panel(x, y, w, h, 'paper');
    hud.text(LETTER.from.toUpperCase(), VIEW_W / 2, y + 9, { font: 'head', size: 6, color: UI.inkDim, align: 'center', edge: 'none' });
    hud.fill(x + 30, y + 19, w - 60, 1, 'rgba(90, 60, 30, 0.35)');
    hud.text(LETTER.heading, VIEW_W / 2, y + 25, { font: 'head', size: 8, color: UI.ink, align: 'center', edge: 'none' });
    let cy = y + 42;
    for (const para of bodies) {
      for (const line of para) {
        hud.text(line, x + 18, cy, { size: 8, color: UI.ink, edge: 'none' });
        cy += 11;
      }
      cy += 5;
    }
    hud.text(`— ${LETTER.signature}`, x + w - 18, cy + 2, { size: 8, color: '#5a2a1a', align: 'right', edge: 'none' });
    hud.text(LETTER.postscript, x + 18, cy + 16, { size: 7, color: UI.inkDim, edge: 'none' });
    // Wax seal.
    const sx = x + 28;
    const sy = cy + 4;
    hud.fill(sx - 4, sy - 3, 9, 7, '#8a1a1a');
    hud.fill(sx - 3, sy - 4, 7, 9, '#8a1a1a');
    hud.fill(sx - 2, sy - 2, 5, 5, '#c03030');
    hud.fill(sx - 1, sy - 1, 1, 1, '#e86060');
    keyHints(hud, [['E', 'Fold it up']], VIEW_W / 2, y + h + 6, 'center');
  }
}

// ---------------------------------------------------------------- the Rat Union's receipt

export class ReceiptOverlay extends Card {
  constructor(private readonly receipt: Receipt, onClose?: () => void) {
    super(onClose);
  }

  draw(hud: Hud, time: number): void {
    const w = 236;
    const feeRows = Math.ceil(this.receipt.fee.length / 2);
    const h = 108 + this.receipt.lines.length * 11 + feeRows * 13;
    const x = Math.round((VIEW_W - w) / 2);
    const y = Math.round((VIEW_H - h) / 2) + this.rise;
    hud.fade(0.5);
    hud.panel(x, y, w, h, 'paper');
    // Perforated top edge.
    for (let i = x + 3; i < x + w - 3; i += 4) hud.fill(i, y + 3, 2, 1, 'rgba(90, 60, 30, 0.35)');
    hud.text(this.receipt.title, VIEW_W / 2, y + 9, { font: 'head', size: 7, color: UI.ink, align: 'center', edge: 'none' });

    const blink = time % 3.1 > 2.95;
    hud.panel(x + 10, y + 22, 44, 44, 'inset');
    hud.px.drawImage(portrait('unionRat', Math.floor(time * 6) % 4 === 0 && this.t < 1.5, blink), x + 12, y + 24);
    const said = hud.wrap(`"${UNION_RAT_LINE.text}"`, w - 74, 8);
    said.forEach((l, i) => hud.text(l, x + 62, y + 28 + i * 11, { size: 8, color: '#5a3a28', edge: 'none' }));
    hud.text(SPEAKERS.unionRat.name, x + 62, y + 30 + said.length * 11, { size: 7, color: UI.inkDim, edge: 'none' });

    let cy = y + 74;
    for (const line of this.receipt.lines.slice(0, -1)) {
      hud.text(line, x + 12, cy, { size: 8, color: UI.ink, edge: 'none' });
      cy += 11;
    }
    this.receipt.fee.forEach((f, i) => {
      const fx = x + 16 + (i % 2) * 108;
      const fy = cy + Math.floor(i / 2) * 13;
      hud.icon(f.item, fx, fy);
      hud.text(`${f.qty} x ${f.name}`, fx + 13, fy + 1, { size: 7, color: '#8a2a1a', edge: 'none' });
    });
    cy += feeRows * 13 + 4;
    hud.text(this.receipt.lines[this.receipt.lines.length - 1] ?? '', VIEW_W / 2, cy, { size: 8, color: UI.inkDim, align: 'center', edge: 'none' });
    hud.fill(x + 24, cy + 20, w - 48, 1, UI.ink);
    hud.text('X', x + 18, cy + 12, { size: 8, color: UI.ink, edge: 'none' });
    keyHints(hud, [['E', 'Sign here']], VIEW_W / 2, y + h + 6, 'center');
  }
}

// ---------------------------------------------------------------- expedition summary

export interface TripReport {
  regions: RegionId[];
  /** Charter steps this trip finished. They come first: they're the point. */
  steps: string[];
  seconds: number;
  items: ItemBag;
  xp: Partial<Record<SkillId, number>>;
  defeated: number;
  /** What the haul moved forward: a name and each material's have/need. */
  progress: { label: string; parts: { item: ItemId; have: number; need: number }[] } | null;
}

export class SummaryOverlay extends Card {
  constructor(private readonly r: TripReport, onClose?: () => void) {
    super(onClose);
  }

  draw(hud: Hud, time: number): void {
    const items = Object.entries(this.r.items).filter(([, n]) => (n ?? 0) > 0) as [ItemId, number][];
    const xp = Object.entries(this.r.xp).filter(([, n]) => (n ?? 0) > 0) as [SkillId, number][];
    const w = 280;
    const itemRows = Math.max(1, Math.ceil(items.length / 3));
    const h = 64 + itemRows * 14 + (xp.length > 0 ? 18 : 0) + (this.r.progress ? 34 : 0) + this.r.steps.length * 12 + 8;
    const x = Math.round((VIEW_W - w) / 2);
    const y = Math.round((VIEW_H - h) / 2) - 10 + this.rise;
    hud.panel(x, y, w, h);
    heading(hud, 'BACK HOME', x + 10, y + 8, w - 20);
    // "Refuse Galleries" is just "Galleries" here, so a long trip still fits on the line.
    const where = this.r.regions.map((r) => REGIONS[r].name.split(' ').at(-1)).join(' · ');
    hud.text(`${where} · ${formatTime(this.r.seconds)}${this.r.defeated ? ` · ${this.r.defeated} defeated` : ''}`, x + w - 10, y + 9, { size: 7, color: UI.dim, align: 'right' });

    let cy = y + 26;
    for (const step of this.r.steps) {
      hud.sprite(CHECK_ICON, x + 12, cy + 1);
      hud.text(`Charter step done: ${step}`, x + 22, cy, { size: 8, color: UI.good });
      cy += 12;
    }
    hud.text('BROUGHT BACK', x + 10, cy, { font: 'head', size: 6, color: UI.dim });
    cy += 11;
    if (items.length === 0) hud.text('Nothing this time. Fresh air, mostly.', x + 12, cy, { size: 8, color: UI.dim });
    items.forEach(([id, n], i) => {
      const ix = x + 12 + (i % 3) * 88;
      const iy = cy + Math.floor(i / 3) * 14;
      const pop = Math.max(0, 1 - (this.t - i * 0.08) / 0.2);
      hud.icon(id, ix, iy - Math.round(pop * 3));
      hud.text(`+${n} ${ITEMS[id].name}`, ix + 13, iy + 1, { size: 7 });
    });
    cy += itemRows * 14 + 4;
    if (xp.length > 0) {
      hud.text(xp.map(([s, n]) => `+${n} ${SKILLS[s].name}`).join('   '), x + 12, cy, { size: 7, color: UI.good });
      cy += 18;
    }
    if (this.r.progress) {
      hud.divider(x + 10, cy - 4, w - 20);
      const ready = this.r.progress.parts.every((p) => p.have >= p.need);
      hud.text(this.r.progress.label, x + 12, cy, { size: 8, color: ready ? UI.gold : UI.text });
      let px = x + 12;
      for (const p of this.r.progress.parts) {
        hud.icon(p.item, px, cy + 11);
        const done = p.have >= p.need;
        const label = `${Math.min(p.have, p.need)}/${p.need}`;
        hud.text(label, px + 12, cy + 12, { size: 7, color: done ? UI.good : UI.bad });
        px += 16 + Math.ceil(hud.measure(label, 7));
        if (done) hud.sprite(CHECK_ICON, px - 3, cy + 13);
        px += 10;
      }
      if (ready && Math.floor(time * 2) % 2 === 0) hud.text('Ready to build!', x + w - 12, cy, { size: 8, color: UI.good, align: 'right' });
    }
    keyHints(hud, [['E', 'Continue']], VIEW_W / 2, y + h + 6, 'center');
  }
}

// ---------------------------------------------------------------- the Activity Board

export interface BoardInfo {
  current: { id: EventId; done: boolean; startsIn: number };
  next: EventId;
  bellIn: number;
  surveyWithdrawn: boolean;
}

export class BoardOverlay extends Card {
  constructor(private readonly info: BoardInfo, onClose?: () => void) {
    super(onClose);
  }

  draw(hud: Hud): void {
    const w = 340;
    const h = 196;
    const x = Math.round((VIEW_W - w) / 2);
    const y = Math.round((VIEW_H - h) / 2) - 6 + this.rise;
    hud.fade(0.4);
    hud.panel(x, y, w, h, 'wood');
    hud.fill(x + 6, y + 18, w - 12, h - 24, '#a87848');
    for (let i = 0; i < 160; i++) hud.fill(x + 7 + ((i * 7919) % (w - 14)), y + 19 + ((i * 6271) % (h - 26)), 1, 1, '#8a5e34');
    hud.text('ACTIVITY BOARD · BELLMARKET UNDERWORKS', VIEW_W / 2, y + 6, { font: 'head', size: 6, color: '#f0d8a8', align: 'center' });

    const note = (nx: number, ny: number, nw: number, title: string, body: string, pin: string, stamp?: { text: string; color: string }) => {
      const lines = hud.wrap(body, nw - 12, 7);
      const nh = 22 + lines.length * 9 + 6;
      hud.panel(nx, ny, nw, nh, 'paper');
      hud.fill(nx + nw / 2 - 1, ny + 2, 3, 3, pin);
      hud.text(title, nx + 6, ny + 7, { font: 'head', size: 6, color: UI.ink, edge: 'none' });
      lines.forEach((l, i) => hud.text(l, nx + 6, ny + 18 + i * 9, { size: 7, color: '#3a2a1a', edge: 'none' }));
      if (stamp) {
        const sw = Math.ceil(hud.measure(stamp.text, 6, 'head')) + 8;
        hud.fill(nx + nw - sw - 4, ny + nh - 13, sw, 10, stamp.color);
        hud.fill(nx + nw - sw - 3, ny + nh - 12, sw - 2, 8, '#f0e8d0');
        hud.text(stamp.text, nx + nw - sw / 2 - 4, ny + nh - 11, { font: 'head', size: 6, color: stamp.color, align: 'center', edge: 'none' });
      }
      return nh;
    };

    const cur = EVENTS[this.info.current.id];
    const status = this.info.current.done ? { text: 'DONE', color: '#5a7a3a' } : this.info.current.startsIn > 0 ? { text: `IN ${formatTime(this.info.current.startsIn)}`, color: '#a04030' } : { text: 'UNDERWAY', color: '#a04030' };
    note(x + 14, y + 26, 150, `THIS SHIFT: ${cur.board.kind}`, cur.board.text, '#c03030', status);
    const nxt = EVENTS[this.info.next];
    note(x + 14, y + 104, 150, `NEXT SHIFT: ${nxt.board.kind}`, nxt.board.text, '#3060c0');
    const surveyH = note(x + 176, y + 26, 150, GUILD_SURVEY.heading, `${GUILD_SURVEY.lines[0]} ${GUILD_SURVEY.lines[1]}`, '#c03030',
      this.info.surveyWithdrawn ? { text: 'WITHDRAWN', color: '#5a7a3a' } : { text: 'PENDING', color: '#a04030' });
    note(x + 176, y + 30 + surveyH, 150, 'WARNING', 'Old Pumpworks closed indefinitely. Unidentified clanking.', '#e0c050');
    hud.text(`Next Shift Bell in ${formatTime(this.info.bellIn)}`, x + w - 12, y + h - 13, { size: 7, color: '#2a1a10', align: 'right', edge: 'none' });
    keyHints(hud, [['E', 'Done']], VIEW_W / 2, y + h + 6, 'center');
  }
}

// ---------------------------------------------------------------- Stamp #1

/** The end of Chapter One: the Charter, every box ticked, and Grubb's stamp coming down. */
export class StampOverlay extends Card {
  private stamped = false;

  constructor(private readonly steps: readonly string[], private readonly onStamp: () => void, onClose?: () => void) {
    super(onClose);
  }

  /** When the stamp lands, in seconds after the card opens. */
  private static readonly AT = 1.6;

  override update(dt: number, input: Input): void {
    this.t += dt;
    if (!this.stamped && this.t >= StampOverlay.AT) {
      this.stamped = true;
      this.onStamp();
    }
    if (this.t > StampOverlay.AT + 1.2 && (confirmPressed(input) || backPressed(input) || input.wasMousePressed(0))) this.close();
  }

  draw(hud: Hud, time: number): void {
    const w = 250;
    const h = 196;
    const x = Math.round((VIEW_W - w) / 2);
    const y = Math.round((VIEW_H - h) / 2) - 6 + this.rise;
    hud.fade(0.6);
    hud.panel(x, y, w, h, 'paper');
    hud.text('GOBLIN COOPERATIVE · OFFICE OF BURROW CHARTERS', VIEW_W / 2, y + 9, { font: 'head', size: 5, color: UI.inkDim, align: 'center', edge: 'none' });
    hud.text('BURROW CHARTER', VIEW_W / 2, y + 20, { font: 'head', size: 11, color: UI.ink, align: 'center', edge: 'none' });
    hud.fill(x + 30, y + 35, w - 60, 1, 'rgba(90, 60, 30, 0.35)');
    this.steps.forEach((label, i) => {
      const ly = y + 44 + i * 15;
      hud.fill(x + 20, ly, 9, 9, '#6a5440');
      hud.fill(x + 21, ly + 1, 7, 7, '#e8dcb8');
      // Ticks go in one after another before the stamp comes down.
      if (this.t > 0.15 + i * 0.18) hud.sprite(CHECK_ICON, x + 21, ly + 2);
      hud.text(label, x + 34, ly + 1, { size: 8, color: '#3a2a1a', edge: 'none' });
    });
    hud.text('Registrar: Grubb (his mark)', x + 20, y + h - 40, { size: 8, color: UI.inkDim, edge: 'none' });

    if (this.t >= StampOverlay.AT - 0.12) {
      const k = Math.min(1, (this.t - (StampOverlay.AT - 0.12)) / 0.12);
      const s = 1 + (1 - k) * 1.8;
      const ui = hud.ui;
      ui.save();
      ui.translate(x + w - 70, y + h - 46);
      ui.rotate(-0.16);
      ui.scale(s, s);
      ui.globalAlpha = k;
      ui.strokeStyle = '#2a7a2a';
      ui.lineWidth = 2;
      ui.strokeRect(-50, -15, 100, 30);
      ui.lineWidth = 1;
      ui.strokeRect(-46, -11, 92, 22);
      ui.font = '9px Silkscreen, monospace';
      ui.fillStyle = '#2a7a2a';
      ui.textAlign = 'center';
      ui.textBaseline = 'middle';
      ui.fillText('RECOGNIZED', 0, -3);
      ui.font = '6px Silkscreen, monospace';
      ui.fillText('WORKSHOP · STAMP #1', 0, 6);
      ui.restore();
    }
    if (this.t > StampOverlay.AT + 0.6) {
      hud.text('The Guild survey is withdrawn. Premises are not "content".', VIEW_W / 2, y + h + 6, { size: 8, color: UI.gold, align: 'center', edge: 'outline' });
      if (Math.floor(time * 2) % 2 === 0 || this.t > StampOverlay.AT + 2) keyHints(hud, [['E', 'Continue']], VIEW_W / 2, y + h + 20, 'center');
    }
  }
}
