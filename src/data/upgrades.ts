import type { ItemBag } from './items';
import type { SkillId } from './skills';

// Things you build in the Burrow. The Burrow renderer reads save.upgrades to draw each visible change.
// `spot` is the map glyph where it's built ('+' means any hole in the walls).

export interface UpgradeDef {
  name: string;
  desc: string;
  /** Decorations may only cost common, low-value materials (enforced by tests). */
  kind: 'functional' | 'decor';
  cost: ItemBag;
  spot: string;
  /** `upgrades` holds UpgradeIds; it's typed as string to avoid a circular type, and tests check it. */
  requires?: { upgrades?: readonly string[]; skill?: SkillId; level?: number; chapter?: number };
  /** Bought at the Hatch for Brass Buttons instead of built. Never appears in a build menu. */
  price?: number;
}

export const UPGRADES = {
  // Functional
  patchHoles: { name: 'Board Patch', kind: 'functional', spot: '+', desc: 'Turns a hole into a wall. Legally.', cost: { timber: 6, scrap: 2 } },
  repairWorkbench: { name: 'Scrap Workbench', kind: 'functional', spot: 'W', desc: 'Now with a fourth leg, glued on with slime.', cost: { scrap: 8, timber: 4, slimeGel: 3 } },
  mushroomBed: { name: 'Mushroom Bed', kind: 'functional', spot: 'M', desc: 'A frame of planks and optimism.', cost: { timber: 4, bone: 2, glowcap: 1 } },
  scrapLantern: { name: 'Scrap Lantern', kind: 'functional', spot: 'L', desc: 'Light you can almost read by.', cost: { scrap: 3, slimeGel: 1 } },
  dryingRack: { name: 'Drying Rack', kind: 'functional', spot: 'D', desc: 'Turns mushrooms into expedition food.', cost: { timber: 3, cloth: 2 }, requires: { skill: 'cooking', level: 2 } },
  shieldPan: { name: 'Shield Frying Pan', kind: 'functional', spot: 'O', desc: 'Previously defended a knight. Now defends breakfast.', cost: { scrap: 5, cloth: 1 }, requires: { skill: 'cooking', level: 3 } },
  slimeGenerator: { name: 'Slime Generator', kind: 'functional', spot: 'G', desc: 'Feed it gel. It hums. The hum is power.', cost: { flywheelCoil: 1, copper: 4, scrap: 6, slimeGlue: 2 }, requires: { upgrades: ['repairWorkbench'] } },
  boneGrinder: { name: 'Bone Grinder', kind: 'functional', spot: 'R', desc: 'Crunch. Fertilizer.', cost: { scrap: 6, bone: 4 }, requires: { skill: 'tinkering', level: 5, upgrades: ['slimeGenerator'] } },
  secondBed: { name: 'Second Mushroom Bed', kind: 'functional', spot: 'M', desc: 'Agriculture, at scale.', cost: { timber: 4, bone: 2 }, requires: { skill: 'fungiculture', level: 5, upgrades: ['mushroomBed'] } },

  // Decor
  fewerSprings: { name: 'Fewer Springs', kind: 'decor', spot: 'Z', desc: 'Some springs remain. Fewer.', cost: { cloth: 6, timber: 2 } },
  secondBowl: { name: 'Second Bowl', kind: 'decor', spot: 'O', desc: 'Luxury.', cost: { timber: 1 } },
  tooGrandChair: { name: 'Too-Grand Chair', kind: 'decor', spot: 'Z', desc: 'Recovered from a throne room. Barely fits through the door.', cost: { timber: 5, cloth: 3, bone: 2 }, requires: { upgrades: ['patchHoles'] } },
  notALairSign: { name: 'DEFINITELY NOT A LAIR', kind: 'decor', spot: 'N', desc: 'Re-lettered for clarity.', cost: { timber: 1, cloth: 1 } },
  bathtub: { name: 'Bathtub (stolen, polished)', kind: 'decor', spot: 'Z', desc: 'Requires plumbing.', cost: { scrap: 10, timber: 4 }, requires: { chapter: 2 } },

  // Decor from the Hatch
  wallClock: { name: 'Wall Clock (stopped)', kind: 'decor', spot: 'Z', desc: 'Right twice a day. Wrong with great confidence.', cost: {}, price: 18 },
  waxFern: { name: 'Wax Fern', kind: 'decor', spot: 'C', desc: 'Thrives on neglect. Specifically, ours.', cost: {}, price: 12 },
  gildedPlaque: { name: '"EST." Plaque', kind: 'decor', spot: 'N', desc: 'Established. Recently. Officially.', cost: {}, price: 30, requires: { upgrades: ['notALairSign'] } },
} as const satisfies Record<string, UpgradeDef>;

export type UpgradeId = keyof typeof UPGRADES;
export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
