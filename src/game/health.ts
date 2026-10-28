/** Hit points in half-hearts, plus invulnerability time left over from the last hit. */
export interface Health {
  hp: number;
  max: number;
  invuln: number;
}

export function createHealth(max: number, hp = max): Health {
  return { hp: Math.min(hp, max), max, invuln: 0 };
}

export function tickHealth(h: Health, dt: number): void {
  h.invuln = Math.max(0, h.invuln - dt);
}

/** Apply damage unless invulnerable or already down. Returns whether it landed. */
export function applyDamage(h: Health, amount: number, iframes: number): boolean {
  if (h.invuln > 0 || h.hp <= 0 || amount <= 0) return false;
  h.hp = Math.max(0, h.hp - amount);
  h.invuln = iframes;
  return true;
}

/** Returns how much was actually healed. */
export function heal(h: Health, amount: number): number {
  const before = h.hp;
  h.hp = Math.min(h.max, h.hp + amount);
  return h.hp - before;
}

export function setMax(h: Health, max: number): void {
  h.max = max;
  h.hp = Math.min(h.hp, max);
}
