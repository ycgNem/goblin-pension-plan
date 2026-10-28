/** Fixed-timestep simulation (60 Hz) with rendering on every animation frame. */
export const TICK = 1 / 60;
const MAX_FRAME = 0.25;

export function startLoop(update: (dt: number) => void, render: (alpha: number, fps: number) => void): void {
  let last = performance.now() / 1000;
  let acc = 0;
  let fps = 60;

  const frame = (nowMs: number): void => {
    const now = nowMs / 1000;
    const elapsed = Math.min(now - last, MAX_FRAME);
    last = now;
    if (elapsed > 0) fps = fps * 0.9 + (1 / elapsed) * 0.1;

    acc += elapsed;
    while (acc >= TICK) {
      update(TICK);
      acc -= TICK;
    }
    render(acc / TICK, fps);
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}
