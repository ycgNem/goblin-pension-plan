import { SHIFT_SECONDS } from '../data/economy';
import { EVENTS, eventForShift, FIGHT_PULL_RADIUS, SPAWN_SAFE_TILES, type EventDef, type EventId } from '../data/events';
import { BARKS } from '../data/story';
import { TileMap } from '../world/tilemap';
import { TILE } from '../world/tiles';
import { Human } from './human';
import type { EventNode, SaveData } from './save';
import type { Scene } from './scene';
import { markSpent, placementKey, shiftIndex } from './world-state';

// The event director. One event per shift, in rotation (shift 0 is the story's Beginner Contract).
// Events play out live when you're in their region and settle themselves when you're not,
// so nothing ever waits on the player and nothing depends on watching.

/** Seconds of warning (footsteps, the strip) before anyone appears. */
export const WARNING_TIME = 6;
/** The story contract starts this long after you arrive in the Galleries, or as soon as you go near the nest. */
export const STORY_CONTRACT_DELAY = 15;
/** "Near the nest", in tiles beyond the edge of its zone. */
export const STORY_CONTRACT_NEAR = 6;
/** Longest an event can run live before it wraps up regardless. */
const OVERTIME = 30;

export interface EventState {
  id: EventId;
  shift: number;
  status: 'pending' | 'done';
  /** playTime when it starts. */
  startsAt: number;
}

/** This shift's event. Rolls the record over when a new shift starts. */
export function currentEvent(save: SaveData): EventState {
  const shift = shiftIndex(save.playTime);
  if (save.event.shift !== shift) save.event = { shift, status: 'pending' };
  // The story's contract waits for the goblin: until it has played, it's every shift's event.
  const id = save.flags.beginnerContractDone ? eventForShift(shift) : 'beginnerContract';
  return { id, shift, status: save.event.status, startsAt: shift * SHIFT_SECONDS + EVENTS[id].startAt };
}

/** The first Beginner Contract always plays out live: it's the stealth tutorial. */
export function storyGated(save: SaveData, id: EventId): boolean {
  return id === 'beginnerContract' && !save.flags.beginnerContractDone;
}

export function inZone(def: EventDef, col: number, row: number): boolean {
  return Math.hypot(col - def.zone.col, row - def.zone.row) <= def.zone.r;
}

/** Leftovers for this shift. Idempotent: an event only ever leaves its pile once. */
export function addLeftovers(save: SaveData, id: EventId): EventNode[] {
  const def = EVENTS[id];
  const shift = shiftIndex(save.playTime);
  const added: EventNode[] = [];
  def.leftovers.forEach((l, i) => {
    const key = `${def.region}:evt:${id}:${shift}:${i}`;
    if (save.eventNodes.some((e) => e.key === key)) return;
    const node: EventNode = { key, region: def.region, col: l.col, row: l.row, node: l.node, shift };
    save.eventNodes.push(node);
    added.push(node);
  });
  return added;
}

function finish(save: SaveData, id: EventId): void {
  save.event = { shift: shiftIndex(save.playTime), status: 'done' };
  if (id === 'beginnerContract') save.flags.beginnerContractDone = true;
}

/** Settle an event nobody watched: whatever the party came for is dealt with, and leftovers appear. */
export function resolveOffscreen(save: SaveData, id: EventId): void {
  const def = EVENTS[id];
  if (id !== 'pipeInspection') {
    const map = TileMap.forRegion(def.region);
    for (const p of map.spawns) {
      if (p.def.kind === 'creature' && inZone(def, p.col, p.row)) markSpent(save, placementKey(def.region, p.col, p.row));
    }
  }
  addLeftovers(save, id);
  finish(save, id);
}

/** Leftovers from earlier shifts are gone. */
export function pruneEventNodes(save: SaveData): void {
  const shift = shiftIndex(save.playTime);
  save.eventNodes = save.eventNodes.filter((e) => e.shift === shift);
}

export interface LiveEventHooks {
  /** Footsteps above: the warning strip. */
  warn(text: string): void;
  /** The Cistern sluice gate, opened by the inspector while he works. */
  gate(open: boolean): void;
  leftovers(nodes: EventNode[]): void;
}

export type LivePhase = 'warning' | 'waiting' | 'route' | 'working' | 'leaving' | 'over';

/** One event playing out in the scene you're in. */
export class LiveEvent {
  phase: LivePhase = 'warning';
  t = 0;
  readonly members: Human[] = [];
  private workT = 0;
  /** Adventurer kills in the scene when the event began. Later ones in the zone mean the party cleared it. */
  private readonly killsAtStart: number;
  private resolved = false;
  private guardT = -1;

  constructor(
    readonly id: EventId,
    private readonly save: SaveData,
    private readonly scene: Scene,
    private readonly hooks: LiveEventHooks,
  ) {
    this.killsAtStart = scene.heroKills.length;
    hooks.warn(EVENTS[id].warning);
  }

  get def(): EventDef {
    return EVENTS[this.id];
  }

  private get access(): { x: number; y: number } | null {
    const a = this.scene.objects.find((o) => o.kind === 'access');
    return a ? { x: a.x, y: a.y } : null;
  }

  update(dt: number): void {
    this.t += dt;
    switch (this.phase) {
      case 'warning':
        if (this.t >= WARNING_TIME) this.phase = 'waiting';
        if (this.t >= WARNING_TIME - 2.5 && this.t - dt < WARNING_TIME - 2.5) this.barkFromGrate();
        break;
      case 'waiting': {
        // Never appear right next to the goblin: wait at the grate until it moves off.
        const a = this.access;
        if (!a) {
          this.abandon();
          return;
        }
        const g = this.scene.goblin;
        if (Math.hypot(g.x - a.x, g.y - a.y) >= SPAWN_SAFE_TILES * TILE) {
          this.spawn(a);
          this.phase = 'route';
        }
        break;
      }
      case 'route': {
        const leader = this.members[0];
        if (!leader || leader.gone) {
          this.phase = 'leaving';
          break;
        }
        if (leader.wp >= leader.waypoints.length) this.startWork();
        break;
      }
      case 'working':
        this.workT += dt;
        if (this.isWorkDone()) this.complete();
        break;
      case 'leaving':
        if (this.members.every((m) => m.gone)) this.phase = 'over';
        break;
      case 'over':
        return;
    }

    if (this.guardT >= 0) {
      this.guardT += dt;
      if (this.guardT >= 2.5) {
        this.guardT = -1;
        this.spawnGuard();
      }
    }

    // Anyone knocked down sends the whole party home.
    if (this.phase !== 'leaving' && this.phase !== 'over' && this.members.some((m) => m.retreating && !m.gone && m.def.role === 'hero')) {
      const loud = this.members.find((m) => !m.gone);
      if (loud) this.scene.say(loud, BARKS.retreat[0]);
      this.complete();
      for (const m of this.members) m.retreat();
    }
  }

  private barkFromGrate(): void {
    const a = this.access;
    if (!a) return;
    const lines = this.id === 'pipeInspection' ? BARKS.hobbWork : BARKS.partyEnter;
    this.scene.sayAt(lines[Math.floor(this.scene.rng() * lines.length)]!, a.x, a.y - 22);
  }

  private spawn(a: { x: number; y: number }): void {
    const route = this.def.route.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }));
    const post = this.scene.objects.find((o) => o.kind === 'post');
    if (this.id === 'pipeInspection' && post) route[route.length - 1] = { x: post.x, y: post.row * TILE + TILE / 2 };
    this.def.party.forEach((id, i) => {
      const h = new Human(id, a.x + (i - 1) * 4, a.y + 2);
      h.exit = { x: a.x, y: a.y };
      h.waypoints = route;
      h.face = Math.PI / 2;
      if (i > 0) {
        h.leader = this.members[0]!;
        h.slot = { back: 16 + (i > 1 ? 4 : 0), side: i === 1 ? -11 : 11 };
      }
      this.members.push(h);
      this.scene.humans.push(h);
    });
  }

  private startWork(): void {
    this.phase = 'working';
    this.workT = 0;
    const zx = this.def.zone.col * TILE + TILE / 2;
    const zy = this.def.zone.row * TILE + TILE / 2;
    for (const m of this.members) {
      m.task = 'work';
      m.home = { x: m.x, y: m.y };
      m.workFace = this.id === 'pipeInspection' ? 0 : Math.atan2(zy - m.y, zx - m.x);
    }
    if (this.id === 'pipeInspection') this.hooks.gate(true);
    else this.scene.pullCreatures(zx, zy, FIGHT_PULL_RADIUS);
  }

  private creaturesInZone(): boolean {
    const zx = this.def.zone.col * TILE + TILE / 2;
    const zy = this.def.zone.row * TILE + TILE / 2;
    return this.scene.creatures.some((c) => !c.dead && Math.hypot(c.x - zx, c.y - zy) <= this.def.zone.r * TILE + 40);
  }

  private isWorkDone(): boolean {
    if (this.id === 'pipeInspection') return this.workT >= this.def.work;
    const left = this.creaturesInZone();
    const busy = this.members.some((m) => m.awareness === 'hostile' || m.awareness === 'searching');
    if (this.workT >= this.def.work + OVERTIME) return true;
    return !left && !busy && this.workT >= this.def.work * 0.4;
  }

  /** The job's done (or abandoned): leave the leftovers, record it, and head home. */
  private complete(): void {
    if (!this.resolved) {
      this.resolved = true;
      if (this.id === 'pipeInspection') this.hooks.gate(false);
      const nodes = addLeftovers(this.save, this.id);
      this.hooks.leftovers(nodes);
      finish(this.save, this.id);
      const speaker = this.members.find((m) => !m.gone && m.def.role === 'hero');
      if (speaker && this.id === 'beginnerContract') {
        const zx = this.def.zone.col * TILE + TILE / 2;
        const zy = this.def.zone.row * TILE + TILE / 2;
        const cleared = this.scene.heroKills.slice(this.killsAtStart).some((k) => Math.hypot(k.x - zx, k.y - zy) <= this.def.zone.r * TILE + 40);
        const lines = cleared ? BARKS.contractDone : BARKS.nestEmpty;
        this.scene.say(speaker, lines[Math.floor(this.scene.rng() * lines.length)]!);
      }
    }
    this.phase = 'leaving';
    // Anyone mid-search finishes looking first, then heads out.
    for (const m of this.members) if (!m.gone && m.task !== 'flee') m.task = 'leave';
  }

  /** Hobb's whistle: the gate slams shut and a guard comes down to look. */
  onAlarm(h: Human): void {
    if (this.id !== 'pipeInspection') return;
    this.hooks.gate(false);
    this.scene.say(h, BARKS.hobbGateShut[0]);
    if (this.guardT < 0 && !this.members.some((m) => m.id === 'guard')) this.guardT = 0;
    this.complete();
  }

  private spawnGuard(): void {
    const a = this.access;
    const post = this.scene.objects.find((o) => o.kind === 'post');
    if (!a) return;
    const g = new Human('guard', a.x, a.y + 2);
    g.exit = { x: a.x, y: a.y };
    // He comes to look where the whistle blew, gives up quickly, and goes back up.
    g.task = 'leave';
    const spot = post ? { x: post.x, y: post.row * TILE + TILE / 2 } : { x: a.x, y: a.y + 48 };
    g.hear(spot.x, spot.y, 1e6);
    this.members.push(g);
    this.scene.humans.push(g);
    this.scene.say(g, BARKS.guardHostile[0]);
    this.phase = 'leaving';
  }

  /** You left mid-event: it settles the rest offscreen, exactly once. */
  abandon(): void {
    if (this.resolved) {
      this.phase = 'over';
      return;
    }
    this.resolved = true;
    if (this.id === 'pipeInspection') this.hooks.gate(false);
    resolveOffscreen(this.save, this.id);
    this.phase = 'over';
  }

  get live(): boolean {
    return this.phase !== 'over';
  }

  /** The party is in the region now (for the warning strip and music). */
  get present(): boolean {
    return this.members.some((m) => !m.gone);
  }
}
