import type { SpriteDef } from '../sprites';

// Characters. Light comes from the top left: 'l' highlights, lowercase base, uppercase shade.

const GOBLIN_PALETTE = {
  o: '#1b2414', G: '#3f7a2e', g: '#6fb24a', l: '#a6dc6e', e: '#f4e46a', p: '#2a1a10',
  k: '#3a1c14', w: '#ece4c8', B: '#4a301a', b: '#7a5230', c: '#a8804c', f: '#2c2117', x: '#2a1a10',
};

const HEAD_FRONT = [
  '................',
  '.....oooooo.....',
  '....olllgggo....',
  'oo.ollgggggGo.oo',
  'olgogepggpeGogGo',
  '.ooggggggggGGoo.',
  '...ogGwkkwGGo...',
  '....oGGGGGGo....',
];
const HEAD_BACK = [
  '................',
  '.....oooooo.....',
  '....olllgggo....',
  'oo.ollgggggGo.oo',
  'olgogggggggGogGo',
  '.ooggggggggGGoo.',
  '...oGGGGGGGGo...',
  '....oGGGGGGo....',
];
const BODY_FRONT = ['....oBbbbbBo....', '...ogbbcbbbgo...', '...oGbbbbbbGo...', '....oBbbbbBo....'];
const BODY_BACK = ['....oBbbbbBo....', '...ogbbbbbbgo...', '...oGbbbbbbGo...', '....oBbbbbBo....'];
const LEGS_STAND = ['....oGo..oGo....', '...offo..offo...'];
const LEGS_STEP_A = ['....oGo..oGo....', '...offo...oo....'];
const LEGS_STEP_B = ['....oGo..oGo....', '....oo...offo...'];
const PAD = ['................', '................'];

const HEAD_SIDE = [
  '................',
  '......ooooo.....',
  '.....olllggo....',
  'oo..olggggggo...',
  'olgoogggggepo...',
  '.oogggggggggggo.',
  '...oGgggggGkwo..',
  '.....oGGGGGo....',
];
const BODY_SIDE = ['.....oBbbbBo....', '....oBbbcbgo....', '.....oBbbbBo....', '.....oBbbBo.....'];
const SIDE_STAND = ['......oGoGo.....', '.....offoffo....'];
const SIDE_STEP_A = ['.....oGo.oGo....', '....offo.offo...'];
const SIDE_STEP_B = ['......oGGo......', '......offfo.....'];

/** Frames: 0-2 down (stand, step, step), 3-5 up, 6-8 side (faces right), 9-10 roll, 11 knocked out. */
export const GOBLIN: SpriteDef = {
  w: 16,
  h: 16,
  anchor: [8, 14],
  palette: GOBLIN_PALETTE,
  frames: [
    [...HEAD_FRONT, ...BODY_FRONT, ...LEGS_STAND, ...PAD],
    [...HEAD_FRONT, ...BODY_FRONT, ...LEGS_STEP_A, ...PAD],
    [...HEAD_FRONT, ...BODY_FRONT, ...LEGS_STEP_B, ...PAD],
    [...HEAD_BACK, ...BODY_BACK, ...LEGS_STAND, ...PAD],
    [...HEAD_BACK, ...BODY_BACK, ...LEGS_STEP_A, ...PAD],
    [...HEAD_BACK, ...BODY_BACK, ...LEGS_STEP_B, ...PAD],
    [...HEAD_SIDE, ...BODY_SIDE, ...SIDE_STAND, ...PAD],
    [...HEAD_SIDE, ...BODY_SIDE, ...SIDE_STEP_A, ...PAD],
    [...HEAD_SIDE, ...BODY_SIDE, ...SIDE_STEP_B, ...PAD],
    [
      '................', '................', '................', '................',
      '.....oooooo.....', '....ollgggGo....', '...olggggggGo...', '..oogBbbbbBGoo..',
      '..ogBbbcbbbBGo..', '..oGGBbbbbBGGo..', '...oGGGGGGGGo...', '....oGGGGGGo....',
      '.....oooooo.....', '................', '................', '................',
    ],
    [
      '................', '................', '................', '................',
      '.....oooooo.....', '....oBbbbbBo....', '...oBbbcbbbBo...', '..ooGBbbbbBGoo..',
      '..ollggggggGGo..', '..oggepggepgGo..', '...oggggggGGo...', '....oGGGGGGo....',
      '.....oooooo.....', '................', '................', '................',
    ],
    [
      '................', '................', '................', '................',
      '................', '................', '................', '................',
      '................', '.oo..oooooo.....', 'olgooggggggoooo.', 'ogxgxggggBbbbbfo',
      '.oooGGGGGBBBBfo.', '....oooooooooo..', '................', '................',
    ],
  ],
};

/** Registrar Grubb: an older goblin in a clerk's coat. Hat and spectacles are drawn on top. */
export const GRUBB: SpriteDef = {
  ...GOBLIN,
  palette: { ...GOBLIN_PALETTE, G: '#5a7a3e', g: '#8aa860', l: '#b8cc88', B: '#2a2a44', b: '#3e3e66', c: '#d0c070' },
};

export const RAT: SpriteDef = {
  w: 16,
  h: 10,
  anchor: [8, 8],
  palette: { o: '#20140f', b: '#7a5a48', B: '#5a3e30', l: '#9a7a64', p: '#d08a8a', e: '#ff4040' },
  frames: [
    [
      '................', '..........oo....', '......ooooopo...', '....oollllllloo.', '...obbbbbbbbbeoo',
      'ppobbbbbbbbbbbbo', '..oBBbbbbbbBBoo.', '...ooBBBBBBBo...', '....opo...opo...', '................',
    ],
    [
      '................', '..........oo....', '......ooooopo...', '....oollllllloo.', 'p..obbbbbbbbbeoo',
      '.pobbbbbbbbbbbbo', '..oBBbbbbbbBBoo.', '...ooBBBBBBBo...', '.....opo.opo....', '................',
    ],
  ],
};

const SLIME_PALETTE = { o: '#1f3a28', g: '#6fd06f', G: '#48a058', l: '#b8f0a8', e: '#10241a', w: '#e8fff0' };

export const SLIME: SpriteDef = {
  w: 16,
  h: 14,
  anchor: [8, 13],
  palette: SLIME_PALETTE,
  frames: [
    [
      '................', '................', '................', '......oooo......', '....oogglgoo....',
      '...ogglwlgggo...', '..oggglwgggggo..', '..ogggggggggGo..', '.ogggeggggeggGo.', '.oggggggggggGGo.',
      '.oGgggggggggGGo.', '..oGGGGGGGGGGo..', '...oooooooooo...', '................',
    ],
    [
      '................', '................', '................', '................', '................',
      '......oooo......', '...oooggllooo...', '..oggglwlggggo..', '.ogggggwgggggGo.', 'oggggeggggegggGo',
      'oggggggggggggGGo', 'oGgggggggggggGGo', '.oGGGGGGGGGGGGo.', '..oooooooooooo..',
    ],
  ],
};

export const SLIMELET: SpriteDef = {
  w: 8,
  h: 8,
  anchor: [4, 7],
  palette: { ...SLIME_PALETTE, g: '#8fe07f' },
  frames: [
    ['........', '..oooo..', '.oglggo.', 'ogwlgggo', 'ogegegGo', 'oggggGGo', '.oGGGGo.', '..oooo..'],
    ['........', '........', '.oooooo.', 'oglwgggo', 'ogeggego', 'oggggGGo', 'oGGGGGGo', '.oooooo.'],
  ],
};

export const MITE: SpriteDef = {
  w: 12,
  h: 10,
  anchor: [6, 8],
  palette: { o: '#2a2420', b: '#e8e0c8', B: '#b8ae90', k: '#3a2a2a', l: '#b8b098' },
  frames: [
    [
      '............', '....oooo....', '...obbbbo...', 'l.obkbbkbo.l', '.lobbbbbbol.',
      'l.oBbBBbBo.l', '.lobBbbBbol.', '...oBBBBo...', '..l.oooo.l..', '............',
    ],
    [
      '............', '....oooo....', '...obbbbo...', '.lobkbbkbol.', 'l.obbbbbbo.l',
      '.loBbBBbBol.', 'l.obBbbBbo.l', '...oBBBBo...', '.l..oooo..l.', '............',
    ],
  ],
};

// People share one body. Palettes and the props they carry (drawn in code) tell them apart.
const HUMAN_TOP = ['................', '................', '................'];
const HUMAN_FRONT_BODY = [
  '.....oooooo.....', '....ohhhhhho....', '....ohhhhhho....', '....oHssssHo....', '....osesseso....',
  '....ossssSSo....', '.....oSSSSo.....', '....occaacco....', '...occcaaccco...', '..osccaaaaccso..',
  '..osCcaaaacCso..', '..oSCcaaaacCSo..', '...oCcaaaacCo...', '...oCCCaaCCCo...', '....oCCCCCCo....',
  '....ollllllo....',
];
const HUMAN_SIDE_BODY = [
  '......ooooo.....', '.....ohhhhho....', '.....ohhhhhho...', '.....oHhsssso...', '.....ohsssesSo..',
  '.....ohssssSo...', '......oSSSSo....', '......occaco....', '.....occcaco....', '.....occcacsso..',
  '.....oCccacoo...', '.....oCCcaco....', '.....oCCCaCo....', '.....oCCCCCo....', '......oCCCo.....',
  '......olllo.....',
];
const BOTTOM = ['................', '................'];

/** Frames: 0-1 facing down (stand, step), 2-3 side facing right (stand, step). */
export function humanSprite(palette: Record<string, string>): SpriteDef {
  return {
    w: 16,
    h: 24,
    anchor: [8, 21],
    palette: { o: '#1a1a22', e: '#20303a', ...palette },
    frames: [
      [...HUMAN_TOP, ...HUMAN_FRONT_BODY, '....olloollo....', '....olloollo....', '...offo..offo...', ...BOTTOM],
      [...HUMAN_TOP, ...HUMAN_FRONT_BODY, '....olloollo....', '....oll..llo....', '....off..ffo....', ...BOTTOM],
      [...HUMAN_TOP, ...HUMAN_SIDE_BODY, '......olllo.....', '......olllo.....', '......offffo....', ...BOTTOM],
      [...HUMAN_TOP, ...HUMAN_SIDE_BODY, '.....ollolo.....', '.....olo.olo....', '....offo.offo...', ...BOTTOM],
    ],
  };
}

export const HUMAN_PALETTES = {
  paladin: { h: '#b8c0c8', H: '#7a8490', s: '#e0b090', S: '#b88060', c: '#9aa4ae', C: '#6a7480', a: '#3a5aa8', l: '#5a6470', f: '#3a3030' },
  ranger: { h: '#3f6a3a', H: '#2a4a28', s: '#d8a880', S: '#a87858', c: '#5a7a42', C: '#3a5a2e', a: '#8a5a30', l: '#5a4a38', f: '#3a2a20' },
  apprentice: { h: '#6a3a8a', H: '#4a2462', s: '#e8c0a0', S: '#c09070', c: '#7a4a9a', C: '#54306e', a: '#e0c050', l: '#54306e', f: '#2a1a2a' },
  inspector: { h: '#4a4a3a', H: '#30302a', s: '#d8a888', S: '#a87860', c: '#7a6a4a', C: '#5a4c34', a: '#3a5a7a', l: '#3a3a40', f: '#2a2018' },
  guard: { h: '#8a8a90', H: '#5a5a60', s: '#d0a080', S: '#a07050', c: '#9a3030', C: '#6a2020', a: '#d0b060', l: '#4a4048', f: '#2a2020' },
} satisfies Record<string, Record<string, string>>;
