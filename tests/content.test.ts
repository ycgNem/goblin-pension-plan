import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { NODES, rollYield, maxYield, type NodeDef, type NodeId } from '../src/data/nodes';
import { REGION_IDS, HOME_REGION } from '../src/data/regions';
import { SKILLS } from '../src/data/skills';
import { BARKS, DORRIT_FIRST, DORRIT_LATER, DORRIT_OPEN, FIRST_VISIT, GRUBB_FIRST, grubbChat, HINTS, INTRO, SPEAKERS, type Script } from '../src/data/story';
import { AWARE_ICONS, BUTTON_ICON, CHECK_ICON, DECOR_ICONS, ITEM_ICONS, LOCK_ICON } from '../src/render/art/icons';
import { GOBLIN, GRUBB, HUMAN_PALETTES, humanSprite, MITE, RAT, SLIME, SLIMELET } from '../src/render/art/characters';
import { hasProp } from '../src/render/art/props';
import { GLYPHS } from '../src/render/paint';
import { validateSprite, type SpriteDef } from '../src/render/sprites';
import { seededRng } from './helpers';

describe('sprites', () => {
  it('every string sprite is the right size and only uses its palette', () => {
    const all: [string, SpriteDef][] = [
      ['GOBLIN', GOBLIN], ['GRUBB', GRUBB], ['RAT', RAT], ['SLIME', SLIME], ['SLIMELET', SLIMELET], ['MITE', MITE],
      ['BUTTON_ICON', BUTTON_ICON], ['CHECK_ICON', CHECK_ICON], ['LOCK_ICON', LOCK_ICON],
      ...Object.entries(HUMAN_PALETTES).map(([id, p]): [string, SpriteDef] => [`human:${id}`, humanSprite(p)]),
      ...Object.entries(ITEM_ICONS).map(([id, s]): [string, SpriteDef] => [`icon:${id}`, s]),
      ...Object.entries(DECOR_ICONS).map(([id, s]): [string, SpriteDef] => [`decor:${id}`, s!]),
      ...Object.entries(AWARE_ICONS).map(([id, s]): [string, SpriteDef] => [`aware:${id}`, s as SpriteDef]),
    ];
    const problems = all.flatMap(([name, def]) => validateSprite(name, def));
    expect(problems).toEqual([]);
  });

  it('every item has an icon', () => {
    for (const id of Object.keys(ITEMS)) expect(id in ITEM_ICONS, id).toBe(true);
  });

  it('the pixel font has well-formed 3x5 glyphs', () => {
    for (const [ch, g] of Object.entries(GLYPHS)) {
      const rows = g.split('|');
      expect(rows.length, ch).toBe(5);
      for (const r of rows) expect(r.length, `${ch}: '${r}'`).toBeLessThanOrEqual(3);
    }
  });
});

describe('nodes', () => {
  const ids = Object.keys(NODES) as NodeId[];

  it('yield real items, train real skills, and have art', () => {
    for (const id of ids) {
      const def: NodeDef = NODES[id];
      for (const y of def.yields) {
        expect(y.item in ITEMS, `${id} yields ${y.item}`).toBe(true);
        expect(y.min, id).toBeLessThanOrEqual(y.max);
      }
      expect(def.skill in SKILLS, id).toBe(true);
      expect(hasProp(def.art), `${id} art ${def.art}`).toBe(true);
    }
  });

  it('never roll more than their maximum', () => {
    const rng = seededRng(11);
    for (const id of ids) {
      const def: NodeDef = NODES[id];
      for (let i = 0; i < 200; i++) {
        const got = rollYield(def, rng, i % 2 === 0).reduce((s, y) => s + y.qty, 0);
        expect(got, id).toBeLessThanOrEqual(maxYield(def));
      }
    }
  });
});

describe('story', () => {
  const scripts: [string, Script][] = [
    ['GRUBB_FIRST', GRUBB_FIRST],
    ['DORRIT_FIRST', DORRIT_FIRST],
    ['DORRIT_LATER', DORRIT_LATER],
    ['grubbChat(3 left)', grubbChat({ stepsLeft: 3, nextStep: 'Build a mushroom bed', visit: 0, orderReady: false, fromCrate: false, orderDone: false, stamped: false, occupancy: 0, nextPayment: 0 })],
    ['grubbChat(order ready, last step)', grubbChat({ stepsLeft: 1, nextStep: 'Complete a production order', visit: 1, orderReady: true, fromCrate: true, orderDone: false, stamped: false, occupancy: 0, nextPayment: 0 })],
    ['grubbChat(stamp due)', grubbChat({ stepsLeft: 0, nextStep: null, visit: 2, orderReady: false, fromCrate: false, orderDone: true, stamped: false, occupancy: 0, nextPayment: 0 })],
    ['grubbChat(paying)', grubbChat({ stepsLeft: 0, nextStep: null, visit: 3, orderReady: false, fromCrate: false, orderDone: true, stamped: true, occupancy: 575, nextPayment: 25 })],
    ['DORRIT_OPEN', DORRIT_OPEN],
  ];

  it('every conversation starts somewhere real and only leads to real places', () => {
    for (const [name, s] of scripts) {
      expect(s.nodes[s.start], `${name} start`).toBeDefined();
      for (const [key, node] of Object.entries(s.nodes)) {
        expect(node.lines.length, `${name}.${key} has lines`).toBeGreaterThan(0);
        for (const line of node.lines) expect(line.who in SPEAKERS, `${name}.${key} speaker ${line.who}`).toBe(true);
        const targets = [node.next, ...(node.choices ?? []).map((c) => c.next)];
        for (const t of targets) if (t) expect(s.nodes[t], `${name}.${key} -> ${t}`).toBeDefined();
      }
    }
  });

  it('every conversation can be finished', () => {
    for (const [name, s] of scripts) {
      // Some path from the start must reach a node that ends the conversation.
      const seen = new Set<string>();
      const queue = [s.start];
      let ends = false;
      while (queue.length) {
        const key = queue.shift()!;
        if (seen.has(key)) continue;
        seen.add(key);
        const node = s.nodes[key]!;
        const next = [node.next, ...(node.choices ?? []).map((c) => c.next)];
        if (!node.choices && !node.next) ends = true;
        for (const n of next) if (n === null && node.choices) ends = true;
        for (const n of next) if (n) queue.push(n);
      }
      expect(ends, name).toBe(true);
    }
  });

  it('speech bubbles stay short', () => {
    for (const [kind, lines] of Object.entries(BARKS)) for (const l of lines) expect(l.length, `${kind}: ${l}`).toBeLessThanOrEqual(50);
  });

  it('every region but home has a first-visit caption', () => {
    for (const id of REGION_IDS) if (id !== HOME_REGION) expect(FIRST_VISIT[id], id).toBeTruthy();
  });

  it('the intro has its six panels, each with something to say', () => {
    expect(INTRO.length).toBe(6);
    for (const p of INTRO) expect(p.text.length).toBeGreaterThan(10);
  });

  it('every hint names its keys', () => {
    for (const [id, h] of Object.entries(HINTS)) {
      expect(h.keys.length, id).toBeGreaterThan(0);
      expect(h.text.length, id).toBeLessThanOrEqual(56);
    }
  });
});
