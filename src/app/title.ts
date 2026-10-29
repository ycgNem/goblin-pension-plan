import { audio } from '../audio/audio';
import type { Input } from '../core/input';
import { clamp } from '../core/math';
import { BASE_H, BASE_W, setFullscreen, stageOrigin, VIEW_H, VIEW_W } from '../core/screen';
import { settings } from '../core/settings';
import { GOBLIN } from '../render/art/characters';
import { SHEETS } from '../render/art/sheets.gen';
import { Lighting, drawFrameVignette, type Light } from '../render/lighting';
import { sheet } from '../render/sheet';
import { sprite } from '../render/sprites';
import type { Hud } from '../ui/hud';
import { backPressed, confirmPressed, cursor, keyHints, ListNav, UI } from '../ui/overlay';
import { SettingsPanel } from '../ui/pause';
import { drawBells, titleArt } from './backdrops';

export interface TitleHooks {
  hasSave(): boolean;
  continueGame(): void;
  newGame(): void;
}

type Mode = 'press' | 'menu' | 'settings' | 'confirm';

interface Junk {
  x: number;
  y: number;
  vy: number;
  color: string;
  w: number;
}

const PAN_TIME = 5.5;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Bellmarket at dusk, the dungeon underneath, and one goblin's lit alcove. */
export class TitleScreen {
  private mode: Mode = 'press';
  private t = 0;
  private panT = 0;
  private readonly nav = new ListNav(3);
  private readonly confirmNav = new ListNav(2);
  private readonly settingsPanel = new SettingsPanel(() => audio.applyVolumes(), (id) => audio.sfx(id));
  private readonly lighting = new Lighting();
  private readonly junk: Junk[] = [];
  private junkT = 0;
  private items: { label: string; act: () => void }[] = [];

  constructor(private readonly input: Input, private readonly hooks: TitleHooks) {
    this.buildMenu();
  }

  /** Back from a game: skip the "press any key" and the pan. */
  returnTo(): void {
    this.mode = 'menu';
    this.panT = PAN_TIME;
    this.buildMenu();
    audio.music('title');
  }

  private buildMenu(): void {
    this.items = [];
    if (this.hooks.hasSave()) this.items.push({ label: 'Continue', act: () => this.hooks.continueGame() });
    this.items.push({
      label: 'New Burrow',
      act: () => {
        if (this.hooks.hasSave()) {
          this.mode = 'confirm';
          this.confirmNav.index = 1;
        } else this.hooks.newGame();
      },
    });
    this.items.push({ label: 'Settings', act: () => (this.mode = 'settings') });
    this.nav.count = this.items.length;
    this.nav.index = 0;
  }

  update(dt: number): void {
    this.t += dt;
    if (this.mode !== 'press') this.panT = Math.min(PAN_TIME, this.panT + dt);
    this.updateJunk(dt);
    const input = this.input;
    switch (this.mode) {
      case 'press':
        if (this.t > 0.6 && (confirmPressed(input) || input.wasPressed('Escape') || input.wasMousePressed(0) || anyKey(input))) {
          // The first key press is the browser's permission to go fullscreen.
          if (settings.fullscreen) setFullscreen(true);
          this.mode = 'menu';
          audio.sfx('titleSting');
          audio.music('title');
        }
        return;
      case 'menu': {
        if (this.panT < PAN_TIME && (confirmPressed(input) || input.wasMousePressed(0))) {
          this.panT = PAN_TIME;
          return;
        }
        if (this.panT < PAN_TIME * 0.6) return;
        const picked = this.nav.update(input, () => audio.sfx('uiMove'));
        if (picked !== null) {
          audio.sfx('uiSelect');
          this.items[picked]?.act();
        }
        return;
      }
      case 'settings':
        if (this.settingsPanel.update(input) === 'back') this.mode = 'menu';
        return;
      case 'confirm': {
        if (backPressed(input)) {
          this.mode = 'menu';
          return;
        }
        const picked = this.confirmNav.update(input, () => audio.sfx('uiMove'));
        if (picked === 0) this.hooks.newGame();
        else if (picked === 1) {
          audio.sfx('uiBack');
          this.mode = 'menu';
        }
      }
    }
  }

  private updateJunk(dt: number): void {
    const a = titleArt();
    this.junkT -= dt;
    if (this.junkT <= 0) {
      this.junkT = 1.6 + Math.random() * 3;
      const colors = ['#cfc8b0', '#8a9096', '#9a5a30', '#6a4a2c', '#5aa07a', '#c04040'];
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        this.junk.push({ x: a.chute.x - a.chute.w / 2 + Math.random() * a.chute.w, y: a.chute.top - i * 6, vy: 20 + Math.random() * 20, color: colors[Math.floor(Math.random() * colors.length)]!, w: 1 + Math.floor(Math.random() * 3) });
      }
    }
    for (const j of this.junk) {
      j.vy += 220 * dt;
      j.y += j.vy * dt;
    }
    for (let i = this.junk.length - 1; i >= 0; i--) if (this.junk[i]!.y > a.chute.bottom) this.junk.splice(i, 1);
  }

  render(ctx: CanvasRenderingContext2D, hud: Hud): void {
    const a = titleArt();
    const pan = ease(clamp(this.panT / PAN_TIME, 0, 1));
    const viewY = Math.round(pan * Math.max(0, a.rest - VIEW_H));
    const stage = stageOrigin();
    // The backdrop is wider than any view: line its 480-wide stage up with ours, without leaving a gap at either edge.
    const dx = clamp(stage.x - a.ox, VIEW_W - a.canvas.width, 0);
    ctx.fillStyle = '#16120f';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.drawImage(a.canvas, dx, -viewY);

    // Bells swinging in their towers.
    drawBells(ctx, a.canvas, a.bells, this.t, dx, -viewY);
    // Stars twinkling.
    for (let i = 0; i < 8; i++) {
      const sx = (i * 97 + Math.floor(this.t * 0.7) * 53) % VIEW_W;
      const sy = ((i * 41 + Math.floor(this.t * 0.7) * 29) % 50) - viewY;
      ctx.fillStyle = '#fff8e0';
      ctx.fillRect(sx, sy, 1, 1);
    }
    for (const j of this.junk) {
      ctx.fillStyle = j.color;
      ctx.fillRect(Math.round(j.x) + dx, Math.round(j.y) - viewY, j.w, 1 + (j.w % 2));
    }
    // The goblin by the pot, warming its hands.
    const goblin = sheet(SHEETS.goblin);
    if (goblin.ready) goblin.draw(ctx, 'idle_e', Math.floor(this.t * 4), a.goblin.x + dx, a.goblin.y - viewY);
    else {
      sprite(GOBLIN).draw(ctx, 6, a.goblin.x + dx, a.goblin.y - viewY);
      if (Math.floor(this.t * 0.4) % 5 === 0 && this.t % 2.5 < 0.15) {
        ctx.fillStyle = '#1b2414';
        ctx.fillRect(a.goblin.x + dx + 1, a.goblin.y - viewY - 10, 2, 1);
      }
    }
    // Steam off the pot.
    for (let i = 0; i < 4; i++) {
      const k = (this.t * 0.5 + i / 4) % 1;
      ctx.fillStyle = `rgba(220, 220, 210, ${0.35 * (1 - k)})`;
      ctx.fillRect(Math.round(a.pot.x + dx + Math.sin(k * 6 + i) * 3), Math.round(a.pot.y - k * 22) - viewY, 2, 2);
    }

    // Lights are placed in backdrop coordinates; the view offset lines them up.
    const lights: Light[] = [
      { x: a.lantern.x, y: a.lantern.y - viewY, r: 110, color: '#ffc070', a: 0.95, flicker: 0.12, seed: 1 },
      { x: a.pot.x, y: a.pot.y + 12 - viewY, r: 50, color: '#ff8a30', a: 0.8, flicker: 0.45, seed: 2 },
      { x: a.moon.x, y: a.moon.y - viewY, r: 90, color: '#c8c0e0', a: 0.5 },
      { x: a.ox + 240, y: 70 - viewY, r: 300, color: '#d8a0a0', a: 0.75 },
    ];
    this.lighting.render(ctx, { x: -dx, y: 0 }, a.ambient, lights, this.t);
    this.lighting.glow(ctx, { x: -dx, y: 0 }, lights.slice(0, 2), this.t);
    drawFrameVignette(ctx);

    hud.begin();
    hud.origin(stage.x, stage.y);
    // The logo fades in over the sky, then glides up and aside as the camera goes down.
    const logoIn = clamp((this.t - 0.5) / 1.6, 0, 1);
    const logoA = this.mode === 'press' ? logoIn : 1;
    if (this.mode === 'press') {
      // Kept in line with the backdrop (which doesn't move down for taller windows), clear of the alcove.
      if (this.t > 2 && Math.floor(this.t * 1.6) % 2 === 0) hud.text('PRESS ANY KEY', BASE_W / 2, BASE_H - 50 - stage.y, { font: 'head', size: 8, color: UI.text, align: 'center', edge: 'outline' });
      hud.text('Bellmarket. Above, the city. Below, everything it threw away.', BASE_W / 2, BASE_H - 32 - stage.y, { size: 7, color: UI.dim, align: 'center', edge: 'outline' });
    }
    if (logoA > 0) drawLogo(hud.ui, BASE_W / 2 - pan * 40, 52 - pan * 32 + (1 - logoIn) * 6, logoA);

    hud.setAlpha(this.mode === 'press' ? 0 : clamp((this.panT - 0.4) / 1.6, 0, 1));
    if (this.mode === 'menu' && this.panT >= PAN_TIME * 0.6) this.drawMenu(hud);
    if (this.mode === 'settings') {
      const h = this.settingsPanel.height + 30;
      const top = Math.min(120, BASE_H - h - 14);
      hud.panel(28, top, 210, h);
      this.settingsPanel.draw(hud, 40, top + 12, 186, this.t);
      keyHints(hud, this.settingsPanel.hints, 40, top + h - 15);
    }
    if (this.mode === 'confirm') {
      hud.panel(28, 132, 214, 66);
      hud.text('Start a new Burrow? The old one goes.', 40, 140, { size: 8, color: UI.bad });
      this.confirmNav.beginPlacing();
      (['Yes, start over', 'No, keep it'] as const).forEach((label, i) => {
        const iy = 158 + i * 15;
        this.confirmNav.place({ x: 34, y: iy - 3, w: 200, h: 15 });
        const on = i === this.confirmNav.index;
        if (on) cursor(hud, 40, iy + 2, this.t);
        hud.text(label, 52, iy, { size: 8, color: on ? UI.text : UI.dim });
      });
    }
    hud.origin(0, 0);
    // The small print waits for the menu, so it never sits on the alcove before the camera pans.
    hud.text('Chapter One  ·  v0.7', 6, VIEW_H - 10, { size: 6, color: UI.faint, edge: 'outline' });
    hud.text('Fonts: Pixelify Sans, Silkscreen (SIL OFL)', VIEW_W - 6, VIEW_H - 10, { size: 6, color: UI.faint, align: 'right', edge: 'outline' });
    hud.setAlpha(1);
  }

  private drawMenu(hud: Hud): void {
    const x = 34;
    const y = 132;
    this.nav.beginPlacing();
    this.items.forEach((item, i) => {
      const iy = y + i * 18;
      this.nav.place({ x: x - 6, y: iy - 4, w: 150, h: 18 });
      const on = i === this.nav.index;
      if (on) cursor(hud, x - 4, iy + 4, this.t);
      hud.text(item.label.toUpperCase(), x + 8, iy, { font: 'head', size: 10, color: on ? '#ffe8a0' : UI.dim, edge: 'outline' });
    });
  }
}

function anyKey(input: Input): boolean {
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Tab', 'ShiftLeft', 'KeyQ', 'KeyF', 'ArrowUp', 'ArrowDown']) if (input.wasPressed(code)) return true;
  return false;
}

/** The logo: big gold letters, a dark outline, and a green underline of "Pension Plan". */
function drawLogo(ui: CanvasRenderingContext2D, cx: number, y: number, alpha: number): void {
  ui.save();
  ui.globalAlpha = alpha;
  ui.textAlign = 'center';
  ui.textBaseline = 'top';
  ui.lineJoin = 'round';
  const word = (text: string, size: number, top: number, stops: [string, string, string]) => {
    ui.font = `${size}px Silkscreen, monospace`;
    ui.fillStyle = '#1a0e08';
    ui.fillText(text, cx + size / 12, top + size / 9);
    ui.lineWidth = size / 5;
    ui.strokeStyle = '#140a06';
    ui.strokeText(text, cx, top);
    const g = ui.createLinearGradient(0, top, 0, top + size);
    g.addColorStop(0, stops[0]);
    g.addColorStop(0.55, stops[1]);
    g.addColorStop(1, stops[2]);
    ui.fillStyle = g;
    ui.fillText(text, cx, top);
  };
  word('GOBLIN', 34, y, ['#fff0b0', '#f0a040', '#a8562a']);
  word('PENSION PLAN', 16, y + 38, ['#e8ffb0', '#9ad05a', '#4a7a2a']);
  ui.font = '7px "Pixelify Sans", monospace';
  ui.fillStyle = '#d8c8a8';
  ui.fillText('a goblin, a leaky alcove, and a great deal of paperwork', cx, y + 60);
  ui.restore();
}
