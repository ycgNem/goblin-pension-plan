import { keyFor, keyMatches, type Action } from './keys';
import type { Vec2 } from './math';

// Keyboard and mouse state. Uses KeyboardEvent.code, so bindings follow physical key positions.
// "Pressed" sets are edge-triggered and cleared at the end of every fixed update.

const CAPTURED = new Set(['Space', 'Tab', 'Escape', 'F3', 'F8', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'AltLeft', 'AltRight']);

/** What gameplay code reads from the input. Tests pass a stub. */
export interface Controls {
  isDown(code: string): boolean;
  wasPressed(code: string): boolean;
  isMouseDown(button?: number): boolean;
  moveAxis(): Vec2;
}

export class Input implements Controls {
  private down = new Set<string>();
  private pressed: string[] = [];
  private mouseDown = new Set<number>();
  private mousePressed = new Set<number>();
  /** Mouse position in view pixels. */
  private readonly view: Vec2 = { x: 0, y: 0 };
  /** Subtracted from the mouse position: screens laid out on a centered stage set this. */
  private readonly origin: Vec2 = { x: 0, y: 0 };

  constructor(target: Window, private toGamePx: (clientX: number, clientY: number) => Vec2) {
    target.addEventListener('keydown', (e) => {
      if (CAPTURED.has(e.code)) e.preventDefault();
      if (!e.repeat && !this.pressed.includes(e.code)) this.pressed.push(e.code);
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => {
      this.down.clear();
      this.mouseDown.clear();
    });
    target.addEventListener('mousemove', (e) => this.setMouse(e.clientX, e.clientY));
    target.addEventListener('mousedown', (e) => {
      this.setMouse(e.clientX, e.clientY);
      this.mouseDown.add(e.button);
      this.mousePressed.add(e.button);
    });
    target.addEventListener('mouseup', (e) => this.mouseDown.delete(e.button));
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private setMouse(clientX: number, clientY: number): void {
    const p = this.toGamePx(clientX, clientY);
    this.view.x = p.x;
    this.view.y = p.y;
  }

  /** Mouse position in game pixels, relative to the current origin. */
  get mouse(): Vec2 {
    return { x: this.view.x - this.origin.x, y: this.view.y - this.origin.y };
  }

  setOrigin(x: number, y: number): void {
    this.origin.x = x;
    this.origin.y = y;
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressed.includes(code);
  }

  /** The first key pressed this tick, for rebinding. */
  firstPressed(): string | null {
    return this.pressed[0] ?? null;
  }

  isMouseDown(button = 0): boolean {
    return this.mouseDown.has(button);
  }

  wasMousePressed(button = 0): boolean {
    return this.mousePressed.has(button);
  }

  /** Is the key bound to this action held? */
  held(action: Action): boolean {
    for (const code of this.down) if (keyMatches(action, code)) return true;
    return false;
  }

  /** Was the key bound to this action pressed this tick? */
  hit(action: Action): boolean {
    return this.pressed.some((code) => keyMatches(action, code));
  }

  /** Movement keys (or arrows) as a raw direction, not normalized. */
  moveAxis(): Vec2 {
    const x = (this.isDown(keyFor('right')) || this.isDown('ArrowRight') ? 1 : 0) - (this.isDown(keyFor('left')) || this.isDown('ArrowLeft') ? 1 : 0);
    const y = (this.isDown(keyFor('down')) || this.isDown('ArrowDown') ? 1 : 0) - (this.isDown(keyFor('up')) || this.isDown('ArrowUp') ? 1 : 0);
    return { x, y };
  }

  endTick(): void {
    this.pressed = [];
    this.mousePressed.clear();
  }
}
