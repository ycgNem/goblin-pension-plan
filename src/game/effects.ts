import { FEEL } from '../data/combat';

export const FX = {
  spark: '#ffd29a',
  dust: '#8a8378',
  gel: '#58c078',
  hurt: '#e05040',
  number: '#f4f0e0',
  killNumber: '#f0c040',
  heroNumber: '#a8c8f0',
  fire: '#ff8a30',
  glow: '#d8ff8a',
  wood: '#8a5e34',
} as const;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

/** A floating number in world space, drawn on the UI canvas so it stays sharp. */
export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

const DRAG = 6;

/** Short-lived visual bits for the current region: sparks, dust, damage numbers. */
export class Effects {
  readonly particles: Particle[] = [];
  readonly texts: FloatText[] = [];

  burst(x: number, y: number, count: number, color: string, speed: number, rng = Math.random, life = 0.35, size = 1): void {
    this.spray(x, y, 0, Math.PI * 2, count, color, speed, rng, life, size);
  }

  /** Particles thrown in a cone around `angle`. */
  spray(x: number, y: number, angle: number, spread: number, count: number, color: string, speed: number, rng = Math.random, life = 0.25, size = 1): void {
    for (let i = 0; i < count; i++) {
      const a = angle + (rng() - 0.5) * spread;
      const s = speed * (0.4 + rng() * 0.6);
      const l = life * (0.6 + rng() * 0.4);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, color, size });
    }
  }

  number(x: number, y: number, text: string, color: string = FX.number): void {
    this.texts.push({ x, y, text, color, t: 0 });
  }

  update(dt: number): void {
    const drag = Math.exp(-DRAG * dt);
    let w = 0;
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
      this.particles[w++] = p;
    }
    this.particles.length = w;

    w = 0;
    for (const t of this.texts) {
      t.t += dt;
      if (t.t < FEEL.damageNumberTime) this.texts[w++] = t;
    }
    this.texts.length = w;
  }
}

/** Global punctuation: hit-stop freezes the simulation briefly, shake jolts the camera. */
export class Feel {
  hitstop = 0;
  shake = 0;
  /** 0..1. Flashes the screen edge red when the goblin is hurt. */
  hurt = 0;

  freeze(seconds: number): void {
    this.hitstop = Math.max(this.hitstop, seconds);
  }

  kick(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  update(dt: number): void {
    this.hitstop = Math.max(0, this.hitstop - dt);
    this.shake = this.shake > 0.1 ? this.shake * Math.exp(-FEEL.shakeDecay * dt) : 0;
    this.hurt = Math.max(0, this.hurt - dt * 2.5);
  }

  /** Whole-pixel camera offset for this frame. */
  offset(rng = Math.random): { x: number; y: number } {
    if (this.shake === 0) return { x: 0, y: 0 };
    return { x: Math.round((rng() * 2 - 1) * this.shake), y: Math.round((rng() * 2 - 1) * this.shake) };
  }
}
