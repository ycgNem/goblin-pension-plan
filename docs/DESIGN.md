# Goblin Pension Plan — Design

> Heroes go into the dungeon to take its valuable things. You live there, and you know what everything they leave behind is worth.

A single-player, top-down action RPG for the browser. You play a low-ranking goblin turning a soggy maintenance alcove under the city of Bellmarket into a self-sufficient underground home and workshop.

**Pillars**

1. **Everything has a use.** Value comes from knowing what rubbish can become.
2. **Small is an advantage.** You're weak by normal standards and very good at this particular environment.
3. **The home visibly gets better.** Every trip should change something you can see.
4. **Fast, readable action.** Responsive movement, dodging, telegraphed attacks, short expeditions.
5. **The world is serious; the goblin is practical.** That gap is where the humor comes from. Jokes stay short.

Numbers in this document show intent. The authoritative values live in `src/data/`.

---

## 1. Changes from the original pitch

These are deliberate changes or additions to the source brief:

| Change | Why |
|---|---|
| **Five skills, not six.** Mining folds into **Scavenging**, brewing folds into **Cooking**, and combat is called **Scrapping**. | The brief allows it, and five skills with real milestones beat six thin ones. |
| **Skills cap at level 10 in Chapter 1**, with a named unlock at most levels. | RuneScape-style "ding" moments without padding levels out to 99. |
| **The Shift Bell.** The world runs on *shifts* of about 8 minutes of active play. A bell rings overhead at each change. | It gives adventurer parties a predictable schedule, resets trader demand (the anti-exploit cap), and paces mushroom growth. The world clock only moves while you're playing, so there's no offline decay. |
| **The Activity Board** at the trading hatch: a pinned city notice listing this shift's adventurer contracts ("Beginner Contract: clear rat nest, Refuse Galleries. *Low-level content.*"). | It handles the brief's "check local activity reports" and the fairness rule about advance warning, and it's a natural place for jokes. |
| **Sneak (hold Shift).** Slower, quieter movement, and it lets you hide in tall rubbish. | Stealth needs an input the player chooses on purpose. Otherwise hiding happens by accident. |
| **Brass Buttons** are the currency. | City coin is "legally complicated" for goblins. Buttons are small, shiny, and endless. |
| **Boss: The Pump Matron.** A huge Scrapback Beetle that has grown the pump's copper flywheel into her shell. | The boss tests a mechanic you already learned (armored front, weak rear) and adds steam valves you can turn on her. The flywheel coil she's guarding is the generator component. |
| **The Rat Union.** When you're defeated, a union of drain rats drags you home and takes a cut of your common materials as a fee. | Defeat gets a tidy in-world explanation and a clear loss screen. |
| **The Retirement Ledger.** The campaign checklist is an actual in-game ledger, joke lines and all ("Own Two Bowls"). | It answers "what am I building toward?" at a glance. |
| **No game engine.** Strict TypeScript, Vite, raw Canvas 2D, and Vitest for logic tests. | The brief says to avoid unnecessary dependencies, and a top-down tile game doesn't need an engine. |
| **The Guild survey.** The story's clock: the Adventurers' Guild has listed the goblin's alcove as "suitable for beginners". A chartered burrow is a premises, and premises aren't content (Grubb's bylaw nine). | The Charter needed stakes. Now every wall you patch is also a legal argument, and the villain is paperwork, not a dragon. |
| **A presented game, not a prototype.** A title screen, an illustrated intro, a chapter card, a wake-up, dialogue with portraits, music, and lighting. | First impressions decide whether a small game feels established. The opening should feel authored from the first second. |
| **Generated pixel art** (from the art overhaul, `docs/ART_PLAN.md`), replacing the original art drawn in code. Characters, terrain, props, icons, and portraits come from PixelLab under one style guide; effects, telegraphs, and lighting stay code. | The code art proved the game; it couldn't make it look established. A small dependency-free pipeline keeps the old benefits: one style, a tested manifest, and a build that's still small. |

---

## 2. Premise

Bellmarket is a prosperous trading city. Beneath it lies an old underground complex that started as mines and waterworks. Then came crypts, cells, sealed magic labs, and generations of badly documented building work. Everyone upstairs just calls it **the dungeon**.

- To the **city**, it's a nuisance, a waste disposal system, and a source of relics.
- To **adventurers**, it's a paycheck and a reputation.
- To **monsters**, it's territory.
- To **goblins**, it's home.

You live in a disused maintenance alcove between the city drains and the dangerous lower floors. You own a bent tool, a leaking cooking pot, and a sign that reads **NOT A LAIR**. You don't plan to die so someone upstairs can finish a beginner quest.

**Your goal:** own your home, grow your food, build reliable tools, and become secure enough that scavenging is a choice, not a necessity.

### Why the city and the dungeon need each other

- **City → upper dungeon:** rubbish chutes, discarded equipment, sewers, merchant storage basements, abandoned infrastructure, and supplies adventurers drop. This explains the scavenging economy.
- **Dungeon → city:** ore, alchemical ingredients, relics, slime reagents, cleared passages, monster parts. This explains why adventurers keep coming back.
- **Why it never empties:** the tunnels are huge, creatures migrate up from below, and magical contamination keeps causing problems. The city maintains the upper routes but can't control what's below them.
- **Goblins live in the gaps:** maintenance passages, abandoned rooms, drainage channels, and spaces humans can't fit through.

### The story of Chapter 1

The goblin has lived in the alcove for forty years. It leaks. It is home.

1. **The survey.** This morning, the Adventurers' Guild added a new address to its survey list: *"Goblin alcove, Refuse Galleries. Unlicensed. Suitable for beginners."* Status: pending. (The intro shows the notice being stamped.)
2. **The way out is paperwork.** Only a chartered burrow is off the Guild's books, and charters come from the Goblin Cooperative. The goblin applied. **Registrar Grubb's letter** is waiting by the door when you wake up: the alcove has holes, no food, no workshop, and no power. Fix these, then come and see him.
3. **The lesson.** On your first trip into the Galleries, a beginner party comes down for the rat contract. It's the stealth tutorial, and it always happens live: hide, watch, and loot what they leave.
4. **Meeting Grubb.** After the first three Charter steps, the objective sends you through the crawl pipe to the Cooperative. Grubb explains bylaw nine ("Premises are not content. I wrote bylaw nine.") and unblocks the pipe behind his office, a shortcut home. Dorrit runs the Hatch; it's shut until her merchant comes back from Lowmarket.
5. **Power and proof.** The generator needs the flywheel coil from the Old Pumpworks, where something large is sitting on it (M6). One order filled for the Cooperative, and Grubb stamps the Charter: *Recognized Workshop*. The Activity Board withdraws the survey.

The Retirement Ledger keeps the longer goal in view: food, power, a workshop, then (in later chapters) a protected entrance, a trading partner, and occupancy rights.

---

## 3. Goal structure

### Immediate goals (minutes)
Find fungus for dinner. Recover scrap for a weapon mod. Sneak past a patrol. Bring home slime for a machine. Harvest a crop. Fill a small barter order.

### Session goals (one or two expeditions)
Build a production station. Upgrade the backpack. Open a shortcut. Unlock a recipe. Kill a monster guarding resources. Decorate a repaired room.

### Campaign goal: the Self-Sufficient Burrow
The **Retirement Ledger** tracks six pillars:

1. **Secure food production:** mushroom beds plus a drying rack.
2. **Reliable workshop power:** a running slime generator.
3. **A functioning workshop:** a workbench plus two processing stations.
4. **A protected home entrance:** a reinforced goblin door (Chapter 2).
5. **A trade relationship:** reach "Trusted" standing at the hatch (Chapter 2).
6. **Occupancy rights:** a one-time payment of **600 Brass Buttons** to the Goblin Cooperative (Chapter 3). This is a fixed price, not a rising target.

Plus jokes that also really are ledger entries: *Own Two Bowls. Sleep through one night without being stepped on. Have at least one legal wall.*

Retirement unlocks free play afterward. It doesn't mean there's nothing left to do.

### Chapter 1 (the vertical slice): *"A Recognized Workshop"*
Turn the starting alcove into a recognized workshop and earn your **first Burrow Charter stamp**. Registrar Grubb at the Cooperative requires:

1. **Repair the home.** Patch the holes: "at least one legal wall."
2. **Build a mushroom bed.**
3. **Construct a scrap workbench.** Repair the broken one.
4. **Recover a power component.** Take the Flywheel Coil from the Pump Matron in the Old Pumpworks.
5. **Activate the slime generator.**
6. **Complete a production order:** deliver 4 Dried Glowcap Rations and 2 Slime Cells to the Cooperative.

Completing all six earns Stamp #1, a short celebration, the ledger updating, and free play continuing.

---

## 4. The Burrow (home)

A protected alcove reached through a passage humans can't fit through. **It's always safe.** No raids, no building destruction, no rent, no offline decay.

**Starting state:** a bed made of sacks, one storage crate, a tiny wild mushroom patch, a broken workbench, a miserable cooking pot, and the NOT A LAIR sign. The walls have boarded-over holes that let in drafts and green dungeon light.

**Upgrades are visible.** Each upgrade changes the tiles or props drawn in the Burrow:

- Boarded holes → patched walls → proper walls with a shelf
- One candle stub → a scrap lantern → warm pipe-fed lamps
- A wild patch → a framed mushroom bed → rows of beds
- Loose machines → machines connected by pipes
- Empty walls → shelves of jars and tools
- Sacks → "Fewer Springs" mattress → an absurd four-poster made from a portcullis

**Functional and decorative upgrades sit side by side.** Decorations cost mostly common, low-value materials (timber, cloth, bones) and **never** copper or quest items, so decorating never slows progress.

**Lighting is the emotional barometer.** The Burrow starts as cold and green as the dungeon and warms up to orange as you upgrade it. The rest of the dungeon stays damp and green.

---

## 5. Core loop

```
PREPARE (seconds) → EXPEDITION (5–10 min) → RETURN → PROCESS → IMPROVE
     ↑                                                           │
     └───────────────────────────────────────────────────────────┘
```

- **Prepare:** deposit everything (one button at the crate), collect finished production, cook or grab food, check the Activity Board, and pin a goal or recipe.
- **Expedition:** pick a region based on what you need:
  - Refuse Galleries for scrap and timber
  - Fungus Cistern for food and slime
  - Old Pumpworks for copper and machine parts
- **Scavenge, fight, avoid:** gather, fight manageable creatures, read the signs that adventurers are near, hide or reroute, and loot what they leave behind.
- **Return:** walk back through a known exit or an unlocked shortcut. Each region has at least one way home that doesn't backtrack.
- **Process:** turn raw materials into food, equipment, building supplies, trade goods, and machine inputs.
- **Improve:** build something visible, unlock a capability, or make the next trip easier.

**The feeling to aim for:** *"I nearly got flattened by a paladin, but I found the copper piping for my indoor plumbing."*

**Expedition summary:** when you arrive home, a small card lists what you brought back and what it moved forward ("+12 scrap: Workbench 20/20 ✔").

---

## 6. People

Humans aren't just stronger monsters. Each type behaves differently.

### Adventurer parties (2–3 heroes)
- They enter through **city access points** marked by banners and grates with daylight coming through. They never spawn anywhere else.
- They follow a route toward a **contract objective** (clear a nest, reach a relic chamber, recover supplies, escort a worker), and that contract is posted on the Activity Board.
- They fight dungeon creatures they run into.
- They treat an armed goblin as an enemy *if they notice you*. They don't know where you are.
- **You're meant to avoid them.** They hit hard and their attacks have long, readable windups.

| Hero | Role | Telegraph |
|---|---|---|
| **Paladin** | Front-liner. Shield charge. | Raises shield and glows for 0.8s, then charges in a straight line. |
| **Ranger** | Ranged. Aimed shot. | A thin aim line tracks you for 1s, locks for 0.3s, then fires. |
| **Apprentice** | Area attack. Fire circle. | The ground circle fills in over 1.2s. |

### City workers
- The **Pipe Inspector** checks pumps, pipes, and drains. He doesn't want to fight. If he notices you, he backs away, blows a whistle (which calls a guard, if one is nearby), and may close a gate while he's working.
- The **Watch Guard** is slow, sturdy, and gives up quickly. He's paid by the hour, not by the goblin.

### The Hatch (trading)
**Dorrit Vane**, "licensed fence (unlicensed)", runs a trading hatch in the Cooperative wall that opens onto a merchant's basement. This one fixed trader is how the city becomes relevant without building a whole surface town.

### Goblin Cooperative
**Registrar Grubb** issues Burrow Charter stamps and production orders. He takes paperwork very seriously.

### Readable awareness states
Every human NPC shows an icon over its head:

| State | Icon | Behavior |
|---|---|---|
| Unaware | none | Follows its route. |
| Suspicious | `?` (yellow) plus a filling meter | Stops and turns toward the stimulus. |
| Searching | `?` (orange, pulsing) | Walks to the last known position and looks around. |
| Hostile | `!` (red) | Chases and attacks. |
| Returning | `…` (grey) | Walks back to its route. Re-detects you at a reduced speed. |

---

## 7. Stealth

Readable and forgiving. It's not a stealth simulator.

- **Vision cones** are drawn faintly on the ground. Line of sight is blocked by walls and solid props.
- **Suspicion builds** while you're in a cone. It fills faster when you're close, in the center of the cone, or moving fast. Sneaking fills it at half speed. When the meter is full, the NPC turns hostile.
- **Noise** shows up as expanding rings. Firing, dodging, smashing crates, and running all make noise. Sneaking makes almost none. Any NPC inside a ring gets suspicious and looks at where the noise came from.
- **Hiding spots** (tall rubbish, broken carts, barrels) hide you completely if you *enter them unseen*. A hostile NPC that saw you go in will search the spot.
- **Crawlspaces** are goblin-sized pipes and gaps. Humans can't follow. They give up at the entrance and go back to their route.
- **Throwables:** an Empty Bottle (found in refuse) makes a big noise ring where it lands. You can carry 3, or 5 later. You can also always throw a pebble for free, which makes a small ring, so distraction is never gated behind materials.
- **Losing interest:** once you break line of sight, a hostile NPC searches for 6 seconds, then goes back to its route. **Pursuit always ends**, including at region exits, which humans never cross while chasing you.

Not every enemy calls for stealth. Creatures fight in the open, and you're good at fighting creatures.

---

## 8. Adventurer events and opportunities

These events are lightweight and scripted, not a simulated society. Each one leaves behind a consequence you can see and act on.

| Event | Where | What it leaves |
|---|---|---|
| **The Beginner Contract.** A party clears the rat nest. | Refuse Galleries | Rat bones, smashed crates showing scrap, and a dropped cloth bundle. The corridor is safe afterward. |
| **Pipe Inspection.** The inspector opens the Cistern sluice gate for a while. | Fungus Cistern | A temporary shortcut toward the Pumpworks. A valve wheel lets you open it permanently later, so it never blocks progress. |
| **Noisy Fight.** A party fights slimes in the main Cistern hall. | Fungus Cistern | Nearby creatures get pulled toward the fight, leaving a side passage clear. |

**Fairness rules (these get tests):**
- Parties only enter from access points. You get a warning first: footsteps rumbling, speech bubbles ("Is this the rat one?"), and a notice on the Activity Board.
- Heroes never spawn in or near the player's view.
- Every patrol area has at least two ways out, and at least one of them is goblin-only.
- Pursuit always ends: a search timer, and NPCs don't cross region exits.
- NPCs never pick up loot. Battle leftovers are mostly low-value. Quest items are never placed where an NPC event could affect them.
- Waiting for NPCs is never better than playing. Leftovers are about one pile's worth.

---

## 9. Economy: everything has a use

### Raw resources (compact set)

| Resource | Sources | Uses |
|---|---|---|
| Scrap Metal | junk piles, broken weapons, machinery | tools, weapon mods, stations |
| Rotten Timber | crates, old supports | furniture, handles, wall patches |
| Glowcap | wild patches, home beds | food, trade goods |
| Brine Truffle | Cistern (Fungiculture 3) | better food, trade goods |
| Bones | creature remains | fertilizer, decorations |
| Slime Gel | slimes, drainage pools | slime cells, glue, generator fuel |
| Cloth Scraps | discarded supplies | bandages, satchel, furnishings |
| Copper Parts | old machinery (Scavenging 3) | generator, advanced crafting |
| Empty Bottle | refuse piles | throwable distraction |

### Anti-exploit rules
- **The trader only buys processed goods** at a meaningful price. Raw materials sell for 1 button, so turning them in is a last resort.
- **Demand per shift:** each item has a demand count per shift. Each unit you sell lowers the price by about 15%. Demand resets when the Shift Bell rings.
- **What the trader sells:** things you can't make, like spore packets, the satchel pattern, and decorations. Nothing it sells can be broken down into more than it cost.
- **No dismantling bought goods.** Bought items carry a `bought` flag and can't be salvaged.
- **Rare components** (the Flywheel Coil) come from known, clearly communicated objectives. They're never random drops.

---

## 10. Skills

| Skill | Gains XP from | Milestones (Chapter 1) |
|---|---|---|
| **Scavenging** | searching piles, crates, machinery | L1 junk piles · L3 **copper machinery** · L4 reinforced scrap piles · L6 +1 item from piles |
| **Fungiculture** | planting and harvesting | L1 Glowcap bed · L3 **Brine Truffle spores** · L5 **second mushroom bed** |
| **Tinkering** | crafting at the workbench, building | L2 **Nail Spread** mod · L3 **Patched Satchel** · L4 **Slime Shot** mod · L5 Bone Grinder |
| **Cooking** | cooking and drying | L1 Glowcap Skewer · L2 Drying Rack · L3 **Truffle Stew** · L5 "Stinkbrew" (repels creatures) |
| **Scrapping** | defeating creatures | L2 faster dodge recovery · L4 **charged shot** (hold right mouse) · L6 **+1 heart** |

XP curve: level `n` needs `round(40 * n^1.6)` total XP, which is quick early on. Chapter 1 should end with most skills around level 4 to 6. **No endless tiny percentage bonuses.** Every milestone is a new thing you can do.

---

## 11. Home production

Machines are simple: short timers, small queues, visible progress.

| Station | Input → Output | Time | Power |
|---|---|---|---|
| Mushroom Bed | 1 spore or glowcap → 4 glowcaps | 150s (75s with fertilizer) | none |
| Drying Rack | 2 glowcap → 1 Dried Glowcap Ration | 30s, queue 4 | none |
| Bone Grinder | 3 bones → 1 Fertilizer | 20s, queue 4 | 1 charge |
| Slime Generator | 1 slime gel → 5 charge (holds 20) | instant | — |
| Workbench | recipes | instant | some recipes cost charge |

- **Production only advances while you're playing**, at home or away. No offline punishment.
- **Basic crafting never needs power.** Running out of slime slows advanced production; it never softlocks the game. Slime pools in the Cistern respawn every shift.
- No crop death, no mandatory eating, no explosions.

---

## 12. Combat

**Controls:** WASD to move · mouse to aim · LMB to fire · hold right mouse for a charged shot (Scrapping 4) · Space to dodge roll · E to interact · Q to quick-eat · F to throw · hold Shift to sneak · Tab for pack and ledger · M for map · Esc to pause.

**The Scrap Launcher** is your one polished weapon, with unlimited basic shots (about 3 per second, light knockback). There's no ammo farming. Mods change how it fires; you equip one at a time:

- **Nail Spread:** 3 weaker nails in a cone.
- **Slime Shot:** slows the target by 40% for 2s. Slower rate of fire.
- **Ricochet Bolt** (Chapter 2): bounces off walls once.

**Dodge roll:** 0.3s, invulnerable for the first 0.26s (enemy shots pass straight through you), a short cooldown, and a little noise. A roll pressed just before the cooldown ends still comes out.

**Health:** 5 hearts (half-heart granularity). Food heals: Glowcap Skewer +1, Dried Ration +2, Truffle Stew +4. **Q** eats the best food you're carrying. Arriving home restores full health.

### Creatures

| Enemy | Behavior | Counterplay |
|---|---|---|
| **Drain Rat** | Fast approach, stops, flashes, then lunges with a bite. Comes in packs of 2–4. | Dodge sideways during the flash. |
| **Slime** | Slow. When killed, splits into 2 small slimes that fire short-range gel blobs. | Keep moving. Kill the small ones fast. |
| **Bone Mite** | Short burst charges in straight lines with a shake beforehand. | Sidestep, then punish during its recovery. |
| **Scrapback Beetle** | Armored front blocks shots with a spark effect. Turns slowly. Back is exposed. | Circle around and hit it from behind. Nail Spread helps. |

**Fairness rules** (enforced in code and covered by tests):
- Creatures only hurt you with their telegraphed attack. Touching one does nothing.
- At most two creatures wind up or attack at once. The rest circle and wait their turn.
- Light creatures (rats, slimelets) can be shot out of their windup. Heavy ones (slimes, mites, beetles, the Matron) can't, so you dodge them instead.
- A chaser that loses sight of you heads for where it last saw you, gives up after 3 seconds, and goes home.
- Creatures you defeat stay gone until the next Shift Bell.

### Boss: The Pump Matron
A huge Scrapback with the pump's copper flywheel grown into her shell. She nests in the Old Pump Room.

- **Phase 1:** slow turning charges. Her armored front blocks every shot. Get behind her.
- **Phase 2 (at 60% health):** she clamps her shell shut all the way round, turns faster, and calls Bone Mites from vents. Two **steam valves** on the walls can be turned with E to blast steam down into the room, which stuns her for 3s and flips her onto her back so her belly is exposed (double damage). Flipping her is the only way through her shell, so phase 2 asks for the valves instead of more circling.
- **Defeat:** the flywheel falls off her shell, and you get the **Flywheel Coil**. The pump room becomes a safe shortcut back to the Cistern.
- If you lose, the fight resets (the Rat Union rule applies). Her health doesn't carry over.

---

## 13. Risk, inventory, and defeat

**Kept permanently:** skills, crafted equipment, buildings, recipes, quest progress, stored materials, buttons.

**Pack:** 6 slots of up to 20 each, or 9 slots with the Patched Satchel. Resources stack. Quest items take no slot. Items are grouped into categories: Materials, Food, Throwables, Quest.

**Quick deposit:** one press at the Burrow crate stores every material.

**Defeat ("The Rat Union"):** you wake up in the Burrow. A union rat hands you a receipt: *"Retrieval fee: 50% of common materials carried (rounded down)."* The receipt lists exactly what you lost. You keep food, throwables, equipment, quest items, and buttons. No permadeath, no gear damage, no corpse runs.

---

## 14. The world map (Chapter 1)

Five hand-built regions joined by exits. It's compact, connected, and full of landmarks.

```
                     [ City access grate ]           [ City access grate ]
                              │                               │
 ┌─────────────┐   main   ┌───────────────────┐  main   ┌────────────────┐
 │  THE BURROW │═════════>│ REFUSE GALLERIES  │════════>│ FUNGUS CISTERN │
 │   (home)    │<──crawl──│ chutes, junk,     │         │ slime pools,   │
 └─────────────┘          │ rat nest, carts   │         │ glowcaps,      │
       │ crawl            └───────────────────┘         │ sluice gate    │
       │ (unlocked by        │ crawl                    └────────────────┘
       │  Galleries map)     ▼                             │ crawl ┊ sluice (event/valve)
 ┌─────────────────┐   ┌──────────────┐                    ▼       ┊
 │ GOBLIN COOP     │<──│ (crawl pipe) │              ┌────────────────┐
 │ Grubb, the Hatch│   └──────────────┘              │ OLD PUMPWORKS  │
 │ Activity Board  │                                 │ copper, beetles│
 └─────────────────┘                                 │ PUMP ROOM (boss)│
                                                     └────────────────┘
                                         after boss: pump drain → Cistern shortcut
```

- **The Burrow:** safe home and production.
- **Refuse Galleries:** rubbish from the city chutes, introductory scavenging, rats, the first adventurer encounter. Landmark: a giant fallen chandelier.
- **Fungus Cistern:** Glowcaps, slime pools, Brine Truffles, the Pipe Inspector event. Landmark: a flooded statue of a city founder with a mushroom growing on its head.
- **Old Pumpworks:** dangerous. Copper machinery, beetles, mites, and the Pump Room boss. Landmark: an enormous seized piston. The way down from the Cistern starts with a crawl pipe, so nobody follows you in.
- **Goblin Cooperative:** safe trading space, reached by a crawl pipe from the Galleries. Registrar Grubb, the Hatch, and the Activity Board.

**Map screen (M):** a schematic node graph of discovered regions, exits, and shortcuts, with a "You are here" marker and a "home" route highlight.

---

## 15. Presentation

- **Rendering:** the game draws to a low-resolution canvas, 480×270 at its smallest, that widens or deepens to the window's shape (up to 640×360), so it always fills the screen with no black bars. It's scaled up "sharp bilinear": nearest-neighbor to the next whole multiple, then smoothly down to the window, so pixels stay crisp at any size. Tiles are 16×16. Title, intro, and windows are laid out on a centered 480×270 stage. Text goes on a second, full-resolution canvas on top (Pixelify Sans for body text, Silkscreen for headings), so it stays sharp at any scale. The game goes fullscreen on the first key press (a setting), and Alt+Enter toggles it.
- **Palette:** damp stone greys, rusty oranges, sickly dungeon green (`#7fbf5a` glow on `#1a1f1c` stone), and warm home orange (`#f0a040`). Each region has its own floor and wall style: dirt and rough stone at home, flagstones and brick in the Galleries, wet blocks in the Cistern, riveted plates in the Pumpworks, planks and plaster with sock bunting at the Cooperative.
- **Lighting:** each region has a darkness level. Lights (the goblin's own glow, torches, the grate, lanterns, the pot fire, glowcaps, muzzle flashes) are banded, dithered sprites added onto a light map, which is multiplied over the scene, with a soft glow added on top. The Burrow's darkness warms as it gets cozier. A frame vignette is always there; red edge glows mean you're hurt, on your last heart, or spotted.
- **Art:** drawn in code. Characters and icons are string sprites with 3-tone shading and outlines. Props, portraits, and backdrops use a small pixel painter (whole-pixel shapes, ball shading, outlines) and are cached on first use. The Burrow has hand-placed set dressing (a braided rug worn thin in the middle, chalk tallies and a drawing of a house, roots, cobwebs, rubbish) so it looks lived in from the start.
- **The opening:** a title screen (the city at dusk, then a pan down to one lit alcove), six illustrated story panels with typewriter narration, a chapter card, and waking up in the Burrow with a letter by the door.
- **Dialogue:** portrait boxes with typewriter text, per-character voice blips, and choices.
- **Audio:** procedural WebAudio sound effects and a small music sequencer. Each region has a track; a danger track takes over while a hostile human can see you; the Burrow's track gains layers as it gets cozier. No audio files.
- **Ambience:** dust motes at home, falling grit in the Galleries, spores and drips in the Cistern, steam in the Pumpworks, each with its own occasional sound.
- **Humor:** item names and one-line descriptions. Examples: the "Fewer Springs" mattress; a shield used as a frying pan; the Activity Board calling your neighborhood "low-level content"; "Own Two Bowls"; "at least one legal wall."

---

## 16. UI: always answer these six questions

| Question | Answer on screen |
|---|---|
| What am I trying to build? | A **pinned objective** at the top left, plus an optional **tracked recipe** showing have/need counts. |
| Where are its missing materials? | The tracked recipe shows each material's source region ("Copper Parts: Old Pumpworks"). |
| Are adventurers nearby? | An **activity warning strip** ("Footsteps above: party entering Refuse Galleries"). |
| Am I being noticed? | Icons and meters over NPC heads, plus a red edge vignette when you're spotted. |
| How do I get home? | The map screen, plus an "exit" marker on the edge of the screen pointing toward the nearest exit home. |
| What did this trip improve? | The expedition summary card when you get home. |

Also: pickup toasts ("+3 Scrap"), skill-up banners, a confirmed save reset in the pause menu, and autosave on every region change and every craft.

---

## 17. First-session pacing (first 15–20 minutes)

1. **0:00** Wake up in the Burrow. Grubb's letter is pinned to the door: *"Re: Your Alleged Residence."* The objective is to patch the holes.
2. **0:30** Enter the Refuse Galleries. Search junk piles for scrap and timber. A little later, a rat pack attacks (first fight).
3. **4:00** Footsteps overhead. A party enters for the Beginner Contract. You hide behind a cart or slip into a crawlspace while they clear the rat nest. Afterward you loot the smashed crates.
4. **7:00** Return home. Craft a Board Patch and patch the holes. **The Burrow visibly changes** (warmer light, fewer drafts). Charter step 1 is done.
5. **9:00** Repair the workbench (step 3). Its fourth leg is glued on with slime, so it means a first trip into the Fungus Cistern.
6. **12:00** Find the crawl pipe to the Cooperative. Meet Grubb and the Hatch. Read the Activity Board.
7. **15:00** Visit the Cistern for slime and glowcaps. Build the mushroom bed (step 2). The Pipe Inspector event shows you the sluice shortcut.
8. **20:00+** Pumpworks, copper, the boss, the generator, the production order, and the stamp.

The whole chapter takes about 60 to 90 minutes.

---

## 18. Out of scope for the first build

Multiplayer, backend services, faction politics, a simulated city, base raids, hunger meters, equipment durability, procedural generation, and permadeath.
