import { describe, expect, it } from 'vitest';
import { SHIFT_SECONDS } from '../src/data/economy';
import { EVENTS, EVENT_IDS, EVENT_ROTATION, eventForShift, SPAWN_SAFE_TILES, type EventId } from '../src/data/events';
import { maxYield, NODES } from '../src/data/nodes';
import { currentEvent, inZone, LiveEvent, pruneEventNodes, resolveOffscreen, storyGated, WARNING_TIME } from '../src/game/director';
import { newSave } from '../src/game/save';
import { Scene } from '../src/game/scene';
import { isSpent, placementKey } from '../src/game/world-state';
import { TileMap } from '../src/world/tilemap';
import { TILE } from '../src/world/tiles';
import { seededRng } from './helpers';

/** Every tile a person can reach on foot from a starting tile. */
function reachable(map: TileMap, col: number, row: number): Set<string> {
  const seen = new Set<string>([`${col},${row}`]);
  const queue: [number, number][] = [[col, row]];
  while (queue.length) {
    const [c, r] = queue.shift()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc;
      const nr = r + dr;
      const key = `${nc},${nr}`;
      if (seen.has(key) || !map.inBounds(nc, nr) || map.isBlocked(nc, nr, 'human')) continue;
      seen.add(key);
      queue.push([nc, nr]);
    }
  }
  return seen;
}

describe('event data', () => {
  it('rotates one event per shift, starting with the Beginner Contract', () => {
    expect(eventForShift(0)).toBe('beginnerContract');
    for (let s = 0; s < 9; s++) expect(eventForShift(s)).toBe(EVENT_ROTATION[s % EVENT_ROTATION.length]);
  });

  it('every route can be walked by people, from the access point to the objective', () => {
    for (const id of EVENT_IDS) {
      const def = EVENTS[id];
      const map = TileMap.forRegion(def.region);
      // The inspector's wheel opens the sluice, so his route is walked with it shut.
      const access = map.spawnOf('access');
      expect(access, `${id} region has an access point`).toBeDefined();
      const ok = reachable(map, access!.col, access!.row + 1);
      for (const [c, r] of def.route) expect(ok.has(`${c},${r}`), `${id} waypoint ${c},${r}`).toBe(true);
    }
  });

  it('leftovers sit on open floor inside the zone, and are worth about a pile', () => {
    for (const id of EVENT_IDS) {
      const def = EVENTS[id];
      const map = TileMap.forRegion(def.region);
      for (const l of def.leftovers) {
        expect(map.isBlocked(l.col, l.row, 'goblin'), `${id} leftover at ${l.col},${l.row}`).toBe(false);
        expect(map.exitAt(l.col, l.row), `${id} leftover on an exit`).toBeUndefined();
        expect(inZone(def, l.col, l.row), `${id} leftover in zone`).toBe(true);
        expect(maxYield(NODES[l.node]), `${id} ${l.node}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it('nothing the story needs is inside an event zone', () => {
    for (const id of EVENT_IDS) {
      const def = EVENTS[id];
      const map = TileMap.forRegion(def.region);
      for (const p of map.spawns) {
        // Landmarks are scenery; people may fight under a chandelier.
        if (p.def.kind === 'npc' || p.def.kind === 'letter' || p.def.kind === 'access') {
          expect(inZone(def, p.col, p.row), `${id} zone covers ${p.def.kind} ${p.def.id}`).toBe(false);
        }
      }
      for (const e of map.exits) expect(inZone(def, e.col, e.row), `${id} zone covers exit ${e.glyph}`).toBe(false);
    }
  });
});

describe('the event director', () => {
  it('rolls the record over each shift', () => {
    const save = newSave();
    expect(currentEvent(save)).toMatchObject({ id: 'beginnerContract', shift: 0, status: 'pending' });
    save.event.status = 'done';
    save.playTime = SHIFT_SECONDS + 5;
    const ev = currentEvent(save);
    expect(ev).toMatchObject({ id: 'pipeInspection', shift: 1, status: 'pending' });
    expect(ev.startsAt).toBe(SHIFT_SECONDS + EVENTS.pipeInspection.startAt);
  });

  it('the first Beginner Contract always plays out live', () => {
    const save = newSave();
    expect(storyGated(save, 'beginnerContract')).toBe(true);
    expect(storyGated(save, 'pipeInspection')).toBe(false);
    save.flags.beginnerContractDone = true;
    expect(storyGated(save, 'beginnerContract')).toBe(false);
  });

  it('offscreen, a fight clears its zone and leaves its pile once', () => {
    const save = newSave();
    save.flags.beginnerContractDone = true;
    resolveOffscreen(save, 'beginnerContract');
    resolveOffscreen(save, 'beginnerContract');
    const def = EVENTS.beginnerContract;
    expect(save.eventNodes.length).toBe(def.leftovers.length);
    expect(save.event.status).toBe('done');
    const map = TileMap.forRegion(def.region);
    for (const p of map.spawns) {
      if (p.def.kind !== 'creature') continue;
      expect(isSpent(save, placementKey(def.region, p.col, p.row)), `${p.col},${p.row}`).toBe(inZone(def, p.col, p.row));
    }
  });

  it('the inspector leaves the creatures alone', () => {
    const save = newSave();
    save.playTime = SHIFT_SECONDS;
    resolveOffscreen(save, 'pipeInspection');
    expect(Object.keys(save.spent)).toEqual([]);
    expect(save.eventNodes).toEqual([]);
  });

  it('leftovers from earlier shifts are cleared away', () => {
    const save = newSave();
    resolveOffscreen(save, 'beginnerContract');
    expect(save.eventNodes.length).toBeGreaterThan(0);
    save.playTime = SHIFT_SECONDS;
    pruneEventNodes(save);
    expect(save.eventNodes).toEqual([]);
  });
});

describe('a live event', () => {
  function live(id: EventId) {
    const def = EVENTS[id];
    const map = TileMap.forRegion(def.region);
    const save = newSave();
    const scene = new Scene(def.region, map, save, { hurtPlayer: () => true, creatureHit: () => {}, creatureKilled: () => {} }, seededRng(5));
    const calls = { warn: 0, gate: [] as boolean[], leftovers: 0 };
    const ev = new LiveEvent(id, save, scene, {
      warn: () => calls.warn++,
      gate: (open) => calls.gate.push(open),
      leftovers: (nodes) => (calls.leftovers += nodes.length),
    });
    const access = scene.objects.find((o) => o.kind === 'access')!;
    const run = (seconds: number, x: number, y: number) => {
      for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
        scene.update(1 / 60, { x, y, alive: true, hidden: true });
        ev.update(1 / 60);
      }
    };
    return { save, scene, ev, calls, access, run };
  }

  it('warns first, and never appears right next to the goblin', () => {
    const { ev, calls, access, scene, run } = live('beginnerContract');
    expect(calls.warn).toBe(1);
    run(WARNING_TIME + 6, access.x + TILE, access.y + TILE);
    expect(ev.phase).toBe('waiting');
    expect(scene.humans.length).toBe(0);
    run(0.1, access.x + (SPAWN_SAFE_TILES + 2) * TILE, access.y + TILE * 3);
    expect(ev.phase).toBe('route');
    expect(scene.humans.length).toBe(EVENTS.beginnerContract.party.length);
  });

  it('the party reaches the nest, clears it, and goes home', () => {
    const { ev, save, calls, scene, run } = live('beginnerContract');
    // The goblin hides at the far west end.
    run(120, 2 * TILE, 8 * TILE);
    expect(save.event.status).toBe('done');
    expect(save.flags.beginnerContractDone).toBe(true);
    expect(calls.leftovers).toBe(EVENTS.beginnerContract.leftovers.length);
    expect(ev.phase).toBe('over');
    expect(scene.humans.length).toBe(0);
  });

  it('the inspector opens the sluice while he works and shuts it after', () => {
    const { ev, calls, run } = live('pipeInspection');
    run(200, 2 * TILE, 3 * TILE);
    expect(calls.gate).toEqual([true, false]);
    expect(ev.phase).toBe('over');
  });

  it('walking away mid-event settles it offscreen, exactly once', () => {
    const { ev, save, run } = live('beginnerContract');
    run(WARNING_TIME + 1, 2 * TILE, 8 * TILE);
    ev.abandon();
    ev.abandon();
    expect(ev.live).toBe(false);
    expect(save.event.status).toBe('done');
    expect(save.eventNodes.length).toBe(EVENTS.beginnerContract.leftovers.length);
  });
});
