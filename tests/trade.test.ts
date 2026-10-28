import { describe, expect, it } from 'vitest';
import { RETIREMENT_LEDGER } from '../src/data/charter';
import { HATCH_BUYS, HATCH_SELLS, hatchPrice, OCCUPANCY_STEP, RAW_SELL_PRICE, SHIFT_SECONDS } from '../src/data/economy';
import { ITEMS } from '../src/data/items';
import { UPGRADES, type UpgradeDef, type UpgradeId } from '../src/data/upgrades';
import { canCraft, craft, feedGenerator, gelsToFill, GENERATOR, recipeLocks } from '../src/game/crafting';
import { addToPack, packCount, PACK_SLOTS, stackSize } from '../src/game/inventory';
import { newSave, type SaveData } from '../src/game/save';
import { buy, cantBuy, demandLeft, payOccupancy, sellable, sellOne, sellPrice, shopStock, type ShopEntry } from '../src/game/trade';

const item = (id: keyof typeof HATCH_SELLS): ShopEntry => ({ kind: 'item', id, price: HATCH_SELLS[id]!.price });
const decor = (id: UpgradeId): ShopEntry => {
  const u: UpgradeDef = UPGRADES[id];
  return { kind: 'decor', id, price: u.price! };
};

describe('selling at the Hatch', () => {
  it('each sale lowers the price, and demand comes back with the Shift Bell', () => {
    const save = newSave();
    addToPack(save, 'driedRation', 8);
    const demand = HATCH_BUYS.driedRation!.demand;
    const paid: number[] = [];
    for (let i = 0; i < demand + 1; i++) paid.push(sellOne(save, 'driedRation')!);
    for (let i = 1; i < paid.length; i++) expect(paid[i]).toBeLessThanOrEqual(paid[i - 1]!);
    expect(paid[0]).toBe(HATCH_BUYS.driedRation!.price);
    expect(paid[demand]).toBe(RAW_SELL_PRICE);
    expect(save.buttons).toBe(paid.reduce((a, b) => a + b, 0));
    expect(demandLeft(save, 'driedRation')).toBe(0);

    save.playTime += SHIFT_SECONDS;
    expect(demandLeft(save, 'driedRation')).toBe(demand);
    expect(sellPrice(save, 'driedRation')).toBe(HATCH_BUYS.driedRation!.price);
  });

  it('raw materials fetch the raw price, every time', () => {
    const save = newSave();
    addToPack(save, 'scrap', 5);
    for (let i = 0; i < 5; i++) expect(sellOne(save, 'scrap')).toBe(RAW_SELL_PRICE);
    expect(demandLeft(save, 'scrap')).toBe(0);
  });

  it('never buys equipment or quest items, or what you do not have', () => {
    const save = newSave();
    addToPack(save, 'flywheelCoil', 1);
    addToPack(save, 'modNailSpread', 1);
    expect(sellable(save)).toEqual([]);
    expect(sellOne(save, 'flywheelCoil')).toBeNull();
    expect(sellOne(save, 'glowcap')).toBeNull();
    expect(save.buttons).toBe(0);
  });

  it('nothing she sells can be sold back for more than it cost', () => {
    for (const [id, entry] of Object.entries(HATCH_SELLS)) {
      expect(hatchPrice(id as keyof typeof ITEMS, 0), id).toBeLessThanOrEqual(entry!.price);
    }
  });
});

describe('buying at the Hatch', () => {
  it('is all or nothing: buttons first, then room in the pack', () => {
    const save = newSave();
    save.buttons = 2;
    expect(cantBuy(save, item('bottle'))).toBe('Not enough buttons');
    expect(buy(save, item('bottle'))).toBe(false);
    expect(save.buttons).toBe(2);

    save.buttons = 100;
    for (let i = 0; i < PACK_SLOTS; i++) addToPack(save, 'scrap', ITEMS.scrap.stack);
    expect(cantBuy(save, item('cloth'))).toBe('No room in the pack');
    expect(buy(save, item('cloth'))).toBe(false);
    expect(save.buttons).toBe(100);
  });

  it('decorations go straight into the Burrow, once, and wait for what they hang on', () => {
    const save = newSave();
    save.buttons = 100;
    expect(buy(save, decor('wallClock'))).toBe(true);
    expect(save.upgrades).toContain('wallClock');
    expect(save.buttons).toBe(100 - UPGRADES.wallClock.price);
    expect(shopStock(save).some((e) => e.id === 'wallClock')).toBe(false);

    // What it hangs on comes first, even when you're also short of buttons.
    save.buttons = 0;
    expect(cantBuy(save, decor('gildedPlaque'))).not.toBe('Not enough buttons');
    save.buttons = 100;
    save.upgrades.push('notALairSign');
    expect(buy(save, decor('gildedPlaque'))).toBe(true);
  });

  it('the Bottle Bandolier is bought once and lets bottles stack to five', () => {
    const save = newSave();
    save.buttons = 100;
    const before = stackSize(save, 'bottle');
    expect(buy(save, item('bandolier'))).toBe(true);
    expect(shopStock(save).some((e) => e.id === 'bandolier')).toBe(false);
    expect(stackSize(save, 'bottle')).toBe(5);
    expect(stackSize(save, 'bottle')).toBeGreaterThan(before);
    expect(addToPack(save, 'bottle', 5)).toBe(5);
    expect(save.pack.filter((s) => s.item === 'bottle')).toHaveLength(1);
  });
});

describe('occupancy rights', () => {
  it(`are paid ${OCCUPANCY_STEP} buttons at a time, and never more than you have or owe`, () => {
    const save = newSave();
    save.buttons = 10;
    expect(payOccupancy(save)).toBe(10);
    expect(save.buttons).toBe(0);
    expect(payOccupancy(save)).toBe(0);

    save.buttons = 10_000;
    let payments = 0;
    while (payOccupancy(save) > 0) payments++;
    expect(save.occupancy).toBe(RETIREMENT_LEDGER.occupancyPrice);
    expect(save.flags.occupancyPaid).toBe(true);
    expect(save.buttons).toBe(10_000 - (RETIREMENT_LEDGER.occupancyPrice - 10));
    expect(payments).toBe(Math.ceil((RETIREMENT_LEDGER.occupancyPrice - 10) / OCCUPANCY_STEP));
  });
});

describe('the Slime Generator', () => {
  function withGenerator(): SaveData {
    const save = newSave();
    save.upgrades.push('repairWorkbench', 'slimeGenerator');
    save.storage.slimeGel = 10;
    save.storage.scrap = 10;
    return save;
  }

  it(`holds ${GENERATOR.capacity} charge at ${GENERATOR.perGel} a gel, and tops off instead of refusing a gel`, () => {
    const save = withGenerator();
    expect(feedGenerator(save, 1, true)).toBe(GENERATOR.perGel);
    expect(save.flags.generatorActive).toBe(true);
    expect(feedGenerator(save, 99, true)).toBe(GENERATOR.capacity - GENERATOR.perGel);
    expect(save.charge).toBe(GENERATOR.capacity);
    expect(feedGenerator(save, 1, true)).toBe(0);

    save.charge = GENERATOR.capacity - 2;
    expect(gelsToFill(save)).toBe(1);
    const gel = save.storage.slimeGel;
    expect(feedGenerator(save, 1, true)).toBe(2);
    expect(save.storage.slimeGel).toBe(gel! - 1);
  });

  it('does nothing until it is built', () => {
    const save = newSave();
    save.storage.slimeGel = 5;
    expect(feedGenerator(save, 1, true)).toBe(0);
    expect(save.storage.slimeGel).toBe(5);
    expect(save.flags.generatorActive).toBeUndefined();
  });

  it('Slime Cells cost charge, and a dry generator stops only them, never basic recipes', () => {
    const save = withGenerator();
    save.storage.glowcap = 10;
    save.storage.timber = 10;
    expect(canCraft(save, 'slimeCell', true)).toBe(false);
    expect(recipeLocks(save, 'slimeCell')).toEqual([]);

    feedGenerator(save, 1, true);
    const charge = save.charge;
    expect(craft(save, 'slimeCell', true)).not.toBeNull();
    expect(save.charge).toBe(charge - 2);
    expect(packCount(save, 'slimeCell')).toBe(1);

    save.charge = 0;
    expect(craft(save, 'slimeGlue', true)).not.toBeNull();
    expect(craft(save, 'glowcapSkewer', true)).not.toBeNull();
  });
});
