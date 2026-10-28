import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import {
  addToPack,
  canAfford,
  give,
  haveCount,
  packCount,
  packRoom,
  PACK_SLOTS,
  pay,
  pickFood,
  quickDeposit,
  removeFromPack,
  SATCHEL_SLOTS,
  takeDefeatFee,
  withdraw,
} from '../src/game/inventory';
import { newSave } from '../src/game/save';
import { Scene } from '../src/game/scene';
import { TILE } from '../src/world/tiles';
import { room, seededRng } from './helpers';

describe('the pack', () => {
  it('tops up existing stacks before opening new slots', () => {
    const save = newSave();
    addToPack(save, 'scrap', 15);
    addToPack(save, 'scrap', 8);
    expect(save.pack).toEqual([
      { item: 'scrap', qty: 20 },
      { item: 'scrap', qty: 3 },
    ]);
  });

  it('takes what fits when full, and says how much', () => {
    const save = newSave();
    for (let i = 0; i < PACK_SLOTS - 1; i++) addToPack(save, 'timber', ITEMS.timber.stack);
    expect(addToPack(save, 'bone', 25)).toBe(20);
    expect(save.pack.length).toBe(PACK_SLOTS);
    expect(addToPack(save, 'bone', 1)).toBe(0);
    expect(packRoom(save, 'bone')).toBe(0);
  });

  it('the Patched Satchel adds slots', () => {
    const save = newSave();
    addToPack(save, 'patchedSatchel', 1);
    for (let i = 0; i < SATCHEL_SLOTS; i++) expect(addToPack(save, 'scrap', 20)).toBe(20);
    expect(addToPack(save, 'scrap', 1)).toBe(0);
  });

  it('equipment and quest items never take a slot', () => {
    const save = newSave();
    for (let i = 0; i < PACK_SLOTS; i++) addToPack(save, 'scrap', 20);
    expect(addToPack(save, 'modNailSpread', 1)).toBe(1);
    expect(addToPack(save, 'flywheelCoil', 1)).toBe(1);
    expect(save.pack.length).toBe(PACK_SLOTS);
    expect(packCount(save, 'flywheelCoil')).toBe(1);
  });

  it('removes from the emptiest stack first', () => {
    const save = newSave();
    save.pack = [
      { item: 'scrap', qty: 20 },
      { item: 'scrap', qty: 2 },
    ];
    expect(removeFromPack(save, 'scrap', 3)).toBe(3);
    expect(save.pack).toEqual([{ item: 'scrap', qty: 19 }]);
  });
});

describe('things on the floor', () => {
  it('a dropped stack stays put until the goblin walks away, then comes back to the pack like anything else', () => {
    const save = newSave();
    let got = 0;
    const scene = new Scene('galleries', room(20, 6), save, {
      hurtPlayer: () => false,
      creatureHit: () => {},
      creatureKilled: () => {},
      pickup: (_item, qty) => {
        got += qty;
        return qty;
      },
    }, seededRng(1));
    const at = { x: 5 * TILE, y: 3 * TILE };
    scene.placePickup('bone', 4, at.x, at.y + 4, true);
    for (let i = 0; i < 120; i++) scene.update(1 / 60, { ...at, alive: true });
    expect(got).toBe(0);
    for (let i = 0; i < 30; i++) scene.update(1 / 60, { x: at.x + 120, y: at.y, alive: true });
    for (let i = 0; i < 120; i++) scene.update(1 / 60, { ...at, alive: true });
    expect(got).toBe(4);
    expect(scene.pickups).toEqual([]);
  });
});

describe('storage', () => {
  it('quick deposit stores materials and keeps food and throwables on you', () => {
    const save = newSave();
    addToPack(save, 'scrap', 5);
    addToPack(save, 'glowcapSkewer', 2);
    addToPack(save, 'bottle', 1);
    const moved = quickDeposit(save);
    expect(moved).toEqual({ scrap: 5 });
    expect(save.storage.scrap).toBe(5);
    expect(save.pack.map((s) => s.item).sort()).toEqual(['bottle', 'glowcapSkewer']);
  });

  it('withdraw moves only what the pack can hold', () => {
    const save = newSave();
    save.storage.scrap = 50;
    for (let i = 0; i < PACK_SLOTS - 1; i++) addToPack(save, 'timber', 20);
    expect(withdraw(save, 'scrap', 50)).toBe(20);
    expect(save.storage.scrap).toBe(30);
  });

  it('things made at home overflow into storage', () => {
    const save = newSave();
    for (let i = 0; i < PACK_SLOTS; i++) addToPack(save, 'timber', 20);
    expect(give(save, 'glowcap', 4)).toEqual({ pack: 0, storage: 4 });
    expect(save.storage.glowcap).toBe(4);
  });
});

describe('paying', () => {
  it('is all or nothing', () => {
    const save = newSave();
    addToPack(save, 'scrap', 5);
    const before = JSON.stringify(save);
    expect(pay(save, { scrap: 2, timber: 1 }, true)).toBe(false);
    expect(JSON.stringify(save)).toBe(before);
  });

  it('takes from storage before the pack', () => {
    const save = newSave();
    save.storage.scrap = 3;
    addToPack(save, 'scrap', 5);
    expect(pay(save, { scrap: 4 }, true)).toBe(true);
    expect(save.storage.scrap).toBeUndefined();
    expect(packCount(save, 'scrap')).toBe(4);
  });

  it('away from home only the pack counts', () => {
    const save = newSave();
    save.storage.scrap = 10;
    expect(canAfford(save, { scrap: 2 }, false)).toBe(false);
    expect(canAfford(save, { scrap: 2 }, true)).toBe(true);
    expect(haveCount(save, 'scrap', true)).toBe(10);
  });
});

describe('the Rat Union fee', () => {
  it('takes half of each common material, rounded down, and nothing else', () => {
    const save = newSave();
    addToPack(save, 'scrap', 5);
    addToPack(save, 'timber', 1);
    addToPack(save, 'truffleSpores', 4);
    addToPack(save, 'glowcapSkewer', 3);
    addToPack(save, 'bottle', 2);
    addToPack(save, 'modNailSpread', 1);
    addToPack(save, 'flywheelCoil', 1);
    save.storage.scrap = 40;
    save.buttons = 12;

    const fee = takeDefeatFee(save);
    expect(fee).toEqual([{ item: 'scrap', name: 'Scrap Metal', qty: 2 }]);
    expect(packCount(save, 'scrap')).toBe(3);
    expect(packCount(save, 'timber')).toBe(1);
    expect(packCount(save, 'truffleSpores')).toBe(4);
    expect(packCount(save, 'glowcapSkewer')).toBe(3);
    expect(packCount(save, 'bottle')).toBe(2);
    expect(packCount(save, 'modNailSpread')).toBe(1);
    expect(packCount(save, 'flywheelCoil')).toBe(1);
    expect(save.storage.scrap).toBe(40);
    expect(save.buttons).toBe(12);
  });
});

describe('eating', () => {
  it('picks the smallest food that covers the damage, or the biggest there is', () => {
    const save = newSave();
    expect(pickFood(save, 2)).toBeNull();
    addToPack(save, 'glowcapSkewer', 1);
    addToPack(save, 'driedRation', 1);
    expect(pickFood(save, 1)).toBe('glowcapSkewer');
    expect(pickFood(save, 3)).toBe('driedRation');
    expect(pickFood(save, 9)).toBe('driedRation');
  });
});
