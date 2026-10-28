import { BURROW_MAP } from '../world/maps/burrow';
import { CISTERN_MAP } from '../world/maps/cistern';
import { COOP_MAP } from '../world/maps/coop';
import { GALLERIES_MAP } from '../world/maps/galleries';
import { PUMPWORKS_MAP } from '../world/maps/pumpworks';
import type { TrackId } from '../audio/music';
import type { FlagId } from './flags';

export type RegionId = 'burrow' | 'galleries' | 'cistern' | 'pumpworks' | 'coop';

export interface ExitLink {
  to: RegionId;
  /** The exit glyph you arrive at in the target region. */
  exit: string;
  /** Goblin-only routes are drawn differently on the map screen. */
  crawl?: boolean;
}

export interface RegionDef {
  name: string;
  subtitle: string;
  map: readonly string[];
  exits: Record<string, ExitLink>;
  /** Every '=' tile in this region is open when this flag is set. */
  gateFlag?: FlagId;
  /** Exits that are only reachable through the gate (checked by tests). */
  gatedExits?: readonly string[];
  /** Safe regions never contain hostile spawns. */
  safe: boolean;
  /** How dark unlit places are: the base of the light map, multiplied over the scene. */
  darkness: string;
  music: TrackId;
}

export const REGIONS: Record<RegionId, RegionDef> = {
  burrow: {
    name: 'The Burrow',
    subtitle: 'NOT A LAIR',
    map: BURROW_MAP,
    exits: { '1': { to: 'galleries', exit: '1', crawl: true }, '2': { to: 'coop', exit: '2', crawl: true } },
    gateFlag: 'coopShortcutOpen',
    gatedExits: ['2'],
    safe: true,
    darkness: '#56605a',
    music: 'burrow',
  },
  galleries: {
    name: 'Refuse Galleries',
    subtitle: 'Where the city puts things it has finished with',
    map: GALLERIES_MAP,
    exits: { '1': { to: 'burrow', exit: '1', crawl: true }, '2': { to: 'cistern', exit: '1' }, '3': { to: 'coop', exit: '1', crawl: true } },
    safe: false,
    darkness: '#5c6056',
    music: 'dungeon',
  },
  cistern: {
    name: 'Fungus Cistern',
    subtitle: 'Damp, green, and growing',
    map: CISTERN_MAP,
    exits: { '1': { to: 'galleries', exit: '2' }, '2': { to: 'pumpworks', exit: '1' }, '3': { to: 'pumpworks', exit: '2', crawl: true } },
    gateFlag: 'sluiceOpen',
    gatedExits: ['3'],
    safe: false,
    darkness: '#4a5a56',
    music: 'dungeon',
  },
  pumpworks: {
    name: 'Old Pumpworks',
    subtitle: 'Closed indefinitely. Unidentified clanking.',
    map: PUMPWORKS_MAP,
    exits: { '1': { to: 'cistern', exit: '2' }, '2': { to: 'cistern', exit: '3', crawl: true } },
    gateFlag: 'matronDefeated',
    safe: false,
    darkness: '#5e5046',
    music: 'dungeon',
  },
  coop: {
    name: 'Goblin Cooperative',
    subtitle: 'Office of Burrow Charters',
    map: COOP_MAP,
    exits: { '1': { to: 'galleries', exit: '3', crawl: true }, '2': { to: 'burrow', exit: '2', crawl: true } },
    gateFlag: 'coopShortcutOpen',
    gatedExits: ['2'],
    safe: true,
    darkness: '#86745f',
    music: 'coop',
  },
};

export const REGION_IDS = Object.keys(REGIONS) as RegionId[];
export const START_REGION: RegionId = 'burrow';
/** Arriving here restores health, and the Rat Union drags you here when you're defeated. */
export const HOME_REGION: RegionId = 'burrow';
