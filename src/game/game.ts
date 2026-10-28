import { audio } from '../audio/audio';
import type { SfxId } from '../audio/sfx';
import type { TrackId } from '../audio/music';
import type { Input } from '../core/input';
import { actionLabel } from '../core/keys';
import { clamp, damp, lerp } from '../core/math';
import { VIEW_H, VIEW_W, type Screen } from '../core/screen';
import { settings } from '../core/settings';
import { CHAPTER_1, ORDERS, RETIREMENT_LEDGER } from '../data/charter';
import { CHARGED_SHOT, FEEL, LAUNCHER_MODE_IDS, LAUNCHER_MODES, MOD_MODES, type LauncherMode, type LauncherModeId } from '../data/combat';
import { OCCUPANCY_STEP, SHIFT_SECONDS } from '../data/economy';
import { BOSS_PRIZES } from '../data/enemies';
import { EVENTS, eventForShift, type EventId } from '../data/events';
import { ITEMS, ITEM_IDS, type ItemBag, type ItemDef, type ItemId } from '../data/items';
import { BONUS_ITEM_LEVEL, NODES, rollYield, type NodeDef, type NodeId } from '../data/nodes';
import { RECIPES, type RecipeDef, type RecipeId, type StationId } from '../data/recipes';
import { HOME_REGION, REGIONS, REGION_IDS, type RegionId } from '../data/regions';
import { levelForXp, SKILLS, type SkillId } from '../data/skills';
import { BOSS_LINES, DORRIT_FIRST, DORRIT_LATER, DORRIT_OPEN, FIRST_VISIT, GRUBB_FIRST, grubbChat, type DialogueEffect, type HintId, type Script } from '../data/story';
import { UPGRADES, type UpgradeId } from '../data/upgrades';
import { Ambience, type AmbientSound } from '../render/ambience';
import { drawProp } from '../render/art/props';
import { drawWorld, drawWorldOverlay, type WorldDrawState } from '../render/entity-renderer';
import { drawEdgeGlow, drawFrameVignette, Lighting, type Light, type View } from '../render/lighting';
import { PAL } from '../render/palette';
import { WorldRenderer } from '../render/world-renderer';
import { BoardOverlay, LetterOverlay, ReceiptOverlay, StampOverlay, SummaryOverlay, type TripReport } from '../ui/cards';
import { DialogueOverlay } from '../ui/dialogue';
import { Hud } from '../ui/hud';
import { MenuOverlay, type MenuPage } from '../ui/menu';
import type { Overlay } from '../ui/overlay';
import { PauseOverlay } from '../ui/pause';
import { GeneratorOverlay, StationOverlay, StorageOverlay } from '../ui/station';
import { TradeOverlay } from '../ui/trade';
import { Toasts } from '../ui/toasts';
import { lineOfSight } from '../world/sight';
import { TileMap } from '../world/tilemap';
import { TILE } from '../world/tiles';
import { Camera } from './camera';
import type { BossEventKind } from './boss';
import { build, canBuild, coziness, craft, feedGenerator, GENERATOR, openUpgradesAt, skillLevel } from './crafting';
import type { Creature, CreatureState } from './creature';
import { retrievalReceipt, type Receipt } from './defeat';
import { currentEvent, LiveEvent, pruneEventNodes, resolveOffscreen, storyGated, STORY_CONTRACT_DELAY, STORY_CONTRACT_NEAR } from './director';
import { Feel, FX } from './effects';
import { Banners, drawBossBar, drawBubbles, drawButtons, drawControlsStrip, drawDamageNumbers, drawHearts, drawHomeArrow, drawMod, drawObjective, drawPrompt, drawShiftClock, drawThrowable, drawTracked, type PanelRect } from './game-hud';
import { createHealth, heal, setMax } from './health';
import type { Human } from './human';
import { addToPack, addToStorage, canAfford, haveCount, packCount, pay, pickFood, quickDeposit, removeFromPack, takeDefeatFee, withdraw } from './inventory';
import { Player } from './player';
import { collect, jobsAt, startJob } from './production';
import { charterDone, charterProgress, currentObjective, nextCharterStep } from './progress';
import { clearSave, writeSave, type ProductionStation, type SaveData } from './save';
import { Scene, type SceneEvents, type SceneSound, type WorldObject } from './scene';
import { playerStats, type PlayerStats } from './stats';
import { buy, payOccupancy, sellOne, shopName } from './trade';
import { isSpent, markSpent, pruneSpent, shiftIndex } from './world-state';

const FADE_TIME = 0.22;
/** Defeat fades out slower, so it reads as passing out. */
const DEFEAT_FADE_TIME = 0.7;
const AUTOSAVE_EVERY = 15;
/** How long the goblin lies there before the Rat Union shows up. */
const DOWN_TIME = 1.4;
/** The opening: asleep in bed this long before getting up by itself. */
const WAKE_TIME = 3;
const INTERACT_RANGE = 20;
const THROW_RANGE = 120;
/** How far away a sound can be and still play. */
const HEARING = 320;

/** play: normal. down: just defeated, lying there. asleep: the opening, in bed. */
type Mode = 'play' | 'down' | 'asleep';

interface Transition {
  phase: 'out' | 'in';
  t: number;
  fade: number;
  to: RegionId;
  exit: string | null;
  /** Arriving after a defeat: show the Rat Union receipt. */
  defeat?: boolean;
}

interface Thrown {
  kind: 'pebble' | 'bottle' | 'stinkbrew';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
}

/** One expedition: from leaving home to getting back. */
interface Trip {
  from: number;
  /** Every region the trip went through, in order. */
  regions: RegionId[];
  items: ItemBag;
  xp: Partial<Record<SkillId, number>>;
  defeated: number;
  /** The Charter when the trip began, to see which steps it finished. */
  charter: boolean[];
}

/** Hints about what's happening this second. They jump the queue. */
const URGENT_HINTS: readonly HintId[] = ['fight', 'sneak', 'eat', 'throw', 'armor', 'valve'];

export interface GameHooks {
  quit(): void;
  reset(): void;
}

const PRODUCTION: readonly ProductionStation[] = ['mushroomBed', 'dryingRack', 'boneGrinder'];

/** Map station ids to crafting stations. Stations not listed are build-only spots. */
const STATION_OF: Partial<Record<string, StationId>> = {
  pot: 'pot', workbench: 'workbench', mushroomBed: 'mushroomBed', dryingRack: 'dryingRack', boneGrinder: 'boneGrinder',
};

const STATION_TITLE: Record<string, string> = {
  bed: 'Sack Bed', storage: 'Storage Crate', pot: 'Cooking Pot', workbench: 'Workbench', mushroomBed: 'Mushroom Bed',
  dryingRack: 'Drying Rack', boneGrinder: 'Bone Grinder', slimeGenerator: 'Slime Generator', lantern: 'Lantern', sign: 'The Sign',
};

const WINDUP_SOUND: Partial<Record<string, SfxId>> = { rat: 'ratSqueak', slime: 'slimeBlorp', slimelet: 'spit', mite: 'miteClick', beetle: 'beetleHiss', matron: 'matronRoar' };

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, clamp(t, 0, 1)));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

export class Game {
  save: SaveData;
  stats: PlayerStats;
  regionId: RegionId = HOME_REGION;
  map!: TileMap;
  scene!: Scene;
  readonly player = new Player();
  readonly camera = new Camera();
  private readonly renderer = new WorldRenderer();
  private readonly lighting = new Lighting();
  private ambience!: Ambience;
  private readonly hud: Hud;
  private readonly feel = new Feel();
  private readonly toasts = new Toasts();
  private readonly banners = new Banners();
  private overlays: Overlay[] = [];
  private mode: Mode = 'play';
  private downT = 0;
  private wakeT = 0;
  private receipt: Receipt = retrievalReceipt([]);
  private transition: Transition | null = null;
  private sinceSave = 0;
  private time = 0;
  private regionTime = 0;
  private debug = false;
  /** Debug-only launcher override, so mods can be tried before they can be crafted. Not saved. */
  private debugMode: LauncherModeId | null = null;
  private live: LiveEvent | null = null;
  /** The Cistern sluice, held open by the inspector during his shift. */
  private eventGate = false;
  private hidden = false;
  private wasCover = false;
  private focus: WorldObject | null = null;
  private holdT = 0;
  private holdOn: WorldObject | null = null;
  private throws: Thrown[] = [];
  private runNoiseT = 0;
  private lastShift: number;
  private trip: Trip | null = null;
  private readonly creatureStates = new Map<Creature, CreatureState>();
  private dangerT = 0;
  private spottedFx = 0;
  private muzzleT = 0;
  private objectiveFlash = 0;
  /** Where the objective and tracker panels were last frame, and how solid they are: they fade when something is behind them. */
  private hudPanels: PanelRect[] = [];
  private hudAlpha = 1;
  private lastObjective = '';
  private readonly hintQueue: HintId[] = [];
  private readonly notified = new Set<string>();
  private packFullT = 0;
  private chargeWasReady = false;
  private sconces: { x: number; y: number }[] = [];
  /** Windows to open once the current conversation is over. */
  private pendingStamp = false;
  private pendingTrade = false;
  /** The boss bar flashes when the boss takes a big hit. */
  private bossFlash = 0;
  private exitLights: { x: number; y: number }[] = [];
  private homeExit: { x: number; y: number } | null = null;

  private readonly sceneEvents: SceneEvents = {
    hurtPlayer: (damage, fromX, fromY) => this.hurtPlayer(damage, fromX, fromY),
    creatureHit: (c, _damage, fatal) => {
      if (!fatal) this.feel.kick(FEEL.shakeHit);
      this.play('hit', c.x, c.y);
    },
    creatureKilled: (c, byPlayer) => this.onKill(c, byPlayer),
    pickup: (item, qty) => this.pickup(item, qty),
    objectBroken: (o) => this.useNode(o),
    spotted: () => {
      this.spottedFx = 1;
      this.dangerT = 4;
      this.feel.kick(1.4);
    },
    alarm: (h) => this.live?.onAlarm(h),
    sound: (id, x, y) => this.play(id, x, y),
    deflected: (c) => this.queueHint(c.sealed ? 'valve' : 'armor'),
    boss: (kind, x, y) => this.onBoss(kind, x, y),
  };

  constructor(private readonly screen: Screen, private readonly input: Input, save: SaveData, private readonly hooks: GameHooks, opening: boolean) {
    this.hud = new Hud(screen.game, screen.ui, () => screen.uiScale);
    this.save = save;
    this.stats = playerStats(this.save);
    this.player.health = createHealth(this.stats.maxHp, this.save.hp > 0 ? this.save.hp : this.stats.maxHp);
    this.lastShift = shiftIndex(save.playTime);
    for (const s of PRODUCTION) for (const j of jobsAt(save, s)) if (save.playTime >= j.end) this.notified.add(`${s}:${j.end}`);
    if (opening && !save.flags.wokeUp) {
      this.mode = 'asleep';
      this.enterRegion(HOME_REGION, null, null);
      const bed = this.scene.objects.find((o) => o.id === 'bed');
      if (bed) this.player.place(bed.x + 6, bed.y - 6);
      this.camera.snap(this.player.x, this.player.y, this.map);
    } else {
      this.enterRegion(this.save.region, null, this.save.pos);
    }
    this.lastObjective = currentObjective(this.save).text;
  }

  // ---------------------------------------------------------------- regions

  private enterRegion(id: RegionId, arrivalExit: string | null, pos: { x: number; y: number } | null, defeat = false): void {
    const from = this.map ? this.regionId : null;
    if (from) this.stashFloor();
    if (this.live) {
      this.live.abandon();
      this.live = null;
    }
    this.eventGate = false;
    this.regionId = id;
    this.map = TileMap.forRegion(id);
    this.rebake();
    this.scene = new Scene(id, this.map, this.save, this.sceneEvents);
    // Whatever was left lying here earlier this shift is still here.
    const shift = shiftIndex(this.save.playTime);
    for (const f of this.save.floor) if (f.region === id && f.shift === shift) this.scene.placePickup(f.item, f.qty, f.x, f.y);
    this.save.floor = this.save.floor.filter((f) => f.region !== id);
    this.ambience = new Ambience(id, this.map, Math.random, (s, x, y) => this.ambientSound(s, x, y));
    this.creatureStates.clear();
    this.throws = [];
    this.hidden = this.wasCover = false;
    this.focus = this.holdOn = null;
    this.holdT = 0;
    this.regionTime = 0;
    this.findFixtures();

    const spot = pos ?? this.arrivalPoint(arrivalExit);
    this.player.place(spot.x, spot.y);
    this.camera.snap(this.player.x, this.player.y, this.map);
    const region = REGIONS[id];
    if (this.mode !== 'asleep') this.banners.region = { name: region.name, subtitle: region.subtitle, t: 0 };

    if (!this.save.visited.includes(id)) {
      this.save.visited.push(id);
      const caption = FIRST_VISIT[id];
      if (caption) this.banners.caption = { text: caption, t: -1.6, life: 6.5 };
      if (id === 'cistern' || id === 'pumpworks' || id === 'coop') this.queueHint('map');
    }

    if (id === HOME_REGION) {
      const healed = heal(this.player.health, this.player.health.max);
      if (healed > 0 && !defeat) this.toasts.push('Home. Patched up.', PAL.homeGlow);
      if (this.trip && !defeat && from !== null && from !== HOME_REGION) this.reportTrip();
      this.trip = null;
      if (this.save.pack.some((s) => ITEMS[s.item].category === 'material')) this.queueHint('deposit');
    } else if (from === HOME_REGION || !this.trip) {
      this.trip = { from: this.save.playTime, regions: [id], items: {}, xp: {}, defeated: 0, charter: charterDone(this.save) };
    } else if (!this.trip.regions.includes(id)) {
      this.trip.regions.push(id);
    }
    audio.music(region.music);
    this.save.region = id;
    this.persist();
  }

  private arrivalPoint(exit: string | null): { x: number; y: number } {
    const tile =
      (exit !== null ? this.map.arrivalTile(exit) : undefined) ??
      this.map.spawnOf('player') ??
      this.map.arrivalTile(this.map.exits[0]?.glyph ?? '1');
    if (!tile) throw new Error(`Region ${this.regionId} has no place to stand`);
    return { x: tile.col * TILE + TILE / 2, y: tile.row * TILE + TILE / 2 };
  }

  /** Re-apply anything flag-driven that changes how terrain looks. */
  private rebake(): void {
    const gateFlag = REGIONS[this.regionId].gateFlag;
    this.map.gateOpen = (gateFlag ? this.save.flags[gateFlag] === true : false) || this.eventGate;
    this.renderer.bake(this.map, { region: this.regionId, holesPatched: this.save.upgrades.includes('patchHoles'), generatorPipes: this.save.upgrades.includes('slimeGenerator') });
  }

  /** Lamps on the Cooperative walls, glows at exits, and the way home. */
  private findFixtures(): void {
    this.sconces = [];
    if (this.regionId === 'coop') {
      for (let row = 0; row < this.map.rows - 1; row++) {
        for (let col = 0; col < this.map.cols; col++) {
          const wall = this.map.kindAt(col, row) === 'wall';
          const open = this.map.kindAt(col, row + 1) === 'floor';
          if (wall && open && col % 5 === 2) this.sconces.push({ x: col * TILE + TILE / 2, y: row * TILE + 14 });
        }
      }
    }
    this.exitLights = this.map.exits.map((e) => ({ x: e.col * TILE + TILE / 2, y: e.row * TILE + TILE / 2 }));
    this.homeExit = null;
    if (this.regionId === HOME_REGION) return;
    // First hop of the shortest open route home.
    const open = (r: RegionId, glyph: string): boolean => {
      const def = REGIONS[r];
      if (!(def.gatedExits ?? []).includes(glyph)) return true;
      return def.gateFlag !== undefined && this.save.flags[def.gateFlag] === true;
    };
    const prev = new Map<RegionId, { from: RegionId; glyph: string }>();
    const queue: RegionId[] = [this.regionId];
    const seen = new Set<RegionId>(queue);
    while (queue.length) {
      const r = queue.shift()!;
      for (const [glyph, link] of Object.entries(REGIONS[r].exits)) {
        if (seen.has(link.to) || !open(r, glyph)) continue;
        seen.add(link.to);
        prev.set(link.to, { from: r, glyph });
        queue.push(link.to);
      }
    }
    let step = prev.get(HOME_REGION);
    while (step && step.from !== this.regionId) step = prev.get(step.from);
    const exit = step ? this.map.findExit(step.glyph) : undefined;
    if (exit) this.homeExit = { x: exit.col * TILE + TILE / 2, y: exit.row * TILE + TILE / 2 };
    void REGION_IDS;
  }

  // ---------------------------------------------------------------- update

  update(dt: number): void {
    this.time += dt;
    this.handleDebugKeys();
    this.feel.update(dt);
    this.toasts.update(dt);
    this.banners.update(dt);
    this.objectiveFlash = Math.max(0, this.objectiveFlash - dt);
    this.hudAlpha += ((this.hudCovering() ? 0.25 : 1) - this.hudAlpha) * damp(10, dt);
    this.spottedFx = Math.max(0, this.spottedFx - dt * 1.2);
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    this.packFullT = Math.max(0, this.packFullT - dt);
    this.bossFlash = Math.max(0, this.bossFlash - dt);
    this.updateHints();
    this.updateMusic(dt);

    if (this.transition) {
      this.updateTransition(dt);
      this.camera.follow(this.player.x, this.player.y, this.map, dt);
      this.ambience.update(dt, this.view());
      return;
    }

    if (this.overlays.length === 0 && this.pendingStamp) {
      this.pendingStamp = false;
      this.openStamp();
    } else if (this.overlays.length === 0 && this.pendingTrade) {
      this.pendingTrade = false;
      this.openTrade();
    }
    const top = this.overlays[this.overlays.length - 1];
    if (top) {
      top.update(dt, this.input);
      this.overlays = this.overlays.filter((o) => !o.done);
      if (top.pauses) {
        this.ambience.update(dt, this.view());
        this.camera.follow(this.player.x, this.player.y, this.map, dt);
        return;
      }
    }
    // Hit-stop: hold the frame for a beat.
    if (this.feel.hitstop > 0) return;

    switch (this.mode) {
      case 'asleep':
        this.updateAsleep(dt);
        break;
      case 'play':
        this.save.playTime += dt;
        this.regionTime += dt;
        this.updatePlay(dt);
        break;
      case 'down':
        this.save.playTime += dt;
        this.downT += dt;
        if (this.downT >= DOWN_TIME) {
          this.transition = { phase: 'out', t: 0, fade: DEFEAT_FADE_TIME, to: HOME_REGION, exit: null, defeat: true };
        }
        break;
    }

    if (this.mode !== 'asleep') {
      this.updateStealth();
      const p = this.player;
      this.scene.update(dt, { x: p.x, y: p.y, alive: this.mode === 'play', hidden: this.hidden, sneaking: p.sneaking, speed: Math.hypot(p.vx, p.vy) });
      this.watchCreatures();
      this.watchPeople();
      this.updateThrows(dt);
      this.updateEvents(dt);
      this.checkShift();
      this.checkProduction();
    }
    this.ambience.update(dt, this.view());
    this.camera.follow(this.player.x, this.player.y, this.map, dt);

    if (this.mode === 'play') {
      this.sinceSave += dt;
      if (this.sinceSave >= AUTOSAVE_EVERY) this.persist();
    }
    this.updateObjective();
  }

  private updateAsleep(dt: number): void {
    this.wakeT += dt;
    if (Math.random() < dt * 1.2) this.ambience.emit('mote', this.player.x + 6, this.player.y - 10);
    const pressed = this.input.hit('interact') || this.input.hit('roll') || this.input.wasMousePressed(0) || this.input.moveAxis().x !== 0 || this.input.moveAxis().y !== 0;
    if (this.wakeT < WAKE_TIME && !(this.wakeT > 1.2 && pressed)) return;
    this.mode = 'play';
    this.save.flags.wokeUp = true;
    this.queueHint('move');
    const bed = this.scene.objects.find((o) => o.id === 'bed');
    if (bed) this.player.place(bed.x + 18, bed.y + 8);
    this.feel.kick(1);
    this.scene.effects.burst(this.player.x, this.player.y, 6, FX.dust, 30);
    const region = REGIONS[this.regionId];
    this.banners.region = { name: region.name, subtitle: region.subtitle, t: 0 };
    this.toasts.push('Something was slipped in through the passage.', PAL.textDim);
    audio.sfx('uiSelect');
    this.persist();
  }

  private updatePlay(dt: number): void {
    const input = this.input;
    if (input.hit('pause') || input.wasPressed('KeyP')) {
      this.openPause();
      return;
    }
    if (input.hit('pack')) {
      this.hintDone('pack');
      this.openMenu('pack');
      return;
    }
    if (input.hit('map')) {
      this.hintDone('map');
      this.openMenu('map');
      return;
    }

    const p = this.player;
    const aimX = input.mouse.x + this.camera.x;
    const aimY = input.mouse.y + this.camera.y;
    const mode = this.launcherMode();
    const actions = p.update(dt, input, this.map, aimX, aimY, this.stats, mode.interval);
    if (Math.hypot(p.vx, p.vy) > 40 && this.banners.hint?.id !== 'move') this.hintDone('move');
    if (actions.fire) this.fire(mode, false);
    if (actions.charged) {
      this.fire(CHARGED_SHOT.mode, true);
      this.feel.kick(FEEL.shakeKill);
    }
    const ready = p.charge >= CHARGED_SHOT.chargeTime;
    if (ready && !this.chargeWasReady) audio.sfx('chargeReady');
    this.chargeWasReady = ready;
    if (actions.rolled) {
      const back = Math.atan2(-p.vy, -p.vx);
      this.scene.effects.spray(p.x, p.y + 3, back, 1.2, 6, FX.dust, 40);
      audio.sfx('roll');
      this.scene.noise(p.x, p.y, 40);
    }
    // Running is a little noisy. Sneaking isn't.
    this.runNoiseT -= dt;
    if (Math.hypot(p.vx, p.vy) > 80 && !p.sneaking && this.runNoiseT <= 0) {
      this.scene.noise(p.x, p.y, 26);
      this.runNoiseT = 0.45;
    }
    if (input.hit('eat')) this.eat();
    if (input.hit('throw')) this.throwSomething(aimX, aimY);
    if (p.health.hp <= p.health.max / 2 && pickFood(this.save, 1)) this.queueHint('eat');

    this.updateInteraction(dt);

    const exit = this.map.exitAt(p.tileCol, p.tileRow);
    const link = exit ? REGIONS[this.regionId].exits[exit.glyph] : undefined;
    if (link) {
      this.transition = { phase: 'out', t: 0, fade: FADE_TIME, to: link.to, exit: link.exit };
      audio.sfx('doorWhoosh');
    }
  }

  private updateTransition(dt: number): void {
    const tr = this.transition!;
    tr.t += dt;
    if (tr.t < tr.fade) return;
    if (tr.phase === 'in') {
      this.transition = null;
      return;
    }
    if (tr.defeat) {
      // Heal before arriving, so the receipt isn't buried under a "patched up" toast.
      heal(this.player.health, this.player.health.max);
      this.mode = 'play';
      this.overlays.push(new ReceiptOverlay(this.receipt, () => audio.sfx('page')));
    }
    this.enterRegion(tr.to, tr.exit, null, tr.defeat);
    this.transition = { ...tr, phase: 'in', t: 0, fade: FADE_TIME };
  }

  // ---------------------------------------------------------------- interaction

  private isInteractable(o: WorldObject): boolean {
    switch (o.kind) {
      case 'node':
        return !o.spent;
      case 'station':
        return this.regionId === HOME_REGION;
      case 'hole':
        return !this.save.upgrades.includes('patchHoles');
      case 'npc':
      case 'letter':
        return true;
      case 'post':
        return this.regionId === 'cistern' && !this.save.flags.sluiceOpen;
      case 'valve':
        return this.scene.boss?.active === true;
      default:
        return false;
    }
  }

  private findFocus(): WorldObject | null {
    let best: WorldObject | null = null;
    let bestScore = Infinity;
    const p = this.player;
    for (const o of this.scene.objects) {
      if (!this.isInteractable(o)) continue;
      const oy = o.kind === 'hole' ? (o.row + 1) * TILE + 8 : o.kind === 'post' ? o.y : o.y - 5;
      const range = o.kind === 'npc' ? 30 : o.kind === 'station' || o.kind === 'valve' ? 24 : o.kind === 'hole' ? 18 : INTERACT_RANGE;
      const d = Math.hypot(o.x - p.x, oy - p.y);
      if (d < range && d - range < bestScore) {
        best = o;
        bestScore = d - range;
      }
    }
    return best;
  }

  private promptFor(o: WorldObject): { verb: string; label: string } {
    switch (o.kind) {
      case 'node': {
        const def: NodeDef = NODES[o.id as NodeId];
        return { verb: def.verb, label: def.name };
      }
      case 'station':
        if (o.id === 'storage') return { verb: 'Open', label: 'Storage Crate' };
        if (o.id === 'slimeGenerator' && this.save.upgrades.includes('slimeGenerator')) return { verb: 'Feed', label: `the Generator (${this.save.charge}/${GENERATOR.capacity})` };
        return { verb: STATION_OF[o.id] && (o.id === 'pot' || this.save.upgrades.includes(o.id === 'workbench' ? 'repairWorkbench' : (o.id as UpgradeId))) ? 'Use' : 'Build at', label: STATION_TITLE[o.id] ?? o.label };
      case 'hole':
        return { verb: 'Patch', label: 'the holes' };
      case 'npc':
        return o.id === 'grubb' ? { verb: 'Talk to', label: 'Registrar Grubb' } : o.id === 'hatch' ? { verb: 'Talk to', label: 'Dorrit' } : { verb: 'Read', label: 'the Activity Board' };
      case 'letter':
        return { verb: 'Read', label: "Grubb's letter" };
      case 'post':
        return { verb: 'Turn', label: 'the sluice valve' };
      case 'valve':
        return { verb: 'Turn', label: 'the steam valve' };
      default:
        return { verb: 'Use', label: o.label };
    }
  }

  private lockReason(o: WorldObject): string | null {
    if (o.kind === 'node') {
      const req = (NODES[o.id as NodeId] as NodeDef).requires;
      if (req && skillLevel(this.save, req.skill) < req.level) return `Needs ${SKILLS[req.skill].name} ${req.level}`;
    }
    if (o.kind === 'post' && skillLevel(this.save, 'tinkering') < 3) return 'Needs Tinkering 3 to turn the valve';
    if (o.kind === 'valve' && this.scene.boss && !this.scene.boss.canTurn(o)) {
      return this.scene.boss.phase === 1 ? 'No pressure yet' : `Building pressure... ${Math.ceil(this.scene.boss.cooldownLeft(o))}s`;
    }
    return null;
  }

  private updateInteraction(dt: number): void {
    const focus = this.findFocus();
    if (focus !== this.holdOn) {
      this.holdT = 0;
      this.holdOn = null;
    }
    this.focus = focus;
    if (!focus) return;
    if (focus.kind === 'node') this.queueHint(focus.id === 'crate' ? 'smash' : 'search');
    const lock = this.lockReason(focus);
    if (focus.kind === 'node' && !lock) {
      const def: NodeDef = NODES[focus.id as NodeId];
      if (def.time > 0) {
        if (this.input.held('interact')) {
          const before = this.holdT;
          this.holdOn = focus;
          this.holdT += dt;
          focus.shake = 0.1;
          if (Math.floor(before * 5) !== Math.floor(this.holdT * 5)) audio.sfx('search', { pitch: 0.85 + this.holdT * 0.3 });
          if (this.holdT >= def.time) {
            this.useNode(focus);
            this.holdT = 0;
            this.holdOn = null;
          }
        } else {
          this.holdT = 0;
          this.holdOn = null;
        }
        return;
      }
    }
    if (!this.input.hit('interact')) return;
    if (lock) {
      audio.sfx('uiDenied');
      this.toasts.push(lock, PAL.danger);
      return;
    }
    this.interact(focus);
  }

  private interact(o: WorldObject): void {
    switch (o.kind) {
      case 'node':
        this.useNode(o);
        return;
      case 'station':
        this.openStation(o);
        return;
      case 'hole':
        this.openOverlay(new StationOverlay(this.save, 'Holes in the Wall', null, '+', this.stationHooks()));
        return;
      case 'npc':
        this.talk(o);
        return;
      case 'letter':
        this.readLetter();
        return;
      case 'post':
        this.turnValve();
        return;
      case 'valve':
        if (this.scene.boss?.turn(o)) {
          this.feel.kick(2.4);
          audio.sfx('valveTurn');
        }
        return;
      default:
        return;
    }
  }

  /** Search, smash, or harvest a node: pickups pop out and fly to the goblin. */
  private useNode(o: WorldObject): void {
    if (o.spent) return;
    const def: NodeDef = NODES[o.id as NodeId];
    const bonus = def.bonusSkill ? skillLevel(this.save, def.bonusSkill) >= BONUS_ITEM_LEVEL : false;
    const loot = rollYield(def, Math.random, bonus);
    o.spent = true;
    o.shake = 0.35;
    markSpent(this.save, o.key);
    this.hintDone(def.verb === 'Smash' ? 'smash' : 'search');
    for (const l of loot) {
      const pieces = Math.min(l.qty, 3);
      for (let i = 0; i < pieces; i++) this.scene.spawnPickup(l.item, i === pieces - 1 ? l.qty - (pieces - 1) : 1, o.x, o.y - 5);
    }
    const smash = def.verb === 'Smash';
    this.scene.effects.burst(o.x, o.y - 5, smash ? 14 : 8, smash ? FX.wood : FX.dust, smash ? 70 : 40, Math.random, 0.45);
    audio.sfx(smash ? 'crateBreak' : 'deposit');
    if (smash) this.feel.kick(1.2);
    if (def.noise) this.scene.noise(o.x, o.y, def.noise);
    this.gainXp(def.skill, def.xp);
    this.save.stats.searched++;
  }

  private openStation(o: WorldObject): void {
    if (o.id === 'storage') {
      this.depositAll();
      this.openOverlay(new StorageOverlay(this.save, {
        take: (id) => {
          const n = withdraw(this.save, id, ITEMS[id].stack);
          if (n > 0) {
            audio.sfx('pickup');
            this.toasts.item(id, n, ITEMS[id].name);
          } else {
            audio.sfx('packFull');
            this.toasts.push('No room in the pack.', PAL.danger);
          }
        },
        deposit: () => this.depositAll(),
        sound: (id) => audio.sfx(id),
      }));
      return;
    }
    if (o.id === 'slimeGenerator' && this.save.upgrades.includes('slimeGenerator')) {
      this.openOverlay(new GeneratorOverlay(this.save, {
        feed: (gels) => this.feed(gels, o),
        sound: (id) => audio.sfx(id),
      }));
      return;
    }
    const station = STATION_OF[o.id] ?? null;
    if (station && PRODUCTION.includes(station as ProductionStation)) this.collectFrom(station as ProductionStation);
    this.openOverlay(new StationOverlay(this.save, STATION_TITLE[o.id] ?? o.label, station, o.glyph, this.stationHooks()));
  }

  /** Pour gel into the generator. The first charge switches it on: a Charter step. */
  private feed(gels: number, o: WorldObject): void {
    const before = charterDone(this.save);
    const added = feedGenerator(this.save, gels, true);
    if (added <= 0) {
      audio.sfx('uiDenied');
      return;
    }
    audio.sfx('generatorHum');
    this.scene.effects.burst(o.x, o.y - 14, 10, FX.gel, 40, Math.random, 0.5);
    this.toasts.push(`+${added} charge (${this.save.charge}/${GENERATOR.capacity})`, '#a8f8a0');
    this.checkCharter(before);
    this.persist();
  }

  private depositAll(): void {
    const moved = quickDeposit(this.save);
    const n = Object.values(moved).reduce((a, b) => a + (b ?? 0), 0);
    if (n > 0) {
      audio.sfx('deposit');
      this.toasts.push(`Stored ${n} material${n === 1 ? '' : 's'}.`, PAL.homeGlow);
      this.persist();
    }
  }

  private collectFrom(station: ProductionStation): void {
    for (const got of collect(this.save, station)) {
      this.toasts.item(got.item, got.qty, ITEMS[got.item].name);
      this.gainXp(got.xp.skill, got.xp.amount);
      audio.sfx('pickup');
    }
  }

  private stationHooks(): ConstructorParameters<typeof StationOverlay>[4] {
    return {
      craft: (id: RecipeId) => {
        const before = charterDone(this.save);
        const res = craft(this.save, id, true);
        if (!res) return;
        audio.sfx('craft');
        this.toasts.item(res.item, res.qty, ITEMS[res.item].name);
        // A first launcher mod goes straight on: making one and then hunting for it in the pack is no fun.
        if (MOD_MODES[res.item] && !this.save.equippedMod) {
          this.save.equippedMod = res.item;
          this.toasts.push(`Equipped ${ITEMS[res.item].name}. Swap mods in the pack.`, PAL.homeGlow);
        }
        this.gainXp(res.xp.skill, res.xp.amount);
        this.checkCharter(before);
        this.persist();
      },
      plant: (station: ProductionStation, id: RecipeId) => {
        if (!startJob(this.save, station, id, true)) return;
        const r: RecipeDef = RECIPES[id];
        audio.sfx('plant');
        // Queued jobs wait their turn, so say when this one will really be done.
        const left = Math.max(0, (jobsAt(this.save, station).at(-1)?.end ?? this.save.playTime) - this.save.playTime);
        const when = left < 90 ? `${Math.ceil(left)}s` : `${Math.ceil(left / 60)} min`;
        this.toasts.push(`${r.name}: ready in ${when} of play.`, PAL.homeGlow);
        this.persist();
      },
      build: (id: UpgradeId) => this.buildUpgrade(id),
      track: (t) => {
        this.save.tracked = t;
        this.persist();
      },
      sound: (id) => audio.sfx(id),
    };
  }

  private buildUpgrade(id: UpgradeId): void {
    const before = charterDone(this.save);
    const xp = build(this.save, id, true);
    if (!xp) return;
    if (this.save.tracked?.kind === 'upgrade' && this.save.tracked.id === id) this.save.tracked = null;
    this.rebake();
    audio.sfx('build');
    this.feel.kick(2);
    const spot = UPGRADES[id].spot;
    for (const o of this.scene.objects) {
      if (o.glyph !== spot) continue;
      this.scene.effects.burst(o.x, o.y - 6, 16, FX.dust, 60, Math.random, 0.6);
      this.scene.effects.burst(o.x, o.y - 6, 8, FX.spark, 50, Math.random, 0.5);
    }
    // Close the menu so the change is seen.
    for (const ov of this.overlays) ov.done = true;
    this.overlays = [];
    this.banners.big('BUILT', UPGRADES[id].name, PAL.homeGlow, UPGRADES[id].desc, 2.6);
    this.gainXp(xp.skill, xp.amount);
    this.checkCharter(before);
    this.persist();
  }

  /** A finished Charter step gets its own moment. */
  private checkCharter(before: readonly boolean[]): void {
    const now = charterDone(this.save);
    const fresh = CHAPTER_1.steps.filter((_, i) => now[i] && !before[i]);
    if (fresh.length === 0) return;
    const done = now.filter(Boolean).length;
    for (const step of fresh) this.banners.big('CHARTER STEP COMPLETE', step.title, '#8ae05a', `${done} of ${now.length} toward Stamp #1`, 3.6);
    audio.sfx('stepDone');
  }

  private talk(o: WorldObject): void {
    let script: Script;
    if (o.id === 'grubb') {
      if (!this.save.flags.metGrubb) script = GRUBB_FIRST;
      else {
        const { done, total } = charterProgress(this.save);
        const order = ORDERS.coopOrder1;
        script = grubbChat({
          stepsLeft: total - done,
          nextStep: nextCharterStep(this.save)?.title ?? null,
          visit: this.save.grubbVisits++,
          orderReady: canAfford(this.save, order.items, true),
          fromCrate: !canAfford(this.save, order.items, false),
          orderDone: this.save.flags[order.flag] === true,
          stamped: this.save.flags.charterStamp1 === true,
          occupancy: this.save.occupancy,
          nextPayment: Math.min(OCCUPANCY_STEP, RETIREMENT_LEDGER.occupancyPrice - this.save.occupancy, this.save.buttons),
        });
      }
    } else if (o.id === 'hatch') {
      if (this.save.flags.hatchOpen) {
        this.openTrade();
        return;
      }
      script = this.save.flags.metGrubb ? DORRIT_OPEN : this.save.flags.metDorrit ? DORRIT_LATER : DORRIT_FIRST;
    } else {
      this.openBoard();
      return;
    }
    this.openOverlay(new DialogueOverlay(script, {
      effect: (e) => this.applyEffect(e),
      blip: (pitch) => audio.sfx('blip', { pitch, vary: 0.06 }),
      select: () => audio.sfx('uiSelect'),
    }));
  }

  private applyEffect(e: DialogueEffect): void {
    switch (e) {
      case 'metGrubb':
        this.save.flags.metGrubb = true;
        break;
      case 'metDorrit':
        this.save.flags.metDorrit = true;
        break;
      case 'openShortcut':
        if (this.save.flags.coopShortcutOpen) break;
        this.save.flags.coopShortcutOpen = true;
        this.rebake();
        this.findFixtures();
        audio.sfx('doorWhoosh');
        this.toasts.push("Grubb's back pipe is open: a shortcut home.", PAL.homeGlow);
        break;
      case 'openHatch':
        this.save.flags.hatchOpen = true;
        this.save.flags.metDorrit = true;
        this.pendingTrade = true;
        break;
      case 'deliverOrder': {
        const order = ORDERS.coopOrder1;
        if (this.save.flags[order.flag] || !pay(this.save, order.items, true)) break;
        const before = charterDone(this.save);
        this.save.flags[order.flag] = true;
        this.save.buttons += order.rewardButtons;
        audio.sfx('coins');
        this.toasts.push(`+${order.rewardButtons} Brass Buttons`, '#f0d070');
        this.checkCharter(before);
        break;
      }
      case 'stamp':
        this.pendingStamp = true;
        break;
      case 'payOccupancy': {
        const paid = payOccupancy(this.save);
        if (paid <= 0) break;
        audio.sfx('coins');
        this.toasts.push(`Paid ${paid} buttons. Occupancy: ${this.save.occupancy}/${RETIREMENT_LEDGER.occupancyPrice}`, '#f0d070');
        if (this.save.flags.occupancyPaid) {
          this.banners.big('OCCUPANCY RIGHTS', 'Paid in full', '#f0d070', 'The alcove is yours. Retirement: optional.', 4.5);
          audio.sfx('stepDone');
        }
        break;
      }
    }
    this.persist();
  }

  private openTrade(): void {
    audio.sfx('page');
    this.openOverlay(new TradeOverlay(this.save, {
      sell: (item) => {
        const price = sellOne(this.save, item);
        if (price === null) return;
        audio.sfx(price > 1 ? 'coins' : 'pickup');
        this.toasts.push(`Sold ${ITEMS[item].name}: +${price}`, '#f0d070');
        this.persist();
      },
      buy: (entry) => {
        if (!buy(this.save, entry)) {
          audio.sfx('uiDenied');
          return;
        }
        audio.sfx('coins');
        this.toasts.push(`Bought: ${shopName(entry)}`, PAL.homeGlow);
        if (entry.kind === 'decor') this.toasts.push('Dorrit will have it carried to the Burrow.', PAL.textDim);
        this.persist();
      },
      sound: (id) => audio.sfx(id),
    }));
  }

  /** Grubb stamps the Charter: Chapter One is done, and free play carries on. */
  private openStamp(): void {
    if (this.save.flags.charterStamp1) return;
    audio.sfx('page');
    this.openOverlay(new StampOverlay(
      CHAPTER_1.steps.map((s) => s.title),
      () => {
        this.save.flags.charterStamp1 = true;
        this.feel.kick(4);
        audio.sfx('stamp');
        this.persist();
      },
      () => {
        audio.sfx('levelUp');
        this.banners.big('CHAPTER ONE COMPLETE', 'A Recognized Workshop', '#8ae05a', 'Free play: keep building. Occupancy rights cost 600 buttons.', 5);
        this.persist();
      },
    ));
  }

  private openBoard(): void {
    const ev = currentEvent(this.save);
    const shift = shiftIndex(this.save.playTime);
    this.openOverlay(new BoardOverlay({
      current: { id: ev.id, done: ev.status === 'done', startsIn: storyGated(this.save, ev.id) ? 0 : ev.startsAt - this.save.playTime },
      next: eventForShift(shift + 1),
      bellIn: (shift + 1) * SHIFT_SECONDS - this.save.playTime,
      surveyWithdrawn: this.save.flags.charterStamp1 === true,
    }));
    audio.sfx('page');
  }

  private readLetter(): void {
    audio.sfx('page');
    this.openOverlay(new LetterOverlay(() => {
      audio.sfx('page');
      if (this.save.flags.readGrubbsLetter) return;
      this.save.flags.readGrubbsLetter = true;
      this.queueHint('move');
      this.persist();
    }));
  }

  private turnValve(): void {
    this.save.flags.sluiceOpen = true;
    this.rebake();
    this.findFixtures();
    audio.sfx('steam');
    audio.sfx('build');
    this.feel.kick(1.5);
    this.toasts.push('The valve wheel turns. The sluice stays open for good.', PAL.homeGlow);
    this.gainXp('tinkering', 20);
    this.persist();
  }

  private openOverlay(o: Overlay): void {
    this.overlays.push(o);
    this.holdT = 0;
  }

  private openMenu(page: MenuPage): void {
    audio.sfx('uiSelect');
    this.openOverlay(new MenuOverlay(this.save, this.regionId, {
      eat: (id) => this.eat(id),
      equip: (id) => {
        this.save.equippedMod = id;
        audio.sfx('uiSelect');
        this.toasts.push(id ? `Equipped ${ITEMS[id].name}.` : 'Back to plain scrap.', PAL.homeGlow);
      },
      ready: (id) => {
        this.save.readyThrow = id;
        audio.sfx('uiSelect');
        this.toasts.push(id ? `Throwing ${ITEMS[id].name} first.` : 'Throwing bottles, then pebbles.', PAL.homeGlow);
      },
      drop: (slot) => {
        const stack = this.save.pack[slot];
        if (!stack) return;
        this.save.pack.splice(slot, 1);
        const name = ITEMS[stack.item].name;
        if (this.regionId === HOME_REGION) {
          addToStorage(this.save, stack.item, stack.qty);
          audio.sfx('deposit');
          this.toasts.push(`Put ${stack.qty} ${name} in the crate.`, PAL.homeGlow);
        } else {
          this.scene.placePickup(stack.item, stack.qty, this.player.x, this.player.y + 4, true);
          audio.sfx('deposit', { pitch: 0.8 });
          this.toasts.push(`Dropped ${stack.qty} ${name}. It stays here until the bell.`, PAL.textDim);
        }
        this.persist();
      },
      sound: (id) => audio.sfx(id),
    }, page));
  }

  private openPause(): void {
    audio.sfx('uiSelect');
    this.openOverlay(new PauseOverlay({
      resume: () => {},
      quitToTitle: () => {
        this.persist();
        this.hooks.quit();
      },
      resetSave: () => {
        clearSave();
        this.hooks.reset();
      },
      settingsChanged: () => audio.applyVolumes(),
      sound: (id) => audio.sfx(id),
    }));
  }

  // ---------------------------------------------------------------- pack and food

  private pickup(item: ItemId, qty: number): number {
    const before = charterDone(this.save);
    const n = addToPack(this.save, item, qty);
    const prize = BOSS_PRIZES.find((p) => p.item === item);
    if (prize && n > 0 && !this.save.flags[prize.flag]) {
      this.save.flags[prize.flag] = true;
      this.checkCharter(before);
      this.persist();
    }
    if (item === 'stinkbrew' && n > 0) this.queueHint('stink');
    if (n > 0) {
      this.toasts.item(item, n, ITEMS[item].name);
      audio.sfx('pickup', { pitch: 1 + Math.random() * 0.15 });
      if (this.trip) this.trip.items[item] = (this.trip.items[item] ?? 0) + n;
      this.queueHint('pack');
    }
    if (n < qty && this.packFullT <= 0) {
      this.packFullT = 2.5;
      audio.sfx('packFull');
      const fix = this.regionId === HOME_REGION ? 'Put materials in the crate.' : `Drop something (${actionLabel('pack')}), or head home.`;
      this.toasts.push(`No room for ${ITEMS[item].name}. ${fix}`, PAL.danger);
    }
    return n;
  }

  private eat(choice?: ItemId): void {
    const h = this.player.health;
    const missing = h.max - h.hp;
    if (missing <= 0) {
      this.toasts.push('Not hungry. Well, not hurt.', PAL.textDim);
      return;
    }
    const food = choice ?? pickFood(this.save, missing);
    if (!food || packCount(this.save, food) === 0) {
      audio.sfx('uiDenied');
      this.toasts.push('Nothing to eat.', PAL.textDim);
      return;
    }
    removeFromPack(this.save, food, 1);
    heal(h, (ITEMS[food] as ItemDef).heal ?? 0);
    this.hintDone('eat');
    audio.sfx('eat');
    this.scene.effects.burst(this.player.x, this.player.y - 6, 8, FX.gel, 30);
    this.toasts.push(`Ate the ${ITEMS[food].name}.`, PAL.goblin);
  }

  /** What F throws: the throwable picked in the pack if you have one, else a bottle, else a free pebble. */
  private throwable(): 'pebble' | 'bottle' | 'stinkbrew' {
    const ready = this.save.readyThrow;
    if ((ready === 'stinkbrew' || ready === 'bottle') && packCount(this.save, ready) > 0) return ready;
    return packCount(this.save, 'bottle') > 0 ? 'bottle' : 'pebble';
  }

  private throwSomething(aimX: number, aimY: number): void {
    const p = this.player;
    const kind = this.throwable();
    if (kind !== 'pebble') removeFromPack(this.save, kind, 1);
    this.hintDone('throw');
    const dx = aimX - p.x;
    const dy = aimY - p.y;
    const d = Math.hypot(dx, dy) || 1;
    let r = Math.min(d, THROW_RANGE);
    // Stop short of walls.
    while (r > 8 && !lineOfSight(this.map, p.x, p.y - 4, p.x + (dx / d) * r, p.y + (dy / d) * r)) r -= 6;
    this.throws.push({ kind, x0: p.x, y0: p.y - 6, x1: p.x + (dx / d) * r, y1: p.y + (dy / d) * r, t: 0, dur: 0.22 + r / 420 });
    audio.sfx('throw');
  }

  private updateThrows(dt: number): void {
    for (const t of this.throws) {
      t.t += dt;
      if (t.t < t.dur) continue;
      if (t.kind === 'stinkbrew') {
        this.scene.addCloud(t.x1, t.y1);
        this.scene.noise(t.x1, t.y1, 70);
        this.scene.effects.burst(t.x1, t.y1, 14, '#a8c060', 50);
        this.play('bottleSmash', t.x1, t.y1);
        continue;
      }
      const big = t.kind === 'bottle';
      this.scene.noise(t.x1, t.y1, big ? 130 : 60);
      this.scene.effects.burst(t.x1, t.y1, big ? 10 : 4, big ? '#a8e0c8' : FX.dust, big ? 60 : 30);
      this.play(big ? 'bottleSmash' : 'pebble', t.x1, t.y1);
    }
    this.throws = this.throws.filter((t) => t.t < t.dur);
  }

  // ---------------------------------------------------------------- stealth, creatures, people

  private updateStealth(): void {
    const k = this.map.kindAt(this.player.tileCol, this.player.tileRow);
    const cover = (k === 'hide' || k === 'crawl') && this.mode === 'play';
    if (!cover) this.hidden = false;
    else if (!this.wasCover) {
      // Slipping into cover only hides you if nobody saw you go in.
      const g = this.scene.goblin;
      g.x = this.player.x;
      g.y = this.player.y;
      g.alive = true;
      g.hidden = false;
      this.hidden = !this.scene.humans.some((h) => !h.gone && h.canSee(this.scene));
      if (this.hidden && k === 'hide') audio.sfx('search', { pitch: 0.6 });
    }
    this.wasCover = cover;
  }

  private watchCreatures(): void {
    for (const c of this.scene.creatures) {
      const prev = this.creatureStates.get(c);
      if (prev !== c.state) {
        if (c.state === 'windup') {
          const s = WINDUP_SOUND[c.def.behavior];
          if (s) this.play(s, c.x, c.y);
        }
        if ((prev === 'idle' || prev === 'return') && c.state === 'approach') this.queueHint('fight');
        this.creatureStates.set(c, c.state);
      }
    }
  }

  private watchPeople(): void {
    for (const h of this.scene.humans) {
      if (h.awareness === 'suspicious' && !h.gone) this.queueHint('throw');
    }
  }

  private updateEvents(dt: number): void {
    if (this.live) {
      this.live.update(dt);
      if (!this.live.live) this.live = null;
    }
    if (this.mode !== 'play' || this.live) return;
    const ev = currentEvent(this.save);
    if (ev.status !== 'pending') return;
    const def = EVENTS[ev.id];
    if (storyGated(this.save, ev.id)) {
      // The first contract always happens in front of you: it's the stealth lesson.
      if (this.regionId !== def.region) return;
      const col = Math.floor(this.player.x / TILE);
      const row = Math.floor(this.player.y / TILE);
      const near = Math.hypot(col - def.zone.col, row - def.zone.row) <= def.zone.r + STORY_CONTRACT_NEAR;
      if (this.regionTime >= STORY_CONTRACT_DELAY || near) this.startLive(ev.id);
      return;
    }
    if (this.save.playTime < ev.startsAt) return;
    if (this.regionId === def.region) this.startLive(ev.id);
    else resolveOffscreen(this.save, ev.id);
  }

  private startLive(id: EventId): void {
    this.live = new LiveEvent(id, this.save, this.scene, {
      warn: (text) => {
        this.banners.warning = { text, t: 0, life: 6.5 };
        audio.sfx('footsteps');
        this.queueHint('sneak');
      },
      gate: (open) => {
        if (this.eventGate === open) return;
        this.eventGate = open;
        this.rebake();
        audio.sfx('doorWhoosh');
        this.toasts.push(open ? 'Somewhere, the sluice gate grinds open.' : 'The sluice gate slams shut.', PAL.textDim);
      },
      leftovers: (nodes) => {
        for (const n of nodes) if (n.region === this.regionId) this.scene.addEventNode(n.node, n.col, n.row, n.key);
      },
    });
  }

  private checkShift(): void {
    const shift = shiftIndex(this.save.playTime);
    if (shift === this.lastShift) return;
    this.lastShift = shift;
    audio.sfx('shiftBell');
    this.banners.big('THE SHIFT BELL', 'A new shift begins', PAL.textDim, 'Piles refill. Creatures stir. New contracts go up.', 3.4);
    pruneSpent(this.save);
    pruneEventNodes(this.save);
    // The floors of other regions get swept. Whatever's here, in front of you, can stay.
    this.save.floor = this.save.floor.filter((f) => f.shift === shift);
    for (const o of this.scene.objects) if (o.kind === 'node') o.spent = isSpent(this.save, o.key);
  }

  private checkProduction(): void {
    for (const s of PRODUCTION) {
      for (const j of jobsAt(this.save, s)) {
        if (this.save.playTime < j.end) continue;
        const key = `${s}:${j.end}`;
        if (this.notified.has(key)) continue;
        this.notified.add(key);
        const r: RecipeDef = RECIPES[j.recipe];
        this.toasts.push(`${r.name}: ready${this.regionId === HOME_REGION ? '' : ' in the Burrow'}.`, PAL.homeGlow, r.output.item);
        audio.sfx('stepDone');
      }
    }
  }

  private updateMusic(dt: number): void {
    if (!this.scene) return;
    const danger = this.scene.humans.some((h) => h.awareness === 'hostile' && !h.gone && h.task !== 'flee') || this.scene.boss?.active === true;
    this.dangerT = danger ? 3 : Math.max(0, this.dangerT - dt);
    const track: TrackId = this.dangerT > 0 ? 'danger' : REGIONS[this.regionId].music;
    audio.music(track);
    audio.layer = this.regionId === HOME_REGION ? Math.min(3, Math.floor(coziness(this.save) * 4)) : 0;
  }

  private updateObjective(): void {
    const text = currentObjective(this.save).text;
    if (text === this.lastObjective) return;
    this.lastObjective = text;
    this.objectiveFlash = 1.4;
    audio.sfx('uiSelect');
  }

  private queueHint(id: HintId): void {
    if (this.save.hints.includes(id) || this.hintQueue.includes(id)) return;
    if (!URGENT_HINTS.includes(id)) {
      this.hintQueue.push(id);
      return;
    }
    // About what's happening right now: to the front of the line, and whatever's showing makes way.
    this.hintQueue.unshift(id);
    const shown = this.banners.hint;
    if (shown && !URGENT_HINTS.includes(shown.id) && shown.t > 0.8) shown.life = Math.min(shown.life, shown.t + 0.3);
  }

  /** The goblin just did what a hint explains, so it needn't come up any more. */
  private hintDone(id: HintId): void {
    const i = this.hintQueue.indexOf(id);
    if (i >= 0) this.hintQueue.splice(i, 1);
    if (!this.save.hints.includes(id)) this.save.hints.push(id);
  }

  private updateHints(): void {
    // A hint that's been read gives way to the next one, which is usually about what you're doing now.
    const shown = this.banners.hint;
    if (shown && this.hintQueue.length > 0 && shown.t > 3) shown.life = Math.min(shown.life, shown.t + 0.5);
    if (this.banners.hint || this.hintQueue.length === 0 || this.overlays.length > 0 || this.mode !== 'play') return;
    const id = this.hintQueue.shift()!;
    this.banners.hint = { id, t: 0, life: 7 };
    this.save.hints.push(id);
  }

  // ---------------------------------------------------------------- combat

  private launcherMode(): LauncherMode {
    const equipped = this.save.equippedMod ? MOD_MODES[this.save.equippedMod] : undefined;
    return LAUNCHER_MODES[this.debugMode ?? equipped ?? 'basic'];
  }

  private fire(mode: LauncherMode, charged: boolean): void {
    const p = this.player;
    const ox = p.x + Math.cos(p.aim) * 8;
    const oy = p.y - 2 + Math.sin(p.aim) * 8;
    // Hugging a wall: the shot breaks on it instead of passing through.
    if (!lineOfSight(this.map, p.x, p.y - 2, ox, oy)) {
      this.scene.effects.burst(ox, oy, 3, FX.dust, 30);
      return;
    }
    for (let i = 0; i < mode.count; i++) {
      const spread = mode.count > 1 ? (i / (mode.count - 1) - 0.5) * ((mode.spreadDeg * Math.PI) / 180) : 0;
      const a = p.aim + spread;
      this.scene.spawnProjectile({
        kind: mode.shot, owner: 'player', x: ox, y: oy,
        vx: Math.cos(a) * mode.speed, vy: Math.sin(a) * mode.speed,
        travelled: 0, range: mode.range, radius: mode.radius ?? 2, damage: mode.damage, knockback: mode.knockback, slow: mode.slow, dead: false,
      });
    }
    this.scene.effects.spray(ox, oy, p.aim, 0.9, 3, FX.spark, 60, Math.random, 0.12);
    this.muzzleT = 0.06;
    audio.sfx(charged ? 'chargedShot' : 'shoot');
    this.scene.noise(p.x, p.y, charged ? 95 : 65);
  }

  private hurtPlayer(damage: number, fromX: number, fromY: number): boolean {
    if (this.mode !== 'play') return false;
    if (!this.player.hurt(damage, fromX, fromY)) return false;
    this.feel.freeze(FEEL.hitstopHurt);
    if (settings.shake) this.feel.kick(FEEL.shakeHurt);
    this.feel.hurt = 1;
    this.scene.effects.burst(this.player.x, this.player.y - 2, 8, FX.hurt, 60);
    audio.sfx('hurt');
    if (!this.player.alive) {
      this.mode = 'down';
      this.downT = 0;
      audio.sfx('down');
      this.receipt = retrievalReceipt(takeDefeatFee(this.save));
      this.save.stats.defeats++;
      this.trip = null;
      this.banners.warning = null;
    }
    return true;
  }

  private onKill(c: Creature, byPlayer: boolean): void {
    if (c.placementKey) markSpent(this.save, c.placementKey);
    if (c.def.boss) this.onBossDefeated(c);
    for (const d of c.def.drops) {
      if (Math.random() >= d.chance) continue;
      const qty = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
      if (qty > 0) this.scene.spawnPickup(d.item, qty, c.x, c.y);
    }
    this.play('kill', c.x, c.y);
    if (!byPlayer) return;
    this.gainXp('scrapping', c.def.xp);
    this.save.stats.defeated++;
    if (this.trip) this.trip.defeated++;
    this.feel.freeze(FEEL.hitstopKill);
    this.feel.kick(FEEL.shakeKill);
  }

  private gainXp(skill: SkillId, amount: number): void {
    const before = levelForXp(this.save.skillXp[skill] ?? 0);
    this.save.skillXp[skill] = (this.save.skillXp[skill] ?? 0) + amount;
    if (this.trip) this.trip.xp[skill] = (this.trip.xp[skill] ?? 0) + amount;
    const after = levelForXp(this.save.skillXp[skill] ?? 0);
    if (after <= before) return;
    const def = SKILLS[skill];
    const unlocks = def.milestones.filter((m) => m.level > before && m.level <= after).map((m) => m.text);
    this.banners.big('LEVEL UP', `${def.name} ${after}`, PAL.warn, unlocks.length ? `Unlocked: ${unlocks.join(' · ')}` : 'Practice makes adequate.', 3);
    audio.sfx('levelUp');
    this.applyStats();
  }

  /** Recompute skill-driven stats. A bigger heart total arrives filled. */
  private applyStats(): void {
    const oldMax = this.stats.maxHp;
    this.stats = playerStats(this.save);
    setMax(this.player.health, this.stats.maxHp);
    if (this.stats.maxHp > oldMax) heal(this.player.health, this.stats.maxHp - oldMax);
  }

  private reportTrip(): void {
    const trip = this.trip;
    if (!trip) return;
    const now = charterDone(this.save);
    const steps = CHAPTER_1.steps.filter((_, i) => now[i] && !trip.charter[i]).map((s) => s.title);
    const any = Object.values(trip.items).some((n) => (n ?? 0) > 0) || trip.defeated > 0 || steps.length > 0;
    if (!any) return;
    const report: TripReport = {
      regions: trip.regions,
      steps,
      seconds: this.save.playTime - trip.from,
      items: trip.items,
      xp: trip.xp,
      defeated: trip.defeated,
      progress: this.progressLine(),
    };
    this.overlays.push(new SummaryOverlay(report, () => audio.sfx('uiSelect')));
  }

  /** What the haul counts toward: the tracked thing, or the next Charter build. */
  private progressLine(): TripReport['progress'] {
    let name: string | null = null;
    let cost: ItemBag | null = null;
    const t = this.save.tracked;
    if (t?.kind === 'recipe') {
      const r: RecipeDef = RECIPES[t.id];
      name = r.name;
      cost = r.inputs;
    } else if (t?.kind === 'upgrade') {
      name = UPGRADES[t.id].name;
      cost = UPGRADES[t.id].cost;
    } else {
      const step = nextCharterStep(this.save);
      if (step?.check.kind === 'upgrade') {
        name = UPGRADES[step.check.id].name;
        cost = UPGRADES[step.check.id].cost;
      }
    }
    if (!name || !cost) return null;
    const parts = (Object.keys(cost) as ItemId[]).map((item) => ({ item, have: haveCount(this.save, item, true), need: cost[item] ?? 0 }));
    return { label: name, parts };
  }

  // ---------------------------------------------------------------- the Pump Matron

  private onBoss(kind: BossEventKind, x: number, y: number): void {
    const boss = this.scene.boss;
    switch (kind) {
      case 'start':
        this.save.flags.matronSeen = true;
        this.banners.big('THE PUMP MATRON', 'Mother of all Scrapbacks', '#e05030', 'Her front is armored. Her back is not.', 3.6);
        this.banners.caption = { text: BOSS_LINES.start, t: 0, life: 5 };
        audio.sfx('matronRoar');
        this.feel.kick(3);
        this.queueHint('armor');
        break;
      case 'phase2':
        this.banners.caption = { text: BOSS_LINES.phase2, t: 0, life: 5 };
        audio.sfx('steam');
        this.feel.kick(2);
        this.queueHint('valve');
        // Show the hint now: it's the trick to the fight.
        if (this.banners.hint) this.banners.hint.life = Math.min(this.banners.hint.life, this.banners.hint.t + 0.2);
        break;
      case 'add':
        this.play('miteClick', x, y);
        this.scene.effects.burst(x, y - 4, 8, FX.dust, 40);
        break;
      case 'steam':
        this.play('steam', x, y);
        this.scene.effects.burst(x, y + 20, 18, '#f0f4f0', 80, Math.random, 0.7);
        break;
      case 'flipped':
        this.play('clank', x, y);
        this.play('matronRoar', x, y);
        this.feel.kick(3);
        this.bossFlash = 0.3;
        if (boss) this.scene.effects.number(boss.boss.x, boss.boss.y - boss.boss.radius - 8, 'FLIPPED!', '#f0d070');
        break;
    }
  }

  /** The flywheel rolls loose, the drain gate opens, and the sluice runs free for good. */
  private onBossDefeated(c: Creature): void {
    const flag = c.def.boss!.flag;
    if (this.save.flags[flag]) return;
    this.save.flags[flag] = true;
    this.save.flags.sluiceOpen = true;
    this.rebake();
    this.findFixtures();
    this.feel.freeze(0.25);
    this.feel.kick(5);
    audio.sfx('matronRoar');
    audio.sfx('build');
    this.scene.effects.burst(c.x, c.y, 30, '#c87533', 90, Math.random, 0.8);
    this.scene.effects.burst(c.x, c.y, 20, FX.spark, 70, Math.random, 0.6);
    this.banners.big('DEFEATED', 'The Pump Matron', '#f0d070', 'The drain gate is open: a shortcut back to the Cistern.', 4);
    this.banners.caption = { text: BOSS_LINES.defeated, t: 0, life: 5 };
    this.persist();
  }

  // ---------------------------------------------------------------- sound

  private play(id: SceneSound | SfxId, x: number, y: number): void {
    const cx = this.camera.x + VIEW_W / 2;
    const cy = this.camera.y + VIEW_H / 2;
    if (Math.hypot(x - cx, y - cy) > HEARING) return;
    audio.sfx(id as SfxId);
  }

  private ambientSound(s: AmbientSound, x: number, y: number): void {
    const id: SfxId = s === 'drip' ? 'drip' : s === 'clatter' ? 'wallHit' : 'steam';
    const cx = this.camera.x + VIEW_W / 2;
    const cy = this.camera.y + VIEW_H / 2;
    if (Math.hypot(x - cx, y - cy) > VIEW_W * 0.6) return;
    audio.sfx(id, { pitch: s === 'clatter' ? 0.5 : 1, vary: 0.3 });
  }

  // ---------------------------------------------------------------- debug and saving

  private handleDebugKeys(): void {
    if (this.input.wasPressed('F3')) this.debug = !this.debug;
    if (!this.debug) return;
    // Toggle this region's gate flag, to test shortcuts before their unlocks exist.
    if (this.input.wasPressed('KeyG')) {
      const flag = REGIONS[this.regionId].gateFlag;
      if (flag) {
        this.save.flags[flag] = !this.save.flags[flag];
        this.rebake();
      }
    }
    // Skip to the next shift: everything defeated comes back.
    if (this.input.wasPressed('KeyN')) {
      this.save.playTime = (shiftIndex(this.save.playTime) + 1) * SHIFT_SECONDS;
      pruneSpent(this.save);
      this.scene = new Scene(this.regionId, this.map, this.save, this.sceneEvents);
      this.live = null;
    }
    if (this.input.wasPressed('KeyH')) heal(this.player.health, this.player.health.max);
    if (this.input.wasPressed('KeyT')) {
      const current = LAUNCHER_MODE_IDS.indexOf(this.debugMode ?? 'basic');
      this.debugMode = LAUNCHER_MODE_IDS[(current + 1) % LAUNCHER_MODE_IDS.length] ?? 'basic';
      this.toasts.push(`Launcher: ${LAUNCHER_MODES[this.debugMode].name}`, PAL.textDim);
    }
    // A kit of raw materials in storage, for trying out building.
    if (this.input.wasPressed('KeyK')) {
      for (const id of ITEM_IDS) if (ITEMS[id].category === 'material') this.save.storage[id] = (this.save.storage[id] ?? 0) + 10;
      this.toasts.push('Debug: +10 of every material in storage.', PAL.textDim);
    }
    // Start this shift's event here and now, if it belongs to this region.
    if (this.input.wasPressed('KeyV') && !this.live) {
      const ev = currentEvent(this.save);
      if (EVENTS[ev.id].region === this.regionId) {
        this.save.event = { shift: ev.shift, status: 'pending' };
        this.startLive(ev.id);
      } else this.toasts.push(`Debug: this shift's event is in ${REGIONS[EVENTS[ev.id].region].name}.`, PAL.textDim);
    }
  }

  /** Remember what's lying on this region's floor, so it's still there after a trip or a reload (until the bell). */
  private stashFloor(): void {
    const shift = shiftIndex(this.save.playTime);
    this.save.floor = this.save.floor.filter((f) => f.region !== this.regionId);
    for (const p of this.scene.pickups) {
      if (!p.dead && p.qty > 0) this.save.floor.push({ region: this.regionId, shift, item: p.item, qty: p.qty, x: Math.round(p.x), y: Math.round(p.y) });
    }
  }

  persist(): void {
    if (this.mode === 'asleep') return;
    this.stashFloor();
    this.save.pos = { x: this.player.x, y: this.player.y };
    this.save.hp = this.player.health.hp;
    this.save.region = this.regionId;
    pruneSpent(this.save);
    writeSave(this.save);
    this.sinceSave = 0;
  }

  // ---------------------------------------------------------------- render

  private view(): View {
    const shake = settings.shake ? this.feel.offset() : { x: 0, y: 0 };
    return { x: this.camera.drawX + shake.x, y: this.camera.drawY + shake.y };
  }

  private darkness(): string {
    const base = REGIONS[this.regionId].darkness;
    if (this.regionId !== HOME_REGION) return base;
    return mixHex(base, '#8c7a64', coziness(this.save));
  }

  private lights(): Light[] {
    const L: Light[] = [];
    const p = this.player;
    const up = (id: UpgradeId) => this.save.upgrades.includes(id);
    L.push({ x: p.x, y: p.y - 4, r: this.regionId === 'coop' ? 60 : 78, color: '#e0dcc8', a: this.mode === 'asleep' ? 0.2 : 0.5 });
    if (this.muzzleT > 0) L.push({ x: p.x + Math.cos(p.aim) * 10, y: p.y - 4 + Math.sin(p.aim) * 10, r: 34, color: '#ffd29a', a: 0.9 });
    for (const o of this.scene.objects) {
      switch (o.kind) {
        case 'node': {
          const def: NodeDef = NODES[o.id as NodeId];
          if (def.light && !o.spent) L.push({ x: o.x, y: o.y - 5, ...def.light, flicker: 0.12, seed: o.col * 7 + o.row });
          if (o.id === 'copperMachine' && !o.spent) L.push({ x: o.x, y: o.y - 8, r: 18, color: '#f0a060', a: 0.3 });
          break;
        }
        case 'access':
          L.push({ x: o.x, y: o.y - 14, r: 120, color: '#f4e7b0', a: 0.95 });
          break;
        case 'landmark':
          if (o.id === 'founderStatue') L.push({ x: o.x, y: o.y - 42, r: 62, color: '#a6e05a', a: 0.8, flicker: 0.1 });
          break;
        case 'hole':
          if (!up('patchHoles')) L.push({ x: o.x, y: o.row * TILE + 14, r: 32, color: '#7fbf5a', a: 0.55, flicker: 0.2, seed: o.col });
          break;
        case 'station':
          if (o.id === 'lantern') L.push(up('scrapLantern') ? { x: o.x, y: o.y - 18, r: 150, color: '#ffc070', a: 1, flicker: 0.1 } : { x: o.x, y: o.y - 12, r: 58, color: '#ffb050', a: 0.85, flicker: 0.35 });
          if (o.id === 'pot') L.push({ x: o.x, y: o.y - 2, r: 48, color: '#ff8a30', a: 0.85, flicker: 0.5 });
          if (o.id === 'slimeGenerator' && up('slimeGenerator') && this.save.charge > 0) L.push({ x: o.x, y: o.y - 12, r: 40 + this.save.charge * 1.5, color: '#58c078', a: 0.75, flicker: 0.08 });
          break;
        case 'valve':
          if (this.scene.boss?.valveState(o) === 'ready') L.push({ x: o.x, y: o.y - 12, r: 30, color: '#ff8a50', a: 0.75, flicker: 0.3, seed: o.col });
          break;
        case 'npc':
          if (o.id === 'grubb') L.push({ x: o.x, y: o.y - 14, r: 74, color: '#ffd080', a: 0.85, flicker: 0.08 });
          if (o.id === 'hatch') L.push({ x: o.x, y: o.y - 12, r: 48, color: '#ffc070', a: 0.7 });
          break;
        default:
          break;
      }
    }
    for (const s of this.sconces) L.push({ x: s.x, y: s.y, r: 76, color: '#ffc878', a: 0.8, flicker: 0.15, seed: s.x });
    for (const e of this.exitLights) L.push({ x: e.x, y: e.y, r: 26, color: '#c8c0a0', a: 0.25 });
    for (const h of this.scene.humans) {
      if (h.id === 'paladin' || h.id === 'guard') L.push({ x: h.x, y: h.y - 14, r: 86, color: '#ffb060', a: 0.9, flicker: 0.3, seed: h.x });
      if (h.id === 'inspector') L.push({ x: h.x, y: h.y - 8, r: 66, color: '#f8d070', a: 0.85, flicker: 0.1 });
      if (h.id === 'apprentice') L.push({ x: h.x, y: h.y - 20, r: 34, color: '#c090f0', a: 0.6 });
      if (h.attack === 'windup' && h.def.attack?.kind === 'fireCircle') {
        const k = Math.min(1, h.attackT / h.def.attack.windup);
        L.push({ x: h.aimAt.x, y: h.aimAt.y, r: 18 + 30 * k, color: '#ff7a30', a: 0.75 });
      }
    }
    const boss = this.scene.boss;
    if (boss && !boss.boss.dead) L.push({ x: boss.boss.x, y: boss.boss.y - 6, r: 44, color: '#f0a060', a: 0.45 });
    for (const pr of this.scene.projectiles) {
      if (pr.kind === 'charged') L.push({ x: pr.x, y: pr.y, r: 20, color: '#ffd29a', a: 0.8 });
      else if (pr.kind === 'gel' || pr.kind === 'slimeShot') L.push({ x: pr.x, y: pr.y, r: 12, color: '#58c078', a: 0.5 });
    }
    return L;
  }

  render(fps: number): void {
    const ctx = this.screen.game;
    const view = this.view();
    const spots = new Map<string, boolean>();
    if (this.regionId === HOME_REGION && this.mode === 'play') {
      for (const o of this.scene.objects) {
        if ((o.kind !== 'station' && o.kind !== 'hole') || spots.has(o.glyph)) continue;
        const open = openUpgradesAt(this.save, o.glyph).filter((id) => !this.save.upgrades.includes(id));
        if (open.length === 0) continue;
        const affordable = open.some((id) => canBuild(this.save, id, true));
        spots.set(o.glyph, affordable);
        if (affordable) this.queueHint('build');
      }
    }
    const state: WorldDrawState = {
      save: this.save,
      region: this.regionId,
      time: this.time,
      focus: this.mode === 'play' && this.overlays.length === 0 ? this.focus : null,
      spots,
      goblinDown: this.mode === 'down',
      goblinHidden: this.hidden,
      asleep: this.mode === 'asleep',
      boardNews: this.regionId === 'coop' && currentEvent(this.save).status === 'pending',
      boss: this.scene.boss,
    };

    this.renderer.drawTerrain(ctx, view, this.time);
    for (const s of this.sconces) drawProp(ctx, 'sconce', '', s.x - view.x, s.y + 2 - view.y);
    this.ambience.drawBack(ctx, view);
    drawWorld(ctx, view, this.scene, this.player, state);
    this.drawThrows(ctx, view);

    const lights = this.lights();
    this.lighting.render(ctx, view, this.darkness(), lights, this.time);
    this.lighting.glow(ctx, view, lights, this.time);
    this.ambience.drawGlow(ctx, view);
    drawWorldOverlay(ctx, view, this.scene, state);

    const lastHeart = this.mode === 'play' && this.player.health.hp <= 2 ? 0.16 + 0.08 * Math.sin(this.time * 6) : 0;
    drawEdgeGlow(ctx, Math.max(this.feel.hurt * 0.7, lastHeart, this.spottedFx * 0.5));
    drawFrameVignette(ctx);
    if (this.mode === 'down') {
      ctx.fillStyle = `rgba(5, 6, 5, ${0.45 * clamp(this.downT / DOWN_TIME, 0, 1)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    this.renderHud(fps, view);
  }

  private drawThrows(ctx: CanvasRenderingContext2D, view: View): void {
    for (const t of this.throws) {
      const k = t.t / t.dur;
      const x = lerp(t.x0, t.x1, k) - view.x;
      const y = lerp(t.y0, t.y1, k) - Math.sin(k * Math.PI) * (12 + t.dur * 20) - view.y;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(Math.round(lerp(t.x0, t.x1, k) - view.x), Math.round(lerp(t.y0, t.y1, k) - view.y), 2, 1);
      ctx.fillStyle = t.kind === 'bottle' ? '#5aa07a' : '#a8a090';
      ctx.fillRect(Math.round(x), Math.round(y), 2, t.kind === 'bottle' ? 3 : 2);
    }
  }

  /** Is anything worth seeing behind the HUD panels: the goblin, what it would use, creatures, people, or speech? */
  private hudCovering(): boolean {
    if (this.hudPanels.length === 0 || !this.scene) return false;
    const vx = this.camera.drawX;
    const vy = this.camera.drawY;
    const behind = (x: number, y: number, r: number) =>
      this.hudPanels.some((p) => x - vx + r > p.x - 4 && x - vx - r < p.x + p.w + 4 && y - vy + r > p.y - 4 && y - vy - r < p.y + p.h + 4);
    if (behind(this.player.x, this.player.y - 6, 10)) return true;
    if (this.focus && behind(this.focus.x, this.focus.y - 8, 14)) return true;
    if (this.scene.creatures.some((c) => !c.dead && behind(c.x, c.y, c.radius + 4))) return true;
    if (this.scene.humans.some((h) => behind(h.x, h.y - 6, 10))) return true;
    return this.scene.bubbles.some((b) => behind(b.x, b.y - 50, 34));
  }

  private renderHud(fps: number, view: View): void {
    const hud = this.hud;
    hud.begin();
    if (this.mode === 'asleep') {
      const bed = this.scene.objects.find((o) => o.id === 'bed');
      if (bed) {
        for (let i = 0; i < 3; i++) {
          const k = (this.wakeT * 0.6 + i / 3) % 1;
          hud.setAlpha(Math.sin(k * Math.PI));
          hud.text('z', bed.x - view.x + 10 + k * 10, bed.y - view.y - 14 - k * 16, { font: 'head', size: 6 + i * 2, color: '#e8e4d8', edge: 'outline' });
        }
        hud.setAlpha(1);
      }
      if (this.wakeT > 1.2) hud.text('[E] Get up', VIEW_W / 2, VIEW_H - 30, { size: 8, align: 'center', edge: 'outline', color: PAL.textDim });
      hud.fade(clamp(1 - this.wakeT / 1.2, 0, 1));
      return;
    }

    // The fixed HUD first, so prompts, speech, and numbers out in the world are never painted over.
    drawHearts(hud, this.player.health.hp, this.player.health.max, this.time);
    const thrown = this.throwable();
    const modX = drawThrowable(hud, thrown, thrown === 'pebble' ? 0 : packCount(this.save, thrown), 10 + this.player.health.max * 5);
    if (this.save.equippedMod) drawMod(hud, this.save.equippedMod, modX + 8);
    drawButtons(hud, this.save.buttons);
    drawShiftClock(hud, this.save.playTime);
    hud.setAlpha(this.hudAlpha);
    const o = currentObjective(this.save);
    const panels: PanelRect[] = [drawObjective(hud, o.title, o.text, o.done, o.total, this.objectiveFlash)];
    const tracked = drawTracked(hud, this.save);
    if (tracked) panels.push(tracked);
    this.hudPanels = panels;
    hud.setAlpha(1);

    drawDamageNumbers(hud, view, this.scene.effects.texts, FEEL.damageNumberTime);
    drawBubbles(hud, view, this.scene.bubbles);
    if (this.focus && this.mode === 'play' && this.overlays.length === 0 && !this.transition) {
      const { verb, label } = this.promptFor(this.focus);
      const def = this.focus.kind === 'node' ? (NODES[this.focus.id as NodeId] as NodeDef) : null;
      const progress = def && def.time > 0 && this.holdOn === this.focus ? this.holdT / def.time : 0;
      const fy = this.focus.kind === 'hole' ? this.focus.row * TILE + 22 : this.focus.y;
      drawPrompt(hud, view, this.focus.x, fy, verb, label, progress, this.lockReason(this.focus));
    }
    if (this.homeExit && this.regionId !== HOME_REGION) drawHomeArrow(hud, view, this.homeExit.x, this.homeExit.y, this.time);

    const bf = this.scene.boss;
    if (bf?.active) {
      const def = bf.boss.def;
      drawBossBar(hud, def.name, bf.boss.hp, def.hp, def.boss?.phase2At ?? 0, this.time, this.bossFlash > 0);
    }
    this.banners.draw(hud, this.overlays.length > 0);
    this.toasts.draw(hud);
    if (this.overlays.length === 0) drawControlsStrip(hud);
    for (const ov of this.overlays) ov.draw(hud, this.time);
    if (this.debug) this.renderDebug(fps);
    if (this.transition) {
      const k = clamp(this.transition.t / this.transition.fade, 0, 1);
      hud.fade(this.transition.phase === 'out' ? k : 1 - k);
    }
  }

  private renderDebug(fps: number): void {
    const mc = Math.floor((this.input.mouse.x + this.camera.x) / TILE);
    const mr = Math.floor((this.input.mouse.y + this.camera.y) / TILE);
    const shift = shiftIndex(this.save.playTime);
    const nextBell = (shift + 1) * SHIFT_SECONDS - this.save.playTime;
    const ev = currentEvent(this.save);
    this.hud.textBox(
      [
        { text: `${fps.toFixed(0)} fps`, color: PAL.warn },
        { text: `region   ${this.regionId}  (${this.scene.creatures.length} creatures, ${this.scene.humans.length} people)` },
        { text: `player   ${this.player.x.toFixed(1)}, ${this.player.y.toFixed(1)}  tile ${this.player.tileCol},${this.player.tileRow}${this.hidden ? '  HIDDEN' : ''}` },
        { text: `cursor   tile ${mc},${mr}  ${this.map.kindAt(mc, mr)}` },
        { text: `shift    ${shift}  (bell in ${nextBell.toFixed(0)}s)` },
        { text: `event    ${ev.id} ${ev.status}${this.live ? ` LIVE:${this.live.phase}` : ''}` },
        { text: `launcher ${this.launcherMode().name}` },
        { text: 'G gate · N next shift · H heal · T launcher · K kit · V event', color: PAL.textDim },
      ],
      4,
      96,
    );
  }

  /** Dev hook for tests in the browser: interact with whatever is in front of the goblin. */
  debugInteract(): void {
    const f = this.findFocus();
    if (f) this.interact(f);
  }

  get overlayCount(): number {
    return this.overlays.length;
  }

  /** People in the current region, for dev tools. */
  get people(): readonly Human[] {
    return this.scene.humans;
  }
}
