import { describe, expect, it } from 'vitest';
import { addToPack } from '../src/game/inventory';
import { newSave, parseSave, SAVE_VERSION, serializeSave } from '../src/game/save';

describe('saves', () => {
  it('round-trip everything', () => {
    const save = newSave();
    save.region = 'cistern';
    save.pos = { x: 120, y: 64 };
    save.flags.metGrubb = true;
    addToPack(save, 'scrap', 7);
    save.storage.timber = 12;
    save.keyItems.modNailSpread = 1;
    save.upgrades.push('patchHoles');
    save.production.mushroomBed = [{ recipe: 'plantGlowcap', end: 400 }];
    save.tracked = { kind: 'upgrade', id: 'mushroomBed' };
    save.eventNodes.push({ key: 'galleries:evt:beginnerContract:0:0', region: 'galleries', col: 29, row: 7, node: 'bonePile', shift: 0 });
    save.hints.push('move');
    save.visited.push('burrow', 'galleries');
    save.stats.defeated = 9;
    expect(parseSave(serializeSave(save))).toEqual(save);
  });

  it('fill in anything an older save is missing', () => {
    const old = { version: SAVE_VERSION, region: 'burrow', playTime: 99, stats: { defeated: 3 } };
    const save = parseSave(JSON.stringify(old))!;
    expect(save.playTime).toBe(99);
    expect(save.hints).toEqual([]);
    expect(save.eventNodes).toEqual([]);
    expect(save.production).toEqual({});
    expect(save.stats).toEqual({ defeated: 3, searched: 0, crafted: 0, built: 0, defeats: 0 });
  });

  it('reject garbage and unknown versions', () => {
    expect(parseSave('not json')).toBeNull();
    expect(parseSave('null')).toBeNull();
    expect(parseSave(JSON.stringify({ version: SAVE_VERSION + 1 }))).toBeNull();
  });
});
