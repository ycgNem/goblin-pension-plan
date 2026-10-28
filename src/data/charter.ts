import type { FlagId } from './flags';
import type { ItemBag } from './items';
import type { UpgradeId } from './upgrades';

export type CharterCheck =
  | { kind: 'upgrade'; id: UpgradeId }
  | { kind: 'flag'; flag: FlagId };

export interface CharterStep {
  title: string;
  /** Shown as the pinned objective while this is the next unfinished step. */
  objective: string;
  check: CharterCheck;
}

export interface OrderDef {
  name: string;
  giver: string;
  items: ItemBag;
  rewardButtons: number;
  flag: FlagId;
}

export const ORDERS = {
  coopOrder1: {
    name: 'Cooperative Supply Order #1',
    giver: 'Registrar Grubb',
    items: { driedRation: 4, slimeCell: 2 },
    rewardButtons: 40,
    flag: 'coopOrder1Delivered',
  },
} as const satisfies Record<string, OrderDef>;

export type OrderId = keyof typeof ORDERS;

export const CHAPTER_1 = {
  title: 'A Recognized Workshop',
  stampFlag: 'charterStamp1' as FlagId,
  steps: [
    { title: 'Repair the home', objective: 'Patch the holes in the Burrow (Board Patch)', check: { kind: 'upgrade', id: 'patchHoles' } },
    { title: 'Build a mushroom bed', objective: 'Build a Mushroom Bed', check: { kind: 'upgrade', id: 'mushroomBed' } },
    { title: 'Construct a scrap workbench', objective: 'Repair the Scrap Workbench', check: { kind: 'upgrade', id: 'repairWorkbench' } },
    { title: 'Recover a power component', objective: 'Find the Flywheel Coil: Cistern, then the pipe down', check: { kind: 'flag', flag: 'flywheelRecovered' } },
    { title: 'Activate the slime generator', objective: 'Build and fuel the Slime Generator', check: { kind: 'flag', flag: 'generatorActive' } },
    { title: 'Complete a production order', objective: 'Deliver 4 Dried Rations and 2 Slime Cells to Grubb', check: { kind: 'flag', flag: 'coopOrder1Delivered' } },
  ] satisfies CharterStep[],
};

export const RETIREMENT_LEDGER = {
  pillars: [
    { text: 'Secure food production', chapter: 1 },
    { text: 'Reliable workshop power', chapter: 1 },
    { text: 'A functioning workshop', chapter: 1 },
    { text: 'A protected entrance', chapter: 2 },
    { text: 'A trusted trading partner', chapter: 2 },
    { text: 'Occupancy rights: 600 Buttons', chapter: 3 },
  ],
  personal: [
    'Have at least one legal wall',
    'Own two bowls',
    'Sleep through one night without being stepped on',
    'Sit in a chair that is far too grand for the room',
  ],
  occupancyPrice: 600,
};
