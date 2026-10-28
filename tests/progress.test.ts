import { describe, expect, it } from 'vitest';
import { CHAPTER_1 } from '../src/data/charter';
import { charterProgress, nextCharterStep } from '../src/game/progress';
import { newSave } from '../src/game/save';

describe('charter progress', () => {
  it('a new save starts on step one', () => {
    const save = newSave();
    expect(nextCharterStep(save)).toBe(CHAPTER_1.steps[0]);
    expect(charterProgress(save)).toEqual({ done: 0, total: 6 });
  });

  it('finishing every step leaves no objective', () => {
    const save = newSave();
    for (const step of CHAPTER_1.steps) {
      if (step.check.kind === 'upgrade') save.upgrades.push(step.check.id);
      else save.flags[step.check.flag] = true;
    }
    expect(nextCharterStep(save)).toBeNull();
    expect(charterProgress(save).done).toBe(6);
  });

  it('steps can be finished out of order', () => {
    const save = newSave();
    save.upgrades.push('repairWorkbench');
    expect(nextCharterStep(save)?.title).toBe('Repair the home');
    expect(charterProgress(save).done).toBe(1);
  });
});
