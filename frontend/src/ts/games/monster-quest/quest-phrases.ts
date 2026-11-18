/**
 * Story sentences for Monster Quest moves ("i swing my shiny sword at the
 * goblin in the forest"). Each sentence is built from a frame plus word pools
 * for the difficulty (and words from the land you're in), and always has
 * exactly the number of words asked for, so the typing load per move is
 * predictable. Lowercase, no punctuation.
 */

export type PhraseLevel = 0 | 1 | 2;

type Pools = {
  adj: string[];
  foe: string[];
  hit: string[];
  lead: string[];
  /** friends (heals, team moves) */
  pal: string[];
};

/** Easy: short words. Medium: everyday words. Hard: longer words. */
const POOLS: Record<PhraseLevel, Pools> = {
  0: {
    adj: [
      "big",
      "red",
      "hot",
      "fast",
      "bold",
      "cool",
      "tiny",
      "wild",
      "shiny",
      "brave",
      "loud",
      "huge",
      "blue",
      "pink",
      "gold",
      "odd",
      "silly",
      "fuzzy",
      "sneaky",
      "grumpy",
      "jumpy",
      "noisy",
      "spiky",
      "lumpy",
      "sleepy",
    ],
    foe: [
      "beast",
      "monster",
      "baddie",
      "goblin",
      "bully",
      "foe",
      "brute",
      "pest",
      "rascal",
      "troll",
      "blob",
      "gremlin",
    ],
    hit: [
      "hit",
      "bonk",
      "whack",
      "poke",
      "zap",
      "smack",
      "chop",
      "kick",
      "slam",
      "bop",
      "tap",
      "swat",
      "punch",
    ],
    lead: ["now", "go", "yes", "then", "so", "wow", "okay", "quick", "and"],
    pal: ["friend", "buddy", "pal", "team", "hero", "mate"],
  },
  1: {
    adj: [
      "mighty",
      "golden",
      "shiny",
      "frozen",
      "sparkly",
      "fearless",
      "magic",
      "giant",
      "silver",
      "speedy",
      "jolly",
      "stormy",
      "spooky",
      "clever",
      "gloomy",
      "mossy",
      "rusty",
      "crafty",
      "dizzy",
      "fierce",
      "glowing",
      "hungry",
      "prickly",
      "rumbling",
      "wobbly",
    ],
    foe: [
      "monster",
      "creature",
      "villain",
      "troublemaker",
      "beast",
      "goblin",
      "rascal",
      "bandit",
      "menace",
      "brute",
      "gremlin",
      "ogre",
    ],
    hit: [
      "strike",
      "smash",
      "swing",
      "slash",
      "bash",
      "pound",
      "thump",
      "clobber",
      "zap",
      "knock",
      "whack",
      "tackle",
      "crush",
    ],
    lead: [
      "quickly",
      "bravely",
      "suddenly",
      "together",
      "finally",
      "now",
      "boldly",
      "swiftly",
      "loudly",
    ],
    pal: ["friend", "partner", "teammate", "buddy", "hero", "companion"],
  },
  2: {
    adj: [
      "magnificent",
      "thunderous",
      "legendary",
      "glittering",
      "enormous",
      "courageous",
      "dazzling",
      "mysterious",
      "powerful",
      "unstoppable",
      "brilliant",
      "tremendous",
      "ferocious",
      "mischievous",
      "gigantic",
      "shimmering",
      "relentless",
      "astonishing",
      "colossal",
      "marvelous",
      "spectacular",
      "treacherous",
      "formidable",
      "victorious",
      "radiant",
    ],
    foe: [
      "creature",
      "adversary",
      "troublemaker",
      "monstrosity",
      "villain",
      "challenger",
      "scoundrel",
      "behemoth",
      "marauder",
      "nuisance",
      "trickster",
      "opponent",
    ],
    hit: [
      "strike",
      "demolish",
      "pummel",
      "clobber",
      "slash",
      "hammer",
      "wallop",
      "obliterate",
      "bombard",
      "thrash",
      "overpower",
      "vanquish",
      "batter",
    ],
    lead: [
      "courageously",
      "immediately",
      "fearlessly",
      "triumphantly",
      "together",
      "magnificently",
      "relentlessly",
      "valiantly",
      "spectacularly",
    ],
    pal: ["companion", "teammate", "comrade", "partner", "ally", "champion"],
  },
};

/** Places in each land, so sentences match where the party is. */
const PLACES: Record<string, string[]> = {
  forest: ["forest", "woods", "trees", "river", "meadow", "bushes", "swamp"],
  mountain: ["snow", "cliffs", "hills", "ice", "peaks", "valley", "cave"],
  castle: ["castle", "tower", "hall", "dungeon", "garden", "maze", "attic"],
  any: ["path", "field", "night", "dark", "wind", "rain"],
};

/** What each class uses and does with its skill. */
export const CLASS_TOOLS: Record<string, { tool: string; verbs: string[] }> = {
  knight: {
    tool: "sword",
    verbs: ["slash", "strike", "swing", "chop", "slice", "cut"],
  },
  mage: {
    tool: "staff",
    verbs: ["burn", "blast", "scorch", "zap", "toast", "roast"],
  },
  healer: {
    tool: "wand",
    verbs: ["heal", "help", "mend", "cure", "save", "fix"],
  },
  guardian: {
    tool: "shield",
    verbs: ["guard", "cover", "shield", "protect", "block", "defend"],
  },
};

/**
 * Slots: "A" adjective, "F" foe, "H" hit verb, "V" class verb, "T" tool,
 * "P" place, "N" friend, "U" super move name. Adjectives (and lead-in words
 * if needed) are added before `tail` to reach the word count.
 */
type Frame = {
  pre: string[];
  tail: string[];
  /** reads wrong with adjectives ("shield up now"): only lead-in words */
  noAdj?: boolean;
};

const FRAMES: Record<string, Frame[]> = {
  attack: [
    { pre: ["H", "the"], tail: ["F"] },
    { pre: ["i", "H", "the"], tail: ["F"] },
    { pre: ["H", "that"], tail: ["F", "hard"] },
    { pre: ["we", "H", "the"], tail: ["F"] },
    { pre: ["H", "the"], tail: ["F", "now"] },
    { pre: ["H", "the"], tail: ["F", "in", "the", "P"] },
    { pre: ["i", "H", "the"], tail: ["F", "with", "my", "T"] },
    { pre: ["my", "T", "will", "H", "the"], tail: ["F"] },
    { pre: ["time", "to", "H", "the"], tail: ["F"] },
    { pre: ["watch", "me", "H", "the"], tail: ["F"] },
    { pre: ["i", "H", "the"], tail: ["F", "again"] },
    { pre: ["take", "that"], tail: ["F"] },
    { pre: ["run", "and", "H", "the"], tail: ["F"] },
    { pre: ["i", "H", "every"], tail: ["F", "here"] },
  ],
  skill: [
    { pre: ["V", "with", "my"], tail: ["T"] },
    { pre: ["i", "V", "with", "my"], tail: ["T"] },
    { pre: ["V", "it", "with", "my"], tail: ["T"] },
    { pre: ["my"], tail: ["T", "can", "V"] },
    { pre: ["i", "V", "the"], tail: ["F", "with", "my", "T"] },
    { pre: ["V", "the"], tail: ["F", "with", "my", "T"] },
    { pre: ["my", "T", "will", "V", "the"], tail: ["F"] },
    { pre: ["i", "lift", "my"], tail: ["T", "and", "V"] },
    { pre: ["V", "them", "all", "with", "my"], tail: ["T"] },
    { pre: ["let", "my"], tail: ["T", "V"] },
    { pre: ["V", "across", "the"], tail: ["P"] },
  ],
  defend: [
    { pre: ["raise", "my"], tail: ["shield"] },
    { pre: ["i", "hide", "behind", "my"], tail: ["shield"] },
    { pre: ["hold", "up", "my"], tail: ["shield"] },
    { pre: ["i", "stand"], tail: ["strong"], noAdj: true },
    { pre: ["shield", "up"], tail: ["now"], noAdj: true },
    { pre: ["i", "block", "with", "my"], tail: ["shield"] },
    { pre: ["stay", "behind", "my"], tail: ["shield"] },
    { pre: ["i", "guard", "the"], tail: ["P"] },
    { pre: ["brace", "for", "the"], tail: ["hit"] },
    { pre: ["nothing", "gets", "past", "my"], tail: ["shield"] },
    { pre: ["guard", "my"], tail: ["N"] },
    { pre: ["protect", "the"], tail: ["P"] },
    { pre: ["block", "the"], tail: ["F"] },
    { pre: ["dodge", "the"], tail: ["F"] },
    { pre: ["shield", "my"], tail: ["N"] },
    { pre: ["cover", "my"], tail: ["N"] },
    { pre: ["watch", "the"], tail: ["F"] },
    { pre: ["hold", "the"], tail: ["line"] },
    { pre: ["duck", "and"], tail: ["cover"], noAdj: true },
  ],
  potion: [
    { pre: ["drink", "the"], tail: ["potion"] },
    { pre: ["sip", "my"], tail: ["potion"] },
    { pre: ["share", "the"], tail: ["potion"] },
    { pre: ["gulp", "down", "the"], tail: ["potion"] },
    { pre: ["open", "the"], tail: ["potion", "bottle"] },
    { pre: ["drink", "up"], tail: ["N"] },
    { pre: ["this", "potion", "helps", "my"], tail: ["N"] },
    { pre: ["mix", "the"], tail: ["potion"] },
    { pre: ["cheers", "my"], tail: ["N"] },
    { pre: ["potion", "time"], tail: ["N"], noAdj: true },
    { pre: ["drink", "it"], tail: ["N"], noAdj: true },
    { pre: ["glug", "glug"], tail: ["glug"], noAdj: true },
    { pre: ["heal", "my"], tail: ["N"] },
    { pre: ["a", "potion", "for", "my"], tail: ["N"] },
    { pre: ["share", "with", "my"], tail: ["N"] },
  ],
  ultimate: [
    { pre: ["unleash", "my"], tail: ["U"] },
    { pre: ["time", "for", "my"], tail: ["U"] },
    { pre: ["i", "call", "the"], tail: ["U"] },
    { pre: ["feel", "the", "power", "of"], tail: ["U"] },
    { pre: ["here", "comes", "my"], tail: ["U"] },
    { pre: ["now", "watch", "my"], tail: ["U"] },
    { pre: ["the", "P", "shakes", "with"], tail: ["U"] },
  ],
  chest: [
    { pre: ["open", "the"], tail: ["chest"] },
    { pre: ["unlock", "the"], tail: ["box"] },
    { pre: ["lift", "the"], tail: ["lid"] },
    { pre: ["peek", "inside", "the"], tail: ["chest"] },
    { pre: ["find", "the"], tail: ["treasure"] },
  ],
  trap: [
    { pre: ["jump", "over", "the"], tail: ["trap"] },
    { pre: ["leap", "past", "the"], tail: ["spikes"] },
    { pre: ["dodge", "the"], tail: ["net"] },
    { pre: ["run", "around", "the"], tail: ["pit"] },
    { pre: ["hop", "over", "the"], tail: ["log"] },
  ],
  team: [
    { pre: ["we", "fight", "as", "one"], tail: ["team"] },
    { pre: ["together", "we", "beat", "the"], tail: ["F"] },
    { pre: ["all", "heroes", "attack", "the"], tail: ["F"] },
    { pre: ["friends", "never", "give"], tail: ["up"], noAdj: true },
    { pre: ["side", "by", "side", "we"], tail: ["win"], noAdj: true },
    { pre: ["everyone", "charge", "at", "the"], tail: ["F"] },
  ],
};

/** Short guard phrases by word count. */
const GUARDS: Record<number, string[]> = {
  1: ["duck", "block", "dodge", "jump", "hide", "roll", "crouch"],
  2: [
    "duck down",
    "block it",
    "jump up",
    "look out",
    "stay low",
    "dodge left",
    "hide fast",
    "roll away",
    "dodge right",
    "step back",
    "shield up",
    "hold on",
    "get down",
    "jump back",
    "spin away",
    "watch out",
    "slide left",
    "brace now",
    "keep low",
    "stay safe",
  ],
  3: [
    "block the hit",
    "duck down low",
    "jump out quick",
    "roll to safety",
    "hide behind me",
    "dodge to the left",
    "step out of reach",
    "keep your guard",
    "watch out now",
    "jump over it",
    "shield me now",
    "spin and dodge",
    "get behind cover",
    "duck and roll",
  ],
  4: [
    "block the big hit",
    "duck down really low",
    "jump away from danger",
    "roll out of the way",
    "hide behind the shield",
    "step back and block",
    "keep your head down",
  ],
};

const pick = <T>(rng: () => number, list: T[]): T =>
  list[Math.floor(rng() * list.length)] as T;

function fill(
  token: string,
  rng: () => number,
  pools: Pools,
  cls: string,
  land: string,
  used: Set<string>,
): string {
  const fresh = (list: string[]): string => {
    for (let i = 0; i < 8; i++) {
      const w = pick(rng, list);
      if (!used.has(w)) return w;
    }
    return pick(rng, list);
  };
  const lists: Record<string, string[]> = {
    A: pools.adj,
    F: pools.foe,
    H: pools.hit,
    N: pools.pal,
    V: CLASS_TOOLS[cls]?.verbs ?? ["strike"],
    P: [...(PLACES[land] ?? []), ...(PLACES["any"] ?? [])],
  };
  const list = lists[token];
  const w =
    token === "T"
      ? (CLASS_TOOLS[cls]?.tool ?? "sword")
      : list === undefined
        ? token
        : fresh(list);
  used.add(w);
  return w;
}

/**
 * A sentence for `kind` with exactly `count` words: the frame, adjectives
 * before the last part, and lead-in words if it is still short.
 */
export function storyPhrase(
  rng: () => number,
  kind: string,
  count: number,
  level: PhraseLevel,
  cls = "knight",
  /** super move name, for kind "ultimate" */
  ult = "power",
  /** the land the party is in, for place words */
  land = "any",
): string {
  const pools = POOLS[level];
  const frames = (FRAMES[kind] ?? FRAMES["attack"]) as Frame[];
  const ultWords = ult.toLowerCase().split(" ");
  const size = (f: Frame): number =>
    f.pre.length +
    f.tail.length +
    (f.tail.includes("U") ? ultWords.length - 1 : 0);
  const fits = frames.filter((f) => size(f) <= count);
  // prefer frames close to the word count: fewer filler words, more variety
  const close = fits.filter((f) => count - size(f) <= 2);
  const frame =
    close.length > 0
      ? pick(rng, close)
      : fits.length > 0
        ? pick(rng, fits)
        : frames.reduce((a, b) => (size(a) <= size(b) ? a : b));
  const used = new Set<string>();
  const pre = frame.pre.map((t) => fill(t, rng, pools, cls, land, used));
  const tail = frame.tail.flatMap((t) =>
    t === "U" ? ultWords : [fill(t, rng, pools, cls, land, used)],
  );
  let room = count - pre.length - tail.length;
  const adjs: string[] = [];
  while (room > 0 && adjs.length < 2 && frame.noAdj !== true) {
    adjs.push(fill("A", rng, pools, cls, land, used));
    room--;
  }
  const lead: string[] = [];
  while (room > 0) {
    lead.push(fill("A", rng, { ...pools, adj: pools.lead }, cls, land, used));
    room--;
  }
  const words = [...lead, ...pre, ...adjs, ...tail];
  return words.slice(Math.max(0, words.length - count)).join(" ");
}

export function guardPhrase(rng: () => number, count: number): string {
  const list = GUARDS[count] ?? GUARDS[2] ?? ["duck"];
  return pick(rng, list);
}
