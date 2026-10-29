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
- **Bone Mite** (shakes, draws its charge line, charges straight). Beetles and the Pump Matron spawned as dormant markers until M6.
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
- [x] **(T)** Every patrol zone has at least 2 exits including a crawl exit, checked on the map data, gates shut (`tests/events.test.ts`). The Cistern needed one: the passage down to the Pumpworks now starts with a crawl pipe people can't follow.

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

- [x] M6: the Goblin Cooperative with Grubb, the Hatch (Dorrit), and the Activity Board; the Retirement Ledger screen
- [x] M6: production stations with timers (see M3)
- [x] M7: lighting, procedural sound and ambience, the Shift Bell, the map screen, the home arrow, the pause menu with a confirmed save reset, the title screen, a screen-shake toggle, and shape-plus-color awareness icons

---

## M6 — Production, Pumpworks, boss, chapter end ✅
*Earn Stamp #1.*

- [x] Production stations with timers that run while you play: Mushroom Bed, Drying Rack, Bone Grinder *(landed with M3)*
- [x] Slime Generator: holds 20 charge, 5 per Slime Gel (the last gel tops it off), fed through its own window; copper pipes run to the workbench and the grinder spot once it's built
- [x] Charge-costing recipes: Slime Cell (2), Slime Shot (3), Bone Fertilizer (1). The requirement shows a bolt and `have/need`.
- [x] Bone Mite and Scrapback Beetle: the beetle turns slowly, walks the way it faces, and only charges once it has come round; shots off its front spark and clank
- [x] Old Pumpworks: an upper hall with beetles, mites, copper machinery, and a reinforced scrap pile, and the Pump Room below behind a two-tile doorway (the goblin fits, the Matron doesn't)
- [x] **Pump Matron** (`src/game/boss.ts`): asleep until you walk in; phase 1 is "get behind her"; at 60% she seals her shell, turns faster, and calls up to two Bone Mites from the vent farthest from you; the two steam valves get pressure (7s cooldown), and a blast flips her for 3s with her belly taking double damage. Steam scalds mites too. When she falls her mites slink off (no loot), she drops the Flywheel Coil and 3 copper, and the drain gate opens. If the coil gets left behind, it waits in the lair.
- [x] Goblin Cooperative: Grubb takes Supply Order #1 (4 Dried Rations, 2 Slime Cells, fetched from your crate by a Union rat) and stamps the Charter; the Hatch opens once you've met Grubb
- [x] Trading (`src/game/trade.ts`, `src/ui/trade.ts`): Dorrit buys processed goods at falling prices (15% a sale) with demand reset by the Shift Bell, raw materials for 1 button; she sells Truffle Spores, bottles, cloth, the Bottle Bandolier (bottles stack to five), and three decorations (Wall Clock, Wax Fern, "EST." Plaque)
- [x] Charter steps 4–6, the stamp ceremony (`StampOverlay`), "CHAPTER ONE COMPLETE", and free play afterward: occupancy rights are paid off at Grubb 25 buttons at a time toward 600, and the Ledger tracks it
- [x] Skill milestones from DESIGN §10 all hooked up, and a data test checks every one gates something real
- [x] Beetle and Pump Matron behaviors (`chaseTurning`, armored fronts, stun and flip, sealed shells)
- [x] **(T)** Economy and softlocks: no buy→craft→sell loop makes a profit (`tests/data.test.ts`); a worst-case resource-budget simulation reaches Stamp #1 from a fresh save in 3 shifts using only what refills each shift (`tests/budget.test.ts`); a dry generator never blocks basic recipes, and trading, occupancy, the bandolier, and the generator are covered in `tests/trade.test.ts`; the beetle and the Matron in `tests/pumpworks.test.ts`

**Play-test (bot runs against the Pump Matron on the real Pump Room map, 6 runs per style):** before tuning, a bot that just circled behind her won in about 23s losing 0–2 half-hearts, even without ever rolling: she turned at the same speed the goblin circles, so she never faced it, and the valves were pointless. A faster phase-2 turn alone didn't fix it (hugging her back still worked). Now her shell seals in phase 2, so the valves are the way through: valve users win every run in 29–47s losing 0–6 half-hearts (about 2 on average), and bots that ignore the valves can't win. Tuning: 80 health (was 60), hits for 2 half-hearts (was 3), turns 40% faster in phase 2. Standing in the doorway is safe, but nothing gets hurt from there.

**Done when:** a fresh save can reach Stamp #1, and the automated softlock test agrees. *(Both true: the budget test, plus a run through generator → cells → order → stamp → trading in the browser.)*

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
- [x] Balancing pass against the §17 pacing timeline: the Matron bot runs above; the budget simulation shows materials never hold the chapter back (3 shifts on the worst case); the critic play-through below covers how it feels
- [x] Accessibility: rebindable keys (Settings → Controls; Esc cancels, conflicts swap, reset to defaults), a screen shake toggle, colorblind-safe awareness icons (shape + color)
- [x] Fills the screen: the view widens or deepens to the window's shape (480–640 by 270–360 game pixels), scaled with sharp pixels and no black bars; fullscreen on the first key press (Settings → Fullscreen, or Alt+Enter)

**Done when:** a fresh player can go from title screen to Stamp #1 in 60–90 minutes without reading the docs.

---

## Critic play-through (after M6/M7)

A fresh critic played from the title screen to free play and filed 22 findings. What changed:

- **The HUD hid the play area.** The camera can now look 36px past the top of a map, so top rows sit below the HUD. The objective and tracker fade out when the goblin, what it would use, a creature, a person, or speech is behind them. World prompts, speech, and damage numbers draw on top of the panels.
- **Pacing.** The Scrap Workbench needs 3 Slime Gel, so step 3 takes a first trip into the Cistern. The Pump Room is now entered the long way round, across the beetle hall and down the east corridor, so you meet armored fronts before the boss. The old doorway is the drain gate shortcut, opening when she's beaten. The step-4 objective and Grubb now give the route. *(Still likely under 60–90 minutes for a quick player; more content is the real fix.)*
- **A full pack lost things.** Floor items are now kept per region until the Shift Bell, across trips and reloads (`save.floor`). The pack has a Drop key (X), which puts the stack in the crate at home. Dropped things stay put until you walk away. The pack-full toast names the item and says what to do.
- **The stealth lesson was easy to miss.** The story contract is every shift's event until it has played. It starts 15 seconds into the Galleries, or as soon as you go near the nest.
- **Boss clarity.** She rears up for 2.4s on waking, so the title card can be read. A ready valve marks where its steam will land. A used valve shows a ring of pressure filling back up, and its prompt counts down. The hint says the steam goes straight down.
- **Hints.** Movement shows at wake-up. Fight, sneak, eat, throw, armor, and valve hints jump the queue, and hints for things you've already done are dropped.
- **Mods.** The first mod you craft is equipped, and the HUD shows the equipped mod. The pack's cursor skips empty pockets.
- **Readability.**
  - Bare numbers lose the drop shadow that filled in 5s and 8s.
  - Hiding heaps show an eye as you come near.
  - Searched piles are faded.
  - The HATCH sign fits its plate, and the Board's notice no longer has a clipped word.
  - The map draws passages solid, crawl pipes dotted, shut ways dashed, and the way home in gold. Two links between the same regions sit side by side, and there's a drawn legend.
  - 5:4 windows fill too (the view can be up to 384px tall).
- **Smaller fixes.**
  - Dialogue choices you've asked are dimmed and skipped.
  - The trip summary lists every region visited and leads with any Charter steps finished.
  - Dorrit sells Copper Parts (6 buttons), so buttons matter before the stamp.
  - Decorations have icons.
  - A decoration's real lock reason shows before "Not enough buttons".
  - The empty-nest bark now plays when the heroes didn't clear the nest themselves.
  - The Pumpworks entrance mite moved further in.
  - The Cistern's dead-end crawl nook is a real tunnel.
  - The grinder spot moved away from the workbench.
  - The intro charter shows six steps, and Grubb lists six.
  - The title's small print waits for the menu.
  - Text fixes: tab names (GROW/DRY/GRIND), queued-job times, repeated toasts fold into one, the receipt, Grubb's crate line, the spoons, and the Controls heading.
- **Not done:**
  - The tracker isn't collapsed to one line outside the Burrow (fading covers most of it).
  - The Pumpworks isn't gated behind a crafted item.
  - There's no early button-paying order.
  - Parties are still dangerous once they've seen you; the fix there is more escape routes, not weaker heroes.

---

## Art overhaul track
*Generated pixel art for every character, map, prop, icon, and portrait, within 350 PixelLab generations. Plan, style guide, and ledger: `docs/ART_PLAN.md`.*

- [x] **A0 Pipeline:** `loadArt()`, `SheetSprite`, code-art fallbacks, the pack/fetch/contact scripts, and **(T)** `tests/art.test.ts`
- [x] **A1 Style anchor:** the goblin at 24px with walk, idle, sneak, roll (3 directions) and knocked out; the launcher stays code-drawn
- [ ] **A2 Terrain:** dual-grid floor, water, and wall layers for all five maps *(done)*; decal sheet; restyled pipes, gates, and exits
- [x] **A3 Creatures:** rat, slime, slimelet, mite, beetle, Pump Matron (crawls and belly-up flips; no separate bite, lunge, or rearing animations yet)
- [x] **A4 People:** Grubb, Dorrit, paladin (shield raise), ranger, apprentice (cast), inspector, guard
- [x] **A5 Props and stations**, every Burrow upgrade state included: 40 props, 66 states, lettering drawn by code
- [x] **A6 Icons and HUD:** 22 item and 3 decoration icons at 16px, with every list, chip, toast, card, and floor pickup laid out for them. The Brass Button and hearts stay code, sized to sit in text rows
- [x] **A7 Portraits:** all eight busts, with talking and blinking drawn over them
- [x] **A8 Title and intro:** a painted title (Bellmarket at dusk over the underground and the lit cave) and six painted intro panels; bells, rubbish, the party, drips, and lights animate on top, and the code backdrops stay as the fallback

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
