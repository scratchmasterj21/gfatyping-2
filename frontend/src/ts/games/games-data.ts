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
    | "type-toss";
  name: string;
  description: string;
  icon: FaSolidIcon;
};

export type Game = FunboxGame | BuiltinGame;

/**
 * Curated, kid-friendly funboxes that work in words/english. These add a
 * visual or reaction twist without changing the core typing task. Launched
 * with `nosave` so they never persist across reloads.
 */
export const games: Game[] = [
  {
    type: "builtin",
    id: "type-toss",
    name: "Type Toss",
    description:
      "Type as many words as you can before time runs out — shoot the shelf targets!",
    icon: "fa-hourglass",
  },
  {
    type: "builtin",
    id: "fruit-ninja",
    name: "Fruit Ninja",
    description: "Type the words on falling fruits before they hit the ground!",
    icon: "fa-lemon",
  },
  {
    type: "builtin",
    id: "type-racer",
    name: "Type Racer",
    description: "Race the CPU — type words to speed ahead!",
    icon: "fa-car",
  },
  {
    type: "builtin",
    id: "ghost-hunter",
    name: "Ghost Hunter",
    description:
      "Ghosts swarm from both sides — type their words before they reach you!",
    icon: "fa-ghost",
  },
  {
    type: "builtin",
    id: "balloon-pop",
    name: "Balloon Pop",
    description: "Type the words on balloons before they float away!",
    icon: "fa-circle",
  },
  {
    type: "builtin",
    id: "word-defender",
    name: "Word Defender",
    description: "Type the words on enemy ships before they reach your base!",
    icon: "fa-rocket",
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
