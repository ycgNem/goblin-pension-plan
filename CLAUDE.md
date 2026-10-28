# Goblin Pension Plan — project notes

A top-down action RPG in strict TypeScript, Vite, and raw Canvas 2D. Read `docs/DESIGN.md` for the game and `docs/MILESTONES.md` for where the build is.

## Commands
- `npm run dev`: dev server on port 5180 (also `.claude/launch.json` → "dev")
- `npm test`: Vitest. Run it after any change to `src/data/`, `src/world/maps/`, or creature, human, event, or inventory logic.
- `npm run typecheck`: must stay clean. `strict` and `noUncheckedIndexedAccess` are on.

## Rules
- **TypeScript only.** No `.js` source files. No runtime dependencies without a strong reason (the brief says to avoid them). The two Fontsource fonts are the exception.
- **Content is data.** Items, nodes, recipes, upgrades, creatures, people, events, combat tuning, skills, regions, charter, economy, and story text live in `src/data/*.ts` as `as const satisfies Record<string, Def>`. New content and tuning numbers go there, not in logic code. When you need an optional field off one of those unions, annotate it (`const r: RecipeDef = RECIPES[id]`). Add a test in `tests/data.test.ts` or `tests/content.test.ts` when you add a new kind of cross-reference.
- **Maps are ASCII** in `src/world/maps/`. The legend is in `src/world/tiles.ts`. Exits are digits linked in `src/data/regions.ts`. `tests/world.test.ts` checks two-way links, reachability, gates, and safe regions, and `tests/events.test.ts` checks event routes and zones, so run both after any map edit.
- **Logic stays DOM-free.** `src/game/` (scene, creatures, people, director, inventory, crafting, production) never touches the canvas; drawing lives in `src/render/`, `src/ui/`, and `src/app/`. `game.ts` and `game-hud.ts` are the glue between them. That split is what lets `tests/helpers.ts` build rooms and run scenes in Vitest.
- **The scene is runtime-only.** `src/game/scene.ts` holds a region's creatures, people, objects, pickups, and effects, and is rebuilt on every region entry. Save data (`src/game/save.ts`) is only what persists. `parseSave` fills in missing fields from `newSave()`; bump `SAVE_VERSION` and write a `migrate` step only when the shape changes incompatibly.
- **Two drawing layers.** Pixel art (terrain, sprites, panels, icons) goes on the 480×270 game canvas; text goes on the full-resolution UI canvas through `Hud.text`. A `Hud.panel` wipes the text under it, so windows stack correctly.
- **Art is code.** Characters and icons are string sprites (`src/render/art/characters.ts`, `icons.ts`), checked by `validateSprite` in `tests/content.test.ts`. Props and portraits are drawn with `Painter` (`src/render/paint.ts`) and cached. The Burrow's set dressing is baked into the terrain in `world-renderer.ts`.
- **Units:** world pixels; one tile is 16px. Damage to the goblin is in half-hearts. Time is in seconds. Production, shifts, and events run off `save.playTime`, never wall-clock time (no offline decay).
- **Design guardrails** (from the brief): the Burrow is always safe; no hunger, durability, raids, or permadeath; pursuit always ends; creatures only hurt with telegraphed attacks; people never take loot or use crawlspaces; quest items never come from random drops; basic crafting never needs power; decorations never cost copper or quest items.
- **Voice:** one-line jokes, at most 80 characters for item descriptions and 50 for speech bubbles. See `docs/CONTENT.md`.

## Workflow
- Work milestone by milestone. Tick boxes in `docs/MILESTONES.md` as things land, and keep each milestone playable.
- Verify in the browser before calling a gameplay change done. Unit tests don't cover feel.
- Dev builds expose the app as `window.__app` and the running game (or `null` on the title screen) as `window.__gpp`. If the Browser pane is hidden, the page gets no animation frames and everything freezes; step it by hand with `__app.update(1 / 60); __app.input.endTick();` and call `__app.render(60)` before reading the canvases. Dispatch `KeyboardEvent`s on `window` to press keys.
- To see a frame while the pane is hidden, draw the `#game` and `#ui` canvases onto one canvas and export it (for example, POST it to a small local receiver in the scratchpad and read the PNG).
- Tune combat and stealth with bot runs from the console and compare outcomes across play styles, as recorded in the M1 play-test notes.
