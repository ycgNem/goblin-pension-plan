export interface Vec2 {
  x: number;
  y: number;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Move `current` toward `target` by at most `step`. */
export function approach(current: number, target: number, step: number): number {
  return current < target ? Math.min(current + step, target) : Math.max(current - step, target);
}

/** Frame-rate independent smoothing factor for exponential follow. */
export const damp = (sharpness: number, dt: number): number => 1 - Math.exp(-sharpness * dt);

export const length = (x: number, y: number): number => Math.hypot(x, y);

export function normalize(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y);
  return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}

/** Cheap deterministic 0..1 hash for tile variation. */
export function hash2(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
