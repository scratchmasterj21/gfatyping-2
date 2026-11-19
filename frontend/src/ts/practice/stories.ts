import type { Grade } from "../constants/classes";

/**
 * Story mode for free typing: short original stories told in chapters.
 * Each grade band gets text it can type:
 *   G1-G2  short words, no capitals or punctuation
 *   G3-G4  lowercase with full stops
 *   G5-G6  normal sentences with capitals and commas
 */

export type Band = "g12" | "g34" | "g56";

export type Story = {
  id: string;
  band: Band;
  title: string;
  emoji: string;
  chapters: { title: string; text: string }[];
};

export const bandFor = (grade: Grade | undefined): Band =>
  grade === "G1" || grade === "G2"
    ? "g12"
    : grade === "G5" || grade === "G6"
      ? "g56"
      : "g34";

export const BAND_NAME: Record<Band, string> = {
  g12: "Grades 1-2",
  g34: "Grades 3-4",
  g56: "Grades 5-6",
};

export const STORIES: Story[] = [
  // ---------------------------------------------------------------- G1-G2
  {
    id: "lost-robot",
    band: "g12",
    title: "The Lost Robot",
    emoji: "🤖",
    chapters: [
      {
        title: "A Box in the Park",
        text: "a big box sat in the park one day a small hand came out of the box and a red light went on and off",
      },
      {
        title: "Hello Bip",
        text: "a little robot got out of the box it said hello my name is bip i am lost can you help me find my home",
      },
      {
        title: "The Map",
        text: "bip had a map in his bag the map had a sun a tree and a blue lake we will walk to the lake said bip",
      },
      {
        title: "Home at Last",
        text: "at the lake a big robot ran up to bip it was his mom bip was so glad he gave his new friend a big hug",
      },
    ],
  },
  {
    id: "frog-hat",
    band: "g12",
    title: "Frog and the Red Hat",
    emoji: "🐸",
    chapters: [
      {
        title: "The Hat",
        text: "frog had a red hat he put it on his head and went out to the pond the sun was hot and the hat was fun",
      },
      {
        title: "Wind",
        text: "then a big wind came the wind took the red hat up up up and the hat fell in a tall tree oh no said frog",
      },
      {
        title: "Help",
        text: "a bird sat in the tree can you get my hat said frog the bird got the hat and let it drop on frog",
      },
      {
        title: "Thank You",
        text: "frog said thank you to the bird he gave the bird a big bug to eat and the two of them sat in the sun",
      },
    ],
  },
  // ---------------------------------------------------------------- G3-G4
  {
    id: "moon-garden",
    band: "g34",
    title: "The Moon Garden",
    emoji: "🌙",
    chapters: [
      {
        title: "A Strange Seed",
        text: "mia found a silver seed on her way home from school. it was cold and it glowed a little. she planted it in a pot by her window and went to bed.",
      },
      {
        title: "Night Flowers",
        text: "at midnight a soft light woke her up. the pot was full of tiny white flowers. each one was shaped like a moon and they hummed a quiet song.",
      },
      {
        title: "Visitors",
        text: "the song brought moths, owls and one sleepy bat to her window. they danced in the moon light until the sky turned pink and the flowers closed.",
      },
      {
        title: "Sharing",
        text: "mia gave a seed to every child in her class. soon the whole town had moon gardens, and every night the streets sang their gentle song.",
      },
    ],
  },
  {
    id: "lighthouse-cat",
    band: "g34",
    title: "The Lighthouse Cat",
    emoji: "🐱",
    chapters: [
      {
        title: "Captain Whiskers",
        text: "a grey cat named whiskers lived at the top of an old lighthouse. every evening she sat beside the big lamp and watched the boats sail home.",
      },
      {
        title: "The Storm",
        text: "one night a storm came. rain hit the windows and the wind howled. then the lamp went dark. far out at sea a small boat was lost in the waves.",
      },
      {
        title: "A Bright Idea",
        text: "whiskers knocked over a box of old candles. the keeper woke up, saw the candles and lit them all. the tower glowed again through the rain.",
      },
      {
        title: "Safe Harbour",
        text: "the little boat followed the light to the harbour. the fisher brought whiskers a fresh fish, and from then on she was called captain whiskers.",
      },
    ],
  },
  // ---------------------------------------------------------------- G5-G6
  {
    id: "time-backpack",
    band: "g56",
    title: "The Time Backpack",
    emoji: "🎒",
    chapters: [
      {
        title: "A Gift from Grandpa",
        text: 'Ken\'s grandpa gave him an old green backpack for his birthday. Inside the front pocket was a brass dial with numbers from one to one hundred. "Never turn it past ten," Grandpa said with a wink.',
      },
      {
        title: "Ten Minutes Ago",
        text: "Ken turned the dial to ten. The room spun, and suddenly he was standing in the kitchen again, watching himself open the present. He laughed, turned the dial back, and returned to the present with a pounding heart.",
      },
      {
        title: "Too Far",
        text: "The next morning Ken was late for a test, so he turned the dial to thirty. He arrived in a quiet classroom full of dinosaurs drawn on the board. He had gone back thirty years, not thirty minutes!",
      },
      {
        title: "Grandpa's Secret",
        text: 'A boy with familiar eyes sat at the front desk. It was Grandpa, age eleven. "Nice backpack," young Grandpa whispered. Ken smiled, set the dial to zero, and finally understood the wink.',
      },
    ],
  },
  {
    id: "ocean-signal",
    band: "g56",
    title: "Signal from the Deep",
    emoji: "🐋",
    chapters: [
      {
        title: "The Recording",
        text: "On a research ship far from land, Aya listened to the ocean through headphones. Most of the sounds were waves and engines, but tonight there was a long, low song that repeated three times.",
      },
      {
        title: "Following the Song",
        text: "The captain agreed to follow the signal. For two days the ship sailed north while Aya mapped every note. The song grew louder, and the crew began to hum it while they worked.",
      },
      {
        title: "The Whale",
        text: "At sunrise a huge blue whale rose beside the ship. Caught around its tail was an old fishing net, heavy with seaweed. The song, Aya realised, had been a call for help.",
      },
      {
        title: "Free",
        text: "Carefully, the crew cut the net away from a small boat. The whale dived, then leapt clear of the water and sang one last bright song. Aya saved the recording and named it Thank You.",
      },
    ],
  },
];

export const storiesFor = (band: Band): Story[] =>
  STORIES.filter((s) => s.band === band);

export const storyById = (id: string): Story | undefined =>
  STORIES.find((s) => s.id === id);
