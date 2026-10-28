// Story and world flags. Upgrades are tracked separately (save.upgrades).

export const FLAGS = [
  /** Woke up in the Burrow: the opening is over. */
  'wokeUp',
  'readGrubbsLetter',
  'metGrubb',
  'metDorrit',
  /** Grubb lets you use the back pipe between the Burrow and the Cooperative. */
  'coopShortcutOpen',
  /** Cistern sluice gate. Opened briefly by the inspector event, or for good with the valve wheel. */
  'sluiceOpen',
  'beginnerContractDone',
  'matronDefeated',
  'flywheelRecovered',
  'generatorActive',
  'coopOrder1Delivered',
  'charterStamp1',
] as const;

export type FlagId = (typeof FLAGS)[number];
export type Flags = Partial<Record<FlagId, boolean>>;
