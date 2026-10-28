// Player preferences. Kept apart from the save, so resetting progress keeps your volume.

export interface Settings {
  music: number;
  sfx: number;
  shake: boolean;
  /** Ask for real fullscreen when the game starts. The view fills the window either way. */
  fullscreen: boolean;
  /** Rebound keys, by action (see keys.ts). Missing actions use the defaults. */
  keys: Partial<Record<string, string>>;
}

const KEY = 'goblin-pension-plan.settings';
const DEFAULTS: Settings = { music: 0.6, sfx: 0.8, shake: true, fullscreen: true, keys: {} };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const loaded = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    return { ...DEFAULTS, ...loaded, keys: { ...(loaded.keys ?? {}) } };
  } catch {
    return { ...DEFAULTS, keys: {} };
  }
}

export const settings: Settings = load();

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked: settings last for this visit only.
  }
}
