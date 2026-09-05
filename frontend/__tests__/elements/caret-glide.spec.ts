import { animate } from "animejs";
import { describe, it, expect } from "vitest";

/**
 * Caret.animatePosition snaps left/top to the destination and offsets the
 * caret back with a transform, then animates that transform to zero.
 *
 * anime.js rewrites the whole inline transform string from values it parsed
 * out of it, and it cannot parse translate3d() - it emits a mangled string the
 * browser rejects, which leaves the caret stuck on the last transform it
 * accepted and permanently offset from the letter it should sit on.
 *
 * So the glide offset must be written as translateX()/translateY().
 */
describe("caret glide transform format", () => {
  async function settle(initialTransform: string): Promise<string> {
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.style.transform = initialTransform;
    await animate(el, {
      translateX: [-20, 0],
      translateY: [0, 0],
      duration: 10,
    }).then(() => undefined);
    return el.style.transform;
  }

  it("settles back to a zero offset that the browser will accept", async () => {
    expect(await settle("translateX(-20px) translateY(0px)")).toBe(
      "translateX(0px) translateY(0px)",
    );
  });

  it("documents why translate3d must not be used here", async () => {
    // If this ever stops being true, anime.js learned translate3d and the
    // constraint above can be relaxed.
    expect(await settle("translate3d(-20px, 0px, 0)")).toContain("undefined");
  });
});
