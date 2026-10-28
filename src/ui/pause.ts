import type { Input } from '../core/input';
import { clamp } from '../core/math';
import { VIEW_H, VIEW_W } from '../core/screen';
import { saveSettings, settings } from '../core/settings';
import type { Hud } from './hud';
import { backPressed, confirmPressed, cursor, heading, keyHints, ListNav, UI, type Overlay } from './overlay';

type UiSound = 'uiMove' | 'uiSelect' | 'uiDenied' | 'uiBack';

export const CONTROLS: readonly (readonly [string, string])[] = [
  ['W A S D', 'Move'],
  ['MOUSE', 'Aim'],
  ['LMB', 'Fire the Scrap Launcher'],
  ['RMB', 'Hold for a charged shot (Scrapping 4)'],
  ['SPACE', 'Roll (dodges attacks)'],
  ['SHIFT', 'Sneak, and hide in tall rubbish'],
  ['E', 'Interact; hold to search'],
  ['Q', 'Eat'],
  ['F', 'Throw a pebble (or a bottle)'],
  ['TAB', 'Pack, Charter, skills, map'],
  ['M', 'Map'],
  ['ESC', 'Pause'],
];

/** Volume and comfort settings. Used by the pause menu and the title screen. */
export class SettingsPanel {
  private readonly nav = new ListNav(4);

  constructor(private readonly onChange: () => void, private readonly sound: (id: UiSound) => void) {}

  /** Returns 'back' when the player leaves the panel. */
  update(input: Input): 'back' | null {
    if (backPressed(input)) {
      this.sound('uiBack');
      return 'back';
    }
    const picked = this.nav.update(input, () => this.sound('uiMove'));
    const adjust = (input.wasPressed('KeyD') || input.wasPressed('ArrowRight') ? 1 : 0) - (input.wasPressed('KeyA') || input.wasPressed('ArrowLeft') ? 1 : 0);
    const i = this.nav.index;
    // A/D step a volume; E steps it up and wraps round to silent.
    const step = (v: number): number => {
      const n = Math.round((v + (adjust !== 0 ? adjust * 0.1 : 0.1)) * 10) / 10;
      return adjust === 0 && n > 1 ? 0 : clamp(n, 0, 1);
    };
    if (adjust !== 0 || picked !== null) {
      if (i === 0) settings.music = step(settings.music);
      if (i === 1) settings.sfx = step(settings.sfx);
      if (i === 2) settings.shake = !settings.shake;
      if (i === 3) {
        this.sound('uiBack');
        return 'back';
      }
      saveSettings();
      this.onChange();
      this.sound('uiSelect');
    }
    return null;
  }

  draw(hud: Hud, x: number, y: number, w: number, time: number): void {
    const rows: [string, string | number][] = [['Music', settings.music], ['Sound', settings.sfx], ['Screen shake', settings.shake ? 'On' : 'Off'], ['Back', '']];
    this.nav.beginPlacing();
    rows.forEach(([label, value], i) => {
      const ry = y + i * 16;
      this.nav.place({ x, y: ry - 3, w, h: 16 });
      const on = i === this.nav.index;
      if (on) cursor(hud, x, ry + 2, time);
      hud.text(label, x + 12, ry, { size: 8, color: on ? UI.text : UI.dim });
      if (typeof value === 'number') {
        for (let s = 0; s < 10; s++) hud.fill(x + w - 74 + s * 7, ry + 1, 5, 6, s < Math.round(value * 10) ? UI.gold : '#3a3830');
      } else if (value) hud.text(value, x + w - 4, ry, { size: 8, color: on ? UI.gold : UI.dim, align: 'right' });
    });
  }
}

export interface PauseHooks {
  resume(): void;
  quitToTitle(): void;
  resetSave(): void;
  settingsChanged(): void;
  sound(id: UiSound): void;
}

type PauseMode = 'main' | 'settings' | 'controls' | 'confirm';
const ITEMS = ['Resume', 'Settings', 'Controls', 'Save and quit to title', 'Reset save'] as const;

export class PauseOverlay implements Overlay {
  readonly pauses = true;
  done = false;
  private mode: PauseMode = 'main';
  private readonly nav = new ListNav(ITEMS.length);
  private readonly confirmNav = new ListNav(2);
  private readonly settingsPanel: SettingsPanel;
  private t = 0;

  constructor(private readonly hooks: PauseHooks) {
    this.settingsPanel = new SettingsPanel(() => hooks.settingsChanged(), (id) => hooks.sound(id));
    this.confirmNav.index = 1;
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (this.t < 0.12) return;
    switch (this.mode) {
      case 'main': {
        if (backPressed(input)) {
          this.close();
          return;
        }
        const picked = this.nav.update(input, () => this.hooks.sound('uiMove'));
        if (picked === null) return;
        this.hooks.sound('uiSelect');
        if (picked === 0) this.close();
        else if (picked === 1) this.mode = 'settings';
        else if (picked === 2) this.mode = 'controls';
        else if (picked === 3) {
          this.done = true;
          this.hooks.quitToTitle();
        } else if (picked === 4) {
          this.mode = 'confirm';
          this.confirmNav.index = 1;
        }
        return;
      }
      case 'settings':
        if (this.settingsPanel.update(input) === 'back') this.mode = 'main';
        return;
      case 'controls':
        if (backPressed(input) || confirmPressed(input)) {
          this.hooks.sound('uiBack');
          this.mode = 'main';
        }
        return;
      case 'confirm': {
        if (backPressed(input)) {
          this.mode = 'main';
          return;
        }
        const picked = this.confirmNav.update(input, () => this.hooks.sound('uiMove'));
        if (picked === 0) {
          this.done = true;
          this.hooks.resetSave();
        } else if (picked === 1) {
          this.hooks.sound('uiBack');
          this.mode = 'main';
        }
      }
    }
  }

  private close(): void {
    this.hooks.sound('uiBack');
    this.done = true;
    this.hooks.resume();
  }

  draw(hud: Hud, time: number): void {
    hud.fade(0.55);
    const w = this.mode === 'controls' ? 300 : 220;
    const h = this.mode === 'controls' ? 196 : this.mode === 'confirm' ? 92 : 124;
    const x = Math.round((VIEW_W - w) / 2);
    const y = Math.round((VIEW_H - h) / 2);
    hud.panel(x, y, w, h);
    switch (this.mode) {
      case 'main':
        heading(hud, 'PAUSED', x + 10, y + 8, w - 20);
        this.nav.beginPlacing();
        ITEMS.forEach((label, i) => {
          const iy = y + 28 + i * 16;
          this.nav.place({ x: x + 6, y: iy - 3, w: w - 12, h: 16 });
          const on = i === this.nav.index;
          if (on) cursor(hud, x + 12, iy + 2, time);
          hud.text(label, x + 24, iy, { size: 8, color: on ? (i === 4 ? UI.bad : UI.text) : UI.dim });
        });
        break;
      case 'settings':
        heading(hud, 'SETTINGS', x + 10, y + 8, w - 20);
        this.settingsPanel.draw(hud, x + 12, y + 30, w - 24, time);
        keyHints(hud, [['A/D', 'Adjust'], ['ESC', 'Back']], x + 12, y + h - 16);
        break;
      case 'controls':
        heading(hud, 'CONTROLS', x + 10, y + 8, w - 20);
        CONTROLS.forEach(([k, label], i) => {
          const cy = y + 26 + i * 13;
          hud.text(k, x + 14, cy, { font: 'head', size: 6, color: UI.gold });
          hud.text(label, x + 92, cy, { size: 8, color: UI.text });
        });
        break;
      case 'confirm': {
        heading(hud, 'RESET SAVE?', x + 10, y + 8, w - 20, UI.bad);
        hud.text('Your Burrow and all progress will be lost.', x + 12, y + 28, { size: 8, color: UI.text });
        this.confirmNav.beginPlacing();
        (['Yes, start over', 'No, keep it'] as const).forEach((label, i) => {
          const iy = y + 50 + i * 15;
          this.confirmNav.place({ x: x + 6, y: iy - 3, w: w - 12, h: 15 });
          const on = i === this.confirmNav.index;
          if (on) cursor(hud, x + 12, iy + 2, time);
          hud.text(label, x + 24, iy, { size: 8, color: on ? (i === 0 ? UI.bad : UI.text) : UI.dim });
        });
        break;
      }
    }
  }
}
