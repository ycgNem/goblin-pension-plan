import type { Input } from '../core/input';
import { VIEW_H, VIEW_W } from '../core/screen';
import { CHAPTER_1, RETIREMENT_LEDGER } from '../data/charter';
import { MOD_MODES } from '../data/combat';
import { ITEMS, type ItemDef, type ItemId } from '../data/items';
import { HOME_REGION, REGIONS, REGION_IDS, type RegionId } from '../data/regions';
import { levelForXp, SKILL_IDS, SKILL_MAX_LEVEL, SKILLS, xpForLevel } from '../data/skills';
import { isKeyItem, packSlots } from '../game/inventory';
import { isCheckMet, nextCharterStep } from '../game/progress';
import type { SaveData } from '../game/save';
import { BUTTON_ICON, CHECK_ICON, LOCK_ICON } from '../render/art/icons';
import type { Hud } from './hud';
import { backPressed, confirmPressed, keyHints, UI, type Overlay } from './overlay';

export type MenuPage = 'pack' | 'charter' | 'skills' | 'map';
const PAGES: readonly [MenuPage, string][] = [['pack', 'PACK'], ['charter', 'CHARTER'], ['skills', 'SKILLS'], ['map', 'MAP']];

export interface MenuHooks {
  eat(id: ItemId): void;
  equip(id: ItemId | null): void;
  sound(id: 'uiMove' | 'uiSelect' | 'uiDenied' | 'uiBack'): void;
}

const X = 18;
const Y = 14;
const W = VIEW_W - 36;
const H = VIEW_H - 30;

/** The pack, the Charter and Retirement Ledger, skills, and the map. */
export class MenuOverlay implements Overlay {
  readonly pauses = true;
  done = false;
  private page: number;
  private sel = 0;
  private t = 0;

  constructor(private readonly save: SaveData, private readonly region: RegionId, private readonly hooks: MenuHooks, page: MenuPage = 'pack') {
    this.page = PAGES.findIndex(([p]) => p === page);
  }

  /** Everything selectable on the pack page: slots first, then key items. */
  private packEntries(): (ItemId | null)[] {
    const slots: (ItemId | null)[] = Array.from({ length: packSlots(this.save) }, (_, i) => this.save.pack[i]?.item ?? null);
    const keys = (Object.keys(this.save.keyItems) as ItemId[]).filter((id) => (this.save.keyItems[id] ?? 0) > 0);
    return [...slots, ...keys];
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (this.t > 0.15 && (input.wasPressed('Tab') || backPressed(input) || (input.wasPressed('KeyM') && PAGES[this.page]![0] === 'map'))) {
      this.hooks.sound('uiBack');
      this.done = true;
      return;
    }
    const turn = (input.wasPressed('KeyD') || input.wasPressed('ArrowRight') ? 1 : 0) - (input.wasPressed('KeyA') || input.wasPressed('ArrowLeft') ? 1 : 0);
    if (turn !== 0) {
      this.page = (this.page + turn + PAGES.length) % PAGES.length;
      this.sel = 0;
      this.hooks.sound('uiMove');
    }
    for (let i = 0; i < PAGES.length; i++) {
      if (input.wasPressed(`Digit${i + 1}`)) {
        this.page = i;
        this.hooks.sound('uiMove');
      }
    }
    if (input.wasMousePressed(0)) {
      const m = input.mouse;
      PAGES.forEach((_, i) => {
        const tx = X + 10 + i * 64;
        if (m.x >= tx && m.x < tx + 60 && m.y >= Y + 6 && m.y < Y + 20) {
          this.page = i;
          this.hooks.sound('uiMove');
        }
      });
    }
    if (PAGES[this.page]![0] !== 'pack') return;

    const entries = this.packEntries();
    const slots = packSlots(this.save);
    const move = (d: number) => {
      this.sel = (this.sel + d + entries.length) % entries.length;
      this.hooks.sound('uiMove');
    };
    if (input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) move(-1);
    if (input.wasPressed('KeyS') || input.wasPressed('ArrowDown')) move(1);
    if (input.wasMousePressed(0)) {
      const m = input.mouse;
      entries.forEach((_, i) => {
        const r = this.slotRect(i, slots);
        if (m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h) this.sel = i;
      });
    }
    if (confirmPressed(input) || input.wasPressed('KeyF')) {
      const id = entries[this.sel];
      if (!id) return;
      const def = ITEMS[id];
      if (def.category === 'food') this.hooks.eat(id);
      else if (MOD_MODES[id]) this.hooks.equip(this.save.equippedMod === id ? null : id);
      else this.hooks.sound('uiDenied');
    }
  }

  private slotRect(i: number, slots: number): { x: number; y: number; w: number; h: number } {
    if (i < slots) return { x: X + 14 + (i % 3) * 28, y: Y + 40 + Math.floor(i / 3) * 28, w: 26, h: 26 };
    const k = i - slots;
    return { x: X + 14 + k * 22, y: Y + 40 + Math.ceil(slots / 3) * 28 + 22, w: 20, h: 20 };
  }

  draw(hud: Hud, time: number): void {
    hud.fade(0.4);
    hud.panel(X, Y, W, H);
    PAGES.forEach(([, label], i) => {
      const tx = X + 10 + i * 64;
      const on = i === this.page;
      hud.panel(tx, Y + 6, 60, 14, on ? 'light' : 'inset');
      hud.text(label, tx + 30, Y + 9.5, { font: 'head', size: 7, color: on ? UI.gold : UI.faint, align: 'center' });
    });
    hud.sprite(BUTTON_ICON, X + W - 52, Y + 9);
    hud.text(`${this.save.buttons}`, X + W - 40, Y + 9, { size: 8, color: '#f0d070' });
    hud.divider(X + 8, Y + 24, W - 16);
    switch (PAGES[this.page]![0]) {
      case 'pack':
        this.drawPack(hud, time);
        break;
      case 'charter':
        this.drawCharter(hud);
        break;
      case 'skills':
        this.drawSkills(hud);
        break;
      case 'map':
        this.drawMap(hud, time);
        break;
    }
    const hints: [string, string][] = [['A/D', 'Page'], ['TAB', 'Close']];
    if (PAGES[this.page]![0] === 'pack') hints.splice(1, 0, ['W/S', 'Choose']);
    keyHints(hud, hints, X + 10, Y + H - 16);
  }

  private drawPack(hud: Hud, time: number): void {
    const entries = this.packEntries();
    const slots = packSlots(this.save);
    hud.text(`PACK  ${this.save.pack.length}/${slots} slots`, X + 14, Y + 30, { font: 'head', size: 6, color: UI.faint });
    entries.forEach((id, i) => {
      const r = this.slotRect(i, slots);
      const on = i === this.sel;
      hud.panel(r.x, r.y, r.w, r.h, on ? 'light' : 'inset');
      if (on && Math.floor(time * 3) % 2 === 0) hud.fill(r.x + 1, r.y + r.h - 2, r.w - 2, 1, UI.gold);
      if (!id) return;
      hud.icon(id, r.x + Math.floor(r.w / 2) - 5, r.y + Math.floor(r.h / 2) - 6);
      const qty = i < slots ? this.save.pack[i]?.qty ?? 0 : this.save.keyItems[id] ?? 0;
      if (i < slots || qty > 1) hud.text(String(qty), r.x + r.w - 2, r.y + r.h - 10, { size: 7, align: 'right', edge: 'outline' });
      if (this.save.equippedMod === id) hud.fill(r.x + 2, r.y + 2, 3, 3, UI.good);
    });
    if (entries.length > slots) hud.text('KEY ITEMS', X + 14, Y + 40 + Math.ceil(slots / 3) * 28 + 12, { font: 'head', size: 6, color: UI.faint });

    const id = entries[this.sel];
    const dx = X + 120;
    const dw = W - 134;
    hud.panel(dx, Y + 32, dw, 150, 'inset');
    if (!id) {
      hud.text('An empty pocket.', dx + 8, Y + 40, { size: 8, color: UI.dim });
      hud.text('Rubbish is a resource. Go and find some.', dx + 8, Y + 52, { size: 7, color: UI.faint });
      return;
    }
    const def: ItemDef = ITEMS[id];
    hud.icon(id, dx + 8, Y + 40);
    hud.text(def.name, dx + 22, Y + 40, { size: 8, color: UI.gold });
    hud.text(def.category.toUpperCase(), dx + dw - 8, Y + 41, { font: 'head', size: 6, color: UI.faint, align: 'right' });
    let cy = Y + 56;
    for (const l of hud.wrap(def.desc, dw - 16, 8)) {
      hud.text(l, dx + 8, cy, { size: 8, color: UI.text });
      cy += 11;
    }
    cy += 4;
    const facts: [string, string][] = [];
    if (def.heal) facts.push([`Heals ${def.heal / 2} heart${def.heal === 2 ? '' : 's'}.`, UI.good]);
    if (def.common) facts.push(['The Rat Union takes half if you are carried home.', UI.dim]);
    if (isKeyItem(id)) facts.push(['Kept forever. Takes no slot.', UI.dim]);
    if (def.source) facts.push([`Found: ${def.source}`, UI.dim]);
    for (const [f, c] of facts) {
      for (const l of hud.wrap(f, dw - 16, 7)) {
        hud.text(l, dx + 8, cy, { size: 7, color: c });
        cy += 9;
      }
    }
    const action = def.category === 'food' ? 'Eat' : MOD_MODES[id] ? (this.save.equippedMod === id ? 'Unequip' : 'Equip') : null;
    if (action) keyHints(hud, [['E', action]], dx + 8, Y + 166);
  }

  private drawCharter(hud: Hud): void {
    const next = nextCharterStep(this.save);
    hud.text('BURROW CHARTER', X + 14, Y + 32, { font: 'head', size: 8, color: UI.gold });
    hud.text(`Chapter One: ${CHAPTER_1.title}`, X + 14, Y + 45, { size: 8, color: UI.dim });
    CHAPTER_1.steps.forEach((step, i) => {
      const sy = Y + 62 + i * 21;
      const done = isCheckMet(step.check, this.save);
      const current = step === next;
      hud.panel(X + 14, sy, 9, 9, 'inset');
      if (done) hud.sprite(CHECK_ICON, X + 15, sy + 1);
      hud.text(`${i + 1}. ${step.title}`, X + 28, sy, { size: 8, color: done ? UI.faint : current ? UI.text : UI.dim });
      if (current) hud.text(step.objective, X + 28, sy + 10, { size: 7, color: UI.gold });
    });
    const stamped = this.save.flags.charterStamp1 === true;
    hud.text(stamped ? 'STAMP #1: RECOGNIZED WORKSHOP' : 'STAMP #1: NOT YET', X + 14, Y + 192, { font: 'head', size: 6, color: stamped ? UI.good : UI.faint });

    const lx = X + 236;
    hud.panel(lx, Y + 30, W - 250, 178, 'paper');
    hud.text('THE RETIREMENT LEDGER', lx + (W - 250) / 2, Y + 37, { font: 'head', size: 7, color: UI.ink, align: 'center', edge: 'none' });
    const pillarDone = [
      this.save.upgrades.includes('mushroomBed') && this.save.upgrades.includes('dryingRack'),
      this.save.flags.generatorActive === true,
      this.save.upgrades.includes('repairWorkbench') && (this.save.upgrades.includes('dryingRack') || this.save.upgrades.includes('boneGrinder')),
      false,
      false,
      false,
    ];
    RETIREMENT_LEDGER.pillars.forEach((p, i) => {
      const py = Y + 52 + i * 13;
      const locked = p.chapter > 1;
      hud.text(pillarDone[i] ? '[x]' : '[ ]', lx + 8, py, { size: 7, color: UI.ink, edge: 'none' });
      hud.text(p.text, lx + 26, py, { size: 7, color: locked ? '#8a7a60' : UI.ink, edge: 'none' });
      if (locked) hud.sprite(LOCK_ICON, lx + W - 264, py);
    });
    hud.text('personal goals', lx + 8, Y + 128, { size: 7, color: UI.inkDim, edge: 'none' });
    const personal = [
      this.save.upgrades.includes('patchHoles'),
      this.save.upgrades.includes('secondBowl'),
      this.save.upgrades.includes('fewerSprings'),
      this.save.upgrades.includes('tooGrandChair'),
    ];
    // Goals can wrap, so each one starts below the last.
    let py = Y + 139;
    RETIREMENT_LEDGER.personal.forEach((p, i) => {
      hud.text(personal[i] ? '[x]' : '[ ]', lx + 8, py, { size: 7, color: UI.ink, edge: 'none' });
      const lines = hud.wrap(p, W - 290, 7);
      for (const [k, l] of lines.entries()) hud.text(l, lx + 26, py + k * 8, { size: 7, color: UI.ink, edge: 'none' });
      py += Math.max(12, lines.length * 8 + 4);
    });
  }

  private drawSkills(hud: Hud): void {
    SKILL_IDS.forEach((id, i) => {
      const def = SKILLS[id];
      const xp = this.save.skillXp[id] ?? 0;
      const level = levelForXp(xp);
      const y = Y + 32 + i * 38;
      hud.panel(X + 12, y, W - 24, 35, 'inset');
      hud.text(def.name.toUpperCase(), X + 20, y + 5, { font: 'head', size: 7, color: UI.gold });
      hud.text(`LV ${level}`, X + 120, y + 5, { font: 'head', size: 7, color: UI.text });
      const lo = xpForLevel(level);
      const hi = xpForLevel(level + 1);
      const frac = level >= SKILL_MAX_LEVEL ? 1 : (xp - lo) / (hi - lo);
      hud.bar(X + 158, y + 6, 120, 6, frac, '#8ac060');
      hud.text(level >= SKILL_MAX_LEVEL ? 'MAX' : `${xp - lo}/${hi - lo} xp`, X + 284, y + 5, { size: 7, color: UI.dim });
      hud.text(def.desc, X + 20, y + 16, { size: 7, color: UI.dim });
      const next = def.milestones.find((m) => m.level > level);
      const unlocked = def.milestones.filter((m) => m.level <= level).length;
      hud.text(next ? `Next at ${next.level}: ${next.text}` : 'Every Chapter One unlock earned.', X + 20, y + 25, { size: 7, color: next ? UI.text : UI.good });
      hud.text(`${unlocked}/${def.milestones.length} unlocks`, X + W - 20, y + 5, { size: 7, color: UI.faint, align: 'right' });
    });
  }

  private drawMap(hud: Hud, time: number): void {
    const visited = new Set<RegionId>([...this.save.visited, this.region, HOME_REGION]);
    const pos: Record<RegionId, [number, number]> = {
      coop: [X + 60, Y + 50],
      burrow: [X + 60, Y + 130],
      galleries: [X + 190, Y + 90],
      cistern: [X + 320, Y + 90],
      pumpworks: [X + 320, Y + 170],
    };
    const links: { a: RegionId; b: RegionId; crawl: boolean; open: boolean }[] = [];
    for (const a of REGION_IDS) {
      for (const link of Object.values(REGIONS[a].exits)) {
        if (a > link.to) continue;
        const gated = (REGIONS[a].gatedExits ?? []).some((g) => REGIONS[a].exits[g] === link);
        const flag = REGIONS[a].gateFlag;
        const open = !gated || (flag !== undefined && this.save.flags[flag] === true);
        if (links.some((l) => l.a === a && l.b === link.to && l.crawl === !!link.crawl)) continue;
        links.push({ a, b: link.to, crawl: !!link.crawl, open });
      }
    }
    // Shortest open route home, highlighted.
    const route = new Set<string>();
    const prev = new Map<RegionId, RegionId>();
    const queue: RegionId[] = [this.region];
    const seen = new Set<RegionId>([this.region]);
    while (queue.length) {
      const r = queue.shift()!;
      if (r === HOME_REGION) break;
      for (const l of links) {
        if (!l.open) continue;
        const other = l.a === r ? l.b : l.b === r ? l.a : null;
        if (!other || seen.has(other)) continue;
        seen.add(other);
        prev.set(other, r);
        queue.push(other);
      }
    }
    for (let r: RegionId | undefined = HOME_REGION; r && prev.has(r); r = prev.get(r)) route.add([r, prev.get(r)!].sort().join('-'));

    for (const l of links) {
      if (!visited.has(l.a) && !visited.has(l.b)) continue;
      const [ax, ay] = pos[l.a];
      const [bx, by] = pos[l.b];
      const home = route.has([l.a, l.b].sort().join('-'));
      const color = !l.open ? '#4a4638' : home ? UI.gold : '#9a9480';
      const off = l.crawl ? 3 : -3;
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
      for (let i = 0; i <= steps; i++) {
        if (l.crawl && i % 3 === 0) continue;
        if (!l.open && i % 2 === 0) continue;
        const k = i / steps;
        hud.fill(Math.round(ax + (bx - ax) * k), Math.round(ay + (by - ay) * k + off), home ? 2 : 1, home ? 2 : 1, color);
      }
    }
    for (const id of REGION_IDS) {
      const [cx, cy] = pos[id];
      const known = visited.has(id);
      const here = id === this.region;
      hud.panel(cx - 46, cy - 11, 92, 22, here ? 'light' : 'dark');
      hud.text(known ? REGIONS[id].name : '???', cx, cy - 7, { size: 8, color: here ? UI.gold : known ? UI.text : UI.faint, align: 'center' });
      hud.text(known ? (id === HOME_REGION ? 'home' : REGIONS[id].safe ? 'safe' : 'dangerous') : 'unexplored', cx, cy + 2, { size: 6, color: UI.faint, align: 'center' });
      if (here && Math.floor(time * 2) % 2 === 0) hud.text('YOU ARE HERE', cx, cy - 22, { font: 'head', size: 6, color: UI.gold, align: 'center' });
    }
    hud.text('—— passage   - - crawl pipe   · · · shut', X + W - 14, Y + H - 30, { size: 7, color: UI.faint, align: 'right' });
    if (this.region !== HOME_REGION) hud.text('Gold line: the way home.', X + W - 14, Y + H - 40, { size: 7, color: UI.gold, align: 'right' });
  }
}
