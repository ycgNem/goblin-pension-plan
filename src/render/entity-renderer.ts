import { VIEW_H, VIEW_W } from '../core/screen';
import { CHARGED_SHOT } from '../data/combat';
import type { HumanId } from '../data/enemies';
import { NODES, type NodeId } from '../data/nodes';
import type { RegionId } from '../data/regions';
import type { Creature } from '../game/creature';
import { FX } from '../game/effects';
import { AIM_LOCK, FIRE_RADIUS, type Human } from '../game/human';
import { jobProgress } from '../game/production';
import type { Player } from '../game/player';
import type { Projectile } from '../game/projectiles';
import type { SaveData } from '../game/save';
import type { Pickup, Scene, WorldObject } from '../game/scene';
import { lineOfSight } from '../world/sight';
import { TILE } from '../world/tiles';
import { GOBLIN, GRUBB, HUMAN_PALETTES, humanSprite, MITE, RAT, SLIME, SLIMELET } from './art/characters';
import { AWARE_ICONS, ITEM_ICONS } from './art/icons';
import { drawProp, propSilhouette } from './art/props';
import type { View } from './lighting';
import { PAL } from './palette';
import { pixelEllipse, pixelLine, sprite, type SpriteDef } from './sprites';

/** Windup blink. Distinct from the pure-white hit flash. */
const TELEGRAPH = '#ffe8a0';
const HIT_FLASH = '#ffffff';

const HUMAN_SPRITES: Record<HumanId | 'dorrit', SpriteDef> = {
  ...(Object.fromEntries(Object.entries(HUMAN_PALETTES).map(([id, pal]) => [id, humanSprite(pal)])) as Record<HumanId, SpriteDef>),
  dorrit: humanSprite({ h: '#2a1e1a', H: '#1a1210', s: '#e0b090', S: '#b88060', c: '#4a3a5a', C: '#2e2440', a: '#a04040', l: '#3a3040', f: '#2a2020' }),
};

export interface WorldDrawState {
  save: SaveData;
  region: RegionId;
  time: number;
  /** The object the goblin would interact with. Outlined. */
  focus: WorldObject | null;
  /** Burrow spots with something buildable: glyph -> affordable right now. */
  spots: ReadonlyMap<string, boolean>;
  goblinDown: boolean;
  goblinHidden: boolean;
  /** The opening: the goblin is asleep in bed. */
  asleep: boolean;
  /** Activity Board has news you haven't read. */
  boardNews: boolean;
}

type Drawable = { y: number; draw: () => void };

/** Everything that stands in the world, sorted back to front. Drawn before lighting. */
export function drawWorld(ctx: CanvasRenderingContext2D, view: View, scene: Scene, player: Player, s: WorldDrawState): void {
  ctx.save();
  ctx.translate(-view.x, -view.y);

  drawSpots(ctx, scene, s);
  for (const c of scene.creatures) drawShadow(ctx, c.x, c.y + c.radius - 1, c.radius, 2);

  const list: Drawable[] = [];
  for (const o of scene.objects) {
    if (o.kind === 'hole' || o.kind === 'post') continue;
    if (Math.abs(o.x - view.x - VIEW_W / 2) > VIEW_W / 2 + 48 || Math.abs(o.y - view.y - VIEW_H / 2) > VIEW_H / 2 + 64) continue;
    list.push({ y: o.y, draw: () => drawObject(ctx, o, s, o === s.focus) });
  }
  for (const c of scene.creatures) list.push({ y: c.y, draw: () => drawCreature(ctx, c, s.time) });
  for (const h of scene.humans) list.push({ y: h.y, draw: () => drawHuman(ctx, h, s.time) });
  for (const p of scene.pickups) list.push({ y: p.y, draw: () => drawPickup(ctx, p, s.time) });
  list.push({ y: player.y, draw: () => drawGoblin(ctx, player, s) });
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.draw();

  if (s.goblinHidden && !s.goblinDown) {
    // Peeking out of the heap.
    const blink = Math.floor(s.time * 1.3) % 5 === 0;
    ctx.fillStyle = '#f4e46a';
    if (!blink) {
      ctx.fillRect(Math.round(player.x) - 2, Math.round(player.y) - 9, 1, 1);
      ctx.fillRect(Math.round(player.x) + 1, Math.round(player.y) - 9, 1, 1);
    }
  }

  for (const p of scene.projectiles) drawProjectile(ctx, p);
  for (const p of scene.effects.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Readability layer, drawn after lighting so it shows in the dark: cones, telegraphs, icons, noise. */
export function drawWorldOverlay(ctx: CanvasRenderingContext2D, view: View, scene: Scene, s: WorldDrawState): void {
  ctx.save();
  ctx.translate(-view.x, -view.y);
  for (const h of scene.humans) drawCone(ctx, scene, h);
  for (const c of scene.creatures) drawCreatureTelegraph(ctx, c);
  for (const h of scene.humans) drawHumanTelegraph(ctx, h, s.time);
  for (const n of scene.noises) {
    const k = n.t / 0.6;
    const r = n.r * (0.25 + 0.75 * k);
    ctx.fillStyle = `rgba(232, 228, 216, ${0.5 * (1 - k)})`;
    const steps = Math.max(12, Math.round(r / 3));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.fillRect(Math.round(n.x + Math.cos(a) * r), Math.round(n.y + Math.sin(a) * r * 0.75), 1, 1);
    }
  }
  for (const h of scene.humans) drawAwareness(ctx, h, s.time);
  for (const p of scene.pickups) {
    if (Math.floor(s.time * 3 + p.x) % 4 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 240, 0.8)';
      ctx.fillRect(Math.round(p.x) + 3, Math.round(p.y - p.z) - 6, 1, 1);
    }
  }
  if (s.boardNews) {
    const board = scene.objects.find((o) => o.id === 'activityBoard');
    if (board) drawExclaim(ctx, board.x, board.y - 30, s.time);
  }
  ctx.restore();
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  pixelEllipse(ctx, x, y, rx, ry);
}

function drawExclaim(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const bob = Math.round(Math.sin(time * 4) * 1.5);
  sprite(AWARE_ICONS.hostile).draw(ctx, 0, x, y + bob);
}

// ---------------------------------------------------------------- objects

function nodeVariant(o: WorldObject): { art: string; variant: string } {
  const def = NODES[o.id as NodeId];
  if (!def) return { art: 'junkPile', variant: '' };
  return { art: def.art, variant: o.spent ? def.usedVariant : '' };
}

function objectArt(o: WorldObject, s: WorldDrawState): { art: string; variant: string; dx?: number; dy?: number } | null {
  const up = (id: string) => s.save.upgrades.includes(id as never);
  switch (o.kind) {
    case 'node':
      return nodeVariant(o);
    case 'heap':
      return { art: 'heap', variant: s.region === 'coop' ? 'coop' : s.region === 'pumpworks' || s.region === 'cistern' ? 'barrels' : '' };
    case 'landmark':
      return { art: o.id, variant: '' };
    case 'access':
      return { art: 'access', variant: '' };
    case 'valve':
      return { art: 'valve', variant: s.save.flags.sluiceOpen ? 'turned' : '' };
    case 'letter':
      return { art: 'letter', variant: '' };
    case 'station':
      switch (o.id) {
        case 'bed': return { art: 'bed', variant: up('fewerSprings') ? 'mattress' : '' };
        case 'storage': return { art: 'storage', variant: Object.values(s.save.storage).some((n) => (n ?? 0) > 0) ? 'full' : '' };
        case 'pot': return { art: 'pot', variant: up('shieldPan') ? 'pan' : '' };
        case 'workbench': return { art: 'workbench', variant: up('repairWorkbench') ? 'repaired' : '' };
        case 'mushroomBed': {
          if (!up('mushroomBed')) return null;
          const jobs = jobProgress(s.save, 'mushroomBed');
          const j = jobs[0];
          return { art: 'mushroomBed', variant: !j ? '' : j.done ? 'ready' : j.frac < 0.35 ? 'sprouts' : 'growing' };
        }
        case 'dryingRack': return up('dryingRack') ? { art: 'dryingRack', variant: jobProgress(s.save, 'dryingRack').length > 0 ? 'loaded' : '' } : null;
        case 'boneGrinder': return up('boneGrinder') ? { art: 'boneGrinder', variant: '' } : null;
        case 'slimeGenerator': return up('slimeGenerator') ? { art: 'generator', variant: s.save.flags.generatorActive ? 'on' : '' } : null;
        case 'lantern': return { art: 'lantern', variant: up('scrapLantern') ? '' : 'candle' };
        case 'sign': return { art: 'sign', variant: up('notALairSign') ? 'definitely' : '' };
        default: return null;
      }
    case 'npc':
      switch (o.id) {
        case 'grubb': return { art: 'desk', variant: '', dy: 6 };
        case 'hatch': return { art: 'hatch', variant: '' };
        case 'activityBoard': return { art: 'board', variant: '' };
        default: return null;
      }
    default:
      return null;
  }
}

function drawObject(ctx: CanvasRenderingContext2D, o: WorldObject, s: WorldDrawState, focused: boolean): void {
  if (o.kind === 'dormant') {
    drawDormant(ctx, o, s.time);
    return;
  }
  if (o.kind === 'npc' && o.id === 'grubb') drawGrubb(ctx, o.x, o.y - 4, s.time);
  if (o.kind === 'npc' && o.id === 'hatch') drawDorrit(ctx, o.x, o.y, s.time);
  const a = objectArt(o, s);
  if (!a) return;
  const wobble = o.shake > 0 ? Math.round(Math.sin(o.shake * 60) * 1) : 0;
  const x = o.x + wobble + (a.dx ?? 0);
  const y = o.y + (a.dy ?? 0);
  if (focused) {
    const sil = propSilhouette(a.art, a.variant, '#fff4c8');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) ctx.drawImage(sil.canvas, Math.round(x - sil.ax + dx), Math.round(y - sil.ay + dy));
  }
  drawProp(ctx, a.art, a.variant, x, y);

  // Extras that change with the Burrow.
  if (o.kind === 'station') {
    const up = (id: string) => s.save.upgrades.includes(id as never);
    if (o.id === 'bed' && up('tooGrandChair')) drawProp(ctx, 'grandChair', '', o.x + 34, o.y + 2);
    if (o.id === 'pot') {
      drawProp(ctx, 'bowls', up('secondBowl') ? 'two' : '', o.x + 18, o.y + 2);
      drawFire(ctx, o.x, o.y - 1, s.time);
    }
    if (o.id === 'mushroomBed' && up('secondBed')) {
      const second = jobProgress(s.save, 'mushroomBed')[1];
      drawProp(ctx, 'mushroomBed', !second ? '' : second.done ? 'ready' : second.frac < 0.35 ? 'sprouts' : 'growing', o.x + 34, o.y);
    }
    if (o.id === 'lantern' && !up('scrapLantern')) drawCandleFlame(ctx, o.x - 1, o.y - 11, s.time);
  }
  if (o.kind === 'letter' && !s.save.flags.readGrubbsLetter && Math.floor(s.time * 2) % 3 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(o.x) + 3, Math.round(o.y) - 6, 1, 1);
    ctx.fillRect(Math.round(o.x) + 2, Math.round(o.y) - 5, 3, 1);
    ctx.fillRect(Math.round(o.x) + 3, Math.round(o.y) - 4, 1, 1);
  }
}

function drawFire(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const f = Math.floor(time * 12);
  const colors = ['#ff7030', '#ffb040', '#ffe080'];
  for (let i = 0; i < 4; i++) {
    const h = (f + i * 3) % 4;
    ctx.fillStyle = colors[(f + i) % 3]!;
    ctx.fillRect(Math.round(x) - 3 + i * 2, Math.round(y) - h, 1, h + 1);
  }
}

function drawCandleFlame(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const f = Math.floor(time * 10) % 3;
  ctx.fillStyle = '#ffb040';
  ctx.fillRect(Math.round(x), Math.round(y) - 1 - (f === 0 ? 1 : 0), 2, 2 + (f === 0 ? 1 : 0));
  ctx.fillStyle = '#fff4c0';
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

function drawDormant(ctx: CanvasRenderingContext2D, o: WorldObject, time: number): void {
  // Beetles and the Matron, asleep until their behaviors land (M6).
  const big = o.id === 'pumpMatron';
  const rx = big ? 18 : 8;
  const ry = big ? 12 : 6;
  const breathe = Math.sin(time * 1.5 + o.col) * 0.5;
  drawShadow(ctx, o.x, o.y + 1, rx, 3);
  ctx.fillStyle = '#1a1210';
  pixelEllipse(ctx, o.x, o.y - ry, rx + 1, ry + 1 + breathe);
  ctx.fillStyle = big ? '#8a3420' : '#7a4a28';
  pixelEllipse(ctx, o.x, o.y - ry, rx, ry + breathe);
  ctx.fillStyle = big ? '#c87533' : '#a0703a';
  pixelEllipse(ctx, o.x - rx / 3, o.y - ry - ry / 3, rx / 2, ry / 3);
  if (big) {
    ctx.fillStyle = '#f0a060';
    pixelEllipse(ctx, o.x + 4, o.y - ry - 2, 6, 6);
    ctx.fillStyle = '#8a4a20';
    pixelEllipse(ctx, o.x + 4, o.y - ry - 2, 2, 2);
  }
  if (Math.floor(time * 0.8 + o.col) % 3 === 0) {
    ctx.fillStyle = 'rgba(232, 228, 216, 0.7)';
    ctx.fillRect(Math.round(o.x + rx), Math.round(o.y - ry * 2 - 4 - ((time * 6) % 6)), 2, 1);
  }
}

function drawSpots(ctx: CanvasRenderingContext2D, scene: Scene, s: WorldDrawState): void {
  if (s.spots.size === 0) return;
  const pulse = 0.45 + 0.35 * Math.sin(s.time * 3);
  for (const o of scene.objects) {
    const affordable = s.spots.get(o.glyph);
    if (affordable === undefined || (o.kind !== 'station' && o.kind !== 'hole')) continue;
    const w = o.kind === 'hole' ? 14 : 20;
    const h = o.kind === 'hole' ? 10 : 14;
    const x = Math.round(o.x - w / 2);
    const y = o.kind === 'hole' ? o.row * TILE + 6 : Math.round(o.y - h + 2);
    ctx.fillStyle = affordable ? `rgba(240, 192, 64, ${pulse})` : `rgba(200, 200, 180, ${pulse * 0.45})`;
    for (let i = 0; i < w; i += 2) {
      if ((i / 2 + Math.floor(s.time * 6)) % 3 === 0) continue;
      ctx.fillRect(x + i, y, 1, 1);
      ctx.fillRect(x + w - 1 - i, y + h - 1, 1, 1);
    }
    for (let j = 0; j < h; j += 2) {
      if ((j / 2 + Math.floor(s.time * 6)) % 3 === 0) continue;
      ctx.fillRect(x, y + h - 1 - j, 1, 1);
      ctx.fillRect(x + w - 1, y + j, 1, 1);
    }
  }
}

// ---------------------------------------------------------------- the goblin and friends

function goblinFrame(aim: number, moving: boolean, stride: number): { frame: number; flip: boolean } {
  const step = moving ? [0, 1, 0, 2][Math.floor(stride / 7) % 4]! : 0;
  if (Math.abs(Math.cos(aim)) >= 0.62) return { frame: 6 + step, flip: Math.cos(aim) < 0 };
  return { frame: (Math.sin(aim) < 0 ? 3 : 0) + step, flip: false };
}

function drawGoblin(ctx: CanvasRenderingContext2D, p: Player, s: WorldDrawState): void {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const g = sprite(GOBLIN);
  drawShadow(ctx, x, y + 3, 5, 1.5);
  if (s.goblinDown || s.asleep) {
    g.draw(ctx, 11, x, y + 2, { flip: s.asleep });
    return;
  }
  if (s.goblinHidden) return;
  // Blink while invulnerable after a hit.
  if (p.health.invuln > 0 && !p.rolling && Math.floor(s.time * 16) % 2 === 0) return;
  const flash = p.hurtT < 0.08 ? HIT_FLASH : undefined;

  if (p.rolling) {
    g.draw(ctx, 9 + (Math.floor(p.rollProgress * 6) % 2), x, y + 1, { flip: p.vx < 0, silhouette: flash });
    return;
  }

  const moving = Math.hypot(p.vx, p.vy) > 10;
  const { frame, flip } = goblinFrame(p.aim, moving, p.stride);
  const bob = moving && Math.floor(p.stride / 7) % 2 === 1 ? -1 : 0;
  const crouch = p.sneaking ? 1 : 0;
  const behind = Math.sin(p.aim) < -0.3;
  if (behind) drawLauncher(ctx, p, x, y + crouch);
  g.draw(ctx, frame, x, y + bob + crouch, { flip, silhouette: flash, alpha: p.sneaking ? 0.82 : undefined });
  if (!behind) drawLauncher(ctx, p, x, y + crouch);

  if (p.charge > 0) {
    const k = p.charge / CHARGED_SHOT.chargeTime;
    const size = k >= 1 ? 3 : 1 + Math.floor(k * 2);
    ctx.fillStyle = k >= 1 && Math.floor(s.time * 20) % 2 === 0 ? '#ffffff' : PAL.homeGlow;
    const mx = Math.round(x + Math.cos(p.aim) * 11);
    const my = Math.round(y - 4 + Math.sin(p.aim) * 11);
    ctx.fillRect(mx - Math.floor(size / 2), my - Math.floor(size / 2), size, size);
  }
}

/** The Scrap Launcher: a stubby tube that points where you aim. */
function drawLauncher(ctx: CanvasRenderingContext2D, p: Player, x: number, y: number): void {
  const ox = x + Math.cos(p.aim) * 2;
  const oy = y - 4 + Math.sin(p.aim) * 2;
  const tx = x + Math.cos(p.aim) * 9;
  const ty = y - 4 + Math.sin(p.aim) * 9;
  ctx.fillStyle = '#2a1a10';
  pixelLine(ctx, ox, oy + 1, tx, ty + 1, 2);
  ctx.fillStyle = PAL.rust;
  pixelLine(ctx, ox, oy, tx, ty, 2);
  ctx.fillStyle = PAL.rustLight;
  pixelLine(ctx, ox, oy, tx, ty, 1);
  ctx.fillStyle = '#6a7076';
  ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 2, 2);
}

function drawGrubb(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const g = sprite(GRUBB);
  const breathe = Math.floor(time * 1.2) % 2;
  g.draw(ctx, 0, x, y - breathe);
  const ex = Math.round(x);
  const ey = Math.round(y - breathe);
  // Green eyeshade and brass spectacles.
  ctx.fillStyle = '#2f5a2f';
  ctx.fillRect(ex - 4, ey - 12, 8, 1);
  ctx.fillStyle = '#5f9a5f';
  ctx.fillRect(ex - 5, ey - 11, 10, 1);
  ctx.fillStyle = '#c8a040';
  ctx.fillRect(ex - 4, ey - 10, 3, 1);
  ctx.fillRect(ex + 1, ey - 10, 3, 1);
}

function drawDorrit(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  // Leaning in the hatch window. Only head and shoulders show.
  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.round(x) - 9, Math.round(y) - 16, 18, 10);
  ctx.clip();
  const lean = Math.sin(time * 0.7) > 0.6 ? 1 : 0;
  sprite(HUMAN_SPRITES.dorrit).draw(ctx, 0, x + lean, y + 6);
  ctx.restore();
}

function drawCreature(ctx: CanvasRenderingContext2D, c: Creature, time: number): void {
  const winding = c.state === 'windup';
  const blink = winding && Math.floor(c.stateT * 14) % 2 === 0;
  const silhouette = c.flash > 0 ? HIT_FLASH : blink ? TELEGRAPH : undefined;
  const blobby = c.def.behavior === 'slime' || c.def.behavior === 'slimelet';
  const shiver = winding && !blobby ? (Math.floor(time * 40) % 2 ? 1 : -1) : 0;
  const x = Math.round(c.x) + shiver;
  const y = Math.round(c.y);
  const flip = Math.cos(c.face) < 0;
  switch (c.def.behavior) {
    case 'rat': {
      const moving = Math.hypot(c.vx, c.vy) > 12;
      sprite(RAT).draw(ctx, moving ? Math.floor(c.age * 12) % 2 : 0, x, y + 2, { flip, silhouette });
      break;
    }
    case 'slime':
      sprite(SLIME).draw(ctx, winding || Math.sin(c.age * 7) < -0.2 ? 1 : 0, x, y + c.radius - 1, { silhouette });
      break;
    case 'slimelet':
      sprite(SLIMELET).draw(ctx, winding || Math.sin(c.age * 9) < -0.2 ? 1 : 0, x, y + c.radius, { silhouette });
      break;
    case 'mite':
      sprite(MITE).draw(ctx, Math.floor(c.age * 12) % 2, x, y + 2, { flip, silhouette });
      break;
    default:
      ctx.fillStyle = silhouette ?? c.def.color;
      pixelEllipse(ctx, x, y, c.radius, c.radius);
  }
  if (c.slowT > 0) {
    ctx.fillStyle = FX.gel;
    ctx.fillRect(x - 1, y - c.radius - 4, 2, 2);
    ctx.fillRect(x + 3, y - c.radius - 2, 1, 1);
  }
}

function drawHuman(ctx: CanvasRenderingContext2D, h: Human, time: number): void {
  const x = Math.round(h.x);
  const y = Math.round(h.y);
  drawShadow(ctx, x, y + 2, 6, 2);
  const side = Math.abs(Math.cos(h.face)) >= 0.55;
  const moving = Math.hypot(h.vx, h.vy) > 8;
  const step = moving ? Math.floor(h.age * 6) % 2 : 0;
  const frame = (side ? 2 : 0) + step;
  const flip = side && Math.cos(h.face) < 0;
  const silhouette = h.flash > 0 ? HIT_FLASH : undefined;
  const alpha = h.retreating ? 0.85 : undefined;
  const front = Math.sin(h.face) > -0.2;
  if (!front) drawGear(ctx, h, x, y, flip, time);
  sprite(HUMAN_SPRITES[h.id]).draw(ctx, frame, x, y + 2, { flip, silhouette, alpha });
  if (front) drawGear(ctx, h, x, y, flip, time);
}

/** What each person carries, drawn over the shared body. */
function drawGear(ctx: CanvasRenderingContext2D, h: Human, x: number, y: number, flip: boolean, time: number): void {
  const dir = flip ? -1 : 1;
  switch (h.id) {
    case 'paladin': {
      const raised = h.attack === 'windup' || h.attack === 'active';
      const sx = raised ? x + Math.round(Math.cos(h.aim) * 7) - 3 : x + dir * 5 - 3;
      const sy = raised ? y - 12 + Math.round(Math.sin(h.aim) * 4) : y - 10;
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(sx - 1, sy - 1, 8, 10);
      ctx.fillStyle = raised && Math.floor(time * 16) % 2 === 0 ? '#fff4c8' : '#3a5aa8';
      ctx.fillRect(sx, sy, 6, 8);
      ctx.fillStyle = '#e0c050';
      ctx.fillRect(sx + 2, sy + 2, 2, 3);
      ctx.fillStyle = '#d0d8e0';
      ctx.fillRect(x - dir * 6, y - 18, 1, 8);
      break;
    }
    case 'ranger':
      ctx.fillStyle = '#6a4a2a';
      for (let i = -5; i <= 5; i++) ctx.fillRect(x + dir * (6 - Math.round((i * i) / 8)), y - 11 + i, 1, 1);
      ctx.fillStyle = '#c8c0a0';
      ctx.fillRect(x + dir * 6, y - 16, 1, 11);
      break;
    case 'apprentice':
      ctx.fillStyle = '#4a2462';
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 3 + Math.floor(i / 2), y - 24 - i, 7 - i, 1);
      ctx.fillStyle = '#e0c050';
      ctx.fillRect(x - 4, y - 24, 8, 1);
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(x + dir * 7, y - 20, 1, 16);
      ctx.fillStyle = h.attack === 'windup' ? '#ffb040' : '#c090f0';
      ctx.fillRect(x + dir * 7 - 1, y - 22, 3, 3);
      break;
    case 'inspector':
      ctx.fillStyle = '#30302a';
      ctx.fillRect(x - 4, y - 23, 9, 2);
      ctx.fillStyle = '#6a7076';
      ctx.fillRect(x + dir * 6 - 1, y - 9, 3, 4);
      ctx.fillStyle = '#f8d070';
      ctx.fillRect(x + dir * 6, y - 8, 1, 2);
      break;
    case 'guard':
      ctx.fillStyle = '#8a8a90';
      ctx.fillRect(x - 6, y - 21, 13, 1);
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(x + dir * 6, y - 12, 1, 8);
      break;
  }
}

function drawPickup(ctx: CanvasRenderingContext2D, p: Pickup, time: number): void {
  const bob = p.z === 0 ? Math.round(Math.sin(time * 4 + p.x) * 1) : 0;
  drawShadow(ctx, p.x, p.y + 2, 3, 1);
  sprite(ITEM_ICONS[p.item]).draw(ctx, 0, Math.round(p.x) - 5, Math.round(p.y - p.z) - 7 + bob);
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const speed = Math.hypot(p.vx, p.vy) || 1;
  const ux = p.vx / speed;
  const uy = p.vy / speed;
  const tx = Math.round(p.x - ux * 3);
  const ty = Math.round(p.y - uy * 3);
  switch (p.kind) {
    case 'scrap':
      ctx.fillStyle = PAL.rust;
      ctx.fillRect(tx, ty, 1, 1);
      ctx.fillStyle = PAL.rustLight;
      ctx.fillRect(x - 1, y - 1, 2, 2);
      ctx.fillStyle = '#ffd29a';
      ctx.fillRect(x, y - 1, 1, 1);
      break;
    case 'nail':
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(tx, ty, 1, 1);
      break;
    case 'slimeShot':
      ctx.fillStyle = '#6fd06f';
      ctx.fillRect(x - 1, y - 1, 3, 3);
      break;
    case 'charged':
      ctx.fillStyle = PAL.rust;
      ctx.fillRect(tx - 1, ty - 1, 2, 2);
      ctx.fillStyle = PAL.rustLight;
      ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.fillStyle = '#fff0c8';
      ctx.fillRect(x - 1, y - 1, 2, 2);
      break;
    case 'arrow':
      ctx.fillStyle = '#8a6a40';
      pixelLine(ctx, p.x - ux * 7, p.y - uy * 7, p.x, p.y);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = '#e0e0d0';
      ctx.fillRect(Math.round(p.x - ux * 7), Math.round(p.y - uy * 7), 1, 1);
      break;
    case 'gel':
      ctx.fillStyle = '#1f3a28';
      pixelEllipse(ctx, p.x, p.y, 3.5, 3.5);
      ctx.fillStyle = FX.gel;
      pixelEllipse(ctx, p.x, p.y, 2.5, 2.5);
      ctx.fillStyle = '#c8f0c0';
      ctx.fillRect(x - 1, y - 2, 1, 1);
      break;
  }
}

// ---------------------------------------------------------------- readability

/** Mites show where they're about to charge: a dotted line that firms up as the charge nears. */
function drawCreatureTelegraph(ctx: CanvasRenderingContext2D, c: Creature): void {
  const lunge = c.def.lunge;
  if (c.state !== 'windup' || c.def.behavior !== 'mite' || !lunge) return;
  const length = lunge.speed * lunge.time;
  const k = Math.min(1, c.stateT / c.def.windup);
  ctx.fillStyle = `rgba(255, 232, 160, ${0.2 + 0.45 * k})`;
  for (let d = 8; d < length; d += 6) {
    ctx.fillRect(Math.round(c.x + Math.cos(c.aim) * d) - 1, Math.round(c.y + Math.sin(c.aim) * d) - 1, 2, 2);
  }
}

function drawHumanTelegraph(ctx: CanvasRenderingContext2D, h: Human, time: number): void {
  const a = h.def.attack;
  if (!a || h.attack !== 'windup') return;
  const k = Math.min(1, h.attackT / a.windup);
  switch (a.kind) {
    case 'shieldCharge': {
      ctx.fillStyle = `rgba(255, 232, 160, ${0.2 + 0.5 * k})`;
      for (let d = 10; d < a.range; d += 6) {
        ctx.fillRect(Math.round(h.x + Math.cos(h.aim) * d) - 1, Math.round(h.y + Math.sin(h.aim) * d) - 1, 3, 3);
      }
      break;
    }
    case 'aimedShot': {
      const locked = h.attackT >= a.windup - AIM_LOCK;
      ctx.fillStyle = locked ? (Math.floor(time * 20) % 2 ? 'rgba(255, 80, 60, 0.95)' : 'rgba(255, 140, 120, 0.8)') : `rgba(255, 240, 180, ${0.25 + 0.3 * k})`;
      for (let d = 8; d < a.range; d += locked ? 2 : 3) {
        ctx.fillRect(Math.round(h.x + Math.cos(h.aim) * d), Math.round(h.y - 6 + Math.sin(h.aim) * d), 1, 1);
      }
      break;
    }
    case 'fireCircle': {
      const { x, y } = h.aimAt;
      ctx.fillStyle = `rgba(255, 138, 48, ${0.25 + 0.25 * k})`;
      pixelEllipse(ctx, x, y, FIRE_RADIUS * k, FIRE_RADIUS * k * 0.7);
      ctx.fillStyle = `rgba(255, 200, 120, ${0.5 + 0.4 * k})`;
      const steps = 28;
      for (let i = 0; i < steps; i++) {
        const ang = (i / steps) * Math.PI * 2 + time;
        ctx.fillRect(Math.round(x + Math.cos(ang) * FIRE_RADIUS), Math.round(y + Math.sin(ang) * FIRE_RADIUS * 0.7), 1, 1);
      }
      break;
    }
    case 'baton':
      ctx.fillStyle = `rgba(255, 232, 160, ${0.3 + 0.5 * k})`;
      for (let i = -3; i <= 3; i++) {
        const ang = h.aim + i * 0.3;
        ctx.fillRect(Math.round(h.x + Math.cos(ang) * 16), Math.round(h.y - 4 + Math.sin(ang) * 16), 2, 2);
      }
      break;
  }
}

/** The vision cone, drawn faintly on the ground and cut short by walls. */
function drawCone(ctx: CanvasRenderingContext2D, scene: Scene, h: Human): void {
  if (h.gone || h.retreating || h.task === 'flee') return;
  const color =
    h.awareness === 'hostile' ? '224, 64, 48'
    : h.awareness === 'searching' ? '240, 138, 48'
    : h.awareness === 'suspicious' ? '240, 208, 64'
    : '240, 236, 200';
  const alpha = h.awareness === 'unaware' || h.awareness === 'returning' ? 0.07 : 0.12;
  const half = (h.def.vision.halfAngleDeg * Math.PI) / 180;
  const range = h.def.vision.range;
  const rays = 18;
  const pts: [number, number][] = [[h.x, h.y - 2]];
  for (let i = 0; i <= rays; i++) {
    const ang = h.face - half + (2 * half * i) / rays;
    let d = 8;
    while (d < range && lineOfSight(scene.map, h.x, h.y - 2, h.x + Math.cos(ang) * (d + 6), h.y - 2 + Math.sin(ang) * (d + 6))) d += 6;
    pts.push([h.x + Math.cos(ang) * Math.min(d, range), h.y - 2 + Math.sin(ang) * Math.min(d, range)]);
  }
  ctx.fillStyle = `rgba(${color}, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (const [px, py] of pts) ctx.lineTo(px, py);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(${color}, ${alpha * 2.2})`;
  for (let i = 1; i < pts.length; i += 2) ctx.fillRect(Math.round(pts[i]![0]), Math.round(pts[i]![1]), 1, 1);
}

function drawAwareness(ctx: CanvasRenderingContext2D, h: Human, time: number): void {
  if (h.gone) return;
  const x = Math.round(h.x);
  const y = Math.round(h.y) - 27;
  switch (h.awareness) {
    case 'suspicious': {
      sprite(AWARE_ICONS.suspicious).draw(ctx, 0, x, y);
      ctx.fillStyle = '#050605';
      ctx.fillRect(x - 6, y + 2, 13, 3);
      ctx.fillStyle = '#f0d040';
      ctx.fillRect(x - 5, y + 3, Math.round(11 * Math.min(1, h.suspicion)), 1);
      break;
    }
    case 'searching':
      if (Math.floor(time * 4) % 2 === 0 || h.stateT < 0.5) sprite(AWARE_ICONS.searching).draw(ctx, 0, x, y);
      break;
    case 'hostile':
      sprite(AWARE_ICONS.hostile).draw(ctx, 0, x, y - (h.stateT < 0.25 ? 3 : 0));
      break;
    case 'returning':
      sprite(AWARE_ICONS.returning).draw(ctx, 0, x, y);
      break;
    default:
      break;
  }
}
