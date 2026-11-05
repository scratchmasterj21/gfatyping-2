import type { Scene } from "phaser";

/**
 * Turns SVG markup into Phaser textures (rendered at 2x for sharp edges).
 * Missing keys only - safe to call on every scene start.
 */
export async function addSvgTextures(
  scene: Scene,
  defs: Record<string, { svg: string; width: number; height: number }>,
): Promise<void> {
  const jobs = Object.entries(defs)
    .filter(([key]) => !scene.textures.exists(key))
    .map(
      async ([key, d]) =>
        new Promise<void>((resolve) => {
          const img = new Image(d.width * 2, d.height * 2);
          img.onload = () => {
            if (!scene.textures.exists(key)) scene.textures.addImage(key, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
            withSize(d.svg, d.width * 2, d.height * 2),
          )}`;
        }),
    );
  await Promise.all(jobs);
}

const withSize = (svg: string, w: number, h: number): string =>
  svg.replace("<svg", `<svg width="${w}" height="${h}"`);

/** Wait (briefly) for the kid font so canvas text doesn't fall back. */
export async function ensureKidFont(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('600 20px "Fredoka"'),
        document.fonts.load('700 20px "Fredoka"'),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    // font unavailable - fallback font is fine
  }
}
