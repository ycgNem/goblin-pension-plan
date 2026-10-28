import { PLAYER } from '../data/combat';
import type { Flags } from '../data/flags';
import type { ItemBag, ItemId } from '../data/items';
import type { NodeId } from '../data/nodes';
import type { RecipeId } from '../data/recipes';
import { START_REGION, type RegionId } from '../data/regions';
import type { SkillId } from '../data/skills';
import type { HintId } from '../data/story';
import type { UpgradeId } from '../data/upgrades';

// Everything that persists. Runtime-only state (enemies, projectiles, NPC awareness) never goes in here.
// Fields added later get their defaults from newSave() when an older save is loaded.

export const SAVE_VERSION = 1;
const SAVE_KEY = 'goblin-pension-plan.save';

export interface PackSlot {
  item: ItemId;
  qty: number;
}

/** A timed job at a production station. Done once playTime reaches `end`. */
export interface Job {
  recipe: RecipeId;
  end: number;
}

export type ProductionStation = 'mushroomBed' | 'dryingRack' | 'boneGrinder';

export type Tracked = { kind: 'recipe'; id: RecipeId } | { kind: 'upgrade'; id: UpgradeId };

/** Something an event left behind, there for the rest of the shift. */
export interface EventNode {
  key: string;
  region: RegionId;
  col: number;
  row: number;
  node: NodeId;
  shift: number;
}

export interface SaveData {
  version: number;
  region: RegionId;
  /** Player position in world pixels. Null means use the region's default spawn. */
  pos: { x: number; y: number } | null;
  /** Half-hearts. Clamped to the current maximum on load. */
  hp: number;
  flags: Flags;
  /** Placements used up this shift (defeated creatures, searched piles), by world-state placementKey. */
  spent: Record<string, number>;
  /** Materials, food, and throwables. Each slot holds one item type up to its stack size. */
  pack: PackSlot[];
  storage: ItemBag;
  /** Equipment and quest items. They never take a pack slot and are never lost. */
  keyItems: ItemBag;
  buttons: number;
  skillXp: Partial<Record<SkillId, number>>;
  upgrades: UpgradeId[];
  equippedMod: ItemId | null;
  /** Seconds of active play. The Shift Bell and production timers run off this. */
  playTime: number;
  visited: RegionId[];
  /** Hints already shown. */
  hints: HintId[];
  production: Partial<Record<ProductionStation, Job[]>>;
  tracked: Tracked | null;
  /** The event director's record for one shift. */
  event: { shift: number; status: 'pending' | 'done' };
  eventNodes: EventNode[];
  grubbVisits: number;
  stats: { defeated: number; searched: number; crafted: number; built: number; defeats: number };
}

export function newSave(): SaveData {
  return {
    version: SAVE_VERSION,
    region: START_REGION,
    pos: null,
    hp: PLAYER.baseHearts * 2,
    flags: {},
    spent: {},
    pack: [],
    storage: {},
    keyItems: {},
    buttons: 0,
    skillXp: {},
    upgrades: [],
    equippedMod: null,
    playTime: 0,
    visited: [],
    hints: [],
    production: {},
    tracked: null,
    event: { shift: 0, status: 'pending' },
    eventNodes: [],
    grubbVisits: 0,
    stats: { defeated: 0, searched: 0, crafted: 0, built: 0, defeats: 0 },
  };
}

export function serializeSave(data: SaveData): string {
  return JSON.stringify(data);
}

/** Read a save from text. Missing fields take their defaults; unknown versions are rejected. */
export function parseSave(raw: string): SaveData | null {
  try {
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (typeof data !== 'object' || data === null) return null;
    if (data.version !== SAVE_VERSION) return migrate(data);
    const fresh = newSave();
    return { ...fresh, ...data, stats: { ...fresh.stats, ...data.stats } };
  } catch {
    return null;
  }
}

/** Storage can throw (private mode, blocked site data), so every access is guarded. */
export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? parseSave(raw) : null;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return loadSave() !== null;
}

export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, serializeSave(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Upgrade older saves here as SAVE_VERSION increases. Unknown versions start fresh. */
function migrate(_data: Partial<SaveData>): SaveData | null {
  return null;
}
