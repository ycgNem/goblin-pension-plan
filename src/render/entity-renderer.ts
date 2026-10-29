import { VIEW_H, VIEW_W } from '../core/screen';
import { CHARGED_SHOT } from '../data/combat';
import type { HumanId } from '../data/enemies';
import { NODES, type NodeId } from '../data/nodes';
import type { RegionId } from '../data/regions';
import { BLAST_TIME, blastArea, VALVE_COOLDOWN, type BossFight } from '../game/boss';
import type { Creature } from '../game/creature';
import { FX } from '../game/effects';
import { AIM_LOCK, FIRE_RADIUS, type Human } from '../game/human';
import { jobProgress } from '../game/production';
import type { Player } from '../game/player';
import type { Projectile } from '../game/projectiles';
import type { SaveData } from '../game/save';
import type { Pickup, Scene, StinkCloud, WorldObject } from '../game/scene';
import { lineOfSight } from '../world/sight';
import { TILE } from '../world/tiles';
import { GOBLIN, GRUBB, HUMAN_PALETTES, humanSprite, MITE, RAT, SLIME, SLIMELET } from './art/characters';
import { AWARE_ICONS, drawIcon } from './art/icons';
import { drawProp, propBoard, propSilhouette } from './art/props';
import { SHEETS } from './art/sheets.gen';
import type { View } from './lighting';
import { PAL } from './palette';
import type { SheetDef } from './art/sheet-types';
import { sheet, type SheetSprite } from './sheet';
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
  /** The region's boss fight, for drawing its valves. */
  boss: BossFight | null;
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
    // Vents are flat in the floor: everything stands on top of them.
    list.push({ y: o.kind === 'vent' ? o.y - 32 : o.y, draw: () => drawObject(ctx, o, s, o === s.focus) });
  }
  for (const c of scene.creatures) list.push({ y: c.y, draw: () => drawCreature(ctx, c, s.time) });
  for (const h of scene.humans) list.push({ y: h.y, draw: () => drawHuman(ctx, h, s.time) });
  for (const p of scene.pickups) list.push({ y: p.y, draw: () => drawPickup(ctx, p, s.time) });
  list.push({ y: player.y, draw: () => drawGoblin(ctx, player, s) });
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.draw();

  // Heaps you can hide in show a little eye as you come near, so they don't pass for junk piles.
  if (!s.goblinHidden) {
    for (const o of scene.objects) {
      if (o.kind !== 'heap') continue;
      const d = Math.hypot(o.x - player.x, o.y - player.y);
      if (d > 72) continue;
      ctx.globalAlpha = Math.min(1, (72 - d) / 30) * (0.75 + 0.25 * Math.sin(s.time * 3));
      drawEye(ctx, o.x, o.y - 21);
      ctx.globalAlpha = 1;
    }
  }

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
  for (const cloud of scene.clouds) drawCloud(ctx, cloud);
  // Over the lighting, so the dark Pump Room can't swallow them.
  if (s.boss) drawValveMarks(ctx, scene, s.boss, s.time);
  if (scene.boss) for (const b of scene.boss.blasts) drawSteam(ctx, b, s.time);
  for (const h of scene.humans) drawCone(ctx, scene, h);
  for (const c of scene.creatures) drawCreatureTelegraph(ctx, c);
  for (const c of scene.creatures) if (c.state === 'stunned') drawDizzy(ctx, c, s.time);
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
      return { art: 'steamValve', variant: s.boss?.valveState(o) ?? '' };
    case 'vent':
      return { art: 'vent', variant: '' };
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
  if (o.kind === 'npc' && o.id === 'grubb') drawGrubb(ctx, o.x, o.y - 4, s.time);
  const a = objectArt(o, s);
  if (!a) return;
  const wobble = o.shake > 0 ? Math.round(Math.sin(o.shake * 60) * 1) : 0;
  const x = o.x + wobble + (a.dx ?? 0);
  const y = o.y + (a.dy ?? 0);
  if (focused) {
    const sil = propSilhouette(a.art, a.variant, '#fff4c8');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) ctx.drawImage(sil.canvas, Math.round(x - sil.ax + dx), Math.round(y - sil.ay + dy));
  }
  // Searched, smashed, or scooped: faded back, so what's left doesn't read as loot.
  const spent = o.kind === 'node' && o.spent;
  if (spent) ctx.globalAlpha = 0.55;
  drawProp(ctx, a.art, a.variant, x, y);
  if (spent) ctx.globalAlpha = 1;
  // Dorrit leans in the hatch window, over its dark opening.
  if (o.kind === 'npc' && o.id === 'hatch') drawDorrit(ctx, o.x, o.y, s.time);

  // Extras that change with the Burrow.
  if (o.kind === 'station') {
    const up = (id: string) => s.save.upgrades.includes(id as never);
    if (o.id === 'bed' && up('tooGrandChair')) drawProp(ctx, 'grandChair', '', o.x + 34, o.y + 2);
    if (o.id === 'bed' && up('wallClock')) drawProp(ctx, 'wallClock', '', o.x + 18, o.y - 17);
    if (o.id === 'storage' && up('waxFern')) drawProp(ctx, 'waxFern', '', o.x - 15, o.y + 1);
    if (o.id === 'sign' && up('gildedPlaque')) drawProp(ctx, 'estPlaque', '', o.x + 34, o.y - 6);
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

/** A small open eye: "you could hide in here". */
function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const ex = Math.round(x) - 3;
  const ey = Math.round(y);
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(ex + 1, ey - 1, 5, 5);
  ctx.fillRect(ex, ey, 7, 3);
  ctx.fillStyle = '#e8e4d8';
  ctx.fillRect(ex + 2, ey, 3, 3);
  ctx.fillRect(ex + 1, ey + 1, 5, 1);
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(ex + 3, ey + 1, 1, 1);
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

/**
 * Where each ready valve's steam will land, marked faintly on the floor so you know where to
 * lure her, and a ring of pressure dots filling back up on valves that were just used.
 */
function drawValveMarks(ctx: CanvasRenderingContext2D, scene: Scene, fight: BossFight, time: number): void {
  for (const o of scene.objects) {
    const state = fight.valveState(o);
    if (state === 'ready') {
      const a = blastArea(o);
      const pulse = 0.22 + 0.12 * Math.sin(time * 4);
      ctx.fillStyle = `rgba(220, 236, 230, ${pulse})`;
      const top = Math.round(a.y + 12);
      for (let i = 0; i < a.w; i += 3) {
        ctx.fillRect(Math.round(a.x + i), top, 1, 1);
        ctx.fillRect(Math.round(a.x + i), Math.round(a.y + a.h - 1), 1, 1);
      }
      for (let j = top; j < a.y + a.h; j += 3) {
        ctx.fillRect(Math.round(a.x), j, 1, 1);
        ctx.fillRect(Math.round(a.x + a.w - 1), j, 1, 1);
      }
      // Chevrons drifting down the column: this way, the steam goes.
      for (let k = 0; k < 3; k++) {
        const cy = top + 8 + ((time * 22 + k * 26) % (a.h - 24));
        for (let d = 0; d < 4; d++) {
          ctx.fillRect(Math.round(o.x - d), Math.round(cy - d), 1, 1);
          ctx.fillRect(Math.round(o.x + d), Math.round(cy - d), 1, 1);
        }
      }
    } else if (state === 'spent') {
      const filled = 1 - fight.cooldownLeft(o) / VALVE_COOLDOWN;
      const dots = 12;
      for (let i = 0; i < dots; i++) {
        const ang = -Math.PI / 2 + (i / dots) * Math.PI * 2;
        ctx.fillStyle = i / dots < filled ? '#f0d070' : 'rgba(40, 30, 20, 0.7)';
        ctx.fillRect(Math.round(o.x + Math.cos(ang) * 10), Math.round(o.y - 9 + Math.sin(ang) * 10), 1, 1);
      }
    }
  }
}

// ---------------------------------------------------------------- the goblin and friends

function goblinFrame(aim: number, moving: boolean, stride: number): { frame: number; flip: boolean } {
  const step = moving ? [0, 1, 0, 2][Math.floor(stride / 7) % 4]! : 0;
  if (Math.abs(Math.cos(aim)) >= 0.62) return { frame: 6 + step, flip: Math.cos(aim) < 0 };
  return { frame: (Math.sin(aim) < 0 ? 3 : 0) + step, flip: false };
}

/** Which way a sheet character faces for an angle: south, north, or east (west is east mirrored). */
function facing(angle: number): { dir: 's' | 'n' | 'e'; flip: boolean } {
  if (Math.abs(Math.cos(angle)) >= 0.62) return { dir: 'e', flip: Math.cos(angle) < 0 };
  return { dir: Math.sin(angle) < 0 ? 'n' : 's', flip: false };
}

/** World pixels from the goblin's feet up to the hand that holds the launcher. */
const GOBLIN_HAND = 7;

function drawGoblin(ctx: CanvasRenderingContext2D, p: Player, s: WorldDrawState): void {
  const art = sheet(SHEETS.goblin);
  if (!art.ready) {
    drawGoblinFallback(ctx, p, s);
    return;
  }
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  drawShadow(ctx, x, y + 1, 6, 2);
  if (s.goblinDown || s.asleep) {
    art.draw(ctx, 'ko', art.frames('ko') - 1, x, y, { flip: s.asleep });
    return;
  }
  if (s.goblinHidden) return;
  // Blink while invulnerable after a hit.
  if (p.health.invuln > 0 && !p.rolling && Math.floor(s.time * 16) % 2 === 0) return;
  const silhouette = p.hurtT < 0.08 ? HIT_FLASH : undefined;
  const moving = Math.hypot(p.vx, p.vy) > 10;

  if (p.rolling) {
    const f = facing(Math.atan2(p.vy, p.vx));
    const clip = `roll_${f.dir}`;
    if (art.has(clip)) art.draw(ctx, clip, Math.floor(p.rollProgress * art.frames(clip)), x, y, { flip: f.flip, silhouette });
    else art.draw(ctx, `walk_${f.dir}`, Math.floor(p.rollProgress * 12), x, y, { flip: f.flip, silhouette });
    return;
  }

  const f = facing(p.aim);
  const clip = p.sneaking ? `sneak_${f.dir}` : moving ? `walk_${f.dir}` : `idle_${f.dir}`;
  // Walk cycles advance with distance (6px a frame), so feet don't slide; idle breathes on the clock.
  const frame = moving ? Math.floor(p.stride / 6) : p.sneaking ? 0 : Math.floor(s.time * 4);
  const behind = Math.sin(p.aim) < -0.3;
  if (behind) drawLauncher(ctx, p, x, y - GOBLIN_HAND + 4);
  art.draw(ctx, clip, frame, x, y, { flip: f.flip, silhouette, alpha: p.sneaking ? 0.82 : undefined });
  if (!behind) drawLauncher(ctx, p, x, y - GOBLIN_HAND + 4);
  drawChargeGlow(ctx, p, x, y - GOBLIN_HAND + 4, s.time);
}

function drawChargeGlow(ctx: CanvasRenderingContext2D, p: Player, x: number, y: number, time: number): void {
  if (p.charge <= 0) return;
  const k = p.charge / CHARGED_SHOT.chargeTime;
  const size = k >= 1 ? 3 : 1 + Math.floor(k * 2);
  ctx.fillStyle = k >= 1 && Math.floor(time * 20) % 2 === 0 ? '#ffffff' : PAL.homeGlow;
  const mx = Math.round(x + Math.cos(p.aim) * 11);
  const my = Math.round(y - 4 + Math.sin(p.aim) * 11);
  ctx.fillRect(mx - Math.floor(size / 2), my - Math.floor(size / 2), size, size);
}

/** The original string-sprite goblin, for when the sheet isn't loaded. */
function drawGoblinFallback(ctx: CanvasRenderingContext2D, p: Player, s: WorldDrawState): void {
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
  drawChargeGlow(ctx, p, x, y, s.time);
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

/** A generated sheet by name (characters are named by id: 'paladin', 'grubb', 'rat'), if it's packed and loaded. */
function sheetFor(id: string): SheetSprite | null {
  const def = (SHEETS as Record<string, SheetDef | undefined>)[id];
  if (!def) return null;
  const s = sheet(def);
  return s.ready ? s : null;
}

function drawGrubb(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const art = sheetFor('grubb');
  if (art) {
    // Breathing behind his desk; the eyeshade and spectacles are part of the sprite now.
    art.draw(ctx, 'idle_s', Math.floor(time * 3), x, y + 1);
    return;
  }
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
  const win = propBoard('hatch') ?? { x: -9, y: -16, w: 18, h: 10 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.round(x) + win.x, Math.round(y) + win.y, win.w, win.h);
  ctx.clip();
  const lean = Math.sin(time * 0.7) > 0.6 ? 1 : 0;
  const art = sheetFor('dorrit');
  if (art) art.draw(ctx, 'idle_s', Math.floor(time * 3), x + lean, y + 14);
  else sprite(HUMAN_SPRITES.dorrit).draw(ctx, 0, x + lean, y + 6);
  ctx.restore();
}

const DIR8 = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;

/** The 8-way facing for an angle. West-side views are the east-side ones mirrored. */
function facing8(angle: number): { dir: 'e' | 'se' | 's' | 'ne' | 'n'; flip: boolean } {
  const d = DIR8[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8]!;
  if (d === 'w') return { dir: 'e', flip: true };
  if (d === 'sw') return { dir: 'se', flip: true };
  if (d === 'nw') return { dir: 'ne', flip: true };
  return { dir: d, flip: false };
}

/**
 * Beetles and the Pump Matron from 8-direction sheets, centered on the shell. Their armored front
 * is in the art; a sealed shell gets its rear plates drawn on. False when there's no sheet (or no
 * belly-up clip for a stun), so the procedural shell draws instead.
 */
function drawShellSheet(ctx: CanvasRenderingContext2D, c: Creature, x: number, y: number, silhouette: string | undefined): boolean {
  const art = sheetFor(c.def.behavior);
  if (!art) return false;
  const big = c.def.behavior === 'matron';
  const r = c.radius;
  const cy = y - 2;
  if (c.state === 'stunned') {
    if (!art.has('flipped')) return false;
    drawShadow(ctx, x, y + r * 0.8 - 3, r + 1, big ? 4 : 2);
    art.draw(ctx, 'flipped', c.age * 14, x, cy, { silhouette });
    return true;
  }
  const f = facing8(c.face);
  const moving = Math.hypot(c.vx, c.vy) > 6;
  const walk = `walk_${f.dir}`;
  drawShadow(ctx, x, y + r * 0.8 - 3, r + 1, big ? 4 : 2);
  if (moving && art.has(walk)) art.draw(ctx, walk, c.age * (big ? 8 : 12), x, cy, { flip: f.flip, silhouette });
  else art.draw(ctx, `idle_${f.dir}`, 0, x, cy, { flip: f.flip, silhouette });
  if (c.sealed && !silhouette) {
    // Phase two: plates bolted over the soft rear.
    const back = c.face + Math.PI;
    for (const a of [-0.55, -0.2, 0.2, 0.55]) {
      const px = Math.round(x + Math.cos(back + a) * r * 0.62);
      const py = Math.round(cy + Math.sin(back + a) * r * 0.5);
      ctx.fillStyle = '#2a2420';
      ctx.fillRect(px - 2, py - 1, 4, 3);
      ctx.fillStyle = '#9aa0a6';
      ctx.fillRect(px - 1, py - 1, 3, 2);
      ctx.fillStyle = '#d8dce0';
      ctx.fillRect(px - 1, py - 1, 1, 1);
    }
  }
  return true;
}

/** Small creatures from sheets. False if this one has no sheet yet, so the string sprite draws. */
function drawCreatureSheet(ctx: CanvasRenderingContext2D, c: Creature, x: number, y: number, silhouette: string | undefined): boolean {
  const art = sheetFor(c.def.behavior);
  if (!art) return false;
  const moving = Math.hypot(c.vx, c.vy) > 12;
  switch (c.def.behavior) {
    case 'rat':
      // Drawn side-on facing right, mirrored to face left.
      art.draw(ctx, 'run', moving ? c.age * 14 : 0, x, y + 3, { flip: Math.cos(c.face) < 0, silhouette });
      return true;
    case 'mite':
      // Seen from above, head down: mirrored top to bottom when it heads north.
      art.draw(ctx, 'run', moving ? c.age * 16 : 0, x, y - 1, { flipY: Math.sin(c.face) < 0, silhouette });
      return true;
    case 'slime':
    case 'slimelet':
      art.draw(ctx, 'idle', c.age * (c.state === 'windup' ? 14 : 7), x, y + c.radius, { silhouette });
      return true;
    default:
      return false;
  }
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
  if (drawCreatureSheet(ctx, c, x, y, silhouette)) {
    if (c.slowT > 0) {
      ctx.fillStyle = FX.gel;
      ctx.fillRect(x - 1, y - c.radius - 4, 2, 2);
      ctx.fillRect(x + 3, y - c.radius - 2, 1, 1);
    }
    return;
  }
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
    case 'beetle':
    case 'matron':
      if (!drawShellSheet(ctx, c, x, y, silhouette)) drawShellBeast(ctx, c, x, y, time, silhouette);
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
  const art = sheetFor(h.id);
  if (art) {
    drawShadow(ctx, x, y + 1, 7, 2);
    const f = facing(h.face);
    const moving = Math.hypot(h.vx, h.vy) > 8;
    const winding = h.attack === 'windup';
    const attack = `attack_${f.dir}`;
    const windup = h.def.attack?.windup ?? 1;
    let clip = moving ? `walk_${f.dir}` : `idle_${f.dir}`;
    let frame = moving ? h.age * 8 : time * 4 + h.x;
    if ((winding || h.attack === 'active') && art.has(attack)) {
      clip = attack;
      frame = winding ? Math.min(art.frames(attack) - 1, (h.attackT / windup) * art.frames(attack)) : art.frames(attack) - 1;
    }
    // Gear is part of each sprite now. A windup blinks, like the creatures', over the telegraph.
    const blink = winding && Math.floor(h.attackT * 14) % 2 === 0;
    const silhouette = h.flash > 0 ? HIT_FLASH : blink ? TELEGRAPH : undefined;
    art.draw(ctx, clip, frame, x, y + 1, { flip: f.flip, silhouette, alpha: h.retreating ? 0.85 : undefined });
    return;
  }
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
  drawShadow(ctx, p.x, p.y + 2, 4, 1);
  drawIcon(ctx, p.item, Math.round(p.x) - 8, Math.round(p.y - p.z) - 12 + bob);
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

/** Chargers show where they're about to go: a dotted line that firms up as the charge nears. */
function drawCreatureTelegraph(ctx: CanvasRenderingContext2D, c: Creature): void {
  const lunge = c.def.lunge;
  const b = c.def.behavior;
  if (c.state !== 'windup' || (b !== 'mite' && b !== 'beetle' && b !== 'matron') || !lunge) return;
  const length = lunge.speed * lunge.time;
  const k = Math.min(1, c.stateT / c.def.windup);
  const size = b === 'matron' ? 3 : 2;
  ctx.fillStyle = b === 'matron' ? `rgba(255, 150, 110, ${0.25 + 0.5 * k})` : `rgba(255, 232, 160, ${0.2 + 0.45 * k})`;
  for (let d = c.radius + 2; d < length; d += 6) {
    ctx.fillRect(Math.round(c.x + Math.cos(c.aim) * d) - 1, Math.round(c.y + Math.sin(c.aim) * d) - 1, size, size);
  }
}

// ---------------------------------------------------------------- shelled creatures

interface ShellPalette {
  leg: string;
  outline: string;
  shell: string;
  shellLight: string;
  shellDark: string;
  armor: string;
  armorLight: string;
  soft: string;
  head: string;
  eye: string;
  belly: string;
}

const BEETLE_PAL: ShellPalette = {
  leg: '#2a1a10', outline: '#140c08', shell: '#7a4a28', shellLight: '#a8703c', shellDark: '#4e2e18',
  armor: '#9aa0a6', armorLight: '#e0e4e8', soft: '#d89a80', head: '#3a2418', eye: '#f0d040', belly: '#c8a878',
};

const MATRON_PAL: ShellPalette = {
  leg: '#2a120c', outline: '#140806', shell: '#8a3420', shellLight: '#c0502c', shellDark: '#5a2014',
  armor: '#a8aeb4', armorLight: '#ffffff', soft: '#e8a890', head: '#3a1410', eye: '#ff5030', belly: '#d8b890',
};

/**
 * Beetles and the Matron, drawn top-down and turned to face where they're going. The armored
 * front is bright metal; the soft rear is pale. That's the whole fight, so it has to read.
 */
function drawShellBeast(ctx: CanvasRenderingContext2D, c: Creature, x: number, y: number, time: number, silhouette?: string): void {
  const big = c.def.behavior === 'matron';
  const pal = big ? MATRON_PAL : BEETLE_PAL;
  const r = c.radius;
  const ry = r * 0.8;
  const cy = y - 2;
  const fx = Math.cos(c.face);
  const fy = Math.sin(c.face);
  const moving = Math.hypot(c.vx, c.vy) > 6;
  const flipped = c.state === 'stunned';
  const legSpeed = flipped ? 26 : big ? 9 : 15;
  const step = moving || flipped ? Math.sin(c.age * legSpeed) : 0;
  const thick = big ? 2 : 1;
  drawShadow(ctx, x, y + ry - 3, r + 1, big ? 4 : 2);

  // Legs: three pairs, splayed out to the sides.
  ctx.fillStyle = silhouette ?? pal.leg;
  for (let i = -1; i <= 1; i++) {
    for (const side of [-1, 1]) {
      const along = i * r * 0.5;
      const wiggle = step * (i === 0 ? 1 : -1) * side * (big ? 3 : 2);
      const bx = x + fx * along - fy * side * r * 0.6;
      const by = cy + (fy * along + fx * side * r * 0.6) * 0.8;
      const reach = flipped ? r * 0.7 : r + 3;
      const ex = x + fx * (along + wiggle) - fy * side * reach;
      const ey = cy + (fy * (along + wiggle) + fx * side * reach) * 0.8 - (flipped ? 4 : 0);
      pixelLine(ctx, bx, by, ex, ey, thick);
    }
  }

  ctx.fillStyle = silhouette ?? pal.outline;
  pixelEllipse(ctx, x, cy, r + 1, ry + 1);
  if (flipped) {
    // On its back: a pale, segmented belly with nothing to protect it.
    ctx.fillStyle = silhouette ?? pal.belly;
    pixelEllipse(ctx, x, cy, r, ry);
    if (!silhouette) {
      ctx.fillStyle = pal.shellDark;
      for (let k = -2; k <= 2; k++) {
        const ox = fx * k * r * 0.3;
        const oy = fy * k * r * 0.24;
        pixelLine(ctx, x + ox - fy * r * 0.6, cy + oy + fx * ry * 0.6, x + ox + fy * r * 0.6, cy + oy - fx * ry * 0.6);
      }
    }
    return;
  }

  ctx.fillStyle = silhouette ?? pal.shell;
  pixelEllipse(ctx, x, cy, r, ry);
  if (silhouette) return;
  // Soft rear, then the armored front over the other half. A sealed shell is plated at the back too.
  ctx.fillStyle = c.sealed ? pal.armor : pal.soft;
  pixelEllipse(ctx, x - fx * r * 0.62, cy - fy * ry * 0.62, r * 0.38, ry * 0.36);
  if (c.sealed) {
    ctx.fillStyle = pal.armorLight;
    for (const a of [-0.5, 0, 0.5]) ctx.fillRect(Math.round(x + Math.cos(c.face + Math.PI + a) * r * 0.62), Math.round(cy + Math.sin(c.face + Math.PI + a) * ry * 0.62), 1, 1);
  }
  ctx.fillStyle = pal.shellLight;
  pixelEllipse(ctx, x - r * 0.28, cy - ry * 0.32, r * 0.45, ry * 0.3);
  for (let a = -1.05; a <= 1.05; a += 0.07) {
    const ang = c.face + a;
    const ex = x + Math.cos(ang) * r * 0.9;
    const ey = cy + Math.sin(ang) * ry * 0.9;
    ctx.fillStyle = pal.armor;
    ctx.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, big ? 3 : 2, big ? 3 : 2);
  }
  for (let a = -0.9; a <= 0.9; a += 0.15) {
    const ang = c.face + a;
    ctx.fillStyle = pal.armorLight;
    ctx.fillRect(Math.round(x + Math.cos(ang) * r * 0.95), Math.round(cy + Math.sin(ang) * ry * 0.95) - 1, 1, 1);
  }
  // Rivets on the plates.
  ctx.fillStyle = pal.armorLight;
  for (const a of [-0.6, 0, 0.6]) ctx.fillRect(Math.round(x + Math.cos(c.face + a) * r * 0.66), Math.round(cy + Math.sin(c.face + a) * ry * 0.66), 1, 1);
  // The seam down the shell.
  ctx.fillStyle = pal.shellDark;
  pixelLine(ctx, x - fx * r * 0.85, cy - fy * ry * 0.85, x + fx * r * 0.45, cy + fy * ry * 0.45);

  if (big) {
    // The copper flywheel she grew into her shell, still turning.
    const wx = x - fx * r * 0.15;
    const wy = cy - fy * ry * 0.15 - 3;
    const spin = time * (c.state === 'attack' ? 14 : moving ? 6 : 1.5);
    ctx.fillStyle = '#5a2a10';
    pixelEllipse(ctx, wx, wy + 1, r * 0.55, r * 0.42);
    ctx.fillStyle = '#c87533';
    for (let a = 0; a < Math.PI * 2; a += 0.22) ctx.fillRect(Math.round(wx + Math.cos(a) * r * 0.5), Math.round(wy + Math.sin(a) * r * 0.38), 2, 2);
    ctx.fillStyle = '#f0a060';
    for (let k = 0; k < 4; k++) {
      const a = spin + (k * Math.PI) / 2;
      pixelLine(ctx, wx, wy, wx + Math.cos(a) * r * 0.45, wy + Math.sin(a) * r * 0.34);
    }
    ctx.fillStyle = '#ffd8a0';
    ctx.fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 2, 2);
  }

  // Head and mandibles at the front.
  const hx = x + fx * r * 0.92;
  const hy = cy + fy * ry * 0.92;
  const hr = r * 0.34;
  ctx.fillStyle = pal.outline;
  pixelEllipse(ctx, hx, hy, hr + 1, hr * 0.85 + 1);
  ctx.fillStyle = pal.head;
  pixelEllipse(ctx, hx, hy, hr, hr * 0.85);
  ctx.fillStyle = pal.eye;
  for (const side of [-1, 1]) ctx.fillRect(Math.round(hx - fy * side * hr * 0.55), Math.round(hy + fx * side * hr * 0.45) - 1, big ? 2 : 1, big ? 2 : 1);
  ctx.fillStyle = pal.leg;
  const open = c.state === 'windup' ? 0.55 : 0.3;
  for (const side of [-1, 1]) {
    const a = c.face + side * open;
    pixelLine(ctx, hx + Math.cos(a) * hr * 0.6, hy + Math.sin(a) * hr * 0.5, hx + Math.cos(a) * (hr + (big ? 6 : 3)), hy + Math.sin(a) * (hr + (big ? 6 : 3)) * 0.8, thick);
  }
}

/** Stars over something knocked flat. */
function drawDizzy(ctx: CanvasRenderingContext2D, c: Creature, time: number): void {
  for (let i = 0; i < 4; i++) {
    const a = time * 5 + (i * Math.PI) / 2;
    const sx = Math.round(c.x + Math.cos(a) * (c.radius * 0.8));
    const sy = Math.round(c.y - c.radius - 6 + Math.sin(a) * 3);
    ctx.fillStyle = i % 2 ? '#fff4c0' : '#f0c040';
    ctx.fillRect(sx, sy - 1, 1, 3);
    ctx.fillRect(sx - 1, sy, 3, 1);
  }
}

function drawSteam(ctx: CanvasRenderingContext2D, b: { x: number; y: number; w: number; h: number; t: number }, time: number): void {
  const fade = b.t < BLAST_TIME ? 1 : Math.max(0, 1 - (b.t - BLAST_TIME) / 0.6);
  const reach = Math.min(1, b.t / 0.15) * b.h;
  // A pale column first, so the danger area reads at a glance, then the billowing puffs.
  ctx.fillStyle = `rgba(230, 236, 232, ${0.16 * fade})`;
  ctx.fillRect(Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(reach));
  for (let i = 0; i < 160; i++) {
    const fx = ((i * 0.618034) % 1) * b.w;
    const fy = (i * 23 + time * 300) % b.h;
    if (fy > reach) continue;
    const wob = Math.sin(time * 9 + i) * 4 * (fy / b.h + 0.3);
    const a = fade * (0.9 - (fy / b.h) * 0.5);
    ctx.fillStyle = i % 4 === 0 ? `rgba(255, 255, 255, ${a})` : `rgba(214, 222, 218, ${a * 0.8})`;
    const size = 2 + (i % 4);
    ctx.fillRect(Math.round(b.x + fx + wob - size / 2), Math.round(b.y + fy), size, size);
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, cloud: StinkCloud): void {
  const fade = Math.min(1, cloud.t / 0.4) * Math.min(1, (cloud.life - cloud.t) / 1.5);
  for (let i = 0; i < 90; i++) {
    const d = cloud.r * Math.sqrt((i * 0.618034) % 1);
    const a = i * 2.39996 + cloud.t * (i % 2 ? 0.35 : -0.25);
    const x = Math.round(cloud.x + Math.cos(a) * d);
    const y = Math.round(cloud.y + Math.sin(a) * d * 0.75);
    ctx.fillStyle = i % 3 === 0 ? `rgba(200, 220, 90, ${0.55 * fade})` : `rgba(130, 160, 60, ${0.4 * fade})`;
    ctx.fillRect(x, y, 2, 2);
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
