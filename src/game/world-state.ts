import { SHIFT_SECONDS } from '../data/economy';
import type { RegionId } from '../data/regions';
import type { SaveData } from './save';

// Things you use up (defeated creatures now, searched piles from M2) come back at the next Shift Bell.

export const shiftIndex = (playTime: number): number => Math.floor(playTime / SHIFT_SECONDS);

export const placementKey = (region: RegionId, col: number, row: number): string => `${region}:${col},${row}`;

export function isSpent(save: SaveData, key: string): boolean {
  return save.spent[key] === shiftIndex(save.playTime);
}

export function markSpent(save: SaveData, key: string): void {
  save.spent[key] = shiftIndex(save.playTime);
}

/** Forget entries from earlier shifts so the save doesn't grow forever. */
export function pruneSpent(save: SaveData): void {
  const now = shiftIndex(save.playTime);
  for (const key of Object.keys(save.spent)) {
    if (save.spent[key] !== now) delete save.spent[key];
  }
}
