# Goblin Pension Plan — Milestones

The milestones follow the build order in the brief. Each one ends in something **playable**, has a "done when" test you can run by hand, and lists the automated tests it adds. Tick boxes as work lands.

Legend: `[x]` done · `[ ]` to do · **(T)** has an automated test.

---

## M0 — Foundation ✅
*You can walk the goblin around all five regions.*

- [x] Vite + strict TypeScript + Vitest scaffold
- [x] Fixed-timestep game loop (60 Hz update, rAF render)
- [x] Low-res 480×270 canvas with whole-number scaling and no smoothing
- [x] Input: WASD, mouse position in world space, edge-triggered key presses
- [x] ASCII tilemaps with a legend (`src/world/tiles.ts`) and five region blockouts
- [x] Axis-separated AABB vs tile collision, with goblin-only crawl tiles
- [x] Camera follows smoothly and clamps to the map edges
- [x] Region exits link up both ways, with fade transitions
- [x] Data definitions for items, recipes, upgrades, enemies, skills, regions, and the charter
- [x] Save system skeleton (versioned localStorage, guarded with try/catch)
- [x] Debug overlay (F3): FPS, tile under the cursor, region, position
- [x] **(T)** Data integrity: every recipe, upgrade, and spawn references real IDs; every exit has a matching return exit; every region has a player spawn

**Done when:** `npm run dev` lets you walk from the Burrow to every region and back without getting stuck.

---

## M1 — Combat core ✅
*Fight a rat pack and enjoy it.*

- [x] Player health (5 hearts in half-heart steps), hurt flash, knockback, invulnerability frames
- [x] Scrap Launcher: about 3 shots per second, knockback, wall impact puff, muzzle sparks
- [x] Dodge roll: 0.3s, invulnerability frames (enemy shots pass through), cooldown, input buffer, dust effect
- [x] Enemy base: state machine (`idle → approach → windup → attack → recover`, plus `return`), with the windup drawn as a blink and a shiver
- [x] **Drain Rat** (pack AI with a telegraphed lunge) and **Slime** (splits; Slimelets keep their distance and spit)
- [x] Hit-stop (45ms on kills, 70ms when hurt), screen shake, damage numbers
- [x] Defeat goes through a stub of the Rat Union flow: lie there, fade out, wake up at home, sign the receipt
- [x] **(T)** Damage and invulnerability-frame math; slime split counts

**Also landed in M1**
- **Bone Mite** (shakes, draws its charge line, charges straight). Beetles and the Pump Matron spawn as dormant markers until M6.
- **Fairness rules:** at most 2 creatures wind up or attack at once (the rest circle); no contact damage, only telegraphed attacks; light creatures can be shot out of a windup, heavy ones can't.
- **Line of sight** (grid raycast, `src/world/sight.ts`) and **pathing** (breadth-first flow fields, `src/world/pathing.ts`). Chasers route around walls to where they last saw you, give up after 3s, and go home.
- **Shift memory** (`save.spent`): defeated creatures stay gone until the next Shift Bell. M2's searched piles use the same mechanism.
- **Scrapping XP** on kills, level-up toasts, and all three Scrapping milestones: faster rolls (2), charged shot on right mouse (4), +1 heart (6).
- Arriving home restores full health. HP persists in the save.
- Dev hook: `window.__gpp` is the running game in dev builds.

**Play-test (bot runs, 3 rats in the nest, 4 runs each):** perfect aim and no dodging lost 0–1 half-hearts; perfect aim with rolls lost 0; sloppy aim and no dodging lost 2 every time; sloppy aim with rolls lost 0–1. Rolling clearly pays off, and nothing hits you without warning. The tuning that got here: rats take 40% knockback (they were stun-locked at 100%), rats spawn clustered so the pack arrives together, and the pack alert radius is 150px.

**Done when:** three rats plus one slime in the Galleries feel fair. Every hit you take feels like your own mistake. *(Bot runs say yes. Still worth a hands-on play.)*

---

## M2 — Gathering, inventory, going home ✅
*Scavenge a pack full and bring it back.*

- [x] Interactables: junk piles, crates (smashable, noisy), glowcap patches, brine truffle roots (Fungiculture 3), slime pools, copper machinery (Scavenging 3). Defined in `src/data/nodes.ts`.
- [x] Hold-E to search, with a progress ring; yields come from data tables. Crates break with one press, or with a shot.
- [x] Pack: 6 slots of up to 20 each (9 with the Patched Satchel), categories, "pack full" feedback. Equipment and quest items are key items and never take a slot.
- [x] Loot pops out of what you searched and flies to you. Pickup toasts stack up the right-hand side and merge repeats ("+5 Bones").
- [x] Scavenging XP and the level-up banner, with the milestone text
- [x] Burrow storage crate: opening it stores every material in the pack, then lets you take stacks back out
- [x] Expedition summary card on arriving home: time out, what you brought back, XP, creatures defeated, and progress toward the tracked recipe or next Charter build
- [x] Rat Union defeat: you lie there, the screen fades, you wake up at home, and you sign a receipt listing exactly what the fee took (half of each common material carried, rounded down)
- [x] Resource piles refill at the Shift Bell (every 8 minutes of play), with a banner and a bell
- [x] Save and load everything: pack, storage, key items, skills, flags, upgrades, production, tracked item, events, hints, stats. Autosave on region change, every craft and build, and every 15 seconds.
- [x] **(T)** Inventory stacking, overflow, key items, quick deposit, withdraw, all-or-nothing payment; defeat fee (keeps food, throwables, spores, equipment, quest items, storage, buttons); save round-trip and defaults for older saves (`tests/inventory.test.ts`, `tests/save.test.ts`)

**Done when:** you can go out, fill the pack, die or come home, and the numbers are exactly what you'd expect. *(Checked in the browser: search, smash, fight, defeat, receipt, summary.)*

---

## M3 — Crafting & visible home upgrades ✅
*Patch the holes and watch the Burrow change.*

- [x] Station window (`src/ui/station.ts`): Make and Build tabs, recipe list, have/need counts, locked recipes say why ("Tinkering 2", "Needs generator power")
- [x] Recipe tracking (T in a station window): pinned to the HUD with have/need counts and where to find each material
- [x] Burrow building: open spots glow (dashed outline, brighter when you can afford one), and every spot has a build menu. Building closes the menu so you see the change, with dust, a "BUILT" banner, and a bigger "CHARTER STEP COMPLETE" banner when it counts.
- [x] Burrow visual states from upgrades: holes become brick patches with a brass plaque, the puddles under them dry up, the workbench is repaired, the bed, lantern, sign, and stations change, and the Burrow's light warms and the music adds layers as it gets cozier
- [x] Cooking Pot recipes (Glowcap Skewer, then Truffle Stew and Stinkbrew); Q eats the smallest food that covers the damage
- [x] Workbench recipes: Slime Glue, Patched Satchel, Nail Spread, Slime Shot. (Board Patch and the Mushroom Bed are built at their own spots, not crafted.)
- [x] Pinned objective that follows the story: read the letter, Charter steps 1–3, go and meet Grubb, then the rest
- [x] Grubb's letter by the door; Charter steps 1–3 can be completed
- [x] Production that runs while you play (`src/game/production.ts`): Mushroom Bed (side by side, two with the second bed), Drying Rack and Bone Grinder (queues). Ready-toasts reach you anywhere. *(Pulled forward from M6.)*
- [x] **(T)** Crafting is atomic, uses storage first, and overflows into storage; station, skill, and power gating; timed recipes only through production; building pays once and respects dependencies; the Charter fills in as it's built; production timing, capacity, queues, and collection (`tests/crafting.test.ts`)

**Done when:** the first 10 minutes of the pacing plan (DESIGN §17, steps 1–5) play end to end. *(Checked in the browser: letter, Galleries, contract, home, Board Patch, Charter step 1.)*

---

## M4 — Stealth & the first adventurer route ✅
*Hide from Sir Aldous and loot his leftovers.*

- [x] Line-of-sight raycast against the tile grid *(landed in M1)*
- [x] Vision cones drawn faintly on the ground, tinted by awareness
- [x] Awareness state machine (unaware, suspicious, searching, hostile, returning) with icons that differ in shape as well as color (`?`, orange `?`, red `!` diamond, `…`)
- [x] Suspicion meter (distance, cone center, movement, sneak, and mood multipliers); a red edge glow when you're spotted
- [x] Noise events with visible rings: shots, charged shots, rolls, smashing crates, running, thrown pebbles and bottles
- [x] Sneak (Shift); hiding in tall rubbish (`h` tiles) or a crawlspace only works if nobody saw you go in. Crawlspaces block people.
- [x] Throwables (F): a free pebble, or an Empty Bottle if you have one (louder, sends people to search). They arc to the cursor and stop at walls.
- [x] Party AI (`src/game/human.ts`): route following, formation, fighting creatures, searching where they last saw you, giving up and walking back, never using crawlspaces or exits
- [x] Creatures go for nearby heroes too, not just the goblin
- [x] Heroes: Paladin (shield charge), Ranger (aim line that locks before the shot), Apprentice (fire circle), all with long telegraphs; torches and an orb light them up
- [x] Activity warnings: footsteps strip, a bark from the grate before they appear, speech bubbles, the Activity Board
- [x] Sprite pass: goblin, Grubb, rat, slime, slimelet, mite, and five human palettes as hand-placed string sprites (`src/render/art/characters.ts`), plus props, icons, and portraits drawn in code. No sprite sheets needed.
- [x] **(T)** Hidden goblins are never noticed; plain view turns people hostile; nobody sees behind them; sneaking halves suspicion; a pursuit ends within 15 seconds once you're in cover; pebbles and bottles; people never follow into a crawlspace; the inspector flees and whistles instead of fighting; parties never appear within 6 tiles of the goblin (`tests/stealth.test.ts`, `tests/events.test.ts`)
- [ ] **(T)** Every patrol zone has at least 2 exits including a crawl exit, checked on the map data. *(Not written yet.)*

**Done when:** a new player can reliably escape a hostile party at least three different ways (crawl, hiding spot, out of sight). *(The AI rules are tested; the three escapes still want a hands-on play.)*

---

## M5 — The living dungeon ✅
*NPCs make things happen that you can take advantage of.*

- [x] **Beginner Contract** event: party vs rat nest, leftovers spawn (bone pile, cloth bundle, smashed crate), the nest stays cleared for the shift. The first one is the story's stealth lesson: it always plays out live, 40 seconds after you first reach the Galleries.
- [x] **Pipe Inspection** event: Hobb opens the sluice gate while he works; if he spots you he whistles, the gate slams, and a guard comes down to look. The valve wheel at his post opens it for good with Tinkering 3 (no softlock).
- [x] **Noisy Fight** (Slime Advisory) event: heroes fight in the Cistern hall and nearby creatures get pulled in, emptying the side passages
- [x] Event director (`src/game/director.ts`): one event per shift in rotation, posted on the Activity Board with the next one; it plays live if you're in the region and settles itself if you're not
- [x] NPCs never pick up loot; nothing the story needs sits in an event zone
- [x] Watch Guard (slow, gives up fast)
- [x] **(T)** Rotation; every route walkable by people from the access point; leftovers on open floor inside the zone and about a pile each; no NPCs, letters, access points, or exits inside a zone; offscreen resolution clears the zone once and leaves the pile once; old leftovers clear at the bell; a live party clears the nest and leaves; the inspector's gate opens and shuts; walking away settles the event exactly once (`tests/events.test.ts`)

**Done when:** you see heroes fight rats, wait, and loot the aftermath, and it feels like a nice bonus, not the best strategy. *(Seen in the browser: warning, descent with torches, the fight, the bark, the leftovers.)*

---

## Presentation track (alongside M2–M5)
*It should feel like an established game from the first second, not a prototype.*

- [x] **Title screen** (`src/app/title.ts`): Bellmarket at dusk with swinging bells and junk falling down a chute; the logo fades in over the city, then the camera pans down to one lit alcove as the menu arrives. Continue / New Burrow (confirmed) / Settings.
- [x] **Story intro** (`src/app/intro.ts`): six illustrated, letterboxed panels with typewriter narration. Space moves on, Esc skips.
- [x] **Chapter card:** "Chapter One: A Recognized Workshop".
- [x] **Wake-up:** the goblin asleep in bed with drifting Zs, gets up by itself or on a key; a toast about something slipped in through the passage.
- [x] **Grubb's letter** on paper, and an objective that follows the story
- [x] **Dialogue** with portraits, typewriter text, voice blips, and choices (`src/ui/dialogue.ts`): Grubb (first meeting, then a chat that changes with the Charter), Dorrit at the Hatch
- [x] **Cards and windows:** expedition summary, Rat Union receipt, Activity Board, station, storage, pack / Charter + Retirement Ledger / skills / map, pause with settings and controls
- [x] **Lighting** (`src/render/lighting.ts`): a banded, dithered light map multiplied over the scene, glow on top, per-region darkness, flickering torches, a frame vignette, and red edge glows when hurt or spotted
- [x] **Terrain and set dressing:** a floor and wall style per region, contact shadows, water shimmer, exit chevrons, sock bunting, and a lived-in Burrow (rug, chalk tallies and a drawing, a pipe, roots, cobwebs, and rubbish)
- [x] **Ambience** (`src/render/ambience.ts`): dust motes, drips, spores, steam, falling grit, with matching sounds
- [x] **Audio:** procedural sound effects and a music sequencer with a track per region, a danger track while a hostile human can see you, and Burrow layers that grow with coziness
- [x] **HUD:** hearts, pinned objective, tracked recipe, shift clock, the way home, context prompts, one-time hints, big banners for level-ups, builds, Charter steps, and the bell

---

## Pulled forward from M6 and M7

- [x] M6: the Goblin Cooperative with Grubb, the Hatch (Dorrit; trading itself is still to come), and the Activity Board; the Retirement Ledger screen
- [x] M6: production stations with timers (see M3)
- [x] M7: lighting, procedural sound and ambience, the Shift Bell, the map screen, the home arrow, the pause menu with a confirmed save reset, the title screen, a screen-shake toggle, and shape-plus-color awareness icons

---

## M6 — Production, Pumpworks, boss, chapter end
*Earn Stamp #1.*

- [x] Production stations with timers that run while you play: Mushroom Bed, Drying Rack, Bone Grinder *(landed with M3)*
- [ ] Slime Generator: charge storage (20), fuelled by gel, connected by pipes in the visuals
- [ ] Charge-costing recipes: Slime Cell
- [ ] Bone Mite and Scrapback Beetle (armored front, sparks on blocked shots)
- [ ] Old Pumpworks layout with copper machinery and the Pump Room
- [ ] **Pump Matron** boss: 2 phases, steam valves, add spawns, drops the Flywheel Coil, opens the shortcut afterward
- [ ] Goblin Cooperative: Grubb (production order + stamp), the Hatch (Dorrit), the Activity Board *(the room, Grubb, Dorrit, and the Board are in; the order, the stamp, and trading are not)*
- [ ] Trading: buys processed goods only, demand per shift with price falling about 15% per unit sold, sells spores, patterns, and decorations
- [ ] Charter steps 4–6, stamp ceremony, Retirement Ledger screen, free play afterward *(the Ledger screen is in)*
- [ ] Skill milestones from DESIGN §10 all hooked up (Scrapping's are done)
- [ ] Beetle and Pump Matron behaviors (add them to `ACTIVE_BEHAVIORS` in `src/game/creature.ts`)
- [ ] **(T)** Economy: no buy→craft→sell or buy→salvage loop makes a profit (brute-force over recipes); the full chapter can be completed from a fresh save using only resources that refill each shift (a simulated "resource budget" test); a dry generator never blocks basic recipes

**Done when:** a fresh save can reach Stamp #1, and the automated softlock test agrees.

---

## M7 — Polish
*It feels good to play.*

- [x] Lighting: darkness layer, radial lights, region ambient tint, the Burrow warming with upgrades
- [x] Decorations: Fewer Springs, Second Bowl, Too-Grand Chair, DEFINITELY NOT A LAIR
- [x] Procedural WebAudio sound effects and ambience; Shift Bell; music per region with layers
- [x] Map screen (M): node graph of discovered regions and shortcuts
- [x] Exit arrow on the screen edge pointing toward home
- [x] Pause menu: resume, controls, **reset save (confirmed)**, volume
- [x] Title screen and "Continue / New Burrow"
- [ ] Balancing pass against the §17 pacing timeline
- [ ] Accessibility: rebindable keys, a screen shake toggle, colorblind-safe awareness icons (shape + color) *(shake toggle and icons are in; rebinding is not)*

**Done when:** a fresh player can go from title screen to Stamp #1 in 60–90 minutes without reading the docs.

---

## Test checklist from the brief (tracked across milestones)

| Requirement | Milestone | How it's checked |
|---|---|---|
| The player can reliably escape adventurers | M4 | Pursuit-timeout unit test plus a manual three-route escape check |
| Goblin shortcuts work every time | M0/M4 | Collision tests: goblin passes `c`, human blocked |
| NPC battles can't block progression | M5 | Quest-critical interactables excluded from event zones (data test) |
| Resources allow completion without a softlock | M6 | Resource-budget simulation test |
| No unlimited money from a simple trading loop | M6 | Brute-force trade loop test |
| Defeat and saving keep the right progress | M2 | Save round-trip and defeat-loss tests |
| The generator and Stamp #1 can be completed | M6 | Charter evaluator plus a full manual playthrough |
