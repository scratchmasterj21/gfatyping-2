import type { DifficultyOption } from "../components/DifficultySegmented";

import { EASY_WORDS, HARD_WORDS, MEDIUM_WORDS } from "../shared/kid-words";

/**
 * Four in a Row: a 7x6 board, red vs yellow. Each column shows a word - type
 * it to drop your piece there. Played in rounds: both players drop one piece
 * per round at the same time, the faster one lands first. Run out of time and
 * you lose that round's piece. First to 4 in a line wins the board; first to
 * 2 boards wins the match. Pure, so solo and online share it.
 */

export type Disc = "r" | "y";
export const COLS = 7;
export const ROWS = 6;
/** Boards needed to win the match (best of 3). */
export const BOARDS_TO_WIN = 2;
/** Drawn boards are replayed, but never more than this many boards. */
export const MAX_BOARDS = 5;
/** Pause between rounds, ms. */
export const ROUND_GAP_MS = 700;
/** Pause showing the finished board before the next one, ms. */
export const BOARD_PAUSE_MS = 3500;
/** Pause before the very first round, ms. */
export const START_PAUSE_MS = 2000;
/** A drop this late after the buzzer still counts (network lag), ms. */
export const LATE_GRACE_MS = 500;

const EMPTY_BOARD = ".".repeat(COLS * ROWS);

export type FourDifficulty = DifficultyOption & {
  /** time to drop a piece each round, ms */
  roundMs: number;
  words: string[];
  /** Tappy's "thinking" time before it starts typing, ms */
  botThinkMs: number;
  /** Tappy's "typing" time per letter, ms */
  botCharMs: number;
  /** chance Tappy plays its best move instead of a random safe one */
  botSmart: number;
};

export const FOUR_DIFFICULTIES: FourDifficulty[] = [
  {
    label: "Easy",
    hint: "short words",
    roundMs: 12000,
    words: EASY_WORDS,
    botThinkMs: 2500,
    botCharMs: 520,
    botSmart: 0.45,
  },
  {
    label: "Medium",
    roundMs: 10000,
    words: MEDIUM_WORDS,
    botThinkMs: 1600,
    botCharMs: 380,
    botSmart: 0.75,
  },
  {
    label: "Hard",
    hint: "long words",
    roundMs: 9000,
    words: HARD_WORDS,
    botThinkMs: 1000,
    botCharMs: 280,
    botSmart: 0.92,
  },
];

export function fourDifficultyFor(label: string): FourDifficulty {
  return (
    FOUR_DIFFICULTIES.find((d) => d.label === label) ??
    (FOUR_DIFFICULTIES[0] as FourDifficulty)
  );
}

export type BoardResult = {
  board: string;
  winner: Disc | "draw";
  /** the four (or more) winning cells; missing for a draw */
  line?: number[];
};

export type FourState = {
  /** increases with every change - keeps online updates in order */
  seq: number;
  /** 1, 2, 3... */
  boardNo: number;
  /** ROWS*COLS chars of ".", "r", "y"; index = row * COLS + col, row 0 = bottom */
  board: string;
  /** word above each column ("" when the column is full) */
  words: string[];
  round: number;
  /** when this round's typing starts (ms, same clock as `now`) */
  roundStartAt: number;
  roundMs: number;
  /** who already dropped this round */
  moved: Record<Disc, boolean>;
  wins: Record<Disc, number>;
  /** pieces each player dropped (for the score) */
  drops: Record<Disc, number>;
  over: boolean;
  matchWinner?: Disc | "draw";
  /** the board that just ended, shown during the pause */
  last?: BoardResult;
  /** the latest piece, for the drop animation */
  lastDrop?: { cell: number; disc: Disc };
};

export const otherDisc = (d: Disc): Disc => (d === "r" ? "y" : "r");
export const cellIndex = (row: number, col: number): number => row * COLS + col;

/** Lowest empty row in a column, or -1 when it's full. */
export function dropRow(board: string, col: number): number {
  for (let row = 0; row < ROWS; row++) {
    if (board[cellIndex(row, col)] === ".") return row;
  }
  return -1;
}

export function dropDisc(board: string, col: number, disc: Disc): string {
  const row = dropRow(board, col);
  if (row < 0) return board;
  const i = cellIndex(row, col);
  return board.slice(0, i) + disc + board.slice(i + 1);
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** A line of 4+ for either player, or null. */
export function findWin(board: string): { disc: Disc; line: number[] } | null {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const disc = board[cellIndex(row, col)];
      if (disc !== "r" && disc !== "y") continue;
      for (const [dr, dc] of DIRECTIONS) {
        const line = [cellIndex(row, col)];
        let r = row + dr;
        let c = col + dc;
        while (
          r >= 0 &&
          r < ROWS &&
          c >= 0 &&
          c < COLS &&
          board[cellIndex(r, c)] === disc
        ) {
          line.push(cellIndex(r, c));
          r += dr;
          c += dc;
        }
        if (line.length >= 4) return { disc, line };
      }
    }
  }
  return null;
}

export const isBoardFull = (board: string): boolean => !board.includes(".");

/**
 * A word for a column, starting with a letter no other column uses, so the
 * first letter typed always picks exactly one column.
 */
export function pickWord(
  pool: string[],
  usedLetters: Set<string>,
  rng: () => number,
  avoid?: string,
): string {
  const fresh = pool.filter(
    (w) => w.length > 0 && !usedLetters.has(w[0] as string) && w !== avoid,
  );
  const source = fresh.length > 0 ? fresh : pool;
  return source[Math.floor(rng() * source.length)] ?? "go";
}

/** Words for every column of a board (empty for full columns). */
export function wordsForBoard(
  board: string,
  pool: string[],
  rng: () => number,
): string[] {
  const words: string[] = [];
  const used = new Set<string>();
  for (let col = 0; col < COLS; col++) {
    if (dropRow(board, col) < 0) {
      words.push("");
      continue;
    }
    const w = pickWord(pool, used, rng);
    used.add(w[0] as string);
    words.push(w);
  }
  return words;
}

/** New word for one column, keeping the first letters unique. */
export function replaceWord(
  words: string[],
  col: number,
  board: string,
  pool: string[],
  rng: () => number,
): string[] {
  const next = [...words];
  if (dropRow(board, col) < 0) {
    next[col] = "";
    return next;
  }
  const used = new Set(
    words
      .filter((w, i) => i !== col && w.length > 0)
      .map((w) => w[0] as string),
  );
  next[col] = pickWord(pool, used, rng, words[col]);
  return next;
}

/** Which column the typed text is heading for (-1 = none). */
export function matchColumn(words: string[], typed: string): number {
  if (typed.length === 0) return -1;
  return words.findIndex((w) => w.length > 0 && w.startsWith(typed));
}

export function newMatch(
  pool: string[],
  roundMs: number,
  now: number,
  rng: () => number,
): FourState {
  return {
    seq: 1,
    boardNo: 1,
    board: EMPTY_BOARD,
    words: wordsForBoard(EMPTY_BOARD, pool, rng),
    round: 1,
    roundStartAt: now + START_PAUSE_MS,
    roundMs,
    moved: { r: false, y: false },
    wins: { r: 0, y: 0 },
    drops: { r: 0, y: 0 },
    over: false,
  };
}

const nextRound = (s: FourState, now: number): FourState => ({
  ...s,
  round: s.round + 1,
  roundStartAt: now + ROUND_GAP_MS,
  moved: { r: false, y: false },
});

function endBoard(
  s: FourState,
  result: BoardResult,
  pool: string[],
  now: number,
  rng: () => number,
): FourState {
  const wins =
    result.winner === "draw"
      ? s.wins
      : { ...s.wins, [result.winner]: s.wins[result.winner] + 1 };
  const decided =
    wins.r >= BOARDS_TO_WIN ||
    wins.y >= BOARDS_TO_WIN ||
    s.boardNo >= MAX_BOARDS;
  const matchWinner: Disc | "draw" | undefined = !decided
    ? undefined
    : wins.r === wins.y
      ? "draw"
      : wins.r > wins.y
        ? "r"
        : "y";
  return {
    ...s,
    boardNo: decided ? s.boardNo : s.boardNo + 1,
    board: decided ? s.board : EMPTY_BOARD,
    words: decided ? s.words : wordsForBoard(EMPTY_BOARD, pool, rng),
    round: 1,
    roundStartAt: now + BOARD_PAUSE_MS,
    moved: { r: false, y: false },
    wins,
    over: decided,
    ...(matchWinner !== undefined ? { matchWinner } : {}),
    last: result,
  };
}

/** Is this round open for typing right now? */
export function roundOpen(s: FourState, now: number): boolean {
  return !s.over && now >= s.roundStartAt && now < s.roundStartAt + s.roundMs;
}

/**
 * A player typed a column's word: drop their piece. Returns null when the
 * drop isn't allowed (already moved, column full, round not open).
 */
export function applyDrop(
  s: FourState,
  disc: Disc,
  col: number,
  pool: string[],
  now: number,
  rng: () => number,
): FourState | null {
  if (s.over || s.moved[disc] || now < s.roundStartAt) return null;
  // a little grace for a word finished right at the buzzer
  if (now > s.roundStartAt + s.roundMs + LATE_GRACE_MS) return null;
  if (col < 0 || col >= COLS || dropRow(s.board, col) < 0) return null;
  const cell = cellIndex(dropRow(s.board, col), col);
  const board = dropDisc(s.board, col, disc);
  const base: FourState = {
    ...s,
    seq: s.seq + 1,
    board,
    drops: { ...s.drops, [disc]: s.drops[disc] + 1 },
    lastDrop: { cell, disc },
  };
  const win = findWin(board);
  if (win !== null) {
    return endBoard(
      base,
      { board, winner: win.disc, line: win.line },
      pool,
      now,
      rng,
    );
  }
  if (isBoardFull(board)) {
    return endBoard(base, { board, winner: "draw" }, pool, now, rng);
  }
  const moved = { ...s.moved, [disc]: true };
  const words = replaceWord(s.words, col, board, pool, rng);
  const next = { ...base, moved, words };
  return moved.r && moved.y ? nextRound(next, now) : next;
}

/** The round's time ran out: whoever didn't drop loses that piece. */
export function applyTimeout(s: FourState, now: number): FourState | null {
  if (s.over || now < s.roundStartAt + s.roundMs) return null;
  return { ...nextRound(s, now), seq: s.seq + 1 };
}

// ---------------- Tappy ----------------

function winningCols(board: string, disc: Disc): number[] {
  const cols: number[] = [];
  for (let col = 0; col < COLS; col++) {
    if (dropRow(board, col) < 0) continue;
    if (findWin(dropDisc(board, col, disc))?.disc === disc) cols.push(col);
  }
  return cols;
}

/**
 * Tappy's column: win if it can, block a win, avoid handing one over, like
 * the middle. With `smart` false it plays any column that doesn't hand over
 * a win (or any open one).
 */
export function botColumn(
  board: string,
  disc: Disc,
  smart: boolean,
  rng: () => number,
): number {
  const open = Array.from({ length: COLS }, (_, c) => c).filter(
    (c) => dropRow(board, c) >= 0,
  );
  if (open.length === 0) return -1;
  const them = otherDisc(disc);
  if (smart) {
    const win = winningCols(board, disc)[0];
    if (win !== undefined) return win;
    const block = winningCols(board, them)[0];
    if (block !== undefined) return block;
  }
  // don't drop where the opponent can win right on top
  const safe = open.filter(
    (c) => winningCols(dropDisc(board, c, disc), them).length === 0,
  );
  const choices = safe.length > 0 ? safe : open;
  if (!smart) return choices[Math.floor(rng() * choices.length)] as number;
  // prefer the middle, a little randomness between equals
  return [...choices].sort(
    (a, b) => Math.abs(a - 3) - Math.abs(b - 3) || rng() - 0.5,
  )[0] as number;
}

/** How long Tappy takes to "type" a word, ms. */
export function botTypingMs(
  d: FourDifficulty,
  word: string,
  rng: () => number,
): number {
  return (
    d.botThinkMs * (0.7 + rng() * 0.6) +
    word.length * d.botCharMs * (0.8 + rng() * 0.5)
  );
}

// ---------------- score ----------------

/** Score for coins and the high-score table. */
export function fourScore(s: FourState, me: Disc): number {
  return (
    s.wins[me] * 30 +
    (s.matchWinner === me ? 30 : 0) +
    Math.min(s.drops[me], 30) * 2
  );
}

/** 3 for a win, 2 for winning a board, 1 for playing. */
export function fourStars(s: FourState, me: Disc): number {
  if (s.matchWinner === me) return 3;
  if (s.wins[me] > 0) return 2;
  return s.drops[me] > 0 ? 1 : 0;
}
