import { For, JSXElement, Show } from "solid-js";

import { PetSpecies } from "../../pet-shop/pet-items";

type WalkerConfig = {
  kind: "walk";
  bodyColor: string;
  earShape: "floppy" | "pointy" | "long";
};

type FlierConfig = {
  kind: "fly";
  bodyColor: string;
  wingColor: string;
  wingShape: "pointed" | "round";
  flapMs: number;
};

// Simple geometric/cartoon shapes, same visual language as the procedural
// Avatar component - not illustrated art. Each species reuses one of two
// shared "rigs" (walker or flier) and only swaps color/ear/wing cosmetics.
const PET_CONFIG: Record<PetSpecies, WalkerConfig | FlierConfig> = {
  dog: { kind: "walk", bodyColor: "#c98a4b", earShape: "floppy" },
  cat: { kind: "walk", bodyColor: "#8a8a8a", earShape: "pointy" },
  rabbit: { kind: "walk", bodyColor: "#e8d5c4", earShape: "long" },
  bird: {
    kind: "fly",
    bodyColor: "#5b9bd5",
    wingColor: "#3d7ab5",
    wingShape: "pointed",
    flapMs: 150,
  },
  butterfly: {
    kind: "fly",
    bodyColor: "#454545",
    wingColor: "#e6779a",
    wingShape: "round",
    flapMs: 400,
  },
};

// Even/odd split gives the classic diagonal-pair quadruped gait via the
// .pet-leg/.pet-leg-b animation-delay offset in pets.scss.
const LEG_X = [35, 48, 61, 74];

function WalkerSprite(props: { config: WalkerConfig }): JSXElement {
  const c = (): WalkerConfig => props.config;
  return (
    <svg viewBox="0 0 100 60" width="100%" height="100%">
      <For each={LEG_X}>
        {(x, i) => (
          <rect
            class={i() % 2 === 0 ? "pet-leg" : "pet-leg pet-leg-b"}
            x={x}
            y={40}
            width={4}
            height={16}
            rx={2}
            fill="#333"
          ></rect>
        )}
      </For>

      <path
        class="pet-tail"
        d="M 24 30 Q 10 18 16 8"
        stroke={c().bodyColor}
        stroke-width={5}
        fill="none"
        stroke-linecap="round"
      ></path>

      <ellipse cx={50} cy={32} rx={26} ry={16} fill={c().bodyColor}></ellipse>

      <Show when={c().earShape === "floppy"}>
        <ellipse
          cx={68}
          cy={16}
          rx={4}
          ry={9}
          fill={c().bodyColor}
          transform="rotate(20 68 16)"
        ></ellipse>
        <ellipse
          cx={86}
          cy={16}
          rx={4}
          ry={9}
          fill={c().bodyColor}
          transform="rotate(-10 86 16)"
        ></ellipse>
      </Show>
      <Show when={c().earShape === "pointy"}>
        <path d="M 68 14 L 64 2 L 74 10 Z" fill={c().bodyColor}></path>
        <path d="M 88 14 L 92 2 L 82 10 Z" fill={c().bodyColor}></path>
      </Show>
      <Show when={c().earShape === "long"}>
        <ellipse
          cx={70}
          cy={6}
          rx={3}
          ry={12}
          fill={c().bodyColor}
          transform="rotate(-8 70 6)"
        ></ellipse>
        <ellipse
          cx={84}
          cy={6}
          rx={3}
          ry={12}
          fill={c().bodyColor}
          transform="rotate(8 84 6)"
        ></ellipse>
      </Show>

      <circle cx={78} cy={24} r={13} fill={c().bodyColor}></circle>
      <circle cx={83} cy={21} r={1.8} fill="#222"></circle>
    </svg>
  );
}

function FlierSprite(props: { config: FlierConfig }): JSXElement {
  const c = (): FlierConfig => props.config;
  const wingD = (): string =>
    c().wingShape === "pointed"
      ? "M 50 26 Q 20 10 5 22 Q 25 30 50 26 Z"
      : "M 50 26 Q 15 -5 8 25 Q 25 40 50 26 Z";

  return (
    <svg viewBox="0 0 100 60" width="100%" height="100%">
      <g class="pet-wing" style={{ "animation-duration": `${c().flapMs}ms` }}>
        <path d={wingD()} fill={c().wingColor}></path>
      </g>
      <g
        class="pet-wing pet-wing-flip"
        style={{ "animation-duration": `${c().flapMs}ms` }}
      >
        <path
          d={wingD()}
          fill={c().wingColor}
          transform="scale(-1,1) translate(-100,0)"
        ></path>
      </g>

      <ellipse cx={52} cy={30} rx={6} ry={13} fill={c().bodyColor}></ellipse>

      <Show when={c().wingShape === "pointed"}>
        <circle cx={52} cy={20} r={4} fill={c().bodyColor}></circle>
        <path d="M 52 17 L 58 15 L 52 20 Z" fill="#e0a030"></path>
      </Show>
      <Show when={c().wingShape === "round"}>
        <line
          x1={50}
          y1={18}
          x2={44}
          y2={8}
          stroke="#333"
          stroke-width={1}
        ></line>
        <line
          x1={54}
          y1={18}
          x2={60}
          y2={8}
          stroke="#333"
          stroke-width={1}
        ></line>
      </Show>
    </svg>
  );
}

export function PetSprite(props: {
  species: PetSpecies;
  sizePx: number;
  facingLeft?: boolean;
}): JSXElement {
  const config = (): WalkerConfig | FlierConfig => PET_CONFIG[props.species];

  return (
    <div
      style={{
        width: `${props.sizePx}px`,
        height: `${props.sizePx * 0.6}px`,
        transform: props.facingLeft === true ? "scaleX(-1)" : "none",
      }}
    >
      <Show
        when={config().kind === "walk"}
        fallback={<FlierSprite config={config() as FlierConfig} />}
      >
        <WalkerSprite config={config() as WalkerConfig} />
      </Show>
    </div>
  );
}
