import type { Input } from '../core/input';
import { VIEW_W } from '../core/screen';
import { SPEAKERS, type DialogueEffect, type DialogueNode, type Script } from '../data/story';
import { portrait } from '../render/art/portraits';
import type { Hud } from './hud';
import { confirmPressed, cursor, keyHints, ListNav, UI, type Overlay } from './overlay';

const CHARS_PER_SECOND = 48;
const PAUSE_AFTER: Record<string, number> = { '.': 0.22, '!': 0.22, '?': 0.22, ',': 0.1, ':': 0.12 };

const BOX = { x: 8, y: 190, w: VIEW_W - 16, h: 74 };
const TEXT_X = BOX.x + 62;
const TEXT_W = BOX.w - 70;

export interface DialogueHooks {
  effect(e: DialogueEffect): void;
  blip(pitch: number): void;
  select(): void;
}

/** A conversation: typed out a letter at a time, with a portrait that talks and blinks. */
export class DialogueOverlay implements Overlay {
  readonly pauses = true;
  done = false;
  private node: DialogueNode;
  private line = 0;
  private shown = 0;
  private hold = 0;
  private sinceBlip = 0;
  private readonly nav = new ListNav(0);
  private blinkT = 0;

  constructor(private readonly script: Script, private readonly hooks: DialogueHooks) {
    this.node = this.enter(script.start);
  }

  private enter(id: string): DialogueNode {
    const node = this.script.nodes[id];
    if (!node) throw new Error(`Dialogue node '${id}' missing`);
    if (node.effect) this.hooks.effect(node.effect);
    this.line = 0;
    this.shown = 0;
    this.nav.count = node.choices?.length ?? 0;
    this.nav.index = 0;
    return node;
  }

  private get current(): { who: keyof typeof SPEAKERS; text: string } | undefined {
    return this.node.lines[this.line];
  }

  private get typing(): boolean {
    const l = this.current;
    return !!l && this.shown < l.text.length;
  }

  private get choosing(): boolean {
    return !this.typing && this.line >= this.node.lines.length - 1 && (this.node.choices?.length ?? 0) > 0;
  }

  update(dt: number, input: Input): void {
    this.blinkT += dt;
    const l = this.current;
    if (!l) {
      this.done = true;
      return;
    }
    if (this.typing) {
      if (this.hold > 0) this.hold -= dt;
      else {
        const before = Math.floor(this.shown);
        this.shown = Math.min(l.text.length, this.shown + dt * CHARS_PER_SECOND);
        const after = Math.floor(this.shown);
        if (after > before) {
          const ch = l.text[after - 1] ?? '';
          this.hold = PAUSE_AFTER[ch] ?? 0;
          this.sinceBlip += after - before;
          if (this.sinceBlip >= 2 && ch !== ' ') {
            this.sinceBlip = 0;
            this.hooks.blip(SPEAKERS[l.who].voice);
          }
        }
      }
      if (confirmPressed(input) || input.wasMousePressed(0)) this.shown = l.text.length;
      return;
    }

    if (this.choosing) {
      const picked = this.nav.update(input, () => this.hooks.blip(1.6));
      if (picked === null) return;
      const choice = this.node.choices![picked]!;
      this.hooks.select();
      if (choice.next === null) this.done = true;
      else this.node = this.enter(choice.next);
      return;
    }

    if (confirmPressed(input) || input.wasMousePressed(0)) {
      if (this.line < this.node.lines.length - 1) {
        this.line++;
        this.shown = 0;
      } else if (this.node.next) this.node = this.enter(this.node.next);
      else this.done = true;
    }
  }

  draw(hud: Hud, time: number): void {
    const l = this.current;
    if (!l) return;
    const sp = SPEAKERS[l.who];

    hud.panel(BOX.x, BOX.y, BOX.w, BOX.h);
    // Portrait in a recessed frame.
    hud.panel(BOX.x + 6, BOX.y + 7, 48, 48, 'inset');
    hud.fill(BOX.x + 8, BOX.y + 9, 44, 44, '#1c2018');
    const talking = this.typing && Math.floor(this.shown / 2) % 2 === 0 && this.hold <= 0;
    const blink = this.blinkT % 3.4 > 3.25;
    hud.px.drawImage(portrait(sp.portrait, talking, blink), BOX.x + 10, BOX.y + 11);

    // Name tag.
    const nameW = Math.ceil(hud.measure(sp.name, 7, 'head')) + 12;
    hud.panel(BOX.x + 4, BOX.y - 9, nameW, 13, 'light');
    hud.text(sp.name, BOX.x + 10, BOX.y - 6, { font: 'head', size: 7, color: sp.color });

    // Text, typed out.
    const lines = hud.wrap(l.text, TEXT_W, 8);
    let left = Math.floor(this.shown);
    lines.forEach((text, i) => {
      const part = text.slice(0, Math.max(0, left));
      left -= text.length + 1;
      hud.text(part, TEXT_X, BOX.y + 8 + i * 12, { size: 8 });
    });

    if (this.choosing) this.drawChoices(hud, time);
    else if (!this.typing) {
      const bob = Math.floor(time * 3) % 2;
      hud.fill(BOX.x + BOX.w - 14, BOX.y + BOX.h - 11 + bob, 5, 1, UI.gold);
      hud.fill(BOX.x + BOX.w - 13, BOX.y + BOX.h - 10 + bob, 3, 1, UI.gold);
      hud.fill(BOX.x + BOX.w - 12, BOX.y + BOX.h - 9 + bob, 1, 1, UI.gold);
      keyHints(hud, [['E', 'Next']], BOX.x + BOX.w - 22, BOX.y + BOX.h - 14, 'right');
    }
  }

  private drawChoices(hud: Hud, time: number): void {
    const choices = this.node.choices ?? [];
    const w = Math.max(...choices.map((c) => hud.measure(c.text, 8))) + 30;
    const h = choices.length * 13 + 10;
    const x = BOX.x + BOX.w - w - 6;
    const y = BOX.y - h - 4;
    hud.panel(x, y, w, h);
    this.nav.beginPlacing();
    choices.forEach((c, i) => {
      const cy = y + 6 + i * 13;
      this.nav.place({ x, y: cy - 2, w, h: 13 });
      const on = i === this.nav.index;
      if (on) cursor(hud, x + 6, cy + 2, time);
      hud.text(c.text, x + 16, cy, { size: 8, color: on ? UI.text : UI.dim });
    });
  }
}
