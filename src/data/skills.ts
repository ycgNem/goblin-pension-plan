export interface SkillDef {
  name: string;
  desc: string;
  /** Named unlocks. Every milestone is a new capability, never a small percentage bump. */
  milestones: readonly { level: number; text: string }[];
}

export const SKILL_MAX_LEVEL = 10;

export const SKILLS = {
  scavenging: {
    name: 'Scavenging',
    desc: 'Knowing what rubbish is worth. Includes mining.',
    milestones: [
      { level: 1, text: 'Search junk piles and crates' },
      { level: 3, text: 'Strip copper from old machinery' },
      { level: 4, text: 'Pry open reinforced scrap piles' },
      { level: 6, text: 'One extra item from every pile' },
    ],
  },
  fungiculture: {
    name: 'Fungiculture',
    desc: 'Growing things in the dark, on purpose.',
    milestones: [
      { level: 1, text: 'Plant Glowcaps in a mushroom bed' },
      { level: 3, text: 'Plant Brine Truffle spores' },
      { level: 5, text: 'Build a second mushroom bed' },
    ],
  },
  tinkering: {
    name: 'Tinkering',
    desc: 'Tools, machines, and improvements nobody asked for.',
    milestones: [
      { level: 2, text: 'Craft the Nail Spread mod' },
      { level: 3, text: 'Sew a Patched Satchel; turn the Cistern valve wheel' },
      { level: 4, text: 'Craft the Slime Shot mod' },
      { level: 5, text: 'Build a Bone Grinder' },
    ],
  },
  cooking: {
    name: 'Cooking',
    desc: 'Food, medicine, and anything that bubbles. Includes brewing.',
    milestones: [
      { level: 1, text: 'Glowcap Skewers' },
      { level: 2, text: 'Build a Drying Rack' },
      { level: 3, text: 'Truffle Stew (needs the Shield Frying Pan)' },
      { level: 5, text: 'Brew Stinkbrew' },
    ],
  },
  scrapping: {
    name: 'Scrapping',
    desc: 'Fighting, goblin-style: early, often, and from behind.',
    milestones: [
      { level: 2, text: 'Faster dodge recovery' },
      { level: 4, text: 'Charged shot (hold right mouse)' },
      { level: 6, text: '+1 heart' },
    ],
  },
} as const satisfies Record<string, SkillDef>;

export type SkillId = keyof typeof SKILLS;
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

/** Total XP needed to reach `level`. Level 1 is free. */
export function xpForLevel(level: number): number {
  return level <= 1 ? 0 : Math.round(40 * Math.pow(level - 1, 1.6));
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < SKILL_MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}
