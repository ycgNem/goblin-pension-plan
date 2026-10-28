// Story and world flags. Upgrades are tracked separately (save.upgrades).

export const FLAGS = [
  /** Woke up in the Burrow: the opening is over. */
  'wokeUp',
  'readGrubbsLetter',
  'metGrubb',
  'metDorrit',
  /** Dorrit's merchant is back: the Hatch trades. */
  'hatchOpen',
  /** Grubb lets you use the back pipe between the Burrow and the Cooperative. */
  'coopShortcutOpen',
  /** Cistern sluice gate. Opened briefly by the inspector event, or for good with the valve wheel. */
  'sluiceOpen',
  'beginnerContractDone',
  /** Walked into the Pump Room and saw what's in it. */
  'matronSeen',
  'matronDefeated',
  'flywheelRecovered',
  'generatorActive',
  'coopOrder1Delivered',
  'charterStamp1',
  /** All 600 buttons paid to the Cooperative. */
  'occupancyPaid',
] as const;

export type FlagId = (typeof FLAGS)[number];
export type Flags = Partial<Record<FlagId, boolean>>;
