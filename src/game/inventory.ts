import { ITEMS, ITEM_IDS, type ItemBag, type ItemDef, type ItemId } from '../data/items';
import type { Fee } from './defeat';
import type { SaveData } from './save';

// The pack, storage, and key items. Pure functions on the save, so tests can run them.
// Pack: 6 slots (9 with the Patched Satchel), one item type per slot, up to its stack size.
// Equipment and quest items are "key items": no slot, never lost.

export const PACK_SLOTS = 6;
export const SATCHEL_SLOTS = 9;

const def = (id: ItemId): ItemDef => ITEMS[id];

export function isKeyItem(id: ItemId): boolean {
  const c = def(id).category;
  return c === 'equipment' || c === 'quest';
}

export function packSlots(save: SaveData): number {
  return (save.keyItems.patchedSatchel ?? 0) > 0 ? SATCHEL_SLOTS : PACK_SLOTS;
}

export function packCount(save: SaveData, id: ItemId): number {
  if (isKeyItem(id)) return save.keyItems[id] ?? 0;
  let n = 0;
  for (const s of save.pack) if (s.item === id) n += s.qty;
  return n;
}

export function storageCount(save: SaveData, id: ItemId): number {
  return save.storage[id] ?? 0;
}

/** Everything you have of an item: pack and key items, plus storage when you're at home. */
export function haveCount(save: SaveData, id: ItemId, withStorage: boolean): number {
  return packCount(save, id) + (withStorage ? storageCount(save, id) : 0);
}

/** How many more of an item the pack can take. */
export function packRoom(save: SaveData, id: ItemId): number {
  if (isKeyItem(id)) return Infinity;
  const stack = def(id).stack;
  let room = 0;
  for (const s of save.pack) if (s.item === id) room += stack - s.qty;
  return room + (packSlots(save) - save.pack.length) * stack;
}

/** Add to the pack, topping up existing stacks before opening new slots. Returns how many fit. */
export function addToPack(save: SaveData, id: ItemId, qty: number): number {
  if (qty <= 0) return 0;
  if (isKeyItem(id)) {
    save.keyItems[id] = (save.keyItems[id] ?? 0) + qty;
    return qty;
  }
  const stack = def(id).stack;
  let left = qty;
  for (const s of save.pack) {
    if (s.item !== id || left === 0) continue;
    const add = Math.min(stack - s.qty, left);
    s.qty += add;
    left -= add;
  }
  while (left > 0 && save.pack.length < packSlots(save)) {
    const add = Math.min(stack, left);
    save.pack.push({ item: id, qty: add });
    left -= add;
  }
  return qty - left;
}

/** Remove from the pack, emptiest stacks first. Returns how many came out. */
export function removeFromPack(save: SaveData, id: ItemId, qty: number): number {
  if (isKeyItem(id)) {
    const take = Math.min(save.keyItems[id] ?? 0, qty);
    save.keyItems[id] = (save.keyItems[id] ?? 0) - take;
    if (save.keyItems[id] === 0) delete save.keyItems[id];
    return take;
  }
  let left = qty;
  const order = save.pack.map((s, i) => ({ s, i })).filter((e) => e.s.item === id).sort((a, b) => a.s.qty - b.s.qty);
  for (const { s } of order) {
    if (left === 0) break;
    const take = Math.min(s.qty, left);
    s.qty -= take;
    left -= take;
  }
  save.pack = save.pack.filter((s) => s.qty > 0);
  return qty - left;
}

export function addToStorage(save: SaveData, id: ItemId, qty: number): void {
  if (qty > 0) save.storage[id] = (save.storage[id] ?? 0) + qty;
}

/** Add to the pack, and whatever doesn't fit to storage. For things made at home. */
export function give(save: SaveData, id: ItemId, qty: number): { pack: number; storage: number } {
  const pack = addToPack(save, id, qty);
  addToStorage(save, id, qty - pack);
  return { pack, storage: qty - pack };
}

export function missingFor(save: SaveData, bag: ItemBag, withStorage: boolean): { item: ItemId; have: number; need: number }[] {
  const out: { item: ItemId; have: number; need: number }[] = [];
  for (const item of Object.keys(bag) as ItemId[]) {
    const need = bag[item] ?? 0;
    const have = haveCount(save, item, withStorage);
    if (have < need) out.push({ item, have, need });
  }
  return out;
}

export function canAfford(save: SaveData, bag: ItemBag, withStorage: boolean): boolean {
  return missingFor(save, bag, withStorage).length === 0;
}

/** Pay for a bag, all or nothing: storage first, then the pack. Returns false, changing nothing, if short. */
export function pay(save: SaveData, bag: ItemBag, withStorage: boolean): boolean {
  if (!canAfford(save, bag, withStorage)) return false;
  for (const item of Object.keys(bag) as ItemId[]) {
    let left = bag[item] ?? 0;
    if (withStorage) {
      const fromStorage = Math.min(storageCount(save, item), left);
      save.storage[item] = storageCount(save, item) - fromStorage;
      if (save.storage[item] === 0) delete save.storage[item];
      left -= fromStorage;
    }
    removeFromPack(save, item, left);
  }
  return true;
}

/** Put every material from the pack into storage. Food and throwables stay with you. Returns what moved. */
export function quickDeposit(save: SaveData): ItemBag {
  const moved: ItemBag = {};
  save.pack = save.pack.filter((s) => {
    if (def(s.item).category !== 'material') return true;
    moved[s.item] = (moved[s.item] ?? 0) + s.qty;
    addToStorage(save, s.item, s.qty);
    return false;
  });
  return moved;
}

/** Move up to `qty` of an item from storage into the pack. Returns how many moved. */
export function withdraw(save: SaveData, id: ItemId, qty: number): number {
  const n = addToPack(save, id, Math.min(qty, storageCount(save, id)));
  save.storage[id] = storageCount(save, id) - n;
  if (save.storage[id] === 0) delete save.storage[id];
  return n;
}

/**
 * The Rat Union's fee: half of each common material carried, rounded down.
 * Food, throwables, equipment, quest items, storage, and buttons are never touched.
 */
export function takeDefeatFee(save: SaveData): Fee[] {
  const fee: Fee[] = [];
  for (const id of ITEM_IDS) {
    if (!def(id).common || isKeyItem(id)) continue;
    const lose = Math.floor(packCount(save, id) / 2);
    if (lose <= 0) continue;
    removeFromPack(save, id, lose);
    fee.push({ item: id, name: def(id).name, qty: lose });
  }
  return fee;
}

/** The food to eat for this many missing half-hearts: the smallest that covers it, or else the biggest. */
export function pickFood(save: SaveData, missing: number): ItemId | null {
  const foods = ITEM_IDS.filter((id) => def(id).category === 'food' && packCount(save, id) > 0).sort((a, b) => (def(a).heal ?? 0) - (def(b).heal ?? 0));
  if (foods.length === 0) return null;
  return foods.find((id) => (def(id).heal ?? 0) >= missing) ?? foods[foods.length - 1]!;
}

export function packIsEmpty(save: SaveData): boolean {
  return save.pack.length === 0;
}
