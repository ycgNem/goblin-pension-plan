# Goblin Pension Plan — Content & Writing Bible

Item, recipe, enemy, and upgrade **stats** live in `src/data/`. This file holds the voice, the characters, and the scripted text.

## Voice rules

- **The world is serious; the goblin is practical.** Nobody winks at the camera.
- **One line per joke.** Item descriptions are at most 80 characters. Speech bubbles are at most 50.
- **Jokes come from goblin logic,** like using something for a job it wasn't designed for, or taking paperwork too seriously. No memes and no modern slang.
- Adventurers talk like heroes in a quest log. Workers talk like people on shift. Goblins talk like small-business owners.

## Cast

| Name | Role | Voice | Sample line |
|---|---|---|---|
| **You** (unnamed goblin) | Player | Never speaks. Only appears in item names you "wrote" ("Grubb's Letter (annotated)"). | — |
| **Registrar Grubb** | Goblin Cooperative clerk. Issues charter stamps. | Bureaucratic, proud, kind underneath. | "A home requires at least one legal wall. I checked." |
| **Dorrit Vane** | Human fence at the Hatch. | Dry, quick, unbothered. | "Buttons only. Coin has paperwork." |
| **Union Rat (Local 12)** | Takes your materials when you're defeated. | Tired professional. | "Sign here. And here. Fee's standard." |
| **Sir Aldous Brightmantle** | Paladin. Leads the Beginner Contract party. | Earnest, loud. | "Stay sharp! Rats are cunning!" |
| **Wren** | Ranger | Bored. | "This is the third rat contract this week." |
| **Pemberton** | Apprentice mage | Nervous, keeps notes. | "Is it a goblin or a big rat? For the report." |
| **Inspector Hobb** | Pipe Inspector (city worker) | Wants to go home. | "Not paid enough for goblins. Not paid enough for pipes." |
| **The Pump Matron** | Boss | Doesn't speak. Clanks. | — |

## Scripted text

All of this lives in `src/data/story.ts` (and `src/data/events.ts` for the Board). This section mirrors it; when they disagree, the code wins.

### The intro (six illustrated panels)
1. *(The city at dusk.)* Bellmarket is a city of bells, ledgers, and very clean streets.
2. *(A rubbish chute.)* Everything it throws away goes down.
3. *(A party with torches.)* Down there, it becomes the dungeon. Heroes go down for treasure. Mostly they find rubbish, and never ask what it is worth.
4. *(The alcove.)* One goblin knows exactly what it is worth. For forty years, home has been a maintenance alcove behind the Refuse Galleries. It leaks. It is home.
5. *(The survey notice, stamped PENDING.)* This morning, the Adventurers' Guild added a new address to its survey list.
6. *(The Burrow Charter.)* Only a chartered burrow is off the Guild's books. Charters come from the Goblin Cooperative. Charters require paperwork.

Then the chapter card: **Chapter One: A Recognized Workshop.** *Get the Burrow recognized before the Guild surveys it.*

### The Guild survey notice
> **GUILD SURVEY**
> Goblin alcove, Refuse Galleries. Unlicensed. Suitable for beginners.
> Status: PENDING

### Grubb's letter (by the Burrow's door)
> *Office of Burrow Charters*
> **RE: YOUR ALLEGED RESIDENCE**
> Your application for a Burrow Charter has been received, and read twice.
> The Cooperative cannot recognize this alcove as a home. It has holes, no food source, no workshop, and no power. Fix these. Then come and see me.
> Note: the Guild has put your address on its survey list. A chartered burrow is a premises. Premises are not content. I would hurry.
> — Registrar Grubb
> *P.S. A home requires at least one legal wall. I checked.*

### Meeting Grubb
> **Grubb:** Ah. The alcove applicant. You got my letter. / You are smaller than your handwriting.

Then a menu: *[Ask about the survey]*, *[Ask about the charter]*, *[Leave]*.
- **Survey:** "The Guild posts contracts on anything unchartered. Rat nests. Flooded cellars. You." / "A chartered burrow is a premises. Premises are not content. Bylaw nine. I wrote bylaw nine."
- **Charter:** "Six requirements. Walls. Food. A workshop. Power. And one order filled for the Cooperative." / "Bring me proof and I stamp it. I enjoy stamping. It is the best part of the job."
- **Leave:** "One more thing. The pipe behind my office runs straight to your alcove." / "I have had it unblocked. Saves you walking through the rat district. Off you go." *(Opens the shortcut home.)*

Later visits: how many requirements are left ("I have my stamp ready. I always have my stamp ready."), a hint for the next step, and one rotating aside:
- "Have you met Dorrit at the Hatch? Do not buy the spoons."
- "The Guild sent a surveyor down last year. He is still in the Cistern. Probably fine."
- "I once stamped a form so hard the desk needed a charter of its own."
- "If the Union rats bring you home, sign the receipt. They are very particular about the receipt."

### Dorrit at the Hatch
> "Buttons only. Coin has paperwork." / "Hatch is shut till the merchant's back from Lowmarket. Bring me something processed when it opens." / "And don't bring me raw mushrooms. I can pick those up off the floor."

Later: "Still shut. Lowmarket's a long way, and he walks like a man paid by the hour."

### First visits (captions, shown once)
- **Refuse Galleries:** "Everything the city has finished with. Most of it isn't finished."
- **Fungus Cistern:** "Dinner grows on the walls here, if you're quick about it."
- **Old Pumpworks:** "Something big is clanking, and it isn't the pumps."
- **Goblin Cooperative:** "Lamplight, socks, and somebody who can say yes."

### Hints (each shown once, when it's relevant)
Move ("The mouse aims."), hold to search ("Rubbish is a resource."), smash crates ("It is loud."), the pack, fighting ("roll through attacks when they flash"), sneaking ("Tall rubbish and crawlspaces hide you."), eating, storing materials, building ("Glowing outlines are things you can build."), throwing ("People look where it lands."), and the map ("The map shows the way home.").

### Activity Board notices (Shift 1–3 rotation)
- **Beginner Contract:** "Rat nest, Refuse Galleries. Suitable for new adventurers. *Low-level content.*"
- **Maintenance Notice:** "Cistern sluice inspection this shift. Gate may be open. Please do not touch the gate."
- **Advisory:** "Slime activity reported in the Cistern main hall. Reward for gel samples."
- **Warning:** "Old Pumpworks closed indefinitely. Unidentified clanking."

### Hero barks
- On entering: "Formation! Rats ahead!" / "Is this the rat one?" / "Mind the puddles."
- On becoming suspicious: "Did something move?" / "Probably a rat. Probably." / "Is it a goblin or a big rat?"
- When hostile: "Goblin! Armed!" / "It has a launcher!" / "There! By the junk!"
- When giving up: "Lost it." / "Not in the contract." / "Back to the route."
- Contract done: "Nest cleared! Huzzah!" / "Third rat contract this week." / "Noting it down for the report."
- Nest already empty: "Somebody got here first." / "No rats. Do we still get paid?"
- Retreating: "Fall back! Regroup at the grate!"

### Inspector Hobb
- Working: "Pressure's fine. Pressure's always fine." / "Not paid enough for pipes." / "Gate open. Nobody touch it."
- When suspicious: "Hello? Union rat?"
- When fleeing: "*whistle* GUARD!"
- After the whistle: "Gate's shut. Union rules."

### Watch Guard
- Hostile: "Oi! You!" / "Stop right there!"
- Giving up: "Paid by the hour, not the goblin." / "Not my shift for this."

### Charter stamp ceremony
> Grubb inspects your paperwork for a long time, then stamps it once, firmly.
> "**Burrow Charter, Stamp One: Recognized Workshop.** Congratulations. You are now legally a nuisance."

### Rat Union receipt (shown on defeat)
> **RETRIEVAL RECEIPT, LOCAL 12**
> Recovered: one (1) goblin, unconscious.
> Fee: half of common materials carried.
> *[list of what was lost]*
> "Pleasure doing business."

## Retirement Ledger text

```
THE RETIREMENT LEDGER
[ ] Secure food production
[ ] Reliable workshop power
[ ] A functioning workshop
[ ] A protected entrance          (Chapter 2)
[ ] A trusted trading partner     (Chapter 2)
[ ] Occupancy rights: 600 Buttons (Chapter 3)
--- personal goals ---
[ ] Have at least one legal wall
[ ] Own two bowls
[ ] Sleep through one night without being stepped on
[ ] Sit in a chair that is far too grand for the room
```

## Upgrade names (with their one-liners)

- **Board Patch:** "Turns a hole into a wall. Legally."
- **Fewer Springs:** A mattress. "Some springs remain. Fewer."
- **Shield Frying Pan:** Upgrades the cooking pot. "Previously defended a knight. Now defends breakfast."
- **Scrap Lantern:** "Light you can almost read by."
- **Second Bowl:** "Luxury."
- **Too-Grand Chair:** "Recovered from a throne room. Barely fits through the door."
- **DEFINITELY NOT A LAIR:** The sign, polished and re-lettered.
- **Bathtub (stolen, polished):** Chapter 2 tease. Shown locked in the build menu: "Requires plumbing."

## Region flavor and landmarks

- **Refuse Galleries:** Chutes rattle overhead and drop rubbish now and then (visible piles that refill each shift). Landmark: a giant fallen chandelier with a rat nest in it.
- **Fungus Cistern:** Dripping water, green glow, an echo. Landmark: a flooded statue of the city's founder with a Glowcap growing on its head.
- **Old Pumpworks:** Rust, steam, rhythmic clanking that gets louder near the boss. Landmark: an enormous seized piston.
- **Goblin Cooperative:** Lamplight, bunting made from socks, and a queue rope with no queue.
