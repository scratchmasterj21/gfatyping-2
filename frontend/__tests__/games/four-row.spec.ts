import { describe, expect, it } from "vitest";

import {
  applyDrop,
  applyTimeout,
  botColumn,
  cellIndex,
  COLS,
  dropDisc,
  dropRow,
  findWin,
  FourState,
  fourScore,
  matchColumn,
  newMatch,
  replaceWord,
  ROWS,
  wordsForBoard,
} from "../../src/ts/games/four-row/four-rules";

const EMPTY = ".".repeat(COLS * ROWS);
const POOL = ["ant", "bat", "cat", "dog", "egg", "fox", "gum", "hat", "ink"];
const rng = (): number => 0.3;

function boardWith(drops: [number, "r" | "y"][]): string {
  let b = EMPTY;
  for (const [col, disc] of drops) b = dropDisc(b, col, disc);
  return b;
}

describe("four in a row board", () => {
  it("stacks pieces from the bottom", () => {
    const b = boardWith([
      [3, "r"],
      [3, "y"],
    ]);
    expect(b[cellIndex(0, 3)]).toBe("r");
    expect(b[cellIndex(1, 3)]).toBe("y");
    expect(dropRow(b, 3)).toBe(2);
  });

  it("knows a full column", () => {
    const b = boardWith(Array.from({ length: ROWS }, () => [0, "r"]));
    expect(dropRow(b, 0)).toBe(-1);
  });

  it("finds wins across, down and on both diagonals", () => {
    expect(
      findWin(
        boardWith([
          [0, "r"],
          [1, "r"],
          [2, "r"],
          [3, "r"],
        ]),
      )?.disc,
    ).toBe("r");
    expect(
      findWin(boardWith(Array.from({ length: 4 }, () => [5, "y"])))?.disc,
    ).toBe("y");
    // diagonal up-right: r at (0,0) (1,1) (2,2) (3,3)
    const diag = boardWith([
      [0, "r"],
      [1, "y"],
      [1, "r"],
      [2, "y"],
      [2, "y"],
      [2, "r"],
      [3, "y"],
      [3, "y"],
      [3, "y"],
      [3, "r"],
    ]);
    expect(findWin(diag)?.disc).toBe("r");
    // diagonal down-right: mirror
    const anti = boardWith([
      [6, "r"],
      [5, "y"],
      [5, "r"],
      [4, "y"],
      [4, "y"],
      [4, "r"],
      [3, "y"],
      [3, "y"],
      [3, "y"],
      [3, "r"],
    ]);
    expect(findWin(anti)?.line).toHaveLength(4);
    expect(
      findWin(
        boardWith([
          [0, "r"],
          [1, "r"],
          [2, "r"],
        ]),
      ),
    ).toBeNull();
  });
});

describe("column words", () => {
  it("gives every open column a word with its own first letter", () => {
    const words = wordsForBoard(EMPTY, POOL, Math.random);
    expect(words).toHaveLength(COLS);
    expect(new Set(words.map((w) => w[0])).size).toBe(COLS);
  });

  it("full columns get no word", () => {
    const b = boardWith(Array.from({ length: ROWS }, () => [2, "r"]));
    expect(wordsForBoard(b, POOL, rng)[2]).toBe("");
    const words = replaceWord(wordsForBoard(EMPTY, POOL, rng), 2, b, POOL, rng);
    expect(words[2]).toBe("");
  });

  it("matches typing to a column by its letters", () => {
    const words = ["ant", "bat", "cat", "", "egg", "fox", "gum"];
    expect(matchColumn(words, "c")).toBe(2);
    expect(matchColumn(words, "ca")).toBe(2);
    expect(matchColumn(words, "cx")).toBe(-1);
    expect(matchColumn(words, "")).toBe(-1);
  });
});

describe("rounds", () => {
  const start = (): FourState => newMatch(POOL, 10000, 0, rng);

  it("no drops before the round starts, one per player per round", () => {
    const s = start();
    expect(applyDrop(s, "r", 3, POOL, 0, rng)).toBeNull();
    const a = applyDrop(s, "r", 3, POOL, s.roundStartAt, rng) as FourState;
    expect(a.moved.r).toBe(true);
    expect(applyDrop(a, "r", 4, POOL, s.roundStartAt, rng)).toBeNull();
    // the other player lands on top in the same column
    const b = applyDrop(a, "y", 3, POOL, s.roundStartAt + 1, rng) as FourState;
    expect(b.board[cellIndex(1, 3)]).toBe("y");
    expect(b.round).toBe(2);
    expect(b.moved).toEqual({ r: false, y: false });
  });

  it("timeout moves on without the slow player's piece", () => {
    const s = start();
    expect(applyTimeout(s, s.roundStartAt + 100)).toBeNull();
    const t = applyTimeout(s, s.roundStartAt + s.roundMs) as FourState;
    expect(t.round).toBe(2);
    expect(t.board).toBe(s.board);
  });

  it("four in a line wins the board, two boards win the match", () => {
    let s = start();
    let now = s.roundStartAt;
    const playBoard = (): void => {
      const board = s.boardNo;
      for (let i = 0; i < 4; i++) {
        s = applyDrop(s, "r", 0, POOL, now, rng) as FourState;
        if (s.boardNo !== board || s.over) break;
        s = applyDrop(s, "y", 6, POOL, now, rng) as FourState;
        now = s.roundStartAt;
      }
      now = s.roundStartAt;
    };
    playBoard();
    expect(s.wins.r).toBe(1);
    expect(s.boardNo).toBe(2);
    expect(s.last?.winner).toBe("r");
    expect(s.over).toBe(false);
    playBoard();
    expect(s.over).toBe(true);
    expect(s.matchWinner).toBe("r");
    expect(fourScore(s, "r")).toBeGreaterThan(fourScore(s, "y"));
  });
});

describe("Tappy", () => {
  it("takes a win, then blocks one", () => {
    const canWin = boardWith([
      [1, "y"],
      [2, "y"],
      [3, "y"],
    ]);
    expect([0, 4]).toContain(botColumn(canWin, "y", true, rng));
    const mustBlock = boardWith([
      [1, "r"],
      [2, "r"],
      [3, "r"],
    ]);
    expect([0, 4]).toContain(botColumn(mustBlock, "y", true, rng));
  });

  it("never plays a full column", () => {
    let b = EMPTY;
    for (let c = 0; c < COLS - 1; c++) {
      for (let r = 0; r < ROWS; r++)
        b = dropDisc(b, c, (r + c) % 2 ? "r" : "y");
    }
    expect(botColumn(b, "y", false, Math.random)).toBe(6);
  });
});
