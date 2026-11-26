import type { DifficultyOption } from "../components/DifficultySegmented";

import { EASY_WORDS, HARD_WORDS, MEDIUM_WORDS } from "../shared/kid-words";

/**
 * Monster Quest: a turn-based party battle. Four heroes (players + computer
 * helpers) take turns with the monsters: pick an action, then type its word -
 * faster and cleaner = stronger. When a monster attacks a player's hero, that
 * player types a quick guard word to take less damage. Two battles, then a
 * boss who gets angry at half health.
 *
 * Everything is worked out from the party, a seed and the list of player
 * inputs, so solo and online games share it and every screen agrees.
 */

// ---------------------------------------------------------------- setup

export type FreeHero = "knight" | "mage" | "healer" | "guardian";
export type HeroClass =
  | FreeHero
  // Legends set (bought with coins, see quest-heroes.ts)
  | "paladin"
  | "rogue"
  | "ranger"
  | "summoner"
  // Wanderers set
  | "monk"
  | "ninja"
  | "sorcerer"
  | "bard"
  // Wild Ones set
  | "berserker"
  | "druid"
  | "hunter"
  | "shaman"
  // Frontier set
  | "lancer"
  | "samurai"
  | "engineer"
  | "cleric";

/** Everyone has these; computer helpers only ever use them. */
export const FREE_HEROES: FreeHero[] = ["knight", "mage", "healer", "guardian"];

export type HeroSetId = "legends" | "wanderers" | "wild" | "frontier";

export type HeroSetInfo = {
  id: HeroSetId;
  name: string;
  emoji: string;
  heroes: HeroClass[];
  /** lesson group to finish before the set can be bought */
  requires: "home-row" | "top-row" | "bottom-row" | "all-keys";
  requiresName: string;
  /** full-set bonus: a title to show off */
  title: string;
  /** full-set bonus: two of the set's heroes chaining skills */
  combo: { name: string; emoji: string };
};

/** Hero sets students can buy, released one at a time. */
export const HERO_SETS: HeroSetInfo[] = [
  {
    id: "legends",
    name: "Legends",
    emoji: "🛡️",
    heroes: ["paladin", "rogue", "ranger", "summoner"],
    requires: "home-row",
    requiresName: "Home Row",
    title: "Legend Keeper",
    combo: { name: "Legendary Strike", emoji: "🏆" },
  },
  {
    id: "wanderers",
    name: "Wanderers",
    emoji: "🌀",
    heroes: ["monk", "ninja", "sorcerer", "bard"],
    requires: "top-row",
    requiresName: "Top Row",
    title: "Peak Wanderer",
    combo: { name: "Wandering Storm", emoji: "🌪️" },
  },
  {
    id: "wild",
    name: "Wild Ones",
    emoji: "🌿",
    heroes: ["berserker", "druid", "hunter", "shaman"],
    requires: "bottom-row",
    requiresName: "Bottom Row",
    title: "Wild Heart",
    combo: { name: "Call of the Wild", emoji: "🐾" },
  },
  {
    id: "frontier",
    name: "Frontier",
    emoji: "⚙️",
    heroes: ["lancer", "samurai", "engineer", "cleric"],
    requires: "all-keys",
    requiresName: "All Keys",
    title: "Frontier Captain",
    combo: { name: "Frontier Blitz", emoji: "🚀" },
  },
];

export const setOfHero = (cls: HeroClass): HeroSetInfo | undefined =>
  HERO_SETS.find((s) => s.heroes.includes(cls));

export const HERO_CLASSES: HeroClass[] = [
  ...FREE_HEROES,
  ...HERO_SETS.flatMap((s) => s.heroes),
];
export const PARTY_SIZE = 4;

export type ClassInfo = {
  name: string;
  emoji: string;
  maxHp: number;
  atk: number;
  speed: number;
  skill: string;
  skillEmoji: string;
  /** what the skill aims at */
  skillTarget: "monster" | "allMonsters" | "ally" | "self";
  blurb: string;
  /** longer tip for the hero picker */
  tip?: string;
};

export const CLASS_INFO: Record<HeroClass, ClassInfo> = {
  knight: {
    name: "Knight",
    emoji: "🗡️",
    maxHp: 120,
    atk: 14,
    speed: 6,
    skill: "Power Strike",
    skillEmoji: "💥",
    skillTarget: "monster",
    blurb: "Big hits on one monster",
  },
  mage: {
    name: "Mage",
    emoji: "🔮",
    maxHp: 85,
    atk: 10,
    speed: 8,
    skill: "Fire Storm",
    skillEmoji: "🔥",
    skillTarget: "allMonsters",
    blurb: "Spells that hit every monster",
  },
  healer: {
    name: "Healer",
    emoji: "💚",
    maxHp: 95,
    atk: 8,
    speed: 7,
    skill: "Heal",
    skillEmoji: "💖",
    skillTarget: "ally",
    blurb: "Heals friends and wakes them up",
  },
  guardian: {
    name: "Guardian",
    emoji: "🛡️",
    maxHp: 150,
    atk: 10,
    speed: 5,
    skill: "Protect",
    skillEmoji: "🛡️",
    skillTarget: "ally",
    blurb: "Shields a friend and draws attacks",
  },
  paladin: {
    name: "Paladin",
    emoji: "⚜️",
    maxHp: 120,
    atk: 12,
    speed: 5,
    skill: "Smite",
    skillEmoji: "✨",
    skillTarget: "monster",
    blurb: "Hits a monster and heals a friend",
    tip: "Smite also heals the weakest friend a little.",
  },
  rogue: {
    name: "Rogue",
    emoji: "🥷",
    maxHp: 105,
    atk: 13,
    speed: 10,
    skill: "Sneak Attack",
    skillEmoji: "💨",
    skillTarget: "monster",
    blurb: "Sneaky hits and grabs gold",
    tip: "Double damage on a monster that just attacked someone else. +3 gold.",
  },
  ranger: {
    name: "Ranger",
    emoji: "🏹",
    maxHp: 115,
    atk: 11,
    speed: 8,
    skill: "Arrow Volley",
    skillEmoji: "🏹",
    skillTarget: "allMonsters",
    blurb: "Arrows on every monster",
    tip: "Arrows reach flying monsters, and bats can't dodge them.",
  },
  summoner: {
    name: "Summoner",
    emoji: "🪄",
    maxHp: 105,
    atk: 10,
    speed: 7,
    skill: "Summon Spirit",
    skillEmoji: "🌟",
    skillTarget: "self",
    blurb: "A spirit friend attacks for 3 turns",
    tip: "The spirit's magic hits flying and faded monsters too.",
  },
  monk: {
    name: "Monk",
    emoji: "👊",
    maxHp: 115,
    atk: 12,
    speed: 8,
    skill: "Flurry",
    skillEmoji: "👊",
    skillTarget: "monster",
    blurb: "Two fast punches",
    tip: "Two hits in one move - great against dodgy foxes.",
  },
  ninja: {
    name: "Ninja",
    emoji: "🌀",
    maxHp: 80,
    atk: 12,
    speed: 11,
    skill: "Shadow Swipe",
    skillEmoji: "🌀",
    skillTarget: "monster",
    blurb: "Magic swipes that hit ghosts",
    tip: "Hits faded and flying monsters, and grabs back stolen potions.",
  },
  sorcerer: {
    name: "Sorcerer",
    emoji: "⚡",
    maxHp: 105,
    atk: 10,
    speed: 7,
    skill: "Chain Lightning",
    skillEmoji: "⚡",
    skillTarget: "allMonsters",
    blurb: "Lightning bounces to every monster",
    tip: "Strongest on the first monster, a bit less on each bounce.",
  },
  bard: {
    name: "Bard",
    emoji: "🎵",
    maxHp: 85,
    atk: 8,
    speed: 8,
    skill: "Cheer Song",
    skillEmoji: "🎵",
    skillTarget: "ally",
    blurb: "Makes a friend's next move a critical",
    tip: "Also heals a little and fills Team Spirit.",
  },
  berserker: {
    name: "Berserker",
    emoji: "🪓",
    maxHp: 100,
    atk: 13,
    speed: 6,
    skill: "Cleave",
    skillEmoji: "🪓",
    skillTarget: "allMonsters",
    blurb: "Swings at every monster",
    tip: "Hits harder the more hurt the Berserker is.",
  },
  druid: {
    name: "Druid",
    emoji: "🌿",
    maxHp: 110,
    atk: 10,
    speed: 6,
    skill: "Thorn Storm",
    skillEmoji: "🌿",
    skillTarget: "allMonsters",
    blurb: "Thorny magic on every monster",
    tip: "Magic thorns reach flying and faded monsters.",
  },
  hunter: {
    name: "Hunter",
    emoji: "🎯",
    maxHp: 95,
    atk: 12,
    speed: 9,
    skill: "Hunter's Mark",
    skillEmoji: "🎯",
    skillTarget: "monster",
    blurb: "Marks a monster for the team",
    tip: "Everyone hits a marked monster 25% harder - and it can't hide behind a disguise or thick hide.",
  },
  shaman: {
    name: "Shaman",
    emoji: "🪶",
    maxHp: 85,
    atk: 9,
    speed: 7,
    skill: "Healing Totem",
    skillEmoji: "🪶",
    skillTarget: "self",
    blurb: "A totem heals the team for 3 turns",
    tip: "The totem heals every friend a little after each of your turns.",
  },
  lancer: {
    name: "Lancer",
    emoji: "🔱",
    maxHp: 115,
    atk: 13,
    speed: 7,
    skill: "Sky Jump",
    skillEmoji: "🔱",
    skillTarget: "monster",
    blurb: "Leaps up, crashes down",
    tip: "Out of reach until your next turn. Hits flying and underground monsters.",
  },
  samurai: {
    name: "Samurai",
    emoji: "⚔️",
    maxHp: 110,
    atk: 14,
    speed: 8,
    skill: "Iaido Slash",
    skillEmoji: "⚔️",
    skillTarget: "monster",
    blurb: "Fast typing = huge slash",
    tip: "Even stronger on a critical, and strikes back at the next monster that hits you.",
  },
  engineer: {
    name: "Engineer",
    emoji: "🔧",
    maxHp: 115,
    atk: 10,
    speed: 6,
    skill: "Grenade",
    skillEmoji: "💣",
    skillTarget: "allMonsters",
    blurb: "Boom! Hits every monster",
    tip: "Fire damage on every monster, even underground ones.",
  },
  cleric: {
    name: "Cleric",
    emoji: "🔔",
    maxHp: 100,
    atk: 9,
    speed: 7,
    skill: "Bless",
    skillEmoji: "🔔",
    skillTarget: "ally",
    blurb: "A glowing shield on a friend",
    tip: "The shield soaks up the next 18 damage.",
  },
};

export type HeroSetup = {
  slot: number;
  cls: HeroClass;
  /** player uid, or null for a computer helper */
  uid: string | null;
  name: string;
};

/**
 * Players keep their picks; computer helpers take the free classes left over
 * (bought heroes are only ever played by their owners).
 */
export function buildParty(
  players: { uid: string; name: string; cls?: HeroClass }[],
): HeroSetup[] {
  const party: HeroSetup[] = [];
  const taken = new Set<HeroClass>();
  for (const p of players.slice(0, PARTY_SIZE)) {
    const cls =
      p.cls !== undefined && !taken.has(p.cls)
        ? p.cls
        : (FREE_HEROES.find((c) => !taken.has(c)) as HeroClass);
    taken.add(cls);
    party.push({ slot: party.length, cls, uid: p.uid, name: p.name });
  }
  for (const cls of FREE_HEROES) {
    if (party.length >= PARTY_SIZE) break;
    if (taken.has(cls)) continue;
    taken.add(cls);
    party.push({
      slot: party.length,
      cls,
      uid: null,
      name: `${CLASS_INFO[cls].name} (helper)`,
    });
  }
  return party;
}

export type QuestDifficulty = DifficultyOption & {
  words: string[];
  /** longer words for skills */
  skillWords: string[];
  /** how many words each move asks for */
  phrase: Record<HeroAction | "guard", number>;
  /** monster HP multiplier */
  hp: number;
  /** monster attack multiplier */
  atk: number;
};

export const QUEST_DIFFICULTIES: QuestDifficulty[] = [
  {
    label: "Easy",
    hint: "short words",
    words: EASY_WORDS,
    skillWords: EASY_WORDS,
    phrase: {
      attack: 2,
      skill: 3,
      defend: 2,
      potion: 2,
      ultimate: 3,
      guard: 1,
    },
    hp: 0.85,
    atk: 0.8,
  },
  {
    label: "Medium",
    words: MEDIUM_WORDS,
    skillWords: MEDIUM_WORDS,
    phrase: {
      attack: 2,
      skill: 3,
      defend: 2,
      potion: 2,
      ultimate: 3,
      guard: 1,
    },
    hp: 1.2,
    atk: 1.12,
  },
  {
    label: "Hard",
    hint: "long words",
    words: HARD_WORDS,
    skillWords: HARD_WORDS,
    phrase: {
      attack: 3,
      skill: 3,
      defend: 2,
      potion: 2,
      ultimate: 4,
      guard: 1,
    },
    hp: 1.28,
    atk: 1.3,
  },
];

export function questDifficultyFor(label: string): QuestDifficulty {
  return (
    QUEST_DIFFICULTIES.find((d) => d.label === label) ??
    (QUEST_DIFFICULTIES[0] as QuestDifficulty)
  );
}

export type QuestSetup = {
  seed: number;
  difficulty: QuestDifficulty;
  party: HeroSetup[];
  /** the weekly quest: fixed land + boss and a twist */
  weekly?: WeeklySetup;
};

// ---------------------------------------------------------------- weekly

export type TwistId = "fire" | "rain" | "giant" | "lucky" | "team" | "gold";

export const TWISTS: Record<
  TwistId,
  { name: string; emoji: string; tip: string }
> = {
  fire: {
    name: "Fire Week",
    emoji: "🔥",
    tip: "Fire does double damage",
  },
  rain: { name: "Rainy Week", emoji: "🌧️", tip: "It rains every battle" },
  giant: {
    name: "Giant Week",
    emoji: "💪",
    tip: "Tougher monsters, but +2 potions",
  },
  lucky: {
    name: "Lucky Week",
    emoji: "🍀",
    tip: "Every clean move is a critical",
  },
  team: {
    name: "Team Week",
    emoji: "🤝",
    tip: "Team Spirit fills twice as fast",
  },
  gold: {
    name: "Treasure Week",
    emoji: "💰",
    tip: "Start with 25 gold - the shop always comes",
  },
};
export const TWIST_IDS = Object.keys(TWISTS) as TwistId[];

export type WeeklySetup = {
  /** week id (Monday 00:00 Japan time, as a timestamp) */
  week: number;
  twist: TwistId;
  land: LandId;
  boss: MonsterKind;
};

/** Everyone in the school gets the same quest for the week. */
export function weeklyPlan(week: number): WeeklySetup & { seed: number } {
  const seed = hashString(`monster-quest-week-${week}`);
  const rng = seededRandom(seed);
  const land = WEEKLY_LAND_IDS[
    Math.floor(rng() * WEEKLY_LAND_IDS.length)
  ] as LandId;
  const bosses = LANDS[land].bosses;
  const boss = bosses[Math.floor(rng() * bosses.length)] as MonsterKind;
  const twist = TWIST_IDS[Math.floor(rng() * TWIST_IDS.length)] as TwistId;
  return { week, seed, land, boss, twist };
}

/** The weekly quest always uses Medium words. */
export const WEEKLY_DIFFICULTY = "Medium";

// ---------------------------------------------------------------- monsters

export type MonsterKind =
  | "slime"
  | "bat"
  | "mushroom"
  | "golem"
  | "dragon"
  | "snake"
  | "wolf"
  | "snowman"
  | "ghost"
  | "skeleton"
  | "imp"
  | "bolt"
  | "treant"
  | "queen"
  | "robot"
  // Ruins of Eldmoor (Legends set)
  | "beetle"
  | "mimic"
  | "wisp"
  | "hollowking"
  // Lantern Peaks (Wanderers set)
  | "lantern"
  | "toad"
  | "fox"
  | "kite"
  // Wildwood Jungle (Wild Ones set)
  | "wasp"
  | "croc"
  | "monkey"
  | "boar"
  // Dustbowl Canyon (Frontier set)
  | "scorpion"
  | "tumbleweed"
  | "dustdevil"
  | "rumbler";

export type MonsterInfo = {
  name: string;
  hp: number;
  atk: number;
  speed: number;
  boss: boolean;
  /** its special rule, said to the kids */
  trick: string;
};

export const MONSTER_INFO: Record<MonsterKind, MonsterInfo> = {
  slime: {
    name: "Gloopy Slime",
    hp: 95,
    atk: 25,
    speed: 4,
    boss: false,
    trick: "Splits in two when hurt",
  },
  bat: {
    name: "Batty Bat",
    hp: 75,
    atk: 22,
    speed: 9,
    boss: false,
    trick: "Dodges sloppy attacks - type perfectly!",
  },
  mushroom: {
    name: "Grumpy Mushroom",
    hp: 105,
    atk: 26,
    speed: 5,
    boss: false,
    trick: "Its spores can make you fall asleep",
  },
  snake: {
    name: "Sneaky Snake",
    hp: 85,
    atk: 20,
    speed: 7,
    boss: false,
    trick: "Poison bites - healing cures it",
  },
  wolf: {
    name: "Ice Wolf",
    hp: 90,
    atk: 24,
    speed: 8,
    boss: false,
    trick: "Bites two heroes at once",
  },
  snowman: {
    name: "Snowy",
    hp: 110,
    atk: 24,
    speed: 3,
    boss: false,
    trick: "Melts fast - fire does double damage",
  },
  ghost: {
    name: "Boo Ghost",
    hp: 80,
    atk: 23,
    speed: 6,
    boss: false,
    trick: "Fades away - only spells hit it then",
  },
  skeleton: {
    name: "Rattle Bones",
    hp: 80,
    atk: 24,
    speed: 5,
    boss: false,
    trick: "Puts itself back together once",
  },
  imp: {
    name: "Cheeky Imp",
    hp: 70,
    atk: 20,
    speed: 9,
    boss: false,
    trick: "Steals potions - beat it to get them back",
  },
  bolt: {
    name: "Bolt Bot",
    hp: 55,
    atk: 15,
    speed: 6,
    boss: false,
    trick: "King Clank's little helper",
  },
  golem: {
    name: "Rocky the Golem",
    hp: 570,
    atk: 42,
    speed: 4,
    boss: true,
    trick: "Charges up a huge smash - Defend!",
  },
  dragon: {
    name: "Blaze the Dragon",
    hp: 560,
    atk: 46,
    speed: 7,
    boss: true,
    trick: "Flies up where swords can't reach",
  },
  treant: {
    name: "Thornroot",
    hp: 460,
    atk: 36,
    speed: 3,
    boss: true,
    trick: "Regrows leaves - fire does double damage",
  },
  queen: {
    name: "The Frost Queen",
    hp: 560,
    atk: 44,
    speed: 6,
    boss: true,
    trick: "Can freeze a hero solid",
  },
  robot: {
    name: "King Clank",
    hp: 540,
    atk: 38,
    speed: 5,
    boss: true,
    trick: "Calls in Bolt Bots when angry",
  },
  beetle: {
    name: "Shellback Beetle",
    hp: 100,
    atk: 22,
    speed: 3,
    boss: false,
    trick:
      "Hard shell - single hits do half damage until a hit-everyone move cracks it",
  },
  mimic: {
    name: "Mimic Chest",
    hp: 85,
    atk: 27,
    speed: 6,
    boss: false,
    trick: "A chest that bites! Beat it for 10 gold",
  },
  wisp: {
    name: "Will-o'-Wisp",
    hp: 65,
    atk: 21,
    speed: 9,
    boss: false,
    trick: "Floats up high every other turn - use spells or arrows",
  },
  hollowking: {
    name: "The Hollow King",
    hp: 540,
    atk: 40,
    speed: 5,
    boss: true,
    trick: "Calls Shellback Beetles when angry - holy moves hit it extra hard",
  },
  lantern: {
    name: "Lantern Spook",
    hp: 80,
    atk: 22,
    speed: 6,
    boss: false,
    trick: "Fades away - only spells hit it then",
  },
  toad: {
    name: "Thunder Toad",
    hp: 100,
    atk: 21,
    speed: 4,
    boss: false,
    trick: "Charges up, then zaps everyone - Defend!",
  },
  fox: {
    name: "Trickster Fox",
    hp: 75,
    atk: 23,
    speed: 9,
    boss: false,
    trick:
      "Dodges the first hit after each of its turns - hit twice or hit everyone",
  },
  kite: {
    name: "Gale the Storm Kite",
    hp: 550,
    atk: 40,
    speed: 7,
    boss: true,
    trick:
      "Floats up every other turn and claps thunder on everyone every 3rd turn",
  },
  wasp: {
    name: "Stinger Wasp",
    hp: 70,
    atk: 20,
    speed: 9,
    boss: false,
    trick: "Poison stings - healing cures it",
  },
  croc: {
    name: "Snapjaw Log",
    hp: 105,
    atk: 25,
    speed: 3,
    boss: false,
    trick: "Pretends to be a log - half damage until it bites (or gets marked)",
  },
  monkey: {
    name: "Vine Monkey",
    hp: 75,
    atk: 20,
    speed: 10,
    boss: false,
    trick: "Steals gold - beat it to get the gold back",
  },
  boar: {
    name: "Thundertusk",
    hp: 580,
    atk: 42,
    speed: 4,
    boss: true,
    trick:
      "Charges up a stampede - Defend! Thick hide: mark it to hit full power",
  },
  scorpion: {
    name: "Sand Scorpion",
    hp: 90,
    atk: 22,
    speed: 6,
    boss: false,
    trick:
      "Gets angry when hit up close - its next sting is stronger. Use arrows, magic or hit-everyone moves",
  },
  tumbleweed: {
    name: "Tumbleweed",
    hp: 60,
    atk: 18,
    speed: 7,
    boss: false,
    trick: "Rolls in a little friend - hit everyone to clear them fast",
  },
  dustdevil: {
    name: "Dust Devil",
    hp: 75,
    atk: 21,
    speed: 9,
    boss: false,
    trick: "Blows away your potions - guard well!",
  },
  rumbler: {
    name: "The Great Rumbler",
    hp: 570,
    atk: 42,
    speed: 5,
    boss: true,
    trick:
      "Digs underground every other turn - only hit-everyone moves and jumps reach it",
  },
};

/** The word to type to aim at a monster (twins add "a" / "b"). */
export const KIND_WORD: Record<MonsterKind, string> = {
  slime: "slime",
  bat: "bat",
  mushroom: "mushroom",
  snake: "snake",
  wolf: "wolf",
  snowman: "snowy",
  ghost: "ghost",
  skeleton: "bones",
  imp: "imp",
  bolt: "bot",
  golem: "golem",
  dragon: "dragon",
  treant: "thornroot",
  queen: "queen",
  robot: "clank",
  beetle: "beetle",
  mimic: "mimic",
  wisp: "wisp",
  hollowking: "king",
  lantern: "lantern",
  toad: "toad",
  fox: "fox",
  kite: "kite",
  wasp: "wasp",
  croc: "log",
  monkey: "monkey",
  boar: "tusk",
  scorpion: "scorpion",
  tumbleweed: "tumbleweed",
  dustdevil: "devil",
  rumbler: "rumbler",
};

export function monsterWord(m: {
  kind: MonsterKind;
  name: string;
  mini?: boolean;
}): string {
  const twin = /\s([A-E])$/.exec(m.name)?.[1];
  const base =
    m.mini === true ? `mini ${KIND_WORD[m.kind]}` : KIND_WORD[m.kind];
  return twin === undefined ? base : `${base} ${twin.toLowerCase()}`;
}

export type LandId =
  | "forest"
  | "mountain"
  | "castle"
  | "ruins"
  | "peaks"
  | "jungle"
  | "canyon";

export type LandInfo = {
  name: string;
  emoji: string;
  minions: MonsterKind[];
  bosses: MonsterKind[];
};

export const LANDS: Record<LandId, LandInfo> = {
  forest: {
    name: "Whisper Forest",
    emoji: "🌲",
    minions: ["slime", "mushroom", "snake"],
    bosses: ["treant", "golem"],
  },
  mountain: {
    name: "Frosty Mountain",
    emoji: "🏔️",
    minions: ["bat", "wolf", "snowman"],
    bosses: ["queen", "dragon"],
  },
  castle: {
    name: "Spooky Castle",
    emoji: "🏰",
    minions: ["ghost", "skeleton", "imp"],
    bosses: ["robot", "dragon"],
  },
  ruins: {
    name: "Ruins of Eldmoor",
    emoji: "🏛️",
    minions: ["beetle", "mimic", "wisp"],
    bosses: ["hollowking", "golem"],
  },
  peaks: {
    name: "Lantern Peaks",
    emoji: "🏮",
    minions: ["lantern", "toad", "fox"],
    bosses: ["kite", "queen"],
  },
  jungle: {
    name: "Wildwood Jungle",
    emoji: "🌴",
    minions: ["wasp", "croc", "monkey"],
    bosses: ["boar", "treant"],
  },
  canyon: {
    name: "Dustbowl Canyon",
    emoji: "🌵",
    minions: ["scorpion", "tumbleweed", "dustdevil"],
    bosses: ["rumbler", "robot"],
  },
};
export const LAND_IDS: LandId[] = [
  "forest",
  "mountain",
  "castle",
  "ruins",
  "peaks",
  "jungle",
  "canyon",
];
/** The weekly quest only picks from these, so adding a land never changes a week already planned. */
export const WEEKLY_LAND_IDS: LandId[] = ["forest", "mountain", "castle"];
export const BATTLE_COUNT = 3;

/** Monsters for battle 0 (2 of them) and battle 1 (3) in a land. */
export function battleKinds(
  seed: number,
  land: LandId,
  battle: number,
): MonsterKind[] {
  const rng = seededRandom(seed ^ 0x5eed ^ Math.imul(battle + 1, 0x2545f491));
  const list = LANDS[land].minions;
  const pick = (): MonsterKind =>
    list[Math.floor(rng() * list.length)] as MonsterKind;
  return battle === 0 ? [pick(), pick()] : [pick(), pick(), pick()];
}

// ---------------------------------------------------------------- random

/** Small seeded generator so every player gets the same picks. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------- typing power

/** Fast enough for a critical hit. */
export function fastMs(phrase: string): number {
  return 900 + phrase.length * 380;
}

/** Strength of a typed move: 1.5 = critical, 0.4 = ran out of time. */
export function typingPower(word: string, errors: number, ms: number): number {
  if (errors === 0) return ms <= fastMs(word) ? 1.5 : 1;
  return errors <= 2 ? 0.75 : 0.55;
}

export const TIMEOUT_POWER = 0.4;
export const CRIT_POWER = 1.5;

// ---------------------------------------------------------------- inputs

export type HeroAction = "attack" | "skill" | "defend" | "potion" | "ultimate";

// ---------------------------------------------------------------- level up

export type UltimateId =
  | "whirlwind"
  | "mighty"
  | "icestorm"
  | "thunder"
  | "groupheal"
  | "holy"
  | "wall"
  | "slam"
  | "judgement"
  | "aura"
  | "vanish"
  | "startoss"
  | "hawk"
  | "arrowrain"
  | "phoenix"
  | "titan"
  | "thunderpalm"
  | "innerpeace"
  | "smokebomb"
  | "shadowclone"
  | "meteor"
  | "stormcall"
  | "anthem"
  | "lullaby"
  | "rampage"
  | "warcry"
  | "bearform"
  | "grove"
  | "pindown"
  | "packhunt"
  | "wolves"
  | "ancestors"
  | "cometdive"
  | "spearsweep"
  | "petalstorm"
  | "moonslash"
  | "turret"
  | "megabomb"
  | "sanctuary"
  | "purify";

export type UltimateInfo = {
  name: string;
  emoji: string;
  cls: HeroClass;
  aim: "monster" | "allMonsters" | "allAllies" | "self";
  blurb: string;
};

/** Super moves picked at the level up; they recharge after a few turns. */
export const ULTIMATES: Record<UltimateId, UltimateInfo> = {
  whirlwind: {
    name: "Whirlwind",
    emoji: "🌪️",
    cls: "knight",
    aim: "allMonsters",
    blurb: "Spin and hit every monster",
  },
  mighty: {
    name: "Mighty Blow",
    emoji: "🔨",
    cls: "knight",
    aim: "monster",
    blurb: "One giant hit",
  },
  icestorm: {
    name: "Ice Storm",
    emoji: "🧊",
    cls: "mage",
    aim: "allMonsters",
    blurb: "Hail on every monster - never misses",
  },
  thunder: {
    name: "Thunder",
    emoji: "⚡",
    cls: "mage",
    aim: "monster",
    blurb: "A huge lightning bolt that never misses",
  },
  groupheal: {
    name: "Group Heal",
    emoji: "💞",
    cls: "healer",
    aim: "allAllies",
    blurb: "Heals the whole team",
  },
  holy: {
    name: "Holy Light",
    emoji: "🌟",
    cls: "healer",
    aim: "monster",
    blurb: "Extra strong on ghosts and skeletons",
  },
  wall: {
    name: "Shield Wall",
    emoji: "🧱",
    cls: "guardian",
    aim: "allAllies",
    blurb: "The whole team defends",
  },
  slam: {
    name: "Earth Slam",
    emoji: "🌋",
    cls: "guardian",
    aim: "allMonsters",
    blurb: "Shake every monster",
  },
  judgement: {
    name: "Judgement",
    emoji: "⚖️",
    cls: "paladin",
    aim: "monster",
    blurb: "Huge holy hit - double on ghosts, bones and the Hollow King",
  },
  aura: {
    name: "Holy Aura",
    emoji: "🌟",
    cls: "paladin",
    aim: "allAllies",
    blurb: "Heals everyone a bit and the whole team defends",
  },
  vanish: {
    name: "Vanish",
    emoji: "💨",
    cls: "rogue",
    aim: "self",
    blurb: "Disappear: monsters can't hit you, next move is a critical",
  },
  startoss: {
    name: "Star Toss",
    emoji: "✴️",
    cls: "rogue",
    aim: "allMonsters",
    blurb: "Throwing stars hit every monster, even flying ones",
  },
  hawk: {
    name: "Hawk Shot",
    emoji: "🦅",
    cls: "ranger",
    aim: "monster",
    blurb: "One giant arrow - triple on flying monsters",
  },
  arrowrain: {
    name: "Arrow Rain",
    emoji: "🌧️",
    cls: "ranger",
    aim: "allMonsters",
    blurb: "A big rain of arrows on every monster",
  },
  phoenix: {
    name: "Phoenix",
    emoji: "🔥",
    cls: "summoner",
    aim: "allMonsters",
    blurb: "Fire bird hits every monster and wakes up a friend",
  },
  titan: {
    name: "Titan",
    emoji: "🗿",
    cls: "summoner",
    aim: "monster",
    blurb: "A stone giant stomps one monster - never misses",
  },
  thunderpalm: {
    name: "Thunder Palm",
    emoji: "🫸",
    cls: "monk",
    aim: "monster",
    blurb: "One huge palm strike that never misses",
  },
  innerpeace: {
    name: "Inner Peace",
    emoji: "🧘",
    cls: "monk",
    aim: "self",
    blurb: "Heal yourself a lot, shake off poison and defend",
  },
  smokebomb: {
    name: "Smoke Bomb",
    emoji: "💨",
    cls: "ninja",
    aim: "allAllies",
    blurb: "Every monster misses its next attack",
  },
  shadowclone: {
    name: "Shadow Clone",
    emoji: "👥",
    cls: "ninja",
    aim: "monster",
    blurb: "You and your clone both strike - magic, never misses",
  },
  meteor: {
    name: "Meteor",
    emoji: "☄️",
    cls: "sorcerer",
    aim: "allMonsters",
    blurb: "A fiery rock falls on every monster",
  },
  stormcall: {
    name: "Storm Call",
    emoji: "🌩️",
    cls: "sorcerer",
    aim: "monster",
    blurb: "A giant lightning storm on one monster",
  },
  anthem: {
    name: "Hero Anthem",
    emoji: "🎺",
    cls: "bard",
    aim: "allAllies",
    blurb: "Everyone's next move is a critical, +Team Spirit",
  },
  lullaby: {
    name: "Lullaby",
    emoji: "😴",
    cls: "bard",
    aim: "allMonsters",
    blurb: "Every monster falls asleep and skips a turn",
  },
  rampage: {
    name: "Rampage",
    emoji: "💢",
    cls: "berserker",
    aim: "monster",
    blurb: "One giant swing - even bigger when you're hurt",
  },
  warcry: {
    name: "War Cry",
    emoji: "📣",
    cls: "berserker",
    aim: "allMonsters",
    blurb: "Scares every monster - they hit softer for the battle",
  },
  bearform: {
    name: "Bear Form",
    emoji: "🐻",
    cls: "druid",
    aim: "self",
    blurb: "Turn into a bear: heal, defend and draw attacks",
  },
  grove: {
    name: "Blooming Grove",
    emoji: "🌸",
    cls: "druid",
    aim: "allAllies",
    blurb: "Flowers heal the whole team and cure poison",
  },
  pindown: {
    name: "Pin Down",
    emoji: "📌",
    cls: "hunter",
    aim: "monster",
    blurb: "A huge arrow that pins a monster - it skips a turn",
  },
  packhunt: {
    name: "Pack Hunt",
    emoji: "🐺",
    cls: "hunter",
    aim: "allMonsters",
    blurb: "Arrows on every monster, and marks them all",
  },
  wolves: {
    name: "Spirit Wolves",
    emoji: "🐺",
    cls: "shaman",
    aim: "allMonsters",
    blurb: "Spirit wolves bite every monster",
  },
  ancestors: {
    name: "Ancestors' Call",
    emoji: "🪶",
    cls: "shaman",
    aim: "allAllies",
    blurb: "Wakes up every fallen friend and heals the team",
  },
  cometdive: {
    name: "Comet Dive",
    emoji: "☄️",
    cls: "lancer",
    aim: "monster",
    blurb: "A giant dive from the sky - reaches anything",
  },
  spearsweep: {
    name: "Spear Sweep",
    emoji: "🔱",
    cls: "lancer",
    aim: "allMonsters",
    blurb: "One wide sweep hits every monster",
  },
  petalstorm: {
    name: "Petal Storm",
    emoji: "🌸",
    cls: "samurai",
    aim: "allMonsters",
    blurb: "A storm of slashes on every monster",
  },
  moonslash: {
    name: "Moon Slash",
    emoji: "🌙",
    cls: "samurai",
    aim: "monster",
    blurb: "One perfect slash - huge damage",
  },
  turret: {
    name: "Build Turret",
    emoji: "⚙️",
    cls: "engineer",
    aim: "self",
    blurb: "A turret shoots a monster after each of your turns (3 turns)",
  },
  megabomb: {
    name: "Mega Bomb",
    emoji: "💥",
    cls: "engineer",
    aim: "allMonsters",
    blurb: "A huge boom on every monster",
  },
  sanctuary: {
    name: "Sanctuary",
    emoji: "🛡️",
    cls: "cleric",
    aim: "allAllies",
    blurb: "A glowing shield on the whole team",
  },
  purify: {
    name: "Purify",
    emoji: "✨",
    cls: "cleric",
    aim: "allAllies",
    blurb: "Heals everyone and pulls every monster out of hiding",
  },
};

export const ULTIMATE_CHOICES: Record<HeroClass, UltimateId[]> = {
  knight: ["whirlwind", "mighty"],
  mage: ["icestorm", "thunder"],
  healer: ["groupheal", "holy"],
  guardian: ["wall", "slam"],
  paladin: ["judgement", "aura"],
  rogue: ["vanish", "startoss"],
  ranger: ["hawk", "arrowrain"],
  summoner: ["phoenix", "titan"],
  monk: ["thunderpalm", "innerpeace"],
  ninja: ["smokebomb", "shadowclone"],
  sorcerer: ["meteor", "stormcall"],
  bard: ["anthem", "lullaby"],
  berserker: ["rampage", "warcry"],
  druid: ["bearform", "grove"],
  hunter: ["pindown", "packhunt"],
  shaman: ["wolves", "ancestors"],
  lancer: ["cometdive", "spearsweep"],
  samurai: ["petalstorm", "moonslash"],
  engineer: ["turret", "megabomb"],
  cleric: ["sanctuary", "purify"],
};

const BOSS_HP = 1.45;
const BOSS_ATK = 1.1;

/** Typing streak: +5% damage per clean move in a row, up to +25%. */
export const STREAK_STEP = 0.05;
export const STREAK_MAX = 5;

/** A used super move comes back after this many of the hero's turns. */
export const ULTIMATE_COOLDOWN = 3;
/** Super moves get a longer show: cut-in, effect, then the hits. */
export const ULTIMATE_MS = 2400;

/** Level 2 heroes hit harder and have more HP. */
export const LEVEL_BOOST = 1.15;

// ---------------------------------------------------------------- journey

export type JourneyKind = "chest" | "shop" | "trap" | "fairy";
export type Weather = "clear" | "rain" | "sun" | "wind";

export const WEATHER_INFO: Record<
  Exclude<Weather, "clear">,
  { emoji: string; name: string; tip: string }
> = {
  rain: { emoji: "🌧️", name: "Rain", tip: "fire is weaker" },
  sun: { emoji: "☀️", name: "Sunny", tip: "heals and fire are stronger" },
  wind: { emoji: "🌬️", name: "Windy", tip: "monsters sometimes miss" },
};

export const SHOP_ITEMS: Record<
  string,
  { label: string; emoji: string; price: number; detail: string }
> = {
  potion: { label: "Potion", emoji: "🧪", price: 8, detail: "+1 potion" },
  feast: {
    label: "Picnic",
    emoji: "🍎",
    price: 10,
    detail: "Heal everyone a lot",
  },
  charm: {
    label: "Power Charm",
    emoji: "💪",
    price: 15,
    detail: "Everyone hits harder",
  },
  save: { label: "Save gold", emoji: "💰", price: 0, detail: "Buy nothing" },
};

// ---------------------------------------------------------------- teamwork

/** Two different heroes' skills back to back make a combo. */
export const COMBOS: Record<string, { name: string; emoji: string }> = {
  "knight+mage": { name: "Flame Blade", emoji: "🔥" },
  "healer+knight": { name: "Holy Strike", emoji: "✨" },
  "guardian+knight": { name: "Shield Charge", emoji: "🛡️" },
  "healer+mage": { name: "Rainbow Spell", emoji: "🌈" },
  "guardian+mage": { name: "Rock Storm", emoji: "🪨" },
  "guardian+healer": { name: "Safe Haven", emoji: "💠" },
};
export const COMBO_BOOST = 1.3;
/** Summoner's spirit friend attacks after this many of their turns. */
export const SPIRIT_TURNS = 3;
/** Shaman's totem heals after this many of their turns. */
export const TOTEM_TURNS = 3;
/** Hunter's Mark: everyone hits a marked monster this much harder. */
export const MARK_BOOST = 1.25;
/** New heroes' hit-everyone skills on a lone monster. */
export const FOCUS_BOOST = 1.4;
/** Cleric's Bless soaks up this much damage. */
export const WARD = 18;
/** any other two different heroes */
export const TEAM_COMBO = { name: "Team Combo", emoji: "🤝" };

export function comboFor(
  a: HeroClass,
  b: HeroClass,
): { name: string; emoji: string } | undefined {
  if (a === b) return undefined;
  const named = COMBOS[[a, b].sort().join("+")];
  if (named !== undefined) return named;
  const set = setOfHero(a);
  if (set !== undefined && set === setOfHero(b)) return set.combo;
  return TEAM_COMBO;
}

/** Team Spirit needed for a Team Attack. */
export const SPIRIT_MAX = 16;

export type OutcomeKind =
  | "chestOpen"
  | "chestStuck"
  | "trapDodged"
  | "trapHit"
  | "fairy"
  | "potion"
  | "feast"
  | "charm"
  | "save";

export type HeroInput = {
  kind: "hero";
  action: HeroAction;
  /** monster index (attack / single skill) or hero slot (heal / protect / potion) */
  target?: number;
  power: number;
  timeout?: boolean;
};

export type GuardInput = {
  kind: "guard";
  /** uid -> guarded in time */
  guards?: Record<string, boolean>;
};

export type VoteInput = {
  kind: "vote";
  /** uid -> option id */
  votes?: Record<string, string>;
};

export type QuestInput = HeroInput | GuardInput | VoteInput;

export type VoteTopic = "land" | "boss" | "shop";

export type VoteOption = {
  id: string;
  /** what to type to choose it */
  word: string;
  label: string;
  emoji: string;
  detail: string;
  /** boss choices show the boss */
  monster?: MonsterKind;
};

// ---------------------------------------------------------------- state

export type HeroState = HeroSetup & {
  hp: number;
  maxHp: number;
  defending: boolean;
  /** protected by this guardian slot until its next turn */
  protectedBy?: number;
  /** player stopped answering: a helper plays for them */
  away: boolean;
  timeouts: number;
  /** poison turns left */
  poison: number;
  /** turns to skip (asleep / frozen) */
  sleep: number;
  sleepWhy?: "asleep" | "frozen";
  level: number;
  ultimate?: UltimateId;
  /** own turns until the super move is ready again (0 = ready) */
  ultimateCooldown: number;
  /** fairy: next move is a critical */
  blessed: boolean;
  /** clean moves in a row (players): a growing damage bonus */
  streak: number;
  /** summoner: turns the spirit friend keeps attacking */
  familiar: number;
  /** rogue vanished: monsters can't pick them until their next turn */
  hidden: boolean;
  /** druid's bear form: own turns left drawing attacks */
  taunt: number;
  /** shaman's healing totem: turns left */
  totem: number;
  /** cleric's Bless: damage the glowing shield still soaks up */
  ward: number;
  /** samurai: strikes back at the next monster that hits them */
  counter: boolean;
};

export type MonsterState = {
  index: number;
  kind: MonsterKind;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  boss: boolean;
  /** turns taken so far */
  turns: number;
  /** ghost: only spells hit */
  faded: boolean;
  /** dragon: only spells hit */
  flying: boolean;
  /** golem: a big smash next turn */
  charging: boolean;
  /** skeleton came back once / slime split once */
  used: boolean;
  /** potions an imp took */
  stolen: number;
  /** small spawned monster (mini slime) */
  mini?: boolean;
  /** hero slots it hit on its last move (rogue's Sneak Attack) */
  lastTargets?: number[];
  /** bard's Lullaby: skips its next turn */
  asleep?: boolean;
  /** trickster fox: dodges the next single hit */
  dodge?: boolean;
  /** hunter's mark: everyone hits it MARK_BOOST harder */
  marked?: boolean;
  /** great rumbler: underground (only hit-everyone moves and jumps reach) */
  burrowed?: boolean;
  /** sand scorpion: hit up close since its last turn */
  stung?: boolean;
};

export type MonsterFlags = Pick<
  MonsterState,
  "faded" | "flying" | "charging" | "burrowed"
>;

export type StatusKind =
  | "poison"
  | "asleep"
  | "frozen"
  | "regrow"
  | "rebuild"
  | "potionsBack"
  | "shellCracked"
  | "mimicGold"
  | "monsterAsleep"
  | "goldBack";

export type HitResult = {
  /** "h0".."h3" or "m0".. */
  id: string;
  amount: number;
  /** damage (default) or healing */
  heal?: boolean;
  revive?: boolean;
  crit?: boolean;
  guarded?: boolean;
  ko?: boolean;
  /** dodged / passed through */
  miss?: boolean;
  /** fire on a melty / leafy monster */
  weak?: boolean;
};

export type QuestEvent =
  | {
      type: "battle";
      battle: number;
      land: LandId;
      weather: Weather;
      monsters: MonsterState[];
    }
  | { type: "path"; topic: "land" | "boss"; choice: VoteOption; land: LandId }
  | { type: "spawn"; monster: MonsterState }
  | { type: "journey"; what: JourneyKind }
  | { type: "team"; hits: HitResult[]; ids: string[] }
  | {
      type: "outcome";
      what: OutcomeKind;
      hits: HitResult[];
      /** heroes it happened to */
      ids: string[];
    }
  | {
      type: "levelup";
      picks: Record<number, UltimateId>;
      hp: number[];
      maxHp: number[];
    }
  | { type: "status"; id: string; what: StatusKind; hits: HitResult[] }
  | {
      type: "action";
      actor: string;
      /** e.g. "Power Strike", "Attack", "Big Stomp" */
      move: string;
      emoji: string;
      hits: HitResult[];
      note?: string;
      /** heroes who get a shield (Defend / Protect / Shield Wall) */
      shield?: string;
      shields?: string[];
      /** a monster's state after its move (fading, flying, charging) */
      flags?: MonsterFlags;
      /** combo name when two heroes' skills chained */
      combo?: string;
      /** a super move (gets the big cut-in) */
      ultimate?: UltimateId;
    }
  | { type: "angry"; actor: string }
  | { type: "rest"; hp: number[] }
  | { type: "end"; won: boolean };

export type PendingHero = {
  kind: "hero";
  n: number;
  slot: number;
  uid: string;
  /** words for each action */
  words: Record<HeroAction, string>;
  /** a helper has been playing for them: short timer, any move brings them back */
  away?: boolean;
};

export type PendingGuard = {
  kind: "guard";
  n: number;
  monster: number;
  /** uid -> word to type */
  words: Record<string, string>;
  big: boolean;
  /** time allowed */
  ms: number;
};

export type PendingVote = {
  kind: "vote";
  n: number;
  topic: VoteTopic;
  options: VoteOption[];
  /** players who get a vote */
  voters: string[];
};

/** Everyone types a phrase (chest / trap). Answered with a guard input. */
export type PendingChallenge = {
  kind: "challenge";
  n: number;
  what: "chest" | "trap" | "team";
  /** uid -> words to type */
  words: Record<string, string>;
  /** time allowed */
  ms: number;
};

/** Each player picks their own super move. Answered with a vote input. */
export type PendingPick = {
  kind: "pick";
  n: number;
  /** uid -> that player's choices */
  options: Record<string, VoteOption[]>;
  voters: string[];
};

export type Pending =
  | PendingHero
  | PendingGuard
  | PendingVote
  | PendingChallenge
  | PendingPick;

export type HeroStats = {
  damage: number;
  healed: number;
  guards: number;
  crits: number;
};

export type QuestState = {
  battle: number;
  /** chosen land, null until the first vote */
  land: LandId | null;
  weather: Weather;
  /** party gold for the shop */
  gold: number;
  /** power charm: hero damage multiplier */
  strength: number;
  /** fills from good typing; full = Team Attack */
  spirit: number;
  /** weekly twist in play */
  twist?: TwistId;
  /** slot of the hero whose skill came just before (for combos) */
  lastSkill?: number;
  /** ninja's Smoke Bomb: monster attacks left that miss */
  smoke: number;
  heroes: HeroState[];
  monsters: MonsterState[];
  potions: number;
  angry: boolean;
  over: boolean;
  won: boolean;
  events: QuestEvent[];
  pending: Pending | null;
  /** inputs used so far */
  used: number;
  /** events.length just before input k was applied (for timing) */
  inputStart: number[];
  stats: Record<number, HeroStats>;
  /** actor ids in the round so far, for the turn bar */
  upNext: string[];
};

export const START_POTIONS = 3;
export const POTION_HEAL = 50;
/** guarded hits keep this share of the damage */
export const GUARD_SHARE = 0.4;
/** computer helpers guard this often */
const CPU_GUARD_CHANCE = 0.6;
/** missed this many turns in a row: a helper takes over (online only) */
const AWAY_AFTER = 2;
const REST_HEAL = 0.3;
/** safety stop for the turn loop */
const MAX_STEPS = 2000;

export const heroId = (slot: number): string => `h${slot}`;
export const monsterId = (index: number): string => `m${index}`;

function makeMonsters(
  kinds: MonsterKind[],
  d: QuestDifficulty,
): MonsterState[] {
  const seen: Partial<Record<MonsterKind, number>> = {};
  return kinds.map((kind, index) => {
    const info = MONSTER_INFO[kind];
    // bosses face levelled-up heroes
    const maxHp = Math.round(info.hp * d.hp * (info.boss ? BOSS_HP : 1));
    // two of the same monster: "Gloopy Slime A", "Gloopy Slime B"
    const twins = kinds.filter((k) => k === kind).length > 1;
    const nth = seen[kind] ?? 0;
    seen[kind] = nth + 1;
    return {
      index,
      kind,
      name: twins ? `${info.name} ${String.fromCharCode(65 + nth)}` : info.name,
      hp: maxHp,
      maxHp,
      atk: Math.round(info.atk * d.atk * (info.boss ? BOSS_ATK : 1)),
      speed: info.speed,
      boss: info.boss,
      turns: 0,
      faded: false,
      flying: false,
      charging: false,
      used: false,
      stolen: 0,
      ...(kind === "fox" ? { dodge: true } : {}),
    };
  });
}

/** A monster joining mid-battle (mini slime, Bolt Bots). */
function spawnMonster(
  s: QuestState,
  kind: MonsterKind,
  d: QuestDifficulty,
  opts: { name: string; share: number; mini?: boolean },
): MonsterState | null {
  if (alive(s.monsters).length >= 5) return null;
  const info = MONSTER_INFO[kind];
  const maxHp = Math.max(1, Math.round(info.hp * d.hp * opts.share));
  const m: MonsterState = {
    index: s.monsters.length,
    kind,
    name: opts.name,
    hp: maxHp,
    maxHp,
    atk: Math.round(info.atk * d.atk * (opts.mini === true ? 0.6 : 1)),
    speed: info.speed,
    boss: false,
    turns: 0,
    faded: false,
    flying: false,
    charging: false,
    // spawned shellbacks still have their shell
    used: kind !== "beetle",
    stolen: 0,
    ...(opts.mini === true ? { mini: true } : {}),
  };
  s.monsters.push(m);
  s.events.push({ type: "spawn", monster: { ...m } });
  return m;
}

const flagsOf = (m: MonsterState): MonsterFlags => ({
  faded: m.faded,
  flying: m.flying,
  charging: m.charging,
  burrowed: m.burrowed === true,
});

/** Holy moves hit these extra hard. */
const UNDEAD: ReadonlySet<MonsterKind> = new Set<MonsterKind>([
  "ghost",
  "skeleton",
  "hollowking",
  "lantern",
]);

/** Swords can't reach a faded ghost or a flying dragon. */
export const untouchable = (m: MonsterState): boolean =>
  m.faded || m.flying || m.burrowed === true;

const POISON_DMG = 5;
/** gold a beaten Mimic Chest drops */
export const MIMIC_GOLD = 10;

function landOptions(): VoteOption[] {
  return LAND_IDS.map((id) => {
    const land = LANDS[id];
    return {
      id,
      word: id,
      label: land.name,
      emoji: land.emoji,
      detail: land.minions.map((k) => MONSTER_INFO[k].name).join(", "),
    };
  });
}

function bossOptions(land: LandId): VoteOption[] {
  return LANDS[land].bosses.map((k) => ({
    id: k,
    word: KIND_WORD[k],
    label: MONSTER_INFO[k].name,
    emoji: "👑",
    detail: MONSTER_INFO[k].trick,
    monster: k,
  }));
}

/** Most votes wins; a tie (or nobody voting) is settled by the seed. */
export function tallyVotes(
  options: VoteOption[],
  votes: Record<string, string>,
  voters: string[],
  rng: () => number,
): VoteOption {
  const counts = new Map<string, number>();
  for (const uid of voters) {
    const v = votes[uid];
    if (v !== undefined && options.some((o) => o.id === v)) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  const best = Math.max(0, ...counts.values());
  const top =
    best === 0 ? options : options.filter((o) => counts.get(o.id) === best);
  return top[Math.floor(rng() * top.length)] ?? (options[0] as VoteOption);
}

type Actor = { id: string; speed: number; order: number };

function roundOrder(s: QuestState): string[] {
  const actors: Actor[] = [
    ...s.heroes
      .filter((h) => h.hp > 0)
      .map((h) => ({
        id: heroId(h.slot),
        speed: CLASS_INFO[h.cls].speed,
        order: h.slot,
      })),
    ...s.monsters
      .filter((m) => m.hp > 0)
      .map((m) => ({
        id: monsterId(m.index),
        speed: m.speed,
        order: 10 + m.index,
      })),
  ];
  return actors
    .sort((a, b) => b.speed - a.speed || a.order - b.order)
    .map((a) => a.id);
}

const alive = <T extends { hp: number }>(list: T[]): T[] =>
  list.filter((x) => x.hp > 0);

function lowest<T extends { hp: number; maxHp: number }>(
  list: T[],
): T | undefined {
  return [...list].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
}

function rollPower(rng: () => number): number {
  if (rng() < 0.15) return CRIT_POWER;
  return 0.8 + rng() * 0.35;
}

/** What a computer helper (or an away player) does. */
function cpuChoice(
  s: QuestState,
  hero: HeroState,
  rng: () => number,
): HeroInput {
  const power = rollPower(rng);
  const monsters = alive(s.monsters);
  const reachable = monsters.filter((m) => !untouchable(m));
  const weakest = lowest(reachable.length > 0 ? reachable : monsters);
  const attack: HeroInput = {
    kind: "hero",
    action: "attack",
    target: weakest?.index ?? 0,
    power,
  };
  if (
    hero.ultimate !== undefined &&
    hero.ultimateCooldown === 0 &&
    rng() < 0.35
  ) {
    return { ...attack, action: "ultimate" };
  }
  if (hero.cls === "healer") {
    const down = s.heroes.find((h) => h.hp <= 0);
    if (down !== undefined) {
      return { kind: "hero", action: "skill", target: down.slot, power };
    }
    const hurt = lowest(alive(s.heroes));
    if (hurt !== undefined && hurt.hp / hurt.maxHp < 0.55) {
      return { kind: "hero", action: "skill", target: hurt.slot, power };
    }
    return attack;
  }
  if (hero.cls === "guardian") {
    const hurt = lowest(
      alive(s.heroes).filter(
        (h) => h.slot !== hero.slot && h.protectedBy === undefined,
      ),
    );
    if (hurt !== undefined && hurt.hp / hurt.maxHp < 0.4) {
      return { kind: "hero", action: "skill", target: hurt.slot, power };
    }
    return attack;
  }
  if (hero.cls === "mage") {
    return monsters.length >= 2 || reachable.length === 0
      ? { kind: "hero", action: "skill", power }
      : attack;
  }
  if (hero.cls === "ranger") {
    return monsters.length >= 2 || monsters.some((m) => m.flying)
      ? { kind: "hero", action: "skill", power }
      : attack;
  }
  if (hero.cls === "sorcerer") {
    return monsters.length >= 2 || reachable.length === 0
      ? { kind: "hero", action: "skill", power }
      : attack;
  }
  if (hero.cls === "monk") return { ...attack, action: "skill" };
  if (hero.cls === "ninja") {
    const ghost = monsters.find(
      (m) => untouchable(m) || (m.kind === "imp" && m.stolen > 0),
    );
    return ghost !== undefined
      ? { kind: "hero", action: "skill", target: ghost.index, power }
      : rng() < 0.5
        ? { ...attack, action: "skill" }
        : attack;
  }
  if (hero.cls === "bard") {
    const friend = alive(s.heroes).find(
      (h) => h.slot !== hero.slot && !h.blessed,
    );
    return friend !== undefined
      ? { kind: "hero", action: "skill", target: friend.slot, power }
      : attack;
  }
  if (hero.cls === "berserker" || hero.cls === "druid") {
    return monsters.length >= 2 || reachable.length === 0
      ? { kind: "hero", action: "skill", power }
      : attack;
  }
  if (hero.cls === "hunter") {
    const prey = [...monsters]
      .filter((m) => m.marked !== true)
      .sort((a, b) => b.hp - a.hp)[0];
    return prey !== undefined
      ? { kind: "hero", action: "skill", target: prey.index, power }
      : attack;
  }
  if (hero.cls === "shaman") {
    return hero.totem === 0 ? { kind: "hero", action: "skill", power } : attack;
  }
  if (hero.cls === "lancer") {
    const high = monsters.find((m) => m.flying || m.burrowed === true);
    return high !== undefined
      ? { kind: "hero", action: "skill", target: high.index, power }
      : rng() < 0.5
        ? { ...attack, action: "skill" }
        : attack;
  }
  if (hero.cls === "samurai") return { ...attack, action: "skill" };
  if (hero.cls === "engineer") {
    return monsters.length >= 2 || reachable.length === 0
      ? { kind: "hero", action: "skill", power }
      : attack;
  }
  if (hero.cls === "cleric") {
    const hurt = lowest(alive(s.heroes).filter((h) => h.ward === 0));
    return hurt !== undefined && hurt.hp / hurt.maxHp < 0.7
      ? { kind: "hero", action: "skill", target: hurt.slot, power }
      : attack;
  }
  if (hero.cls === "summoner") {
    return hero.familiar === 0
      ? { kind: "hero", action: "skill", power }
      : attack;
  }
  if (hero.cls === "paladin") {
    const hurt = lowest(alive(s.heroes));
    return hurt !== undefined && hurt.hp / hurt.maxHp < 0.6
      ? { ...attack, action: "skill" }
      : attack;
  }
  if (hero.cls === "rogue") {
    const sneaky = reachable.find(
      (m) => m.lastTargets !== undefined && !m.lastTargets.includes(hero.slot),
    );
    return sneaky !== undefined
      ? { ...attack, action: "skill", target: sneaky.index }
      : attack;
  }
  // knight
  return rng() < 0.45 ? { ...attack, action: "skill" } : attack;
}

const keyRng = (seed: number, key: number): (() => number) =>
  seededRandom(seed ^ Math.imul(key + 1, 0x9e3779b1));

/** `count` different words joined by spaces. */
function pickWords(rng: () => number, words: string[], count: number): string {
  const out: string[] = [];
  for (let tries = 0; out.length < count && tries < count * 10; tries++) {
    const w = words[Math.floor(rng() * words.length)] ?? "go";
    if (!out.includes(w) || tries >= count * 5) out.push(w);
  }
  return out.join(" ");
}

function heroMoveWords(
  seed: number,
  step: number,
  d: QuestDifficulty,
): Record<HeroAction, string> {
  const say = (words: string[], n: number, key: number): string =>
    pickWords(keyRng(seed, step * 8 + key), words, n);
  return {
    attack: say(d.words, d.phrase.attack, 1),
    skill: say(d.skillWords, d.phrase.skill, 2),
    defend: say(d.words, d.phrase.defend, 3),
    potion: say(d.words, d.phrase.potion, 4),
    ultimate: say(d.skillWords, d.phrase.ultimate, 6),
  };
}

function guardWord(
  seed: number,
  step: number,
  slot: number,
  d: QuestDifficulty,
): string {
  return pickWords(
    keyRng(seed, step * 8 + 5 + slot * 101),
    d.words,
    d.phrase.guard,
  );
}

/** Time to type the longest of these phrases: a base plus some per letter. */
export function typeTimeMs(
  words: Record<string, string>,
  base: number,
): number {
  const longest = Math.max(0, ...Object.values(words).map((w) => w.length));
  return base + longest * 230;
}

const scaled = (base: number, power: number, rng: () => number): number =>
  Math.max(1, Math.round(base * power * (0.9 + rng() * 0.2)));

/** Is a player's input needed for this hero right now? */
const needsPlayer = (h: HeroState): h is HeroState & { uid: string } =>
  h.uid !== null && !h.away;

function applyHero(
  s: QuestState,
  hero: HeroState,
  input: HeroInput,
  rng: () => number,
): void {
  const info = CLASS_INFO[hero.cls];
  if (hero.blessed) {
    hero.blessed = false;
    input = { ...input, power: Math.max(input.power, CRIT_POWER) };
  }
  if (s.twist === "lucky" && input.power >= 1) {
    input = { ...input, power: CRIT_POWER };
  }
  const crit = input.power >= CRIT_POWER;
  const stats = s.stats[hero.slot] as HeroStats;
  if (crit) stats.crits++;
  // team spirit: players' clean typing, anyone's criticals
  if (needsPlayer(hero)) {
    hero.streak =
      input.power >= 1 && input.timeout !== true ? hero.streak + 1 : 0;
  }
  const streakBoost = 1 + STREAK_STEP * Math.min(hero.streak, STREAK_MAX);
  const spiritRate = s.twist === "team" ? 2 : 1;
  if (needsPlayer(hero) && input.timeout !== true) {
    s.spirit += (crit ? 2 : input.power >= 1 ? 1 : 0) * spiritRate;
  } else if (crit) {
    s.spirit += spiritRate;
  }
  const prevSkill = s.lastSkill;
  s.lastSkill = input.action === "skill" ? hero.slot : undefined;
  const comboInfo =
    input.action === "skill" &&
    prevSkill !== undefined &&
    prevSkill !== hero.slot
      ? comboFor(s.heroes[prevSkill]?.cls ?? hero.cls, hero.cls)
      : undefined;
  const boost = comboInfo === undefined ? 1 : COMBO_BOOST;
  const combo =
    comboInfo === undefined
      ? {}
      : { combo: `${comboInfo.emoji} ${comboInfo.name}` };
  hero.defending = false;
  // vanishing lasts until the rogue's next turn
  hero.hidden = false;
  if (hero.taunt > 0) hero.taunt--;
  hero.counter = false;
  // a guardian's protection lasts until its next turn
  for (const h of s.heroes) {
    if (h.protectedBy === hero.slot) h.protectedBy = undefined;
  }
  /** beetles whose shell broke this move */
  const cracked: MonsterState[] = [];

  /**
   * melee: swords (miss flying / faded); arrow: reaches flying, bats can't
   * dodge; magic / fire: always reach. `aoe` = a hit-everyone move.
   */
  const hitMonster = (
    m: MonsterState,
    base: number,
    style: "melee" | "fire" | "magic" | "arrow" | "leap" = "melee",
    aoe = false,
  ): HitResult => {
    const id = monsterId(m.index);
    base *= (hero.level > 1 ? LEVEL_BOOST : 1) * s.strength * streakBoost;
    if (style === "fire") {
      base *= s.weather === "rain" ? 0.7 : s.weather === "sun" ? 1.2 : 1;
      if (s.twist === "fire") base *= 2;
    }
    // underground: only hit-everyone moves and jumps reach it
    if (m.burrowed === true) {
      if (!aoe && style !== "leap") return { id, amount: 0, miss: true };
    } else if (style === "melee" && untouchable(m)) {
      return { id, amount: 0, miss: true };
    }
    if ((style === "arrow" || style === "leap") && m.faded) {
      return { id, amount: 0, miss: true };
    }
    if (style === "melee" && m.kind === "scorpion") m.stung = true;
    if (
      style === "melee" &&
      m.kind === "bat" &&
      input.power < 1 &&
      rng() < 0.6
    ) {
      return { id, amount: 0, miss: true };
    }
    // hunter's mark: everyone hits harder; disguises and hide don't help
    if (m.marked === true) {
      base *= MARK_BOOST;
    } else if (m.kind === "croc" && !m.used) {
      base *= 0.5;
    } else if (m.kind === "boar" && !aoe) {
      base *= 0.75;
    }
    // a trickster fox dodges the first single hit after its turn
    if (m.kind === "fox" && m.dodge === true && !aoe) {
      m.dodge = false;
      return { id, amount: 0, miss: true };
    }
    // a shellback's shell halves single hits until a hit-everyone move
    if (m.kind === "beetle" && !m.used) {
      if (aoe) {
        m.used = true;
        cracked.push(m);
      } else {
        base *= 0.5;
      }
    }
    const weak =
      style === "fire" && (m.kind === "snowman" || m.kind === "treant");
    const amount = Math.min(
      m.hp,
      scaled(base * (weak ? 2 : 1), input.power, rng),
    );
    m.hp -= amount;
    stats.damage += amount;
    return {
      id,
      amount,
      crit,
      ko: m.hp <= 0,
      ...(weak ? { weak: true } : {}),
    };
  };
  const targetMonster = (): MonsterState | undefined => {
    const live = alive(s.monsters);
    return live.find((m) => m.index === input.target) ?? live[0];
  };
  const targetHero = (): HeroState =>
    s.heroes.find((h) => h.slot === input.target) ?? hero;
  /** sunshine makes heals stronger */
  const healBoost = s.weather === "sun" ? 1.3 : 1;
  /** a hit-everyone skill on the last monster standing hits harder */
  const focus = alive(s.monsters).length === 1 ? FOCUS_BOOST : 1;

  if (
    input.action === "ultimate" &&
    hero.ultimate !== undefined &&
    hero.ultimateCooldown === 0
  ) {
    hero.ultimateCooldown = ULTIMATE_COOLDOWN;
    const u = ULTIMATES[hero.ultimate];
    const actor = heroId(hero.slot);
    const live = alive(s.monsters);
    const m = targetMonster();
    let hits: HitResult[] = [];
    let shields: string[] | undefined;
    switch (hero.ultimate) {
      case "whirlwind":
        hits = live.map((x) => hitMonster(x, info.atk * 0.95, "melee", true));
        break;
      case "mighty":
        hits = m === undefined ? [] : [hitMonster(m, info.atk * 2.6)];
        break;
      case "icestorm":
        hits = live.map((x) => hitMonster(x, info.atk * 1.1, "magic", true));
        break;
      case "thunder":
        hits = m === undefined ? [] : [hitMonster(m, info.atk * 2.6, "magic")];
        break;
      case "holy":
        hits =
          m === undefined
            ? []
            : [hitMonster(m, info.atk * (UNDEAD.has(m.kind) ? 4 : 2), "magic")];
        break;
      case "slam":
        hits = live.map((x) => hitMonster(x, info.atk * 0.9, "melee", true));
        break;
      case "groupheal":
        hits = alive(s.heroes).map((h) => {
          const amount = Math.min(
            h.maxHp - h.hp,
            scaled(30 * healBoost, input.power, rng),
          );
          h.hp += amount;
          h.poison = 0;
          h.sleep = 0;
          stats.healed += amount;
          return { id: heroId(h.slot), amount, heal: true };
        });
        break;
      case "wall":
        shields = alive(s.heroes).map((h) => {
          h.defending = true;
          return heroId(h.slot);
        });
        break;
      case "judgement":
        hits =
          m === undefined
            ? []
            : [
                hitMonster(
                  m,
                  info.atk * (UNDEAD.has(m.kind) ? 4.4 : 2.4),
                  "magic",
                ),
              ];
        break;
      case "aura":
        hits = alive(s.heroes).map((h) => {
          h.defending = true;
          const amount = Math.min(
            h.maxHp - h.hp,
            scaled(18 * healBoost, input.power, rng),
          );
          h.hp += amount;
          stats.healed += amount;
          return { id: heroId(h.slot), amount, heal: true };
        });
        shields = alive(s.heroes).map((h) => heroId(h.slot));
        break;
      case "vanish":
        hero.hidden = true;
        hero.blessed = true;
        shields = [actor];
        break;
      case "startoss":
        hits = live.map((x) => hitMonster(x, info.atk * 0.95, "arrow", true));
        break;
      case "hawk":
        hits =
          m === undefined
            ? []
            : [hitMonster(m, info.atk * (m.flying ? 3.4 : 2.5), "arrow")];
        break;
      case "arrowrain":
        hits = live.map((x) => hitMonster(x, info.atk * 1.2, "arrow", true));
        break;
      case "phoenix": {
        hits = live.map((x) => hitMonster(x, info.atk * 1.05, "fire", true));
        const down = s.heroes.find((h) => h.hp <= 0);
        if (down !== undefined) {
          const amount = Math.round(down.maxHp * 0.3);
          down.hp = amount;
          down.poison = 0;
          down.sleep = 0;
          stats.healed += amount;
          hits.push({
            id: heroId(down.slot),
            amount,
            heal: true,
            revive: true,
          });
        }
        break;
      }
      case "titan":
        hits = m === undefined ? [] : [hitMonster(m, info.atk * 2.7, "magic")];
        break;
      case "thunderpalm":
        hits = m === undefined ? [] : [hitMonster(m, info.atk * 2.6, "magic")];
        break;
      case "innerpeace": {
        const amount = Math.min(
          hero.maxHp - hero.hp,
          Math.round(hero.maxHp * 0.4 * healBoost),
        );
        hero.hp += amount;
        hero.poison = 0;
        hero.sleep = 0;
        hero.defending = true;
        stats.healed += amount;
        hits = [{ id: actor, amount, heal: true }];
        shields = [actor];
        break;
      }
      case "smokebomb":
        s.smoke = live.length;
        shields = alive(s.heroes).map((h) => heroId(h.slot));
        break;
      case "shadowclone":
        if (m !== undefined) {
          hits = [hitMonster(m, info.atk * 1.4, "magic")];
          if (m.hp > 0) hits.push(hitMonster(m, info.atk * 1.4, "magic"));
        }
        break;
      case "meteor":
        hits = live.map((x) => hitMonster(x, info.atk * 1.25, "fire", true));
        break;
      case "stormcall":
        hits = m === undefined ? [] : [hitMonster(m, info.atk * 2.8, "magic")];
        break;
      case "anthem":
        hits = alive(s.heroes).map((h) => {
          h.blessed = true;
          const amount = Math.min(h.maxHp - h.hp, Math.round(10 * healBoost));
          h.hp += amount;
          stats.healed += amount;
          return { id: heroId(h.slot), amount, heal: true };
        });
        s.spirit += 4;
        break;
      case "lullaby":
        for (const x of live) {
          x.asleep = true;
          x.charging = false;
        }
        break;
      case "rampage":
        hits =
          m === undefined ? [] : [hitMonster(m, info.atk * 2.4 * rage(hero))];
        break;
      case "warcry":
        for (const x of live) x.atk = Math.round(x.atk * 0.85);
        break;
      case "bearform": {
        hero.taunt = 2;
        hero.defending = true;
        const amount = Math.min(
          hero.maxHp - hero.hp,
          Math.round(hero.maxHp * 0.25 * healBoost),
        );
        hero.hp += amount;
        stats.healed += amount;
        hits = [{ id: actor, amount, heal: true }];
        shields = [actor];
        break;
      }
      case "grove":
        hits = alive(s.heroes).map((h) => {
          const amount = Math.min(
            h.maxHp - h.hp,
            scaled(25 * healBoost, input.power, rng),
          );
          h.hp += amount;
          h.poison = 0;
          h.sleep = 0;
          stats.healed += amount;
          return { id: heroId(h.slot), amount, heal: true };
        });
        break;
      case "pindown":
        if (m !== undefined) {
          hits = [hitMonster(m, info.atk * 2.5, "arrow")];
          if (m.hp > 0) {
            m.asleep = true;
            m.charging = false;
          }
        }
        break;
      case "packhunt":
        hits = live.map((x) => hitMonster(x, info.atk * 0.95, "arrow", true));
        for (const x of live) if (x.hp > 0) x.marked = true;
        break;
      case "wolves":
        hits = live.map((x) => hitMonster(x, info.atk * 1.15, "magic", true));
        break;
      case "ancestors":
        hits = s.heroes.map((h) => {
          const revive = h.hp <= 0;
          const amount = revive
            ? Math.round(h.maxHp * 0.3)
            : Math.min(h.maxHp - h.hp, Math.round(15 * healBoost));
          h.hp += amount;
          if (revive) {
            h.poison = 0;
            h.sleep = 0;
          }
          stats.healed += amount;
          return { id: heroId(h.slot), amount, heal: true, revive };
        });
        break;
      case "cometdive":
        hits = m === undefined ? [] : [hitMonster(m, info.atk * 2.7, "leap")];
        break;
      case "spearsweep":
        hits = live.map((x) => hitMonster(x, info.atk * 0.95, "melee", true));
        break;
      case "petalstorm":
        hits = live.map((x) => hitMonster(x, info.atk * 1.0, "melee", true));
        break;
      case "moonslash":
        hits = m === undefined ? [] : [hitMonster(m, info.atk * 2.8)];
        break;
      case "turret":
        hero.familiar = SPIRIT_TURNS;
        shields = [actor];
        break;
      case "megabomb":
        hits = live.map((x) => hitMonster(x, info.atk * 1.3, "fire", true));
        break;
      case "sanctuary":
        shields = alive(s.heroes).map((h) => {
          h.ward = 15;
          return heroId(h.slot);
        });
        break;
      case "purify":
        hits = alive(s.heroes).map((h) => {
          const amount = Math.min(h.maxHp - h.hp, Math.round(20 * healBoost));
          h.hp += amount;
          h.poison = 0;
          h.sleep = 0;
          stats.healed += amount;
          return { id: heroId(h.slot), amount, heal: true };
        });
        for (const x of live) {
          x.faded = false;
          x.flying = false;
          x.burrowed = false;
          x.charging = false;
        }
        break;
    }
    s.events.push({
      type: "action",
      actor,
      move: u.name,
      emoji: u.emoji,
      ultimate: hero.ultimate,
      hits,
      ...(shields === undefined ? {} : { shields }),
    });
    return;
  }

  const action = input.action;
  if (action === "attack") {
    const m = targetMonster();
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: "Attack",
      emoji: "⚔️",
      hits: m === undefined ? [] : [hitMonster(m, info.atk)],
      ...(input.timeout === true ? { note: "too slow!" } : {}),
    });
    return;
  }
  if (action === "defend") {
    hero.defending = true;
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: "Defend",
      emoji: "🛡️",
      hits: [],
      shield: heroId(hero.slot),
    });
    return;
  }
  if (action === "potion") {
    const target = targetHero();
    if (s.potions <= 0 || target.hp <= 0) {
      s.events.push({
        type: "action",
        actor: heroId(hero.slot),
        move: "Potion",
        emoji: "🧪",
        hits: [],
        note: s.potions <= 0 ? "no potions left!" : "it didn't work",
      });
      return;
    }
    s.potions--;
    const amount = Math.min(
      target.maxHp - target.hp,
      Math.round(POTION_HEAL * healBoost),
    );
    target.hp += amount;
    target.poison = 0;
    stats.healed += amount;
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: "Potion",
      emoji: "🧪",
      hits: [{ id: heroId(target.slot), amount, heal: true }],
    });
    return;
  }
  // skills
  if (hero.cls === "paladin") {
    const m = targetMonster();
    const hits = m === undefined ? [] : [hitMonster(m, info.atk * 1.5 * boost)];
    // some of the damage heals the weakest friend still standing
    const dealt = hits[0]?.amount ?? 0;
    const friend = lowest(alive(s.heroes));
    if (friend !== undefined && dealt > 0) {
      const amount = Math.min(
        friend.maxHp - friend.hp,
        Math.round(dealt * 0.35 * healBoost),
      );
      if (amount > 0) {
        friend.hp += amount;
        stats.healed += amount;
        hits.push({ id: heroId(friend.slot), amount, heal: true });
      }
    }
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits,
      ...combo,
    });
    return;
  }
  if (hero.cls === "rogue") {
    const m = targetMonster();
    // it just went for someone else: double damage
    const sneaky =
      m?.lastTargets !== undefined && !m.lastTargets.includes(hero.slot);
    s.gold += 3;
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits:
        m === undefined
          ? []
          : [hitMonster(m, info.atk * (sneaky ? 2.5 : 1.4) * boost)],
      note: sneaky ? "sneaky! +3 gold" : "+3 gold",
      ...combo,
    });
    return;
  }
  if (hero.cls === "ranger") {
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: alive(s.monsters).map((m) =>
        hitMonster(m, info.atk * 1.15 * focus * boost, "arrow", true),
      ),
      ...combo,
    });
    return;
  }
  if (hero.cls === "monk") {
    const m = targetMonster();
    const hits: HitResult[] = [];
    if (m !== undefined) {
      hits.push(hitMonster(m, info.atk * 0.85 * boost));
      if (m.hp > 0) hits.push(hitMonster(m, info.atk * 0.85 * boost));
    }
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits,
      ...combo,
    });
    return;
  }
  if (hero.cls === "ninja") {
    const m = targetMonster();
    let note: string | undefined;
    if (m !== undefined && m.kind === "imp" && m.stolen > 0) {
      s.potions += m.stolen;
      m.stolen = 0;
      note = "grabbed the potions back!";
    }
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits:
        m === undefined ? [] : [hitMonster(m, info.atk * 1.3 * boost, "magic")],
      ...(note === undefined ? {} : { note }),
      ...combo,
    });
    return;
  }
  if (hero.cls === "sorcerer") {
    // starts on the chosen monster, a bit weaker on each bounce
    const first = targetMonster();
    const order = alive(s.monsters).sort(
      (a, b) => Number(b === first) - Number(a === first),
    );
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: order.map((m, i) =>
        hitMonster(
          m,
          info.atk * 1.35 * 0.8 ** i * focus * boost,
          "magic",
          true,
        ),
      ),
      ...combo,
    });
    return;
  }
  if (hero.cls === "bard") {
    const target = targetHero();
    const hits: HitResult[] = [];
    if (target.hp > 0) {
      target.blessed = true;
      const amount = Math.min(
        target.maxHp - target.hp,
        Math.round(8 * healBoost * boost),
      );
      target.hp += amount;
      stats.healed += amount;
      if (amount > 0) {
        hits.push({ id: heroId(target.slot), amount, heal: true });
      }
    }
    s.spirit += 2;
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits,
      note: `${target.slot === hero.slot ? "your" : `${target.name}'s`} next move is a critical!`,
      ...combo,
    });
    return;
  }
  if (hero.cls === "berserker") {
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: alive(s.monsters).map((m) =>
        hitMonster(
          m,
          info.atk * 0.7 * rage(hero) * focus * boost,
          "melee",
          true,
        ),
      ),
      ...combo,
    });
    return;
  }
  if (hero.cls === "druid") {
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: alive(s.monsters).map((m) =>
        hitMonster(m, info.atk * 0.95 * focus * boost, "magic", true),
      ),
      ...combo,
    });
    return;
  }
  if (hero.cls === "hunter") {
    const m = targetMonster();
    const hits =
      m === undefined ? [] : [hitMonster(m, info.atk * 1.0 * boost, "arrow")];
    if (m !== undefined && m.hp > 0) m.marked = true;
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits,
      ...(m !== undefined && m.hp > 0 ? { note: `${m.name} is marked!` } : {}),
      ...combo,
    });
    return;
  }
  if (hero.cls === "shaman") {
    hero.totem = TOTEM_TURNS;
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: [],
      note: `heals the team for ${TOTEM_TURNS} turns`,
      ...combo,
    });
    return;
  }
  if (hero.cls === "lancer") {
    const m = targetMonster();
    hero.hidden = true;
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits:
        m === undefined ? [] : [hitMonster(m, info.atk * 1.4 * boost, "leap")],
      note: "leaps out of reach!",
      ...combo,
    });
    return;
  }
  if (hero.cls === "samurai") {
    const m = targetMonster();
    hero.counter = true;
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits:
        m === undefined
          ? []
          : [hitMonster(m, info.atk * 1.2 * (crit ? 1.6 : 1) * boost)],
      note: crit ? "lightning fast!" : "ready to strike back",
      ...combo,
    });
    return;
  }
  if (hero.cls === "engineer") {
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: alive(s.monsters).map((m) =>
        hitMonster(m, info.atk * 1.15 * focus * boost, "fire", true),
      ),
      ...combo,
    });
    return;
  }
  if (hero.cls === "cleric") {
    const target = targetHero();
    if (target.hp > 0) target.ward = Math.round(WARD * boost);
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: [],
      shield: heroId(target.hp > 0 ? target.slot : hero.slot),
      note: `a glowing shield on ${target.slot === hero.slot ? "yourself" : target.name}`,
      ...combo,
    });
    return;
  }
  if (hero.cls === "summoner") {
    hero.familiar = SPIRIT_TURNS;
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: [],
      note: `a spirit friend joins for ${SPIRIT_TURNS} turns`,
      ...combo,
    });
    return;
  }
  if (hero.cls === "knight") {
    const m = targetMonster();
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: m === undefined ? [] : [hitMonster(m, info.atk * 1.7 * boost)],
      ...combo,
    });
  } else if (hero.cls === "mage") {
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: alive(s.monsters).map((m) =>
        hitMonster(m, info.atk * 1.05 * boost, "fire", true),
      ),
      ...combo,
    });
  } else if (hero.cls === "healer") {
    const target = targetHero();
    const revive = target.hp <= 0;
    const want = revive ? 35 : 45;
    const amount = Math.min(
      target.maxHp - target.hp,
      scaled(want * healBoost * boost, input.power, rng),
    );
    target.hp += amount;
    stats.healed += amount;
    target.poison = 0;
    target.sleep = 0;
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: revive ? "Wake Up" : info.skill,
      emoji: revive ? "✨" : info.skillEmoji,
      hits: [{ id: heroId(target.slot), amount, heal: true, revive }],
      ...combo,
    });
  } else {
    const target = targetHero();
    if (target.slot !== hero.slot && target.hp > 0) {
      target.protectedBy = hero.slot;
    }
    // combo: the protected friend also heals a little
    const comboHeal: HitResult[] = [];
    if (comboInfo !== undefined && target.hp > 0) {
      const amount = Math.min(target.maxHp - target.hp, 20);
      target.hp += amount;
      stats.healed += amount;
      if (amount > 0) {
        comboHeal.push({ id: heroId(target.slot), amount, heal: true });
      }
    }
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: comboHeal,
      ...combo,
      shield: heroId(target.hp > 0 ? target.slot : hero.slot),
      note: `protects ${target.slot === hero.slot ? "the team" : target.name}`,
    });
  }
}

/** Berserker: up to 1.6x damage as their HP drops. */
const rage = (h: HeroState): number => 1 + 0.6 * (1 - h.hp / h.maxHp);

/** The shaman's totem heals the team after the shaman's move. */
function totemPulse(s: QuestState, hero: HeroState): void {
  if (hero.totem <= 0 || hero.hp <= 0) return;
  hero.totem--;
  const healBoost = s.weather === "sun" ? 1.3 : 1;
  const hits: HitResult[] = [];
  for (const h of alive(s.heroes)) {
    const amount = Math.min(h.maxHp - h.hp, Math.round(6 * healBoost));
    if (amount <= 0) continue;
    h.hp += amount;
    (s.stats[hero.slot] as HeroStats).healed += amount;
    hits.push({ id: heroId(h.slot), amount, heal: true });
  }
  s.events.push({
    type: "action",
    actor: heroId(hero.slot),
    move: "Totem Pulse",
    emoji: "🪶",
    hits,
    note:
      hero.totem > 0
        ? `${hero.totem} more turn${hero.totem === 1 ? "" : "s"}`
        : "the totem fades",
  });
}

/** The summoner's spirit friend attacks after the summoner's move. */
function spiritPounce(s: QuestState, hero: HeroState, rng: () => number): void {
  if (hero.familiar <= 0) return;
  const live = alive(s.monsters);
  const m = lowest(live);
  if (m === undefined) return;
  hero.familiar--;
  const turret = hero.cls === "engineer";
  const base =
    CLASS_INFO[hero.cls].atk *
    1.1 *
    (hero.level > 1 ? LEVEL_BOOST : 1) *
    s.strength;
  const amount = Math.min(m.hp, scaled(base, 1, rng));
  m.hp -= amount;
  (s.stats[hero.slot] as HeroStats).damage += amount;
  s.events.push({
    type: "action",
    actor: heroId(hero.slot),
    move: turret ? "Turret Shot" : "Spirit Pounce",
    emoji: turret ? "⚙️" : "🌟",
    hits: [{ id: monsterId(m.index), amount, ko: m.hp <= 0 }],
    note:
      hero.familiar > 0
        ? `${hero.familiar} more turn${hero.familiar === 1 ? "" : "s"}`
        : turret
          ? "the turret runs out"
          : "the spirit says goodbye",
  });
}

/** Shellbacks whose shell just cracked (from a hit-everyone move). */
function shellStatus(s: QuestState, before: Set<number>): void {
  for (const m of s.monsters) {
    if (m.kind === "beetle" && m.used && before.has(m.index)) {
      s.events.push({
        type: "status",
        id: monsterId(m.index),
        what: "shellCracked",
        hits: [],
      });
    }
  }
}

const intactShells = (s: QuestState): Set<number> =>
  new Set(
    s.monsters
      .filter((m) => m.kind === "beetle" && !m.used)
      .map((m) => m.index),
  );

function damageHero(
  s: QuestState,
  target: HeroState,
  raw: number,
  guarded: boolean,
): HitResult[] {
  let amount = raw;
  if (guarded) amount *= GUARD_SHARE;
  if (target.defending) amount *= 0.5;
  amount = Math.max(1, Math.round(amount));
  const hits: HitResult[] = [];
  // a guardian takes the hit for a protected friend, at half strength
  const guardian =
    target.protectedBy === undefined
      ? undefined
      : s.heroes.find((h) => h.slot === target.protectedBy && h.hp > 0);
  const victim = guardian ?? target;
  if (guardian !== undefined) amount = Math.max(1, Math.round(amount * 0.5));
  // cleric's glowing shield soaks it up first
  if (victim.ward > 0) {
    const soaked = Math.min(victim.ward, amount);
    victim.ward -= soaked;
    amount -= soaked;
  }
  amount = Math.min(victim.hp, amount);
  victim.hp -= amount;
  if (guarded) (s.stats[target.slot] as HeroStats).guards++;
  hits.push({
    id: heroId(victim.slot),
    amount,
    guarded,
    ko: victim.hp <= 0,
  });
  if (victim.hp <= 0) {
    victim.defending = false;
    victim.protectedBy = undefined;
    for (const h of s.heroes) {
      if (h.protectedBy === victim.slot) h.protectedBy = undefined;
    }
  }
  return hits;
}

type MonsterPlan = {
  big: boolean;
  targets: HeroState[];
  move: string;
  emoji: string;
  base: number;
};

/** What the monster does and to whom (decided before anyone guards). */
function monsterPlan(
  s: QuestState,
  m: MonsterState,
  rng: () => number,
): MonsterPlan {
  // a vanished rogue can't be picked (unless nobody else is left)
  const standing = alive(s.heroes);
  const visible = standing.filter((h) => !h.hidden);
  const live = visible.length > 0 ? visible : standing;
  const pickOne = (): HeroState => {
    // a druid in bear form draws attacks
    const bear = live.find((h) => h.taunt > 0);
    if (bear !== undefined && rng() < 0.6) return bear;
    const guardian = live.find((h) => h.cls === "guardian");
    if (guardian !== undefined && rng() < 0.35) return guardian;
    return live[Math.floor(rng() * live.length)] as HeroState;
  };
  if (m.charging) {
    if (m.kind === "boar") {
      return {
        big: true,
        targets: live,
        move: "Wild Stampede",
        emoji: "🐗",
        base: m.atk * 0.75,
      };
    }
    return m.kind === "toad"
      ? {
          big: true,
          targets: live,
          move: "Thunder Croak",
          emoji: "⚡",
          base: m.atk * 0.6,
        }
      : {
          big: true,
          targets: live,
          move: "Mega Smash",
          emoji: "🪨",
          base: m.atk * 0.75,
        };
  }
  if (m.kind === "scorpion" && m.stung === true) {
    return {
      big: false,
      targets: [pickOne()],
      move: "Angry Sting",
      emoji: "🦂",
      base: m.atk * 1.5,
    };
  }
  if (m.kind === "kite" && m.turns % 3 === 0) {
    return {
      big: true,
      targets: live,
      move: "Thunderclap",
      emoji: "🌩️",
      base: m.atk * 0.6,
    };
  }
  if (m.flying && m.kind === "dragon") {
    return {
      big: false,
      targets: [pickOne()],
      move: "Sky Dive",
      emoji: "🔥",
      base: m.atk * 1.3,
    };
  }
  if (m.kind === "queen" && m.turns % 3 === 0) {
    return {
      big: false,
      targets: [pickOne()],
      move: "Freeze",
      emoji: "🧊",
      base: m.atk * 0.5,
    };
  }
  const bigTurn = m.boss && s.angry && rng() < 0.4;
  const [move, emoji] = (bigTurn ? BIG_MOVES : MONSTER_MOVES)[m.kind];
  if (bigTurn) {
    return { big: true, targets: live, move, emoji, base: m.atk * 0.7 };
  }
  if (m.kind === "wolf" && live.length > 1) {
    const first = pickOne();
    const rest = live.filter((h) => h !== first);
    const second = rest[Math.floor(rng() * rest.length)] as HeroState;
    return {
      big: false,
      targets: [first, second],
      move,
      emoji,
      base: m.atk * 0.65,
    };
  }
  return { big: false, targets: [pickOne()], move, emoji, base: m.atk };
}

/** Golem / dragon spend a turn getting ready. */
function setupTurn(m: MonsterState): [string, string] | null {
  // golem every 3rd turn; the smaller toad starts charging right away
  if (
    !m.charging &&
    (((m.kind === "golem" || m.kind === "boar") && m.turns % 3 === 0) ||
      (m.kind === "toad" && m.turns % 3 === 1))
  ) {
    m.charging = true;
    return ["Charge Up", "⚡"];
  }
  if (m.kind === "dragon" && !m.flying && m.turns % 3 === 0) {
    m.flying = true;
    return ["Fly Up", "🐉"];
  }
  return null;
}

const MONSTER_MOVES: Record<MonsterKind, [string, string]> = {
  slime: ["Slime Splash", "💧"],
  bat: ["Wing Flap", "🦇"],
  mushroom: ["Spore Puff", "🍄"],
  snake: ["Poison Bite", "🐍"],
  wolf: ["Double Bite", "🐺"],
  snowman: ["Snowball", "❄️"],
  ghost: ["Spooky Touch", "👻"],
  skeleton: ["Bone Toss", "🦴"],
  imp: ["Sneaky Swipe", "😈"],
  bolt: ["Zap", "⚡"],
  golem: ["Rock Smash", "🪨"],
  dragon: ["Fire Breath", "🔥"],
  treant: ["Vine Whip", "🌿"],
  queen: ["Ice Shard", "❄️"],
  robot: ["Laser Beam", "🔴"],
  beetle: ["Shell Bash", "🪲"],
  mimic: ["Chomp", "📦"],
  wisp: ["Wisp Flame", "🔥"],
  hollowking: ["Rusty Sword", "⚔️"],
  lantern: ["Spooky Glow", "🏮"],
  toad: ["Tongue Lash", "🐸"],
  fox: ["Fox Fire", "🦊"],
  kite: ["Gust Slash", "🪁"],
  wasp: ["Sting", "🐝"],
  croc: ["Snap", "🐊"],
  monkey: ["Banana Bonk", "🍌"],
  boar: ["Tusk Bash", "🐗"],
  scorpion: ["Pinch", "🦂"],
  tumbleweed: ["Roll Over", "🌾"],
  dustdevil: ["Dust Swirl", "🌪️"],
  rumbler: ["Drill Bash", "⛏️"],
};
const BIG_MOVES: Record<MonsterKind, [string, string]> = {
  slime: ["Mega Splash", "🌊"],
  bat: ["Screech", "📢"],
  mushroom: ["Spore Cloud", "☁️"],
  snake: ["Poison Bite", "🐍"],
  wolf: ["Howl", "🐺"],
  snowman: ["Snowstorm", "🌨️"],
  ghost: ["Spooky Touch", "👻"],
  skeleton: ["Bone Toss", "🦴"],
  imp: ["Sneaky Swipe", "😈"],
  bolt: ["Zap", "⚡"],
  golem: ["Earthquake", "🌋"],
  dragon: ["Inferno", "☄️"],
  treant: ["Root Quake", "🌳"],
  queen: ["Blizzard", "🌨️"],
  robot: ["Mega Laser", "💥"],
  beetle: ["Shell Bash", "🪲"],
  mimic: ["Chomp", "📦"],
  wisp: ["Wisp Flame", "🔥"],
  hollowking: ["Royal Roar", "👑"],
  lantern: ["Spooky Glow", "🏮"],
  toad: ["Tongue Lash", "🐸"],
  fox: ["Fox Fire", "🦊"],
  kite: ["Storm Dive", "🌩️"],
  wasp: ["Sting", "🐝"],
  croc: ["Snap", "🐊"],
  monkey: ["Banana Bonk", "🍌"],
  boar: ["Wild Stampede", "🐗"],
  scorpion: ["Pinch", "🦂"],
  tumbleweed: ["Roll Over", "🌾"],
  dustdevil: ["Dust Swirl", "🌪️"],
  rumbler: ["Canyon Quake", "🌋"],
};

/** Weather for a battle: often clear. */
export function battleWeather(seed: number, battle: number): Weather {
  const r = seededRandom(seed ^ Math.imul(battle + 3, 0x51ed270b))();
  return r < 0.4 ? "clear" : r < 0.6 ? "rain" : r < 0.8 ? "sun" : "wind";
}

/** The two stops between fights (never the same twice). */
export function journeyPlan(
  seed: number,
  shopSecond = false,
): [JourneyKind, JourneyKind] {
  const rng = seededRandom(seed ^ 0x2468ac);
  const kinds: JourneyKind[] = ["chest", "trap", "fairy", "shop"];
  const a = kinds[Math.floor(rng() * 3)] as JourneyKind;
  if (shopSecond) return [a, "shop"];
  // the shop comes second, when there's gold to spend
  const rest = kinds.filter((k) => k !== a);
  const b = rest[Math.floor(rng() * rest.length)] as JourneyKind;
  return [a, b];
}

function ultimateOptions(cls: HeroClass): VoteOption[] {
  return ULTIMATE_CHOICES[cls].map((id) => ({
    id,
    word: ULTIMATES[id].name.toLowerCase(),
    label: ULTIMATES[id].name,
    emoji: ULTIMATES[id].emoji,
    detail: ULTIMATES[id].blurb,
  }));
}

/** Run the quest from the start through every input given. */
export function runQuest(setup: QuestSetup, inputs: QuestInput[]): QuestState {
  const playerCount = setup.party.filter((h) => h.uid !== null).length;
  const d = setup.difficulty;
  const weekly = setup.weekly;
  const twist = weekly?.twist;
  const s: QuestState = {
    battle: 0,
    land: null,
    weather: "clear",
    gold: 0,
    strength: 1,
    spirit: 0,
    smoke: 0,
    heroes: setup.party.map((h) => ({
      ...h,
      hp: CLASS_INFO[h.cls].maxHp,
      maxHp: CLASS_INFO[h.cls].maxHp,
      defending: false,
      away: false,
      timeouts: 0,
      poison: 0,
      sleep: 0,
      level: 1,
      ultimateCooldown: 0,
      blessed: false,
      streak: 0,
      familiar: 0,
      hidden: false,
      taunt: 0,
      totem: 0,
      ward: 0,
      counter: false,
    })),
    monsters: [],
    potions: START_POTIONS,
    angry: false,
    over: false,
    won: false,
    events: [],
    pending: null,
    used: 0,
    inputStart: [],
    stats: Object.fromEntries(
      setup.party.map((h) => [
        h.slot,
        { damage: 0, healed: 0, guards: 0, crits: 0 },
      ]),
    ),
    upNext: [],
  };

  /** Everyone votes; null = still waiting for the votes. */
  const vote = (topic: VoteTopic, options: VoteOption[]): VoteOption | null => {
    const voters = s.heroes.filter(needsPlayer).map((h) => h.uid);
    let votes: Record<string, string> = {};
    if (voters.length > 0) {
      const given = inputs[s.used];
      if (given === undefined) {
        s.pending = { kind: "vote", n: s.used, topic, options, voters };
        s.upNext = [];
        return null;
      }
      s.used++;
      s.inputStart.push(s.events.length);
      votes = given.kind === "vote" ? (given.votes ?? {}) : {};
    }
    const rng = seededRandom(
      setup.seed ^ (topic === "land" ? 0x1a2b3c : 0x4d5e6f),
    );
    return tallyVotes(options, votes, voters, rng);
  };
  const startBattle = (kinds: MonsterKind[]): void => {
    s.monsters = makeMonsters(kinds, d);
    // battle 2 faces levelled-up heroes
    if (s.battle === 1) {
      for (const m of s.monsters) {
        m.maxHp = Math.round(m.maxHp * 1.2);
        m.hp = m.maxHp;
        m.atk = Math.round(m.atk * 1.08);
      }
    }
    if (twist === "giant") {
      for (const m of s.monsters) {
        m.maxHp = Math.round(m.maxHp * 1.3);
        m.hp = m.maxHp;
      }
    }
    s.weather = twist === "rain" ? "rain" : battleWeather(setup.seed, s.battle);
    s.smoke = 0;
    for (const h of s.heroes) h.ultimateCooldown = 0;
    s.events.push({
      type: "battle",
      battle: s.battle,
      land: s.land ?? "forest",
      weather: s.weather,
      monsters: cloneMonsters(s),
    });
  };

  /** Everyone types a phrase; null = still waiting. uid -> made it. */
  const challenge = (
    what: "chest" | "trap" | "team",
    step: number,
  ): Record<string, boolean> | null => {
    const players = s.heroes.filter(needsPlayer);
    if (players.length === 0) return {};
    const given = inputs[s.used];
    if (given === undefined) {
      const words: Record<string, string> = Object.fromEntries(
        players.map((h) => [
          h.uid,
          pickWords(
            keyRng(
              setup.seed,
              9000 + step * 10 + (what === "team" ? 0 : h.slot),
            ),
            d.words,
            what === "team" ? 3 : 2,
          ),
        ]),
      );
      s.pending = {
        kind: "challenge",
        n: s.used,
        what,
        words,
        ms: typeTimeMs(words, CHALLENGE_BASE_MS),
      };
      s.upNext = [];
      return null;
    }
    s.used++;
    s.inputStart.push(s.events.length);
    return given.kind === "guard" ? (given.guards ?? {}) : {};
  };

  /** One stop between fights. false = waiting for players. */
  const journeyStop = (what: JourneyKind, step: number): boolean => {
    const rng = seededRandom(setup.seed ^ Math.imul(step + 31, 0x7f4a7c15));
    if (s.events.at(-1)?.type !== "journey") {
      s.events.push({ type: "journey", what });
    }
    const made = (h: HeroState, got: Record<string, boolean>): boolean =>
      needsPlayer(h) ? got[h.uid] === true : rng() < 0.6;
    if (what === "chest") {
      const got = challenge("chest", step);
      if (got === null) return false;
      const openers = s.heroes.filter((h) => made(h, got));
      if (openers.length > 0) {
        s.potions++;
        s.gold += 10;
      }
      s.events.push({
        type: "outcome",
        what: openers.length > 0 ? "chestOpen" : "chestStuck",
        hits: [],
        ids: openers.map((h) => heroId(h.slot)),
      });
    } else if (what === "trap") {
      const got = challenge("trap", step);
      if (got === null) return false;
      const hits: HitResult[] = [];
      for (const h of s.heroes) {
        if (made(h, got)) continue;
        const amount = Math.min(h.hp - 1, Math.round(h.maxHp * 0.15));
        if (amount <= 0) continue;
        h.hp -= amount;
        hits.push({ id: heroId(h.slot), amount });
      }
      s.events.push({
        type: "outcome",
        what: hits.length === 0 ? "trapDodged" : "trapHit",
        hits,
        ids: hits.map((x) => x.id),
      });
    } else if (what === "fairy") {
      for (const h of s.heroes) h.blessed = true;
      s.events.push({
        type: "outcome",
        what: "fairy",
        hits: [],
        ids: s.heroes.map((h) => heroId(h.slot)),
      });
    } else {
      const options = Object.entries(SHOP_ITEMS)
        .filter(([, item]) => item.price <= s.gold)
        .map(([id, item]) => ({
          id,
          word: item.label.split(" ").at(-1)?.toLowerCase() ?? id,
          label: item.label,
          emoji: item.emoji,
          detail:
            item.price > 0
              ? `${item.detail} · ${item.price} gold`
              : item.detail,
        }));
      const choice = options.length > 1 ? vote("shop", options) : options[0];
      if (choice === null) return false;
      const id = choice?.id ?? "save";
      const item = SHOP_ITEMS[id];
      s.gold -= item?.price ?? 0;
      const hits: HitResult[] = [];
      if (id === "potion") s.potions++;
      if (id === "charm") s.strength = 1.2;
      if (id === "feast") {
        for (const h of alive(s.heroes)) {
          const amount = Math.min(h.maxHp - h.hp, Math.round(h.maxHp * 0.4));
          h.hp += amount;
          if (amount > 0) hits.push({ id: heroId(h.slot), amount, heal: true });
        }
      }
      s.events.push({
        type: "outcome",
        what: id as OutcomeKind,
        hits,
        ids: [],
      });
    }
    return true;
  };

  /** Heroes level up; each player picks a super move. false = waiting. */
  const levelUp = (): boolean => {
    const players = s.heroes.filter(needsPlayer);
    let picks: Record<string, string> = {};
    if (players.length > 0) {
      const given = inputs[s.used];
      if (given === undefined) {
        s.pending = {
          kind: "pick",
          n: s.used,
          voters: players.map((h) => h.uid),
          options: Object.fromEntries(
            players.map((h) => [h.uid, ultimateOptions(h.cls)]),
          ),
        };
        s.upNext = [];
        return false;
      }
      s.used++;
      s.inputStart.push(s.events.length);
      picks = given.kind === "vote" ? (given.votes ?? {}) : {};
    }
    const rng = seededRandom(setup.seed ^ 0x13579b);
    const chosen: Record<number, UltimateId> = {};
    for (const h of s.heroes) {
      const choices = ULTIMATE_CHOICES[h.cls];
      const want = h.uid === null ? undefined : picks[h.uid];
      const pick =
        want !== undefined && (choices as string[]).includes(want)
          ? (want as UltimateId)
          : (choices[Math.floor(rng() * choices.length)] as UltimateId);
      h.ultimate = pick;
      h.level = 2;
      const extra = Math.round(h.maxHp * (LEVEL_BOOST - 1));
      h.maxHp += extra;
      h.hp = Math.min(h.maxHp, h.hp + extra);
      chosen[h.slot] = pick;
    }
    s.events.push({
      type: "levelup",
      picks: chosen,
      hp: s.heroes.map((h) => h.hp),
      maxHp: s.heroes.map((h) => h.maxHp),
    });
    return true;
  };
  const [stopA, stopB] = journeyPlan(setup.seed, twist === "gold");

  if (twist !== undefined) s.twist = twist;
  if (twist === "giant") s.potions += 2;
  if (twist === "gold") s.gold += 25;
  const landChoice =
    weekly === undefined
      ? vote("land", landOptions())
      : (landOptions().find((o) => o.id === weekly.land) ?? null);
  if (landChoice === null) return s;
  const land = landChoice.id as LandId;
  s.land = land;
  s.events.push({ type: "path", topic: "land", choice: landChoice, land });
  startBattle(battleKinds(setup.seed, land, 0));

  /** monsters reacting to being hit */
  const reactions = (): void => {
    for (const m of [...s.monsters]) {
      if (m.kind === "skeleton" && m.hp <= 0 && !m.used) {
        m.used = true;
        m.hp = Math.round(m.maxHp * 0.4);
        s.events.push({
          type: "status",
          id: monsterId(m.index),
          what: "rebuild",
          hits: [
            { id: monsterId(m.index), amount: m.hp, heal: true, revive: true },
          ],
        });
      } else if (
        m.kind === "slime" &&
        !m.used &&
        m.hp > 0 &&
        m.hp <= m.maxHp / 2
      ) {
        m.used = true;
        spawnMonster(s, "slime", d, {
          name: "Mini Slime",
          share: 0.35,
          mini: true,
        });
      } else if (m.kind === "mimic" && m.hp <= 0 && !m.used) {
        m.used = true;
        s.gold += MIMIC_GOLD;
        s.events.push({
          type: "status",
          id: monsterId(m.index),
          what: "mimicGold",
          hits: [],
        });
      } else if (m.kind === "monkey" && m.hp <= 0 && m.stolen > 0) {
        s.gold += m.stolen;
        m.stolen = 0;
        s.events.push({
          type: "status",
          id: monsterId(m.index),
          what: "goldBack",
          hits: [],
        });
      } else if (m.kind === "imp" && m.hp <= 0 && m.stolen > 0) {
        s.potions += m.stolen;
        m.stolen = 0;
        s.events.push({
          type: "status",
          id: monsterId(m.index),
          what: "potionsBack",
          hits: [],
        });
      }
    }
  };

  let queue: string[] = [];
  let step = 0;
  while (!s.over && step < MAX_STEPS) {
    if (queue.length === 0) queue = roundOrder(s);
    const id = queue[0] as string;
    const rng = seededRandom(setup.seed ^ Math.imul(step + 7, 0x85ebca6b));

    if (id.startsWith("h")) {
      const hero = s.heroes[Number(id.slice(1))] as HeroState;
      if (hero.hp <= 0) {
        queue.shift();
        continue;
      }
      if (hero.poison > 0) {
        hero.poison--;
        const amount = Math.min(hero.hp - 1, POISON_DMG);
        if (amount > 0) {
          hero.hp -= amount;
          s.events.push({
            type: "status",
            id,
            what: "poison",
            hits: [{ id, amount }],
          });
        }
      }
      if (hero.ultimateCooldown > 0) hero.ultimateCooldown--;
      if (hero.sleep > 0) {
        hero.sleep--;
        s.events.push({
          type: "status",
          id,
          what: hero.sleepWhy ?? "asleep",
          hits: [],
        });
        queue.shift();
        step++;
        continue;
      }
      let input: HeroInput;
      if (hero.uid !== null) {
        // players always get their turn - even after a helper took over, so
        // a slow device or a quick break never locks them out for good
        const given = inputs[s.used];
        if (given === undefined) {
          s.pending = {
            kind: "hero",
            n: s.used,
            slot: hero.slot,
            uid: hero.uid,
            words: heroMoveWords(setup.seed, step, d),
            ...(hero.away ? { away: true } : {}),
          };
          s.upNext = queue;
          return s;
        }
        s.used++;
        s.inputStart.push(s.events.length);
        input =
          given.kind === "hero"
            ? given
            : { kind: "hero", action: "attack", power: TIMEOUT_POWER };
        if (input.timeout === true) {
          hero.timeouts++;
          if (hero.timeouts >= AWAY_AFTER && playerCount > 1) hero.away = true;
          // away: the helper picks a proper move instead of a weak swing
          if (hero.away) input = cpuChoice(s, hero, rng);
        } else {
          hero.timeouts = 0;
          hero.away = false;
        }
      } else {
        input = cpuChoice(s, hero, rng);
      }
      const shells = intactShells(s);
      applyHero(s, hero, input, rng);
      shellStatus(s, shells);
      spiritPounce(s, hero, rng);
      totemPulse(s, hero);
      reactions();
    } else {
      const m = s.monsters[Number(id.slice(1))] as MonsterState;
      if (m.hp <= 0) {
        queue.shift();
        continue;
      }
      s.lastSkill = undefined;
      // bard's Lullaby: sleeps through this turn
      if (m.asleep === true) {
        m.asleep = false;
        s.events.push({ type: "status", id, what: "monsterAsleep", hits: [] });
        queue.shift();
        step++;
        continue;
      }
      m.turns++;
      if (m.kind === "tumbleweed" && !m.used && alive(s.monsters).length < 4) {
        m.used = true;
        spawnMonster(s, "tumbleweed", d, {
          name: "Mini Tumbleweed",
          share: 0.5,
          mini: true,
        });
      }
      if (m.kind === "treant" && s.angry && m.hp < m.maxHp) {
        const amount = Math.min(m.maxHp - m.hp, Math.round(m.maxHp * 0.025));
        m.hp += amount;
        s.events.push({
          type: "status",
          id,
          what: "regrow",
          hits: [{ id, amount, heal: true }],
        });
      }
      const getReady = setupTurn(m);
      if (getReady !== null) {
        s.events.push({
          type: "action",
          actor: id,
          move: getReady[0],
          emoji: getReady[1],
          hits: [],
          flags: flagsOf(m),
        });
        queue.shift();
        step++;
        continue;
      }
      const plan = monsterPlan(s, m, rng);
      const players = plan.targets.filter(needsPlayer);
      let guards: Record<string, boolean> = {};
      if (players.length > 0) {
        const given = inputs[s.used];
        if (given === undefined) {
          const words: Record<string, string> = Object.fromEntries(
            players.map((h) => [h.uid, guardWord(setup.seed, step, h.slot, d)]),
          );
          s.pending = {
            kind: "guard",
            n: s.used,
            monster: m.index,
            big: plan.big,
            words,
            ms: typeTimeMs(words, GUARD_BASE_MS),
          };
          s.upNext = queue;
          return s;
        }
        s.used++;
        s.inputStart.push(s.events.length);
        guards = given.kind === "guard" ? (given.guards ?? {}) : {};
        s.spirit += Object.values(guards).filter((g) => g).length;
      }
      const notes: string[] = [];
      // ninja's Smoke Bomb: this attack is lost in the smoke
      const smoky = s.smoke > 0;
      if (smoky) {
        s.smoke--;
        notes.push("lost in the smoke!");
      }
      const hits = plan.targets.flatMap((t) => {
        if (smoky) return [{ id: heroId(t.slot), amount: 0, miss: true }];
        const guarded = needsPlayer(t)
          ? guards[t.uid] === true
          : rng() < CPU_GUARD_CHANCE;
        if (s.weather === "wind" && !plan.big && rng() < 0.15) {
          return [{ id: heroId(t.slot), amount: 0, miss: true }];
        }
        const res = damageHero(s, t, scaled(plan.base, 1, rng), guarded);
        // tricks only land on an unguarded hit
        const victim = s.heroes[Number(res[0]?.id.slice(1) ?? -1)];
        if (!guarded && victim !== undefined && victim.hp > 0) {
          if (m.kind === "snake" || m.kind === "wasp") {
            victim.poison = 2;
            notes.push("poisoned!");
          } else if (m.kind === "mushroom" && rng() < 0.28) {
            victim.sleep = 1;
            victim.sleepWhy = "asleep";
            notes.push("fell asleep!");
          } else if (plan.move === "Freeze") {
            victim.sleep = 1;
            victim.sleepWhy = "frozen";
            notes.push("frozen solid!");
          } else if (m.kind === "dustdevil" && s.potions > 0) {
            s.potions--;
            notes.push("blew away a potion!");
          } else if (m.kind === "monkey" && s.gold > 0) {
            const g = Math.min(5, s.gold);
            s.gold -= g;
            m.stolen += g;
            notes.push("stole gold!");
          } else if (m.kind === "imp" && s.potions > 0) {
            s.potions--;
            m.stolen++;
            notes.push("stole a potion!");
          }
        }
        return res;
      });
      // a samurai who just used Iaido Slash strikes back
      for (const t of plan.targets) {
        if (!t.counter || t.hp <= 0 || m.hp <= 0) continue;
        t.counter = false;
        const amount = Math.min(
          m.hp,
          scaled(
            CLASS_INFO[t.cls].atk * 0.9 * (t.level > 1 ? LEVEL_BOOST : 1),
            1,
            rng,
          ),
        );
        m.hp -= amount;
        (s.stats[t.slot] as HeroStats).damage += amount;
        hits.push({ id, amount, ko: m.hp <= 0 });
        notes.push("counter strike!");
      }
      const wasFlying = m.flying;
      m.charging = false;
      m.flying = false;
      m.lastTargets = plan.targets.map((t) => t.slot);
      if (m.kind === "ghost" || m.kind === "lantern") {
        m.faded = !m.faded;
        if (m.faded) notes.push("faded away!");
      }
      if (m.kind === "fox") m.dodge = true;
      // the log was a croc all along
      if (m.kind === "croc" && !m.used) {
        m.used = true;
        notes.push("it was a croc!");
      }
      // the wisp and the kite float up every other turn
      m.stung = false;
      // the rumbler digs down every other turn
      if (m.kind === "rumbler") {
        m.burrowed = m.burrowed !== true;
        if (m.burrowed) notes.push("digs underground!");
      }
      if (m.kind === "wisp" || m.kind === "kite") {
        m.flying = !wasFlying;
        if (m.flying) notes.push("floats up high!");
      }
      s.events.push({
        type: "action",
        actor: id,
        move: plan.move,
        emoji: plan.emoji,
        hits,
        flags: flagsOf(m),
        ...(notes.length > 0 ? { note: [...new Set(notes)].join(" ") } : {}),
      });
    }
    queue.shift();
    step++;

    // a full Team Spirit bar: everyone types together
    if (s.spirit >= SPIRIT_MAX && alive(s.monsters).length > 0) {
      const got = challenge("team", step);
      if (got === null) return s;
      const typed: string[] = [];
      const rngT = seededRandom(setup.seed ^ Math.imul(step + 77, 0x2c1b3c6d));
      let power = 0;
      for (const h of alive(s.heroes)) {
        if (needsPlayer(h)) {
          if (got[h.uid] === true) {
            typed.push(heroId(h.slot));
            power += 18;
          } else {
            power += 5;
          }
        } else {
          power += 10;
        }
      }
      const shells = intactShells(s);
      const hits = alive(s.monsters).map((m) => {
        if (m.kind === "beetle") m.used = true;
        const amount = Math.min(
          m.hp,
          Math.round(power * (0.9 + rngT() * 0.2) * s.strength),
        );
        m.hp -= amount;
        return {
          id: monsterId(m.index),
          amount,
          crit: true,
          ko: m.hp <= 0,
        };
      });
      for (const h of s.heroes) {
        if (typed.includes(heroId(h.slot))) {
          const st = s.stats[h.slot] as HeroStats;
          st.damage += Math.round(
            hits.reduce((n, x) => n + x.amount, 0) / Math.max(1, typed.length),
          );
        }
      }
      s.spirit = 0;
      s.lastSkill = undefined;
      s.events.push({ type: "team", hits, ids: typed });
      shellStatus(s, shells);
      reactions();
    }

    // the boss gets angry at half health
    const boss = s.monsters.find((x) => x.boss && x.hp > 0);
    if (boss !== undefined && !s.angry && boss.hp <= boss.maxHp / 2) {
      s.angry = true;
      boss.atk = Math.round(boss.atk * 1.25);
      s.events.push({ type: "angry", actor: monsterId(boss.index) });
      if (boss.kind === "robot") {
        spawnMonster(s, "bolt", d, { name: "Bolt Bot A", share: 0.8 });
        spawnMonster(s, "bolt", d, { name: "Bolt Bot B", share: 0.8 });
      }
      if (boss.kind === "hollowking") {
        spawnMonster(s, "beetle", d, { name: "Shellback A", share: 0.6 });
        spawnMonster(s, "beetle", d, { name: "Shellback B", share: 0.6 });
      }
    }

    if (alive(s.heroes).length === 0) {
      s.over = true;
      s.events.push({ type: "end", won: false });
    } else if (alive(s.monsters).length === 0) {
      if (s.battle + 1 >= BATTLE_COUNT) {
        s.over = true;
        s.won = true;
        s.events.push({ type: "end", won: true });
      } else {
        // gold for the monsters beaten
        s.gold += s.monsters.reduce(
          (g, m) =>
            g + (m.boss ? 0 : m.mini === true || m.kind === "bolt" ? 2 : 5),
          0,
        );
        // short rest, then the next battle
        s.battle++;
        for (const h of s.heroes) {
          h.hp = Math.min(
            h.maxHp,
            Math.max(h.hp, 0) + Math.round(h.maxHp * REST_HEAL),
          );
          h.defending = false;
          h.protectedBy = undefined;
          h.poison = 0;
          h.sleep = 0;
          h.familiar = 0;
          h.hidden = false;
          h.taunt = 0;
          h.totem = 0;
          h.ward = 0;
          h.counter = false;
        }
        s.events.push({ type: "rest", hp: s.heroes.map((h) => h.hp) });
        if (s.battle === BATTLE_COUNT - 1) {
          if (!journeyStop(stopB, 2)) return s;
          const bossChoice =
            weekly === undefined
              ? vote("boss", bossOptions(land))
              : (bossOptions(land).find((o) => o.id === weekly.boss) ??
                bossOptions(land)[0] ??
                null);
          if (bossChoice === null) return s;
          s.events.push({
            type: "path",
            topic: "boss",
            choice: bossChoice,
            land,
          });
          startBattle([bossChoice.id as MonsterKind]);
        } else {
          if (!levelUp()) return s;
          if (!journeyStop(stopA, 1)) return s;
          startBattle(battleKinds(setup.seed, land, s.battle));
        }
        queue = [];
      }
    } else {
      queue = queue.filter((a) =>
        a.startsWith("h")
          ? (s.heroes[Number(a.slice(1))]?.hp ?? 0) > 0
          : (s.monsters[Number(a.slice(1))]?.hp ?? 0) > 0,
      );
    }
  }
  s.upNext = queue;
  return s;
}

function cloneMonsters(s: QuestState): MonsterState[] {
  return s.monsters.map((m) => ({ ...m }));
}

// ---------------------------------------------------------------- timing

/** How long the screen spends showing each event, ms. */
export function eventMs(e: QuestEvent): number {
  if (e.type === "battle") return 1800;
  if (e.type === "path") return 1800;
  if (e.type === "spawn") return 1100;
  if (e.type === "journey") return 1800;
  if (e.type === "team") return 2200;
  if (e.type === "outcome") return 1600;
  if (e.type === "levelup") return 2200;
  if (e.type === "status") return 1000;
  if (e.type === "rest") return 1600;
  if (e.type === "angry") return 1500;
  if (e.type === "end") return 0;
  if (e.ultimate !== undefined) return ULTIMATE_MS;
  return e.hits.length > 1 ? 1300 : 1100;
}

/** Time to make a move (typing the move name, a target and the words), ms. */
export const HERO_TURN_MS = 45_000;
/** An away player's turn: a short window to jump back in before the helper moves. */
export const AWAY_TURN_MS = 12_000;
const GUARD_BASE_MS = 3500;
const CHALLENGE_BASE_MS = 4000;
export const VOTE_MS = 20_000;
export const START_PAUSE_MS = 3000;

// ---------------------------------------------------------------- score

export const QUEST_SCORE = { win: 40, mvp: 15, guard: 4, crit: 2 };

export function questScore(input: {
  won: boolean;
  stats: HeroStats;
  battlesWon: number;
  mvp: boolean;
  /** words the player typed (moves, guards, choices) */
  words?: number;
}): number {
  return Math.round(
    (input.won ? QUEST_SCORE.win : 0) +
      input.battlesWon * 10 +
      input.stats.damage / 6 +
      input.stats.healed / 6 +
      input.stats.guards * QUEST_SCORE.guard +
      input.stats.crits * QUEST_SCORE.crit +
      (input.mvp ? QUEST_SCORE.mvp : 0) +
      Math.min(60, (input.words ?? 0) / 2),
  );
}

export function questStars(won: boolean, heroes: HeroState[]): number {
  if (!won) return 1;
  const standing = heroes.filter((h) => h.hp > 0).length;
  return standing === heroes.length ? 3 : 2;
}

export type QuestAward = {
  icon: string;
  title: string;
  names: string[];
  value: number;
};

/** Fun awards for the players (helpers don't get them). */
export function questAwards(
  heroes: HeroState[],
  stats: Record<number, HeroStats>,
): QuestAward[] {
  const players = heroes.filter((h) => h.uid !== null);
  if (players.length < 2) return [];
  const award = (
    icon: string,
    title: string,
    value: (st: HeroStats) => number,
  ): QuestAward | null => {
    const best = Math.max(
      ...players.map((h) => value(stats[h.slot] as HeroStats)),
    );
    if (best <= 0) return null;
    return {
      icon,
      title,
      value: best,
      names: players
        .filter((h) => value(stats[h.slot] as HeroStats) === best)
        .map((h) => h.name),
    };
  };
  return [
    award("🏆", "MVP (most damage)", (st) => st.damage),
    award("💖", "Best healer", (st) => st.healed),
    award("🛡️", "Perfect guard", (st) => st.guards),
    award("⭐", "Critical hits", (st) => st.crits),
  ].filter((a): a is QuestAward => a !== null);
}

/**
 * When the pending input times out: the previous input's time (or the start)
 * + time to show what happened since + the turn timer.
 */
export function pendingDeadline(
  s: QuestState,
  startAt: number,
  inputTimes: number[],
): number | null {
  const p = s.pending;
  if (p === null) return null;
  const from = p.n === 0 ? 0 : (s.inputStart[p.n - 1] ?? 0);
  const since = p.n === 0 ? startAt : (inputTimes[p.n - 1] ?? startAt);
  const anim = s.events.slice(from).reduce((ms, e) => ms + eventMs(e), 0);
  return (
    since +
    anim +
    (p.kind === "hero"
      ? p.away === true
        ? AWAY_TURN_MS
        : HERO_TURN_MS
      : p.kind === "vote" || p.kind === "pick"
        ? VOTE_MS
        : p.ms)
  );
}
