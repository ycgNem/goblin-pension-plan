import { clamp } from '../core/math';
import type { ItemId } from '../data/items';
import { RECIPES, STATION_QUEUE, type RecipeDef, type RecipeId } from '../data/recipes';
import { recipeLocks, type XpGain } from './crafting';
import { give, pay } from './inventory';
import type { Job, ProductionStation, SaveData } from './save';

// Timed stations. Jobs only advance while you play (they run off save.playTime), at home or away.
// Mushroom beds grow side by side, one crop per bed. Racks and grinders work through a queue.

export function parallel(station: ProductionStation): boolean {
  return station === 'mushroomBed';
}

export function capacity(save: SaveData, station: ProductionStation): number {
  if (station === 'mushroomBed') return save.upgrades.includes('secondBed') ? 2 : 1;
  return STATION_QUEUE[station];
}

export function jobsAt(save: SaveData, station: ProductionStation): readonly Job[] {
  return save.production[station] ?? [];
}

/** Start a timed recipe, paying for it now. False (and nothing changes) if locked, full, or short. */
export function startJob(save: SaveData, station: ProductionStation, recipe: RecipeId, withStorage: boolean): boolean {
  const r: RecipeDef = RECIPES[recipe];
  if (r.station !== station || !r.time) return false;
  if (recipeLocks(save, recipe).length > 0) return false;
  const list = jobsAt(save, station);
  if (list.length >= capacity(save, station)) return false;
  if (!pay(save, r.inputs, withStorage)) return false;
  const now = save.playTime;
  const after = parallel(station) ? now : list.reduce((m, j) => Math.max(m, j.end), now);
  save.production[station] = [...list, { recipe, end: after + r.time }];
  return true;
}

export interface JobView {
  job: Job;
  frac: number;
  done: boolean;
  /** Seconds left. */
  left: number;
}

export function jobProgress(save: SaveData, station: ProductionStation): JobView[] {
  return jobsAt(save, station).map((job) => {
    const r: RecipeDef = RECIPES[job.recipe];
    const time = r.time ?? 1;
    const start = job.end - time;
    const frac = clamp((save.playTime - start) / time, 0, 1);
    return { job, frac, done: save.playTime >= job.end, left: Math.max(0, job.end - save.playTime) };
  });
}

export function readyCount(save: SaveData, station: ProductionStation): number {
  return jobsAt(save, station).filter((j) => save.playTime >= j.end).length;
}

export interface Collected {
  item: ItemId;
  qty: number;
  xp: XpGain;
}

/** Hand over every finished job (pack first, then storage). */
export function collect(save: SaveData, station: ProductionStation): Collected[] {
  const out: Collected[] = [];
  const left: Job[] = [];
  for (const job of jobsAt(save, station)) {
    if (save.playTime < job.end) {
      left.push(job);
      continue;
    }
    const r: RecipeDef = RECIPES[job.recipe];
    give(save, r.output.item, r.output.qty);
    out.push({ item: r.output.item, qty: r.output.qty, xp: { skill: r.skill, amount: r.xp } });
  }
  save.production[station] = left;
  return out;
}
