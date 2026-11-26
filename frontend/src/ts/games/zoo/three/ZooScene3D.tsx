import { createEffect, JSXElement, on, onCleanup, onMount } from "solid-js";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { cn } from "../../../utils/cn";
import { sfx } from "../../mini/mini-sounds";
import { ZooHabitat, ZOO_INFO, ZooSpecies } from "../zoo-animals";
import { ZooDecorId } from "../zoo-decor";
import { ZooPenPosition } from "../zoo-state";
import { ZooAction } from "../ZooAnimal";
import { defaultDecorSpot, defaultPenSpot, ZooAnimalLook } from "../ZooMap";
import { AnimalRig, buildAnimal, setExpression } from "./animals3d";
import { buildDecor, Decor3D } from "./decor3d";
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

/** World size of the map (x across, z front-to-back); pct maps onto it. */
const W = 16;
const D = 10;
const PEN_W = (17 / 100) * W;
const PEN_D = (27 / 100) * D;
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

const toWorld = (p: ZooPenPosition): { x: number; z: number } => ({
  x: (p.xPct / 100 - 0.5) * W,
  z: (p.yPct / 100 - 0.5) * D,
});
const toPct = (x: number, z: number): ZooPenPosition => ({
  xPct: (x / W + 0.5) * 100,
  yPct: (z / D + 0.5) * 100,
});

type ItemId = ZooSpecies | ZooDecorId;

type Actor = {
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

type Placed = { id: ItemId; group: THREE.Group; w: number; d: number };

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

const heartSprite = (): THREE.Sprite =>
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

function buildPen(species: ZooSpecies): THREE.Group {
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
  const sign = nameSign(ZOO_INFO[species].name);
  sign.position.set(0, 0.32, hd + 0.04);
  g.add(sign);
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

/**
 * The 3D zoo: same props as the 2D ZooMap (positions are stored the same
 * way), drawn with three.js. `active` pauses rendering when hidden.
 */
export default function ZooScene3D(props: {
  animals: ZooSpecies[];
  decor?: ZooDecorId[];
  layout: Partial<Record<ItemId, ZooPenPosition>>;
  look: (species: ZooSpecies) => ZooAnimalLook;
  editing: boolean;
  goldenBowls?: boolean;
  active: boolean;
  onMove?: (id: ItemId, pos: ZooPenPosition) => void;
}): JSXElement {
  let host: HTMLDivElement | undefined;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = gameColor("sky");
  const camera = new THREE.PerspectiveCamera(30, 16 / 10, 0.1, 100);
  camera.position.set(0, 16.5, 14.6);
  camera.lookAt(0, 0, 0.35);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7a9a66, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(-6, 12, 8);
  scene.add(sun);

  // ground and paths
  const ground = new THREE.Mesh(box(W + 8, 0.2, D + 6), toon("grass-dark"));
  ground.position.y = -0.1;
  scene.add(ground);
  const path = (w: number, d: number, x: number, z: number): void => {
    const p = new THREE.Mesh(box(w, 0.02, d), toon("tan"));
    p.position.set(x, 0.01, z);
    scene.add(p);
  };
  path(W + 8, 0.45, 0, toWorld({ xPct: 50, yPct: 36 }).z);
  path(W + 8, 0.45, 0, toWorld({ xPct: 50, yPct: 67 }).z);
  path(0.45, D + 6, toWorld({ xPct: 50, yPct: 50 }).x, 0);

  // drifting clouds and two butterflies, just for life
  const clouds: THREE.Group[] = [0, 1, 2].map((i) => {
    const c = new THREE.Group();
    for (const [x, y, r] of [
      [0, 0, 0.6],
      [0.6, -0.1, 0.45],
      [-0.6, -0.1, 0.45],
    ] as const) {
      const puff = flat(sphere(r), "cloud", 0.9);
      puff.position.set(x, y, 0);
      c.add(puff);
    }
    c.position.set(-12 + i * 9, 4 + i * 0.6, -6 - i);
    scene.add(c);
    return c;
  });
  const butterflies = ["pink", "yellow"].map((color) => {
    const b = new THREE.Group();
    const wings = [-1, 1].map((s) => {
      const w = flat(new THREE.CircleGeometry(0.13, 12), color);
      w.position.x = s * 0.12;
      const hinge = new THREE.Group();
      hinge.add(w);
      b.add(hinge);
      return hinge;
    });
    b.userData["wings"] = wings;
    scene.add(b);
    return b;
  });

  let dragging: {
    id: ItemId;
    group: THREE.Group;
    dx: number;
    dz: number;
    half: { w: number; d: number };
  } | null = null;
  let actors: Actor[] = [];
  let placedDecor: (Placed & { decor: Decor3D })[] = [];
  const hearts: {
    sprite: THREE.Sprite;
    born: number;
    x: number;
    y: number;
    z: number;
  }[] = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const spotFor = (
    id: ItemId,
    index: number,
    isDecor: boolean,
  ): ZooPenPosition =>
    props.layout[id] ??
    (isDecor ? defaultDecorSpot(id as ZooDecorId) : defaultPenSpot(index));

  const clearActors = (): void => {
    for (const a of actors) scene.remove(a.pen);
    for (const d of placedDecor) scene.remove(d.group);
    actors = [];
    placedDecor = [];
  };

  const build = (): void => {
    clearActors();
    const now = performance.now() / 1000;
    actors = props.animals.map((species, i) => {
      const pen = buildPen(species);
      const p = toWorld(spotFor(species, i, false));
      pen.position.set(p.x, 0, p.z);
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
    });
    for (const a of actors) scene.add(a.pen);
    placedDecor = (props.decor ?? []).map((id, i) => {
      const decor = buildDecor(id);
      const p = toWorld(spotFor(id, i, true));
      decor.group.position.set(p.x, 0, p.z);
      decor.group.traverse((o) => (o.userData["decor"] = id));
      scene.add(decor.group);
      return { id, group: decor.group, w: 1.4, d: 1.3, decor };
    });
  };

  // rebuild when the animal or decoration list changes; move on layout change
  createEffect(
    on(
      () => `${props.animals.join(",")}|${(props.decor ?? []).join(",")}`,
      build,
    ),
  );
  createEffect(
    on(
      () => props.layout,
      () => {
        actors.forEach((a, i) => {
          if (dragging?.id === a.species) return;
          const p = toWorld(spotFor(a.species, i, false));
          a.pen.position.set(p.x, 0, p.z);
        });
        placedDecor.forEach((d, i) => {
          if (dragging?.id === d.id) return;
          const p = toWorld(spotFor(d.id, i, true));
          d.group.position.set(p.x, 0, p.z);
        });
      },
      { defer: true },
    ),
  );

  // --- behaviour -----------------------------------------------------------
  const free = (a: Actor, look: ZooAnimalLook): boolean =>
    !props.editing && look.action === undefined && look.mood === "happy";

  const decide = (a: Actor, t: number): void => {
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
  };

  const update = (a: Actor, t: number, dt: number): void => {
    const look = props.look(a.species);
    const trick = t < a.trickUntil ? a.trick : undefined;
    const action = look.action ?? trick;
    const canRoam = free(a, look) && trick === undefined;
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
    a.bubble.position.set(
      a.x + 0.45,
      headY + 0.55 + Math.sin(t * 3) * 0.06,
      a.z,
    );
    a.zzz.visible = look.mood === "sleepy" || action === "sleep";
    a.zzz.position.set(a.x + 0.5, headY + 0.35 + ((t * 0.4) % 0.3), a.z);
    a.bowl.visible = eating;
    a.bowl.position.set(a.x, 0.1, a.z + 0.85);
    a.goldBowl.visible = props.goldenBowls === true;
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
  };

  // --- loop ------------------------------------------------------------------
  let raf = 0;
  let last = performance.now();
  const frame = (): void => {
    raf = 0;
    if (!props.active || document.hidden) return;
    const nowMs = performance.now();
    const dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    const t = nowMs / 1000;
    for (const a of actors) update(a, t, dt);
    for (const d of placedDecor) d.decor.update?.(t);
    clouds.forEach((c, i) => {
      c.position.x += dt * (0.25 + i * 0.08);
      if (c.position.x > 13) c.position.x = -13;
    });
    butterflies.forEach((b, i) => {
      const k = t * 0.18 + i * 3;
      b.position.set(
        Math.sin(k) * 6.5,
        1.4 + Math.sin(k * 3) * 0.4,
        Math.sin(k * 0.7 + i) * 3.5,
      );
      b.rotation.y = Math.cos(k) > 0 ? 0.5 : -0.5 + Math.PI;
      const wings = b.userData["wings"] as THREE.Object3D[];
      wings.forEach(
        (w, s) =>
          (w.rotation.y =
            (s === 0 ? 1 : -1) * Math.abs(Math.sin(t * 18)) * 1.1),
      );
    });
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      if (h === undefined) continue;
      const age = t - h.born;
      if (age > 1) {
        scene.remove(h.sprite);
        hearts.splice(i, 1);
        continue;
      }
      h.sprite.position.set(h.x, h.y + age * 0.9, h.z);
      h.sprite.material.opacity = 1 - age;
    }
    renderer.render(scene, camera);
    schedule();
  };
  const schedule = (): void => {
    if (raf === 0) raf = requestAnimationFrame(frame);
  };
  createEffect(() => {
    if (props.active) {
      last = performance.now();
      schedule();
    }
  });
  const onVisibility = (): void => {
    if (!document.hidden) {
      last = performance.now();
      schedule();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  // --- pointer: tap animals, drag pens/decor while editing --------------------
  let downAt = { x: 0, y: 0 };

  const hit = (e: PointerEvent): THREE.Intersection[] => {
    if (host === undefined) return [];
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(scene.children, true);
  };
  const groundPoint = (): THREE.Vector3 | null => {
    const out = new THREE.Vector3();
    return raycaster.ray.intersectPlane(groundPlane, out);
  };

  const onDown = (e: PointerEvent): void => {
    downAt = { x: e.clientX, y: e.clientY };
    if (!props.editing) return;
    const hits = hit(e);
    for (const h of hits) {
      const decorId = h.object.userData["decor"] as ZooDecorId | undefined;
      const pen = (h.object.userData["pen"] ?? h.object.userData["actor"]) as
        | ZooSpecies
        | undefined;
      const id: ItemId | undefined = decorId ?? pen;
      if (id === undefined) continue;
      const group =
        decorId !== undefined
          ? placedDecor.find((d) => d.id === decorId)?.group
          : actors.find((a) => a.species === pen)?.pen;
      const g = groundPoint();
      if (group === undefined || g === null) return;
      renderer.domElement.setPointerCapture(e.pointerId);
      dragging = {
        id,
        group,
        dx: group.position.x - g.x,
        dz: group.position.z - g.z,
        half:
          decorId !== undefined
            ? { w: 0.7, d: 0.65 }
            : { w: PEN_W / 2, d: PEN_D / 2 },
      };
      group.position.y = 0.15;
      return;
    }
  };
  const onMovePointer = (e: PointerEvent): void => {
    if (dragging === null) return;
    hit(e);
    const g = groundPoint();
    if (g === null) return;
    const { half } = dragging;
    dragging.group.position.x = Math.min(
      W / 2 - half.w,
      Math.max(-W / 2 + half.w, g.x + dragging.dx),
    );
    dragging.group.position.z = Math.min(
      D / 2 - half.d,
      Math.max(-D / 2 + half.d, g.z + dragging.dz),
    );
  };
  const onUp = (e: PointerEvent): void => {
    if (dragging !== null) {
      const d = dragging;
      dragging = null;
      d.group.position.y = 0;
      props.onMove?.(d.id, toPct(d.group.position.x, d.group.position.z));
      return;
    }
    // a tap (not a swipe) on an animal: happy hop and a heart
    if (
      props.editing ||
      Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8
    ) {
      return;
    }
    for (const h of hit(e)) {
      const species = h.object.userData["actor"] as ZooSpecies | undefined;
      if (species === undefined) continue;
      const a = actors.find((x) => x.species === species);
      if (a === undefined) return;
      const t = performance.now() / 1000;
      a.trick = "cheer";
      a.trickUntil = t + 1.3;
      const s = heartSprite();
      scene.add(s);
      hearts.push({
        sprite: s,
        born: t,
        x: a.pen.position.x + a.x,
        y: a.rig.height + 0.3,
        z: a.pen.position.z + a.z,
      });
      sfx.pop();
      return;
    }
  };

  if (import.meta.env.DEV) {
    // test hook for checking taps and drags in the dev preview
    (window as unknown as { __zoo3d?: unknown }).__zoo3d = {
      camera,
      canvas: renderer.domElement,
      info: renderer.info,
      actors: () => actors,
      hearts: () => hearts.length,
    };
  }

  onMount(() => {
    if (host === undefined) return;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMovePointer);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);
    const resize = (): void => {
      if (host === undefined) return;
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      schedule();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    onCleanup(() => ro.disconnect());
  });

  onCleanup(() => {
    if (raf !== 0) cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onVisibility);
    clearActors();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  });

  return (
    // plain wrapper: an aspect-ratio box as a grid item collapses its row
    <div class="w-full">
      <div
        ref={(el) => {
          host = el;
        }}
        class={cn(
          "relative aspect-[16/10] w-full overflow-hidden rounded-double bg-game-sky",
          props.editing && "outline-4 outline-game-yellow outline-dashed",
        )}
      ></div>
    </div>
  );
}
