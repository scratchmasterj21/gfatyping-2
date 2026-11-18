/**
 * Story sentences for Monster Quest moves ("i swing my shiny sword at the
 * beast"). Each sentence is built from a frame plus word pools for the
 * difficulty, and always has exactly the number of words asked for, so the
 * typing load per move is predictable. Lowercase, no punctuation.
 */

export type PhraseLevel = 0 | 1 | 2;

type Pools = {
  adj: string[];
  foe: string[];
  hit: string[];
  lead: string[];
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
    ],
    foe: ["beast", "monster", "baddie", "goblin", "bully", "foe"],
    hit: ["hit", "bonk", "whack", "poke", "zap", "smack", "chop"],
    lead: ["now", "go", "yes", "then", "so", "wow"],
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
    ],
    foe: ["monster", "creature", "villain", "troublemaker", "beast", "goblin"],
    hit: ["strike", "smash", "swing", "slash", "bash", "pound", "thump"],
    lead: ["quickly", "bravely", "suddenly", "together", "finally", "now"],
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
    ],
    foe: [
      "creature",
      "adversary",
      "troublemaker",
      "monstrosity",
      "villain",
      "challenger",
    ],
    hit: [
      "strike",
      "demolish",
      "pummel",
      "clobber",
      "slash",
      "hammer",
      "wallop",
    ],
    lead: [
      "courageously",
      "immediately",
      "fearlessly",
      "triumphantly",
      "together",
      "magnificently",
    ],
  },
};

/** What each class uses and does with its skill. */
export const CLASS_TOOLS: Record<string, { tool: string; verbs: string[] }> = {
  knight: { tool: "sword", verbs: ["slash", "strike", "swing"] },
  mage: { tool: "staff", verbs: ["burn", "blast", "scorch"] },
  healer: { tool: "wand", verbs: ["heal", "help", "mend"] },
  guardian: { tool: "shield", verbs: ["guard", "cover", "shield"] },
};

/** A slot: "A" adjective, "F" foe, "H" hit verb, "V" class verb, "T" tool. */
type Frame = { pre: string[]; tail: string[] };

const FRAMES: Record<string, Frame[]> = {
  attack: [
    { pre: ["H", "the"], tail: ["F"] },
    { pre: ["i", "H", "the"], tail: ["F"] },
    { pre: ["H", "that"], tail: ["F", "hard"] },
    { pre: ["we", "H", "the"], tail: ["F"] },
  ],
  skill: [
    { pre: ["V", "with", "my"], tail: ["T"] },
    { pre: ["i", "V", "with", "my"], tail: ["T"] },
    { pre: ["V", "it", "with", "my"], tail: ["T"] },
  ],
  defend: [
    { pre: ["raise", "my"], tail: ["shield"] },
    { pre: ["i", "hide", "behind", "my"], tail: ["shield"] },
    { pre: ["hold", "up", "my"], tail: ["shield"] },
  ],
  potion: [
    { pre: ["drink", "the"], tail: ["potion"] },
    { pre: ["sip", "my"], tail: ["potion"] },
    { pre: ["share", "the"], tail: ["potion"] },
  ],
  chest: [
    { pre: ["open", "the"], tail: ["chest"] },
    { pre: ["unlock", "the"], tail: ["box"] },
  ],
  trap: [
    { pre: ["jump", "over", "the"], tail: ["trap"] },
    { pre: ["leap", "past", "the"], tail: ["spikes"] },
  ],
  ultimate: [
    { pre: ["unleash", "my"], tail: ["U"] },
    { pre: ["time", "for", "my"], tail: ["U"] },
    { pre: ["i", "call", "the"], tail: ["U"] },
  ],
  team: [
    { pre: ["we", "fight", "as", "one"], tail: ["team"] },
    { pre: ["together", "we", "beat", "the"], tail: ["F"] },
    { pre: ["all", "heroes", "attack", "the"], tail: ["F"] },
  ],
};

/** Short guard phrases by word count. */
const GUARDS: Record<number, string[]> = {
  1: ["duck", "block", "dodge", "jump", "hide"],
  2: [
    "duck down",
    "block it",
    "jump up",
    "look out",
    "stay low",
    "dodge left",
    "hide fast",
    "roll away",
  ],
  3: [
    "block the hit",
    "duck down low",
    "jump out quick",
    "roll to safety",
    "hide behind me",
    "dodge to the left",
  ],
  4: ["block the big hit", "duck down really low", "jump away from danger"],
};

const pick = <T>(rng: () => number, list: T[]): T =>
  list[Math.floor(rng() * list.length)] as T;

function fill(
  token: string,
  rng: () => number,
  pools: Pools,
  cls: string,
  used: Set<string>,
): string {
  const fresh = (list: string[]): string => {
    for (let i = 0; i < 6; i++) {
      const w = pick(rng, list);
      if (!used.has(w)) return w;
    }
    return pick(rng, list);
  };
  let w = token;
  if (token === "A") w = fresh(pools.adj);
  else if (token === "F") w = fresh(pools.foe);
  else if (token === "H") w = fresh(pools.hit);
  else if (token === "V") w = pick(rng, CLASS_TOOLS[cls]?.verbs ?? ["strike"]);
  else if (token === "T") w = CLASS_TOOLS[cls]?.tool ?? "sword";
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
): string {
  const pools = POOLS[level];
  const frames = (FRAMES[kind] ?? FRAMES["attack"]) as Frame[];
  // frames that fit, longest first so fewer filler words are needed
  const ultWords = ult.toLowerCase().split(" ");
  const size = (f: Frame): number =>
    f.pre.length +
    f.tail.length +
    (f.tail.includes("U") ? ultWords.length - 1 : 0);
  const fits = frames.filter((f) => size(f) <= count);
  const frame =
    fits.length > 0
      ? pick(rng, fits)
      : frames.reduce((a, b) => (size(a) <= size(b) ? a : b));
  const used = new Set<string>();
  const pre = frame.pre.map((t) => fill(t, rng, pools, cls, used));
  const tail = frame.tail.flatMap((t) =>
    t === "U" ? ultWords : [fill(t, rng, pools, cls, used)],
  );
  let room = count - pre.length - tail.length;
  const adjs: string[] = [];
  while (room > 0 && adjs.length < 2) {
    adjs.push(fill("A", rng, pools, cls, used));
    room--;
  }
  const lead: string[] = [];
  while (room > 0) {
    lead.push(fill("A", rng, { ...pools, adj: pools.lead }, cls, used));
    room--;
  }
  const words = [...lead, ...pre, ...adjs, ...tail];
  return words.slice(Math.max(0, words.length - count)).join(" ");
}

export function guardPhrase(rng: () => number, count: number): string {
  const list = GUARDS[count] ?? GUARDS[2] ?? ["duck"];
  return pick(rng, list);
}
