import type { Vec2 } from './math';

// Keyboard and mouse state. Uses KeyboardEvent.code, so bindings follow physical key positions.
// "Pressed" sets are edge-triggered and cleared at the end of every fixed update.

const CAPTURED = new Set(['Space', 'Tab', 'Escape', 'F3', 'F8', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** What gameplay code reads from the input. Tests pass a stub. */
export interface Controls {
  isDown(code: string): boolean;
  wasPressed(code: string): boolean;
  isMouseDown(button?: number): boolean;
  moveAxis(): Vec2;
}

export class Input implements Controls {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private mouseDown = new Set<number>();
  private mousePressed = new Set<number>();
  /** Mouse position in game-canvas pixels. */
  readonly mouse: Vec2 = { x: 0, y: 0 };

  constructor(target: Window, private toGamePx: (clientX: number, clientY: number) => Vec2) {
    target.addEventListener('keydown', (e) => {
      if (CAPTURED.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
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
    this.mouse.x = p.x;
    this.mouse.y = p.y;
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  isMouseDown(button = 0): boolean {
    return this.mouseDown.has(button);
  }

  wasMousePressed(button = 0): boolean {
    return this.mousePressed.has(button);
  }

  /** WASD (or arrows) as a raw direction, not normalized. */
  moveAxis(): Vec2 {
    const x = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0) - (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    const y = (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0) - (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0);
    return { x, y };
  }

  endTick(): void {
    this.pressed.clear();
    this.mousePressed.clear();
  }
}
