import { JSXElement, onCleanup, onMount, Show } from "solid-js";

import { getAuthenticatedUser } from "../../firebase";
import { dismissCelebration, getCelebration } from "../../states/celebration";
import { Fa } from "./Fa";
import { UserAvatar } from "./UserAvatar";

function ConfettiCanvas(): JSXElement {
  let canvas: HTMLCanvasElement | null = null;
  let rafId: number | null = null;

  const COLORS = [
    "#e74c3c",
    "#3498db",
    "#2ecc71",
    "#f1c40f",
    "#9b59b6",
    "#1abc9c",
    "#e67e22",
    "#e91e63",
  ];

  type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    w: number;
    h: number;
    rotation: number;
    vr: number;
    alpha: number;
  };

  onMount(() => {
    if (canvas === null) return;
    const el = canvas;
    el.width = window.innerWidth;
    el.height = window.innerHeight;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const particles: Particle[] = Array.from({ length: 120 }, () => ({
      x: Math.random() * el.width,
      y: -20 - Math.random() * 150,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] as string,
      w: Math.random() * 10 + 5,
      h: Math.random() * 5 + 3,
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.15,
      alpha: 1,
    }));

    const draw = (c: CanvasRenderingContext2D): void => {
      c.clearRect(0, 0, el.width, el.height);
      let alive = false;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.07;
        p.rotation += p.vr;
        if (p.y > el.height * 0.65) {
          p.alpha = Math.max(0, p.alpha - 0.025);
        }
        if (p.alpha > 0 && p.y < el.height) {
          alive = true;
        }

        c.save();
        c.globalAlpha = p.alpha;
        c.translate(p.x, p.y);
        c.rotate(p.rotation);
        c.fillStyle = p.color;
        c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        c.restore();
      }

      if (alive) {
        rafId = requestAnimationFrame(() => draw(c));
      } else {
        rafId = null;
      }
    };

    rafId = requestAnimationFrame(() => draw(ctx));
  });

  onCleanup(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
  });

  return (
    <canvas
      ref={(el) => {
        canvas = el;
      }}
      class="pointer-events-none absolute inset-0 h-full w-full"
    ></canvas>
  );
}

export function CelebrationOverlay(): JSXElement {
  const uid = (): string | undefined => getAuthenticatedUser()?.uid;

  return (
    <Show when={getCelebration()}>
      {(info) => (
        <div class="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center">
          <ConfettiCanvas />
          <button
            type="button"
            class="pointer-events-auto relative flex cursor-pointer flex-col items-center gap-4 rounded-2xl bg-sub-alt px-12 py-8 text-center shadow-2xl"
            onClick={() => dismissCelebration()}
          >
            <Show
              when={uid()}
              fallback={<Fa icon={info().icon} class="text-[3rem] text-main" />}
            >
              {(id) => <UserAvatar uid={id()} celebrate={true} size={72} />}
            </Show>
            <div class="text-2xl font-bold text-text">{info().title}</div>
            <div class="text-sub">{info().message}</div>
            <div class="mt-2 text-em-xs text-sub">tap to dismiss</div>
          </button>
        </div>
      )}
    </Show>
  );
}
