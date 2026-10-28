import { describe, expect, it } from 'vitest';
import { CHAPTER_1, ORDERS } from '../src/data/charter';
import { LAUNCHER_MODES, MOD_MODES } from '../src/data/combat';
import { HATCH_BUYS, HATCH_SELLS, hatchPrice, RAW_SELL_PRICE } from '../src/data/economy';
import { CREATURES, HUMANS, type CreatureDef } from '../src/data/enemies';
import { FLAGS } from '../src/data/flags';
import { ITEMS, ITEM_IDS, type ItemBag, type ItemId } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { levelForXp, SKILLS, SKILL_MAX_LEVEL, xpForLevel } from '../src/data/skills';
import { UPGRADES } from '../src/data/upgrades';
import { BURROW_MAP } from '../src/world/maps/burrow';
import { SPAWN_GLYPHS, TERRAIN_GLYPHS } from '../src/world/tiles';

const isItem = (id: string): boolean => id in ITEMS;
const bagItems = (bag: ItemBag): string[] => Object.keys(bag);

describe('items', () => {
  it('have short descriptions', () => {
    for (const id of ITEM_IDS) expect(ITEMS[id].desc.length, id).toBeLessThanOrEqual(80);
  });

  it('quest items are never common (never lost on defeat)', () => {
    for (const id of ITEM_IDS) {
      const def = ITEMS[id] as { category: string; common?: boolean };
      if (def.category === 'quest') expect(def.common, id).not.toBe(true);
    }
  });
});

describe('recipes', () => {
  it('reference real items, skills, and upgrades', () => {
    for (const [id, r] of Object.entries(RECIPES)) {
      for (const item of bagItems(r.inputs)) expect(isItem(item), `${id} input ${item}`).toBe(true);
      expect(isItem(r.output.item), `${id} output`).toBe(true);
      expect(r.skill in SKILLS, `${id} skill`).toBe(true);
      const req = (r as { requires?: { skill?: string; upgrade?: string } }).requires;
      if (req?.skill) expect(req.skill in SKILLS, `${id} requires.skill`).toBe(true);
      if (req?.upgrade) expect(req.upgrade in UPGRADES, `${id} requires.upgrade`).toBe(true);
    }
  });

  it('basic food and the charter order inputs never need power', () => {
    for (const id of ['glowcapSkewer', 'driedRation', 'slimeGlue', 'plantGlowcap'] as const) {
      expect((RECIPES[id] as { charge?: number }).charge ?? 0, id).toBe(0);
    }
  });
});

describe('upgrades', () => {
  const burrowGlyphs = new Set(BURROW_MAP.join(''));

  it('reference real items and upgrades, and are built on a real Burrow spot', () => {
    for (const [id, u] of Object.entries(UPGRADES)) {
      for (const item of bagItems(u.cost)) expect(isItem(item), `${id} cost ${item}`).toBe(true);
      const req = (u as { requires?: { upgrades?: readonly string[] } }).requires;
      for (const dep of req?.upgrades ?? []) expect(dep in UPGRADES, `${id} requires ${dep}`).toBe(true);
      // A station, or the boarded holes in the wall (patched where they are).
      const spot = SPAWN_GLYPHS[u.spot]?.kind ?? TERRAIN_GLYPHS[u.spot];
      expect(spot === 'station' || spot === 'hole', `${id} spot is ${spot}`).toBe(true);
      expect(burrowGlyphs.has(u.spot), `${id} spot in Burrow map`).toBe(true);
    }
  });

  it('decorations never cost copper, processed goods, or quest items', () => {
    const allowed = new Set<ItemId>(['scrap', 'timber', 'bone', 'cloth', 'glowcap', 'slimeGel']);
    for (const [id, u] of Object.entries(UPGRADES)) {
      if (u.kind !== 'decor') continue;
      for (const item of bagItems(u.cost)) expect(allowed.has(item as ItemId), `${id} costs ${item}`).toBe(true);
    }
  });
});

describe('creatures and humans', () => {
  it('drops reference real items and splits reference real creatures', () => {
    for (const [id, c] of Object.entries(CREATURES)) {
      for (const d of c.drops) expect(isItem(d.item), `${id} drop ${d.item}`).toBe(true);
      const split = (c as { splitsInto?: { creature: string } }).splitsInto;
      if (split) expect(split.creature in CREATURES, `${id} splits into ${split.creature}`).toBe(true);
    }
  });

  it('map spawn glyphs point at real creatures and humans', () => {
    for (const [glyph, def] of Object.entries(SPAWN_GLYPHS)) {
      if (def.kind === 'creature') expect(def.id in CREATURES, glyph).toBe(true);
      if (def.kind === 'human') expect(def.id in HUMANS, glyph).toBe(true);
    }
  });

  it('every creature has an attack, and telegraphs it for long enough to react', () => {
    for (const [id, c] of Object.entries(CREATURES)) {
      const def: CreatureDef = c;
      expect(def.lunge ?? def.spit, `${id} has no attack`).toBeDefined();
      expect(def.windup, id).toBeGreaterThanOrEqual(0.4);
    }
  });

  it('launcher mods are real equipment items that switch to real modes', () => {
    for (const [item, mode] of Object.entries(MOD_MODES)) {
      expect(ITEMS[item as ItemId]?.category, item).toBe('equipment');
      expect(mode! in LAUNCHER_MODES, item).toBe(true);
    }
  });

  it('every hero attack telegraphs for long enough to react', () => {
    for (const [id, h] of Object.entries(HUMANS)) {
      const attack = (h as { attack?: { windup: number } }).attack;
      if (attack) expect(attack.windup, id).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('pursuit always ends: every human gives up searching', () => {
    for (const [id, h] of Object.entries(HUMANS)) {
      expect(h.searchTime, id).toBeGreaterThan(0);
      expect(h.searchTime, id).toBeLessThanOrEqual(8);
    }
  });
});

describe('charter', () => {
  it('steps reference real upgrades and flags', () => {
    for (const step of CHAPTER_1.steps) {
      if (step.check.kind === 'upgrade') expect(step.check.id in UPGRADES).toBe(true);
      else expect(FLAGS).toContain(step.check.flag);
    }
    expect(FLAGS).toContain(CHAPTER_1.stampFlag);
  });

  it('orders reference real items and flags', () => {
    for (const [id, o] of Object.entries(ORDERS)) {
      for (const item of bagItems(o.items)) expect(isItem(item), `${id} ${item}`).toBe(true);
      expect(FLAGS).toContain(o.flag);
    }
  });

  it('the flywheel coil comes from a guaranteed drop, not a random one', () => {
    const drop = CREATURES.pumpMatron.drops.find((d) => d.item === 'flywheelCoil');
    expect(drop?.chance).toBe(1);
  });
});

describe('skills', () => {
  it('xp thresholds rise and invert correctly', () => {
    for (let lv = 2; lv <= SKILL_MAX_LEVEL; lv++) {
      expect(xpForLevel(lv)).toBeGreaterThan(xpForLevel(lv - 1));
      expect(levelForXp(xpForLevel(lv))).toBe(lv);
      expect(levelForXp(xpForLevel(lv) - 1)).toBe(lv - 1);
    }
  });
});

describe('economy', () => {
  it('only references real items', () => {
    for (const item of [...Object.keys(HATCH_BUYS), ...Object.keys(HATCH_SELLS)]) expect(isItem(item), item).toBe(true);
  });

  it('prices fall with each sale and floor at the raw price once demand runs out', () => {
    for (const [item, entry] of Object.entries(HATCH_BUYS)) {
      const id = item as ItemId;
      for (let n = 1; n < entry!.demand; n++) expect(hatchPrice(id, n)).toBeLessThanOrEqual(hatchPrice(id, n - 1));
      expect(hatchPrice(id, entry!.demand)).toBe(RAW_SELL_PRICE);
    }
  });

  it('no buy -> craft -> sell loop makes a profit', () => {
    // The cheapest way to make each item using only things the Hatch sells.
    // Gathered materials and generator charge count as unbuyable (infinite cost).
    const cost = new Map<ItemId, number>();
    for (const id of ITEM_IDS) cost.set(id, HATCH_SELLS[id]?.price ?? Infinity);

    for (let pass = 0; pass < 10; pass++) {
      for (const r of Object.values(RECIPES)) {
        if (((r as { charge?: number }).charge ?? 0) > 0) continue;
        const inputs: ItemBag = r.inputs;
        const total = bagItems(inputs).reduce(
          (sum, item) => sum + (cost.get(item as ItemId) ?? Infinity) * (inputs[item as ItemId] ?? 0),
          0,
        );
        const perUnit = total / r.output.qty;
        if (perUnit < (cost.get(r.output.item) ?? Infinity)) cost.set(r.output.item, perUnit);
      }
    }

    for (const id of ITEM_IDS) {
      const c = cost.get(id)!;
      if (Number.isFinite(c)) expect(hatchPrice(id, 0), `${id} sells for more than it costs to make`).toBeLessThanOrEqual(c);
    }
  });
});
