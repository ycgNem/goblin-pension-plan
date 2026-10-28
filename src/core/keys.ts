import { settings } from './settings';

// Rebindable actions. Gameplay asks for an action's key (KeyboardEvent.code) instead of naming
// a key, so the pause menu can change them. Arrow keys always move as well, and menus always
// take W/S/A/D, the arrows, E, Enter, and Esc, so a bad binding can't lock anyone out.

export type Action = 'up' | 'down' | 'left' | 'right' | 'roll' | 'sneak' | 'interact' | 'eat' | 'throw' | 'pack' | 'map' | 'pause';

export const ACTIONS: readonly { id: Action; label: string }[] = [
  { id: 'up', label: 'Move up' },
  { id: 'down', label: 'Move down' },
  { id: 'left', label: 'Move left' },
  { id: 'right', label: 'Move right' },
  { id: 'roll', label: 'Roll' },
  { id: 'sneak', label: 'Sneak' },
  { id: 'interact', label: 'Interact / search' },
  { id: 'eat', label: 'Eat' },
  { id: 'throw', label: 'Throw' },
  { id: 'pack', label: 'Pack and Charter' },
  { id: 'map', label: 'Map' },
  { id: 'pause', label: 'Pause' },
];

export const DEFAULT_KEYS: Readonly<Record<Action, string>> = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  roll: 'Space',
  sneak: 'ShiftLeft',
  interact: 'KeyE',
  eat: 'KeyQ',
  throw: 'KeyF',
  pack: 'Tab',
  map: 'KeyM',
  pause: 'Escape',
};

/** Keys that can't be bound to an action: they belong to the browser or the debug overlay. */
export const RESERVED_KEYS: ReadonlySet<string> = new Set(['F1', 'F3', 'F5', 'F11', 'F12', 'MetaLeft', 'MetaRight', 'ContextMenu']);

export function keyFor(action: Action): string {
  return settings.keys[action] ?? DEFAULT_KEYS[action];
}

/** Either Shift works for sneaking while it's bound to Shift. */
export function keyMatches(action: Action, code: string): boolean {
  const k = keyFor(action);
  if (k === code) return true;
  return (k === 'ShiftLeft' || k === 'ShiftRight') && (code === 'ShiftLeft' || code === 'ShiftRight');
}

/** Bind a key to an action. Any other action using that key swaps to this action's old key. */
export function bindKey(action: Action, code: string): void {
  const old = keyFor(action);
  for (const a of ACTIONS) {
    if (a.id !== action && keyFor(a.id) === code) settings.keys[a.id] = old;
  }
  settings.keys[action] = code;
}

export function resetKeys(): void {
  settings.keys = {};
}

const NAMES: Record<string, string> = {
  Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'R.SHIFT', ControlLeft: 'CTRL', ControlRight: 'R.CTRL', AltLeft: 'ALT', AltRight: 'R.ALT',
  Tab: 'TAB', Escape: 'ESC', Enter: 'ENTER', Backspace: 'BKSP', CapsLock: 'CAPS', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';',
  Quote: "'", Comma: ',', Period: '.', Slash: '/',
};

/** A short keycap label for a KeyboardEvent.code: 'KeyE' -> 'E', 'ShiftLeft' -> 'SHIFT'. */
export function keyLabel(code: string): string {
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM${code.slice(6)}`;
  return code.toUpperCase();
}

/** The keycap label for an action's current key. */
export function actionLabel(action: Action): string {
  return keyLabel(keyFor(action));
}
