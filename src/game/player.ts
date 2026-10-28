import type { Controls } from '../core/input';
import { keyFor } from '../core/keys';
import { approach, normalize } from '../core/math';
import { CHARGED_SHOT, PLAYER } from '../data/combat';
import { moveBody, type Body } from '../world/collision';
import type { TileMap } from '../world/tilemap';
import { TILE } from '../world/tiles';
import { applyDamage, createHealth, tickHealth, type Health } from './health';
import type { PlayerStats } from './stats';

const WALK_SPEED = 96;
const SNEAK_SPEED = 44;
const SLUDGE_FACTOR = 0.55;
const ACCEL = 900;
const FRICTION = 1300;
/** Knockback slides further than a normal stop. */
const KNOCKBACK_FRICTION = 700;

/** What the goblin did this tick that the game needs to act on. */
export interface PlayerActions {
  fire: boolean;
  /** A fully charged shot was released. */
  charged: boolean;
  rolled: boolean;
}

export class Player implements Body {
  x = 0;
  y = 0;
  /** Small enough to fit a one-tile crawlspace with room to spare. */
  readonly hw = 5;
  readonly hh = 4;
  vx = 0;
  vy = 0;
  /** Aim angle in radians, toward the mouse. */
  aim = 0;
  sneaking = false;
  health: Health = createHealth(PLAYER.baseHearts * 2);
  /** Seconds since the last hit landed, for the hurt flash. */
  hurtT = Infinity;
  /** Seconds the charged shot has been held (Scrapping 4). */
  charge = 0;
  /** Distance walked, for the walk cycle. */
  stride = 0;
  /** Seconds into the current roll, or -1 when not rolling. */
  private rollT = -1;
  private rollX = 0;
  private rollY = 0;
  private rollCd = 0;
  private rollBuffer = 0;
  private stun = 0;
  private fireCd = 0;

  get rolling(): boolean {
    return this.rollT >= 0;
  }

  /** 0..1 through the current roll. */
  get rollProgress(): number {
    return this.rolling ? this.rollT / PLAYER.roll.time : 0;
  }

  get invulnerable(): boolean {
    return this.health.invuln > 0 || (this.rolling && this.rollT < PLAYER.roll.iframes);
  }

  get alive(): boolean {
    return this.health.hp > 0;
  }

  place(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.rollT = -1;
    this.stun = 0;
  }

  update(dt: number, input: Controls, map: TileMap, aimX: number, aimY: number, stats: PlayerStats, fireInterval: number): PlayerActions {
    const actions: PlayerActions = { fire: false, charged: false, rolled: false };
    tickHealth(this.health, dt);
    this.hurtT += dt;
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.rollCd = Math.max(0, this.rollCd - dt);
    this.rollBuffer = Math.max(0, this.rollBuffer - dt);
    this.stun = Math.max(0, this.stun - dt);
    if (input.wasPressed(keyFor('roll'))) this.rollBuffer = PLAYER.roll.buffer;
    this.aim = Math.atan2(aimY - this.y, aimX - this.x);

    const axis = input.moveAxis();
    const dir = normalize(axis.x, axis.y);
    const moving = dir.x !== 0 || dir.y !== 0;

    if (this.rolling) {
      this.rollT += dt;
      if (this.rollT >= PLAYER.roll.time) {
        // Come out of the roll at walking pace.
        this.rollT = -1;
        this.rollCd = stats.rollCooldown;
        this.vx = this.rollX * WALK_SPEED;
        this.vy = this.rollY * WALK_SPEED;
      } else {
        this.vx = this.rollX * PLAYER.roll.speed;
        this.vy = this.rollY * PLAYER.roll.speed;
      }
    } else if (this.stun > 0) {
      this.vx = approach(this.vx, 0, KNOCKBACK_FRICTION * dt);
      this.vy = approach(this.vy, 0, KNOCKBACK_FRICTION * dt);
    } else if (this.rollBuffer > 0 && this.rollCd <= 0) {
      // Roll the way you're moving, or toward the mouse when standing still.
      this.rollBuffer = 0;
      this.rollT = 0;
      this.rollX = moving ? dir.x : Math.cos(this.aim);
      this.rollY = moving ? dir.y : Math.sin(this.aim);
      this.vx = this.rollX * PLAYER.roll.speed;
      this.vy = this.rollY * PLAYER.roll.speed;
      actions.rolled = true;
    } else {
      const sneak = keyFor('sneak');
      this.sneaking = input.isDown(sneak) || (sneak.startsWith('Shift') && (input.isDown('ShiftLeft') || input.isDown('ShiftRight')));
      const onSludge = map.kindAt(Math.floor(this.x / TILE), Math.floor(this.y / TILE)) === 'sludge';
      const speed = (this.sneaking ? SNEAK_SPEED : WALK_SPEED) * (onSludge ? SLUDGE_FACTOR : 1);
      const rate = moving ? ACCEL : FRICTION;
      this.vx = approach(this.vx, dir.x * speed, rate * dt);
      this.vy = approach(this.vy, dir.y * speed, rate * dt);

      const charging = stats.scrappingLevel >= CHARGED_SHOT.level && input.isMouseDown(2);
      if (charging) {
        this.charge = Math.min(CHARGED_SHOT.chargeTime, this.charge + dt);
      } else {
        if (this.charge >= CHARGED_SHOT.chargeTime) actions.charged = true;
        this.charge = 0;
      }
      if (!charging && input.isMouseDown(0) && this.fireCd <= 0) {
        this.fireCd = fireInterval;
        actions.fire = true;
      }
    }
    if (this.rolling) this.sneaking = false;
    // Rolling or getting hit spills the charge.
    if (this.rolling || this.stun > 0) this.charge = 0;

    const hit = moveBody(this, this.vx * dt, this.vy * dt, map, 'goblin');
    if (hit.hitX) this.vx = 0;
    if (hit.hitY) this.vy = 0;
    this.stride += Math.hypot(this.vx, this.vy) * dt;
    return actions;
  }

  /** Take a hit from something at (fromX, fromY). Returns false if it didn't land. */
  hurt(amount: number, fromX: number, fromY: number): boolean {
    if (this.rolling && this.rollT < PLAYER.roll.iframes) return false;
    if (!applyDamage(this.health, amount, PLAYER.hurtIframes)) return false;
    const away = normalize(this.x - fromX, this.y - fromY);
    this.vx = away.x * PLAYER.hurtKnockback;
    this.vy = away.y * PLAYER.hurtKnockback;
    this.rollT = -1;
    this.stun = PLAYER.hurtStun;
    this.hurtT = 0;
    return true;
  }

  get tileCol(): number {
    return Math.floor(this.x / TILE);
  }

  get tileRow(): number {
    return Math.floor(this.y / TILE);
  }
}
