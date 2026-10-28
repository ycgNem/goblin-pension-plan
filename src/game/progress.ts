import { CHAPTER_1, type CharterCheck, type CharterStep } from '../data/charter';
import type { SaveData } from './save';

export function isCheckMet(check: CharterCheck, save: SaveData): boolean {
  switch (check.kind) {
    case 'upgrade':
      return save.upgrades.includes(check.id);
    case 'flag':
      return save.flags[check.flag] === true;
  }
}

/** The first unfinished Chapter 1 step, or null once every step is done. */
export function nextCharterStep(save: SaveData): CharterStep | null {
  return CHAPTER_1.steps.find((step) => !isCheckMet(step.check, save)) ?? null;
}

/** Which Charter steps are done, in Charter order. Steps can be finished in any order. */
export function charterDone(save: SaveData): boolean[] {
  return CHAPTER_1.steps.map((step) => isCheckMet(step.check, save));
}

export function charterProgress(save: SaveData): { done: number; total: number } {
  const done = CHAPTER_1.steps.filter((step) => isCheckMet(step.check, save)).length;
  return { done, total: CHAPTER_1.steps.length };
}

export interface Objective {
  title: string;
  text: string;
  done: number;
  total: number;
}

/**
 * What to do next, for the pinned objective. Read the letter, then the first three Charter steps,
 * then go and meet Grubb, then the rest of the Charter.
 */
export function currentObjective(save: SaveData): Objective {
  const { done, total } = charterProgress(save);
  if (!save.flags.readGrubbsLetter) return { title: 'THE BURROW', text: 'Read the letter by the door', done: 0, total: 0 };
  for (let i = 0; i < CHAPTER_1.steps.length; i++) {
    if (i === 3 && !save.flags.metGrubb) {
      return { title: 'BURROW CHARTER', text: 'See Registrar Grubb: the crawl pipe at the bottom of the Galleries', done, total };
    }
    const step = CHAPTER_1.steps[i]!;
    if (!isCheckMet(step.check, save)) return { title: 'BURROW CHARTER', text: step.objective, done, total };
  }
  return { title: 'BURROW CHARTER', text: save.flags.charterStamp1 ? 'Stamp #1 earned. The Burrow is yours to improve.' : 'Show Grubb the finished Charter', done, total };
}
