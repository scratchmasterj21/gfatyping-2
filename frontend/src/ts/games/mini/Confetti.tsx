import { For, JSXElement } from "solid-js";

const COLORS = [
  "var(--color-game-pink)",
  "var(--color-game-yellow)",
  "var(--color-game-green)",
  "var(--color-game-blue)",
  "var(--color-game-purple)",
  "var(--color-game-orange)",
];

const PIECES = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 13) % 20) / 20,
  size: 6 + ((i * 7) % 6),
  round: i % 3 === 0,
  color: COLORS[i % COLORS.length] as string,
}));

/** One-shot confetti shower; hidden for prefers-reduced-motion. */
export function Confetti(): JSXElement {
  return (
    <div
      class="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
      aria-hidden="true"
    >
      <For each={PIECES}>
        {(p) => (
          <span
            class="absolute -top-4 block animate-game-confetti"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.round ? p.size : p.size * 1.6}px`,
              "border-radius": p.round ? "9999px" : "2px",
              "background-color": p.color,
              "animation-delay": `${p.delay}s`,
            }}
          ></span>
        )}
      </For>
    </div>
  );
}
