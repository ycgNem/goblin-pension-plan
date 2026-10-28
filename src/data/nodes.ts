import type { ItemId } from './items';
import type { SkillId } from './skills';

// Things you can search, smash, harvest, or strip. Searched nodes stay empty until the
// next Shift Bell. Event leftovers (smashed crates, dropped bundles) are nodes too.

export interface Yield {
  item: ItemId;
  min: number;
  max: number;
  /** Chance this line pays out at all. Defaults to 1. */
  chance?: number;
}

export interface NodeDef {
  name: string;
  /** The prompt verb: "[E] Search Junk pile". */
  verb: string;
  skill: SkillId;
  xp: number;
  /** Seconds to hold E. Zero means a single press. */
  time: number;
  requires?: { skill: SkillId; level: number };
  yields: readonly Yield[];
  /** Noise radius (px) when used. Smashing is loud; searching is quiet. */
  noise?: number;
  /** Player shots break it open too. */
  smashable?: boolean;
  /** Scavenging 6 adds one more of the first item. */
  bonusSkill?: SkillId;
  /** Art to draw (props.ts) and its variant once used. */
  art: string;
  usedVariant: string;
  /** Glows faintly in the dark. */
  light?: { r: number; color: string; a: number };
}

export const NODES = {
  junkPile: {
    name: 'Junk pile', verb: 'Search', skill: 'scavenging', xp: 6, time: 1.1, bonusSkill: 'scavenging',
    yields: [{ item: 'scrap', min: 2, max: 3 }, { item: 'timber', min: 0, max: 1 }, { item: 'bottle', min: 1, max: 1, chance: 0.2 }, { item: 'cloth', min: 1, max: 1, chance: 0.15 }],
    art: 'junkPile', usedVariant: 'searched',
  },
  crate: {
    name: 'Crate', verb: 'Smash', skill: 'scavenging', xp: 5, time: 0, noise: 120, smashable: true, bonusSkill: 'scavenging',
    yields: [{ item: 'timber', min: 2, max: 3 }, { item: 'cloth', min: 1, max: 1, chance: 0.35 }, { item: 'scrap', min: 1, max: 1, chance: 0.3 }],
    art: 'crate', usedVariant: 'smashed',
  },
  glowcapPatch: {
    name: 'Glowcap patch', verb: 'Harvest', skill: 'fungiculture', xp: 6, time: 0.9,
    yields: [{ item: 'glowcap', min: 2, max: 3 }],
    art: 'glowcapPatch', usedVariant: 'harvested', light: { r: 34, color: '#9ae05a', a: 0.6 },
  },
  truffleRoot: {
    name: 'Brine Truffle root', verb: 'Dig up', skill: 'fungiculture', xp: 12, time: 1.4, requires: { skill: 'fungiculture', level: 3 },
    yields: [{ item: 'brineTruffle', min: 1, max: 2 }],
    art: 'truffleRoot', usedVariant: 'harvested', light: { r: 20, color: '#c090e0', a: 0.35 },
  },
  slimePool: {
    name: 'Slime pool', verb: 'Scoop', skill: 'scavenging', xp: 6, time: 1.2,
    yields: [{ item: 'slimeGel', min: 2, max: 3 }],
    art: 'slimePool', usedVariant: 'scooped', light: { r: 30, color: '#58c078', a: 0.5 },
  },
  reinforcedPile: {
    name: 'Reinforced scrap pile', verb: 'Pry open', skill: 'scavenging', xp: 12, time: 1.6, requires: { skill: 'scavenging', level: 4 }, bonusSkill: 'scavenging',
    yields: [{ item: 'scrap', min: 3, max: 5 }, { item: 'copper', min: 1, max: 1, chance: 0.4 }, { item: 'cloth', min: 1, max: 1, chance: 0.3 }],
    art: 'reinforcedPile', usedVariant: 'searched',
  },
  copperMachine: {
    name: 'Old machinery', verb: 'Strip', skill: 'scavenging', xp: 14, time: 1.8, requires: { skill: 'scavenging', level: 3 },
    yields: [{ item: 'copper', min: 1, max: 2 }, { item: 'scrap', min: 1, max: 2 }],
    art: 'copperMachine', usedVariant: 'stripped',
  },

  // Event leftovers. Each is about one pile's worth (tests cap them).
  smashedCrate: {
    name: 'Smashed crate', verb: 'Search', skill: 'scavenging', xp: 4, time: 0.8,
    yields: [{ item: 'scrap', min: 2, max: 2 }, { item: 'timber', min: 1, max: 1 }],
    art: 'smashedCrate', usedVariant: '',
  },
  clothBundle: {
    name: 'Dropped supply bundle', verb: 'Search', skill: 'scavenging', xp: 4, time: 0.8,
    yields: [{ item: 'cloth', min: 2, max: 3 }],
    art: 'clothBundle', usedVariant: 'searched',
  },
  bonePile: {
    name: 'Rat bones', verb: 'Gather', skill: 'scavenging', xp: 3, time: 0.7,
    yields: [{ item: 'bone', min: 2, max: 3 }],
    art: 'bonePile', usedVariant: 'searched',
  },
  gelPuddle: {
    name: 'Spilled gel', verb: 'Scoop', skill: 'scavenging', xp: 3, time: 0.8,
    yields: [{ item: 'slimeGel', min: 2, max: 3 }],
    art: 'gelPuddle', usedVariant: '', light: { r: 26, color: '#58c078', a: 0.45 },
  },
} as const satisfies Record<string, NodeDef>;

export type NodeId = keyof typeof NODES;

/** Scavenging level that adds one more item from every pile. */
export const BONUS_ITEM_LEVEL = 6;

/** Roll a node's yield. Deterministic for a given rng. */
export function rollYield(def: NodeDef, rng: () => number, bonus: boolean): { item: ItemId; qty: number }[] {
  const out: { item: ItemId; qty: number }[] = [];
  def.yields.forEach((y, i) => {
    if (y.chance !== undefined && rng() >= y.chance) return;
    let qty = y.min + Math.floor(rng() * (y.max - y.min + 1));
    if (i === 0 && bonus) qty++;
    if (qty > 0) out.push({ item: y.item, qty });
  });
  return out;
}

/** The most a node can ever give, counting every line at its maximum. */
export function maxYield(def: NodeDef): number {
  return def.yields.reduce((sum, y) => sum + y.max, 0) + 1;
}
