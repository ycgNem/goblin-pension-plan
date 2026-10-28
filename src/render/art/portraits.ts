import { art, type Painter } from '../paint';

// Dialogue portraits, 40x40. Each has four frames: mouth open or shut, eyes open or blinking.

export type PortraitId = 'grubb' | 'dorrit' | 'unionRat' | 'aldous' | 'wren' | 'pemberton' | 'hobb' | 'guard';

export const PORTRAIT_SIZE = 40;

type Drawer = (p: Painter, open: boolean, blink: boolean) => void;

const SKIN_PALE = ['#e0b090', '#f0c8a8', '#b88060'] as const;

function shoulders(p: Painter, base: string, light: string, dark: string): void {
  p.ball(20, 43, 17, 10, base, light, dark);
}

function humanEyes(p: Painter, y: number, iris: string, blink: boolean, lid = '#2a1e1a'): void {
  for (const x of [15, 23]) {
    if (blink) {
      p.hline(x, y + 1, 3, lid);
      continue;
    }
    p.rect(x, y, 3, 2, '#f4f0e6');
    p.rect(x + 1, y, 2, 2, iris);
    p.px(x + 1, y, '#1a1410');
  }
}

const DRAW: Record<PortraitId, Drawer> = {
  grubb(p, open, blink) {
    shoulders(p, '#2a2a44', '#3e3e66', '#1c1c30');
    p.poly([[14, 32], [20, 38], [26, 32]], '#e8e0d0');
    p.rect(19, 35, 2, 5, '#a03030');
    p.rect(17, 28, 6, 5, '#5a7a3e');
    p.poly([[12, 18], [1, 11], [4, 17], [12, 24]], '#8aa860');
    p.poly([[11, 19], [4, 13], [6, 17], [11, 22]], '#5a7a3e');
    p.poly([[28, 18], [39, 11], [36, 17], [28, 24]], '#7a9850');
    p.poly([[29, 19], [36, 13], [34, 17], [29, 22]], '#5a7a3e');
    p.ball(20, 21, 10, 9.5, '#8aa860', '#b8cc88', '#5a7a3e');
    p.rect(10, 10, 20, 4, '#2f5a2f');
    p.hline(10, 10, 20, '#4a8a4a');
    p.poly([[9, 14], [31, 14], [28, 17], [12, 17]], '#5f9a5f');
    p.hline(12, 16, 16, '#78b078');
    p.hline(13, 18, 5, '#ecece4');
    p.hline(22, 18, 5, '#ecece4');
    for (const x of [16, 24]) {
      if (blink) p.hline(x - 1, 21, 3, '#2a3a1a');
      else {
        p.rect(x - 1, 20, 3, 3, '#f4e46a');
        p.vline(x, 20, 3, '#1a1a10');
      }
      p.ring(x, 21.5, 3.4, 3.4, '#c8a040');
    }
    p.hline(19, 21, 2, '#c8a040');
    p.px(14, 19, '#ffffff');
    p.poly([[19, 22], [22, 22], [25, 28], [21, 28]], '#7a9850');
    p.px(24, 28, '#5a7a3e');
    p.px(13, 25, '#6a8a48');
    p.px(27, 25, '#6a8a48');
    if (open) {
      p.rect(16, 28, 6, 3, '#3a1a10');
      p.px(17, 28, '#f0f0e0');
    } else {
      p.hline(16, 29, 6, '#3a2a1a');
      p.px(15, 28, '#3a2a1a');
    }
    p.line(30, 12, 35, 4, '#f8f8f0');
    p.line(31, 12, 36, 5, '#c8c8c0');
    p.outline();
  },

  dorrit(p, open, blink) {
    shoulders(p, '#4a3a5a', '#6a5a7a', '#2e2440');
    p.poly([[12, 31], [28, 31], [25, 37], [15, 37]], '#a04040');
    p.hline(13, 31, 15, '#c05a5a');
    p.rect(17, 27, 6, 5, SKIN_PALE[2]);
    p.ball(20, 19, 8.5, 10, ...SKIN_PALE);
    p.ball(20, 12, 10, 6.5, '#2a1e1a', '#4a3a30', '#1a1210');
    p.rect(11, 12, 3, 12, '#2a1e1a');
    p.rect(26, 12, 3, 12, '#2a1e1a');
    p.poly([[12, 11], [27, 10], [25, 16], [14, 14]], '#2a1e1a');
    p.line(16, 13, 22, 11, '#4a3a30');
    humanEyes(p, 20, '#4a6a3a', blink);
    if (!blink) {
      p.hline(15, 19, 3, '#2a1e1a');
      p.hline(23, 19, 3, '#2a1e1a');
    }
    p.hline(14, 17, 4, '#2a1e1a');
    p.hline(22, 16, 4, '#2a1e1a');
    p.px(20, 23, '#b88060');
    p.px(21, 24, '#b88060');
    if (open) p.rect(18, 26, 4, 2, '#5a2a20');
    else {
      p.hline(18, 26, 4, '#8a4a40');
      p.px(22, 25, '#8a4a40');
    }
    p.px(28, 24, '#f0d070');
    p.px(28, 25, '#c8a040');
    p.outline();
  },

  unionRat(p, open, blink) {
    shoulders(p, '#5a4a3a', '#7a6a54', '#3a3024');
    p.rect(26, 33, 10, 3, '#c03030');
    p.ball(14, 12, 4.5, 4.5, '#8a6a58', '#a88a74', '#5a3e30');
    p.ellipse(14, 12, 2.2, 2.2, '#d08a8a');
    p.ball(27, 12, 4.5, 4.5, '#8a6a58', '#a88a74', '#5a3e30');
    p.ellipse(27, 12, 2.2, 2.2, '#d08a8a');
    p.ball(21, 22, 9.5, 8.5, '#8a6a58', '#a88a74', '#5a3e30');
    p.ball(12, 26, 6, 4, '#8a6a58', '#a88a74', '#5a3e30');
    p.rect(6, 25, 3, 2, '#d08a8a');
    p.rect(13, 11, 16, 4, '#3a4a6a');
    p.hline(13, 11, 16, '#5a6a8a');
    p.rect(9, 15, 11, 2, '#2a3a5a');
    p.text('12', 19, 11, '#e0c050');
    if (blink) {
      p.hline(16, 21, 3, '#1a1010');
      p.hline(23, 21, 3, '#1a1010');
    } else {
      p.rect(17, 20, 2, 2, '#1a1010');
      p.rect(24, 20, 2, 2, '#1a1010');
      p.px(17, 20, '#e8d8d0');
    }
    p.hline(16, 23, 4, '#6a4a3a');
    p.hline(23, 23, 4, '#6a4a3a');
    p.line(4, 23, 9, 25, '#d8d0c0');
    p.line(4, 28, 9, 27, '#d8d0c0');
    if (open) {
      p.rect(9, 28, 5, 3, '#3a1010');
      p.rect(10, 28, 2, 2, '#f0e8c0');
    } else {
      p.hline(9, 29, 5, '#3a2018');
      p.rect(10, 29, 2, 1, '#f0e8c0');
    }
    p.rect(27, 28, 10, 11, '#8a5e34');
    p.rect(28, 29, 8, 9, '#e8e0c8');
    for (let y = 31; y < 37; y += 2) p.hline(29, y, 6, '#8a8070');
    p.rect(30, 27, 4, 2, '#a8aeb4');
    p.outline();
  },

  aldous(p, open, blink) {
    shoulders(p, '#9aa4ae', '#c8d0d8', '#6a7480');
    p.rect(15, 33, 10, 8, '#3a5aa8');
    p.px(20, 36, '#e0c050');
    p.rect(19, 37, 3, 1, '#e0c050');
    p.ball(20, 21, 9, 10, ...SKIN_PALE);
    p.ball(20, 13, 11, 7.5, '#b8c0c8', '#e0e8f0', '#7a8490');
    p.rect(10, 15, 3, 10, '#9aa4ae');
    p.rect(27, 15, 3, 10, '#7a8490');
    p.poly([[17, 6], [23, 6], [28, 0], [15, 1]], '#c03030');
    p.line(14, 18, 18, 19, '#c8a040');
    p.line(22, 19, 26, 18, '#c8a040');
    humanEyes(p, 20, '#3a6ac0', blink);
    p.px(20, 24, '#b88060');
    p.poly([[14, 26], [26, 26], [28, 29], [20, 27.5], [12, 29]], '#e0c050');
    p.rect(16, 29, 8, 3, SKIN_PALE[0]);
    p.hline(16, 31, 8, SKIN_PALE[2]);
    if (open) {
      p.rect(17, 28, 6, 3, '#5a2020');
      p.hline(17, 28, 6, '#f8f8f0');
    }
    p.outline();
  },

  wren(p, open, blink) {
    shoulders(p, '#3f6a3a', '#5a8a50', '#2a4a28');
    p.line(10, 34, 28, 40, '#6a4a2a');
    p.ball(20, 18, 12, 12.5, '#3f6a3a', '#5a8a50', '#2a4a28');
    p.ball(20, 21, 7.5, 8.5, '#d8a880', '#e8c098', '#a87858');
    p.line(15, 13, 13, 22, '#8a4a2a');
    p.line(16, 13, 14, 21, '#a85a32');
    if (blink) {
      p.hline(15, 21, 3, '#2a2a1a');
      p.hline(23, 21, 3, '#2a2a1a');
    } else {
      p.rect(15, 21, 3, 1, '#5a8a6a');
      p.rect(23, 21, 3, 1, '#5a8a6a');
      p.hline(15, 20, 3, '#2a2a1a');
      p.hline(23, 20, 3, '#2a2a1a');
    }
    p.px(20, 24, '#a87858');
    if (open) p.rect(18, 26, 4, 2, '#5a2a20');
    else p.hline(18, 26, 4, '#8a4a40');
    p.line(22, 26, 30, 23, '#e0c870');
    p.outline();
  },

  pemberton(p, open, blink) {
    shoulders(p, '#6a3a8a', '#8a5aaa', '#4a2462');
    p.rect(28, 30, 8, 9, '#c8b890');
    p.vline(32, 30, 9, '#8a7a60');
    p.ball(20, 22, 8, 9, '#e8c0a0', '#f8d8c0', '#c09070');
    p.poly([[10, 15], [30, 15], [23, 0], [18, 1]], '#6a3a8a');
    p.line(18, 1, 12, 15, '#8a5aaa');
    p.rect(11, 12, 18, 3, '#e0c050');
    p.ellipse(20, 15, 12, 2.5, '#4a2462');
    p.line(13, 18, 17, 17, '#8a5a30');
    p.line(23, 17, 27, 18, '#8a5a30');
    for (const x of [16, 24]) {
      p.ellipse(x, 22, 3.2, 3.2, '#e8f0f8');
      if (blink) p.hline(x - 1, 22, 3, '#2a2a3a');
      else p.rect(x, 21, 1, 2, '#2a2a3a');
      p.ring(x, 22, 3.6, 3.6, '#3a3a3a');
    }
    p.hline(19, 22, 2, '#3a3a3a');
    for (const [x, y] of [[13, 25], [14, 26], [26, 25], [27, 26]] as const) p.px(x, y, '#c08060');
    p.px(30, 19, '#a8d8f8');
    p.px(30, 20, '#a8d8f8');
    p.px(29, 21, '#d8f0ff');
    if (open) p.ellipse(20, 28, 2, 1.5, '#5a2a20');
    else {
      p.px(18, 28, '#8a4a40');
      p.px(19, 27, '#8a4a40');
      p.px(20, 28, '#8a4a40');
      p.px(21, 27, '#8a4a40');
    }
    p.outline();
  },

  hobb(p, open, blink) {
    shoulders(p, '#3a5a7a', '#5a7a9a', '#2a4058');
    p.rect(16, 31, 8, 6, '#7a6a4a');
    p.vline(14, 32, 8, '#2a4058');
    p.vline(25, 32, 8, '#2a4058');
    p.ball(20, 21, 9, 10, '#d8a888', '#e8c0a0', '#a87860');
    p.speckle(14, 25, 12, 6, '#a07860', 16);
    p.ball(20, 12, 11, 5, '#4a4a3a', '#6a6a52', '#30302a');
    p.rect(9, 14, 15, 2, '#30302a');
    p.ball(10, 21, 2, 3, '#d8a888', '#e8c0a0', '#a87860');
    p.ball(30, 21, 2, 3, '#d8a888', '#e8c0a0', '#a87860');
    if (blink) {
      p.hline(15, 21, 3, '#3a2a1a');
      p.hline(23, 21, 3, '#3a2a1a');
    } else {
      p.hline(15, 20, 3, '#3a2a1a');
      p.hline(23, 20, 3, '#3a2a1a');
      p.px(16, 21, '#2a2a1a');
      p.px(24, 21, '#2a2a1a');
    }
    p.hline(15, 23, 3, '#b88a70');
    p.hline(23, 23, 3, '#b88a70');
    p.ball(21, 24, 2.5, 2, '#d89880', '#e8b098', '#a87860');
    if (open) p.rect(18, 27, 5, 2, '#4a2a20');
    else {
      p.hline(18, 27, 5, '#7a4a3a');
      p.px(17, 28, '#7a4a3a');
      p.px(23, 28, '#7a4a3a');
    }
    p.line(29, 16, 33, 11, '#e0c050');
    p.px(33, 11, '#3a3a3a');
    p.outline();
  },

  guard(p, open, blink) {
    shoulders(p, '#9a3030', '#c04040', '#6a2020');
    p.rect(17, 33, 6, 7, '#d0b060');
    p.ball(20, 22, 8.5, 9.5, '#d0a080', '#e0b898', '#a07050');
    p.ellipse(20, 15, 13, 3, '#8a8a90');
    p.hline(8, 15, 24, '#b0b0b8');
    p.ball(20, 12, 8, 6, '#8a8a90', '#b0b0b8', '#5a5a60');
    humanEyes(p, 21, '#5a4a3a', blink);
    p.px(20, 24, '#a07050');
    p.hline(16, 26, 8, '#6a4a2a');
    if (open) p.rect(18, 27, 4, 2, '#4a2020');
    else p.hline(18, 28, 4, '#7a4a3a');
    p.outline();
  },
};

/** The portrait canvas for one frame. */
export function portrait(id: PortraitId, mouthOpen: boolean, blink: boolean): HTMLCanvasElement {
  return art(`portrait:${id}:${mouthOpen ? 1 : 0}${blink ? 1 : 0}`, PORTRAIT_SIZE, PORTRAIT_SIZE, (p) => DRAW[id](p, mouthOpen, blink));
}
