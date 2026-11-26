import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { ZooHabitat, ZOO_INFO, ZooSpecies } from "../zoo-animals";
import { ZooAction } from "../ZooAnimal";
import { ZooAnimalLook } from "../ZooMap";
import { AnimalRig, buildAnimal, setExpression } from "./animals3d";
import {
  box,
  canvasTexture,
  cssColor,
  cylinder,
  flat,
  gameColor,
  part,
  sphere,
  toon,
} from "./toon";

/**
 * One 3D zoo animal living in its pen: the pen, the animal, its props
 * (bowl, bubbles, ball...) and its behaviour. Shared by the My Zoo scene and
 * the Zoo Keeper game.
 */

/** World size of the map (x across, z front-to-back); pct maps onto it. */
export const MAP_W = 16;
export const MAP_D = 10;
export const PEN_W = (17 / 100) * MAP_W;
export const PEN_D = (27 / 100) * MAP_D;
/** animals are modelled ~1 unit tall; this makes them fill their pens */
const ANIMAL_SCALE = 1.6;
/** how far an animal may wander from its pen's centre */
const ROAM_X = PEN_W / 2 - 0.65;
const ROAM_Z = PEN_D / 2 - 0.6;

const GROUND: Record<ZooHabitat, string> = {
  grass: "grass",
  farm: "tan",
  jungle: "frog",
  savanna: "sunset",
  ice: "mint",
};

export type Actor = {
  species: ZooSpecies;
  rig: AnimalRig;
  pen: THREE.Group;
  shadow: THREE.Mesh;
  bubble: THREE.Sprite;
  zzz: THREE.Sprite;
  bowl: THREE.Group;
  goldBowl: THREE.Group;
  suds: THREE.Group;
  ball: THREE.Mesh;
  bandage: THREE.Mesh;
  x: number;
  z: number;
  tx: number;
  tz: number;
  face: number;
  mode: "idle" | "walk" | "hop" | "look";
  until: number;
  trick?: ZooAction;
  trickUntil: number;
  hopStart: number;
  seed: number;
  /** resting height of the body (it bobs while walking) */
  bodyY: number;
};

function sprite(
  key: string,
  draw: (ctx: CanvasRenderingContext2D) => void,
  size: number,
): THREE.Sprite {
  const map = canvasTexture(key, 128, 128, draw);
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map, depthTest: false, transparent: true }),
  );
  s.scale.setScalar(size);
  s.renderOrder = 10;
  return s;
}

const bubbleSprite = (): THREE.Sprite =>
  sprite(
    "zoo-hungry",
    (ctx) => {
      ctx.fillStyle = cssColor("cloud");
      ctx.beginPath();
      ctx.arc(64, 56, 46, 0, Math.PI * 2);
      ctx.moveTo(52, 96);
      ctx.lineTo(64, 122);
      ctx.lineTo(76, 96);
      ctx.fill();
      // carrot
      ctx.fillStyle = cssColor("orange");
      ctx.beginPath();
      ctx.moveTo(40, 40);
      ctx.lineTo(88, 62);
      ctx.lineTo(48, 82);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = cssColor("green");
      ctx.beginPath();
      ctx.ellipse(36, 36, 14, 6, -0.7, 0, Math.PI * 2);
      ctx.fill();
    },
    1.05,
  );

const zzzSprite = (): THREE.Sprite =>
  sprite(
    "zoo-zzz",
    (ctx) => {
      ctx.fillStyle = cssColor("navy");
      ctx.font = "bold 56px sans-serif";
      ctx.fillText("z", 20, 110);
      ctx.font = "bold 42px sans-serif";
      ctx.fillText("z", 60, 70);
      ctx.font = "bold 30px sans-serif";
      ctx.fillText("z", 92, 36);
    },
    1,
  );

export const heartSprite = (): THREE.Sprite =>
  sprite(
    "zoo-heart",
    (ctx) => {
      ctx.fillStyle = cssColor("pink");
      ctx.beginPath();
      ctx.moveTo(64, 112);
      ctx.bezierCurveTo(-10, 60, 30, 0, 64, 38);
      ctx.bezierCurveTo(98, 0, 138, 60, 64, 112);
      ctx.fill();
    },
    0.65,
  );

function nameSign(name: string): THREE.Mesh {
  const map = canvasTexture(`sign-${name}`, 256, 64, (ctx) => {
    ctx.fillStyle = cssColor("brown");
    ctx.beginPath();
    ctx.roundRect(0, 0, 256, 64, 14);
    ctx.fill();
    ctx.fillStyle = cssColor("cream");
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 128, 34);
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.28),
    new THREE.MeshBasicMaterial({ map, transparent: true }),
  );
  return m;
}

const fenceCache = new Map<number, THREE.BufferGeometry>();
/** Every post and rail of a pen fence merged into one geometry. */
function fenceGeometry(grow: number): THREE.BufferGeometry {
  const hit = fenceCache.get(grow);
  if (hit !== undefined) return hit;
  const hw = PEN_W / 2;
  const hd = PEN_D / 2;
  const pieces: THREE.BufferGeometry[] = [];
  const add = (
    g: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
  ): void => {
    pieces.push(g.clone().translate(x, y, z));
  };
  const posts: [number, number][] = [];
  for (let x = -hw; x <= hw + 0.01; x += PEN_W / 5) {
    posts.push([x, -hd], [x, hd]);
  }
  for (let z = -hd + PEN_D / 4; z < hd - 0.01; z += PEN_D / 4) {
    posts.push([-hw, z], [hw, z]);
  }
  const post = new THREE.CylinderGeometry(
    0.05 + grow,
    0.05 + grow,
    0.42 + grow * 2,
    8,
  );
  for (const [x, z] of posts) add(post, x, 0.24, z);
  const rail = (
    w: number,
    d: number,
    x: number,
    y: number,
    z: number,
  ): void => {
    add(
      new THREE.BoxGeometry(w + grow * 2, 0.05 + grow * 2, d + grow * 2),
      x,
      y,
      z,
    );
  };
  for (const y of [0.22, 0.38]) {
    rail(PEN_W, 0.04, 0, y, -hd);
    rail(0.04, PEN_D, -hw, y, 0);
    rail(0.04, PEN_D, hw, y, 0);
  }
  rail(PEN_W, 0.04, 0, 0.18, hd);
  const merged = mergeGeometries(
    pieces.map((p) => (p.index === null ? p : p.toNonIndexed())),
  );
  fenceCache.set(grow, merged);
  return merged;
}

let outlineMaterial: THREE.MeshBasicMaterial | undefined;
const outlineMat = (): THREE.MeshBasicMaterial =>
  (outlineMaterial ??= new THREE.MeshBasicMaterial({
    color: gameColor("ink"),
    side: THREE.BackSide,
  }));

export function buildPen(
  species: ZooSpecies,
  opts: { sign?: boolean } = {},
): THREE.Group {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(
    box(PEN_W, 0.06, PEN_D),
    toon(GROUND[ZOO_INFO[species].habitat]),
  );
  floor.position.y = 0.03;
  floor.userData["pen"] = species;
  g.add(floor);
  const hd = PEN_D / 2;
  // one merged mesh (+ one outline) per pen instead of ~60 pieces
  const fence = new THREE.Mesh(fenceGeometry(0), toon("brown"));
  const fenceOutline = new THREE.Mesh(fenceGeometry(0.014), outlineMat());
  fenceOutline.raycast = () => undefined;
  g.add(fence, fenceOutline);
  if (opts.sign !== false) {
    const sign = nameSign(ZOO_INFO[species].name);
    sign.position.set(0, 0.32, hd + 0.04);
    g.add(sign);
  }
  return g;
}

function foodBowl(color: string): THREE.Group {
  const g = new THREE.Group();
  g.add(part(cylinder(0.16, 0.1, 0.2), "brown", { outline: 0.012 }));
  const food = flat(sphere(0.15), color);
  food.scale.set(1, 0.35, 1);
  food.position.y = 0.06;
  g.add(food);
  return g;
}

const DIET_COLOR = {
  veg: "orange",
  seed: "yellow",
  fruit: "yellow",
  leaf: "green",
  meat: "red",
  fish: "blue",
} as const;

/** A new animal in its own pen (at the origin; the caller places the pen). */
export function createActor(
  species: ZooSpecies,
  i: number,
  opts: { sign?: boolean } = {},
): Actor {
  const now = performance.now() / 1000;
  const pen = buildPen(species, opts);
  const rig = buildAnimal(species);
  rig.root.scale.setScalar(ANIMAL_SCALE);
  rig.height *= ANIMAL_SCALE;
  rig.root.traverse((o) => (o.userData["actor"] = species));
  pen.add(rig.root);
  const shadow = flat(new THREE.CircleGeometry(0.62, 20), "ink", 0.22);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.07;
  pen.add(shadow);
  const bubble = bubbleSprite();
  bubble.visible = false;
  pen.add(bubble);
  const zzz = zzzSprite();
  zzz.visible = false;
  pen.add(zzz);
  const bowl = foodBowl(DIET_COLOR[ZOO_INFO[species].diet]);
  bowl.visible = false;
  pen.add(bowl);
  const goldBowl = new THREE.Group();
  goldBowl.add(part(cylinder(0.16, 0.1, 0.2), "gold", { outline: 0.012 }));
  goldBowl.position.set(-PEN_W / 2 + 0.35, 0.1, PEN_D / 2 - 0.35);
  pen.add(goldBowl);
  const suds = new THREE.Group();
  for (let k = 0; k < 7; k++) {
    const b = flat(sphere(0.13 + (k % 3) * 0.05), "cloud", 0.85);
    suds.add(b);
  }
  suds.visible = false;
  pen.add(suds);
  const ball = part(sphere(0.2), "red", { outline: 0.015 });
  ball.visible = false;
  pen.add(ball);
  const bandage = part(box(0.45, 0.13, 0.06), "tan", { outline: 0.012 });
  bandage.visible = false;
  pen.add(bandage);
  return {
    species,
    rig,
    pen,
    shadow,
    bubble,
    zzz,
    bowl,
    goldBowl,
    suds,
    ball,
    bandage,
    x: 0,
    z: 0,
    tx: 0,
    tz: 0,
    face: 0,
    mode: "idle",
    until: now + 0.5 + ((i * 0.73) % 2),
    trickUntil: 0,
    hopStart: 0,
    seed: i * 1.7,
    bodyY: rig.body.position.y,
  };
}

function decide(a: Actor, t: number): void {
  const r = Math.random();
  if (r < 0.55) {
    a.mode = "walk";
    a.tx = (Math.random() * 2 - 1) * ROAM_X;
    a.tz = (Math.random() * 2 - 1) * ROAM_Z;
    a.until = t + 8;
  } else if (r < 0.72) {
    a.mode = "hop";
    a.hopStart = t;
    a.until = t + 1.2;
  } else if (r < 0.87) {
    a.mode = "look";
    a.until = t + 1.5 + Math.random() * 1.5;
  } else {
    a.mode = "idle";
    a.until = t + 1.5 + Math.random() * 2.5;
  }
}

/** Move and animate one animal for this frame. */
export function updateActor(
  a: Actor,
  look: ZooAnimalLook,
  t: number,
  dt: number,
  opts: { editing: boolean; goldenBowls: boolean },
): void {
  const free = (l: ZooAnimalLook): boolean =>
    !opts.editing && l.action === undefined && l.mood === "happy";
  const trick = t < a.trickUntil ? a.trick : undefined;
  const action = look.action ?? trick;
  const canRoam = free(look) && trick === undefined;
  const rig = a.rig;

  if (canRoam && t > a.until) decide(a, t);
  if (!canRoam && a.mode === "walk") a.mode = "idle";

  let walking = false;
  let hopY = 0;
  if (canRoam && a.mode === "walk") {
    const dx = a.tx - a.x;
    const dz = a.tz - a.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) {
      a.mode = "idle";
      a.until = t + 1 + Math.random() * 2.5;
    } else {
      const step = Math.min(dist, 0.75 * dt);
      a.x += (dx / dist) * step;
      a.z += (dz / dist) * step;
      const want = Math.atan2(dx, dz);
      let diff = want - a.face;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      a.face += diff * Math.min(1, dt * 8);
      walking = true;
    }
  } else {
    // stand facing the camera (slightly turned) when not walking
    const want = a.mode === "look" ? Math.sin(t * 1.3 + a.seed) * 0.9 : 0.35;
    a.face += (want - a.face) * Math.min(1, dt * 3);
  }
  const hopping =
    (canRoam && a.mode === "hop") ||
    action === "cheer" ||
    action === "play" ||
    action === "heal";
  if (hopping) {
    const p = ((t - (a.mode === "hop" ? a.hopStart : 0)) * 2.4) % 1;
    hopY = Math.sin(p * Math.PI) * 0.4;
  }

  rig.root.position.set(a.x, hopY, a.z);
  rig.root.rotation.y = a.face;
  a.shadow.position.set(a.x, 0.07, a.z);
  a.shadow.scale.setScalar(1 - hopY * 0.8);

  // legs, body bob, tail, head, wings
  const swing = walking ? Math.sin(t * 13) * 0.55 : 0;
  rig.legs.forEach((l, i) => {
    const phase = rig.legs.length === 4 ? (i < 2 ? 1 : -1) : i === 0 ? 1 : -1;
    l.rotation.x = swing * phase;
  });
  rig.body.scale.y = 1 + Math.sin(t * 2.2 + a.seed) * 0.02;
  rig.body.position.y =
    a.bodyY + (walking ? Math.abs(Math.sin(t * 13)) * 0.04 : 0);
  if (rig.tail !== undefined) {
    rig.tail.rotation.y = Math.sin(t * 6 + a.seed) * 0.5;
  }
  const eating = action === "eat" || action === "drink";
  rig.head.rotation.x = eating
    ? 0.35 + Math.sin(t * 10) * 0.2
    : look.mood === "sad" || look.mood === "sleepy"
      ? 0.25
      : 0;
  rig.head.rotation.y =
    !walking && canRoam ? Math.sin(t * 0.8 + a.seed) * 0.3 : 0;
  const flap = hopping || action === "wash";
  rig.wings.forEach((w, i) => {
    const s = i === 0 ? 1 : -1;
    w.rotation.z = flap
      ? s * (0.4 + Math.sin(t * 22) * 0.45)
      : s * Math.sin(t * 1.5) * 0.05;
  });
  rig.root.rotation.z = action === "wash" ? Math.sin(t * 16) * 0.08 : 0;

  setExpression(rig.face, action !== undefined ? "happy" : look.mood, action);
  rig.mud.visible = look.dirty === true && action !== "wash";

  // props around the animal
  const headY = rig.height + hopY;
  a.bubble.visible = look.bubble !== undefined && action === undefined;
  a.bubble.position.set(a.x + 0.45, headY + 0.55 + Math.sin(t * 3) * 0.06, a.z);
  a.zzz.visible = look.mood === "sleepy" || action === "sleep";
  a.zzz.position.set(a.x + 0.5, headY + 0.35 + ((t * 0.4) % 0.3), a.z);
  a.bowl.visible = eating;
  a.bowl.position.set(a.x, 0.1, a.z + 0.85);
  a.goldBowl.visible = opts.goldenBowls;
  a.suds.visible = action === "wash";
  if (a.suds.visible) {
    a.suds.children.forEach((b, k) => {
      const ang = t * 1.5 + (k / a.suds.children.length) * Math.PI * 2;
      b.position.set(
        a.x + Math.cos(ang) * 0.75,
        0.4 + ((t * 0.5 + k * 0.15) % 1.2),
        a.z + Math.sin(ang) * 0.55,
      );
    });
  }
  a.ball.visible = action === "play";
  a.ball.position.set(
    a.x + 0.8,
    0.18 + Math.abs(Math.sin(t * 6)) * 0.45,
    a.z + 0.45,
  );
  a.bandage.visible = action === "heal";
  a.bandage.position.set(a.x, headY - 0.2, a.z + 0.5);
}
