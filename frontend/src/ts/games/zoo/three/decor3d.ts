import * as THREE from "three";

import { ZooDecorId } from "../zoo-decor";
import {
  box,
  canvasTexture,
  cone,
  cssColor,
  cylinder,
  flat,
  part,
  sphere,
} from "./toon";

/** A 3D decoration plus an optional per-frame animation. */
export type Decor3D = {
  group: THREE.Group;
  update?: (t: number) => void;
};

const at = <T extends THREE.Object3D>(
  o: T,
  x: number,
  y: number,
  z: number,
  scale?: [number, number, number],
): T => {
  o.position.set(x, y, z);
  if (scale !== undefined) o.scale.set(...scale);
  return o;
};

/** Zoo decorations, roughly 1.2 units across, standing on y = 0. */
export function buildDecor(id: ZooDecorId): Decor3D {
  const g = new THREE.Group();
  switch (id) {
    case "signpost": {
      g.add(at(part(cylinder(0.06, 1.1), "brown-dark"), 0, 0.55, 0));
      const sign = canvasTexture("zoo-sign", 128, 64, (ctx) => {
        ctx.fillStyle = cssColor("tan");
        ctx.fillRect(0, 0, 128, 64);
        ctx.fillStyle = cssColor("brown-dark");
        ctx.font = "bold 40px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("ZOO", 64, 34);
      });
      g.add(at(part(box(0.8, 0.4, 0.06), "tan", { map: sign }), 0, 1.0, 0.04));
      return { group: g };
    }
    case "rock":
      g.add(at(part(sphere(0.45), "grey"), 0, 0.2, 0, [1, 0.6, 0.85]));
      g.add(at(part(sphere(0.25), "grey"), 0.45, 0.1, 0.15, [1, 0.6, 0.9]));
      return { group: g };
    case "bush": {
      for (const [x, y, z, r, c] of [
        [-0.25, 0.3, 0, 0.32, "grass-dark"],
        [0.15, 0.38, 0.05, 0.38, "green"],
        [0.4, 0.25, -0.05, 0.26, "grass-dark"],
      ] as const) {
        g.add(at(part(sphere(r), c), x, y, z));
      }
      for (const [x, y] of [
        [0.05, 0.6],
        [0.3, 0.45],
        [-0.2, 0.5],
      ]) {
        g.add(at(flat(sphere(0.05), "red"), x ?? 0, y ?? 0, 0.36));
      }
      return { group: g };
    }
    case "flowers": {
      g.add(at(part(box(1.1, 0.22, 0.4), "brown"), 0, 0.11, 0));
      const heads: THREE.Object3D[] = [];
      ["pink", "yellow", "purple", "red"].forEach((c, i) => {
        const stem = new THREE.Group();
        stem.position.set(-0.4 + i * 0.27, 0.2, 0);
        stem.add(
          at(
            part(cylinder(0.02, 0.35), "grass-dark", { outline: 0.01 }),
            0,
            0.17,
            0,
          ),
        );
        stem.add(at(part(sphere(0.1), c), 0, 0.38, 0, [1, 1, 0.5]));
        stem.add(at(flat(sphere(0.04), "cream"), 0, 0.38, 0.05));
        g.add(stem);
        heads.push(stem);
      });
      return {
        group: g,
        update: (t) =>
          heads.forEach(
            (h, i) => (h.rotation.z = Math.sin(t * 1.6 + i) * 0.12),
          ),
      };
    }
    case "tree": {
      g.add(at(part(cylinder(0.12, 0.8, 0.09), "brown"), 0, 0.4, 0));
      const crown = new THREE.Group();
      crown.position.y = 0.8;
      for (const [x, y, z, r, c] of [
        [0, 0.35, 0, 0.45, "green"],
        [-0.3, 0.1, 0.05, 0.3, "grass-dark"],
        [0.3, 0.12, 0, 0.3, "grass-dark"],
      ] as const) {
        crown.add(at(part(sphere(r), c), x, y, z));
      }
      crown.add(at(flat(sphere(0.06), "red"), -0.15, 0.4, 0.42));
      crown.add(at(flat(sphere(0.06), "red"), 0.2, 0.25, 0.4));
      g.add(crown);
      return {
        group: g,
        update: (t) => (crown.rotation.z = Math.sin(t * 0.9) * 0.04),
      };
    }
    case "bench":
      g.add(at(part(box(1.1, 0.08, 0.35), "brown"), 0, 0.38, 0));
      g.add(at(part(box(1.1, 0.25, 0.06), "brown"), 0, 0.62, -0.16));
      for (const x of [-0.45, 0.45]) {
        g.add(at(part(box(0.07, 0.38, 0.3), "brown-dark"), x, 0.19, 0));
      }
      return { group: g };
    case "balloons": {
      g.add(at(part(box(0.5, 0.4, 0.4), "red"), 0, 0.2, 0));
      g.add(at(part(box(0.52, 0.08, 0.42), "cloud"), 0, 0.42, 0));
      const balloons: THREE.Object3D[] = [];
      ["pink", "yellow", "blue"].forEach((c, i) => {
        const b = new THREE.Group();
        b.position.set(-0.25 + i * 0.25, 0, 0);
        b.add(at(flat(cylinder(0.008, 0.7), "ink", 0.5), 0, 0.8, 0));
        b.add(at(part(sphere(0.17), c), 0, 1.25, 0, [1, 1.15, 1]));
        g.add(b);
        balloons.push(b);
      });
      return {
        group: g,
        update: (t) =>
          balloons.forEach((b, i) => {
            b.position.y = Math.sin(t * 1.4 + i * 1.3) * 0.06;
            b.rotation.z = Math.sin(t * 1.1 + i) * 0.08;
          }),
      };
    }
    case "pond": {
      g.add(
        at(
          part(cylinder(0.7, 0.06), "sky-top", { outline: 0.02 }),
          0,
          0.03,
          0,
          [1, 1, 0.65],
        ),
      );
      const water = at(
        flat(cylinder(0.6, 0.02), "sky"),
        0,
        0.07,
        0,
        [1, 1, 0.6],
      );
      g.add(water);
      g.add(
        at(
          part(cylinder(0.15, 0.02), "green", { outline: 0.01 }),
          -0.25,
          0.09,
          0.05,
        ),
      );
      const ripple = at(
        flat(new THREE.RingGeometry(0.1, 0.13, 20), "cloud", 0.7),
        0.2,
        0.09,
        -0.05,
      );
      ripple.rotation.x = -Math.PI / 2;
      g.add(ripple);
      return {
        group: g,
        update: (t) => {
          const p = (t * 0.6) % 1;
          ripple.scale.setScalar(0.6 + p * 1.6);
          (ripple.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - p);
        },
      };
    }
    case "ice-cream": {
      g.add(at(part(box(0.8, 0.45, 0.45), "cream"), 0, 0.42, 0));
      g.add(at(part(box(0.82, 0.1, 0.47), "pink"), 0, 0.62, 0));
      for (const x of [-0.28, 0.28]) {
        const wheel = at(part(cylinder(0.12, 0.08), "ink"), x, 0.12, 0.24);
        wheel.rotation.x = Math.PI / 2;
        g.add(wheel);
      }
      g.add(at(part(cylinder(0.025, 0.6), "grey"), 0, 0.95, 0));
      g.add(at(part(cone(0.55, 0.3), "blue"), 0, 1.3, 0));
      const cone2 = at(part(cone(0.07, 0.2), "tan"), 0.25, 0.75, 0.1);
      cone2.rotation.x = Math.PI;
      g.add(cone2);
      g.add(at(part(sphere(0.08), "pink"), 0.25, 0.88, 0.1));
      return { group: g };
    }
    case "fountain": {
      g.add(at(part(cylinder(0.65, 0.2), "grey"), 0, 0.1, 0));
      g.add(at(flat(cylinder(0.56, 0.02), "sky"), 0, 0.21, 0));
      g.add(at(part(cylinder(0.08, 0.6), "grey"), 0, 0.5, 0));
      g.add(at(part(cylinder(0.28, 0.08, 0.32), "grey"), 0, 0.8, 0));
      const drops: THREE.Object3D[] = [];
      for (let i = 0; i < 6; i++) {
        const d = flat(sphere(0.04), "sky");
        g.add(d);
        drops.push(d);
      }
      return {
        group: g,
        update: (t) =>
          drops.forEach((d, i) => {
            const p = (t * 0.8 + i / drops.length) % 1;
            const a = (i / drops.length) * Math.PI * 2;
            d.position.set(
              Math.cos(a) * p * 0.45,
              0.9 + Math.sin(p * Math.PI) * 0.35 - p * 0.55,
              Math.sin(a) * p * 0.45,
            );
          }),
      };
    }
  }
}
