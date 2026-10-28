import type { ItemBag, ItemId } from './items';
import type { SkillId } from './skills';
import type { UpgradeId } from './upgrades';

/** Where a recipe is made. Timed stations run while you play, at home or away. */
export type StationId = 'pot' | 'workbench' | 'mushroomBed' | 'dryingRack' | 'boneGrinder';

export interface RecipeDef {
  name: string;
  station: StationId;
  inputs: ItemBag;
  output: { item: ItemId; qty: number };
  /** Seconds. Omitted means the recipe is instant. */
  time?: number;
  /** Generator charge consumed. Basic recipes never need any. */
  charge?: number;
  skill: SkillId;
  xp: number;
  requires?: { skill?: SkillId; level?: number; upgrade?: UpgradeId };
}

export const RECIPES = {
  // Cooking Pot
  glowcapSkewer: { name: 'Glowcap Skewer', station: 'pot', inputs: { glowcap: 2 }, output: { item: 'glowcapSkewer', qty: 1 }, skill: 'cooking', xp: 8 },
  truffleStew: { name: 'Truffle Stew', station: 'pot', inputs: { brineTruffle: 2, glowcap: 1 }, output: { item: 'truffleStew', qty: 1 }, skill: 'cooking', xp: 20, requires: { skill: 'cooking', level: 3, upgrade: 'shieldPan' } },
  stinkbrew: { name: 'Stinkbrew', station: 'pot', inputs: { brineTruffle: 2, bone: 2 }, output: { item: 'stinkbrew', qty: 1 }, skill: 'cooking', xp: 18, requires: { skill: 'cooking', level: 5 } },

  // Workbench
  slimeGlue: { name: 'Slime Glue', station: 'workbench', inputs: { slimeGel: 2 }, output: { item: 'slimeGlue', qty: 1 }, skill: 'tinkering', xp: 6 },
  slimeCell: { name: 'Slime Cell', station: 'workbench', inputs: { slimeGel: 2, scrap: 1 }, output: { item: 'slimeCell', qty: 1 }, charge: 2, skill: 'tinkering', xp: 14 },
  modNailSpread: { name: 'Nail Spread', station: 'workbench', inputs: { scrap: 6, timber: 2 }, output: { item: 'modNailSpread', qty: 1 }, skill: 'tinkering', xp: 30, requires: { skill: 'tinkering', level: 2 } },
  patchedSatchel: { name: 'Patched Satchel', station: 'workbench', inputs: { cloth: 6, slimeGlue: 2 }, output: { item: 'patchedSatchel', qty: 1 }, skill: 'tinkering', xp: 35, requires: { skill: 'tinkering', level: 3 } },
  modSlimeShot: { name: 'Slime Shot', station: 'workbench', inputs: { slimeGel: 4, scrap: 4, copper: 1 }, output: { item: 'modSlimeShot', qty: 1 }, charge: 3, skill: 'tinkering', xp: 45, requires: { skill: 'tinkering', level: 4 } },

  // Timed stations
  plantGlowcap: { name: 'Plant Glowcaps', station: 'mushroomBed', inputs: { glowcap: 1 }, output: { item: 'glowcap', qty: 4 }, time: 150, skill: 'fungiculture', xp: 15 },
  plantGlowcapFertilized: { name: 'Plant Glowcaps (fertilized)', station: 'mushroomBed', inputs: { glowcap: 1, fertilizer: 1 }, output: { item: 'glowcap', qty: 5 }, time: 75, skill: 'fungiculture', xp: 20 },
  plantTruffle: { name: 'Plant Brine Truffles', station: 'mushroomBed', inputs: { truffleSpores: 1 }, output: { item: 'brineTruffle', qty: 3 }, time: 180, skill: 'fungiculture', xp: 30, requires: { skill: 'fungiculture', level: 3 } },
  driedRation: { name: 'Dried Glowcap Ration', station: 'dryingRack', inputs: { glowcap: 2 }, output: { item: 'driedRation', qty: 1 }, time: 30, skill: 'cooking', xp: 10 },
  fertilizer: { name: 'Bone Fertilizer', station: 'boneGrinder', inputs: { bone: 3 }, output: { item: 'fertilizer', qty: 1 }, time: 20, charge: 1, skill: 'fungiculture', xp: 6 },
} as const satisfies Record<string, RecipeDef>;

export type RecipeId = keyof typeof RECIPES;
export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];

/** How many jobs a timed station can queue (0 means it's an instant station). */
export const STATION_QUEUE: Record<StationId, number> = {
  pot: 0,
  workbench: 0,
  mushroomBed: 1,
  dryingRack: 4,
  boneGrinder: 4,
};
