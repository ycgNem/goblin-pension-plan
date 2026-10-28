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

export type DialogueEffect = 'metGrubb' | 'openShortcut' | 'metDorrit';

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
        { who: 'grubb', text: 'Six requirements. Walls. Food. A workshop. Power. And one order filled for the Cooperative.' },
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

/** Grubb on later visits, depending on how the charter is going. */
export function grubbChat(stepsLeft: number, nextStep: string | null, visit: number): Script {
  const lines: Line[] = [];
  if (stepsLeft === 0) {
    lines.push({ who: 'grubb', text: 'Every requirement met. I have been holding this stamp for some time.' });
  } else {
    lines.push({ who: 'grubb', text: `${stepsLeft} requirement${stepsLeft === 1 ? '' : 's'} left. I have my stamp ready. I always have my stamp ready.` });
    if (nextStep === 'Recover a power component') {
      lines.push({ who: 'grubb', text: 'Power. The Old Pumpworks had a flywheel once. Something large is sitting on it now.' });
    } else if (nextStep === 'Build a mushroom bed') {
      lines.push({ who: 'grubb', text: 'Food. Glowcaps grow anywhere damp. Your alcove is very damp. This is the one compliment I will give it.' });
    } else if (nextStep === 'Construct a scrap workbench') {
      lines.push({ who: 'grubb', text: 'A workshop needs a workbench with four legs. Three is a lean-to.' });
    }
  }
  const asides = [
    'Have you met Dorrit at the Hatch? Do not buy the spoons.',
    'The Guild sent a surveyor down last year. He is still in the Cistern. Probably fine.',
    'I once stamped a form so hard the desk needed a charter of its own.',
    'If the Union rats bring you home, sign the receipt. They are very particular about the receipt.',
  ];
  lines.push({ who: 'grubb', text: asides[visit % asides.length]! });
  return { start: 'chat', nodes: { chat: { lines } } };
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
      lines: [{ who: 'dorrit', text: "Still shut. Lowmarket's a long way, and he walks like a man paid by the hour." }],
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

// ---------------------------------------------------------------- narration

/** Shown once, the first time you arrive somewhere. */
export const FIRST_VISIT: Partial<Record<RegionId, string>> = {
  galleries: "The Refuse Galleries. Everything the city has finished with. Most of it isn't finished.",
  cistern: "The Fungus Cistern. Dinner grows on the walls here, if you're quick about it.",
  pumpworks: "The Old Pumpworks. Something big is clanking, and it isn't the pumps.",
  coop: 'The Goblin Cooperative. Lamplight, socks, and somebody who can say yes.',
};

// ---------------------------------------------------------------- hints

export type HintId = 'move' | 'search' | 'pack' | 'fight' | 'sneak' | 'eat' | 'deposit' | 'build' | 'throw' | 'map' | 'smash';

export interface HintDef {
  keys: readonly string[];
  text: string;
}

export const HINTS: Record<HintId, HintDef> = {
  move: { keys: ['W', 'A', 'S', 'D'], text: 'Move. The mouse aims.' },
  search: { keys: ['E'], text: 'Hold to search. Rubbish is a resource.' },
  smash: { keys: ['E'], text: 'Smash crates for timber. It is loud.' },
  pack: { keys: ['TAB'], text: 'Your pack, the Charter, skills, and the map.' },
  fight: { keys: ['LMB', 'SPACE'], text: 'Fire, and roll through attacks when they flash.' },
  sneak: { keys: ['SHIFT'], text: 'Sneak. Tall rubbish and crawlspaces hide you.' },
  eat: { keys: ['Q'], text: 'Eat something from your pack.' },
  deposit: { keys: ['E'], text: 'At the storage crate: put your materials away.' },
  build: { keys: ['E'], text: 'Glowing outlines are things you can build.' },
  throw: { keys: ['F'], text: 'Throw a pebble. People look where it lands.' },
  map: { keys: ['M'], text: 'The map shows the way home.' },
};
