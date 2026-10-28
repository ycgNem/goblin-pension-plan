// Player preferences. Kept apart from the save, so resetting progress keeps your volume.

export interface Settings {
  music: number;
  sfx: number;
  shake: boolean;
}

const KEY = 'goblin-pension-plan.settings';
const DEFAULTS: Settings = { music: 0.6, sfx: 0.8, shake: true };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
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
