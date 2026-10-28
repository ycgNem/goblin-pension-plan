import type { HumanId } from './enemies';
import type { NodeId } from './nodes';
import type { RegionId } from './regions';

// The living dungeon. One event per shift, in rotation, posted on the Activity Board a shift ahead.
// Coordinates are map tiles. Every event plays out live if you're there, and resolves on its own if not.

export type EventId = 'beginnerContract' | 'pipeInspection' | 'noisyFight';

export interface EventDef {
  name: string;
  region: RegionId;
  party: readonly HumanId[];
  board: { kind: string; text: string };
  /** The warning strip when they arrive. */
  warning: string;
  /** Seconds into the shift when it starts. */
  startAt: number;
  /** Waypoints from the access point to the objective. The last one is where they work or fight. */
  route: readonly (readonly [number, number])[];
  /** The objective area: creatures inside it are what the party came for. Radius in tiles. */
  zone: { col: number; row: number; r: number };
  /** What it leaves behind (about one pile's worth each). */
  leftovers: readonly { node: NodeId; col: number; row: number }[];
  /** Seconds spent at the objective before heading home. */
  work: number;
}

export const EVENTS: Record<EventId, EventDef> = {
  beginnerContract: {
    name: 'Beginner Contract',
    region: 'galleries',
    party: ['paladin', 'ranger', 'apprentice'],
    board: { kind: 'BEGINNER CONTRACT', text: 'Rat nest, Refuse Galleries. Suitable for new adventurers. Low-level content.' },
    warning: 'Footsteps above. A party is coming down into the Refuse Galleries.',
    startAt: 80,
    route: [[14, 2], [16, 4], [19, 6], [27, 6]],
    zone: { col: 31, row: 6, r: 5 },
    leftovers: [{ node: 'bonePile', col: 29, row: 7 }, { node: 'clothBundle', col: 27, row: 5 }, { node: 'smashedCrate', col: 33, row: 4 }],
    work: 12,
  },
  pipeInspection: {
    name: 'Pipe Inspection',
    region: 'cistern',
    party: ['inspector'],
    board: { kind: 'MAINTENANCE NOTICE', text: 'Cistern sluice inspection this shift. Gate may be open. Please do not touch the gate.' },
    warning: 'A tuneless whistle. An inspector is coming down into the Fungus Cistern.',
    startAt: 60,
    route: [[12, 2], [16, 4], [24, 5], [37, 6], [40, 8]],
    zone: { col: 40, row: 8, r: 2 },
    leftovers: [],
    work: 80,
  },
  noisyFight: {
    name: 'Slime Advisory',
    region: 'cistern',
    party: ['paladin', 'apprentice'],
    board: { kind: 'ADVISORY', text: 'Slime activity reported in the Cistern main hall. Reward for gel samples.' },
    warning: 'Footsteps above. A party is coming down into the Fungus Cistern.',
    startAt: 80,
    route: [[12, 2], [15, 4], [20, 5], [25, 5]],
    zone: { col: 22, row: 5, r: 8 },
    leftovers: [{ node: 'gelPuddle', col: 18, row: 4 }, { node: 'gelPuddle', col: 25, row: 6 }],
    work: 14,
  },
};

export const EVENT_IDS = Object.keys(EVENTS) as EventId[];

/** Shift 0 is the Beginner Contract (story-gated); then the rotation continues. */
export const EVENT_ROTATION: readonly EventId[] = ['beginnerContract', 'pipeInspection', 'noisyFight'];

export function eventForShift(shift: number): EventId {
  return EVENT_ROTATION[shift % EVENT_ROTATION.length]!;
}

/** Heroes never appear this close to the goblin (tiles). They wait at the grate until you move off. */
export const SPAWN_SAFE_TILES = 6;

/** Creatures this close to a fight (px) are drawn toward the noise. */
export const FIGHT_PULL_RADIUS = 220;
