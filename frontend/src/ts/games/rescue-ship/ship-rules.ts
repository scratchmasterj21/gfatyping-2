import type { DifficultyOption } from "../components/DifficultySegmented";

import { EASY_WORDS, HARD_WORDS, MEDIUM_WORDS } from "../shared/kid-words";

/**
 * Rescue Ship: a crew of four flies through space rescuing lost pets.
 *   pilot    - type moves to dodge asteroids
 *   shields  - type shield words to keep the shield charged
 *   engineer - type repair steps when parts break
 *   rescuer  - type pet phrases to beam stranded pets aboard
 * Solo: you're the captain and can do any job (slow helpers back you up).
 * Together: each player runs one station, and stations swap every zone.
 * Every run: 3 random zones, a surprise in each, a big visitor (boss) the
 * whole crew types at, then everyone docks at the Rescue Station.
 *
 * Everything (the ship's health, shield, pets...) is worked out from the
 * seed, the crew and the facts "who finished which task when", so every
 * screen agrees and no one player runs the game.
 */

// ---------------------------------------------------------------- crew

export type Station = "pilot" | "shields" | "engineer" | "rescuer";
export const STATIONS: Station[] = ["pilot", "shields", "engineer", "rescuer"];
export const CREW_SIZE = 4;

export const STATION_INFO: Record<
  Station,
  { name: string; emoji: string; blurb: string; verb: string }
> = {
  pilot: {
    name: "Pilot",
    emoji: "🧭",
    blurb: "Dodge asteroids",
    verb: "dodge",
  },
  shields: {
    name: "Shields",
    emoji: "🛡️",
    blurb: "Keep the shield charged",
    verb: "charge",
  },
  engineer: {
    name: "Engineer",
    emoji: "🔧",
    blurb: "Fix broken parts",
    verb: "fix",
  },
  rescuer: {
    name: "Rescuer",
    emoji: "🐾",
    blurb: "Beam pets aboard",
    verb: "rescue",
  },
};

export type CrewMember = {
  station: Station;
  /** player uid, or null for a computer helper */
  uid: string | null;
  name: string;
};

/** Players keep their picks; helpers take the stations left over. */
export function buildCrew(
  players: { uid: string; name: string; station?: Station }[],
): CrewMember[] {
  const crew: CrewMember[] = [];
  const taken = new Set<Station>();
  for (const p of players.slice(0, CREW_SIZE)) {
    const station =
      p.station !== undefined && !taken.has(p.station)
        ? p.station
        : (STATIONS.find((s) => !taken.has(s)) as Station);
    taken.add(station);
    crew.push({ station, uid: p.uid, name: p.name });
  }
  for (const station of STATIONS) {
    if (taken.has(station)) continue;
    crew.push({
      station,
      uid: null,
      name: `${STATION_INFO[station].name} (helper)`,
    });
  }
  // always in station order, so the crew panel looks the same for everyone
  return STATIONS.map((s) => crew.find((c) => c.station === s) as CrewMember);
}

// ---------------------------------------------------------------- difficulty

export type ShipDifficulty = DifficultyOption & {
  /** shield / all-hands words */
  words: string[];
  /** words in a pilot move (frozen rocks add one) */
  pilotLength: number;
  shieldLength: number;
  /** repair steps per broken part */
  repairSteps: number;
  petStyle: "short" | "medium" | "story";
  /** task windows are multiplied by this */
  windowScale: number;
};

export const SHIP_DIFFICULTIES: ShipDifficulty[] = [
  {
    label: "Easy",
    hint: "short words",
    words: EASY_WORDS,
    pilotLength: 1,
    shieldLength: 1,
    repairSteps: 1,
    petStyle: "short",
    windowScale: 1.25,
  },
  {
    label: "Medium",
    words: MEDIUM_WORDS,
    pilotLength: 2,
    shieldLength: 1,
    repairSteps: 2,
    petStyle: "medium",
    windowScale: 1,
  },
  {
    label: "Hard",
    hint: "long phrases",
    words: HARD_WORDS,
    pilotLength: 2,
    shieldLength: 2,
    repairSteps: 3,
    petStyle: "story",
    windowScale: 0.9,
  },
];

export function shipDifficultyFor(label: string): ShipDifficulty {
  return (
    SHIP_DIFFICULTIES.find((d) => d.label === label) ??
    (SHIP_DIFFICULTIES[0] as ShipDifficulty)
  );
}

export type ShipSetup = {
  seed: number;
  difficulty: ShipDifficulty;
  crew: CrewMember[];
  /** solo: this player can do every job (helpers are slow backups) */
  captain?: string;
  /** together: stations move one along every zone */
  rotate?: boolean;
};

// ---------------------------------------------------------------- random

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

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const pickOne = <T>(rng: () => number, list: readonly T[]): T =>
  list[Math.floor(rng() * list.length)] as T;

function pickWords(rng: () => number, words: string[], count: number): string {
  const out: string[] = [];
  for (let tries = 0; out.length < count && tries < 50; tries++) {
    const w = words[Math.floor(rng() * words.length)] ?? "go";
    if (!out.includes(w) || tries > 30) out.push(w);
  }
  return out.join(" ");
}

function shuffled<T>(rng: () => number, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

// ---------------------------------------------------------------- zones

export type ZoneKind =
  | "asteroids"
  | "meteors"
  | "goo"
  | "ice"
  | "blackhole"
  | "boss"
  | "station";

export const ZONE_INFO: Record<
  Exclude<ZoneKind, "boss">,
  { name: string; emoji: string; tip: string }
> = {
  asteroids: {
    name: "Asteroid Field",
    emoji: "🌌",
    tip: "dodge the space rocks!",
  },
  meteors: {
    name: "Meteor Storm",
    emoji: "☄️",
    tip: "lots more rocks - and things break!",
  },
  goo: {
    name: "Space Goo Cloud",
    emoji: "👾",
    tip: "the goo eats the shield - keep charging!",
  },
  ice: {
    name: "Ice Comets",
    emoji: "🧊",
    tip: "frozen rocks need one more word!",
  },
  blackhole: {
    name: "Black Hole",
    emoji: "🕳️",
    tip: "everything drifts away faster - be quick!",
  },
  station: {
    name: "Rescue Station",
    emoji: "🏠",
    tip: "everyone type together to dock!",
  },
};
const FLY_KINDS = ["asteroids", "meteors", "goo", "ice", "blackhole"] as const;

export type BossKind = "whale" | "octopus";
export const BOSS_INFO: Record<
  BossKind,
  { name: string; emoji: string; tip: string; win: string }
> = {
  whale: {
    name: "Sleepy Space Whale",
    emoji: "🐋",
    tip: "is napping in the way - type to wake it up!",
    win: "The whale woke up and swam off!",
  },
  octopus: {
    name: "Giant Space Octopus",
    emoji: "🐙",
    tip: "is hugging the ship - type to make it let go!",
    win: "The octopus let go and waved bye!",
  },
};

export type Zone = {
  kind: ZoneKind;
  name: string;
  emoji: string;
  tip: string;
  start: number;
  end: number;
  index: number;
};

export const FLY_MS = 70_000;
const BOSS_MS = 30_000;
const STATION_MS = 25_000;
export const RUN_MS = FLY_MS * 3 + BOSS_MS + STATION_MS;
export const START_PAUSE_MS = 3000;

export const shipBoss = (seed: number): BossKind =>
  seededRandom(seed ^ 0xb055)() < 0.5 ? "whale" : "octopus";

/** 3 of the 5 flying zones (random order), the boss, then the station. */
export function shipZones(seed: number): Zone[] {
  const rng = seededRandom(seed ^ 0x2077);
  const zones: Zone[] = shuffled(rng, FLY_KINDS)
    .slice(0, 3)
    .map((kind, index) => ({
      kind,
      ...ZONE_INFO[kind],
      start: index * FLY_MS,
      end: (index + 1) * FLY_MS,
      index,
    }));
  const boss = BOSS_INFO[shipBoss(seed)];
  const bossStart = 3 * FLY_MS;
  zones.push({
    kind: "boss",
    name: boss.name,
    emoji: boss.emoji,
    tip: boss.tip,
    start: bossStart,
    end: bossStart + BOSS_MS,
    index: 3,
  });
  zones.push({
    kind: "station",
    ...ZONE_INFO.station,
    start: bossStart + BOSS_MS,
    end: RUN_MS,
    index: 4,
  });
  return zones;
}

export function zoneAt(zones: Zone[], t: number): Zone {
  return (
    zones.find((z) => t >= z.start && t < z.end) ??
    (zones[zones.length - 1] as Zone)
  );
}

/** Which crew slot runs `station` at time t (stations swap each zone). */
export function memberIndex(
  setup: ShipSetup,
  zones: Zone[],
  station: Station,
  t: number,
): number {
  const si = STATIONS.indexOf(station);
  if (setup.rotate !== true) return si;
  const z = Math.min(zoneAt(zones, t).index, 2);
  return (si - z + CREW_SIZE) % CREW_SIZE;
}

/** The station this player runs at time t. */
export function stationOf(
  setup: ShipSetup,
  zones: Zone[],
  uid: string,
  t: number,
): Station | undefined {
  const i = setup.crew.findIndex((c) => c.uid === uid);
  if (i < 0) return undefined;
  if (setup.rotate !== true) return setup.crew[i]?.station;
  const z = Math.min(zoneAt(zones, t).index, 2);
  return STATIONS[(i + z) % CREW_SIZE];
}

// ---------------------------------------------------------------- words

/** Easy pilot words (one word). */
export const PILOT_WORDS = [
  "up",
  "down",
  "left",
  "right",
  "dodge",
  "duck",
  "jump",
  "spin",
  "zoom",
  "turn",
  "dive",
  "roll",
  "swerve",
  "climb",
];
const PILOT_MOVES = [
  "dodge",
  "duck",
  "dive",
  "zoom",
  "swerve",
  "spin",
  "roll",
  "turn",
  "climb",
  "jump",
  "glide",
  "flip",
];
const PILOT_WAYS = [
  "up",
  "down",
  "left",
  "right",
  "low",
  "high",
  "away",
  "around",
];
const PILOT_EXTRA = ["fast", "now", "quick", "twice"];

function pilotMove(
  rng: () => number,
  d: ShipDifficulty,
  frozen: boolean,
): string {
  const length = d.pilotLength + (frozen ? 1 : 0);
  if (length <= 1) return pickOne(rng, PILOT_WORDS);
  const move = `${pickOne(rng, PILOT_MOVES)} ${pickOne(rng, PILOT_WAYS)}`;
  return length >= 3 ? `${move} ${pickOne(rng, PILOT_EXTRA)}` : move;
}

export type Part = "engine" | "lights" | "leak";
export const PART_INFO: Record<
  Part,
  { name: string; emoji: string; effect: string }
> = {
  engine: {
    name: "Engine",
    emoji: "⚙️",
    effect: "pets float away faster",
  },
  lights: { name: "Lights", emoji: "💡", effect: "it's dark outside" },
  leak: {
    name: "Air leak",
    emoji: "💨",
    effect: "the ship slowly loses health",
  },
};
const PARTS: Part[] = ["engine", "lights", "leak"];
/** Repair steps, typed in order: [get ready, fix it, test it]. */
const REPAIR_STEPS: Record<Part, [string[], string[], string[]]> = {
  engine: [
    ["open panel", "grab wrench", "get toolbox"],
    ["tighten bolt", "oil gears", "swap belt", "clean pipe"],
    ["test engine", "start motor", "rev engine"],
  ],
  lights: [
    ["open panel", "grab ladder", "get toolbox"],
    ["new bulb", "fix wire", "swap fuse", "tape cable"],
    ["flip switch", "lights on", "test lamp"],
  ],
  leak: [
    ["find hole", "grab patch", "get tape"],
    ["seal crack", "patch hole", "tape it", "glue patch"],
    ["check air", "pump air", "test seal"],
  ],
};

function repairSteps(rng: () => number, part: Part, count: number): string[] {
  const [ready, fix, test] = REPAIR_STEPS[part];
  if (count <= 1) return [pickOne(rng, fix)];
  if (count === 2) return [pickOne(rng, fix), pickOne(rng, test)];
  return [pickOne(rng, ready), pickOne(rng, fix), pickOne(rng, test)];
}

export type PetKind = "bunny" | "pup" | "kitty" | "hamster" | "duck" | "turtle";
export const PET_KINDS: PetKind[] = [
  "bunny",
  "pup",
  "kitty",
  "hamster",
  "duck",
  "turtle",
];
const PET_ADJECTIVES = [
  "fluffy",
  "spotty",
  "sleepy",
  "tiny",
  "happy",
  "silly",
  "sparkly",
  "brave",
  "chubby",
  "fuzzy",
];
const PET_MEDIUM = ["save the", "help the", "find the", "hug the"];
const PET_STORY = [
  "the # is lost",
  "the # needs help",
  "beam up the #",
  "the # wants home",
];

function petPhrase(
  rng: () => number,
  d: ShipDifficulty,
  pet: PetKind,
  golden: boolean,
): string {
  const adjective = golden ? "golden" : pickOne(rng, PET_ADJECTIVES);
  const name = `${adjective} ${pet}`;
  if (d.petStyle === "short") return name;
  if (d.petStyle === "medium") return `${pickOne(rng, PET_MEDIUM)} ${name}`;
  return pickOne(rng, PET_STORY).replace("#", name);
}

const BOSS_EASY = [
  "wake up",
  "hello",
  "move over",
  "swim away",
  "go home",
  "nap later",
  "big yawn",
  "wave bye",
  "time to go",
  "be nice",
  "say hi",
  "good day",
];
const BOSS_LONG = [
  "please wake up",
  "time to swim",
  "move over please",
  "go find a snack",
  "sing us a song",
  "wave goodbye",
  "you are so big",
  "nap time is over",
  "say hello friend",
  "swim home now",
  "you can nap later",
  "thank you big friend",
];
const SUPPLY_WORDS = {
  short: ["catch box", "grab box", "get fuel", "grab it"],
  long: ["catch the crate", "grab the box", "get the snacks", "catch the fuel"],
};
const FLARE_WORDS = {
  short: ["shields up", "block it", "stay safe"],
  long: ["shields up now", "block the flare", "hold the shield"],
};

// ---------------------------------------------------------------- tasks

export type TaskKind =
  | "hazard"
  | "charge"
  | "break"
  | "pet"
  | "hands"
  | "boss"
  | "supply"
  | "flare";

export type Task = {
  id: string;
  kind: TaskKind;
  /** the station that does it ("all" = everyone types it, "any" = first wins) */
  station: Station | "all" | "any";
  at: number;
  /** ms to finish it (breaks: until the end of the run) */
  window: number;
  word: string;
  /** repairs: typed one after another (word is them all) */
  steps?: string[];
  part?: Part;
  pet?: PetKind;
  /** a rare golden pet: worth 3 */
  golden?: boolean;
  /** an SOS pet: worth 2, not much time */
  sos?: boolean;
  /** an ice comet rock */
  frozen?: boolean;
  /** the last all-hands call at the Rescue Station: bonus pets */
  dock?: boolean;
};

/**
 * Solo captain pace: one player does every station's jobs, so jobs come
 * less often and wait longer (and long phrases always get enough time).
 */
const CAPTAIN_GAP = 1.6;
const CAPTAIN_WINDOW = 1.4;
const captainFit = (word: string): number => 2500 + word.length * 400;

/** Every task in the run - the same for everyone with this seed. */
export function shipTasks(
  seed: number,
  d: ShipDifficulty,
  opts: { captain?: boolean } = {},
): Task[] {
  const tasks: Task[] = [];
  const rng = seededRandom(seed ^ 0x51ab);
  const captain = opts.captain === true;
  const gap = captain ? CAPTAIN_GAP : 1;
  const w = (ms: number): number =>
    Math.round(ms * d.windowScale * (captain ? CAPTAIN_WINDOW : 1));
  const zones = shipZones(seed);
  const short = d.petStyle === "short" ? "short" : "long";
  const n = { p: 0, s: 0, e: 0, r: 0, x: 0 };

  zones.slice(0, 3).forEach((z, zi) => {
    const fast = z.kind === "blackhole" ? 0.85 : 1;

    // pilot: asteroids, faster each zone (and in a meteor storm)
    const every = Math.round(
      ([7000, 6000, 5000][zi] as number) *
        (z.kind === "meteors" ? 0.75 : 1) *
        gap,
    );
    for (let t = z.start + 2500; t < z.end - 2000; t += every) {
      const frozen = z.kind === "ice";
      tasks.push({
        id: `p${n.p++}`,
        kind: "hazard",
        station: "pilot",
        at: t + Math.round(rng() * 1500),
        window: Math.round(w(frozen ? 6500 : 5500) * fast),
        word: pilotMove(rng, d, frozen),
        ...(frozen ? { frozen } : {}),
      });
    }

    // shields: a charge word every 4s
    const chargeEvery = Math.round(4000 * gap);
    for (let t = z.start + 1500; t < z.end; t += chargeEvery) {
      tasks.push({
        id: `s${n.s++}`,
        kind: "charge",
        station: "shields",
        at: t,
        window: chargeEvery,
        word: pickWords(rng, d.words, d.shieldLength),
      });
    }

    // engineer: parts break, more later on and in a meteor storm
    const count =
      ((captain ? [1, 3, 3] : [2, 4, 4])[zi] as number) +
      (z.kind === "meteors" ? 1 : 0);
    const slot = (FLY_MS - 10_000) / count;
    for (let i = 0; i < count; i++) {
      const part = PARTS[(n.e + Math.floor(rng() * 3)) % 3] as Part;
      const steps = repairSteps(rng, part, d.repairSteps);
      tasks.push({
        id: `e${n.e++}`,
        kind: "break",
        station: "engineer",
        at: z.start + 6000 + Math.round(slot * i + rng() * slot * 0.6),
        window: RUN_MS,
        word: steps.join(" "),
        steps,
        part,
      });
    }

    // rescuer: stranded pets (now and then a golden one)
    const petEvery = Math.round(([13_000, 11_500, 10_500][zi] as number) * gap);
    for (let t = z.start + 5000; t < z.end - 6000; t += petEvery) {
      const pet = pickOne(rng, PET_KINDS);
      const golden = rng() < 0.06;
      tasks.push({
        id: `r${n.r++}`,
        kind: "pet",
        station: "rescuer",
        at: t + Math.round(rng() * 2000),
        window: Math.round(w(11_000) * fast),
        word: petPhrase(rng, d, pet, golden),
        pet,
        ...(golden ? { golden } : {}),
      });
    }

    // one surprise per zone
    const at = z.start + 20_000 + Math.round(rng() * 30_000);
    const surprise = Math.floor(rng() * 3);
    const id = `x${n.x++}`;
    if (surprise === 0) {
      const pet = pickOne(rng, PET_KINDS);
      tasks.push({
        id,
        kind: "pet",
        station: "rescuer",
        at,
        window: w(8000),
        word: short === "short" ? `sos ${pet}` : `sos save the ${pet}`,
        pet,
        sos: true,
      });
    } else if (surprise === 1) {
      tasks.push({
        id,
        kind: "supply",
        station: "any",
        at,
        window: w(8000),
        word: pickOne(rng, SUPPLY_WORDS[short]),
      });
    } else {
      tasks.push({
        id,
        kind: "flare",
        station: "shields",
        at,
        window: w(7000),
        word: pickOne(rng, FLARE_WORDS[short]),
      });
    }

    // all hands near the end of the zone
    tasks.push({
      id: `a${zi}`,
      kind: "hands",
      station: "all",
      at: z.end - 6000,
      window: w(7000),
      word: pickWords(rng, d.words, d.label === "Easy" ? 1 : 2),
    });
  });

  // the big visitor: phrases anyone can type
  const boss = zones[3] as Zone;
  const phrases = shuffled(rng, d.label === "Easy" ? BOSS_EASY : BOSS_LONG);
  const bossCount = d.label === "Easy" ? (captain ? 5 : 6) : captain ? 6 : 8;
  for (let i = 0; i < bossCount; i++) {
    tasks.push({
      id: `b${i}`,
      kind: "boss",
      station: "any",
      at: boss.start + 2500 + i * (captain ? 4000 : 2800),
      window: w(9000),
      word: phrases[i % phrases.length] as string,
    });
  }

  const station = zones[4] as Zone;
  tasks.push({
    id: "a3",
    kind: "hands",
    station: "all",
    at: station.start + 3000,
    window: Math.min(w(17_000), STATION_MS - 3500),
    word: pickWords(rng, d.words, 3),
    dock: true,
  });

  if (captain) {
    // long phrases always get enough time to type
    for (const task of tasks) {
      if (task.kind !== "break") {
        task.window = Math.max(task.window, captainFit(task.word));
      }
    }
  }
  return tasks.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

/** A combo shield boost's task id (unique per crew slot). */
export const boostId = (slot: number, n: number): string =>
  `c${slot}${String(n % 100).padStart(2, "0")}`;

// ---------------------------------------------------------------- facts

export type ShipFacts = {
  /** ms since the start (server time) */
  startAt: number;
  /** taskId -> who finished it and when (absolute time); "c..." = boosts */
  done: Record<string, { by: string; at: number }>;
  /** all-hands taskId -> uid -> when */
  hands: Record<string, Record<string, number>>;
};

export const START_HP = 10;
const SHIELD_MAX = 100;
const SHIELD_DRAIN_PER_S = 2.0;
/** the solo captain has fewer shield jobs, so the shield drains slower */
const CAPTAIN_DRAIN_PER_S = 1.3;
/** the goo cloud eats the shield this much faster */
const GOO_DRAIN = 1.6;
const SHIELD_CHARGE = 22;
const SHIELD_BLOCK_COST = 35;
export const BOOST_SHIELD = 30;
const LEAK_EVERY_MS = 10_000;
const ENGINE_PET_WINDOW = 0.65;
export const DOCK_BONUS_PETS = 3;
export const BOSS_BONUS_PETS = 3;
const SUPPLY_HP = 2;
/** missed this many in a row: a helper takes over that station */
const AWAY_AFTER: Record<Station, number> = {
  pilot: 4,
  shields: 6,
  engineer: 2,
  rescuer: 3,
};
/** an unfixed break counts as missed after this long */
const BREAK_MISS_MS = 25_000;

export const petWorth = (task: Task): number =>
  task.golden === true ? 3 : task.sos === true ? 2 : 1;

type HelperMode = "normal" | "autopilot" | "backup";

/** When a computer helper finishes a task (or undefined: it doesn't). */
function helperDoneAt(
  seed: number,
  task: Task,
  mode: HelperMode,
): number | undefined {
  const rng = seededRandom(seed ^ hashString(task.id));
  if (task.kind === "break") {
    const wait = mode === "normal" ? 5000 : mode === "autopilot" ? 9000 : 14000;
    return task.at + wait + rng() * 5000;
  }
  const base = task.kind === "charge" ? 0.5 : 0.8;
  // the auto-pilot that covers for an idle player is not as good, and a
  // backup (solo captain, boss) waits to give the players a go first
  const chance =
    mode === "normal" ? base : mode === "autopilot" ? base * 0.55 : base * 0.9;
  if (rng() > chance) return undefined;
  if (mode === "backup") return task.at + task.window * (0.7 + rng() * 0.25);
  return task.at + 900 + rng() * task.window * 0.7;
}

export type ShipEvent = {
  t: number;
  kind:
    | "dodge"
    | "block"
    | "bump"
    | "charge"
    | "break"
    | "fix"
    | "leak"
    | "rescue"
    | "petLost"
    | "hands"
    | "handsMiss"
    | "dock"
    | "supply"
    | "flareBlock"
    | "flareHit"
    | "bossHit"
    | "bossWin"
    | "bossLeft"
    | "boost";
  /** uid / "helper" */
  by?: string;
  taskId?: string;
  amount?: number;
};

export type CrewStats = {
  dodges: number;
  charges: number;
  fixes: number;
  rescues: number;
  hands: number;
  /** boss phrases */
  boss: number;
  /** supply crates caught, solar flares blocked */
  extras: number;
};

export type Rescued = { pet: PetKind; by: string; golden: boolean };

export type ShipView = {
  /** ms since the start */
  t: number;
  zones: Zone[];
  zone: Zone;
  hp: number;
  shield: number;
  pets: number;
  rescued: Rescued[];
  broken: Part[];
  over: boolean;
  /** why it ended */
  reason?: "home" | "wrecked";
  /** tasks open right now */
  open: Task[];
  /** stations a helper has taken over (right now) */
  away: Set<Station>;
  events: ShipEvent[];
  /** by uid (helpers under "helper") */
  stats: Record<string, CrewStats>;
  bossHits: number;
  bossMax: number;
  /** pets a perfect crew would bring home */
  maxPets: number;
  boss?: "won" | "left";
  /** no crew call missed and the boss sent off */
  perfect: boolean;
};

export const emptyStats = (): CrewStats => ({
  dodges: 0,
  charges: 0,
  fixes: 0,
  rescues: 0,
  hands: 0,
  boss: 0,
  extras: 0,
});

/** The ship as it is `now` (absolute time). */
export function shipView(
  setup: ShipSetup,
  tasks: Task[],
  facts: ShipFacts,
  now: number,
): ShipView {
  const t = Math.min(RUN_MS, Math.max(0, now - facts.startAt));
  const zones = shipZones(setup.seed);
  const slotOf = (task: Task): number | null =>
    task.station === "all" || task.station === "any"
      ? null
      : memberIndex(setup, zones, task.station, task.at);
  const awayAfter = (task: Task): number =>
    AWAY_AFTER[task.station as Station] ?? 3;

  // ---- who finishes what, when (relative ms), with helpers filling in
  const away = new Set<number>();
  const awayFrom: (number | undefined)[] = [];
  const misses = [0, 0, 0, 0];
  const finish = new Map<string, { at: number; by: string }>();

  // the engine being broken shortens pet windows
  const fixedAt = new Map<string, number>();
  const petWindow = (task: Task): number =>
    task.kind === "pet" && engineBrokenAt(task.at, tasks, fixedAt)
      ? Math.round(task.window * ENGINE_PET_WINDOW)
      : task.window;
  for (const task of tasks) {
    if (task.kind === "hands") continue;
    const slot = slotOf(task);
    const human = slot === null ? null : (setup.crew[slot]?.uid ?? null);
    const fact = facts.done[task.id];
    const playerAt = fact === undefined ? undefined : fact.at - facts.startAt;
    const window = petWindow(task);
    // only what has happened by now counts
    const inTime = (at: number | undefined): at is number =>
      at !== undefined && at >= task.at && at <= task.at + window && at <= t;
    const slotAway =
      slot !== null &&
      awayFrom[slot] !== undefined &&
      task.at >= (awayFrom[slot] ?? 0);
    const helperOn = human === null || slotAway;
    const mode: HelperMode =
      slot === null || setup.captain !== undefined
        ? "backup"
        : human === null
          ? "normal"
          : "autopilot";
    // a break nobody fixes for a while gets fixed by a helper anyway
    const helperAt = helperOn
      ? helperDoneAt(setup.seed, task, mode)
      : task.kind === "break"
        ? task.at + BREAK_MISS_MS + 2000
        : undefined;
    let done: { at: number; by: string } | undefined;
    if (inTime(playerAt) && fact !== undefined) {
      done = { at: playerAt, by: fact.by };
      // typing again takes the station back from the helper
      if (slot !== null && slotAway && fact.by === human) {
        awayFrom[slot] = undefined;
        away.delete(slot);
        misses[slot] = 0;
      }
    }
    if (inTime(helperAt) && (done === undefined || helperAt < done.at)) {
      done = { at: helperAt, by: "helper" };
    }
    if (done !== undefined) {
      finish.set(task.id, done);
      if (task.kind === "break") fixedAt.set(task.id, done.at);
    }

    // a player who stops answering gets a helper
    if (slot !== null && human !== null && !helperOn) {
      const missDeadline =
        task.kind === "break" ? task.at + BREAK_MISS_MS : task.at + window;
      const missed =
        done === undefined
          ? missDeadline <= t
          : task.kind === "break" && done.at > task.at + BREAK_MISS_MS;
      if (done !== undefined && !missed) {
        misses[slot] = 0;
      } else if (missed) {
        misses[slot] = (misses[slot] ?? 0) + 1;
        if ((misses[slot] ?? 0) >= awayAfter(task)) {
          away.add(slot);
          awayFrom[slot] = missDeadline;
        }
      }
    }
  }

  // ---- play the run forward to t
  const events: ShipEvent[] = [];
  const bossTasks: Task[] = [];
  for (const task of tasks) {
    const done = finish.get(task.id);
    const by = done?.by;
    if (task.kind === "hazard") {
      events.push(
        done !== undefined
          ? { t: done.at, kind: "dodge", by, taskId: task.id }
          : { t: task.at + task.window, kind: "bump", taskId: task.id },
      );
    } else if (task.kind === "charge") {
      if (done !== undefined) {
        events.push({ t: done.at, kind: "charge", by, taskId: task.id });
      }
    } else if (task.kind === "break") {
      events.push({ t: task.at, kind: "break", taskId: task.id });
      const end = done?.at ?? RUN_MS;
      if (done !== undefined) {
        events.push({ t: done.at, kind: "fix", by, taskId: task.id });
      }
      if (task.part === "leak") {
        for (let lt = task.at + LEAK_EVERY_MS; lt < end; lt += LEAK_EVERY_MS) {
          events.push({ t: lt, kind: "leak", taskId: task.id });
        }
      }
    } else if (task.kind === "pet") {
      events.push(
        done !== undefined
          ? {
              t: done.at,
              kind: "rescue",
              by,
              taskId: task.id,
              amount: petWorth(task),
            }
          : { t: task.at + petWindow(task), kind: "petLost", taskId: task.id },
      );
    } else if (task.kind === "supply") {
      if (done !== undefined) {
        events.push({ t: done.at, kind: "supply", by, taskId: task.id });
      }
    } else if (task.kind === "flare") {
      events.push(
        done !== undefined
          ? { t: done.at, kind: "flareBlock", by, taskId: task.id }
          : { t: task.at + task.window, kind: "flareHit", taskId: task.id },
      );
    } else if (task.kind === "boss") {
      bossTasks.push(task);
      if (done !== undefined) {
        events.push({ t: done.at, kind: "bossHit", by, taskId: task.id });
      }
    } else {
      // all hands: the captain, or every player still at their station
      const needed =
        setup.captain !== undefined
          ? [setup.captain]
          : setup.crew
              .filter((c, i) => c.uid !== null && !away.has(i))
              .map((c) => c.uid as string);
      const typed = facts.hands[task.id] ?? {};
      const deadline = task.at + task.window;
      const inTime = (u: string): boolean => {
        const at = typed[u];
        return at !== undefined && at - facts.startAt <= deadline;
      };
      const missing = needed.filter((u) => !inTime(u)).length;
      for (const u of needed.filter(inTime)) {
        events.push({
          t: (typed[u] as number) - facts.startAt,
          kind: "hands",
          by: u,
          taskId: task.id,
        });
      }
      const allIn =
        missing === 0 && needed.length > 0
          ? Math.max(...needed.map((u) => (typed[u] as number) - facts.startAt))
          : undefined;
      events.push({
        t: allIn ?? deadline,
        kind:
          missing === 0 ? (task.dock === true ? "dock" : "hands") : "handsMiss",
        taskId: task.id,
        amount: missing,
      });
    }
  }
  // the boss: sent off once every phrase is typed, else it wanders away
  const bossDone = bossTasks.map((b) => finish.get(b.id));
  if (bossTasks.length > 0) {
    if (bossDone.every((d) => d !== undefined)) {
      events.push({
        t: Math.max(...bossDone.map((d) => d?.at ?? 0)) + 1,
        kind: "bossWin",
      });
    } else {
      events.push({
        t: Math.max(...bossTasks.map((b) => b.at + b.window)) + 1,
        kind: "bossLeft",
      });
    }
  }
  // combo shield boosts
  for (const [id, f] of Object.entries(facts.done)) {
    if (!/^c\d+$/.test(id)) continue;
    const at = f.at - facts.startAt;
    if (at >= 0 && at <= RUN_MS) {
      events.push({ t: at, kind: "boost", by: f.by, taskId: id });
    }
  }
  events.sort((a, b) => a.t - b.t);

  const gooZones = zones.filter((z) => z.kind === "goo");
  const drain = (from: number, to: number): number => {
    let goo = 0;
    for (const z of gooZones) {
      goo += Math.max(0, Math.min(to, z.end) - Math.max(from, z.start));
    }
    const rate =
      setup.captain === undefined ? SHIELD_DRAIN_PER_S : CAPTAIN_DRAIN_PER_S;
    return ((to - from + goo * (GOO_DRAIN - 1)) / 1000) * rate;
  };

  const byId = new Map(tasks.map((x) => [x.id, x]));
  let hp = START_HP;
  let shield = SHIELD_MAX;
  let pets = 0;
  let bossHits = 0;
  let boss: ShipView["boss"];
  let missedCall = false;
  const rescued: Rescued[] = [];
  let last = 0;
  let wreckedAt: number | undefined;
  const stats: Record<string, CrewStats> = {};
  const stat = (by: string | undefined): CrewStats => {
    const key = by ?? "helper";
    stats[key] ??= emptyStats();
    return stats[key];
  };
  const played: ShipEvent[] = [];
  for (const e of events) {
    if (e.t > t) break;
    shield = Math.max(0, shield - drain(last, e.t));
    last = e.t;
    const task = e.taskId === undefined ? undefined : byId.get(e.taskId);
    switch (e.kind) {
      case "dodge":
        stat(e.by).dodges++;
        break;
      case "bump":
        if (shield >= SHIELD_BLOCK_COST) {
          shield -= SHIELD_BLOCK_COST;
          e.kind = "block";
        } else {
          hp -= 1;
        }
        break;
      case "charge":
        shield = Math.min(SHIELD_MAX, shield + SHIELD_CHARGE);
        stat(e.by).charges++;
        break;
      case "boost":
        shield = Math.min(SHIELD_MAX, shield + BOOST_SHIELD);
        break;
      case "fix":
        stat(e.by).fixes++;
        break;
      case "leak":
      case "flareHit":
        hp -= 1;
        break;
      case "rescue":
        pets += e.amount ?? 1;
        if (task?.pet !== undefined) {
          rescued.push({
            pet: task.pet,
            by: e.by ?? "helper",
            golden: task.golden === true,
          });
        }
        stat(e.by).rescues++;
        break;
      case "supply":
        hp = Math.min(START_HP, hp + SUPPLY_HP);
        stat(e.by).extras++;
        break;
      case "flareBlock":
        stat(e.by).extras++;
        break;
      case "bossHit":
        bossHits++;
        stat(e.by).boss++;
        break;
      case "bossWin":
        boss = "won";
        pets += BOSS_BONUS_PETS;
        hp = Math.min(START_HP, hp + 2);
        break;
      case "bossLeft":
        boss = "left";
        break;
      case "hands":
        if (e.by !== undefined) stat(e.by).hands++;
        break;
      case "handsMiss":
        missedCall = true;
        hp -= Math.min(2, e.amount ?? 1);
        break;
      case "dock":
        pets += DOCK_BONUS_PETS;
        break;
      default:
        break;
    }
    played.push(e);
    if (hp <= 0) {
      hp = 0;
      wreckedAt = e.t;
      break;
    }
  }
  if (wreckedAt === undefined) {
    shield = Math.max(0, shield - drain(last, t));
  }

  const now_ = wreckedAt ?? t;
  const broken = tasks
    .filter(
      (x) =>
        x.kind === "break" &&
        x.at <= now_ &&
        (fixedAt.get(x.id) ?? Infinity) > now_,
    )
    .map((x) => x.part as Part);
  const open = tasks.filter((x) => {
    if (x.at > now_ || finish.has(x.id)) return false;
    if (x.kind === "break") return (fixedAt.get(x.id) ?? Infinity) > now_;
    return now_ <= x.at + petWindow(x);
  });
  const awayStations = new Set(
    STATIONS.filter((s) => away.has(memberIndex(setup, zones, s, now_))),
  );

  const over = wreckedAt !== undefined || t >= RUN_MS || dockDone(played);
  const reason = wreckedAt !== undefined ? "wrecked" : "home";
  return {
    t: now_,
    zones,
    zone: zoneAt(zones, now_),
    hp,
    shield: Math.round(shield),
    pets,
    rescued,
    broken: [...new Set(broken)],
    over,
    ...(over ? { reason } : {}),
    open,
    away: awayStations,
    events: played,
    stats,
    bossHits,
    bossMax: bossTasks.length,
    maxPets:
      tasks.reduce((sum, x) => sum + (x.kind === "pet" ? petWorth(x) : 0), 0) +
      DOCK_BONUS_PETS +
      (bossTasks.length > 0 ? BOSS_BONUS_PETS : 0),
    ...(boss === undefined ? {} : { boss }),
    perfect: over && reason === "home" && !missedCall && boss === "won",
  };
}

function dockDone(events: ShipEvent[]): boolean {
  return events.some((e) => e.kind === "dock");
}

function engineBrokenAt(
  t: number,
  tasks: Task[],
  fixedAt: Map<string, number>,
): boolean {
  return tasks.some(
    (x) =>
      x.kind === "break" &&
      x.part === "engine" &&
      x.at <= t &&
      (fixedAt.get(x.id) ?? Infinity) > t,
  );
}

// ---------------------------------------------------------------- score

export function shipScore(input: { view: ShipView; mine: CrewStats }): number {
  const v = input.view;
  const m = input.mine;
  return Math.round(
    v.pets * 6 +
      v.hp * 2 +
      (v.reason === "home" ? 30 : 0) +
      (v.perfect ? 25 : 0) +
      m.dodges * 2 +
      m.charges +
      m.fixes * 4 +
      m.rescues * 3 +
      m.hands * 2 +
      m.boss * 3 +
      m.extras * 4,
  );
}

export function shipStars(v: ShipView): number {
  if (v.reason !== "home") return 1;
  const share = v.pets / Math.max(1, v.maxPets);
  if (share >= 0.75 && v.hp >= 6) return 3;
  return share >= 0.5 ? 2 : 1;
}

/** Pets I beamed aboard myself, by kind ("golden" counts golden ones). */
export function myPetCounts(
  v: ShipView,
  uid: string,
): Partial<Record<PetKind | "golden", number>> {
  const out: Partial<Record<PetKind | "golden", number>> = {};
  for (const r of v.rescued) {
    if (r.by !== uid) continue;
    out[r.pet] = (out[r.pet] ?? 0) + 1;
    if (r.golden) out.golden = (out.golden ?? 0) + 1;
  }
  return out;
}

export type ShipAward = {
  icon: string;
  title: string;
  names: string[];
  value: number;
};

export function shipAwards(
  crew: CrewMember[],
  stats: Record<string, CrewStats>,
): ShipAward[] {
  const players = crew.filter((c) => c.uid !== null);
  if (players.length < 2) return [];
  const get = (c: CrewMember): CrewStats =>
    stats[c.uid as string] ?? emptyStats();
  const award = (
    icon: string,
    title: string,
    value: (s: CrewStats) => number,
  ): ShipAward | null => {
    const best = Math.max(...players.map((c) => value(get(c))));
    if (best <= 0) return null;
    return {
      icon,
      title,
      value: best,
      names: players.filter((c) => value(get(c)) === best).map((c) => c.name),
    };
  };
  return [
    award("🧭", "Best pilot", (s) => s.dodges),
    award("🛡️", "Shield hero", (s) => s.charges),
    award("🔧", "Fix-it master", (s) => s.fixes),
    award("🐾", "Top rescuer", (s) => s.rescues),
    award("🐋", "Visitor tamer", (s) => s.boss),
    award("⚡", "Crew calls", (s) => s.hands),
  ].filter((a): a is ShipAward => a !== null);
}
