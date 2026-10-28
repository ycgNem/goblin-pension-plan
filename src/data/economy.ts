import type { ItemId } from './items';

// The Hatch (Dorrit Vane). Prices are in Brass Buttons.
// Anti-exploit: only processed goods sell for real money, demand resets each shift,
// and every sale lowers the price. Tests brute-force buy -> craft -> sell loops.

/** Seconds of active play per shift. The Shift Bell rings at each change. */
export const SHIFT_SECONDS = 480;

/** Anything not in HATCH_BUYS sells for this. */
export const RAW_SELL_PRICE = 1;

/** Multiplier applied to the price after each unit sold in a shift. */
export const PRICE_DECAY = 0.85;

export const HATCH_BUYS: Partial<Record<ItemId, { price: number; demand: number }>> = {
  glowcapSkewer: { price: 3, demand: 5 },
  driedRation: { price: 6, demand: 5 },
  truffleStew: { price: 14, demand: 3 },
  slimeGlue: { price: 4, demand: 5 },
  slimeCell: { price: 12, demand: 3 },
  fertilizer: { price: 4, demand: 5 },
  stinkbrew: { price: 10, demand: 2 },
};

/** Items you can't make yourself. None of them can be broken down for profit. */
export const HATCH_SELLS: Partial<Record<ItemId, { price: number }>> = {
  truffleSpores: { price: 16 },
  copper: { price: 6 },
  bottle: { price: 3 },
  cloth: { price: 4 },
  bandolier: { price: 35 },
};

/** Grubb takes payments toward occupancy rights in steps of this many buttons. */
export const OCCUPANCY_STEP = 25;

/** Price for the nth unit (0-based) sold this shift. */
export function hatchPrice(item: ItemId, soldThisShift: number): number {
  const entry = HATCH_BUYS[item];
  if (!entry) return RAW_SELL_PRICE;
  if (soldThisShift >= entry.demand) return RAW_SELL_PRICE;
  return Math.max(RAW_SELL_PRICE, Math.floor(entry.price * Math.pow(PRICE_DECAY, soldThisShift)));
}
