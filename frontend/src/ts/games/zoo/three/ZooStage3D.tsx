import { JSXElement, onCleanup, onMount } from "solid-js";
import * as THREE from "three";

import { ZooSpecies } from "../zoo-animals";
import { ZooAnimalLook } from "../ZooMap";
import { Actor, createActor, updateActor } from "./actor3d";

/** One pen on screen: the element to draw into and what lives there. */
export type StageView = {
  el: HTMLElement;
  species: ZooSpecies;
  look: () => ZooAnimalLook;
};

/** Pens sit far apart in one scene so each camera only sees its own. */
const SPACING = 14;

/**
 * Zoo Keeper's 3D animals: a single transparent WebGL canvas behind the
 * pens that draws each pen's animal (in a little 3D pen) into that pen's
 * box on screen - one GPU context however many pens there are. The pens'
 * bubbles and text stay normal HTML on top.
 */
export default function ZooStage3D(props: {
  views: () => (StageView | undefined)[];
  onReady?: () => void;
}): JSXElement {
  let canvasHost: HTMLDivElement | undefined;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7a9a66, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(-6, 12, 8);
  scene.add(sun);

  let actors: Actor[] = [];
  let builtFor = "";
  const cameras: THREE.PerspectiveCamera[] = [];

  const sync = (views: (StageView | undefined)[]): void => {
    const key = views.map((v) => v?.species ?? "").join(",");
    if (key === builtFor) return;
    builtFor = key;
    for (const a of actors) scene.remove(a.pen);
    actors = views.map((v, i) => {
      const a = createActor(v?.species ?? "rabbit", i, { sign: false });
      a.pen.position.set(i * SPACING, 0, 0);
      scene.add(a.pen);
      cameras[i] ??= new THREE.PerspectiveCamera(34, 1, 0.1, 40);
      return a;
    });
  };

  let raf = 0;
  let last = performance.now();
  const frame = (): void => {
    raf = 0;
    if (document.hidden || canvasHost === undefined) return;
    const views = props.views();
    sync(views);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    const host = canvasHost.getBoundingClientRect();
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    views.forEach((v, i) => {
      const a = actors[i];
      const cam = cameras[i];
      if (v === undefined || a === undefined || cam === undefined) return;
      updateActor(a, v.look(), t, dt, { editing: false, goldenBowls: false });
      const r = v.el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const left = r.left - host.left;
      const bottom = host.bottom - r.bottom;
      renderer.setViewport(left, bottom, r.width, r.height);
      renderer.setScissor(left, bottom, r.width, r.height);
      // frame the pen; tall boxes need a wider view to fit it across
      const aspect = r.width / r.height;
      cam.aspect = aspect;
      cam.fov = aspect >= 1.15 ? 34 : 34 * Math.pow(1.15 / aspect, 0.85);
      // aim above the pen so it sits low, under the request bubble
      cam.position.set(i * SPACING, 3.7, 6.6);
      cam.lookAt(i * SPACING, 1.35, 0.2);
      cam.updateProjectionMatrix();
      renderer.render(scene, cam);
    });
    raf = requestAnimationFrame(frame);
  };

  const onVisibility = (): void => {
    if (!document.hidden && raf === 0) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  onMount(() => {
    if (canvasHost === undefined) return;
    canvasHost.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    const resize = (): void => {
      if (canvasHost === undefined) return;
      const w = canvasHost.clientWidth;
      const h = canvasHost.clientHeight;
      if (w > 0 && h > 0) renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvasHost);
    resize();
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);
    props.onReady?.();
    onCleanup(() => ro.disconnect());
  });

  onCleanup(() => {
    if (raf !== 0) cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onVisibility);
    for (const a of actors) scene.remove(a.pen);
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  });

  return (
    <div
      ref={(el) => {
        canvasHost = el;
      }}
      class="pointer-events-none absolute inset-0"
      aria-hidden="true"
    ></div>
  );
}
