import { HATCH_BUYS, HATCH_SELLS, hatchPrice, OCCUPANCY_STEP } from '../data/economy';
import { ITEMS, ITEM_IDS, type ItemId } from '../data/items';
import { RETIREMENT_LEDGER } from '../data/charter';
import { UPGRADES, UPGRADE_IDS, type UpgradeDef, type UpgradeId } from '../data/upgrades';
import { upgradeLocks } from './crafting';
import { addToPack, isKeyItem, packCount, packRoom, removeFromPack } from './inventory';
import type { SaveData } from './save';
import { shiftIndex } from './world-state';

// The Hatch, as pure transactions on the save. Dorrit buys from your pack (processed goods
// pay; raw materials fetch one button), each sale lowers the price, and demand resets at the
// Shift Bell. What she sells can't be made, and can't be turned back into more than it cost.

/** This shift's sales record, rolled over when a new shift has started. */
function ledger(save: SaveData): SaveData['trade'] {
  const shift = shiftIndex(save.playTime);
  if (save.trade.shift !== shift) save.trade = { shift, sold: {} };
  return save.trade;
}

export function soldThisShift(save: SaveData, item: ItemId): number {
  return ledger(save).sold[item] ?? 0;
}

/** What Dorrit pays for the next one of these. */
export function sellPrice(save: SaveData, item: ItemId): number {
  return hatchPrice(item, soldThisShift(save, item));
}

/** How many more she'll take at a real price this shift (0 for raw materials). */
export function demandLeft(save: SaveData, item: ItemId): number {
  const entry = HATCH_BUYS[item];
  return entry ? Math.max(0, entry.demand - soldThisShift(save, item)) : 0;
}

/** Things in the pack she'd take: anything but equipment and quest items. */
export function sellable(save: SaveData): ItemId[] {
  return ITEM_IDS.filter((id) => !isKeyItem(id) && packCount(save, id) > 0);
}

/** Sell one from the pack. Returns the price paid, or null if there's none to sell. */
export function sellOne(save: SaveData, item: ItemId): number | null {
  if (isKeyItem(item) || packCount(save, item) <= 0) return null;
  const price = sellPrice(save, item);
  removeFromPack(save, item, 1);
  const t = ledger(save);
  t.sold[item] = (t.sold[item] ?? 0) + 1;
  save.buttons += price;
  return price;
}

export type ShopEntry = { kind: 'item'; id: ItemId; price: number } | { kind: 'decor'; id: UpgradeId; price: number };

/** Everything on Dorrit's shelf right now. Equipment you own and decorations you've bought drop off. */
export function shopStock(save: SaveData): ShopEntry[] {
  const out: ShopEntry[] = [];
  for (const id of ITEM_IDS) {
    const sell = HATCH_SELLS[id];
    if (!sell) continue;
    if (isKeyItem(id) && packCount(save, id) > 0) continue;
    out.push({ kind: 'item', id, price: sell.price });
  }
  for (const id of UPGRADE_IDS) {
    const u: UpgradeDef = UPGRADES[id];
    if (u.price === undefined || save.upgrades.includes(id)) continue;
    out.push({ kind: 'decor', id, price: u.price });
  }
  return out;
}

/** Why an entry can't be bought right now, or null if it can. */
export function cantBuy(save: SaveData, e: ShopEntry): string | null {
  // What it hangs on comes before what it costs: saving up won't fix a missing sign.
  if (e.kind === 'decor') {
    const locks = upgradeLocks(save, e.id);
    if (locks.length > 0) return locks[0]!;
  }
  if (save.buttons < e.price) return 'Not enough buttons';
  if (e.kind === 'item' && packRoom(save, e.id) < 1) return 'No room in the pack';
  return null;
}

/** Buy one. All or nothing. */
export function buy(save: SaveData, e: ShopEntry): boolean {
  if (cantBuy(save, e) !== null) return false;
  save.buttons -= e.price;
  if (e.kind === 'item') addToPack(save, e.id, 1);
  else save.upgrades.push(e.id);
  return true;
}

export function shopName(e: ShopEntry): string {
  return e.kind === 'item' ? ITEMS[e.id].name : UPGRADES[e.id].name;
}

export function shopDesc(e: ShopEntry): string {
  return e.kind === 'item' ? ITEMS[e.id].desc : UPGRADES[e.id].desc;
}

/** Pay Grubb toward occupancy rights, a step at a time. Returns how much went in. */
export function payOccupancy(save: SaveData): number {
  const left = RETIREMENT_LEDGER.occupancyPrice - save.occupancy;
  const amount = Math.min(OCCUPANCY_STEP, left, save.buttons);
  if (amount <= 0) return 0;
  save.buttons -= amount;
  save.occupancy += amount;
  if (save.occupancy >= RETIREMENT_LEDGER.occupancyPrice) save.flags.occupancyPaid = true;
  return amount;
}
