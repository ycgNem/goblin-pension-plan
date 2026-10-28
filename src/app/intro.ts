import { audio } from '../audio/audio';
import type { Input } from '../core/input';
import { clamp } from '../core/math';
import { BASE_H, BASE_W, stageOrigin, VIEW_H, VIEW_W } from '../core/screen';
import { CHAPTER_CARD, GUILD_SURVEY, INTRO } from '../data/story';
import { GOBLIN, HUMAN_PALETTES, humanSprite } from '../render/art/characters';
import { drawFrameVignette, Lighting, type Light } from '../render/lighting';
import { sprite } from '../render/sprites';
import type { Hud } from '../ui/hud';
import { confirmPressed, keyHints, UI } from '../ui/overlay';
import { panelArt } from './backdrops';

const CPS = 38;
const FADE = 0.5;
const BAR = 46;
/** When the PENDING stamp lands on the survey notice, in seconds into its panel. */
const STAMP_AT = 1.1;

const PARTY = [humanSprite(HUMAN_PALETTES.paladin), humanSprite(HUMAN_PALETTES.ranger), humanSprite(HUMAN_PALETTES.apprentice)];

/** The story so far: six illustrated panels, narrated. Space moves on, Esc skips. */
export class IntroScreen {
  private index = 0;
  private t = 0;
  private shown = 0;
  private leaving = -1;
  private stamped = false;
  private readonly lighting = new Lighting();
  private readonly junk: { x: number; y: number; vy: number; c: string }[] = [];

  constructor(private readonly input: Input, private readonly onDone: () => void) {
    audio.sfx('page');
  }

  update(dt: number): void {
    this.t += dt;
    const text = INTRO[this.index]!.text;
    if (this.leaving >= 0) {
      this.leaving += dt;
      if (this.leaving >= FADE) this.next();
      return;
    }
    if (this.t > FADE * 0.6) this.shown = Math.min(text.length, this.shown + dt * CPS);
    if (this.input.wasPressed('Escape')) {
      this.onDone();
      return;
    }
    if (confirmPressed(this.input) || this.input.wasMousePressed(0)) {
      if (this.shown < text.length) this.shown = text.length;
      else this.leaving = 0;
    }
    // Panels move on by themselves after a long pause.
    if (this.shown >= text.length && this.t > text.length / CPS + 5) this.leaving = 0;

    // The PENDING stamp lands on the survey notice once.
    if (INTRO[this.index]!.art === 'notice' && !this.stamped && this.t >= STAMP_AT + 0.12) {
      this.stamped = true;
      audio.sfx('hit', { pitch: 0.6 });
    }
    if (INTRO[this.index]!.art === 'chute' && Math.random() < dt * 9) {
      const colors = ['#cfc8b0', '#8a9096', '#9a5a30', '#6a4a2c', '#5aa07a', '#c04040', '#e8e0c8'];
      this.junk.push({ x: 230 + Math.random() * 20, y: 46, vy: 10 + Math.random() * 30, c: colors[Math.floor(Math.random() * colors.length)]! });
    }
    for (const j of this.junk) {
      j.vy += 200 * dt;
      j.y += j.vy * dt;
    }
    for (let i = this.junk.length - 1; i >= 0; i--) if (this.junk[i]!.y > BASE_H) this.junk.splice(i, 1);
  }

  private next(): void {
    this.index++;
    this.t = 0;
    this.shown = 0;
    this.leaving = -1;
    if (this.index >= INTRO.length) this.onDone();
    else audio.sfx('page');
  }

  render(ctx: CanvasRenderingContext2D, hud: Hud): void {
    const panel = INTRO[Math.min(this.index, INTRO.length - 1)]!;
    const info = panelArt(panel.art);
    // Panels are illustrations at the base size, centered, with black around them.
    const stage = stageOrigin();
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(stage.x, stage.y);
    ctx.beginPath();
    ctx.rect(0, 0, BASE_W, BASE_H);
    ctx.clip();
    // A slow push in.
    const drift = Math.round(Math.min(8, this.t * 1.2));
    ctx.drawImage(info.canvas, -drift, -Math.round(drift / 2), BASE_W + drift * 2, BASE_H + drift);
    const lights: Light[] = [];
    const t = this.t;

    switch (panel.art) {
      case 'city':
        for (const [k, [bx, by]] of Object.entries(info.marks)) {
          if (!k.startsWith('bell')) continue;
          const swing = Math.round(Math.sin(t * 2.2 + bx) * 2);
          ctx.fillStyle = '#c8a040';
          ctx.fillRect(bx - 2 + swing - drift, by - drift / 2, 5, 4);
        }
        for (let i = 0; i < 4; i++) {
          const bx = ((t * 18 + i * 120) % 560) - 40;
          const by = 60 + i * 12 + Math.sin(t * 3 + i) * 3;
          ctx.fillStyle = '#17141f';
          ctx.fillRect(Math.round(bx), Math.round(by), 2, 1);
          ctx.fillRect(Math.round(bx) + 2, Math.round(by) - 1, 2, 1);
          ctx.fillRect(Math.round(bx) - 2, Math.round(by) - 1, 2, 1);
        }
        lights.push({ x: 380, y: 46, r: 140, color: '#c8c0e0', a: 0.6 }, { x: 240, y: 150, r: 300, color: '#e0b0a0', a: 0.8 });
        break;
      case 'chute':
        for (const j of this.junk) {
          ctx.fillStyle = j.c;
          ctx.fillRect(Math.round(j.x) - drift, Math.round(j.y), 2, 2);
        }
        lights.push({ x: 240, y: 40, r: 120, color: '#f0c890', a: 0.8 }, { x: 240, y: 268, r: 100, color: '#5aa060', a: 0.7 });
        break;
      case 'heroes': {
        const px = 380 - t * 22;
        PARTY.forEach((def, i) => {
          sprite(def).draw(ctx, 2 + (Math.floor(t * 5 + i) % 2), px + i * 22 - drift, 188, { flip: true, silhouette: '#0a0806' });
        });
        lights.push({ x: px - drift, y: 168, r: 90, color: '#ffb060', a: 0.95, flicker: 0.3 });
        const [ex, ey] = info.marks.eyes!;
        if (Math.floor(t * 0.9) % 4 !== 0) {
          ctx.fillStyle = '#f4e46a';
          ctx.fillRect(ex - drift, ey, 1, 1);
          ctx.fillRect(ex + 3 - drift, ey, 1, 1);
        }
        lights.push({ x: ex - drift, y: ey, r: 14, color: '#f4e46a', a: 0.6 });
        break;
      }
      case 'alcove': {
        const [gx, gy] = info.marks.goblin!;
        sprite(GOBLIN).draw(ctx, 0, gx - drift, gy - drift / 2);
        for (let i = 0; i < 3; i++) {
          const k = (t * 0.7 + i / 3) % 1;
          ctx.fillStyle = 'rgba(160, 190, 200, 0.8)';
          ctx.fillRect(200 + i * 34 - drift, Math.round(132 + k * 50), 1, 2);
        }
        lights.push({ x: 200, y: 142, r: 60, color: '#7fbf5a', a: 0.6, flicker: 0.2 }, { x: 262, y: 142, r: 60, color: '#7fbf5a', a: 0.6, flicker: 0.2, seed: 4 });
        lights.push({ x: 240, y: 170, r: 120, color: '#8a9a88', a: 0.6 });
        break;
      }
      case 'notice':
      case 'charter':
        lights.push({ x: 240, y: 110, r: 260, color: '#f0e0c0', a: 0.95 });
        break;
    }
    this.lighting.render(ctx, { x: 0, y: 0 }, panel.art === 'notice' || panel.art === 'charter' ? '#5a4a40' : '#56506a', lights, t);
    this.lighting.glow(ctx, { x: 0, y: 0 }, lights, t, 0.15);
    ctx.restore();
    drawFrameVignette(ctx);

    // Letterbox bars, across the whole view.
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, VIEW_W, stage.y + 14);
    ctx.fillRect(0, stage.y + BASE_H - BAR, VIEW_W, VIEW_H - (stage.y + BASE_H - BAR));

    hud.begin();
    hud.origin(stage.x, stage.y);
    if (panel.art === 'notice') this.drawNotice(hud);
    if (panel.art === 'charter') this.drawCharter(hud);

    const lines = hud.wrap(panel.text, BASE_W - 80, 9);
    let left = Math.floor(this.shown);
    lines.forEach((line, i) => {
      hud.text(line.slice(0, Math.max(0, left)), BASE_W / 2, BASE_H - BAR + 9 + i * 12, { size: 9, align: 'center', color: '#ece4d0' });
      left -= line.length + 1;
    });
    for (let i = 0; i < INTRO.length; i++) hud.fill(BASE_W / 2 - INTRO.length * 4 + i * 8, BASE_H - 8, 5, 2, i === this.index ? UI.gold : '#3a3830');
    keyHints(hud, [['SPACE', 'Next'], ['ESC', 'Skip']], BASE_W - 8, 2, 'right');

    const fadeIn = clamp(1 - this.t / FADE, 0, 1);
    const fadeOut = this.leaving >= 0 ? clamp(this.leaving / FADE, 0, 1) : 0;
    hud.fade(Math.max(fadeIn, fadeOut));
  }

  private drawNotice(hud: Hud): void {
    const w = 220;
    const x = (BASE_W - w) / 2;
    const y = 40;
    hud.panel(x, y, w, 140, 'paper');
    hud.fill(BASE_W / 2 - 1, y + 3, 3, 3, '#c03030');
    hud.text("ADVENTURERS' GUILD OF BELLMARKET", BASE_W / 2, y + 12, { font: 'head', size: 6, color: UI.inkDim, align: 'center', edge: 'none' });
    hud.text(GUILD_SURVEY.heading, BASE_W / 2, y + 26, { font: 'head', size: 12, color: UI.ink, align: 'center', edge: 'none' });
    GUILD_SURVEY.lines.slice(0, 2).forEach((l, i) => hud.text(l, BASE_W / 2, y + 50 + i * 12, { size: 8, color: '#3a2a1a', align: 'center', edge: 'none' }));
    hud.text('Reward: 4 silver. Bring a lantern.', BASE_W / 2, y + 80, { size: 7, color: UI.inkDim, align: 'center', edge: 'none' });
    if (this.t > 1.1) {
      const k = clamp((this.t - STAMP_AT) / 0.12, 0, 1);
      const s = 1 + (1 - k) * 1.5;
      hud.ui.save();
      hud.ui.translate(BASE_W / 2 + 44, y + 112);
      hud.ui.rotate(-0.12);
      hud.ui.scale(s, s);
      hud.ui.globalAlpha = k;
      hud.ui.strokeStyle = '#b02a2a';
      hud.ui.lineWidth = 1.5;
      hud.ui.strokeRect(-34, -9, 68, 17);
      hud.ui.font = '9px Silkscreen, monospace';
      hud.ui.fillStyle = '#b02a2a';
      hud.ui.textAlign = 'center';
      hud.ui.textBaseline = 'middle';
      hud.ui.fillText('PENDING', 0, 0);
      hud.ui.restore();
    }
  }

  private drawCharter(hud: Hud): void {
    const w = 210;
    const x = (BASE_W - w) / 2;
    const y = 30;
    hud.panel(x, y, w, 164, 'paper');
    hud.text('GOBLIN COOPERATIVE', BASE_W / 2, y + 10, { font: 'head', size: 6, color: UI.inkDim, align: 'center', edge: 'none' });
    hud.text('BURROW CHARTER', BASE_W / 2, y + 22, { font: 'head', size: 10, color: UI.ink, align: 'center', edge: 'none' });
    ['At least one legal wall', 'A source of food', 'A working workshop', 'A power component', 'Reliable power', 'An order filled for the Cooperative'].forEach((l, i) => {
      const ly = y + 44 + i * 14;
      hud.fill(x + 18, ly, 8, 8, '#6a5440');
      hud.fill(x + 19, ly + 1, 6, 6, '#e8dcb8');
      hud.text(l, x + 32, ly, { size: 8, color: '#3a2a1a', edge: 'none' });
    });
    hud.text('Registrar: ____________', x + 18, y + 140, { size: 8, color: UI.inkDim, edge: 'none' });
    const hover = Math.sin(this.t * 2) * 2;
    hud.fill(x + w - 46, y + 146 + hover, 22, 8, '#8a1a1a');
    hud.fill(x + w - 39, y + 134 + hover, 8, 12, '#5e3e22');
    hud.fill(x + w - 40, y + 130 + hover, 10, 5, '#7a5030');
  }
}

/** "Chapter One: A Recognized Workshop", over black. */
export class ChapterCard {
  private t = 0;

  constructor(private readonly input: Input, private readonly onDone: () => void) {
    audio.sfx('stepDone');
  }

  update(dt: number): void {
    this.t += dt;
    if (this.t > 4.6 || (this.t > 1 && (confirmPressed(this.input) || this.input.wasPressed('Escape')))) this.onDone();
  }

  render(ctx: CanvasRenderingContext2D, hud: Hud): void {
    ctx.fillStyle = '#050605';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    hud.begin();
    const stage = stageOrigin();
    hud.origin(stage.x, stage.y);
    const a = clamp(this.t / 0.8, 0, 1) * clamp((4.6 - this.t) / 0.8, 0, 1);
    hud.setAlpha(a);
    hud.text(CHAPTER_CARD.kicker.toUpperCase(), BASE_W / 2, 104, { font: 'head', size: 8, color: UI.gold, align: 'center' });
    const w = Math.min(200, this.t * 160);
    hud.fill(BASE_W / 2 - w / 2, 118, w, 1, '#8a7a50');
    hud.text(CHAPTER_CARD.title, BASE_W / 2, 126, { size: 16, color: UI.text, align: 'center' });
    hud.text('Get the Burrow recognized before the Guild surveys it.', BASE_W / 2, 152, { size: 7, color: UI.dim, align: 'center' });
    hud.setAlpha(1);
    hud.origin(0, 0);
  }
}
