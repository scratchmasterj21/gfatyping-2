import { For, JSXElement } from "solid-js";

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const CLOUDS = [
  { y: 120, scale: 1, speed: 46, delay: -5 },
  { y: 300, scale: 0.7, speed: 60, delay: -30 },
  { y: 470, scale: 1.2, speed: 52, delay: -18 },
  { y: 640, scale: 0.8, speed: 70, delay: -45 },
  { y: 820, scale: 1, speed: 58, delay: -10 },
];
const CLOUD_SPAN = 900;

const STARS = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 41) % 100,
  top: (i * 23) % 70,
  size: 2 + (i % 3),
  delay: (i % 7) * 0.3,
}));

function Cloud(props: { scale: number }): JSXElement {
  return (
    <svg
      viewBox="0 0 120 50"
      width={120 * props.scale}
      height={50 * props.scale}
      aria-hidden="true"
    >
      <g fill="var(--color-game-cloud)">
        <ellipse cx="35" cy="34" rx="28" ry="14"></ellipse>
        <ellipse cx="60" cy="24" rx="26" ry="20"></ellipse>
        <ellipse cx="88" cy="32" rx="24" ry="15"></ellipse>
        <rect x="18" y="32" width="88" height="16" rx="8"></rect>
      </g>
    </svg>
  );
}

/**
 * Sky behind Tappy's tower. Day turns to sunset then a starry night as
 * Tappy climbs; clouds scroll past at half speed for a parallax feel.
 */
export function TowerSky(props: { floor: number; camera: number }): JSXElement {
  const sunset = (): number => clamp01((props.floor - 8) / 8);
  const night = (): number => clamp01((props.floor - 18) / 8);
  const cloudY = (y: number): number => {
    const v = (y - props.camera * 0.5) % CLOUD_SPAN;
    return v < -80 ? v + CLOUD_SPAN : v;
  };
  return (
    <div class="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div class="absolute inset-0 bg-linear-to-b from-game-sky-top to-game-sky"></div>
      <div
        class="absolute inset-0 bg-linear-to-b from-game-dusk to-game-sunset transition-opacity duration-1000"
        style={{ opacity: sunset() }}
      ></div>
      <div
        class="absolute inset-0 bg-linear-to-b from-game-night to-game-dusk transition-opacity duration-1000"
        style={{ opacity: night() }}
      ></div>

      {/* sun, then moon */}
      <div
        class="absolute top-16 right-[12%] h-16 w-16 rounded-full bg-game-yellow shadow-[0_0_40px_12px_rgb(255_210_63/0.55)] transition-opacity duration-1000"
        style={{ opacity: 1 - night() }}
      ></div>
      <div
        class="absolute top-20 right-[14%] h-12 w-12 rounded-full bg-game-cream shadow-[0_0_30px_8px_rgb(255_248_236/0.35)] transition-opacity duration-1000"
        style={{ opacity: night() }}
      ></div>

      <div
        class="absolute inset-0 transition-opacity duration-1000"
        style={{ opacity: night() }}
      >
        <For each={STARS}>
          {(s) => (
            <span
              class="absolute block animate-game-twinkle rounded-full bg-game-cream motion-reduce:animate-none"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                "animation-delay": `${s.delay}s`,
              }}
            ></span>
          )}
        </For>
      </div>

      <For each={CLOUDS}>
        {(c) => (
          <div
            class="absolute inset-x-0 opacity-90"
            style={{ bottom: `${cloudY(c.y)}px` }}
          >
            <div
              class="w-full animate-game-drift motion-reduce:animate-none"
              style={{
                "animation-duration": `${c.speed}s`,
                "animation-delay": `${c.delay}s`,
              }}
            >
              <Cloud scale={c.scale} />
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
