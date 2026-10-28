import type { Input } from '../core/input';
import { ACTIONS, actionLabel, bindKey, keyFor, keyLabel, RESERVED_KEYS, resetKeys } from '../core/keys';
import { clamp } from '../core/math';
import { isFullscreen, setFullscreen, VIEW_H, VIEW_W } from '../core/screen';
import { saveSettings, settings } from '../core/settings';
import type { Hud } from './hud';
import { backPressed, confirmPressed, cursor, heading, keyHints, ListNav, UI, type Overlay } from './overlay';

type UiSound = 'uiMove' | 'uiSelect' | 'uiDenied' | 'uiBack';

/** The controls list in the pause menu. Rebindable actions show their current key. */
export function controlsList(): (readonly [string, string])[] {
  return [
    [`${actionLabel('up')} ${actionLabel('left')} ${actionLabel('down')} ${actionLabel('right')}`, 'Move'],
    ['MOUSE', 'Aim'],
    ['LMB', 'Fire the Scrap Launcher'],
    ['RMB', 'Hold for a charged shot (Scrapping 4)'],
    [actionLabel('roll'), 'Roll (dodges attacks)'],
    [actionLabel('sneak'), 'Sneak, and hide in tall rubbish'],
    [actionLabel('interact'), 'Interact; hold to search'],
    [actionLabel('eat'), 'Eat'],
    [actionLabel('throw'), 'Throw a pebble, bottle, or Stinkbrew'],
    [actionLabel('pack'), 'Pack, Charter, skills, map'],
    [actionLabel('map'), 'Map'],
    [`${actionLabel('pause')} / P`, 'Pause'],
    ['ALT+ENTER', 'Fullscreen'],
  ];
}

type SettingsMode = 'main' | 'keys' | 'listen';
const SETTING_ROWS = ['Music', 'Sound', 'Screen shake', 'Fullscreen', 'Controls', 'Back'] as const;

/** Volume, comfort, fullscreen, and key bindings. Used by the pause menu and the title screen. */
export class SettingsPanel {
  private mode: SettingsMode = 'main';
  private readonly nav = new ListNav(SETTING_ROWS.length);
  /** Every action, then "Reset to defaults", then "Back". */
  private readonly keyNav = new ListNav(ACTIONS.length + 2);
  private listenT = 0;

  constructor(private readonly onChange: () => void, private readonly sound: (id: UiSound) => void) {}

  /** Height of the panel's contents, in game pixels. */
  get height(): number {
    return this.mode === 'main' ? SETTING_ROWS.length * 16 : (ACTIONS.length + 2) * 11 + 4;
  }

  /** Returns 'back' when the player leaves the panel. */
  update(input: Input): 'back' | null {
    if (this.mode === 'listen') {
      this.listenT += 1 / 60;
      const code = input.firstPressed();
      if (!code || this.listenT < 0.1) return null;
      const action = ACTIONS[this.keyNav.index];
      if (code === 'Escape' || !action) {
        this.sound('uiBack');
      } else if (RESERVED_KEYS.has(code)) {
        this.sound('uiDenied');
        return null;
      } else {
        bindKey(action.id, code);
        saveSettings();
        this.sound('uiSelect');
      }
      this.mode = 'keys';
      return null;
    }
    if (this.mode === 'keys') {
      if (backPressed(input)) {
        this.sound('uiBack');
        this.mode = 'main';
        return null;
      }
      const picked = this.keyNav.update(input, () => this.sound('uiMove'));
      if (picked === null) return null;
      if (picked < ACTIONS.length) {
        this.mode = 'listen';
        this.listenT = 0;
        this.sound('uiSelect');
      } else if (picked === ACTIONS.length) {
        resetKeys();
        saveSettings();
        this.sound('uiSelect');
      } else {
        this.sound('uiBack');
        this.mode = 'main';
      }
      return null;
    }
    if (backPressed(input)) {
      this.sound('uiBack');
      return 'back';
    }
    const picked = this.nav.update(input, () => this.sound('uiMove'));
    const adjust = (input.wasPressed('KeyD') || input.wasPressed('ArrowRight') ? 1 : 0) - (input.wasPressed('KeyA') || input.wasPressed('ArrowLeft') ? 1 : 0);
    const row = SETTING_ROWS[this.nav.index];
    // A/D step a volume; E steps it up and wraps round to silent.
    const step = (v: number): number => {
      const n = Math.round((v + (adjust !== 0 ? adjust * 0.1 : 0.1)) * 10) / 10;
      return adjust === 0 && n > 1 ? 0 : clamp(n, 0, 1);
    };
    if (adjust !== 0 || picked !== null) {
      if (row === 'Back') {
        if (picked === null) return null;
        this.sound('uiBack');
        return 'back';
      }
      if (row === 'Controls') {
        if (picked === null) return null;
        this.mode = 'keys';
        this.keyNav.index = 0;
        this.sound('uiSelect');
        return null;
      }
      if (row === 'Music') settings.music = step(settings.music);
      if (row === 'Sound') settings.sfx = step(settings.sfx);
      if (row === 'Screen shake') settings.shake = !settings.shake;
      if (row === 'Fullscreen') {
        settings.fullscreen = !isFullscreen();
        setFullscreen(settings.fullscreen);
      }
      saveSettings();
      this.onChange();
      this.sound('uiSelect');
    }
    return null;
  }

  draw(hud: Hud, x: number, y: number, w: number, time: number): void {
    if (this.mode !== 'main') {
      this.drawKeys(hud, x, y, w, time);
      return;
    }
    const value = (row: (typeof SETTING_ROWS)[number]): string | number => {
      switch (row) {
        case 'Music': return settings.music;
        case 'Sound': return settings.sfx;
        case 'Screen shake': return settings.shake ? 'On' : 'Off';
        case 'Fullscreen': return isFullscreen() ? 'On' : 'Off';
        case 'Controls': return 'Rebind keys';
        default: return '';
      }
    };
    this.nav.beginPlacing();
    SETTING_ROWS.forEach((label, i) => {
      const ry = y + i * 16;
      this.nav.place({ x, y: ry - 3, w, h: 16 });
      const on = i === this.nav.index;
      if (on) cursor(hud, x, ry + 2, time);
      hud.text(label, x + 12, ry, { size: 8, color: on ? UI.text : UI.dim });
      const v = value(label);
      if (typeof v === 'number') {
        for (let s = 0; s < 10; s++) hud.fill(x + w - 74 + s * 7, ry + 1, 5, 6, s < Math.round(v * 10) ? UI.gold : '#3a3830');
      } else if (v) hud.text(v, x + w - 4, ry, { size: 8, color: on ? UI.gold : UI.dim, align: 'right' });
    });
  }

  private drawKeys(hud: Hud, x: number, y: number, w: number, time: number): void {
    this.keyNav.beginPlacing();
    const rows = [...ACTIONS.map((a) => ({ label: a.label, key: keyLabel(keyFor(a.id)) })), { label: 'Reset to defaults', key: '' }, { label: 'Back', key: '' }];
    rows.forEach((r, i) => {
      const ry = y + i * 11;
      this.keyNav.place({ x, y: ry - 2, w, h: 11 });
      const on = i === this.keyNav.index;
      if (on) cursor(hud, x, ry + 1, time);
      hud.text(r.label, x + 12, ry, { size: 7, color: on ? UI.text : UI.dim });
      if (!r.key) return;
      if (on && this.mode === 'listen') {
        if (Math.floor(time * 3) % 2) hud.text('press a key...', x + w - 4, ry, { size: 7, color: UI.gold, align: 'right' });
      } else {
        const kw = Math.max(9, Math.ceil(hud.measure(r.key, 6, 'head')) + 5);
        hud.key(r.key, x + w - 4 - kw, ry - 1);
      }
    });
  }

  /** Hints for the bottom of whatever panel holds this one. */
  /** Heading for the window it sits in: the key list is the Controls screen. */
  get title(): string {
    return this.mode === 'main' ? 'SETTINGS' : 'CONTROLS';
  }

  get hints(): [string, string][] {
    if (this.mode === 'listen') return [['ESC', 'Cancel']];
    if (this.mode === 'keys') return [['E', 'Rebind'], ['ESC', 'Back']];
    return [['A/D', 'Adjust'], ['ESC', 'Back']];
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
    const h = this.mode === 'controls' ? 210 : this.mode === 'confirm' ? 92 : this.mode === 'settings' ? this.settingsPanel.height + 48 : 124;
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
        heading(hud, this.settingsPanel.title, x + 10, y + 8, w - 20);
        this.settingsPanel.draw(hud, x + 12, y + 30, w - 24, time);
        keyHints(hud, this.settingsPanel.hints, x + 12, y + h - 16);
        break;
      case 'controls':
        heading(hud, 'CONTROLS', x + 10, y + 8, w - 20);
        controlsList().forEach(([k, label], i) => {
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
