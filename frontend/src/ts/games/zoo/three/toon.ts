import * as THREE from "three";

/**
 * Cartoon look for the 3D zoo: cel-shaded (toon) materials with a black
 * outline (an inverted copy of each mesh, slightly bigger, drawn back-faces
 * only). Colours come from the Tailwind game palette (--color-game-*).
 */

const colorCache = new Map<string, THREE.Color>();

/** A --color-game-<name> palette colour as a three.js colour. */
export function gameColor(name: string): THREE.Color {
  const hit = colorCache.get(name);
  if (hit !== undefined) return hit;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-game-${name}`)
    .trim();
  const c = new THREE.Color(raw === "" ? "#ff00ff" : raw);
  colorCache.set(name, c);
  return c;
}

let gradient: THREE.DataTexture | undefined;
/** 3-step light ramp: dark side, mid, lit (the "toon" bands). */
function toonGradient(): THREE.DataTexture {
  if (gradient !== undefined) return gradient;
  const data = new Uint8Array([
    110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255,
  ]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const materialCache = new Map<string, THREE.MeshToonMaterial>();
export function toon(
  color: string,
  map?: THREE.Texture,
): THREE.MeshToonMaterial {
  const key = map === undefined ? color : `${color}|${map.uuid}`;
  const hit = materialCache.get(key);
  if (hit !== undefined) return hit;
  const m = new THREE.MeshToonMaterial({
    color: map === undefined ? gameColor(color) : 0xffffff,
    gradientMap: toonGradient(),
    ...(map !== undefined ? { map } : {}),
  });
  materialCache.set(key, m);
  return m;
}

let outlineMat: THREE.MeshBasicMaterial | undefined;
function outlineMaterial(): THREE.MeshBasicMaterial {
  outlineMat ??= new THREE.MeshBasicMaterial({
    color: gameColor("ink"),
    side: THREE.BackSide,
  });
  return outlineMat;
}

/** A toon mesh with its black outline. */
export function part(
  geometry: THREE.BufferGeometry,
  color: string,
  opts: { outline?: number; map?: THREE.Texture } = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, toon(color, opts.map));
  const width = opts.outline ?? 0.035;
  if (width > 0) {
    const shell = new THREE.Mesh(geometry, outlineMaterial());
    // grow the shell by a fixed amount in local units
    geometry.computeBoundingSphere();
    const r = geometry.boundingSphere?.radius ?? 1;
    shell.scale.setScalar(1 + width / Math.max(0.05, r));
    shell.raycast = () => undefined;
    mesh.add(shell);
  }
  return mesh;
}

/** Flat, unlit, no-outline mesh (eyes, mouth, glints). */
export function flat(
  geometry: THREE.BufferGeometry,
  color: string,
  opacity = 1,
): THREE.Mesh {
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: gameColor(color),
      transparent: opacity < 1,
      opacity,
    }),
  );
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(
  key: string,
  make: () => THREE.BufferGeometry,
): THREE.BufferGeometry {
  const hit = geoCache.get(key);
  if (hit !== undefined) return hit;
  const g = make();
  geoCache.set(key, g);
  return g;
}
export const sphere = (r = 1): THREE.BufferGeometry =>
  cached(`s${r}`, () => new THREE.SphereGeometry(r, 14, 10));
export const capsule = (r: number, len: number): THREE.BufferGeometry =>
  cached(`c${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 12));
export const cone = (r: number, h: number): THREE.BufferGeometry =>
  cached(`k${r}:${h}`, () => new THREE.ConeGeometry(r, h, 10));
export const cylinder = (
  r: number,
  h: number,
  rTop = r,
): THREE.BufferGeometry =>
  cached(
    `y${r}:${h}:${rTop}`,
    () => new THREE.CylinderGeometry(rTop, r, h, 12),
  );
export const box = (w: number, h: number, d: number): THREE.BufferGeometry =>
  cached(`b${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
export const torusArc = (
  r: number,
  tube: number,
  arc: number,
): THREE.BufferGeometry =>
  cached(
    `t${r}:${tube}:${arc}`,
    () => new THREE.TorusGeometry(r, tube, 8, 20, arc),
  );

const textureCache = new Map<string, THREE.CanvasTexture>();
/** Canvas-drawn texture (stripes, spots, signs), cached by key. */
export function canvasTexture(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const hit = textureCache.get(key);
  if (hit !== undefined) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) draw(ctx);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, t);
  return t;
}

/** CSS colour string for a palette name (for canvas drawing). */
export const cssColor = (name: string): string =>
  `#${gameColor(name).getHexString()}`;
