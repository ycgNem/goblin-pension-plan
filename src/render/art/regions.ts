import type { RegionId } from '../../data/regions';
import type { TilesetId } from './sheets.gen';

// Which generated tilesets draw each region's terrain. Regions without an entry use the
// procedural styles in world-renderer.ts.

export interface RegionTerrain {
  /** Two floor materials; the second (the tileset's upper terrain) shows in patches. */
  floor: TilesetId;
  /** Roughly how much of the floor the patches cover, 0 to 1. */
  patches: number;
  /** The generator painted the two floor materials the other way round: use upper as the base. */
  invert?: boolean;
  /** A raised set: wall tops and faces over low ground that matches the floor (or is cleared to show it). */
  walls: TilesetId;
  /** A flat set of water (lower) against the floor (upper), drawn where the map has sludge. */
  water?: TilesetId;
}

export const REGION_TERRAIN: Partial<Record<RegionId, RegionTerrain>> = {
  burrow: { floor: 'burrow_floor', patches: 0.2, invert: true, walls: 'burrow_walls' },
  galleries: { floor: 'galleries_floor', patches: 0.3, walls: 'galleries_walls' },
  cistern: { floor: 'cistern_floor', patches: 0.3, walls: 'cistern_walls', water: 'cistern_water' },
  pumpworks: { floor: 'pumpworks_floor', patches: 0.3, walls: 'pumpworks_walls' },
  coop: { floor: 'coop_floor', patches: 0.12, walls: 'coop_walls' },
};
