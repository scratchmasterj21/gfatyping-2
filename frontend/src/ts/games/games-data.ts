import { FunboxName } from "@monkeytype/schemas/configs";

import { FaSolidIcon } from "../types/font-awesome";

export type FunboxGame = {
  type: "funbox";
  id: FunboxName;
  name: string;
  description: string;
  icon: FaSolidIcon;
};

export type BuiltinGame = {
  type: "builtin";
  id:
    | "word-defender"
    | "balloon-pop"
    | "type-racer"
    | "ghost-hunter"
    | "fruit-ninja"
    | "type-toss"
    | "typing-rpg"
    | "tower-climb"
    | "snack-shop"
    | "echo-keys"
    | "word-pong"
    | "gem-dig"
    | "four-row"
    | "word-bomb"
    | "karuta"
    | "goldfish"
    | "shiritori"
    | "monster-raid";
  name: string;
  description: string;
  icon: FaSolidIcon;
  /** where the words come from: lesson word lists, easy/medium/hard, or kana */
  words: GameWordSource;
};

export type GameWordSource = "lessons" | "levels" | "romaji";

/** Game list sections, in display order. */
export const GAME_WORD_SOURCE_GROUPS: {
  id: GameWordSource;
  title: string;
  description: string;
  icon: FaSolidIcon;
}[] = [
  {
    id: "lessons",
    title: "Practice your lesson words",
    description: "Pick any typing lesson's words to play with.",
    icon: "fa-book-open",
  },
  {
    id: "levels",
    title: "Easy, medium or hard",
    description: "Choose a level - the game picks the words.",
    icon: "fa-signal",
  },
  {
    id: "romaji",
    title: "Romaji games",
    description: "Hiragana on screen, typed in romaji.",
    icon: "fa-language",
  },
];

export type Game = FunboxGame | BuiltinGame;

/**
 * Curated, kid-friendly funboxes that work in words/english. These add a
 * visual or reaction twist without changing the core typing task. Launched
 * with `nosave` so they never persist across reloads.
 */
export const games: Game[] = [
  {
    type: "builtin",
    id: "word-pong",
    name: "Word Ping-Pong",
    description:
      "Type the word on the ball to hit it back - play Tappy or a friend!",
    icon: "fa-table-tennis",
    words: "lessons",
  },
  {
    type: "builtin",
    id: "gem-dig",
    name: "Gem Dig",
    description:
      "Type words to dig down for gems - race Tappy or up to 7 friends!",
    icon: "fa-gem",
    words: "lessons",
  },
  {
    type: "builtin",
    id: "four-row",
    name: "Four in a Row",
    description:
      "Type a column's word to drop your piece - get 4 in a row to win!",
    icon: "fa-th",
    words: "levels",
  },
  {
    type: "builtin",
    id: "word-bomb",
    name: "Word Bomb",
    description:
      "Type the word to pass the bomb before it goes BOOM - up to 6 players!",
    icon: "fa-bomb",
    words: "levels",
  },
  {
    type: "builtin",
    id: "karuta",
    name: "Karuta Battle",
    description:
      "Romaji: see the picture, type the hiragana card first to take it!",
    icon: "fa-clone",
    words: "romaji",
  },
  {
    type: "builtin",
    id: "goldfish",
    name: "Goldfish Scooping",
    description:
      "Romaji: type the hiragana on the goldfish to scoop them - 60 seconds!",
    icon: "fa-fish",
    words: "romaji",
  },
  {
    type: "builtin",
    id: "shiritori",
    name: "Shiritori Bomb",
    description:
      "Romaji: keep the word chain going and pass the bomb before it blows!",
    icon: "fa-link",
    words: "romaji",
  },
  {
    type: "builtin",
    id: "tower-climb",
    name: "Tappy's Tower Climb",
    description:
      "Type each word to help Tappy climb - careful typing earns double jumps!",
    icon: "fa-building",
    words: "lessons",
  },
  {
    type: "builtin",
    id: "snack-shop",
    name: "Snack Shop",
    description: "Type customers' orders before they get tired of waiting!",
    icon: "fa-cookie-bite",
    words: "lessons",
  },
  {
    type: "builtin",
    id: "echo-keys",
    name: "Echo Keys",
    description: "Watch Tappy's key pattern, then repeat it from memory!",
    icon: "fa-lightbulb",
    words: "levels",
  },
  {
    type: "builtin",
    id: "typing-rpg",
    name: "Typing Quest",
    description:
      "Explore a forest, defeat monsters by typing, and find the treasure!",
    icon: "fa-map",
    words: "levels",
  },
  {
    type: "builtin",
    id: "type-toss",
    name: "Type Toss",
    description:
      "Type as many words as you can before time runs out — shoot the shelf targets!",
    icon: "fa-hourglass",
    words: "lessons",
  },
  {
    type: "builtin",
    id: "fruit-ninja",
    name: "Fruit Ninja",
    description: "Type the words on falling fruits before they hit the ground!",
    icon: "fa-lemon",
    words: "lessons",
  },
  {
    type: "builtin",
    id: "type-racer",
    name: "Type Racer",
    description: "Race the CPU — type words to speed ahead!",
    icon: "fa-car",
    words: "lessons",
  },
  {
    type: "builtin",
    id: "monster-raid",
    name: "Monster Raid",
    description:
      "Team up with friends and type to beat monsters and a big boss!",
    icon: "fa-dragon",
    words: "levels",
  },
  {
    type: "builtin",
    id: "ghost-hunter",
    name: "Ghost Hunter",
    description:
      "Ghosts swarm from both sides — type their words before they reach you!",
    icon: "fa-ghost",
    words: "lessons",
  },
  {
    type: "builtin",
    id: "balloon-pop",
    name: "Balloon Pop",
    description: "Type the words on balloons before they float away!",
    icon: "fa-circle",
    words: "lessons",
  },
  {
    type: "builtin",
    id: "word-defender",
    name: "Word Defender",
    description: "Type the words on enemy ships before they reach your base!",
    icon: "fa-rocket",
    words: "lessons",
  },
  {
    type: "funbox",
    id: "memory",
    name: "Memory",
    description: "Words hide once you start - type from memory!",
    icon: "fa-brain",
  },
  {
    type: "funbox",
    id: "read_ahead",
    name: "Read ahead",
    description: "Letters you already passed fade away.",
    icon: "fa-glasses",
  },
  {
    type: "funbox",
    id: "simon_says",
    name: "Simon says",
    description: "Follow the highlighted keys.",
    icon: "fa-clone",
  },
  {
    type: "funbox",
    id: "tts",
    name: "Listen & type",
    description: "Words are read aloud for you to type.",
    icon: "fa-volume-up",
  },
  {
    type: "funbox",
    id: "choo_choo",
    name: "Choo choo",
    description: "The words ride a wiggly train.",
    icon: "fa-train",
  },
  {
    type: "funbox",
    id: "round_round_baby",
    name: "Round and round",
    description: "Spin the words in a loop.",
    icon: "fa-car",
  },
  {
    type: "funbox",
    id: "earthquake",
    name: "Earthquake",
    description: "The words shake as you type.",
    icon: "fa-wind",
  },
  {
    type: "funbox",
    id: "space_balls",
    name: "Space balls",
    description: "Words drift through space.",
    icon: "fa-meteor",
  },
  {
    type: "funbox",
    id: "crt",
    name: "Retro screen",
    description: "Type on an old-school CRT monitor.",
    icon: "fa-tv",
  },
  {
    type: "funbox",
    id: "nausea",
    name: "Wavy",
    description: "The screen gently waves around.",
    icon: "fa-water",
  },
];
