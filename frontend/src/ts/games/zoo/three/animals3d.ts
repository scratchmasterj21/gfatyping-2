import * as THREE from "three";

import { ZooAction, ZooMood } from "../ZooAnimal";
import { ZooSpecies } from "../zoo-animals";
import {
  box,
  canvasTexture,
  capsule,
  cone,
  cssColor,
  cylinder,
  flat,
  part,
  sphere,
  torusArc,
} from "./toon";

/**
 * 3D toy-style zoo animals built from rounded shapes. Every animal faces +Z
 * (towards the camera) and stands on y = 0. The rig exposes the pieces the
 * scene animates: body (bob), head (look/nibble), legs (walk), wings/arms
 * (flap/wave), tail (wag), face (expressions) and mud (needs a bath).
 */
export type AnimalRig = {
  root: THREE.Group;
  body: THREE.Object3D;
  head: THREE.Object3D;
  legs: THREE.Object3D[];
  wings: THREE.Object3D[];
  tail: THREE.Object3D | undefined;
  face: Face;
  mud: THREE.Object3D;
  /** height of the top of the head (for bubbles and hearts) */
  height: number;
};

type Face = {
  group: THREE.Group;
  eyes: THREE.Object3D[];
  smile: THREE.Object3D;
  frown: THREE.Object3D;
  flatMouth: THREE.Object3D;
  openMouth: THREE.Object3D;
  tear: THREE.Object3D;
  cheeks: THREE.Object3D[];
};

const v = (x: number, y: number, z: number): THREE.Vector3 =>
  new THREE.Vector3(x, y, z);

function at<T extends THREE.Object3D>(
  o: T,
  pos: THREE.Vector3,
  opts: {
    rot?: [number, number, number];
    scale?: [number, number, number];
  } = {},
): T {
  o.position.copy(pos);
  if (opts.rot !== undefined) o.rotation.set(...opts.rot);
  if (opts.scale !== undefined) o.scale.set(...opts.scale);
  return o;
}

const pivot = (pos: THREE.Vector3): THREE.Group => at(new THREE.Group(), pos);

/** A point on the front of a head of radius r, at offsets x/y (in r). */
const onFace = (r: number, x: number, y: number, lift = 0.01): THREE.Vector3 =>
  v(x * r, y * r, Math.sqrt(Math.max(0, 1 - x * x - y * y)) * r + lift);

function makeFace(
  r: number,
  opts: { lightEyes?: boolean; mouthY?: number; noMouth?: boolean } = {},
): Face {
  const g = new THREE.Group();
  const eyes = [-1, 1].map((s) => {
    const eye = new THREE.Group();
    at(eye, onFace(r, s * 0.36, 0.08, 0));
    const ball = flat(
      sphere(r * 0.13),
      opts.lightEyes === true ? "cream" : "ink",
    );
    ball.scale.set(1, 1.15, 0.5);
    const glint = flat(
      sphere(r * 0.045),
      opts.lightEyes === true ? "ink" : "cloud",
    );
    glint.position.set(r * 0.04, r * 0.05, r * 0.06);
    eye.add(ball, glint);
    eye.lookAt(eye.position.clone().multiplyScalar(2));
    g.add(eye);
    return eye;
  });
  const my = opts.mouthY ?? -0.38;
  const mouthPos = onFace(r, 0, my, 0.005);
  const smile = at(
    flat(torusArc(r * 0.16, r * 0.035, Math.PI), "ink"),
    mouthPos,
    {
      rot: [0, 0, Math.PI],
    },
  );
  const frown = at(
    flat(torusArc(r * 0.13, r * 0.035, Math.PI), "ink"),
    mouthPos.clone().add(v(0, -r * 0.08, 0)),
  );
  const flatMouth = at(flat(box(r * 0.2, r * 0.05, r * 0.02), "ink"), mouthPos);
  const openMouth = at(flat(sphere(r * 0.13), "ink"), mouthPos, {
    scale: [1.2, 0.9, 0.3],
  });
  const tongue = at(flat(sphere(r * 0.07), "pink"), v(0, -r * 0.05, r * 0.03));
  openMouth.add(tongue);
  for (const m of [smile, frown, flatMouth, openMouth]) {
    m.visible = false;
    if (opts.noMouth !== true) g.add(m);
  }
  const tear = at(
    flat(sphere(r * 0.06), "blue"),
    onFace(r, 0.42, -0.12, 0.02),
    {
      scale: [1, 1.5, 0.6],
    },
  );
  tear.visible = false;
  g.add(tear);
  const cheeks = [-1, 1].map((s) => {
    const c = at(
      flat(new THREE.CircleGeometry(r * 0.11, 16), "pink", 0.55),
      onFace(r, s * 0.6, -0.2, 0.015),
    );
    c.lookAt(c.position.clone().multiplyScalar(2));
    g.add(c);
    return c;
  });
  return { group: g, eyes, smile, frown, flatMouth, openMouth, tear, cheeks };
}

/** Show the face for a mood / action. */
export function setExpression(
  face: Face,
  mood: ZooMood,
  action: ZooAction | undefined,
): void {
  const joyful =
    action === "cheer" ||
    action === "play" ||
    action === "heal" ||
    action === "wash";
  const eating = action === "eat" || action === "drink";
  const closed = mood === "sleepy" || action === "sleep";
  face.smile.visible = !joyful && !eating && !closed && mood === "happy";
  face.openMouth.visible = joyful || eating;
  face.frown.visible = !joyful && !eating && mood === "sad";
  face.flatMouth.visible =
    !joyful && !eating && (mood === "waiting" || (closed && mood !== "sad"));
  face.tear.visible = mood === "sad" && !joyful;
  for (const c of face.cheeks) c.visible = mood === "happy" || joyful;
  for (const e of face.eyes) e.scale.y = closed ? 0.15 : joyful ? 0.55 : 1;
}

function mudSpots(spots: [number, number, number, number][]): THREE.Group {
  const g = new THREE.Group();
  for (const [x, y, z, r] of spots) {
    g.add(
      at(flat(sphere(r), "brown-dark", 0.85), v(x, y, z), {
        scale: [1, 0.7, 0.35],
      }),
    );
  }
  g.visible = false;
  return g;
}

// ---------------------------------------------------------------------------
// textures
// ---------------------------------------------------------------------------

const stripes = (): THREE.CanvasTexture =>
  canvasTexture("zebra", 128, 128, (ctx) => {
    ctx.fillStyle = cssColor("cloud");
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = cssColor("ink");
    for (let i = 0; i < 9; i++) {
      const y = 6 + i * 14;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 128; x += 16) {
        ctx.lineTo(x, y + Math.sin(x / 10 + i) * 3);
      }
      ctx.lineTo(128, y + 6);
      for (let x = 128; x >= 0; x -= 16) {
        ctx.lineTo(x, y + 6 + Math.sin(x / 9 + i) * 2);
      }
      ctx.fill();
    }
  });

const spots = (): THREE.CanvasTexture =>
  canvasTexture("giraffe", 128, 128, (ctx) => {
    ctx.fillStyle = cssColor("gold");
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = cssColor("brown");
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const x = col * 26 + (row % 2) * 13 + 3;
        const y = row * 26 + 4;
        ctx.beginPath();
        ctx.roundRect(x, y, 19, 18, 6);
        ctx.fill();
      }
    }
  });

// ---------------------------------------------------------------------------
// four legs: goat, pig, giraffe, zebra, elephant, lion
// ---------------------------------------------------------------------------

type QuadSpec = {
  fur: string;
  hoof: string;
  scale: number;
  bodyR: number;
  bodyLen: number;
  legLen: number;
  headR: number;
  neck?: number;
  map?: () => THREE.Texture;
  tail: "tuft" | "curly" | "thin";
  tuft?: string;
  extras: (head: THREE.Object3D, r: number) => void;
  faceOpts?: Parameters<typeof makeFace>[1];
};

function quad(spec: QuadSpec): AnimalRig {
  const root = new THREE.Group();
  const model = new THREE.Group();
  model.scale.setScalar(spec.scale);
  root.add(model);
  const { bodyR, bodyLen, legLen, headR } = spec;
  const bodyY = legLen + bodyR * 0.75;
  const map = spec.map?.();

  const body = pivot(v(0, bodyY, 0));
  const torso = part(capsule(bodyR, bodyLen), spec.fur, {
    ...(map !== undefined ? { map } : {}),
  });
  torso.rotation.x = Math.PI / 2;
  body.add(torso);
  model.add(body);

  const legs = [
    [-1, 1],
    [1, -1],
    [1, 1],
    [-1, -1],
  ].map(([sx = 1, sz = 1]) => {
    const hip = pivot(
      v(sx * bodyR * 0.55, bodyY - bodyR * 0.35, sz * bodyLen * 0.42),
    );
    hip.add(
      at(
        part(capsule(0.075, legLen - 0.12), spec.fur),
        v(0, -legLen / 2 + 0.04, 0),
      ),
    );
    hip.add(at(part(cylinder(0.08, 0.08), spec.hoof), v(0, -legLen + 0.13, 0)));
    model.add(hip);
    return hip;
  });

  // neck + head pivot at the front of the body
  const neckBase = v(0, bodyY + bodyR * 0.55, bodyLen / 2 + bodyR * 0.45);
  const head = pivot(neckBase);
  model.add(head);
  let headCenter = v(0, headR * 0.55, headR * 0.35);
  if (spec.neck !== undefined) {
    const neck = at(
      part(capsule(0.1, spec.neck), spec.fur, map !== undefined ? { map } : {}),
      v(0, spec.neck / 2, 0.05),
      {
        rot: [0.2, 0, 0],
      },
    );
    head.add(neck);
    headCenter = v(0, spec.neck + headR * 0.4, 0.25);
  }
  const skull = pivot(headCenter);
  head.add(skull);
  skull.add(
    part(
      sphere(headR),
      spec.fur,
      map !== undefined && spec.neck === undefined ? { map } : {},
    ),
  );
  spec.extras(skull, headR);
  const face = makeFace(headR, spec.faceOpts);
  skull.add(face.group);

  // tail
  const tail = pivot(v(0, bodyY + bodyR * 0.2, -(bodyLen / 2 + bodyR * 0.85)));
  if (spec.tail === "curly") {
    tail.add(
      at(part(torusArc(0.07, 0.025, Math.PI * 1.6), spec.fur), v(0, 0, -0.05), {
        rot: [0, Math.PI / 2, 0],
      }),
    );
  } else {
    tail.add(
      at(part(capsule(0.03, 0.28), spec.fur), v(0, -0.12, -0.08), {
        rot: [-0.6, 0, 0],
      }),
    );
    if (spec.tail === "tuft") {
      tail.add(
        at(part(sphere(0.07), spec.tuft ?? "brown-dark"), v(0, -0.27, -0.17), {
          scale: [1, 1.3, 1],
        }),
      );
    }
  }
  model.add(tail);

  const mud = mudSpots([
    [0.2, 0.05, 0.1, 0.09],
    [-0.15, -0.1, -0.15, 0.07],
    [0.05, 0.12, -0.25, 0.06],
  ]);
  mud.position.copy(body.position);
  mud.scale.setScalar(bodyR / 0.3);
  // put the spots on the camera side of the body
  mud.position.z += 0;
  mud.children.forEach((c) => (c.position.z += bodyR * 0.9));
  model.add(mud);

  const top = (spec.neck ?? 0) + bodyY + bodyR + headR * 2;
  return {
    root,
    body,
    head,
    legs,
    wings: [],
    tail,
    face,
    mud,
    height: top * spec.scale,
  };
}

// ---------------------------------------------------------------------------
// birds: chick, duck, parrot, penguin
// ---------------------------------------------------------------------------

type BirdSpec = {
  body: string;
  belly: string;
  wing: string;
  beak: string;
  feet: string;
  scale: number;
  beakShape: "small" | "flat" | "hook";
  crest?: string;
  tail?: string;
  /** penguin: white face patch */
  facePatch?: boolean;
};

function bird(spec: BirdSpec): AnimalRig {
  const root = new THREE.Group();
  const model = new THREE.Group();
  model.scale.setScalar(spec.scale);
  root.add(model);

  const body = pivot(v(0, 0.48, 0));
  body.add(
    at(part(sphere(0.38), spec.body), v(0, 0, 0), { scale: [1, 1.08, 0.92] }),
  );
  if (spec.belly !== spec.body) {
    body.add(
      at(part(sphere(0.27), spec.belly, { outline: 0 }), v(0, -0.04, 0.18), {
        scale: [1, 1.15, 0.7],
      }),
    );
  }
  model.add(body);

  const wings = [-1, 1].map((s) => {
    const shoulder = pivot(v(s * 0.34, 0.6, 0));
    shoulder.add(
      at(part(sphere(0.18), spec.wing), v(s * 0.04, -0.14, 0), {
        scale: [0.45, 1.2, 0.9],
      }),
    );
    model.add(shoulder);
    return shoulder;
  });

  const legs = [-1, 1].map((s) => {
    const hip = pivot(v(s * 0.14, 0.12, 0.05));
    hip.add(
      at(
        part(cylinder(0.025, 0.12), spec.feet, { outline: 0.02 }),
        v(0, -0.05, 0),
      ),
    );
    hip.add(
      at(part(sphere(0.08), spec.feet, { outline: 0.02 }), v(0, -0.11, 0.06), {
        scale: [1, 0.35, 1.4],
      }),
    );
    model.add(hip);
    return hip;
  });

  const head = pivot(v(0, 0.8, 0.02));
  model.add(head);
  const r = 0.28;
  const skull = pivot(v(0, 0.2, 0.04));
  head.add(skull);
  skull.add(part(sphere(r), spec.body));
  if (spec.facePatch === true) {
    skull.add(
      at(
        part(sphere(r * 0.75), spec.belly, { outline: 0 }),
        v(0, -0.02, r * 0.4),
        { scale: [1, 0.9, 0.6] },
      ),
    );
  }
  if (spec.crest !== undefined) {
    skull.add(
      at(part(cone(0.06, 0.2), spec.crest), v(0, r + 0.06, 0), {
        rot: [-0.3, 0, 0],
      }),
    );
    skull.add(
      at(part(cone(0.045, 0.15), spec.crest), v(0.06, r + 0.02, -0.03), {
        rot: [-0.3, 0, -0.4],
      }),
    );
  }
  const face = makeFace(r, { noMouth: true });
  skull.add(face.group);
  if (spec.beakShape === "flat") {
    skull.add(
      at(
        part(sphere(0.12), spec.beak, { outline: 0.02 }),
        onFace(r, 0, -0.25, 0.04),
        { scale: [1.1, 0.35, 1] },
      ),
    );
  } else if (spec.beakShape === "hook") {
    skull.add(
      at(
        part(cone(0.07, 0.16), spec.beak, { outline: 0.02 }),
        onFace(r, 0, -0.2, 0.05),
        { rot: [Math.PI / 2 + 0.5, 0, 0] },
      ),
    );
  } else {
    skull.add(
      at(
        part(cone(0.06, 0.13), spec.beak, { outline: 0.02 }),
        onFace(r, 0, -0.22, 0.04),
        { rot: [Math.PI / 2, 0, 0] },
      ),
    );
  }

  let tail: THREE.Object3D | undefined;
  if (spec.tail !== undefined) {
    tail = pivot(v(0, 0.35, -0.32));
    tail.add(
      at(part(cone(0.1, 0.4), spec.tail), v(0, -0.12, -0.12), {
        rot: [-2.2, 0, 0],
        scale: [1, 1, 0.4],
      }),
    );
    model.add(tail);
  }

  const mud = mudSpots([
    [0.15, 0.5, 0.33, 0.07],
    [-0.12, 0.38, 0.33, 0.06],
    [0.02, 0.62, 0.34, 0.05],
  ]);
  model.add(mud);

  return {
    root,
    body,
    head,
    legs,
    wings,
    tail,
    face,
    mud,
    height: (0.8 + 0.2 + r * 2) * spec.scale,
  };
}

// ---------------------------------------------------------------------------
// sitting: rabbit, monkey, panda
// ---------------------------------------------------------------------------

type SitSpec = {
  fur: string;
  belly: string;
  limbs: string;
  scale: number;
  ears: "long" | "side" | "top";
  tail: "puff" | "curl" | "none";
  face?: string;
  patches?: boolean;
};

function sitter(spec: SitSpec): AnimalRig {
  const root = new THREE.Group();
  const model = new THREE.Group();
  model.scale.setScalar(spec.scale);
  root.add(model);

  const body = pivot(v(0, 0.42, 0));
  body.add(part(sphere(0.37), spec.fur));
  body.children[0]?.scale.set(1, 1.05, 0.9);
  body.add(
    at(part(sphere(0.24), spec.belly, { outline: 0 }), v(0, -0.04, 0.2), {
      scale: [1, 1.1, 0.6],
    }),
  );
  if (spec.patches === true) {
    body.add(
      at(
        part(torusArc(0.3, 0.1, Math.PI * 2), "ink", { outline: 0 }),
        v(0, 0.2, 0),
        { rot: [Math.PI / 2, 0, 0], scale: [1, 0.9, 1] },
      ),
    );
  }
  model.add(body);

  const legs = [-1, 1].map((s) => {
    const hip = pivot(v(s * 0.2, 0.1, 0.15));
    hip.add(
      at(part(sphere(0.12), spec.limbs), v(0, -0.02, 0.06), {
        scale: [1, 0.6, 1.4],
      }),
    );
    model.add(hip);
    return hip;
  });
  const wings = [-1, 1].map((s) => {
    const shoulder = pivot(v(s * 0.3, 0.6, 0.05));
    shoulder.add(
      at(part(capsule(0.08, 0.2), spec.limbs), v(s * 0.05, -0.15, 0.04), {
        rot: [0, 0, s * 0.35],
      }),
    );
    model.add(shoulder);
    return shoulder;
  });

  const head = pivot(v(0, 0.75, 0.02));
  model.add(head);
  const r = 0.32;
  const skull = pivot(v(0, 0.22, 0.03));
  head.add(skull);
  // ears behind the head
  if (spec.ears === "long") {
    for (const s of [-1, 1]) {
      const ear = at(
        part(capsule(0.07, 0.32), spec.fur),
        v(s * 0.12, r + 0.17, -0.02),
        { rot: [0, 0, s * -0.15] },
      );
      ear.add(
        at(part(capsule(0.035, 0.24), "blush", { outline: 0 }), v(0, 0, 0.045)),
      );
      skull.add(ear);
    }
  } else if (spec.ears === "side") {
    for (const s of [-1, 1]) {
      const ear = at(
        part(sphere(0.1), spec.fur),
        v(s * (r + 0.02), 0.04, -0.02),
        { scale: [0.6, 1, 1] },
      );
      ear.add(
        at(
          part(sphere(0.06), spec.face ?? spec.belly, { outline: 0 }),
          v(s * 0.03, 0, 0.03),
          { scale: [0.5, 1, 1] },
        ),
      );
      skull.add(ear);
    }
  } else {
    for (const s of [-1, 1]) {
      skull.add(
        at(part(sphere(0.1), "ink"), v(s * 0.22, r * 0.8, -0.02), {
          scale: [1, 1, 0.6],
        }),
      );
    }
  }
  skull.add(part(sphere(r), spec.fur));
  if (spec.face !== undefined) {
    skull.add(
      at(
        part(sphere(r * 0.78), spec.face, { outline: 0 }),
        v(0, -0.04, r * 0.32),
        { scale: [1, 0.9, 0.7] },
      ),
    );
  }
  if (spec.patches === true) {
    for (const s of [-1, 1]) {
      const patch = at(
        flat(sphere(r * 0.2), "ink"),
        onFace(r, s * 0.36, 0.06, -0.01),
        { scale: [1, 1.3, 0.4], rot: [0, 0, s * 0.5] },
      );
      patch.lookAt(patch.position.clone().multiplyScalar(2));
      skull.add(patch);
    }
    skull.add(
      at(flat(sphere(r * 0.09), "ink"), onFace(r, 0, -0.18, 0.01), {
        scale: [1.3, 1, 0.5],
      }),
    );
  } else {
    skull.add(
      at(flat(sphere(r * 0.08), "pink"), onFace(r, 0, -0.16, 0.01), {
        scale: [1.3, 1, 0.5],
      }),
    );
  }
  const face = makeFace(r, { lightEyes: spec.patches === true, mouthY: -0.36 });
  skull.add(face.group);

  let tail: THREE.Object3D | undefined;
  if (spec.tail === "puff") {
    tail = pivot(v(0, 0.18, -0.33));
    tail.add(part(sphere(0.1), "cloud"));
    model.add(tail);
  } else if (spec.tail === "curl") {
    tail = pivot(v(0, 0.15, -0.3));
    tail.add(
      at(
        part(torusArc(0.18, 0.04, Math.PI * 1.5), spec.fur),
        v(0, 0.15, -0.12),
        { rot: [0, Math.PI / 2, 0] },
      ),
    );
    model.add(tail);
  }

  const mud = mudSpots([
    [0.15, 0.45, 0.33, 0.07],
    [-0.13, 0.35, 0.33, 0.06],
    [0.05, 0.25, 0.35, 0.05],
  ]);
  model.add(mud);

  return {
    root,
    body,
    head,
    legs,
    wings,
    tail,
    face,
    mud,
    height:
      (0.75 + 0.22 + r * 2 + (spec.ears === "long" ? 0.3 : 0)) * spec.scale,
  };
}

// ---------------------------------------------------------------------------
// the 13 animals
// ---------------------------------------------------------------------------

export function buildAnimal(species: ZooSpecies): AnimalRig {
  switch (species) {
    case "goat":
      return quad({
        fur: "cream",
        hoof: "brown-dark",
        scale: 0.85,
        bodyR: 0.28,
        bodyLen: 0.5,
        legLen: 0.4,
        headR: 0.25,
        tail: "tuft",
        tuft: "cream",
        extras: (h, r) => {
          for (const s of [-1, 1]) {
            h.add(
              at(part(cone(0.04, 0.22), "tan"), v(s * 0.1, r + 0.06, -0.05), {
                rot: [-0.5, 0, s * -0.3],
              }),
            );
            h.add(
              at(part(sphere(0.09), "cream"), v(s * (r + 0.02), 0.02, 0), {
                scale: [1.4, 0.45, 0.7],
                rot: [0, 0, s * -0.4],
              }),
            );
          }
          h.add(
            at(
              part(sphere(r * 0.55), "tan", { outline: 0 }),
              onFace(r, 0, -0.4, -0.12),
              { scale: [1, 0.75, 0.8] },
            ),
          );
          h.add(
            at(part(cone(0.05, 0.14), "cloud"), v(0, -r - 0.04, r * 0.5), {
              rot: [Math.PI, 0, 0],
            }),
          );
        },
        faceOpts: { mouthY: -0.55 },
      });
    case "pig":
      return quad({
        fur: "blush",
        hoof: "pink",
        scale: 0.85,
        bodyR: 0.32,
        bodyLen: 0.42,
        legLen: 0.3,
        headR: 0.27,
        tail: "curly",
        extras: (h, r) => {
          for (const s of [-1, 1]) {
            h.add(
              at(part(cone(0.08, 0.16), "blush"), v(s * 0.15, r * 0.85, 0), {
                rot: [0.3, 0, s * -0.4],
              }),
            );
          }
          const snout = at(
            part(cylinder(0.1, 0.08), "pink"),
            onFace(r, 0, -0.2, 0.01),
            { rot: [Math.PI / 2, 0, 0] },
          );
          for (const s of [-1, 1]) {
            snout.add(at(flat(sphere(0.022), "ink"), v(s * 0.04, 0.045, 0)));
          }
          h.add(snout);
        },
        faceOpts: { mouthY: -0.6 },
      });
    case "giraffe":
      return quad({
        fur: "gold",
        hoof: "brown-dark",
        scale: 0.9,
        bodyR: 0.27,
        bodyLen: 0.5,
        legLen: 0.55,
        headR: 0.22,
        neck: 0.75,
        map: spots,
        tail: "tuft",
        extras: (h, r) => {
          for (const s of [-1, 1]) {
            h.add(
              at(
                part(cylinder(0.025, 0.14), "gold"),
                v(s * 0.08, r + 0.05, -0.03),
              ),
            );
            h.add(
              at(
                part(sphere(0.04), "brown-dark"),
                v(s * 0.08, r + 0.13, -0.03),
              ),
            );
            h.add(
              at(
                part(cone(0.06, 0.14), "gold"),
                v(s * (r + 0.02), 0.06, -0.02),
                { rot: [0, 0, s * -1.2] },
              ),
            );
          }
          h.add(
            at(
              part(sphere(r * 0.6), "tan", { outline: 0 }),
              onFace(r, 0, -0.42, -0.1),
              { scale: [1, 0.75, 0.8] },
            ),
          );
        },
        faceOpts: { mouthY: -0.55 },
      });
    case "zebra":
      return quad({
        fur: "cloud",
        hoof: "ink",
        scale: 0.92,
        bodyR: 0.29,
        bodyLen: 0.5,
        legLen: 0.42,
        headR: 0.25,
        map: stripes,
        tail: "tuft",
        tuft: "ink",
        extras: (h, r) => {
          for (const s of [-1, 1]) {
            h.add(
              at(
                part(cone(0.06, 0.16), "cloud"),
                v(s * 0.13, r * 0.85, -0.02),
                { rot: [0, 0, s * -0.3] },
              ),
            );
          }
          h.add(at(part(box(0.06, 0.22, 0.2), "ink"), v(0, r * 0.85, -0.05)));
          h.add(
            at(
              part(sphere(r * 0.58), "grey", { outline: 0 }),
              onFace(r, 0, -0.42, -0.1),
              { scale: [1, 0.75, 0.8] },
            ),
          );
        },
        faceOpts: { mouthY: -0.6 },
      });
    case "elephant":
      return quad({
        fur: "grey",
        hoof: "cream",
        scale: 1.05,
        bodyR: 0.38,
        bodyLen: 0.45,
        legLen: 0.36,
        headR: 0.3,
        tail: "thin",
        tuft: "ink",
        extras: (h, r) => {
          for (const s of [-1, 1]) {
            const ear = at(
              part(sphere(0.22), "grey"),
              v(s * (r + 0.08), 0.02, -0.05),
              { scale: [0.25, 1, 1.05] },
            );
            ear.add(
              at(part(sphere(0.17), "blush", { outline: 0 }), v(0, 0, 0.04), {
                scale: [0.5, 0.9, 0.9],
              }),
            );
            h.add(ear);
          }
          const trunk = new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3([
              v(0, -0.05, r * 0.85),
              v(0, -0.25, r + 0.12),
              v(0, -0.42, r + 0.15),
              v(0, -0.48, r + 0.28),
            ]),
            12,
            0.07,
            10,
          );
          h.add(part(trunk, "grey", { outline: 0.02 }));
          for (const s of [-1, 1]) {
            h.add(
              at(
                part(cone(0.03, 0.12), "cream", { outline: 0.015 }),
                v(s * 0.1, -0.15, r * 0.8),
                { rot: [1.9, 0, 0] },
              ),
            );
          }
        },
        faceOpts: { noMouth: true },
      });
    case "lion":
      return quad({
        fur: "orange",
        hoof: "orange",
        scale: 0.95,
        bodyR: 0.3,
        bodyLen: 0.5,
        legLen: 0.38,
        headR: 0.26,
        tail: "tuft",
        tuft: "brown",
        extras: (h, r) => {
          const mane = new THREE.Group();
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            mane.add(
              at(
                part(sphere(0.11), "brown"),
                v(Math.cos(a) * (r + 0.05), Math.sin(a) * (r + 0.05), -0.06),
              ),
            );
          }
          h.add(mane);
          for (const s of [-1, 1]) {
            h.add(at(part(sphere(0.07), "orange"), v(s * 0.17, r * 0.9, 0.02)));
          }
          h.add(
            at(
              part(sphere(r * 0.55), "tan", { outline: 0 }),
              onFace(r, 0, -0.4, -0.1),
              { scale: [1, 0.75, 0.8] },
            ),
          );
          h.add(
            at(flat(sphere(0.04), "ink"), onFace(r, 0, -0.22, 0.03), {
              scale: [1.4, 1, 0.6],
            }),
          );
        },
        faceOpts: { mouthY: -0.55 },
      });
    case "chick":
      return bird({
        body: "yellow",
        belly: "yellow",
        wing: "gold",
        beak: "orange",
        feet: "orange",
        scale: 0.65,
        beakShape: "small",
        crest: "gold",
      });
    case "duck":
      return bird({
        body: "cloud",
        belly: "cream",
        wing: "cream",
        beak: "orange",
        feet: "orange",
        scale: 0.8,
        beakShape: "flat",
        tail: "cloud",
      });
    case "parrot":
      return bird({
        body: "red",
        belly: "red",
        wing: "blue",
        beak: "cream",
        feet: "grey",
        scale: 0.8,
        beakShape: "hook",
        crest: "yellow",
        tail: "blue",
      });
    case "penguin":
      return bird({
        body: "navy",
        belly: "cream",
        wing: "navy",
        beak: "orange",
        feet: "orange",
        scale: 0.9,
        beakShape: "small",
        facePatch: true,
      });
    case "rabbit":
      return sitter({
        fur: "cream",
        belly: "cloud",
        limbs: "cream",
        scale: 0.75,
        ears: "long",
        tail: "puff",
      });
    case "monkey":
      return sitter({
        fur: "brown",
        belly: "tan",
        limbs: "brown",
        scale: 0.85,
        ears: "side",
        tail: "curl",
        face: "tan",
      });
    case "panda":
      return sitter({
        fur: "cloud",
        belly: "cloud",
        limbs: "ink",
        scale: 0.95,
        ears: "top",
        tail: "none",
        patches: true,
      });
  }
}
