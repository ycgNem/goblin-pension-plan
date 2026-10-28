import type { Action } from '../core/keys';
import type { PortraitId } from '../render/art/portraits';
import type { RegionId } from './regions';

// The story: intro, the letter, every conversation, and the contextual hints.
// Voice rules live in docs/CONTENT.md. The goblin never speaks: choices are written as actions.

export type SpeakerId = 'grubb' | 'dorrit' | 'unionRat' | 'aldous' | 'wren' | 'pemberton' | 'hobb' | 'guard';

export interface SpeakerDef {
  name: string;
  portrait: PortraitId;
  /** Pitch of the dialogue blips. */
  voice: number;
  color: string;
}

export const SPEAKERS: Record<SpeakerId, SpeakerDef> = {
  grubb: { name: 'Registrar Grubb', portrait: 'grubb', voice: 0.8, color: '#a6d06a' },
  dorrit: { name: 'Dorrit Vane', portrait: 'dorrit', voice: 1.15, color: '#e0b060' },
  unionRat: { name: 'Union Rat, Local 12', portrait: 'unionRat', voice: 1.5, color: '#c8a890' },
  aldous: { name: 'Sir Aldous Brightmantle', portrait: 'aldous', voice: 0.72, color: '#8ab0f0' },
  wren: { name: 'Wren', portrait: 'wren', voice: 1.05, color: '#8ac080' },
  pemberton: { name: 'Pemberton', portrait: 'pemberton', voice: 1.3, color: '#c0a0e0' },
  hobb: { name: 'Inspector Hobb', portrait: 'hobb', voice: 0.9, color: '#90b0d0' },
  guard: { name: 'Watch Guard', portrait: 'guard', voice: 0.85, color: '#e08080' },
};

// ---------------------------------------------------------------- intro

export type PanelArt = 'city' | 'chute' | 'heroes' | 'alcove' | 'notice' | 'charter';

export interface IntroPanel {
  art: PanelArt;
  text: string;
}

export const INTRO: readonly IntroPanel[] = [
  { art: 'city', text: 'Bellmarket is a city of bells, ledgers, and very clean streets.' },
  { art: 'chute', text: 'Everything it throws away goes down.' },
  { art: 'heroes', text: 'Down there, it becomes the dungeon. Heroes go down for treasure. Mostly they find rubbish, and never ask what it is worth.' },
  { art: 'alcove', text: 'One goblin knows exactly what it is worth. For forty years, home has been a maintenance alcove behind the Refuse Galleries. It leaks. It is home.' },
  { art: 'notice', text: "This morning, the Adventurers' Guild added a new address to its survey list." },
  { art: 'charter', text: "Only a chartered burrow is off the Guild's books. Charters come from the Goblin Cooperative. Charters require paperwork." },
];

/** The notice shown in the intro, and pinned on the Activity Board until the first stamp. */
export const GUILD_SURVEY = {
  heading: 'GUILD SURVEY',
  lines: ['Goblin alcove, Refuse Galleries.', 'Unlicensed. Suitable for beginners.', 'Status: PENDING'],
};

export const CHAPTER_CARD = { kicker: 'Chapter One', title: 'A Recognized Workshop' };

// ---------------------------------------------------------------- the letter

export const LETTER = {
  from: 'Office of Burrow Charters',
  heading: 'RE: YOUR ALLEGED RESIDENCE',
  body: [
    'Your application for a Burrow Charter has been received, and read twice.',
    'The Cooperative cannot recognize this alcove as a home. It has holes, no food source, no workshop, and no power. Fix these. Then come and see me.',
    'Note: the Guild has put your address on its survey list. A chartered burrow is a premises. Premises are not content. I would hurry.',
  ],
  signature: 'Registrar Grubb',
  postscript: 'P.S. A home requires at least one legal wall. I checked.',
};

// ---------------------------------------------------------------- dialogue

export interface Line {
  who: SpeakerId;
  text: string;
}

export interface Choice {
  text: string;
  next: string | null;
}

export interface DialogueNode {
  lines: readonly Line[];
  choices?: readonly Choice[];
  /** Node to go to after the lines when there are no choices. Null or missing ends the conversation. */
  next?: string | null;
  /** Something for the game to do when this node starts (open a shortcut, set a flag). */
  effect?: DialogueEffect;
}

export type DialogueEffect = 'metGrubb' | 'openShortcut' | 'metDorrit' | 'openHatch' | 'deliverOrder' | 'stamp' | 'payOccupancy';

export type Script = { start: string; nodes: Record<string, DialogueNode> };

const grubbMenu: readonly Choice[] = [
  { text: '[Ask about the survey]', next: 'survey' },
  { text: '[Ask about the charter]', next: 'charter' },
  { text: '[Leave]', next: 'bye' },
];

export const GRUBB_FIRST: Script = {
  start: 'hello',
  nodes: {
    hello: {
      effect: 'metGrubb',
      lines: [
        { who: 'grubb', text: 'Ah. The alcove applicant. You got my letter.' },
        { who: 'grubb', text: 'You are smaller than your handwriting.' },
      ],
      choices: grubbMenu,
    },
    survey: {
      lines: [
        { who: 'grubb', text: 'The Guild posts contracts on anything unchartered. Rat nests. Flooded cellars. You.' },
        { who: 'grubb', text: 'A chartered burrow is a premises. Premises are not content. Bylaw nine. I wrote bylaw nine.' },
      ],
      choices: grubbMenu,
    },
    charter: {
      lines: [
        { who: 'grubb', text: 'Six requirements. Walls. Food. A workshop. A power part, then power. And one order for the Co-op.' },
        { who: 'grubb', text: 'Bring me proof and I stamp it. I enjoy stamping. It is the best part of the job.' },
      ],
      choices: grubbMenu,
    },
    bye: {
      effect: 'openShortcut',
      lines: [
        { who: 'grubb', text: 'One more thing. The pipe behind my office runs straight to your alcove.' },
        { who: 'grubb', text: 'I have had it unblocked. Saves you walking through the rat district. Off you go.' },
      ],
    },
  },
};

/** What Grubb needs to know to pick what to say on a later visit. */
export interface GrubbState {
  /** Charter steps not done yet, the supply order included. */
  stepsLeft: number;
  nextStep: string | null;
  visit: number;
  /** The order's goods are on hand (pack or storage: the Union fetches from your crate). */
  orderReady: boolean;
  /** Some of the order is in the crate at home, not in the pack. */
  fromCrate: boolean;
  orderDone: boolean;
  stamped: boolean;
  /** Buttons paid toward occupancy rights so far, and what the next payment would be. */
  occupancy: number;
  nextPayment: number;
}

const ASIDES = [
  'Have you met Dorrit at the Hatch? Count your fingers afterwards.',
  'The Guild sent a surveyor down last year. He is still in the Cistern. Probably fine.',
  'I once stamped a form so hard the desk needed a charter of its own.',
  'If the Union rats bring you home, sign the receipt. They are very particular about the receipt.',
  'Bylaw nine is my favorite bylaw. I have read the others. Nine is better.',
];

/** Grubb on later visits: the Charter, the supply order, the stamp, and then the pension. */
export function grubbChat(st: GrubbState): Script {
  const nodes: Record<string, DialogueNode> = {};
  const aside: Line = { who: 'grubb', text: ASIDES[st.visit % ASIDES.length]! };

  nodes.stamp = {
    effect: 'stamp',
    lines: [
      { who: 'grubb', text: 'Every requirement met. I have been holding this stamp for some time.' },
      { who: 'grubb', text: 'Hold still. This is the good part.' },
    ],
  };
  nodes.order = {
    lines: [
      { who: 'grubb', text: 'Cooperative Supply Order Number One. Four Dried Glowcap Rations. Two Slime Cells.' },
      { who: 'grubb', text: 'Rations come off a drying rack. Cells need generator power. Bring them, I pay forty buttons.' },
    ],
    next: 'menu',
  };
  nodes.deliver = {
    effect: 'deliverOrder',
    lines: [
      { who: 'grubb', text: 'Four rations, two cells, one of them still angry. Logged, receipted, filed.' },
      st.fromCrate
        ? { who: 'grubb', text: 'Forty buttons, as agreed. A Union rat fetched the rest from your crate. No fee. This once.' }
        : { who: 'grubb', text: 'Forty buttons, as agreed. Exact change. I counted it twice. For fun.' },
    ],
    next: st.stepsLeft === 1 ? 'stamp' : null,
  };
  if (st.nextPayment > 0) {
    const after = st.occupancy + st.nextPayment;
    nodes.pay = {
      effect: 'payOccupancy',
      lines: after >= 600
        ? [
            { who: 'grubb', text: 'Six hundred buttons. Paid in full. I have never seen it done.' },
            { who: 'grubb', text: 'Occupancy rights, granted. The alcove is yours. Retire whenever you like. Nobody does.' },
          ]
        : [{ who: 'grubb', text: `${st.nextPayment} buttons toward occupancy rights. ${after} of 600. I will make a note. I love a note.` }],
      next: after >= 600 ? null : 'menu',
    };
  }

  const choices: Choice[] = [];
  if (!st.orderDone && st.orderReady) choices.push({ text: '[Hand over the supply order]', next: 'deliver' });
  if (!st.orderDone) choices.push({ text: '[Ask about the supply order]', next: 'order' });
  if (st.stamped && st.nextPayment > 0) choices.push({ text: `[Pay ${st.nextPayment} buttons toward occupancy]`, next: 'pay' });
  choices.push({ text: '[Leave]', next: null });
  nodes.menu = { lines: [{ who: 'grubb', text: 'Anything else? I have forms.' }], choices };

  if (st.stepsLeft === 0 && !st.stamped) return { start: 'stamp', nodes };

  const lines: Line[] = [];
  if (st.stamped) {
    lines.push({ who: 'grubb', text: 'A recognized workshop. I still look at the stamp sometimes.' });
    if (st.occupancy < 600) lines.push({ who: 'grubb', text: `Occupancy rights: 600 buttons, paid at your leisure. ${st.occupancy} so far.` });
  } else {
    lines.push({ who: 'grubb', text: `${st.stepsLeft} requirement${st.stepsLeft === 1 ? '' : 's'} left. I have my stamp ready. I always have my stamp ready.` });
    if (st.nextStep === 'Recover a power component') {
      lines.push({ who: 'grubb', text: 'Power. The Old Pumpworks had a flywheel once. Something large is sitting on it now.' });
      lines.push({ who: 'grubb', text: 'Through the Fungus Cistern and down the crawl pipe. Mind the beetles. They mind you back.' });
    } else if (st.nextStep === 'Activate the slime generator') {
      lines.push({ who: 'grubb', text: 'Build the generator around that coil, then feed it gel. It runs on slime and spite.' });
    } else if (st.nextStep === 'Build a mushroom bed') {
      lines.push({ who: 'grubb', text: 'Food. Glowcaps grow anywhere damp. Your alcove is very damp. This is the one compliment I will give it.' });
    } else if (st.nextStep === 'Construct a scrap workbench') {
      lines.push({ who: 'grubb', text: 'A workshop needs a workbench with four legs. Three is a lean-to.' });
    }
  }
  lines.push(aside);
  nodes.chat = { lines, choices };
  return { start: 'chat', nodes };
}

export const DORRIT_FIRST: Script = {
  start: 'hello',
  nodes: {
    hello: {
      effect: 'metDorrit',
      lines: [
        { who: 'dorrit', text: 'Buttons only. Coin has paperwork.' },
        { who: 'dorrit', text: "Hatch is shut till the merchant's back from Lowmarket. Bring me something processed when it opens." },
        { who: 'dorrit', text: "And don't bring me raw mushrooms. I can pick those up off the floor." },
      ],
    },
  },
};

export const DORRIT_LATER: Script = {
  start: 'hello',
  nodes: {
    hello: {
      lines: [
        { who: 'dorrit', text: "Still shut. Lowmarket's a long way, and he walks like a man paid by the hour." },
        { who: 'dorrit', text: 'Go and see Grubb. By the time he finishes a sentence, my merchant will be back.' },
      ],
    },
  },
};

/** The Hatch opens once you've met Grubb. Every visit after this goes straight to trading. */
export const DORRIT_OPEN: Script = {
  start: 'hello',
  nodes: {
    hello: {
      effect: 'openHatch',
      lines: [
        { who: 'dorrit', text: "Merchant's back from Lowmarket. Walks slow, pays fair. Mostly fair." },
        { who: 'dorrit', text: 'Bring me anything you made. Rations, glue, cells. Every one I buy, the next is worth less.' },
        { who: 'dorrit', text: 'Demand comes back with the Shift Bell. Like my headache.' },
      ],
    },
  },
};

export const UNION_RAT_LINE: Line = { who: 'unionRat', text: "Sign here. And here. Fee's standard." };

// ---------------------------------------------------------------- barks (speech bubbles, 50 characters max)

export const BARKS = {
  partyEnter: ['Formation! Rats ahead!', 'Is this the rat one?', 'Mind the puddles.'],
  suspicious: ['Did something move?', 'Probably a rat. Probably.', 'Is it a goblin or a big rat?'],
  hostile: ['Goblin! Armed!', 'It has a launcher!', 'There! By the junk!'],
  lost: ['Lost it.', 'Not in the contract.', 'Back to the route.'],
  contractDone: ['Nest cleared! Huzzah!', 'Third rat contract this week.', 'Noting it down for the report.'],
  nestEmpty: ['Somebody got here first.', 'No rats. Do we still get paid?'],
  retreat: ['Fall back! Regroup at the grate!'],
  hobbWork: ["Pressure's fine. Pressure's always fine.", 'Not paid enough for pipes.', 'Gate open. Nobody touch it.'],
  hobbSuspicious: ['Hello? Union rat?'],
  hobbFlee: ['*whistle* GUARD!'],
  hobbGateShut: ["Gate's shut. Union rules."],
  guardHostile: ['Oi! You!', 'Stop right there!'],
  guardLost: ['Paid by the hour, not the goblin.', 'Not my shift for this.'],
} as const;

/** The Pump Matron's fight, as captions under the action. */
export const BOSS_LINES = {
  start: 'The flywheel turns. Something under it wakes up, and is cross about it.',
  phase2: 'She clamps her shell shut. The pipes hiss: the valves have pressure now.',
  defeated: 'The flywheel rolls loose. The pumps sigh. So does the goblin.',
} as const;

// ---------------------------------------------------------------- narration

/** Shown once, the first time you arrive somewhere. */
export const FIRST_VISIT: Partial<Record<RegionId, string>> = {
  galleries: "The Refuse Galleries. Everything the city has finished with. Most of it isn't finished.",
  cistern: "The Fungus Cistern. Dinner grows on the walls here, if you're quick about it.",
  pumpworks: "The Old Pumpworks. Something big is clanking, and it isn't the pumps.",
  coop: 'The Goblin Cooperative. Lamplight, socks, and somebody who can say yes.',
};

// ---------------------------------------------------------------- hints

export type HintId = 'move' | 'search' | 'pack' | 'fight' | 'sneak' | 'eat' | 'deposit' | 'build' | 'throw' | 'map' | 'smash' | 'armor' | 'valve' | 'feed' | 'trade' | 'stink';

export interface HintDef {
  /** Rebindable actions show whatever key they're bound to. */
  keys: readonly (Action | 'LMB')[];
  text: string;
}

export const HINTS: Record<HintId, HintDef> = {
  move: { keys: ['up', 'left', 'down', 'right'], text: 'Move. The mouse aims.' },
  search: { keys: ['interact'], text: 'Hold to search. Rubbish is a resource.' },
  smash: { keys: ['interact'], text: 'Smash crates for timber. It is loud.' },
  pack: { keys: ['pack'], text: 'Your pack, the Charter, skills, and the map.' },
  fight: { keys: ['LMB', 'roll'], text: 'Fire, and roll through attacks when they flash.' },
  sneak: { keys: ['sneak'], text: 'Sneak. Hide in heaps or pipes, but not while watched.' },
  eat: { keys: ['eat'], text: 'Eat something from your pack.' },
  deposit: { keys: ['interact'], text: 'At the storage crate: put your materials away.' },
  build: { keys: ['interact'], text: 'Glowing outlines are things you can build.' },
  throw: { keys: ['throw'], text: 'Throw a pebble. People look where it lands.' },
  map: { keys: ['map'], text: 'The map shows the way home.' },
  armor: { keys: ['roll'], text: 'Armored front. Get round behind it.' },
  valve: { keys: ['interact'], text: 'Steam blasts down. Lure her under it. Shoot the belly.' },
  feed: { keys: ['interact'], text: 'Feed the generator Slime Gel for charge.' },
  trade: { keys: ['interact'], text: 'Sell what you make at the Hatch.' },
  stink: { keys: ['throw'], text: 'Stinkbrew: creatures will not enter the cloud.' },
};
