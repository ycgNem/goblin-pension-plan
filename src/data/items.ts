// Every item in the game. `common` items are what the Rat Union takes a cut of on defeat.

export type ItemCategory = 'material' | 'food' | 'throwable' | 'equipment' | 'quest';

export interface ItemDef {
  name: string;
  category: ItemCategory;
  /** One line, 80 characters max. */
  desc: string;
  stack: number;
  /** Lost (50%, rounded down) when the Rat Union drags you home. */
  common?: boolean;
  /** Healing in half-hearts. */
  heal?: number;
  /** Where to find it. Shown on tracked recipes. */
  source?: string;
  /** Owning this equipment lets another item stack higher. */
  raisesStack?: { item: string; stack: number };
}

export const ITEMS = {
  // Raw materials
  scrap: { name: 'Scrap Metal', category: 'material', stack: 20, common: true, desc: 'Was a sword. Was a hinge. Will be something.', source: 'Refuse Galleries junk piles' },
  timber: { name: 'Rotten Timber', category: 'material', stack: 20, common: true, desc: 'Structurally optimistic.', source: 'Crates and old supports' },
  glowcap: { name: 'Glowcap', category: 'material', stack: 20, common: true, desc: 'Edible once cooked. Faintly luminous. Do not ask why.', source: 'Fungus Cistern, mushroom beds' },
  brineTruffle: { name: 'Brine Truffle', category: 'material', stack: 20, common: true, desc: 'Grows where the drains weep. Delicious anyway.', source: 'Fungus Cistern (Fungiculture 3)' },
  bone: { name: 'Bones', category: 'material', stack: 20, common: true, desc: 'Previously load-bearing.', source: 'Creature remains' },
  slimeGel: { name: 'Slime Gel', category: 'material', stack: 20, common: true, desc: 'Sticky, warm, slightly offended.', source: 'Slimes and Cistern slime pools' },
  cloth: { name: 'Cloth Scraps', category: 'material', stack: 20, common: true, desc: "Somebody's cloak. Somebody's problem.", source: 'Discarded adventurer supplies' },
  copper: { name: 'Copper Parts', category: 'material', stack: 20, common: true, desc: 'The city calls it waste. The city is wrong.', source: 'Pumpworks machinery (Scav. 3), beetles, the Hatch' },

  // Processed goods
  slimeGlue: { name: 'Slime Glue', category: 'material', stack: 20, common: true, desc: 'Holds anything to anything, briefly forever.', source: 'Workbench' },
  slimeCell: { name: 'Slime Cell', category: 'material', stack: 10, common: true, desc: 'A jar of angry light.', source: 'Workbench (needs charge)' },
  fertilizer: { name: 'Bone Fertilizer', category: 'material', stack: 20, common: true, desc: 'The circle of life, ground fine.', source: 'Bone Grinder' },
  truffleSpores: { name: 'Truffle Spores', category: 'material', stack: 10, desc: 'A small paper packet. Smells like a basement.', source: 'The Hatch' },

  // Food (heal in half-hearts)
  glowcapSkewer: { name: 'Glowcap Skewer', category: 'food', stack: 10, heal: 2, desc: 'Dinner on a stick. The stick is also dinner.' },
  driedRation: { name: 'Dried Glowcap Ration', category: 'food', stack: 10, heal: 4, desc: 'Keeps for weeks. Tastes like it already has.' },
  truffleStew: { name: 'Truffle Stew', category: 'food', stack: 5, heal: 8, desc: 'Cooked in a shield. Tastes heroic.' },

  // Throwables (a free pebble is always available and isn't an item)
  bottle: { name: 'Empty Bottle', category: 'throwable', stack: 3, desc: 'Throw it. Somebody will go and look.', source: 'Refuse Galleries' },
  stinkbrew: { name: 'Stinkbrew', category: 'throwable', stack: 3, desc: 'Creatures avoid the cloud. So does everyone.' },

  // Equipment
  bandolier: { name: 'Bottle Bandolier', category: 'equipment', stack: 1, desc: 'Bottles stack to five. Clink responsibly.', source: 'The Hatch', raisesStack: { item: 'bottle', stack: 5 } },
  modNailSpread: { name: 'Nail Spread', category: 'equipment', stack: 1, desc: 'Launcher mod. Three nails, one opinion.' },
  modSlimeShot: { name: 'Slime Shot', category: 'equipment', stack: 1, desc: 'Launcher mod. Slows the target. Ruins its day.' },
  patchedSatchel: { name: 'Patched Satchel', category: 'equipment', stack: 1, desc: 'Nine pockets. Seven of them close.' },

  // Quest
  flywheelCoil: { name: 'Flywheel Coil', category: 'quest', stack: 1, desc: 'Still warm from the Pump Matron. Still spinning, a bit.', source: 'Old Pumpworks, Pump Room' },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
export type ItemBag = Partial<Record<ItemId, number>>;

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export function itemDef(id: ItemId): ItemDef {
  return ITEMS[id];
}
