import type { ItemId } from '../../data/items';
import type { SpriteDef } from '../sprites';

// Item icons, 10x10, light from the top left. 'o' is always the outline.

const O = '#141410';

function icon(palette: Record<string, string>, rows: string[]): SpriteDef {
  return { w: 10, h: 10, anchor: [0, 0], palette: { o: O, ...palette }, frames: [rows] };
}

const METAL = { i: '#d8dce0', I: '#9aa0a6', d: '#5e646a' };
const SLIME = { L: '#a8f8a0', g: '#58c078', D: '#358a50', W: '#effff0' };
const GLOW = { Y: '#e4ff9a', y: '#a6e05a', G: '#5f9636', W: '#ffffe8', S: '#d8d0b0' };

export const ITEM_ICONS: Record<ItemId, SpriteDef> = {
  scrap: icon({ ...METAL, r: '#a8643a' }, [
    '..........', '...ooo....', '..oiiIo...', '.oiIIIIoo.', '.oIIoIIIdo',
    'oIIIIIrIdo', 'oIIIrrIddo', '.oIIIIddo.', '..ooooooo.', '..........',
  ]),
  timber: icon({ l: '#c49464', b: '#9a7048', B: '#6a4a2c', m: '#5a7a3a' }, [
    '..........', '.......oo.', '.....oolbo', '...oolbbBo', '.oolbbBBo.',
    'olbbBBmo..', 'obbBBBo...', 'oBBmBo....', '.oooo.....', '..........',
  ]),
  glowcap: icon(GLOW, [
    '..........', '...oooo...', '..oYYyyo..', '.oYWYyyyo.', '.oyyyyyGo.',
    '..ooSSoo..', '....oSo...', '....oSo...', '...oSSSo..', '....ooo...',
  ]),
  brineTruffle: icon({ P: '#d8b0e8', p: '#a87cbc', q: '#6e4a80', W: '#f4e8ff' }, [
    '..........', '...oooo...', '..oPPppo..', '.oPWpppqo.', '.oppppqqo.',
    '.opqpppqo.', '.oppqqqqo.', '..oqqqqo..', '...oooo...', '..........',
  ]),
  bone: icon({ W: '#fffaf0', w: '#e8e0c8', B: '#b0a688' }, [
    '.oo.......', 'oWWo......', 'oWwwoo....', '.owwwwo...', '..owwwwo..',
    '...owwwwo.', '....oowwBo', '......oBBo', '.......oo.', '..........',
  ]),
  slimeGel: icon(SLIME, [
    '..........', '....oo....', '...oLLo...', '..oLWLgo..', '.oLggggDo.',
    '.oggggggo.', 'oggggggDDo', 'oDgggggDDo', '.oooooooo.', '..........',
  ]),
  cloth: icon({ R: '#b04a3a', r: '#d8705a', s: '#e8d8b0' }, [
    '..........', '.oooooo...', '.orRRRro..', '.oRrsrRRo.', '.oRRsRrRo.',
    '.orrRsRro.', '..oRRrsRo.', '..orrrrro.', '...ooooo..', '..........',
  ]),
  copper: icon({ C: '#f0a060', c: '#c87533', D: '#8a4a20' }, [
    '..........', '...oooo...', '..oCCCco..', '.oCcooCco.', '.oCo..oco.',
    '.oco..oDo.', '.ocDooDDo.', '..oDDDDo..', '...oooo...', '..........',
  ]),
  slimeGlue: icon({ ...SLIME, k: '#a07848', a: '#9ab4b0' }, [
    '...oooo...', '...okko...', '..oaaaao..', '.oaWaaaao.', '.oLggggDo.',
    '.oggggggo.', '.oggggDDo.', '.oDgggDDo.', '..oooooo..', '..........',
  ]),
  slimeCell: icon({ ...GLOW, i: '#c8ccd0', I: '#8a9096' }, [
    '...oooo...', '..oiIIio..', '.oooooooo.', '.oYYyyyyo.', '.oYWyyyGo.',
    '.oyyyyyGo.', '.oyyyyGGo.', '.oooooooo.', '..oiIIio..', '...oooo...',
  ]),
  fertilizer: icon({ S: '#8a7050', s: '#b09a70', W: '#f0e8d0' }, [
    '..o..o....', '...oo.....', '..oSSo....', '.oSssSoo..', 'oSsWWssSo.',
    'oSsWsssSo.', 'oSsssssSo.', 'oSSssSSSo.', '.oooooooo.', '..........',
  ]),
  truffleSpores: icon({ W: '#e8e0c8', p: '#a87cbc', q: '#6e4a80', K: '#b8a888' }, [
    '..........', '.ooooooo..', '.oWWWWWo..', '.oWpqpWo..', '.oWqpqWo..',
    '.oWpqpWo..', '.oWWWWWo..', '.oKKKKKo..', '.ooooooo..', '..........',
  ]),
  glowcapSkewer: icon({ ...GLOW, k: '#8a6a40' }, [
    '.......oo.', '......oYGo', '.....oyGGo', '....oYyGo.', '...okooo..',
    '..oYGo....', '.oyyGo....', '.okoo.....', 'oko.......', 'oo........',
  ]),
  driedRation: icon({ b: '#b89060', B: '#8a6a40', S: '#e0d0a0' }, [
    '..........', '..oooooo..', '.obbBbbbo.', 'obbbBbbbBo', 'oSSSSSSSSo',
    'obbbBbbbBo', 'oBbbBbbBBo', '.oBBBBBBo.', '..oooooo..', '..........',
  ]),
  truffleStew: icon({ w: '#c8d4d4', R: '#7a4428', r: '#a86a40', p: '#c890d8', B: '#c89060', b: '#8a6040' }, [
    '..w...w...', '...w...w..', '.oooooooo.', 'oRrprRprro', 'oBBBBBBBBo',
    'obBBBBBBbo', '.obBBBBbo.', '..obbbbo..', '...oooo...', '..........',
  ]),
  bottle: icon({ G: '#3a7a5a', g: '#5aa07a', W: '#c8f0e0', k: '#a07848' }, [
    '...oooo...', '...okko...', '...oGGo...', '...oGgo...', '..oGWggo..',
    '.oGWgggGo.', '.oGWgggGo.', '.oGggggGo.', '.oGGGGGGo.', '..oooooo..',
  ]),
  stinkbrew: icon({ M: '#5a6a2a', m: '#8a9a3a', a: '#a0b8a8', W: '#e0f0c0', w: '#a8c060', k: '#a07848' }, [
    '..w..w....', '...oooo...', '...okko...', '...oaao...', '..oaaaao..',
    '.oMmmmMMo.', '.omWmmmMo.', '.ommmmmMo.', '..oMMMMo..', '...oooo...',
  ]),
  modNailSpread: icon({ i: '#d8d8d8', B: '#9a7a50', b: '#6a4a2c' }, [
    '.i...i...i', '.i...i...i', '..i..i..i.', '..i..i..i.', '...i.i.i..',
    '.ooooooooo', '.oBBbBBbBo', '.obbbbbbbo', '.ooooooooo', '..........',
  ]),
  modSlimeShot: icon(SLIME, [
    '..........', '...oooo...', '..oLLggo..', '.oLWgggDo.', '.oggggggo.',
    '.oggggDDo.', '..oggDDo..', '...oDDo...', '....oo....', '..........',
  ]),
  patchedSatchel: icon({ B: '#6a4a2c', b: '#9a7048', P: '#b04a3a', s: '#e8d8b0' }, [
    '..oooooo..', '.o......o.', '.o......o.', 'oooooooooo', 'oBbbbPPbBo',
    'obbbbPPbbo', 'oBbbsbbbBo', 'oBBbbbbBBo', '.oooooooo.', '..........',
  ]),
  flywheelCoil: icon({ C: '#f0a060', c: '#c87533', D: '#8a4a20' }, [
    '..oooooo..', '.oCCCCcco.', 'oCCo..occo', 'oCo.cc.oco', 'oC.cDDc.co',
    'oC.cDDc.Do', 'oCo.cc.oDo', 'oCco..oDDo', '.occcDDDo.', '..oooooo..',
  ]),
};

/** A Brass Button, the currency. */
export const BUTTON_ICON: SpriteDef = {
  w: 8, h: 8, anchor: [0, 0],
  palette: { o: O, Y: '#f0d070', y: '#c8a040', D: '#8a6a20', W: '#fff4c0' },
  frames: [['..oooo..', '.oYYYyo.', 'oYWYYyyo', 'oYYoYoyo', 'oYyoyoyo', 'oyyyyyDo', '.oyyyDo.', '..oooo..']],
};

export const CHECK_ICON: SpriteDef = {
  w: 7, h: 6, anchor: [0, 0],
  palette: { o: O, g: '#8ae05a' },
  frames: [['.....oo', '....ogo', 'oo.ogo.', 'ogoogo.', '.oggo..', '..oo...']],
};

export const LOCK_ICON: SpriteDef = {
  w: 7, h: 8, anchor: [0, 0],
  palette: { o: O, i: '#c8ccd0', I: '#8a9096', y: '#c8a040', Y: '#8a6a20' },
  frames: [['.ooooo.', '.oIoIo.', '.oo.oo.', 'ooooooo', 'oyyyyYo', 'oyyoyYo', 'oyyyyYo', 'ooooooo']],
};

/** Awareness icons. Shape and color both change, so they read without color. */
export const AWARE_ICONS = {
  suspicious: {
    w: 7, h: 9, anchor: [3, 9],
    palette: { o: O, y: '#f0d040', k: '#2a2010' },
    frames: [['.ooooo.', 'oyyyyyo', 'oykkkyo', 'oyyykyo', 'oyykkyo', 'oyyyyyo', 'oyykyyo', 'oyyyyyo', '.ooooo.']],
  },
  searching: {
    w: 7, h: 9, anchor: [3, 9],
    palette: { o: O, y: '#f08a30', k: '#2a1408' },
    frames: [['.ooooo.', 'oyyyyyo', 'oykkkyo', 'oyyykyo', 'oyykkyo', 'oyyyyyo', 'oyykyyo', 'oyyyyyo', '.ooooo.']],
  },
  hostile: {
    w: 7, h: 9, anchor: [3, 9],
    palette: { o: O, r: '#e04030', k: '#fff0e0' },
    frames: [['...o...', '..oro..', '.orkro.', 'orrkrro', 'orrkrro', 'orrrrro', '.orkro.', '..oro..', '...o...']],
  },
  returning: {
    w: 7, h: 5, anchor: [3, 5],
    palette: { o: O, g: '#a8a8a0', k: '#3a3a38' },
    frames: [['.ooooo.', 'ogggggo', 'okgkgko', 'ogggggo', '.ooooo.']],
  },
} satisfies Record<string, SpriteDef>;
