import { createEffect, JSXElement, on, onCleanup, onMount } from "solid-js";
import * as THREE from "three";

import { cn } from "../../../utils/cn";
import { sfx } from "../../mini/mini-sounds";
import { ZooSpecies } from "../zoo-animals";
import { ZooDecorId } from "../zoo-decor";
import { ZooPenPosition } from "../zoo-state";
import { defaultDecorSpot, defaultPenSpot, ZooAnimalLook } from "../ZooMap";
import {
  Actor,
  createActor,
  heartSprite,
  MAP_D,
  MAP_W,
  PEN_D,
  PEN_W,
  updateActor,
} from "./actor3d";
import { buildDecor, Decor3D } from "./decor3d";
import { box, flat, gameColor, sphere, toon } from "./toon";

const W = MAP_W;
const D = MAP_D;

const toWorld = (p: ZooPenPosition): { x: number; z: number } => ({
  x: (p.xPct / 100 - 0.5) * W,
  z: (p.yPct / 100 - 0.5) * D,
});
const toPct = (x: number, z: number): ZooPenPosition => ({
  xPct: (x / W + 0.5) * 100,
  yPct: (z / D + 0.5) * 100,
});

type ItemId = ZooSpecies | ZooDecorId;

type Placed = { id: ItemId; group: THREE.Group; w: number; d: number };

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
    actors = props.animals.map((species, i) => {
      const a = createActor(species, i);
      const p = toWorld(spotFor(species, i, false));
      a.pen.position.set(p.x, 0, p.z);
      return a;
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
    const opts = {
      editing: props.editing,
      goldenBowls: props.goldenBowls === true,
    };
    for (const a of actors) updateActor(a, props.look(a.species), t, dt, opts);
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
