import type { DifficultyOption } from "../components/DifficultySegmented";

import { EASY_WORDS, HARD_WORDS, MEDIUM_WORDS } from "../shared/kid-words";

/**
 * Rescue Ship: a crew of four flies through space rescuing lost pets. Each
 * player runs one station (computer helpers run the rest):
 *   pilot    - type direction words to dodge asteroids
 *   shields  - type shield words to keep the shield charged
 *   engineer - type repair phrases when parts break
 *   rescuer  - type pet phrases to beam stranded pets aboard
 * Now and then everyone must type the same "all hands" word together.
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
  /** pilot / shield / all-hands words */
  words: string[];
  /** repair phrase words */
  repairWords: string[];
  repairLength: number;
  /** words in a pet phrase (adjectives + pet) */
  petLength: number;
  /** task windows are multiplied by this */
  windowScale: number;
};

export const SHIP_DIFFICULTIES: ShipDifficulty[] = [
  {
    label: "Easy",
    hint: "short words",
    words: EASY_WORDS,
    repairWords: EASY_WORDS,
    repairLength: 2,
    petLength: 2,
    windowScale: 1.25,
  },
  {
    label: "Medium",
    words: MEDIUM_WORDS,
    repairWords: MEDIUM_WORDS,
    repairLength: 2,
    petLength: 2,
    windowScale: 1,
  },
  {
    label: "Hard",
    hint: "long words",
    words: HARD_WORDS,
    repairWords: HARD_WORDS,
    repairLength: 3,
    petLength: 3,
    windowScale: 0.85,
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
};

// ---------------------------------------------------------------- zones

export type Zone = {
  name: string;
  emoji: string;
  start: number;
  end: number;
};

export const ZONES: Zone[] = [
  { name: "Asteroid Field", emoji: "🌌", start: 0, end: 90_000 },
  { name: "Meteor Storm", emoji: "☄️", start: 90_000, end: 180_000 },
  { name: "Space Goo Cloud", emoji: "👾", start: 180_000, end: 270_000 },
  { name: "Rescue Station", emoji: "🏠", start: 270_000, end: 300_000 },
];
export const RUN_MS = 300_000;
export const START_PAUSE_MS = 3000;

export function zoneAt(t: number): Zone {
  return (
    ZONES.find((z) => t >= z.start && t < z.end) ??
    (ZONES[ZONES.length - 1] as Zone)
  );
}

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

function pickWords(rng: () => number, words: string[], count: number): string {
  const out: string[] = [];
  for (let tries = 0; out.length < count && tries < 50; tries++) {
    const w = words[Math.floor(rng() * words.length)] ?? "go";
    if (!out.includes(w) || tries > 30) out.push(w);
  }
  return out.join(" ");
}

// ---------------------------------------------------------------- tasks

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

export type TaskKind = "hazard" | "charge" | "break" | "pet" | "hands";

export type Task = {
  id: string;
  kind: TaskKind;
  /** the station that does it ("hands" = everyone) */
  station: Station | "all";
  at: number;
  /** ms to finish it (breaks: until the end of the run) */
  window: number;
  word: string;
  part?: Part;
  pet?: PetKind;
  /** the last all-hands call at the Rescue Station: bonus pets */
  dock?: boolean;
};

/** Every task in the run - the same for everyone with this seed. */
export function shipTasks(seed: number, d: ShipDifficulty): Task[] {
  const tasks: Task[] = [];
  const rng = seededRandom(seed ^ 0x51ab);
  const w = (ms: number): number => Math.round(ms * d.windowScale);
  const flyZones = ZONES.slice(0, 3);

  // pilot: asteroids, faster each zone
  let n = 0;
  flyZones.forEach((z, zi) => {
    const every = [7000, 6000, 5000][zi] as number;
    for (let t = z.start + 2500; t < z.end - 2000; t += every) {
      tasks.push({
        id: `p${n++}`,
        kind: "hazard",
        station: "pilot",
        at: t + Math.round(rng() * 1500),
        window: w(5000),
        word: pickWords(rng, PILOT_WORDS, 1),
      });
    }
  });

  // shields: a charge word every 4s, all run long
  n = 0;
  for (let t = 1500; t < (ZONES[2]?.end ?? 0); t += 4000) {
    tasks.push({
      id: `s${n++}`,
      kind: "charge",
      station: "shields",
      at: t,
      window: 4000,
      word: pickWords(rng, d.words, 1),
    });
  }

  // engineer: parts break, more in the storm
  n = 0;
  const parts: Part[] = ["engine", "lights", "leak"];
  flyZones.forEach((z, zi) => {
    const count = [2, 5, 4][zi] as number;
    const slot = (z.end - z.start - 10_000) / count;
    for (let i = 0; i < count; i++) {
      tasks.push({
        id: `e${n}`,
        kind: "break",
        station: "engineer",
        at: z.start + 6000 + Math.round(slot * i + rng() * slot * 0.6),
        window: RUN_MS,
        word: pickWords(rng, d.repairWords, d.repairLength),
        part: parts[(n + Math.floor(rng() * 3)) % 3] as Part,
      });
      n++;
    }
  });

  // rescuer: stranded pets
  n = 0;
  flyZones.forEach((z, zi) => {
    const every = [14_000, 12_000, 11_000][zi] as number;
    for (let t = z.start + 5000; t < z.end - 6000; t += every) {
      const pet = PET_KINDS[Math.floor(rng() * PET_KINDS.length)] as PetKind;
      const adjectives = pickWords(rng, PET_ADJECTIVES, d.petLength - 1);
      tasks.push({
        id: `r${n++}`,
        kind: "pet",
        station: "rescuer",
        at: t + Math.round(rng() * 2000),
        window: w(9000),
        word: `${adjectives} ${pet}`,
        pet,
      });
    }
  });

  // all hands: one near the end of each zone, then the dock call
  [84_000, 172_000, 262_000].forEach((t, i) => {
    tasks.push({
      id: `a${i}`,
      kind: "hands",
      station: "all",
      at: t,
      window: w(7000),
      word: pickWords(rng, d.words, d.label === "Easy" ? 1 : 2),
    });
  });
  tasks.push({
    id: "a3",
    kind: "hands",
    station: "all",
    at: (ZONES[3]?.start ?? 0) + 4000,
    window: w(18_000),
    word: pickWords(rng, d.words, 3),
    dock: true,
  });

  return tasks.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------- facts

export type ShipFacts = {
  /** ms since the start (server time) */
  startAt: number;
  /** taskId -> who finished it and when (absolute time) */
  done: Record<string, { by: string; at: number }>;
  /** all-hands taskId -> uid -> when */
  hands: Record<string, Record<string, number>>;
};

export const START_HP = 10;
const SHIELD_MAX = 100;
const SHIELD_DRAIN_PER_S = 2.0;
const SHIELD_CHARGE = 22;
const SHIELD_BLOCK_COST = 35;
const LEAK_EVERY_MS = 10_000;
const ENGINE_PET_WINDOW = 0.65;
export const DOCK_BONUS_PETS = 3;
/** missed this many in a row: a helper takes over that station */
const AWAY_AFTER: Record<Station, number> = {
  pilot: 4,
  shields: 6,
  engineer: 2,
  rescuer: 3,
};
/** an unfixed break counts as missed after this long */
const BREAK_MISS_MS = 25_000;

/** When a computer helper finishes a task (or undefined: it doesn't). */
function helperDoneAt(
  seed: number,
  task: Task,
  autopilot = false,
): number | undefined {
  const rng = seededRandom(seed ^ hashString(task.id));
  if (task.kind === "break") {
    return task.at + (autopilot ? 9000 : 5000) + rng() * 5000;
  }
  const chance = task.kind === "charge" ? 0.5 : 0.8;
  // the auto-pilot that covers for an idle player is not as good
  if (rng() > (autopilot ? chance * 0.55 : chance)) return undefined;
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
    | "dock";
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
};

export type ShipView = {
  /** ms since the start */
  t: number;
  zone: Zone;
  hp: number;
  shield: number;
  pets: number;
  petKinds: PetKind[];
  broken: Part[];
  over: boolean;
  /** why it ended */
  reason?: "home" | "wrecked";
  /** tasks open right now */
  open: Task[];
  /** stations a helper has taken over */
  away: Set<Station>;
  events: ShipEvent[];
  /** by uid (helpers under "helper") */
  stats: Record<string, CrewStats>;
};

const emptyStats = (): CrewStats => ({
  dodges: 0,
  charges: 0,
  fixes: 0,
  rescues: 0,
  hands: 0,
});

/** The ship as it is `now` (absolute time). */
export function shipView(
  setup: ShipSetup,
  tasks: Task[],
  facts: ShipFacts,
  now: number,
): ShipView {
  const t = Math.min(RUN_MS, Math.max(0, now - facts.startAt));
  const humanOf = (station: Station): string | null =>
    setup.crew.find((c) => c.station === station)?.uid ?? null;

  // ---- who finishes what, when (relative ms), with helpers filling in
  const away = new Set<Station>();
  const awayFrom: Partial<Record<Station, number>> = {};
  const misses: Record<Station, number> = {
    pilot: 0,
    shields: 0,
    engineer: 0,
    rescuer: 0,
  };
  const finish = new Map<string, { at: number; by: string }>();

  // breaks first: the engine being broken shortens pet windows
  const fixedAt = new Map<string, number>();
  const ordered = [...tasks];
  for (const task of ordered) {
    if (task.kind === "hands") continue;
    const station = task.station as Station;
    const human = humanOf(station);
    const fact = facts.done[task.id];
    const playerAt = fact === undefined ? undefined : fact.at - facts.startAt;
    let window = task.window;
    if (task.kind === "pet" && engineBrokenAt(task.at, tasks, fixedAt)) {
      window = Math.round(window * ENGINE_PET_WINDOW);
    }
    // only what has happened by now counts
    const inTime = (at: number | undefined): at is number =>
      at !== undefined && at >= task.at && at <= task.at + window && at <= t;
    const helperOn =
      human === null ||
      (awayFrom[station] !== undefined && task.at >= (awayFrom[station] ?? 0));
    // a break nobody fixes for a while gets fixed by a helper anyway
    const helperAt = helperOn
      ? helperDoneAt(setup.seed, task, human !== null)
      : task.kind === "break"
        ? task.at + BREAK_MISS_MS + 2000
        : undefined;
    let done: { at: number; by: string } | undefined;
    if (inTime(playerAt) && fact !== undefined) {
      done = { at: playerAt, by: fact.by };
      // typing again takes the station back from the helper
      if (helperOn && human !== null && awayFrom[station] !== undefined) {
        awayFrom[station] = undefined;
        away.delete(station);
        misses[station] = 0;
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
    if (human !== null && !helperOn) {
      const missDeadline =
        task.kind === "break" ? task.at + BREAK_MISS_MS : task.at + window;
      const missed =
        done === undefined
          ? missDeadline <= t
          : task.kind === "break" && done.at > task.at + BREAK_MISS_MS;
      if (done !== undefined && !missed) {
        misses[station] = 0;
      } else if (missed) {
        misses[station]++;
        if (misses[station] >= AWAY_AFTER[station]) {
          away.add(station);
          awayFrom[station] = missDeadline;
        }
      }
    }
  }

  // ---- play the run forward to t
  const events: ShipEvent[] = [];
  for (const task of tasks) {
    const done = finish.get(task.id);
    if (task.kind === "hazard") {
      if (done !== undefined) {
        events.push({
          t: done.at,
          kind: "dodge",
          by: done.by,
          taskId: task.id,
        });
      } else {
        events.push({
          t: task.at + task.window,
          kind: "bump",
          taskId: task.id,
        });
      }
    } else if (task.kind === "charge") {
      if (done !== undefined) {
        events.push({
          t: done.at,
          kind: "charge",
          by: done.by,
          taskId: task.id,
        });
      }
    } else if (task.kind === "break") {
      events.push({ t: task.at, kind: "break", taskId: task.id });
      const end = done?.at ?? RUN_MS;
      if (done !== undefined) {
        events.push({ t: done.at, kind: "fix", by: done.by, taskId: task.id });
      }
      if (task.part === "leak") {
        for (let lt = task.at + LEAK_EVERY_MS; lt < end; lt += LEAK_EVERY_MS) {
          events.push({ t: lt, kind: "leak", taskId: task.id });
        }
      }
    } else if (task.kind === "pet") {
      const window = engineBrokenAt(task.at, tasks, fixedAt)
        ? Math.round(task.window * ENGINE_PET_WINDOW)
        : task.window;
      if (done !== undefined) {
        events.push({
          t: done.at,
          kind: "rescue",
          by: done.by,
          taskId: task.id,
        });
      } else {
        events.push({ t: task.at + window, kind: "petLost", taskId: task.id });
      }
    } else {
      // all hands: every player still at their station must type it
      const needed = setup.crew
        .filter((c) => c.uid !== null && !away.has(c.station))
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
  events.sort((a, b) => a.t - b.t);

  let hp = START_HP;
  let shield = SHIELD_MAX;
  let pets = 0;
  const petKinds: PetKind[] = [];
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
    shield = Math.max(0, shield - ((e.t - last) / 1000) * SHIELD_DRAIN_PER_S);
    last = e.t;
    const task = tasks.find((x) => x.id === e.taskId);
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
      case "fix":
        stat(e.by).fixes++;
        break;
      case "leak":
        hp -= 1;
        break;
      case "rescue":
        pets++;
        if (task?.pet !== undefined) petKinds.push(task.pet);
        stat(e.by).rescues++;
        break;
      case "hands":
        if (e.by !== undefined) stat(e.by).hands++;
        break;
      case "handsMiss":
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
    shield = Math.max(0, shield - ((t - last) / 1000) * SHIELD_DRAIN_PER_S);
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
    if (x.kind === "hands") {
      return now_ <= x.at + x.window;
    }
    const window =
      x.kind === "pet" && engineBrokenAt(x.at, tasks, fixedAt)
        ? Math.round(x.window * ENGINE_PET_WINDOW)
        : x.window;
    return now_ <= x.at + window;
  });

  const over = wreckedAt !== undefined || t >= RUN_MS || dockDone(played);
  return {
    t: now_,
    zone: zoneAt(now_),
    hp,
    shield: Math.round(shield),
    pets,
    petKinds,
    broken: [...new Set(broken)],
    over,
    ...(over ? { reason: wreckedAt !== undefined ? "wrecked" : "home" } : {}),
    open,
    away,
    events: played,
    stats,
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
  return Math.round(
    v.pets * 6 +
      v.hp * 2 +
      (v.reason === "home" ? 30 : 0) +
      input.mine.dodges * 2 +
      input.mine.charges +
      input.mine.fixes * 4 +
      input.mine.rescues * 3 +
      input.mine.hands * 2,
  );
}

export function shipStars(v: ShipView): number {
  if (v.reason !== "home") return 1;
  if (v.pets >= 20 && v.hp >= 6) return 3;
  return v.pets >= 15 ? 2 : 1;
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
    award("⚡", "Crew calls", (s) => s.hands),
  ].filter((a): a is ShipAward => a !== null);
}
