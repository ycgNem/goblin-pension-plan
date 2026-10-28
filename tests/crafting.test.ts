import { describe, expect, it } from 'vitest';
import { CHAPTER_1 } from '../src/data/charter';
import { RECIPES, STATION_QUEUE } from '../src/data/recipes';
import { UPGRADES, UPGRADE_IDS, type UpgradeDef, type UpgradeId } from '../src/data/upgrades';
import { build, canBuild, coziness, craft, openUpgradesAt, recipeLocks, upgradeLocks, upgradesAt } from '../src/game/crafting';
import { addToPack, packCount, PACK_SLOTS } from '../src/game/inventory';
import { capacity, collect, jobProgress, readyCount, startJob } from '../src/game/production';
import { charterProgress } from '../src/game/progress';
import { newSave, type SaveData } from '../src/game/save';
import { xpForLevel } from '../src/data/skills';

function stocked(): SaveData {
  const save = newSave();
  for (const id of ['scrap', 'timber', 'glowcap', 'bone', 'slimeGel', 'cloth', 'copper', 'slimeGlue', 'fertilizer', 'truffleSpores', 'brineTruffle'] as const) {
    save.storage[id] = 50;
  }
  return save;
}

describe('crafting', () => {
  it('is all or nothing', () => {
    const save = newSave();
    addToPack(save, 'glowcap', 1);
    const before = JSON.stringify(save);
    expect(craft(save, 'glowcapSkewer', true)).toBeNull();
    expect(JSON.stringify(save)).toBe(before);
  });

  it('uses storage first and hands the result to the pack', () => {
    const save = newSave();
    save.storage.glowcap = 1;
    addToPack(save, 'glowcap', 3);
    const res = craft(save, 'glowcapSkewer', true);
    expect(res).toEqual({ item: 'glowcapSkewer', qty: 1, xp: { skill: 'cooking', amount: RECIPES.glowcapSkewer.xp } });
    expect(save.storage.glowcap).toBeUndefined();
    expect(packCount(save, 'glowcap')).toBe(2);
    expect(packCount(save, 'glowcapSkewer')).toBe(1);
    expect(save.stats.crafted).toBe(1);
  });

  it('a full pack sends the result to storage', () => {
    const save = newSave();
    save.storage.glowcap = 2;
    for (let i = 0; i < PACK_SLOTS; i++) addToPack(save, 'timber', 20);
    expect(craft(save, 'glowcapSkewer', true)).not.toBeNull();
    expect(save.storage.glowcapSkewer).toBe(1);
  });

  it('respects stations, skills, and power', () => {
    const save = stocked();
    expect(recipeLocks(save, 'slimeGlue')).toEqual(['Needs the Scrap Workbench']);
    expect(craft(save, 'slimeGlue', true)).toBeNull();
    save.upgrades.push('repairWorkbench');
    expect(craft(save, 'slimeGlue', true)).not.toBeNull();
    expect(recipeLocks(save, 'modNailSpread')).toContain('Tinkering 2');
    save.skillXp.tinkering = xpForLevel(2);
    expect(recipeLocks(save, 'modNailSpread')).toEqual([]);
    expect(recipeLocks(save, 'slimeCell')).toContain('Needs generator power');
  });

  it('timed recipes go through production, not the craft button', () => {
    const save = stocked();
    save.upgrades.push('mushroomBed');
    expect(craft(save, 'plantGlowcap', true)).toBeNull();
  });
});

describe('building', () => {
  it('every upgrade has a real spot, and spots list their upgrades', () => {
    for (const id of UPGRADE_IDS) expect(upgradesAt(UPGRADES[id].spot), id).toContain(id);
  });

  it('pays, records, and gives tinkering xp, once', () => {
    const save = stocked();
    const xp = build(save, 'patchHoles', true);
    expect(xp).toEqual({ skill: 'tinkering', amount: 30 });
    expect(save.upgrades).toContain('patchHoles');
    expect(save.storage.timber).toBe(50 - (UPGRADES.patchHoles.cost.timber ?? 0));
    expect(build(save, 'patchHoles', true)).toBeNull();
    expect(upgradeLocks(save, 'patchHoles')).toEqual(['Already built']);
  });

  it('upgrades that need others wait for them', () => {
    const def = (id: UpgradeId): UpgradeDef => UPGRADES[id];
    const dependents = UPGRADE_IDS.filter((id) => (def(id).requires?.upgrades ?? []).length > 0 && (def(id).requires?.chapter ?? 1) <= 1);
    expect(dependents.length).toBeGreaterThan(0);
    for (const id of dependents) {
      const save = stocked();
      save.skillXp = { tinkering: 1e6, cooking: 1e6, fungiculture: 1e6, scavenging: 1e6, scrapping: 1e6 };
      expect(canBuild(save, id, true), id).toBe(false);
      for (const dep of def(id).requires!.upgrades!) save.upgrades.push(dep as UpgradeId);
      expect(upgradeLocks(save, id), id).toEqual([]);
    }
  });

  it('build spots only glow for upgrades that are open', () => {
    const save = newSave();
    expect(openUpgradesAt(save, UPGRADES.patchHoles.spot)).toContain('patchHoles');
    save.upgrades.push('patchHoles');
    expect(openUpgradesAt(save, UPGRADES.patchHoles.spot)).not.toContain('patchHoles');
  });

  it('the Charter fills in as its upgrades are built', () => {
    const save = stocked();
    save.skillXp = { tinkering: 1e6, cooking: 1e6, fungiculture: 1e6, scavenging: 1e6, scrapping: 1e6 };
    let done = 0;
    for (const step of CHAPTER_1.steps) {
      if (step.check.kind !== 'upgrade') continue;
      expect(build(save, step.check.id, true), step.title).not.toBeNull();
      done++;
      expect(charterProgress(save).done).toBe(done);
    }
  });

  it('coziness grows with the Burrow and tops out at 1', () => {
    const save = newSave();
    expect(coziness(save)).toBe(0);
    save.upgrades.push('patchHoles');
    const some = coziness(save);
    expect(some).toBeGreaterThan(0);
    save.upgrades.push(...UPGRADE_IDS);
    expect(coziness(save)).toBe(1);
  });
});

describe('production', () => {
  it('mushroom beds grow one crop each, side by side', () => {
    const save = stocked();
    save.upgrades.push('mushroomBed');
    expect(capacity(save, 'mushroomBed')).toBe(1);
    expect(startJob(save, 'mushroomBed', 'plantGlowcap', true)).toBe(true);
    expect(startJob(save, 'mushroomBed', 'plantGlowcap', true)).toBe(false);
    save.upgrades.push('secondBed');
    expect(startJob(save, 'mushroomBed', 'plantGlowcap', true)).toBe(true);
    const ends = save.production.mushroomBed!.map((j) => j.end);
    expect(ends).toEqual([RECIPES.plantGlowcap.time, RECIPES.plantGlowcap.time]);
  });

  it('racks work through a queue, one after another', () => {
    const save = stocked();
    save.upgrades.push('dryingRack');
    const t = RECIPES.driedRation.time;
    for (let i = 0; i < STATION_QUEUE.dryingRack; i++) expect(startJob(save, 'dryingRack', 'driedRation', true)).toBe(true);
    expect(startJob(save, 'dryingRack', 'driedRation', true)).toBe(false);
    expect(save.production.dryingRack!.map((j) => j.end)).toEqual(Array.from({ length: STATION_QUEUE.dryingRack }, (_, i) => t * (i + 1)));
  });

  it('only runs while you play, and hands over what is finished', () => {
    const save = stocked();
    save.upgrades.push('dryingRack');
    startJob(save, 'dryingRack', 'driedRation', true);
    startJob(save, 'dryingRack', 'driedRation', true);
    const t = RECIPES.driedRation.time;
    save.playTime = t / 2;
    expect(jobProgress(save, 'dryingRack')[0]!.frac).toBeCloseTo(0.5);
    expect(jobProgress(save, 'dryingRack')[1]!.frac).toBe(0);
    expect(collect(save, 'dryingRack')).toEqual([]);
    save.playTime = t;
    expect(readyCount(save, 'dryingRack')).toBe(1);
    const got = collect(save, 'dryingRack');
    expect(got.map((g) => g.item)).toEqual(['driedRation']);
    expect(packCount(save, 'driedRation')).toBe(1);
    expect(save.production.dryingRack!.length).toBe(1);
  });

  it('a locked or unaffordable job changes nothing', () => {
    const save = newSave();
    const before = JSON.stringify(save);
    expect(startJob(save, 'mushroomBed', 'plantGlowcap', true)).toBe(false);
    save.upgrades.push('mushroomBed');
    expect(startJob(save, 'mushroomBed', 'plantGlowcap', true)).toBe(false);
    save.upgrades.pop();
    expect(JSON.stringify(save)).toBe(before);
  });
});
