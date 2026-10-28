import { describe, expect, it } from 'vitest';
import { ORDERS } from '../src/data/charter';
import { SHIFT_SECONDS } from '../src/data/economy';
import { CREATURES, type CreatureDef, type CreatureId } from '../src/data/enemies';
import { EVENTS, eventForShift } from '../src/data/events';
import type { ItemId } from '../src/data/items';
import { NODES, type NodeDef, type NodeId, type Yield } from '../src/data/nodes';
import type { RecipeId } from '../src/data/recipes';
import { REGION_IDS } from '../src/data/regions';
import type { SkillId } from '../src/data/skills';
import type { UpgradeId } from '../src/data/upgrades';
import { build, craft, feedGenerator, skillLevel } from '../src/game/crafting';
import { addToStorage, canAfford, haveCount, pay } from '../src/game/inventory';
import { collect, jobsAt, startJob } from '../src/game/production';
import { charterProgress } from '../src/game/progress';
import { newSave, type ProductionStation, type SaveData } from '../src/game/save';
import { TileMap } from '../src/world/tilemap';

// The softlock test: a fresh save reaches Stamp #1 on nothing but what refills every shift.
// Each shift the goblin clears every node it has the skill for and every creature on the maps,
// and takes only the worst case: minimum yields, with chance drops counted at their odds,
// rounded down across the whole shift. Then it goes home and works through the Charter
// with the game's own build, craft, production, and generator rules.

const ORDER = ORDERS.coopOrder1;
/** The longest the chapter may take on the worst-case budget. 10 shifts is 80 minutes of play. */
const MAX_SHIFTS = 10;

function gainXp(save: SaveData, skill: SkillId, amount: number): void {
  save.skillXp[skill] = (save.skillXp[skill] ?? 0) + amount;
}

/** One trip around every region: what a shift's worth of searching and fighting brings home. */
function gather(save: SaveData, shift: number): void {
  const haul = new Map<ItemId, number>();
  const xp = new Map<SkillId, number>();
  const add = (lines: readonly Yield[]) => {
    for (const y of lines) haul.set(y.item, (haul.get(y.item) ?? 0) + y.min * (y.chance ?? 1));
  };
  const search = (id: NodeId) => {
    const def: NodeDef = NODES[id];
    if (def.requires && skillLevel(save, def.requires.skill) < def.requires.level) return;
    add(def.yields);
    xp.set(def.skill, (xp.get(def.skill) ?? 0) + def.xp);
  };

  for (const region of REGION_IDS) {
    for (const p of TileMap.forRegion(region).spawns) {
      if (p.def.kind === 'node') search(p.def.id as NodeId);
      if (p.def.kind === 'creature') {
        const def: CreatureDef = CREATURES[p.def.id as CreatureId];
        // The boss is its own step, below.
        if (def.boss) continue;
        add(def.drops);
        xp.set('scrapping', (xp.get('scrapping') ?? 0) + def.xp);
      }
    }
  }
  // The shift's event leaves its pile behind.
  for (const l of EVENTS[eventForShift(shift)].leftovers) search(l.node);

  for (const [item, qty] of haul) if (Math.floor(qty) > 0) addToStorage(save, item, Math.floor(qty));
  for (const [skill, amount] of xp) gainXp(save, skill, amount);
}

/** The Pump Matron, once the goblin goes for her. Her drops are guaranteed. */
function beatTheMatron(save: SaveData): void {
  const def: CreatureDef = CREATURES.pumpMatron;
  for (const d of def.drops) addToStorage(save, d.item, d.min);
  save.flags[def.boss!.flag] = true;
  save.flags[def.boss!.prize.flag] = true;
  gainXp(save, 'scrapping', def.xp);
}

const tryBuild = (save: SaveData, id: UpgradeId): boolean => {
  if (save.upgrades.includes(id)) return false;
  const gain = build(save, id, true);
  if (gain) gainXp(save, gain.skill, gain.amount);
  return gain !== null;
};

const tryCraft = (save: SaveData, id: RecipeId): boolean => {
  const made = craft(save, id, true);
  if (made) gainXp(save, made.xp.skill, made.xp.amount);
  return made !== null;
};

const queued = (save: SaveData, station: ProductionStation, recipe: RecipeId): number =>
  jobsAt(save, station).filter((j) => j.recipe === recipe).length;

/** Back at the Burrow: work through everything the Charter needs, as far as the stock allows. */
function workAtHome(save: SaveData): void {
  for (const station of ['mushroomBed', 'dryingRack', 'boneGrinder'] as const) {
    for (const c of collect(save, station)) gainXp(save, c.xp.skill, c.xp.amount);
  }
  const orderDone = () => save.flags[ORDER.flag] === true;
  for (let progress = true; progress; ) {
    progress = false;
    for (const id of ['repairWorkbench', 'patchHoles', 'mushroomBed', 'dryingRack', 'slimeGenerator'] as const) {
      progress = tryBuild(save, id) || progress;
    }
    // Glue for the generator.
    if (!save.upgrades.includes('slimeGenerator') && haveCount(save, 'slimeGlue', true) < 2) progress = tryCraft(save, 'slimeGlue') || progress;
    // Cooking practice until the Drying Rack opens up, keeping a glowcap back for the bed.
    if (skillLevel(save, 'cooking') < 2 && haveCount(save, 'glowcap', true) >= 3) progress = tryCraft(save, 'glowcapSkewer') || progress;
    if (!orderDone()) {
      const cells = haveCount(save, 'slimeCell', true);
      if (cells < ORDER.items.slimeCell && save.charge < 2) progress = feedGenerator(save, 1, true) > 0 || progress;
      if (cells < ORDER.items.slimeCell) progress = tryCraft(save, 'slimeCell') || progress;
      if (haveCount(save, 'driedRation', true) + queued(save, 'dryingRack', 'driedRation') < ORDER.items.driedRation) {
        progress = startJob(save, 'dryingRack', 'driedRation', true) || progress;
      }
      if (canAfford(save, ORDER.items, true)) {
        pay(save, ORDER.items, true);
        save.buttons += ORDER.rewardButtons;
        save.flags[ORDER.flag] = true;
        progress = true;
      }
    }
    if (save.upgrades.includes('slimeGenerator') && !save.flags.generatorActive) progress = feedGenerator(save, 1, true) > 0 || progress;
    if (jobsAt(save, 'mushroomBed').length === 0) progress = startJob(save, 'mushroomBed', 'plantGlowcap', true) || progress;
  }
}

describe('resource budget', () => {
  it(`a fresh save reaches Stamp #1 within ${MAX_SHIFTS} shifts, on resources that refill every shift`, () => {
    const save = newSave();
    let shifts = 0;
    for (; shifts < MAX_SHIFTS; shifts++) {
      gather(save, shifts);
      // She's a second-trip fight: the first shift is for finding your feet.
      if (shifts >= 1 && !save.flags.matronDefeated) beatTheMatron(save);
      workAtHome(save);
      // Timed jobs finish while you're out on the next trip.
      save.playTime += SHIFT_SECONDS;
      const { done, total } = charterProgress(save);
      if (done === total) break;
    }
    const { done, total } = charterProgress(save);
    expect(done, `Charter steps done after ${shifts} shifts`).toBe(total);
    expect(shifts).toBeLessThan(MAX_SHIFTS);
  });
});
