import type { Input } from '../core/input';
import { VIEW_H, VIEW_W } from '../core/screen';
import { HATCH_BUYS } from '../data/economy';
import { ITEMS, type ItemId } from '../data/items';
import { packCount } from '../game/inventory';
import type { SaveData } from '../game/save';
import { cantBuy, demandLeft, sellable, sellPrice, shopDesc, shopName, shopStock, type ShopEntry } from '../game/trade';
import { BUTTON_ICON, DECOR_ICONS, LOCK_ICON } from '../render/art/icons';
import { portrait } from '../render/art/portraits';
import type { Hud } from './hud';
import { backPressed, cursor, heading, keyHints, ListNav, UI, type Overlay } from './overlay';

export interface TradeHooks {
  sell(item: ItemId): void;
  buy(entry: ShopEntry): void;
  sound(id: 'uiMove' | 'uiSelect' | 'uiDenied' | 'uiBack'): void;
}

type Tab = 'sell' | 'buy';

const QUIPS = {
  sell: [
    'Processed goods pay. Raw stuff I can find on the floor.',
    'Every one you sell, the next is worth less. That is called a market.',
    'Demand comes back with the bell. So do I.',
  ],
  buy: [
    'Spores, bottles, cloth. All legal-ish.',
    'No refunds. No questions. No spoons.',
    'Decorations, for goblins with standards. Low ones.',
  ],
};

/** Dorrit's Hatch: sell what you made, buy what you can't. */
export class TradeOverlay implements Overlay {
  readonly pauses = true;
  done = false;
  private tab: Tab = 'sell';
  private readonly nav = new ListNav(0);
  private t = 0;

  constructor(private readonly save: SaveData, private readonly hooks: TradeHooks) {
    if (sellable(save).length === 0) this.tab = 'buy';
  }

  private sellList(): ItemId[] {
    // Things that pay first, then the raw materials she takes for a button.
    return sellable(this.save).sort((a, b) => sellPrice(this.save, b) - sellPrice(this.save, a) || ITEMS[a].name.localeCompare(ITEMS[b].name));
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (backPressed(input)) {
      this.hooks.sound('uiBack');
      this.done = true;
      return;
    }
    if (input.wasPressed('Tab') || input.wasPressed('KeyA') || input.wasPressed('KeyD') || input.wasPressed('ArrowLeft') || input.wasPressed('ArrowRight')) {
      this.tab = this.tab === 'sell' ? 'buy' : 'sell';
      this.nav.index = 0;
      this.hooks.sound('uiMove');
    }
    this.nav.count = this.tab === 'sell' ? this.sellList().length : shopStock(this.save).length;
    const picked = this.t > 0.15 ? this.nav.update(input, () => this.hooks.sound('uiMove')) : null;
    if (picked === null) return;
    if (this.tab === 'sell') {
      const item = this.sellList()[picked];
      if (item) this.hooks.sell(item);
    } else {
      const e = shopStock(this.save)[picked];
      if (!e) return;
      if (cantBuy(this.save, e) === null) this.hooks.buy(e);
      else this.hooks.sound('uiDenied');
    }
  }

  draw(hud: Hud, time: number): void {
    const w = 404;
    const h = 214;
    const x = Math.round((VIEW_W - w) / 2);
    const y = Math.round((VIEW_H - h) / 2) - 8;
    hud.fade(0.35);
    hud.panel(x, y, w, h, 'wood');
    heading(hud, "THE HATCH  ·  DORRIT VANE, LICENSED FENCE (UNLICENSED)", x + 10, y + 8, w - 20);
    // Buttons, top right, under the heading.
    hud.sprite(BUTTON_ICON, x + w - 46, y + 24);
    hud.text(String(this.save.buttons), x + w - 35, y + 24, { size: 8, color: '#f0d070' });

    // Tabs.
    const tabs: [Tab, string][] = [['sell', 'SELL'], ['buy', 'BUY']];
    tabs.forEach(([id, label], i) => {
      const on = this.tab === id;
      hud.panel(x + 10 + i * 52, y + 22, 48, 13, on ? 'light' : 'inset');
      hud.text(label, x + 34 + i * 52, y + 25, { font: 'head', size: 7, color: on ? UI.gold : UI.faint, align: 'center' });
    });

    // Dorrit, leaning in the window, with something to say.
    hud.panel(x + 10, y + 40, 52, 52, 'inset');
    hud.px.drawImage(portrait('dorrit', Math.floor(this.t * 6) % 2 === 0 && this.t < 1.2, Math.floor(time * 0.7) % 7 === 0), x + 14, y + 44);
    const quips = QUIPS[this.tab];
    const quip = quips[Math.floor(this.t / 6) % quips.length]!;
    hud.wrap(quip, 52, 7).slice(0, 6).forEach((l, i) => hud.text(l, x + 10, y + 98 + i * 9, { size: 7, color: UI.dim }));

    const lx = x + 72;
    const lw = w - 82;
    this.nav.beginPlacing();
    if (this.tab === 'sell') this.drawSell(hud, lx, y + 42, lw, time);
    else this.drawBuy(hud, lx, y + 42, lw, time);

    const hints: [string, string][] = [['E', this.tab === 'sell' ? 'Sell one' : 'Buy'], ['A/D', this.tab === 'sell' ? 'Buy tab' : 'Sell tab'], ['ESC', 'Close']];
    keyHints(hud, hints, x + 10, y + h - 17);
  }

  private drawSell(hud: Hud, x: number, y: number, w: number, time: number): void {
    const list = this.sellList();
    hud.text('YOUR PACK', x, y, { font: 'head', size: 6, color: UI.faint });
    hud.text('PAYS', x + w - 70, y, { font: 'head', size: 6, color: UI.faint, align: 'right' });
    hud.text('WANTS', x + w - 4, y, { font: 'head', size: 6, color: UI.faint, align: 'right' });
    if (list.length === 0) {
      hud.text('Nothing to sell. Make something, then come back.', x, y + 14, { size: 8, color: UI.dim });
      return;
    }
    const rows = 9;
    const start = Math.max(0, Math.min(this.nav.index - rows + 2, list.length - rows));
    for (let i = 0; i < start; i++) this.nav.place({ x: -99, y: -99, w: 0, h: 0 });
    list.slice(start, start + rows).forEach((id, k) => {
      const i = start + k;
      const ry = y + 12 + k * 15;
      this.nav.place({ x, y: ry - 2, w, h: 15 });
      const on = i === this.nav.index;
      if (on) {
        hud.fill(x, ry - 2, w, 14, 'rgba(240, 160, 64, 0.14)');
        cursor(hud, x - 7, ry + 2, time);
      }
      hud.icon(id, x + 2, ry);
      hud.text(`${ITEMS[id].name}  ×${packCount(this.save, id)}`, x + 16, ry + 1, { size: 8, color: on ? UI.text : '#d8d4c4' });
      const price = sellPrice(this.save, id);
      const processed = HATCH_BUYS[id] !== undefined;
      hud.sprite(BUTTON_ICON, x + w - 82, ry + 1);
      hud.text(String(price), x + w - 70, ry + 1, { size: 8, color: processed && price > 1 ? '#f0d070' : UI.dim, align: 'right' });
      hud.text(processed ? String(demandLeft(this.save, id)) : '-', x + w - 4, ry + 1, { size: 8, color: UI.dim, align: 'right' });
    });
    const sel = list[this.nav.index];
    if (sel && HATCH_BUYS[sel] && demandLeft(this.save, sel) === 0) {
      hud.text('She has enough of those for this shift.', x, y + 12 + Math.min(rows, list.length) * 15 + 2, { size: 7, color: UI.warn });
    }
  }

  private drawBuy(hud: Hud, x: number, y: number, w: number, time: number): void {
    const stock = shopStock(this.save);
    hud.text('ON THE SHELF', x, y, { font: 'head', size: 6, color: UI.faint });
    if (stock.length === 0) {
      hud.text('Sold out. She looks pleased about it.', x, y + 14, { size: 8, color: UI.dim });
      return;
    }
    stock.forEach((e, i) => {
      const ry = y + 12 + i * 15;
      this.nav.place({ x, y: ry - 2, w, h: 15 });
      const on = i === this.nav.index;
      const why = cantBuy(this.save, e);
      if (on) {
        hud.fill(x, ry - 2, w, 14, 'rgba(240, 160, 64, 0.14)');
        cursor(hud, x - 7, ry + 2, time);
      }
      const decor = e.kind === 'decor' ? DECOR_ICONS[e.id] : undefined;
      if (e.kind === 'item') hud.icon(e.id, x + 2, ry);
      else if (decor) hud.sprite(decor, x + 2, ry);
      else hud.fill(x + 3, ry + 1, 8, 8, '#8a6a40');
      hud.text(shopName(e) + (e.kind === 'decor' ? '  (decoration)' : ''), x + 16, ry + 1, { size: 8, color: why ? UI.dim : on ? UI.text : '#d8d4c4' });
      hud.sprite(BUTTON_ICON, x + w - 32, ry + 1);
      hud.text(String(e.price), x + w - 4, ry + 1, { size: 8, color: this.save.buttons >= e.price ? '#f0d070' : UI.bad, align: 'right' });
      if (why && why !== 'Not enough buttons') hud.sprite(LOCK_ICON, x + w - 44, ry + 1);
    });
    const sel = stock[this.nav.index];
    if (sel) {
      const why = cantBuy(this.save, sel);
      const dy = y + 12 + stock.length * 15 + 4;
      hud.text(shopDesc(sel), x, dy, { size: 7, color: UI.dim });
      if (why) hud.text(why, x, dy + 10, { size: 7, color: UI.bad });
    }
  }
}
