// The ASCII map legend. Maps live in src/world/maps/, one file per region.
//
// Terrain:  ' ' void   # wall   + boarded hole (Burrow)   . floor   , moss   ~ sludge (slow)
//           c crawlspace (goblins only)   h hiding spot   = gate (open when the region's gate flag is set)
//           0-9 exit (linked in src/data/regions.ts)
// Anything in SPAWN_GLYPHS is a floor tile (or a solid prop) with something placed on it.

export const TILE = 16;

export type TileKind =
  | 'void' | 'wall' | 'hole' | 'floor' | 'moss' | 'sludge'
  | 'crawl' | 'hide' | 'gate' | 'exit' | 'prop';

export const TERRAIN_GLYPHS: Record<string, TileKind> = {
  ' ': 'void',
  '#': 'wall',
  '+': 'hole',
  '.': 'floor',
  ',': 'moss',
  '~': 'sludge',
  c: 'crawl',
  h: 'hide',
  '=': 'gate',
};

export type SpawnKind =
  | 'player' | 'creature' | 'human' | 'node' | 'station' | 'npc' | 'access' | 'landmark' | 'valve' | 'letter';

export interface SpawnDef {
  kind: SpawnKind;
  /** Creature/human/node/station/npc id, depending on kind. */
  id: string;
  label: string;
  /** Map-view and fallback color. */
  color: string;
  /** Solid props block movement and sight. */
  solid?: boolean;
}

export const SPAWN_GLYPHS: Record<string, SpawnDef> = {
  '@': { kind: 'player', id: 'player', label: 'New game spawn', color: '#9ad35a' },

  // Creatures
  r: { kind: 'creature', id: 'drainRat', label: 'Drain Rat', color: '#a08070' },
  s: { kind: 'creature', id: 'slime', label: 'Slime', color: '#6fd06f' },
  m: { kind: 'creature', id: 'boneMite', label: 'Bone Mite', color: '#e8e0c8' },
  b: { kind: 'creature', id: 'scrapbackBeetle', label: 'Scrapback Beetle', color: '#b0703a' },
  B: { kind: 'creature', id: 'pumpMatron', label: 'The Pump Matron', color: '#d0482a' },

  // Humans and their entry points. H marks where Inspector Hobb works during a Pipe Inspection.
  A: { kind: 'access', id: 'cityAccess', label: 'City access grate', color: '#f4e7b0' },
  H: { kind: 'human', id: 'inspector', label: "Inspector's post", color: '#5a7fbf' },

  // Resource nodes
  j: { kind: 'node', id: 'junkPile', label: 'Junk pile', color: '#8a8378' },
  x: { kind: 'node', id: 'crate', label: 'Crate', color: '#8b5a2b' },
  g: { kind: 'node', id: 'glowcapPatch', label: 'Glowcap patch', color: '#b6f06a' },
  t: { kind: 'node', id: 'truffleRoot', label: 'Brine Truffle root', color: '#c9a0dc' },
  p: { kind: 'node', id: 'slimePool', label: 'Slime pool', color: '#58c078' },
  k: { kind: 'node', id: 'copperMachine', label: 'Old machinery', color: '#c87533' },
  v: { kind: 'valve', id: 'steamValve', label: 'Steam valve', color: '#d8d8d8' },

  // Burrow stations and build spots
  Z: { kind: 'station', id: 'bed', label: 'Sack bed', color: '#a89060' },
  C: { kind: 'station', id: 'storage', label: 'Storage crate', color: '#9a6a3a' },
  O: { kind: 'station', id: 'pot', label: 'Miserable cooking pot', color: '#707070' },
  W: { kind: 'station', id: 'workbench', label: 'Broken workbench', color: '#7a5a3a' },
  M: { kind: 'station', id: 'mushroomBed', label: 'Mushroom bed spot', color: '#5f8f3f' },
  D: { kind: 'station', id: 'dryingRack', label: 'Drying rack spot', color: '#8f7f4f' },
  R: { kind: 'station', id: 'boneGrinder', label: 'Bone grinder spot', color: '#9f9f8f' },
  G: { kind: 'station', id: 'slimeGenerator', label: 'Generator spot', color: '#4fbf9f' },
  L: { kind: 'station', id: 'lantern', label: 'Lantern spot', color: '#f0a040' },
  N: { kind: 'station', id: 'sign', label: '"NOT A LAIR"', color: '#d0c090' },
  E: { kind: 'letter', id: 'grubbsLetter', label: "Grubb's letter", color: '#e8e0c8' },

  // Cooperative
  Q: { kind: 'npc', id: 'grubb', label: 'Registrar Grubb', color: '#7fbf5a' },
  T: { kind: 'npc', id: 'hatch', label: 'The Hatch', color: '#e0b060' },
  V: { kind: 'npc', id: 'activityBoard', label: 'Activity Board', color: '#e8dcc0' },

  // Landmarks (solid)
  X: { kind: 'landmark', id: 'chandelier', label: 'Fallen chandelier', color: '#c8b060', solid: true },
  F: { kind: 'landmark', id: 'founderStatue', label: 'Statue of the Founder', color: '#8fa0a0', solid: true },
  Y: { kind: 'landmark', id: 'piston', label: 'Seized piston', color: '#6a6a72', solid: true },
};

export type Mover = 'goblin' | 'creature' | 'human';

/** Can this mover NOT enter a tile of this kind? */
export function blocks(kind: TileKind, mover: Mover, gateOpen: boolean): boolean {
  switch (kind) {
    case 'void':
    case 'wall':
    case 'hole':
    case 'prop':
      return true;
    case 'gate':
      return !gateOpen;
    case 'crawl':
      // Humans never fit through goblin routes. Creatures do: crawlspaces are for escaping people.
      return mover === 'human';
    case 'exit':
      // Only the goblin ever leaves a region.
      return mover !== 'goblin';
    default:
      return false;
  }
}

/** Does this tile block line of sight? */
export function blocksSight(kind: TileKind, gateOpen: boolean): boolean {
  return kind === 'void' || kind === 'wall' || kind === 'hole' || kind === 'prop' || (kind === 'gate' && !gateOpen);
}
