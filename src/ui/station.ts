import type { Input } from '../core/input';
import { VIEW_H, VIEW_W } from '../core/screen';
import { ITEMS, type ItemBag, type ItemId } from '../data/items';
import { RECIPES, type RecipeDef, type RecipeId, type StationId } from '../data/recipes';
import { SKILLS } from '../data/skills';
import { UPGRADES, type UpgradeDef, type UpgradeId } from '../data/upgrades';
import { canBuild, canCraft, gelsToFill, GENERATOR, recipeLocks, STATION_NEEDS, stationRecipes, upgradeLocks, upgradesAt } from '../game/crafting';
import { haveCount, packSlots } from '../game/inventory';
import { capacity, jobProgress, jobsAt } from '../game/production';
import type { ProductionStation, SaveData, Tracked } from '../game/save';
import { CHECK_ICON, hasIcon, LOCK_ICON } from '../render/art/icons';
import type { Hud } from './hud';
import { backPressed, cursor, formatTime, heading, keyHints, ListNav, UI, type Overlay } from './overlay';

type Entry = { kind: 'recipe'; id: RecipeId } | { kind: 'upgrade'; id: UpgradeId };

export interface StationHooks {
  craft(id: RecipeId): void;
  plant(station: ProductionStation, id: RecipeId): void;
  build(id: UpgradeId): void;
  track(t: Tracked | null): void;
  sound(id: 'uiMove' | 'uiSelect' | 'uiDenied' | 'uiBack'): void;
}

const isTimed = (station: StationId | null): station is ProductionStation =>
  station === 'mushroomBed' || station === 'dryingRack' || station === 'boneGrinder';

/** Crafting and building at one spot in the Burrow. Materials come from storage and the pack. */
export class StationOverlay implements Overlay {
  readonly pauses = true;
  done = false;
  private tab: 'make' | 'build';
  private readonly nav = new ListNav(0);
  private readonly recipes: RecipeId[];
  private readonly upgrades: UpgradeId[];
  private t = 0;

  constructor(
    private readonly save: SaveData,
    private readonly title: string,
    private readonly station: StationId | null,
    glyph: string,
    private readonly hooks: StationHooks,
  ) {
    this.recipes = station ? stationRecipes(station) : [];
    this.upgrades = upgradesAt(glyph);
    const needs = station ? STATION_NEEDS[station] : undefined;
    const working = this.recipes.length > 0 && (!needs || save.upgrades.includes(needs));
    this.tab = working || this.upgrades.length === 0 ? 'make' : 'build';
    this.nav.count = this.entries().length;
  }

  private entries(): Entry[] {
    return this.tab === 'make' ? this.recipes.map((id) => ({ kind: 'recipe' as const, id })) : this.upgrades.map((id) => ({ kind: 'upgrade' as const, id }));
  }

  private get hasTabs(): boolean {
    return this.recipes.length > 0 && this.upgrades.length > 0;
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (backPressed(input) || (this.t > 0.2 && input.wasPressed('Tab') && !this.hasTabs)) {
      this.hooks.sound('uiBack');
      this.done = true;
      return;
    }
    if (this.hasTabs && (input.wasPressed('Tab') || input.wasPressed('KeyA') || input.wasPressed('KeyD') || input.wasPressed('ArrowLeft') || input.wasPressed('ArrowRight'))) {
      this.tab = this.tab === 'make' ? 'build' : 'make';
      this.nav.count = this.entries().length;
      this.nav.index = 0;
      this.hooks.sound('uiMove');
    }
    const picked = this.t > 0.15 ? this.nav.update(input, () => this.hooks.sound('uiMove')) : null;
    const entry = this.entries()[this.nav.index];
    if (entry && input.wasPressed('KeyT')) {
      const tracked = this.save.tracked;
      const same = tracked?.kind === entry.kind && tracked.id === entry.id;
      this.hooks.track(same ? null : entry);
      this.hooks.sound('uiSelect');
    }
    if (picked === null) return;
    const e = this.entries()[picked];
    if (e) this.act(e);
  }

  private act(e: Entry): void {
    if (e.kind === 'upgrade') {
      if (canBuild(this.save, e.id, true)) this.hooks.build(e.id);
      else this.hooks.sound('uiDenied');
      return;
    }
    if (isTimed(this.station) && RECIPES[e.id].station === this.station) {
      const full = jobsAt(this.save, this.station).length >= capacity(this.save, this.station);
      if (!full && canCraft(this.save, e.id, true)) this.hooks.plant(this.station, e.id);
      else this.hooks.sound('uiDenied');
      return;
    }
    if (canCraft(this.save, e.id, true)) this.hooks.craft(e.id);
    else this.hooks.sound('uiDenied');
  }

  draw(hud: Hud, time: number): void {
    const w = 404;
    const h = 210;
    const x = Math.round((VIEW_W - w) / 2);
    const y = Math.round((VIEW_H - h) / 2) - 8;
    hud.fade(0.35);
    hud.panel(x, y, w, h);
    heading(hud, this.title.toUpperCase(), x + 10, y + 8, w - 20);
    if (this.hasTabs) {
      const verb = this.station === 'mushroomBed' ? 'GROW' : this.station === 'dryingRack' ? 'DRY' : this.station === 'boneGrinder' ? 'GRIND' : 'MAKE';
      const tabs: ['make' | 'build', string][] = [['make', verb], ['build', 'BUILD']];
      let tx = x + w - 10;
      for (const [id, label] of [...tabs].reverse()) {
        const tw = Math.ceil(hud.measure(label, 7, 'head')) + 10;
        tx -= tw;
        const on = this.tab === id;
        hud.panel(tx, y + 5, tw, 12, on ? 'light' : 'inset');
        hud.text(label, tx + tw / 2, y + 7.5, { font: 'head', size: 7, color: on ? UI.gold : UI.faint, align: 'center' });
        tx -= 3;
      }
    }

    const entries = this.entries();
    const listX = x + 10;
    const listY = y + 26;
    const listW = 150;
    this.nav.beginPlacing();
    entries.forEach((e, i) => {
      const ey = listY + 3 + i * 18;
      this.nav.place({ x: listX, y: ey - 5, w: listW, h: 18 });
      const on = i === this.nav.index;
      if (on) hud.fill(listX, ey - 5, listW, 17, 'rgba(240, 160, 64, 0.12)');
      const name = e.kind === 'recipe' ? (RECIPES[e.id] as RecipeDef).name : (UPGRADES[e.id] as UpgradeDef).name;
      const locked = e.kind === 'recipe' ? recipeLocks(this.save, e.id).length > 0 : upgradeLocks(this.save, e.id).length > 0;
      const built = e.kind === 'upgrade' && this.save.upgrades.includes(e.id);
      const ready = e.kind === 'recipe' ? canCraft(this.save, e.id, true) : canBuild(this.save, e.id, true);
      if (e.kind === 'recipe') hud.icon(RECIPES[e.id].output.item, listX + 1, ey - 4);
      else if (hasIcon(e.id)) hud.icon(e.id, listX + 1, ey - 4);
      else hud.fill(listX + 4, ey - 1, 10, 10, built ? '#5a7a3a' : '#5a5040');
      hud.text(name, listX + 20, ey + 1, { size: 8, color: built ? UI.faint : locked ? UI.dim : on ? UI.text : '#d8d4c4' });
      if (built) hud.sprite(CHECK_ICON, listX + listW - 11, ey + 2);
      else if (locked) hud.sprite(LOCK_ICON, listX + listW - 11, ey + 1);
      else if (ready) hud.fill(listX + listW - 9, ey + 4, 3, 3, UI.gold);
      const tracked = this.save.tracked;
      if (tracked && tracked.kind === e.kind && tracked.id === e.id) hud.text('T', listX + listW - 20, ey + 1, { font: 'head', size: 6, color: UI.warn });
      if (on) cursor(hud, listX - 7, ey + 2, time);
    });
    if (entries.length === 0) hud.text('Nothing to do here yet.', listX, listY, { size: 8, color: UI.dim });

    const e = entries[this.nav.index];
    const dx = x + listW + 22;
    const dw = w - listW - 32;
    hud.panel(dx - 6, y + 22, dw + 6, h - 46, 'inset');
    if (e) this.drawDetail(hud, e, dx, y + 28, dw - 6);
    if (isTimed(this.station) && this.save.upgrades.includes(STATION_NEEDS[this.station]!)) this.drawQueue(hud, this.station, dx, y + h - 70, dw - 6);

    const verb = e?.kind === 'upgrade' ? 'Build' : isTimed(this.station) ? 'Start' : 'Make';
    const hints: [string, string][] = [['E', verb], ['T', 'Track']];
    if (this.hasTabs) hints.push(['TAB', 'Switch']);
    hints.push(['ESC', 'Close']);
    keyHints(hud, hints, x + 10, y + h - 17);
  }

  private drawDetail(hud: Hud, e: Entry, x: number, y: number, w: number): void {
    const isRecipe = e.kind === 'recipe';
    const r: RecipeDef | null = isRecipe ? RECIPES[e.id] : null;
    const u: UpgradeDef | null = isRecipe ? null : UPGRADES[e.id];
    const name = r ? r.name : u!.name;
    const desc = r ? ITEMS[r.output.item].desc : u!.desc;
    hud.text(name, x, y, { size: 8, color: UI.gold });
    let cy = y + 12;
    for (const line of hud.wrap(desc, w, 7)) {
      hud.text(line, x, cy, { size: 7, color: UI.dim });
      cy += 9;
    }
    cy += 4;
    const cost: ItemBag = r ? r.inputs : u!.cost;
    hud.text('NEEDS', x, cy, { font: 'head', size: 6, color: UI.faint });
    cy += 13;
    let cx = x;
    for (const item of Object.keys(cost) as ItemId[]) {
      const need = cost[item] ?? 0;
      const have = haveCount(this.save, item, true);
      const label = `${have}/${need} ${ITEMS[item].name}`;
      const lw = Math.ceil(hud.measure(label, 7)) + 24;
      if (cx + lw > x + w) {
        cx = x;
        cy += 17;
      }
      hud.icon(item, cx, cy - 4);
      hud.text(label, cx + 18, cy + 1, { size: 7, color: have >= need ? UI.good : UI.bad });
      cx += lw;
    }
    if (r?.charge) {
      const label = `${this.save.charge}/${r.charge} Charge`;
      if (cx + hud.measure(label, 7) + 24 > x + w) {
        cx = x;
        cy += 17;
      }
      drawBolt(hud, cx + 5, cy);
      hud.text(label, cx + 18, cy + 1, { size: 7, color: this.save.charge >= r.charge ? UI.good : UI.bad });
    }
    cy += 16;
    const locks = r ? recipeLocks(this.save, e.id as RecipeId) : upgradeLocks(this.save, e.id as UpgradeId);
    if (locks.length > 0 && !(u && this.save.upgrades.includes(e.id as UpgradeId))) {
      hud.text('REQUIRES', x, cy, { font: 'head', size: 6, color: UI.faint });
      cy += 9;
      for (const l of locks) {
        hud.sprite(LOCK_ICON, x, cy);
        hud.text(l, x + 10, cy + 1, { size: 7, color: UI.bad });
        cy += 10;
      }
      cy += 2;
    }
    if (r) {
      hud.text(`Makes ${r.output.qty} ${ITEMS[r.output.item].name}${r.time ? `, in ${formatTime(r.time)}` : ''}  ·  +${r.xp} ${SKILLS[r.skill].name}`, x, cy, { size: 7, color: UI.text });
    } else if (u && this.save.upgrades.includes(e.id as UpgradeId)) {
      hud.text('Built. It looks wonderful.', x, cy, { size: 7, color: UI.good });
    } else if (u) {
      hud.text(u.kind === 'decor' ? 'Decoration' : 'Improvement', x, cy, { size: 7, color: UI.text });
    }
  }

  private drawQueue(hud: Hud, station: ProductionStation, x: number, y: number, w: number): void {
    const jobs = jobProgress(this.save, station);
    const cap = capacity(this.save, station);
    hud.text(`WORKING  ${jobs.length}/${cap}`, x, y, { font: 'head', size: 6, color: UI.faint });
    // Two rows: the count above says how many more are cooking.
    jobs.slice(0, 2).forEach((j, i) => {
      const jy = y + 14 + i * 17;
      const r: RecipeDef = RECIPES[j.job.recipe];
      hud.icon(r.output.item, x, jy - 4);
      hud.bar(x + 19, jy + 2, w - 66, 5, j.frac, j.done ? UI.good : '#c8a040');
      hud.text(j.done ? 'Ready' : formatTime(j.left), x + w, jy, { size: 7, color: j.done ? UI.good : UI.dim, align: 'right' });
    });
    if (jobs.length === 0) hud.text('Idle. Give it something to do.', x, y + 10, { size: 7, color: UI.dim });
  }
}

/** A little lightning bolt: generator charge. */
export function drawBolt(hud: Hud, x: number, y: number): void {
  hud.fill(x + 3, y, 3, 1, '#0a0a08');
  hud.fill(x + 2, y + 1, 3, 2, '#a8f8a0');
  hud.fill(x + 1, y + 3, 5, 1, '#58c078');
  hud.fill(x + 3, y + 4, 2, 2, '#a8f8a0');
  hud.fill(x + 2, y + 6, 2, 2, '#58c078');
}

// ---------------------------------------------------------------- the Slime Generator

export interface GeneratorHooks {
  feed(gels: number): void;
  sound(id: 'uiMove' | 'uiSelect' | 'uiDenied' | 'uiBack'): void;
}

/** Feed the generator Slime Gel. One gel is five charge; it holds twenty. */
export class GeneratorOverlay implements Overlay {
  readonly pauses = true;
  done = false;
  private readonly nav = new ListNav(2);
  private t = 0;

  constructor(private readonly save: SaveData, private readonly hooks: GeneratorHooks) {}

  private get room(): number {
    return gelsToFill(this.save);
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (backPressed(input) || (this.t > 0.2 && input.wasPressed('Tab'))) {
      this.hooks.sound('uiBack');
      this.done = true;
      return;
    }
    const picked = this.t > 0.15 ? this.nav.update(input, () => this.hooks.sound('uiMove')) : null;
    if (picked === null) return;
    const gel = haveCount(this.save, 'slimeGel', true);
    if (this.room <= 0 || gel <= 0) {
      this.hooks.sound('uiDenied');
      return;
    }
    this.hooks.feed(picked === 0 ? 1 : this.room);
  }

  draw(hud: Hud, time: number): void {
    const w = 260;
    const h = 132;
    const x = Math.round((VIEW_W - w) / 2);
    const y = Math.round((VIEW_H - h) / 2) - 8;
    hud.fade(0.35);
    hud.panel(x, y, w, h);
    heading(hud, 'SLIME GENERATOR', x + 10, y + 8, w - 20);
    const charge = this.save.charge;
    drawBolt(hud, x + 12, y + 28);
    hud.text(`CHARGE  ${charge}/${GENERATOR.capacity}`, x + 24, y + 28, { font: 'head', size: 7, color: charge > 0 ? '#a8f8a0' : UI.dim });
    // Four cells, one per gel.
    const cells = GENERATOR.capacity / GENERATOR.perGel;
    for (let i = 0; i < cells; i++) {
      const filled = Math.min(1, Math.max(0, (charge - i * GENERATOR.perGel) / GENERATOR.perGel));
      hud.bar(x + 12 + i * 58, y + 40, 54, 9, filled, '#58c078', '#142a1e');
    }
    const gel = haveCount(this.save, 'slimeGel', true);
    hud.icon('slimeGel', x + 10, y + 53);
    hud.text(`${gel} Slime Gel at hand (pack and storage)`, x + 30, y + 57, { size: 7, color: gel > 0 ? UI.text : UI.bad });
    this.nav.beginPlacing();
    const next = Math.min(GENERATOR.perGel, GENERATOR.capacity - charge);
    const rows = [`Feed 1 gel  (+${next} charge)`, `Fill it up  (${Math.min(this.room, gel)} gel)`];
    rows.forEach((label, i) => {
      const ry = y + 74 + i * 15;
      this.nav.place({ x: x + 8, y: ry - 3, w: w - 16, h: 15 });
      const on = i === this.nav.index;
      if (on) cursor(hud, x + 12, ry + 2, time);
      const able = this.room > 0 && gel > 0;
      hud.text(label, x + 24, ry, { size: 8, color: !able ? UI.faint : on ? UI.text : UI.dim });
    });
    const note = this.room <= 0 ? 'Full. It hums smugly.' : 'Powers Slime Cells, the Slime Shot mod, and the Bone Grinder.';
    hud.text(note, x + 12, y + h - 30, { size: 7, color: UI.dim });
    keyHints(hud, [['E', 'Feed'], ['ESC', 'Close']], x + 10, y + h - 17);
  }
}

// ---------------------------------------------------------------- storage

export interface StorageHooks {
  take(id: ItemId): void;
  deposit(): void;
  sound(id: 'uiMove' | 'uiSelect' | 'uiDenied' | 'uiBack'): void;
}

export class StorageOverlay implements Overlay {
  readonly pauses = true;
  done = false;
  private readonly nav = new ListNav(0);
  private t = 0;

  constructor(private readonly save: SaveData, private readonly hooks: StorageHooks) {}

  private stored(): [ItemId, number][] {
    return (Object.entries(this.save.storage) as [ItemId, number][]).filter(([, n]) => n > 0).sort((a, b) => ITEMS[a[0]].name.localeCompare(ITEMS[b[0]].name));
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (backPressed(input) || (this.t > 0.2 && input.wasPressed('Tab'))) {
      this.hooks.sound('uiBack');
      this.done = true;
      return;
    }
    if (input.wasPressed('KeyQ')) this.hooks.deposit();
    const items = this.stored();
    this.nav.count = items.length;
    const picked = this.t > 0.15 ? this.nav.update(input, () => this.hooks.sound('uiMove')) : null;
    if (picked !== null && items[picked]) this.hooks.take(items[picked][0]);
  }

  draw(hud: Hud, time: number): void {
    const w = 340;
    const h = 196;
    const x = Math.round((VIEW_W - w) / 2);
    const y = Math.round((VIEW_H - h) / 2) - 8;
    hud.fade(0.35);
    hud.panel(x, y, w, h);
    heading(hud, 'STORAGE CRATE', x + 10, y + 8, w - 20);

    hud.text('PACK', x + 10, y + 26, { font: 'head', size: 6, color: UI.faint });
    const slots = packSlots(this.save);
    for (let i = 0; i < slots; i++) {
      const sx = x + 10 + (i % 3) * 26;
      const sy = y + 36 + Math.floor(i / 3) * 26;
      hud.panel(sx, sy, 24, 24, 'inset');
      const s = this.save.pack[i];
      if (s) {
        hud.icon(s.item, sx + 4, sy + 4);
        hud.text(String(s.qty), sx + 22, sy + 15, { size: 7, align: 'right', edge: 'outline' });
      }
    }

    const items = this.stored();
    const lx = x + 104;
    hud.text('STORED', lx, y + 26, { font: 'head', size: 6, color: UI.faint });
    const rows = 8;
    const start = Math.max(0, Math.min(this.nav.index - rows + 2, items.length - rows));
    this.nav.beginPlacing();
    for (let i = 0; i < start; i++) this.nav.place({ x: -99, y: -99, w: 0, h: 0 });
    items.slice(start, start + rows).forEach(([id, n], k) => {
      const i = start + k;
      const ry = y + 39 + k * 17;
      this.nav.place({ x: lx, y: ry - 5, w: w - 114, h: 17 });
      const on = i === this.nav.index;
      if (on) {
        hud.fill(lx, ry - 5, w - 114, 16, 'rgba(240, 160, 64, 0.12)');
        cursor(hud, lx - 7, ry + 1, time);
      }
      hud.icon(id, lx + 1, ry - 4);
      hud.text(ITEMS[id].name, lx + 20, ry, { size: 8, color: on ? UI.text : '#d8d4c4' });
      hud.text(String(n), x + w - 12, ry, { size: 8, color: UI.dim, align: 'right' });
    });
    if (items.length === 0) hud.text('Empty. A crate full of potential.', lx, y + 36, { size: 8, color: UI.dim });
    keyHints(hud, [['Q', 'Store all materials'], ['E', 'Take a stack'], ['ESC', 'Close']], x + 10, y + h - 17);
  }
}
