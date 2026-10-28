import type { ItemId } from '../data/items';
import { RECIPES, RECIPE_IDS, type RecipeDef, type RecipeId, type StationId } from '../data/recipes';
import { levelForXp, SKILLS, type SkillId } from '../data/skills';
import { UPGRADES, UPGRADE_IDS, type UpgradeDef, type UpgradeId } from '../data/upgrades';
import { canAfford, give, pay } from './inventory';
import type { SaveData } from './save';

// Crafting and building, as pure, all-or-nothing transactions on the save.

export interface XpGain {
  skill: SkillId;
  amount: number;
}

/** The upgrade a station needs before it works at all. The miserable pot works from day one. */
export const STATION_NEEDS: Partial<Record<StationId, UpgradeId>> = {
  workbench: 'repairWorkbench',
  mushroomBed: 'mushroomBed',
  dryingRack: 'dryingRack',
  boneGrinder: 'boneGrinder',
};

export const STATION_NAMES: Record<StationId, string> = {
  pot: 'Cooking Pot',
  workbench: 'Workbench',
  mushroomBed: 'Mushroom Bed',
  dryingRack: 'Drying Rack',
  boneGrinder: 'Bone Grinder',
};

/** Tinkering XP for building things. */
export const BUILD_XP = { functional: 30, decor: 12 } as const;

export function skillLevel(save: SaveData, skill: SkillId): number {
  return levelForXp(save.skillXp[skill] ?? 0);
}

export function stationRecipes(station: StationId): RecipeId[] {
  return RECIPE_IDS.filter((id) => RECIPES[id].station === station);
}

/** What still stands between you and a recipe, as short reasons. Materials aren't counted here. */
export function recipeLocks(save: SaveData, id: RecipeId): string[] {
  const r: RecipeDef = RECIPES[id];
  const locks: string[] = [];
  const needs = STATION_NEEDS[r.station];
  if (needs && !save.upgrades.includes(needs)) locks.push(`Needs the ${UPGRADES[needs].name}`);
  const req = r.requires;
  if (req?.skill && req.level && skillLevel(save, req.skill) < req.level) locks.push(`${SKILLS[req.skill].name} ${req.level}`);
  if (req?.upgrade && !save.upgrades.includes(req.upgrade)) locks.push(`Needs the ${UPGRADES[req.upgrade].name}`);
  // Generator power arrives with the Slime Generator (Chapter 1, step 5).
  if ((r.charge ?? 0) > 0) locks.push('Needs generator power');
  return locks;
}

export function canCraft(save: SaveData, id: RecipeId, withStorage: boolean): boolean {
  return recipeLocks(save, id).length === 0 && canAfford(save, RECIPES[id].inputs, withStorage);
}

export interface CraftResult {
  item: ItemId;
  qty: number;
  xp: XpGain;
}

/** Make an instant recipe. Pays, then hands over the output (pack first, storage for the rest). */
export function craft(save: SaveData, id: RecipeId, withStorage: boolean): CraftResult | null {
  const r: RecipeDef = RECIPES[id];
  if (r.time) return null;
  if (recipeLocks(save, id).length > 0) return null;
  if (!pay(save, r.inputs, withStorage)) return null;
  give(save, r.output.item, r.output.qty);
  save.stats.crafted++;
  return { item: r.output.item, qty: r.output.qty, xp: { skill: r.skill, amount: r.xp } };
}

/** Upgrades built at a map glyph ('+' is any hole in the Burrow walls). */
export function upgradesAt(glyph: string): UpgradeId[] {
  return UPGRADE_IDS.filter((id) => UPGRADES[id].spot === glyph);
}

export function upgradeLocks(save: SaveData, id: UpgradeId): string[] {
  const u: UpgradeDef = UPGRADES[id];
  if (save.upgrades.includes(id)) return ['Already built'];
  const locks: string[] = [];
  const req = u.requires;
  if (req?.chapter && req.chapter > 1) locks.push(`Chapter ${req.chapter}`);
  if (req?.skill && req.level && skillLevel(save, req.skill) < req.level) locks.push(`${SKILLS[req.skill].name} ${req.level}`);
  for (const dep of req?.upgrades ?? []) {
    if (!save.upgrades.includes(dep as UpgradeId)) locks.push(`Needs the ${UPGRADES[dep as UpgradeId].name}`);
  }
  return locks;
}

export function canBuild(save: SaveData, id: UpgradeId, withStorage: boolean): boolean {
  return upgradeLocks(save, id).length === 0 && canAfford(save, UPGRADES[id].cost, withStorage);
}

/** Build an upgrade. All or nothing. */
export function build(save: SaveData, id: UpgradeId, withStorage: boolean): XpGain | null {
  if (upgradeLocks(save, id).length > 0) return null;
  if (!pay(save, UPGRADES[id].cost, withStorage)) return null;
  save.upgrades.push(id);
  save.stats.built++;
  return { skill: 'tinkering', amount: BUILD_XP[UPGRADES[id].kind] };
}

/** Upgrades at a spot you could build right now apart from materials. Drives the glowing outlines. */
export function openUpgradesAt(save: SaveData, glyph: string): UpgradeId[] {
  return upgradesAt(glyph).filter((id) => upgradeLocks(save, id).length === 0);
}

/** How cozy the Burrow is, 0..1, from everything built. Warms the light and grows the music. */
export function coziness(save: SaveData): number {
  const weights: Partial<Record<UpgradeId, number>> = {
    patchHoles: 3, scrapLantern: 3, repairWorkbench: 2, mushroomBed: 2, fewerSprings: 2, tooGrandChair: 2,
    notALairSign: 1, secondBowl: 1, dryingRack: 1, shieldPan: 1, slimeGenerator: 2, boneGrinder: 1, secondBed: 1,
  };
  const total = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
  const have = save.upgrades.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
  return Math.min(1, have / (total * 0.6));
}
