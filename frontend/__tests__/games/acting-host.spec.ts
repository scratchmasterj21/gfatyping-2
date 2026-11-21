import { describe, expect, it } from "vitest";

import { actingHostUid } from "../../src/ts/games/shared/acting-host";

const p = (uid: string, joinedAt: number, online = true) => ({
  uid,
  joinedAt,
  online,
});

describe("acting host", () => {
  it("is the host while they're online", () => {
    expect(
      actingHostUid({
        hostUid: "h",
        players: { h: p("h", 1), a: p("a", 2) },
      }),
    ).toBe("h");
  });

  it("passes to the earliest-joined online player when the host drops", () => {
    expect(
      actingHostUid({
        hostUid: "h",
        players: { h: p("h", 1, false), b: p("b", 3), a: p("a", 2) },
      }),
    ).toBe("a");
    expect(
      actingHostUid({
        hostUid: "h",
        players: { h: p("h", 1, false), a: p("a", 2, false), b: p("b", 3) },
      }),
    ).toBe("b");
  });

  it("nobody left online: no acting host", () => {
    expect(
      actingHostUid({ hostUid: "h", players: { h: p("h", 1, false) } }),
    ).toBeUndefined();
  });
});
