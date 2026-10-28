# Goblin Pension Plan

A top-down action RPG about a low-ranking goblin turning a soggy maintenance alcove under the city of Bellmarket into a self-sufficient underground home and workshop. You scavenge, fight, sneak past adventurers, craft, and watch the Burrow get cozier.

This morning, the Adventurers' Guild put the goblin's home on its survey list. Only a chartered burrow is off the Guild's books, and charters come from the Goblin Cooperative, with paperwork.

**Status:** M0–M5 are done, plus a presentation pass: a title screen, an illustrated story intro, a chapter card, dialogue with portraits, lighting, music, and a lived-in Burrow. You can play from the title screen through Grubb's letter, the first adventurer contract, building the first Charter steps, and meeting Grubb. The Pumpworks boss, the generator, trading, and Stamp #1 are M6. See [docs/MILESTONES.md](docs/MILESTONES.md).

## Run it

```bash
npm install
npm run dev        # http://localhost:5180
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload, on port 5180 |
| `npm test` | Vitest: data, maps, collision, pathing, combat, creatures, inventory, saves, crafting, production, stealth, events, story |
| `npm run typecheck` | Strict TypeScript check |
| `npm run build` | Typecheck, then production build into `dist/` |

## Controls

| Key | Action |
|---|---|
| WASD / arrows | Move |
| Mouse | Aim |
| Left mouse (hold) | Fire the Scrap Launcher |
| Right mouse (hold, release) | Charged shot (needs Scrapping 4) |
| Space | Dodge roll |
| Shift (hold) | Sneak: slower, quieter, and slower to be noticed |
| E | Interact: talk, read, open, build. Hold to search a pile; press to smash a crate. |
| Q | Eat (picks the smallest food that covers the damage) |
| F | Throw a pebble, or a bottle if you have one. People go and look where it lands. |
| Tab | Pack, Charter and Retirement Ledger, skills, map (A/D to change page) |
| M | Map |
| T | In a station window: track the selected recipe or upgrade on the HUD |
| Esc | Pause: settings, controls, save and quit, reset save (asks first) |
| F3 | Debug overlay |

With the debug overlay open: **G** toggles the region's gate, **N** skips to the next shift, **H** heals, **T** cycles launcher mods, **K** puts 10 of every material in storage, and **V** starts this shift's event if it belongs to the region you're in.

## Docs

- [docs/DESIGN.md](docs/DESIGN.md): the game design, the story, and changes from the original pitch
- [docs/CONTENT.md](docs/CONTENT.md): cast, voice rules, and all the scripted text
- [docs/MILESTONES.md](docs/MILESTONES.md): M0–M7 build plan with "done when" checks and the test checklist

## Layout

```
src/
  main.ts            boot: fonts, screen, input, app, the game loop
  app/               the screens around the game: title, story intro, chapter card, and their backdrops
  core/              loop, input, screen scaling, settings, math
  audio/             procedural sound effects and the music sequencer (WebAudio, no files)
  data/              ALL tunable content: items, nodes, recipes, upgrades, creatures, events, skills, regions, charter, story
  world/             tile legend, ASCII maps (maps/), tilemap, collision, line of sight, pathing
  game/              Game (regions, modes, interaction, events, HUD glue), player, creatures, people, scene,
                     inventory, crafting, production, director, save
  render/            terrain and set dressing, lighting, ambience, entities; art/ holds sprites, props, icons, portraits
  ui/                HUD drawing (sharp text on a full-res overlay canvas), toasts, and every window: dialogue,
                     cards, station, storage, menu, pause
tests/               Vitest suites, plus helpers for building test rooms and scenes
```

## Tech

Strict TypeScript, Vite, raw Canvas 2D, Vitest. No game engine. The only runtime dependencies are two open-licensed fonts (Pixelify Sans and Silkscreen, via Fontsource). The game draws to a 480×270 internal canvas, scaled up by a whole number so pixels stay crisp, with text on a second full-resolution canvas on top. All art is drawn in code. The simulation runs at a fixed 60 Hz. Saves go to `localStorage`, with versioning and guards for when storage isn't available.
