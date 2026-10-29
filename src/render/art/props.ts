import { art, Painter } from '../paint';
import { artImage } from './assets';
import type { PropArtDef } from './sheet-types';
import { PROP_ART } from './sheets.gen';

// Props: scavenging nodes, Burrow stations in each of their states, Cooperative furniture,
// landmarks, and hiding heaps. Generated art from props.png where a state has it; otherwise
// painted procedurally, outlined, and cached per variant.
// Each prop has an anchor: the pixel that sits on its spot in the world (usually the base).

interface PropDef {
  w: number;
  h: number;
  ax: number;
  ay: number;
  draw(p: Painter, variant: string): void;
  /** Lettering over the generated art, inside its board (generated art never carries text). */
  label?(p: Painter, variant: string, x: number, y: number, w: number, h: number): void;
}

const WOOD = { hi: '#c08c58', base: '#8a5e34', lo: '#5e3e22', dark: '#3e2814' };
const IRON = { hi: '#a8aeb4', base: '#6a7076', lo: '#464a50' };
const RUST = '#9a5a30';
const PAPER = '#e8e0c8';
const INK = '#2a1a10';

function plank(p: Painter, x: number, y: number, w: number, h: number): void {
  p.rect(x, y, w, h, WOOD.base);
  p.hline(x, y, w, WOOD.hi);
  p.hline(x, y + h - 1, w, WOOD.lo);
}

function nail(p: Painter, x: number, y: number): void {
  p.px(x, y, '#c8c8c0');
}

function mushroom(p: Painter, x: number, base: number, h: number, r: number): void {
  p.vline(x, base - h, h, '#d8d0b0');
  p.vline(x + 1, base - h, h, '#a8a080');
  p.ball(x + 1, base - h, r, Math.max(1.5, r * 0.65), '#a6e05a', '#d8ff8a', '#5f9636');
  if (r >= 2.5) p.px(x, base - h - 1, '#f4ffd0');
}

/** Lines of the 3x5 font, centered in a box. */
function letter(p: Painter, lines: readonly string[], x: number, y: number, w: number, h: number, c: string): void {
  const top = y + Math.floor((h - (lines.length * 6 - 1)) / 2);
  lines.forEach((line, i) => p.text(line, x + Math.floor((w - Painter.textWidth(line)) / 2), top + i * 6, c));
}

function bone(p: Painter, x0: number, y0: number, x1: number, y1: number): void {
  p.line(x0, y0, x1, y1, '#e8e0c8');
  p.px(x0 - 1, y0, '#fffaf0');
  p.px(x0, y0 - 1, '#fffaf0');
  p.px(x1 + 1, y1, '#b0a688');
  p.px(x1, y1 + 1, '#b0a688');
}

const PROPS: Record<string, PropDef> = {
  // ------------------------------------------------------------- scavenging nodes
  junkPile: {
    w: 24, h: 18, ax: 12, ay: 15,
    draw(p, v) {
      if (v === 'searched') {
        p.ball(12, 13, 10, 3.5, '#3e3832', '#4e463e', '#2e2a26');
        p.rect(7, 12, 3, 1, IRON.base);
        p.px(15, 13, RUST);
        p.rect(13, 11, 4, 1, WOOD.lo);
        p.outline();
        return;
      }
      p.ball(12, 12, 11, 5.5, '#4e463c', '#665c4c', '#38322b');
      p.poly([[3, 11], [11, 6], [12, 7.5], [4, 12.5]], WOOD.base);
      p.line(3, 11, 11, 6, WOOD.hi);
      p.line(14, 2, 17, 10, '#d0d4d8');
      p.line(15, 2, 18, 10, '#8a9096');
      p.rect(13, 9, 7, 1, RUST);
      p.ring(7, 11, 2.6, 2.6, IRON.base);
      p.px(7, 11, IRON.lo);
      p.rect(16, 10, 5, 4, IRON.base);
      p.hline(16, 10, 5, IRON.hi);
      p.px(17, 12, RUST);
      p.speckle(4, 9, 16, 6, '#8a9096', 6);
      p.speckle(4, 10, 16, 5, RUST, 5);
      p.speckle(5, 12, 14, 3, '#2a2622', 6);
      p.outline();
    },
  },
  crate: {
    w: 16, h: 17, ax: 8, ay: 15,
    draw(p, v) {
      if (v === 'smashed' || v === 'smashedLoot') {
        plank(p, 1, 12, 7, 2);
        plank(p, 9, 13, 6, 2);
        p.line(3, 9, 9, 11, WOOD.base);
        p.line(3, 10, 9, 12, WOOD.lo);
        p.line(10, 8, 14, 11, WOOD.base);
        p.px(6, 14, '#d8b080');
        p.px(12, 12, '#d8b080');
        if (v === 'smashedLoot') {
          p.rect(6, 9, 3, 2, IRON.base);
          p.px(6, 9, IRON.hi);
          p.rect(11, 14, 2, 1, IRON.hi);
        }
        p.outline();
        return;
      }
      p.rect(2, 6, 12, 9, WOOD.base);
      p.rect(2, 3, 12, 3, '#a87440');
      p.hline(2, 3, 12, '#c8925a');
      p.hline(2, 9, 12, '#6a4424');
      p.hline(2, 12, 12, '#6a4424');
      p.line(3, 7, 12, 14, '#6a4424');
      p.vline(13, 6, 9, WOOD.lo);
      for (const [x, y] of [[2, 6], [12, 6], [2, 13], [12, 13]] as const) p.rect(x, y, 2, 2, IRON.base);
      nail(p, 3, 7);
      nail(p, 12, 7);
      p.outline();
    },
  },
  glowcapPatch: {
    w: 18, h: 15, ax: 9, ay: 12,
    draw(p, v) {
      p.ellipse(9, 12, 8, 2.5, '#2f4a26');
      p.speckle(2, 10, 14, 4, '#4a6a32', 9);
      if (v === 'harvested') {
        for (const x of [4, 9, 13]) {
          p.vline(x, 9, 3, '#d8d0b0');
          p.px(x, 9, '#f0e8d0');
        }
      } else {
        mushroom(p, 3, 12, 5, 2.6);
        mushroom(p, 12, 12, 4, 2.2);
        mushroom(p, 7, 12, 8, 3.8);
      }
      p.outline();
    },
  },
  truffleRoot: {
    w: 20, h: 13, ax: 10, ay: 10,
    draw(p, v) {
      p.ellipse(10, 10, 8, 2.2, '#2e2a22');
      p.line(2, 9, 8, 6, '#5a4030');
      p.line(2, 10, 8, 7, '#3e2c20');
      p.line(8, 6, 15, 7, '#5a4030');
      p.line(15, 7, 18, 10, '#5a4030');
      p.line(11, 6, 12, 2, '#5a4030');
      if (v === 'harvested') {
        p.ellipse(7, 9, 1.5, 1, '#141210');
        p.ellipse(13, 9, 1.5, 1, '#141210');
      } else {
        p.ball(7, 8.5, 2.6, 2, '#a87cbc', '#d8b0e8', '#6e4a80');
        p.ball(13, 8, 3, 2.3, '#a87cbc', '#d8b0e8', '#6e4a80');
        p.ball(16.5, 9.5, 1.8, 1.5, '#a87cbc', '#d8b0e8', '#6e4a80');
      }
      p.outline();
    },
  },
  slimePool: {
    w: 26, h: 12, ax: 13, ay: 7,
    draw(p, v) {
      if (v === 'scooped') {
        p.ellipse(13, 6, 8, 3, '#14281e');
        p.ellipse(13, 6, 6.5, 2.2, '#2a4a38');
        return;
      }
      p.ellipse(13, 6, 12, 5, '#14281e');
      p.ellipse(13, 6, 11, 4.2, '#2f7a4c');
      p.ellipse(12, 5.5, 8, 2.8, '#58c078');
      p.hline(7, 4, 4, '#a8f8a0');
      p.px(16, 5, '#a8f8a0');
      p.px(18, 7, '#3f9a60');
    },
  },
  gelPuddle: {
    w: 20, h: 10, ax: 10, ay: 6,
    draw(p) {
      p.ellipse(10, 5, 8, 3.2, '#14281e');
      p.ellipse(10, 5, 7, 2.5, '#3f9a60');
      p.ellipse(4, 3, 2, 1.2, '#3f9a60');
      p.ellipse(16, 7, 1.8, 1, '#3f9a60');
      p.hline(7, 4, 3, '#a8f8a0');
    },
  },
  reinforcedPile: {
    w: 26, h: 20, ax: 13, ay: 17,
    draw(p, v) {
      if (v === 'searched') {
        p.ball(13, 15, 11, 3.5, '#3e3832', '#4e463e', '#2e2a26');
        p.line(4, 14, 10, 12, IRON.lo);
        p.line(16, 12, 22, 15, IRON.lo);
        p.px(13, 13, RUST);
        p.outline();
        return;
      }
      // A junk heap strapped down with iron bands and a padlock that has seen better days.
      p.ball(13, 13, 12, 6.5, '#4a443c', '#625a4c', '#342f29');
      p.rect(6, 6, 6, 5, IRON.base);
      p.hline(6, 6, 6, IRON.hi);
      p.rect(15, 5, 7, 6, '#5a5e64');
      p.hline(15, 5, 7, IRON.hi);
      p.line(3, 12, 23, 8, IRON.lo);
      p.line(3, 13, 23, 9, IRON.hi);
      p.line(5, 17, 22, 13, IRON.lo);
      p.line(5, 16, 22, 12, IRON.base);
      p.rect(11, 9, 4, 4, '#c8a040');
      p.px(12, 10, '#2a2010');
      p.ring(13, 8.5, 1.6, 1.8, IRON.hi);
      p.speckle(3, 9, 20, 8, RUST, 9);
      p.speckle(4, 11, 18, 5, '#2a2622', 6);
      p.outline();
    },
  },
  copperMachine: {
    w: 24, h: 24, ax: 12, ay: 21,
    draw(p, v) {
      p.rect(4, 8, 16, 13, '#4e4640');
      p.rect(4, 6, 16, 2, '#6a6058');
      p.hline(4, 6, 16, '#827868');
      p.vline(19, 8, 13, '#3a342f');
      p.rect(6, 10, 8, 8, '#5e5650');
      for (const [x, y] of [[6, 10], [13, 10], [6, 17], [13, 17]] as const) p.px(x, y, '#8a8078');
      p.ellipse(16.5, 11.5, 2.5, 2.5, '#e8e0c8');
      p.ring(16.5, 11.5, 2.6, 2.6, '#2a2420');
      p.line(16, 12, 17, 10, '#c03030');
      p.speckle(5, 9, 14, 11, RUST, 7);
      if (v === 'stripped') {
        p.rect(2, 10, 2, 3, '#8a4a20');
        p.rect(14, 3, 3, 3, '#8a4a20');
        p.line(8, 18, 7, 21, '#2a2a2a');
        p.line(11, 18, 13, 21, '#2a2a2a');
        p.rect(7, 13, 6, 1, '#141210');
      } else {
        p.rect(1, 4, 2, 15, '#c87533');
        p.vline(1, 4, 15, '#f0a060');
        p.rect(1, 3, 15, 2, '#c87533');
        p.hline(1, 3, 15, '#f0a060');
        p.rect(14, 1, 2, 3, '#c87533');
        p.ring(21, 16, 2, 3.5, '#c87533');
        p.ring(21, 16, 1, 2.5, '#8a4a20');
      }
      p.outline();
    },
  },
  smashedCrate: { w: 16, h: 17, ax: 8, ay: 15, draw: (p) => PROPS.crate!.draw(p, 'smashedLoot') },
  clothBundle: {
    w: 20, h: 14, ax: 10, ay: 11,
    draw(p, v) {
      if (v === 'searched') {
        p.ball(8, 10, 5, 2, '#7a2a20', '#a04a3a', '#5a1a14');
      } else {
        p.ball(8, 8, 6, 4, '#b04a3a', '#d8705a', '#7a2a20');
        p.line(3, 6, 12, 10, '#e8d8b0');
        p.ball(5, 4, 2, 1.5, '#b04a3a', '#d8705a', '#7a2a20');
      }
      p.line(13, 11, 18, 7, WOOD.base);
      p.px(18, 6, '#2a2420');
      p.px(19, 6, '#3a3a38');
      p.outline();
    },
  },
  bonePile: {
    w: 20, h: 12, ax: 10, ay: 9,
    draw(p, v) {
      p.ellipse(10, 9, 8, 2, '#2e2a26');
      bone(p, 4, 6, 10, 9);
      bone(p, 9, 7, 15, 5);
      if (v !== 'searched') {
        bone(p, 12, 9, 17, 8);
        p.ball(7, 6, 2.5, 2, '#e8e0c8', '#fffaf0', '#b0a688');
        p.px(6, 6, '#2a2420');
        p.px(8, 6, '#2a2420');
      }
      p.outline();
    },
  },

  // ------------------------------------------------------------- world furniture
  valve: {
    w: 16, h: 18, ax: 8, ay: 16,
    draw(p, v) {
      p.rect(6, 8, 4, 9, IRON.base);
      p.vline(6, 8, 9, IRON.hi);
      p.rect(5, 14, 6, 2, IRON.lo);
      p.ring(8, 7, 6, 6, '#a03020');
      p.ring(8, 7, 5, 5, '#d04a30');
      const turn = v === 'turned' ? Math.PI / 4 : 0;
      for (let i = 0; i < 4; i++) {
        const a = turn + (i * Math.PI) / 2;
        p.line(8, 7, 8 + Math.cos(a) * 5, 7 + Math.sin(a) * 5, '#a03020');
      }
      p.ellipse(8, 7, 1.5, 1.5, '#e8c070');
      p.outline();
    },
  },
  steamValve: {
    w: 18, h: 26, ax: 9, ay: 23,
    draw(p, v) {
      // A fat pipe out of the wall, a pressure gauge, and a big red wheel.
      p.rect(6, 0, 6, 22, IRON.base);
      p.vline(6, 0, 22, IRON.hi);
      p.vline(11, 0, 22, IRON.lo);
      p.rect(4, 18, 10, 4, IRON.lo);
      p.hline(4, 18, 10, IRON.base);
      p.ellipse(9, 4, 3.5, 3.5, '#e8e0c8');
      p.ring(9, 4, 3.6, 3.6, '#2a2420');
      const needle = v === 'ready' ? -0.3 : v === 'spent' ? 2.4 : 1.2;
      p.line(9, 4, 9 + Math.cos(needle - Math.PI / 2) * 2.5, 4 + Math.sin(needle - Math.PI / 2) * 2.5, '#c03030');
      const wheel = v === 'ready' ? '#e05a30' : '#a03020';
      p.ring(9, 12, 6, 6, '#7a2418');
      p.ring(9, 12, 5, 5, wheel);
      const turn = v === 'spent' ? Math.PI / 4 : 0;
      for (let i = 0; i < 4; i++) {
        const a = turn + (i * Math.PI) / 2;
        p.line(9, 12, 9 + Math.cos(a) * 5, 12 + Math.sin(a) * 5, '#7a2418');
      }
      p.ellipse(9, 12, 1.5, 1.5, '#e8c070');
      p.outline();
    },
  },
  vent: {
    w: 20, h: 12, ax: 10, ay: 10,
    draw(p) {
      p.rect(1, 2, 18, 8, '#2a2622');
      p.rect(1, 1, 18, 1, IRON.lo);
      for (let x = 3; x < 18; x += 3) p.vline(x, 2, 8, '#4a4e54');
      p.rect(2, 3, 16, 1, '#0c0a08');
      p.hline(1, 10, 18, '#1a1612');
      p.outline();
    },
  },
  flywheelHub: {
    w: 20, h: 14, ax: 10, ay: 11,
    draw(p) {
      // Where the Matron used to sit: a bent axle and a ring of scratches.
      p.ellipse(10, 9, 9, 4, '#2e2a26');
      p.ring(10, 9, 9, 4, '#4a443c');
      p.rect(9, 2, 2, 8, IRON.base);
      p.vline(9, 2, 8, IRON.hi);
      p.ellipse(10, 2, 2, 1.5, '#c87533');
      p.outline();
    },
  },
  access: {
    w: 24, h: 40, ax: 12, ay: 32,
    draw(p) {
      // A ladder up to a city grate, and a Guild banner on the wall beside it.
      for (const x of [6, 17]) {
        p.vline(x, 0, 33, IRON.base);
        p.vline(x + 1, 0, 33, IRON.lo);
      }
      for (let y = 3; y < 32; y += 5) {
        p.hline(7, y, 10, IRON.hi);
        p.hline(7, y + 1, 10, IRON.lo);
      }
      p.rect(0, 2, 5, 13, '#2a4a8a');
      p.vline(0, 2, 13, '#4a6aaa');
      p.px(2, 6, '#e0c050');
      p.rect(1, 7, 3, 1, '#e0c050');
      p.px(2, 8, '#e0c050');
      p.px(1, 15, '#2a4a8a');
      p.px(3, 15, '#2a4a8a');
      p.outline();
    },
  },
  letter: {
    w: 12, h: 10, ax: 6, ay: 7,
    draw(p) {
      p.rect(1, 2, 10, 6, PAPER);
      p.hline(1, 7, 10, '#c8bca0');
      p.line(1, 2, 6, 5, '#c8bca0');
      p.line(10, 2, 6, 5, '#c8bca0');
      p.ellipse(6, 5.5, 1.8, 1.8, '#c03030');
      p.px(5, 5, '#e05050');
      p.outline();
    },
  },
  heap: {
    w: 22, h: 26, ax: 11, ay: 20,
    draw(p, v) {
      if (v === 'coop') {
        // A laundry heap. Mostly socks.
        p.ball(11, 18, 10, 6, '#7a6a8a', '#9a8aaa', '#5a4a6a');
        for (const [x, y, c] of [[6, 13, '#c04040'], [12, 10, '#e0c050'], [16, 15, '#40a0c0'], [9, 17, '#e8e0d0'], [14, 19, '#60b060']] as const) {
          p.ellipse(x, y, 2.5, 1.6, c);
        }
        p.ellipse(11, 7, 4, 3, '#c04040');
        p.outline();
        return;
      }
      if (v === 'barrels') {
        for (const [x, y] of [[6, 15], [15, 16], [11, 8]] as const) {
          p.rect(x - 4, y - 6, 8, 11, WOOD.base);
          p.vline(x - 4, y - 6, 11, WOOD.hi);
          p.vline(x + 3, y - 6, 11, WOOD.lo);
          p.hline(x - 4, y - 4, 8, IRON.base);
          p.hline(x - 4, y + 2, 8, IRON.base);
          p.ellipse(x, y - 6, 4, 1.5, WOOD.lo);
        }
        p.outline();
        return;
      }
      // Tall rubbish: leaning slats, sacking, a cart wheel.
      p.ball(11, 19, 10, 5.5, '#6a5a44', '#8a7858', '#4a3e30');
      p.poly([[3, 19], [6, 3], [9, 3], [8, 19]], WOOD.base);
      p.line(6, 3, 3, 19, WOOD.hi);
      p.poly([[12, 19], [15, 6], [18, 7], [17, 19]], WOOD.lo);
      p.ball(10, 12, 6, 5, '#7a6a50', '#968466', '#5a4c38');
      p.ring(16, 14, 4, 4, '#5e3e22');
      p.line(12, 14, 20, 14, '#5e3e22');
      p.line(16, 10, 16, 18, '#5e3e22');
      p.speckle(4, 14, 14, 8, '#3a3026', 8);
      p.outline();
    },
  },

  // ------------------------------------------------------------- Burrow stations
  bed: {
    w: 28, h: 20, ax: 6, ay: 15,
    draw(p, v) {
      if (v === 'mattress') {
        p.rect(1, 7, 25, 9, '#c8b890');
        for (let x = 3; x < 25; x += 3) p.vline(x, 7, 9, '#a89870');
        p.hline(1, 7, 25, '#e0d4b0');
        p.rect(2, 5, 7, 5, '#ece4d4');
        p.hline(2, 5, 7, '#ffffff');
        p.rect(10, 9, 15, 7, '#4a5a8a');
        p.hline(10, 9, 15, '#6a7aaa');
        p.px(16, 6, IRON.hi);
        p.px(17, 5, IRON.hi);
        p.px(21, 6, IRON.hi);
        p.rect(1, 16, 25, 2, WOOD.lo);
      } else {
        p.ball(9, 12, 8, 4.5, '#8a7050', '#a89070', '#6a5238');
        p.ball(19, 13, 7, 4, '#7a6446', '#9a8462', '#5a4832');
        p.ball(5, 8, 4.5, 3, '#9a8060', '#b8a080', '#6a5238');
        p.rect(14, 11, 3, 3, '#6a5a3a');
        p.px(8, 13, '#5a4630');
        p.px(11, 11, '#5a4630');
        p.line(17, 15, 23, 13, '#5a4630');
      }
      p.outline();
    },
  },
  grandChair: {
    w: 18, h: 30, ax: 9, ay: 27,
    draw(p) {
      p.rect(3, 4, 12, 16, '#7a2a2a');
      p.rect(5, 6, 8, 12, '#9a3a3a');
      p.vline(3, 4, 16, '#d0a040');
      p.vline(14, 4, 16, '#a07a20');
      p.hline(3, 4, 12, '#e8c060');
      p.poly([[3, 4], [9, 0], [15, 4]], '#d0a040');
      p.px(9, 2, '#c03030');
      p.rect(1, 17, 16, 4, '#9a3a3a');
      p.hline(1, 17, 16, '#c05050');
      p.rect(1, 15, 3, 3, '#d0a040');
      p.rect(14, 15, 3, 3, '#a07a20');
      p.rect(2, 21, 2, 6, '#a07a20');
      p.rect(14, 21, 2, 6, '#a07a20');
      p.outline();
    },
  },
  storage: {
    w: 20, h: 18, ax: 10, ay: 15,
    draw(p, v) {
      if (v === 'full') {
        plank(p, 3, 0, 6, 2);
        mushroom(p, 12, 4, 2, 1.8);
        p.rect(15, 1, 3, 2, IRON.base);
      }
      p.rect(2, 6, 16, 9, '#7a5030');
      p.rect(2, 3, 16, 4, '#9a6a3a');
      p.hline(2, 3, 16, '#ba8a52');
      p.hline(2, 7, 16, '#5e3e22');
      for (const x of [5, 14]) {
        p.vline(x, 3, 12, IRON.lo);
        p.px(x, 4, IRON.hi);
      }
      p.rect(9, 7, 2, 3, '#c8a040');
      p.px(9, 7, '#f0d070');
      p.vline(17, 6, 9, '#5e3e22');
      p.outline();
    },
  },
  pot: {
    w: 20, h: 18, ax: 10, ay: 15,
    draw(p, v) {
      p.rect(6, 13, 8, 2, '#2a1408');
      for (const x of [3, 10, 17]) p.ball(x, 14, 2.6, 2, '#5a5a56', '#7a7a74', '#3a3a38');
      if (v === 'pan') {
        p.ellipse(10, 9, 8, 4, '#c8d0d8');
        p.ellipse(10, 9, 7, 3.2, '#8a96a2');
        p.ellipse(10, 9, 4, 1.8, '#3a5aa8');
        p.px(10, 9, '#e0c050');
        p.ellipse(7, 8, 2.2, 1.4, '#a6e05a');
        p.ellipse(13, 9.5, 2, 1.2, '#a87cbc');
      } else {
        p.ball(10, 8, 6.5, 5, '#5a5e60', '#8a8e90', '#3a3c3e');
        p.hline(4, 4, 13, '#9a9ea0');
        p.hline(5, 5, 11, '#5a4a30');
        p.px(7, 9, '#3a3c3e');
        p.px(13, 7, '#3a3c3e');
        p.ring(10, 3, 3.5, 2, '#3a3c3e');
      }
      p.outline();
    },
  },
  bowls: {
    w: 14, h: 8, ax: 7, ay: 5,
    draw(p, v) {
      p.ellipse(4, 4, 3, 2, '#c89060');
      p.hline(2, 3, 5, '#e8b080');
      if (v === 'two') {
        p.ellipse(10, 5, 3, 2, '#c89060');
        p.hline(8, 4, 5, '#e8b080');
      }
      p.outline();
    },
  },
  workbench: {
    w: 30, h: 22, ax: 15, ay: 19,
    draw(p, v) {
      if (v === 'repaired') {
        p.rect(2, 8, 26, 4, '#9a6a3a');
        p.hline(2, 8, 26, '#ba8a52');
        p.rect(3, 12, 24, 2, '#6a4424');
        for (const x of [3, 25]) p.rect(x, 14, 2, 5, WOOD.lo);
        p.rect(10, 14, 10, 4, '#7a5030');
        p.hline(10, 15, 10, '#5e3e22');
        p.px(15, 16, '#c8a040');
        p.rect(21, 4, 6, 4, IRON.base);
        p.hline(21, 4, 6, IRON.hi);
        p.vline(24, 2, 2, IRON.lo);
        p.line(5, 7, 11, 5, IRON.hi);
        p.rect(4, 6, 2, 2, WOOD.lo);
        p.rect(13, 6, 5, 2, '#c87533');
        p.px(13, 6, '#f0a060');
      } else {
        p.poly([[2, 9], [27, 5], [28, 8.5], [3, 12.5]], '#8a5e34');
        p.line(2, 9, 27, 5, WOOD.hi);
        p.rect(4, 12, 2, 7, WOOD.lo);
        p.rect(24, 8, 2, 11, WOOD.lo);
        p.rect(9, 17, 8, 2, '#6a4424');
        p.line(17, 15, 21, 16, IRON.base);
        p.rect(21, 15, 2, 2, IRON.lo);
        nail(p, 12, 15);
        nail(p, 14, 16);
      }
      p.outline();
    },
  },
  mushroomBed: {
    w: 32, h: 18, ax: 16, ay: 14,
    draw(p, v) {
      p.rect(1, 5, 30, 10, WOOD.lo);
      p.hline(1, 5, 30, WOOD.hi);
      p.rect(3, 7, 26, 6, '#3a2a1c');
      p.speckle(3, 7, 26, 6, '#4e3a28', 16);
      for (const x of [1, 29]) p.rect(x, 3, 2, 3, WOOD.base);
      if (v === 'sprouts') {
        for (let x = 6; x < 28; x += 5) {
          p.px(x, 9, '#8ad060');
          p.px(x + 1, 8, '#8ad060');
        }
      } else if (v === 'growing') {
        for (let x = 5; x < 28; x += 5) {
          p.vline(x, 8, 3, '#d8d0b0');
          p.ellipse(x + 0.5, 8, 1.8, 1.2, '#a6e05a');
        }
      } else if (v === 'ready') {
        for (let x = 5; x < 28; x += 6) mushroom(p, x, 12, 4 + (x % 3), 2.8);
      }
      p.outline();
    },
  },
  dryingRack: {
    w: 26, h: 24, ax: 13, ay: 21,
    draw(p, v) {
      p.line(3, 21, 6, 2, WOOD.base);
      p.line(4, 21, 7, 2, WOOD.lo);
      p.line(22, 21, 19, 2, WOOD.base);
      p.line(23, 21, 20, 2, WOOD.lo);
      p.hline(5, 2, 16, WOOD.hi);
      for (const y of [7, 13]) p.hline(5, y, 16, '#c8b890');
      if (v === 'loaded') {
        for (const y of [7, 13]) {
          for (let x = 7; x < 20; x += 3) {
            p.ellipse(x, y + 2, 1.2, 1.8, '#c8b060');
            p.px(x, y + 1, '#e8d080');
          }
        }
      }
      p.outline();
    },
  },
  boneGrinder: {
    w: 20, h: 22, ax: 10, ay: 19,
    draw(p) {
      p.poly([[2, 3], [17, 3], [14, 10], [5, 10]], WOOD.base);
      p.hline(2, 3, 16, WOOD.hi);
      p.rect(5, 10, 10, 8, IRON.base);
      p.vline(5, 10, 8, IRON.hi);
      p.vline(14, 10, 8, IRON.lo);
      p.line(15, 12, 18, 9, IRON.lo);
      p.rect(17, 8, 2, 2, '#c8a040');
      bone(p, 7, 2, 11, 1);
      p.rect(6, 18, 8, 2, '#d8d0c0');
      p.outline();
    },
  },
  generator: {
    w: 24, h: 26, ax: 12, ay: 23,
    draw(p, v) {
      p.rect(6, 4, 12, 17, '#2a4a40');
      p.rect(7, 5, 10, 15, '#1e3630');
      const fill = v === 'on' ? '#58c078' : '#2f5a40';
      p.rect(7, 10, 10, 10, fill);
      if (v === 'on') {
        p.hline(7, 10, 10, '#a8f8a0');
        p.px(10, 14, '#c8ffc0');
        p.px(13, 17, '#c8ffc0');
      }
      p.vline(8, 5, 6, '#a8d0c8');
      p.rect(5, 2, 14, 3, IRON.base);
      p.hline(5, 2, 14, IRON.hi);
      p.rect(5, 20, 14, 3, IRON.base);
      p.rect(18, 8, 5, 2, '#c87533');
      p.rect(21, 8, 2, 13, '#c87533');
      p.vline(21, 8, 13, '#f0a060');
      p.outline();
    },
  },
  lantern: {
    w: 14, h: 28, ax: 7, ay: 25,
    draw(p, v) {
      if (v === 'candle') {
        p.rect(3, 20, 8, 5, '#7a4a3a');
        p.hline(3, 20, 8, '#9a6a5a');
        p.rect(6, 15, 2, 5, PAPER);
        p.px(6, 15, '#ffffff');
        p.ellipse(6, 20, 2.5, 1, '#d8d0b8');
        p.outline();
        return;
      }
      p.rect(6, 9, 2, 16, WOOD.lo);
      p.vline(6, 9, 16, WOOD.base);
      p.rect(4, 24, 6, 2, WOOD.dark);
      p.rect(2, 2, 10, 8, IRON.lo);
      p.rect(3, 3, 8, 6, '#f8d070');
      p.rect(5, 4, 4, 4, '#fff4c0');
      p.vline(7, 3, 6, IRON.lo);
      p.rect(1, 1, 12, 2, IRON.base);
      p.hline(1, 1, 12, IRON.hi);
      p.outline();
    },
  },
  sign: {
    w: 46, h: 24, ax: 23, ay: 21,
    draw(p, v) {
      p.rect(7, 12, 2, 10, WOOD.lo);
      p.rect(37, 12, 2, 10, WOOD.lo);
      if (v === 'definitely') {
        p.rect(1, 1, 44, 15, '#a87440');
        p.hline(1, 1, 44, '#d0a060');
        p.hline(1, 15, 44, '#7a5030');
        p.rect(2, 2, 42, 1, '#c8a040');
        p.text('DEFINITELY', 23 - Math.floor(Painter.textWidth('DEFINITELY') / 2), 3, INK);
        p.text('NOT A LAIR', 23 - Math.floor(Painter.textWidth('NOT A LAIR') / 2), 9, INK);
        p.px(3, 13, '#c8a040');
        p.px(42, 13, '#c8a040');
      } else {
        p.poly([[1, 5], [44, 3], [45, 13], [2, 15]], '#6a4424');
        p.line(1, 5, 44, 3, '#8a5e34');
        p.line(2, 9, 44, 8, '#5a3820');
        p.text('NOT A LAIR', 23 - Math.floor(Painter.textWidth('NOT A LAIR') / 2), 7, '#e8e0c8');
        nail(p, 4, 6);
        nail(p, 41, 5);
      }
      p.outline();
    },
    label: (p, v, x, y, w, h) => (v === 'definitely' ? letter(p, ['DEFINITELY', 'NOT A LAIR'], x, y, w, h, INK) : letter(p, ['NOT A LAIR'], x, y, w, h, PAPER)),
  },

  wallClock: {
    w: 14, h: 16, ax: 7, ay: 15,
    draw(p) {
      p.rect(3, 9, 8, 6, WOOD.base);
      p.vline(3, 9, 6, WOOD.hi);
      p.ball(7, 6, 6, 6, '#c8a040', '#f0d070', '#8a6a20');
      p.ellipse(7, 6, 4.5, 4.5, '#ece4c8');
      p.line(7, 6, 7, 3, INK);
      p.line(7, 6, 9, 7, INK);
      for (const [x, y] of [[7, 2], [11, 6], [7, 10], [3, 6]] as const) p.px(x, y, '#6a5440');
      p.vline(7, 11, 3, '#c8a040');
      p.ellipse(7, 13.5, 1.5, 1.5, '#f0d070');
      p.outline();
    },
  },
  waxFern: {
    w: 16, h: 20, ax: 8, ay: 18,
    draw(p) {
      p.poly([[4, 13], [12, 13], [11, 18], [5, 18]], '#9a5a30');
      p.hline(4, 13, 9, '#c07a48');
      for (const [x0, y0, x1, y1] of [[8, 13, 2, 4], [8, 13, 14, 3], [8, 13, 8, 1], [8, 13, 3, 9], [8, 13, 13, 9]] as const) {
        p.line(x0, y0, x1, y1, '#4a8a3a');
        p.px(x1, y1, '#7ac05a');
        p.px((x0 + x1) / 2, (y0 + y1) / 2, '#6aaa4a');
      }
      p.outline();
    },
  },
  estPlaque: {
    w: 26, h: 10, ax: 13, ay: 9,
    draw(p) {
      p.rect(1, 1, 24, 7, '#c8a040');
      p.hline(1, 1, 24, '#f0d070');
      p.hline(1, 7, 24, '#8a6a20');
      p.text('EST. NOW', 13 - Math.floor(Painter.textWidth('EST. NOW') / 2), 2, INK);
      p.outline();
    },
    label: (p, _v, x, y, w, h) => letter(p, ['EST.'], x, y, w, h, INK),
  },

  // ------------------------------------------------------------- Cooperative
  desk: {
    w: 38, h: 22, ax: 19, ay: 18,
    draw(p) {
      p.rect(2, 7, 34, 11, '#5a3820');
      p.rect(1, 5, 36, 3, '#9a6a3a');
      p.hline(1, 5, 36, '#ba8a52');
      p.rect(5, 9, 28, 7, '#c8a040');
      p.rect(6, 10, 26, 5, '#a88430');
      p.text('CHARTERS', 19 - Math.floor(Painter.textWidth('CHARTERS') / 2), 10, INK);
      p.rect(4, 1, 8, 4, PAPER);
      p.rect(5, 0, 7, 1, '#d8d0b8');
      p.hline(5, 2, 5, '#a8a090');
      p.rect(27, 2, 3, 3, '#1a1a2a');
      p.line(28, 0, 31, 2, '#f8f8f0');
      p.rect(18, 3, 4, 2, '#c03030');
      p.vline(19, 0, 3, WOOD.lo);
      p.vline(20, 0, 3, WOOD.lo);
      p.outline();
    },
  },
  hatch: {
    w: 30, h: 28, ax: 15, ay: 22,
    draw(p) {
      p.rect(3, 4, 24, 16, '#5e3e22');
      p.rect(6, 7, 18, 10, '#1a1410');
      p.rect(0, 5, 4, 14, WOOD.base);
      p.vline(0, 5, 14, WOOD.hi);
      p.rect(26, 5, 4, 14, WOOD.base);
      p.vline(29, 5, 14, WOOD.lo);
      p.rect(1, 19, 28, 3, '#9a6a3a');
      p.hline(1, 19, 28, '#ba8a52');
      p.rect(4, 0, 22, 7, '#d8c8a0');
      p.text('HATCH', 15 - Math.floor(Painter.textWidth('HATCH') / 2), 1, INK);
      p.outline();
    },
  },
  board: {
    w: 32, h: 28, ax: 16, ay: 26,
    draw(p) {
      p.rect(5, 16, 2, 10, WOOD.lo);
      p.rect(25, 16, 2, 10, WOOD.lo);
      p.rect(1, 1, 30, 18, WOOD.lo);
      p.rect(2, 2, 28, 16, '#b08050');
      p.speckle(2, 2, 28, 16, '#9a6c40', 30);
      p.rect(4, 4, 9, 7, PAPER);
      p.px(8, 4, '#c03030');
      for (let y = 6; y < 10; y += 2) p.hline(5, y, 7, '#8a8070');
      // The Guild's survey notice: too small to read from here, but that red seal is unmistakable.
      p.rect(15, 3, 12, 9, '#f0e8c0');
      p.px(21, 3, '#3060c0');
      for (let y = 5; y < 10; y += 2) p.hline(16, y, 7, '#8a8070');
      p.rect(23, 8, 3, 3, '#c03030');
      p.px(24, 8, '#e05050');
      p.rect(6, 12, 10, 5, '#d8c8a0');
      p.px(11, 12, '#c03030');
      p.hline(7, 14, 8, '#8a8070');
      p.rect(19, 13, 8, 4, '#e8d0d0');
      p.hline(20, 15, 6, '#a04040');
      p.outline();
    },
    // On the generated board, the board rect is the Guild's notice: just its seal.
    label(p, _v, x, y, w, h) {
      p.rect(x + w - 2, y + h - 2, 2, 2, '#c03030');
      p.px(x + w - 2, y + h - 2, '#e05050');
    },
  },
  queueRope: {
    w: 44, h: 16, ax: 22, ay: 14,
    draw(p) {
      for (const x of [3, 40]) {
        p.rect(x - 1, 2, 3, 11, '#c8a040');
        p.vline(x - 1, 2, 11, '#f0d070');
        p.ellipse(x, 2, 2, 1.5, '#f0d070');
        p.ellipse(x, 13, 3, 1.2, '#8a6a20');
      }
      for (let x = 4; x < 40; x++) {
        const sag = Math.sin(((x - 4) / 36) * Math.PI) * 4;
        p.px(x, 4 + sag, '#b02a2a');
        p.px(x, 5 + sag, '#7a1a1a');
      }
      p.outline();
    },
  },
  sconce: {
    w: 8, h: 10, ax: 4, ay: 9,
    draw(p) {
      p.rect(3, 5, 2, 5, IRON.lo);
      p.rect(1, 1, 6, 5, '#c8a040');
      p.rect(2, 2, 4, 3, '#fff0b0');
      p.outline();
    },
  },

  // ------------------------------------------------------------- landmarks (2x2 footprint)
  chandelier: {
    w: 42, h: 38, ax: 21, ay: 33,
    draw(p) {
      p.ball(21, 30, 19, 6, '#6a5a3a', '#8a7a50', '#4a3e28');
      for (let i = 0; i < 14; i++) {
        const x = 4 + p.rng() * 34;
        p.line(x, 27 + p.rng() * 6, x + 3 - p.rng() * 6, 26 + p.rng() * 6, '#a89a60');
      }
      p.ring(21, 19, 16, 10, '#8a6a20');
      p.ring(21, 19, 15, 9, '#e0c060');
      p.ring(21, 19, 14, 8, '#a88430');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x = 21 + Math.cos(a) * 15;
        const y = 19 + Math.sin(a) * 9;
        p.line(21, 19, x, y, '#a88430');
        p.rect(x - 1, y - 3, 3, 3, PAPER);
        p.px(x, y - 3, '#f8f8f0');
      }
      p.ellipse(21, 19, 3, 2, '#c8a040');
      for (let y = 2; y < 10; y++) p.px(21, y, y % 2 ? '#8a9096' : '#5e646a');
      for (const [x, y] of [[9, 24], [31, 25], [14, 29], [27, 31]] as const) {
        p.px(x, y, '#cfe8f0');
        p.px(x + 1, y + 1, '#ffffff');
      }
      p.outline();
    },
  },
  founderStatue: {
    w: 36, h: 50, ax: 18, ay: 46,
    draw(p) {
      p.rect(3, 36, 30, 10, '#6a7a7a');
      p.rect(2, 34, 32, 3, '#8fa0a0');
      p.hline(2, 34, 32, '#b0c0c0');
      p.text('FOUNDER', 18 - Math.floor(Painter.textWidth('FOUNDER') / 2), 39, '#3a4444');
      p.poly([[11, 34], [25, 34], [23, 15], [13, 15]], '#8fa0a0');
      p.poly([[18, 34], [25, 34], [23, 15], [19, 15]], '#6a7a7a');
      p.line(14, 16, 12, 33, '#b0c0c0');
      p.poly([[22, 16], [27, 9], [29, 10], [24, 18]], '#8fa0a0');
      p.rect(26, 4, 7, 6, '#7a8a8a');
      p.hline(26, 4, 7, '#a0b0b0');
      p.ball(18, 11, 4.5, 4.5, '#8fa0a0', '#b0c0c0', '#6a7a7a');
      p.vline(18, 4, 4, '#d8d0b0');
      p.ball(18, 4, 7, 3.6, '#a6e05a', '#d8ff8a', '#5f9636');
      p.px(15, 3, '#f4ffd0');
      p.px(21, 2, '#f4ffd0');
      p.speckle(12, 18, 12, 14, '#4a6a3a', 10);
      p.speckle(3, 40, 30, 6, '#3a5a44', 12);
      p.outline();
    },
  },
  piston: {
    w: 38, h: 46, ax: 19, ay: 42,
    draw(p) {
      p.rect(5, 20, 28, 21, '#5a5e64');
      p.vline(8, 20, 21, '#7a8086');
      p.vline(29, 20, 21, '#44484e');
      p.speckle(6, 22, 26, 18, RUST, 18);
      p.line(12, 24, 12, 38, '#7a4a28');
      p.line(24, 22, 25, 36, '#7a4a28');
      p.rect(3, 18, 32, 3, IRON.base);
      p.hline(3, 18, 32, IRON.hi);
      p.rect(3, 39, 32, 3, IRON.base);
      for (let x = 5; x < 34; x += 5) {
        p.px(x, 19, '#d0d4d8');
        p.px(x, 40, '#d0d4d8');
      }
      p.rect(15, 3, 8, 15, '#8a9096');
      p.vline(16, 3, 15, '#c8ccd0');
      p.vline(22, 3, 15, '#5e646a');
      p.rect(15, 11, 8, 2, RUST);
      p.rect(11, 1, 16, 4, IRON.base);
      p.hline(11, 1, 16, IRON.hi);
      p.outline();
    },
  },
};

export interface PropArt {
  canvas: HTMLCanvasElement;
  ax: number;
  ay: number;
}

export function hasProp(id: string): boolean {
  return id in PROPS;
}

export function propArt(id: string, variant = ''): PropArt {
  const def = PROPS[id];
  if (!def) throw new Error(`No prop art '${id}'`);
  return generated(id, variant, def) ?? { canvas: art(`prop:${id}:${variant}`, def.w, def.h, (p) => def.draw(p, variant)), ax: def.ax, ay: def.ay };
}

/** The generated art for a prop state, if it has some and props.png has loaded. */
function generatedDef(id: string, variant: string): PropArtDef | null {
  const gen: PropArtDef | undefined = (PROP_ART as Record<string, PropArtDef>)[id];
  return gen && variant in gen.variants && artImage('props.png') ? gen : null;
}

/** Without an anchor of its own, generated art sits where the hand-drawn prop's anchor did, proportionally. */
function generatedAnchor(def: PropDef, gen: PropArtDef): readonly [number, number] {
  return gen.anchor ?? [Math.round((def.ax / def.w) * gen.w), gen.h - Math.round(((def.h - def.ay) / def.h) * gen.h)];
}

/** A prop state cut from props.png and lettered, or null to paint it instead. */
function generated(id: string, variant: string, def: PropDef): PropArt | null {
  const gen = generatedDef(id, variant);
  const img = artImage('props.png');
  if (!gen || !img) return null;
  const [sx, sy] = gen.variants[variant]!;
  const canvas = art(`propgen:${id}:${variant}`, gen.w, gen.h, (p) => {
    p.ctx.drawImage(img, sx, sy, gen.w, gen.h, 0, 0, gen.w, gen.h);
    if (def.label && gen.board) def.label(p, variant, ...gen.board);
  });
  const [ax, ay] = generatedAnchor(def, gen);
  return { canvas, ax, ay };
}

/**
 * Where code draws into a prop's generated art (a sign's lettering, the hatch window), relative to
 * the prop's anchor. Null when the prop is painted, or its art has no board.
 */
export function propBoard(id: string, variant = ''): { x: number; y: number; w: number; h: number } | null {
  const def = PROPS[id];
  const gen = generatedDef(id, variant);
  if (!def || !gen?.board) return null;
  const [ax, ay] = generatedAnchor(def, gen);
  const [x, y, w, h] = gen.board;
  return { x: x - ax, y: y - ay, w, h };
}

/** Draw a prop with its anchor at (x, y). */
export function drawProp(ctx: CanvasRenderingContext2D, id: string, variant: string, x: number, y: number, flip = false): void {
  const a = propArt(id, variant);
  if (!flip) {
    ctx.drawImage(a.canvas, Math.round(x - a.ax), Math.round(y - a.ay));
    return;
  }
  ctx.save();
  ctx.translate(Math.round(x + a.ax), Math.round(y - a.ay));
  ctx.scale(-1, 1);
  ctx.drawImage(a.canvas, 0, 0);
  ctx.restore();
}

/** A white silhouette of a prop, for hover and interaction highlights. */
export function propSilhouette(id: string, variant: string, color: string): PropArt {
  const base = propArt(id, variant);
  const canvas = art(`prop:${id}:${variant}:sil:${color}`, base.canvas.width, base.canvas.height, (p) => {
    p.ctx.drawImage(base.canvas, 0, 0);
    p.ctx.globalCompositeOperation = 'source-in';
    p.ctx.fillStyle = color;
    p.ctx.fillRect(0, 0, base.canvas.width, base.canvas.height);
  });
  return { canvas, ax: base.ax, ay: base.ay };
}
