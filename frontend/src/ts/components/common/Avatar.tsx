import { createUniqueId, JSXElement, Match, Show, Switch } from "solid-js";

import { AvatarShape } from "../../avatar/avatar-items";

const INK = "#1a1a1a";

/**
 * A simple procedural/geometric avatar - plain SVG shapes, no image assets.
 * Matches this app's mini-games, which draw everything with code too. Each
 * "costume item" is just a color/shape parameter, not an illustrated asset.
 */
export function Avatar(props: {
  color?: string;
  /** Base head silhouette - undefined means "round". Hats/hair are drawn per-shape (see AvatarItem.shape). */
  shape?: AvatarShape;
  hair?: string;
  hat?: string;
  accessory?: string;
  face?: string;
  background?: string;
  /** Hex color for a purchasable glow ring around the avatar (leaderboard flair). */
  highlightColor?: string;
  /** Plays a bigger bounce/wiggle + sparkles instead of the idle bob - used for the celebration overlay. */
  celebrate?: boolean;
  size?: number;
  class?: string;
}): JSXElement {
  const color = (): string => props.color ?? "#94a3b8";
  const size = (): number => props.size ?? 96;
  const gradId = `avatar-sheen-${createUniqueId()}`;
  // border-radius rounds the SVG's own box to a circle so the box-shadow ring
  // traces the drawn avatar's circular shape instead of a square bounding box.
  const highlightStyle = ():
    | { "border-radius": string; "box-shadow": string }
    | undefined => {
    const c = props.highlightColor;
    if (c === undefined) return undefined;
    return {
      "border-radius": "9999px",
      "box-shadow": `0 0 0 2px ${c}, 0 0 8px ${c}`,
    };
  };

  return (
    <svg
      viewBox="0 0 100 100"
      width={size()}
      height={size()}
      role="img"
      aria-label="avatar"
      class={props.class}
      style={highlightStyle()}
    >
      <style>
        {`
          .avatar-bob { animation: avatar-bob 2.6s ease-in-out infinite; transform-origin: 50px 60px; }
          @keyframes avatar-bob {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
          .avatar-cheer { animation: avatar-cheer 0.7s ease-in-out infinite; transform-origin: 50px 60px; }
          @keyframes avatar-cheer {
            0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
            25% { transform: translateY(-6px) scale(1.06) rotate(-4deg); }
            50% { transform: translateY(0) scale(1.02) rotate(0deg); }
            75% { transform: translateY(-6px) scale(1.06) rotate(4deg); }
          }
          .avatar-sparkle { animation: avatar-sparkle 1.4s ease-in-out infinite; }
          @keyframes avatar-sparkle {
            0%, 100% { opacity: 0; transform: scale(0.6); }
            50% { opacity: 1; transform: scale(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            .avatar-bob, .avatar-cheer, .avatar-sparkle { animation: none; }
          }
        `}
      </style>
      <defs>
        <radialGradient id={gradId} cx="35%" cy="28%" r="70%">
          {/* oxlint-disable-next-line react/no-unknown-property -- Solid's SVG types want kebab-case here, not React's camelCase */}
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45"></stop>
          {/* oxlint-disable-next-line react/no-unknown-property -- Solid's SVG types want kebab-case here, not React's camelCase */}
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"></stop>
        </radialGradient>
      </defs>

      <Show when={props.background === "dots-bg"}>
        <circle cx="50" cy="50" r="48" fill="#e7f5ff"></circle>
        <circle cx="24" cy="30" r="2.2" fill="#a5d8ff"></circle>
        <circle cx="76" cy="28" r="2.2" fill="#a5d8ff"></circle>
        <circle cx="16" cy="60" r="2.2" fill="#a5d8ff"></circle>
        <circle cx="84" cy="64" r="2.2" fill="#a5d8ff"></circle>
        <circle cx="50" cy="14" r="2.2" fill="#a5d8ff"></circle>
        <circle cx="30" cy="86" r="2.2" fill="#a5d8ff"></circle>
        <circle cx="70" cy="88" r="2.2" fill="#a5d8ff"></circle>
      </Show>
      <Show when={props.background === "stars-bg"}>
        <circle cx="50" cy="50" r="48" fill="#1e293b"></circle>
        <circle cx="26" cy="26" r="1.4" fill="#ffe066"></circle>
        <circle cx="74" cy="24" r="1.8" fill="#ffe066"></circle>
        <circle cx="18" cy="58" r="1.4" fill="#ffe066"></circle>
        <circle cx="82" cy="60" r="1.8" fill="#ffe066"></circle>
        <circle cx="50" cy="12" r="1.4" fill="#ffe066"></circle>
        <circle cx="32" cy="86" r="1.4" fill="#ffe066"></circle>
        <circle cx="70" cy="90" r="1.8" fill="#ffe066"></circle>
      </Show>
      <Show when={props.background === "sunburst-bg"}>
        <circle cx="50" cy="50" r="48" fill="#fff9db"></circle>
        <path
          d="M 50 50 L 50 4 M 50 50 L 84 16 M 50 50 L 96 50 M 50 50 L 84 84 M 50 50 L 50 96 M 50 50 L 16 84 M 50 50 L 4 50 M 50 50 L 16 16"
          stroke="#ffe066"
          stroke-width="6"
          opacity="0.55"
        ></path>
      </Show>
      <Show when={props.background === "hearts-bg"}>
        <circle cx="50" cy="50" r="48" fill="#fff0f6"></circle>
        <path
          d="M 26 24 C 26 21 22 21 22 24 C 22 21 18 21 18 24 C 18 27 22 30 22 32 C 22 30 26 27 26 24 Z"
          fill="#ffc9de"
        ></path>
        <path
          d="M 82 30 C 82 27 78 27 78 30 C 78 27 74 27 74 30 C 74 33 78 36 78 38 C 78 36 82 33 82 30 Z"
          fill="#ffc9de"
        ></path>
        <path
          d="M 78 78 C 78 75 74 75 74 78 C 74 75 70 75 70 78 C 70 81 74 84 74 86 C 74 84 78 81 78 78 Z"
          fill="#ffc9de"
        ></path>
      </Show>
      <Show when={props.background === "grid-bg"}>
        <circle cx="50" cy="50" r="48" fill="#f1f3f5"></circle>
        <path
          d="M 2 26 L 98 26 M 2 50 L 98 50 M 2 74 L 98 74 M 26 2 L 26 98 M 50 2 L 50 98 M 74 2 L 74 98"
          stroke="#ced4da"
          stroke-width="1.5"
          opacity="0.7"
        ></path>
      </Show>
      <Show when={props.background === "waves-bg"}>
        <circle cx="50" cy="50" r="48" fill="#e0f7fa"></circle>
        <path
          d="M 2 30 Q 12 25 22 30 Q 32 35 42 30 Q 52 25 62 30 Q 72 35 82 30 Q 92 25 98 30"
          stroke="#4dd0e1"
          stroke-width="3"
          fill="none"
          opacity="0.7"
        ></path>
        <path
          d="M 2 50 Q 12 45 22 50 Q 32 55 42 50 Q 52 45 62 50 Q 72 55 82 50 Q 92 45 98 50"
          stroke="#4dd0e1"
          stroke-width="3"
          fill="none"
          opacity="0.7"
        ></path>
        <path
          d="M 2 70 Q 12 65 22 70 Q 32 75 42 70 Q 52 65 62 70 Q 72 75 82 70 Q 92 65 98 70"
          stroke="#4dd0e1"
          stroke-width="3"
          fill="none"
          opacity="0.7"
        ></path>
      </Show>
      <Show when={props.background === "rainbow-bg"}>
        <circle cx="50" cy="50" r="48" fill="#ffffff"></circle>
        <path
          d="M 2 60 Q 50 10 98 60"
          stroke="#ff6b6b"
          stroke-width="5"
          fill="none"
          opacity="0.85"
        ></path>
        <path
          d="M 2 68 Q 50 22 98 68"
          stroke="#ffd43b"
          stroke-width="5"
          fill="none"
          opacity="0.85"
        ></path>
        <path
          d="M 2 76 Q 50 34 98 76"
          stroke="#51cf66"
          stroke-width="5"
          fill="none"
          opacity="0.85"
        ></path>
        <path
          d="M 2 84 Q 50 46 98 84"
          stroke="#4dabf7"
          stroke-width="5"
          fill="none"
          opacity="0.85"
        ></path>
      </Show>

      <ellipse
        cx="50"
        cy="93"
        rx="24"
        ry="4"
        fill="#000000"
        opacity="0.15"
      ></ellipse>

      <Show when={props.celebrate}>
        <g
          class="pointer-events-none"
          fill="#ffd43b"
          stroke="#f08c00"
          stroke-width="0.6"
        >
          <text
            x="12"
            y="24"
            font-size="12"
            class="avatar-sparkle"
            style={{ "animation-delay": "0s" }}
          >
            ✦
          </text>
          <text
            x="82"
            y="20"
            font-size="10"
            class="avatar-sparkle"
            style={{ "animation-delay": "0.3s" }}
          >
            ✦
          </text>
          <text
            x="86"
            y="60"
            font-size="11"
            class="avatar-sparkle"
            style={{ "animation-delay": "0.6s" }}
          >
            ✦
          </text>
          <text
            x="8"
            y="66"
            font-size="9"
            class="avatar-sparkle"
            style={{ "animation-delay": "0.9s" }}
          >
            ✦
          </text>
        </g>
      </Show>

      <g class={props.celebrate ? "avatar-cheer" : "avatar-bob"}>
        <Switch
          fallback={
            <>
              <circle cx="50" cy="55" r="38" fill={color()}></circle>
              <circle cx="50" cy="55" r="38" fill={`url(#${gradId})`}></circle>
            </>
          }
        >
          <Match when={props.shape === "square"}>
            <rect
              x="13"
              y="18"
              width="74"
              height="74"
              rx="14"
              fill={color()}
            ></rect>
            <rect
              x="13"
              y="18"
              width="74"
              height="74"
              rx="14"
              fill={`url(#${gradId})`}
            ></rect>
          </Match>
          <Match when={props.shape === "oval"}>
            <ellipse cx="50" cy="55" rx="32" ry="40" fill={color()}></ellipse>
            <ellipse
              cx="50"
              cy="55"
              rx="32"
              ry="40"
              fill={`url(#${gradId})`}
            ></ellipse>
          </Match>
          <Match when={props.shape === "hexagon"}>
            <polygon
              points="30,15 70,15 88,55 70,95 30,95 12,55"
              fill={color()}
            ></polygon>
            <polygon
              points="30,15 70,15 88,55 70,95 30,95 12,55"
              fill={`url(#${gradId})`}
            ></polygon>
          </Match>
          <Match when={props.shape === "cloud"}>
            <path
              d="M 20 60 Q 8 60 8 45 Q 8 32 22 30 Q 22 15 40 15 Q 50 5 62 15 Q 80 12 82 30 Q 92 32 90 48 Q 92 62 78 64 Q 75 78 55 80 Q 40 92 28 80 Q 12 78 20 60 Z"
              fill={color()}
            ></path>
            <path
              d="M 20 60 Q 8 60 8 45 Q 8 32 22 30 Q 22 15 40 15 Q 50 5 62 15 Q 80 12 82 30 Q 92 32 90 48 Q 92 62 78 64 Q 75 78 55 80 Q 40 92 28 80 Q 12 78 20 60 Z"
              fill={`url(#${gradId})`}
            ></path>
          </Match>
        </Switch>

        <Show when={props.hair === "short-hair"}>
          <path
            d="M 14 42 Q 18 8 50 6 Q 82 8 86 42 Q 80 20 50 18 Q 20 20 14 42 Z"
            fill="#6b4423"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
        </Show>
        <Show when={props.hair === "long-hair"}>
          <path
            d="M 14 42 Q 18 8 50 6 Q 82 8 86 42 Q 80 20 50 18 Q 20 20 14 42 Z"
            fill="#3e2723"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
          <path
            d="M 14 40 Q 10 60 14 82 Q 20 84 22 82 Q 18 60 20 38 Z"
            fill="#3e2723"
          ></path>
          <path
            d="M 86 40 Q 90 60 86 82 Q 80 84 78 82 Q 82 60 80 38 Z"
            fill="#3e2723"
          ></path>
        </Show>
        <Show when={props.hair === "ponytail"}>
          <path
            d="M 14 42 Q 18 8 50 6 Q 82 8 86 42 Q 80 20 50 18 Q 20 20 14 42 Z"
            fill="#1a1a1a"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
          <path
            d="M 76 24 Q 100 28 98 52 Q 96 76 78 86 Q 90 60 82 38 Q 78 30 76 24 Z"
            fill="#1a1a1a"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
          <ellipse cx="78" cy="28" rx="4.5" ry="3.5" fill="#495057"></ellipse>
        </Show>
        <Show when={props.hair === "spiky-hair"}>
          <path
            d="M 16 38 L 24 14 L 30 34 L 38 10 L 44 32 L 50 8 L 56 32 L 62 10 L 70 34 L 76 14 L 84 38 Q 78 22 50 20 Q 22 22 16 38 Z"
            fill="#f9c74f"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
        </Show>

        <Show when={props.hair === "short-hair-square"}>
          <path
            d="M 13 42 L 13 20 Q 13 10 24 10 L 76 10 Q 87 10 87 20 L 87 42 Q 78 20 50 18 Q 22 20 13 42 Z"
            fill="#6b4423"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
        </Show>
        <Show when={props.hair === "long-hair-square"}>
          <path
            d="M 13 42 L 13 20 Q 13 10 24 10 L 76 10 Q 87 10 87 20 L 87 42 Q 78 20 50 18 Q 22 20 13 42 Z"
            fill="#3e2723"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
          <path
            d="M 13 40 Q 9 60 13 82 Q 19 84 21 82 Q 17 60 19 38 Z"
            fill="#3e2723"
          ></path>
          <path
            d="M 87 40 Q 91 60 87 82 Q 81 84 79 82 Q 83 60 81 38 Z"
            fill="#3e2723"
          ></path>
        </Show>
        <Show when={props.hair === "ponytail-square"}>
          <path
            d="M 13 42 L 13 20 Q 13 10 24 10 L 76 10 Q 87 10 87 20 L 87 42 Q 78 20 50 18 Q 22 20 13 42 Z"
            fill="#1a1a1a"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
          <path
            d="M 76 16 Q 100 20 98 46 Q 96 72 78 84 Q 90 56 82 32 Q 78 22 76 16 Z"
            fill="#1a1a1a"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
          <ellipse cx="78" cy="18" rx="4.5" ry="3.5" fill="#495057"></ellipse>
        </Show>
        <Show when={props.hair === "spiky-hair-square"}>
          <path
            d="M 15 32 L 22 8 L 29 28 L 37 6 L 44 26 L 50 4 L 56 26 L 63 6 L 71 28 L 78 8 L 85 32 Q 78 16 50 14 Q 22 16 15 32 Z"
            fill="#f9c74f"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
        </Show>

        <Show when={props.hair === "short-hair-oval"}>
          <path
            d="M 18 46 Q 20 12 50 10 Q 80 12 82 46 Q 76 24 50 22 Q 24 24 18 46 Z"
            fill="#6b4423"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
        </Show>
        <Show when={props.hair === "spiky-hair-oval"}>
          <path
            d="M 20 42 L 27 16 L 33 38 L 40 12 L 46 36 L 50 10 L 54 36 L 60 12 L 67 38 L 73 16 L 80 42 Q 74 24 50 22 Q 26 24 20 42 Z"
            fill="#f9c74f"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
        </Show>

        <Show when={props.hair === "short-hair-hexagon"}>
          <path
            d="M 22 40 L 30 13 L 70 13 L 78 40 Q 70 20 50 18 Q 30 20 22 40 Z"
            fill="#6b4423"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
        </Show>
        <Show when={props.hair === "spiky-hair-hexagon"}>
          <path
            d="M 22 36 L 28 10 L 35 32 L 42 8 L 48 30 L 50 6 L 52 30 L 58 8 L 65 32 L 72 10 L 78 36 Q 70 18 50 16 Q 30 18 22 36 Z"
            fill="#f9c74f"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
        </Show>

        <Show when={props.hair === "short-hair-cloud"}>
          <path
            d="M 15 40 Q 18 8 50 6 Q 82 8 85 40 Q 76 20 50 18 Q 24 20 15 40 Z"
            fill="#6b4423"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
        </Show>
        <Show when={props.hair === "spiky-hair-cloud"}>
          <path
            d="M 16 36 L 24 10 L 31 32 L 39 8 L 46 30 L 50 6 L 54 30 L 61 8 L 69 32 L 76 10 L 84 36 Q 77 18 50 16 Q 23 18 16 36 Z"
            fill="#f9c74f"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
        </Show>

        <circle cx="32" cy="60" r="4.5" fill="#ff8787" opacity="0.35"></circle>
        <circle cx="68" cy="60" r="4.5" fill="#ff8787" opacity="0.35"></circle>

        <Show when={props.face === undefined}>
          <path
            d="M 33 44 Q 38 41 43 44"
            stroke={INK}
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
          ></path>
          <path
            d="M 57 44 Q 62 41 67 44"
            stroke={INK}
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
          ></path>

          <circle cx="38" cy="52" r="4.5" fill={INK}></circle>
          <circle cx="62" cy="52" r="4.5" fill={INK}></circle>
          <circle cx="39.3" cy="50.5" r="1.3" fill="#ffffff"></circle>
          <circle cx="63.3" cy="50.5" r="1.3" fill="#ffffff"></circle>

          <path
            d="M 36 66 Q 50 76 64 66"
            stroke={INK}
            stroke-width="3"
            fill="none"
            stroke-linecap="round"
          ></path>
        </Show>

        <Show when={props.face === "sleepy"}>
          <path
            d="M 34 52 Q 38 55 42 52"
            stroke={INK}
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
          ></path>
          <path
            d="M 58 52 Q 62 55 66 52"
            stroke={INK}
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
          ></path>
          <path
            d="M 42 68 Q 50 71 58 68"
            stroke={INK}
            stroke-width="3"
            fill="none"
            stroke-linecap="round"
          ></path>
        </Show>

        <Show when={props.face === "wink"}>
          <path
            d="M 34 52 Q 38 55 42 52"
            stroke={INK}
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
          ></path>
          <circle cx="62" cy="52" r="4.5" fill={INK}></circle>
          <circle cx="63.3" cy="50.5" r="1.3" fill="#ffffff"></circle>
          <path
            d="M 36 64 Q 50 74 64 64"
            stroke={INK}
            stroke-width="3"
            fill="none"
            stroke-linecap="round"
          ></path>
        </Show>

        <Show when={props.face === "surprised"}>
          <circle cx="38" cy="52" r="5.5" fill={INK}></circle>
          <circle cx="62" cy="52" r="5.5" fill={INK}></circle>
          <circle cx="39.5" cy="50" r="1.6" fill="#ffffff"></circle>
          <circle cx="63.5" cy="50" r="1.6" fill="#ffffff"></circle>
          <ellipse cx="50" cy="68" rx="5" ry="6" fill={INK}></ellipse>
        </Show>

        <Show when={props.face === "angry"}>
          <path
            d="M 33 46 L 43 42"
            stroke={INK}
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
          ></path>
          <path
            d="M 67 46 L 57 42"
            stroke={INK}
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
          ></path>
          <circle cx="38" cy="52" r="4" fill={INK}></circle>
          <circle cx="62" cy="52" r="4" fill={INK}></circle>
          <path
            d="M 38 70 Q 50 64 62 70"
            stroke={INK}
            stroke-width="3"
            fill="none"
            stroke-linecap="round"
          ></path>
        </Show>

        <Show when={props.face === "laughing"}>
          <path
            d="M 33 51 Q 38 46 43 51"
            stroke={INK}
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
          ></path>
          <path
            d="M 57 51 Q 62 46 67 51"
            stroke={INK}
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
          ></path>
          <ellipse cx="50" cy="70" rx="8" ry="7" fill={INK}></ellipse>
          <path
            d="M 44 68 Q 50 74 56 68"
            stroke="#ffffff"
            stroke-width="1.5"
            fill="none"
            stroke-linecap="round"
          ></path>
        </Show>

        <Show when={props.face === "starstruck"}>
          <path
            d="M 38 46 L 39.5 50 L 43.5 50 L 40.5 52.5 L 41.5 56.5 L 38 54 L 34.5 56.5 L 35.5 52.5 L 32.5 50 L 36.5 50 Z"
            fill="#ffd43b"
          ></path>
          <path
            d="M 62 46 L 63.5 50 L 67.5 50 L 64.5 52.5 L 65.5 56.5 L 62 54 L 58.5 56.5 L 59.5 52.5 L 56.5 50 L 60.5 50 Z"
            fill="#ffd43b"
          ></path>
          <path
            d="M 38 66 Q 50 74 62 66"
            stroke={INK}
            stroke-width="3"
            fill="none"
            stroke-linecap="round"
          ></path>
        </Show>

        <Show when={props.accessory === "glasses"}>
          <circle
            cx="38"
            cy="52"
            r="8"
            fill="none"
            stroke={INK}
            stroke-width="2.5"
          ></circle>
          <circle
            cx="62"
            cy="52"
            r="8"
            fill="none"
            stroke={INK}
            stroke-width="2.5"
          ></circle>
          <line
            x1="46"
            y1="52"
            x2="54"
            y2="52"
            stroke={INK}
            stroke-width="2.5"
          ></line>
        </Show>
        <Show when={props.accessory === "bow"}>
          <path
            d="M 42 78 L 50 74 L 58 78 L 50 82 Z"
            fill="#e64980"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
          <circle cx="50" cy="78" r="2.5" fill="#c2255c"></circle>
        </Show>
        <Show when={props.accessory === "mustache"}>
          <path
            d="M 40 62 Q 44 58 48 62 Q 50 60 52 62 Q 56 58 60 62"
            stroke={INK}
            stroke-width="3"
            fill="none"
            stroke-linecap="round"
          ></path>
        </Show>
        <Show when={props.accessory === "star"}>
          <path
            d="M 78 40 L 80 46 L 86 46 L 81 50 L 83 56 L 78 52 L 73 56 L 75 50 L 70 46 L 76 46 Z"
            fill="#ffd43b"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
        </Show>
        <Show when={props.accessory === "heart"}>
          <path
            d="M 78 42 C 78 38 73 38 73 42 C 73 38 68 38 68 42 C 68 46 73 49 73 52 C 73 49 78 46 78 42 Z"
            fill="#ff6b6b"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
        </Show>
        <Show when={props.accessory === "earrings"}>
          <circle cx="13" cy="58" r="2.5" fill="#ffd43b"></circle>
          <circle cx="87" cy="58" r="2.5" fill="#ffd43b"></circle>
        </Show>
        <Show when={props.accessory === "necklace"}>
          <path
            d="M 38 74 Q 50 82 62 74"
            stroke="#495057"
            stroke-width="2"
            fill="none"
          ></path>
          <circle cx="50" cy="81" r="2.8" fill="#4dabf7"></circle>
        </Show>
        <Show when={props.accessory === "freckles"}>
          <circle cx="32" cy="56" r="0.8" fill="#c97a52"></circle>
          <circle cx="35" cy="58" r="0.8" fill="#c97a52"></circle>
          <circle cx="30" cy="59" r="0.8" fill="#c97a52"></circle>
          <circle cx="68" cy="56" r="0.8" fill="#c97a52"></circle>
          <circle cx="65" cy="58" r="0.8" fill="#c97a52"></circle>
          <circle cx="70" cy="59" r="0.8" fill="#c97a52"></circle>
        </Show>
        <Show when={props.accessory === "headphones"}>
          <path
            d="M 18 50 Q 20 20 50 18 Q 80 20 82 50"
            stroke="#343a40"
            stroke-width="4"
            fill="none"
          ></path>
          <rect
            x="12"
            y="46"
            width="10"
            height="16"
            rx="4"
            fill="#495057"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></rect>
          <rect
            x="78"
            y="46"
            width="10"
            height="16"
            rx="4"
            fill="#495057"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></rect>
        </Show>
        <Show when={props.accessory === "scarf"}>
          <path
            d="M 32 76 Q 50 88 68 76 L 68 82 Q 50 94 32 82 Z"
            fill="#e64980"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1"
          ></path>
          <path d="M 60 80 L 64 92 L 56 90 Z" fill="#c2255c"></path>
        </Show>

        <Show when={props.hat === "cap"}>
          <path
            d="M 20 24 Q 50 4 80 24 L 80 28 L 20 28 Z"
            fill="#364fc7"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.2"
          ></path>
          <rect
            x="14"
            y="24"
            width="24"
            height="6"
            rx="3"
            fill="#2f3ea8"
          ></rect>
          <circle cx="50" cy="9" r="2" fill="#2f3ea8"></circle>
        </Show>
        <Show when={props.hat === "beanie"}>
          <path
            d="M 20 26 Q 50 -2 80 26 Z"
            fill="#2f9e44"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.2"
          ></path>
          <rect
            x="18"
            y="22"
            width="64"
            height="8"
            rx="4"
            fill="#2b8a3e"
          ></rect>
          <circle cx="50" cy="4" r="4" fill="#f5f5f5"></circle>
        </Show>
        <Show when={props.hat === "party"}>
          <path
            d="M 50 2 L 68 30 L 32 30 Z"
            fill="#f06595"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.2"
          ></path>
          <path
            d="M 43 18 L 47 30 L 41 30 Z"
            fill="#ffd43b"
            opacity="0.9"
          ></path>
          <path
            d="M 57 18 L 53 30 L 59 30 Z"
            fill="#4dabf7"
            opacity="0.9"
          ></path>
          <circle cx="50" cy="4" r="3.5" fill="#ffd43b"></circle>
        </Show>
        <Show when={props.hat === "crown"}>
          <path
            d="M 26 28 L 32 10 L 42 22 L 50 6 L 58 22 L 68 10 L 74 28 Z"
            fill="#fab005"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.2"
          ></path>
          <circle cx="32" cy="14" r="2" fill="#e64980"></circle>
          <circle cx="50" cy="10" r="2.2" fill="#4dabf7"></circle>
          <circle cx="68" cy="14" r="2" fill="#40c057"></circle>
        </Show>
        <Show when={props.hat === "headband"}>
          <path
            d="M 16 32 Q 50 12 84 32"
            stroke="#e64980"
            stroke-width="6"
            fill="none"
            stroke-linecap="round"
          ></path>
          <circle cx="50" cy="17" r="3" fill="#c2255c"></circle>
        </Show>
        <Show when={props.hat === "halo"}>
          <ellipse
            cx="50"
            cy="10"
            rx="15"
            ry="4.5"
            fill="none"
            stroke="#ffd43b"
            stroke-width="3"
            opacity="0.9"
          ></ellipse>
        </Show>
        <Show when={props.hat === "wizard"}>
          <path
            d="M 50 2 L 66 28 L 34 28 Z"
            fill="#5f3dc4"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.2"
          ></path>
          <rect
            x="28"
            y="26"
            width="44"
            height="5"
            rx="2"
            fill="#4c2889"
          ></rect>
          <path
            d="M 50 2 L 51.5 5.5 L 55 7 L 51.5 8.5 L 50 12 L 48.5 8.5 L 45 7 L 48.5 5.5 Z"
            fill="#ffd43b"
          ></path>
        </Show>
        <Show when={props.hat === "pumpkin"}>
          <path
            d="M 26 28 Q 50 8 74 28 Z"
            fill="#f76707"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.2"
          ></path>
          <path
            d="M 34 24 Q 50 10 66 24"
            stroke="#d9480f"
            stroke-width="1.5"
            fill="none"
          ></path>
          <path
            d="M 50 6 Q 50 -2 54 -4"
            stroke="#2b8a3e"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
          ></path>
        </Show>
        <Show when={props.hat === "santa"}>
          <path
            d="M 22 28 Q 30 4 66 8 Q 74 10 74 22 L 74 28 Z"
            fill="#e03131"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.2"
          ></path>
          <rect
            x="16"
            y="24"
            width="64"
            height="7"
            rx="3.5"
            fill="#f8f9fa"
          ></rect>
          <circle cx="74" cy="10" r="5" fill="#f8f9fa"></circle>
        </Show>

        <Show when={props.hat === "cap-square"}>
          <path
            d="M 16 18 Q 50 2 84 18 L 84 22 L 16 22 Z"
            fill="#364fc7"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.2"
          ></path>
          <rect
            x="10"
            y="18"
            width="24"
            height="6"
            rx="3"
            fill="#2f3ea8"
          ></rect>
          <circle cx="50" cy="4" r="2" fill="#2f3ea8"></circle>
        </Show>
        <Show when={props.hat === "beanie-square"}>
          <path
            d="M 16 20 Q 50 -4 84 20 Z"
            fill="#2f9e44"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.2"
          ></path>
          <rect
            x="14"
            y="16"
            width="72"
            height="8"
            rx="2"
            fill="#2b8a3e"
          ></rect>
          <circle cx="50" cy="4" r="4" fill="#f5f5f5"></circle>
        </Show>
        <Show when={props.hat === "party-square"}>
          <path
            d="M 50 2 L 66 24 L 34 24 Z"
            fill="#f06595"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.2"
          ></path>
          <path
            d="M 44 14 L 47 24 L 41 24 Z"
            fill="#ffd43b"
            opacity="0.9"
          ></path>
          <path
            d="M 56 14 L 53 24 L 59 24 Z"
            fill="#4dabf7"
            opacity="0.9"
          ></path>
          <circle cx="50" cy="4" r="3.5" fill="#ffd43b"></circle>
        </Show>
        <Show when={props.hat === "headband-square"}>
          <path
            d="M 14 28 Q 50 10 86 28"
            stroke="#e64980"
            stroke-width="6"
            fill="none"
            stroke-linecap="round"
          ></path>
          <circle cx="50" cy="14" r="3" fill="#c2255c"></circle>
        </Show>

        <Show when={props.hat === "cap-oval"}>
          <path
            d="M 22 24 Q 50 6 78 24 L 78 28 L 22 28 Z"
            fill="#364fc7"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.2"
          ></path>
          <rect
            x="16"
            y="24"
            width="22"
            height="6"
            rx="3"
            fill="#2f3ea8"
          ></rect>
          <circle cx="50" cy="9" r="2" fill="#2f3ea8"></circle>
        </Show>
        <Show when={props.hat === "headband-oval"}>
          <path
            d="M 18 32 Q 50 14 82 32"
            stroke="#e64980"
            stroke-width="6"
            fill="none"
            stroke-linecap="round"
          ></path>
          <circle cx="50" cy="17" r="3" fill="#c2255c"></circle>
        </Show>

        <Show when={props.hat === "cap-hexagon"}>
          <path
            d="M 30 13 Q 50 -2 70 13 L 70 17 L 30 17 Z"
            fill="#364fc7"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.2"
          ></path>
          <rect
            x="24"
            y="13"
            width="20"
            height="6"
            rx="3"
            fill="#2f3ea8"
          ></rect>
          <circle cx="50" cy="3" r="2" fill="#2f3ea8"></circle>
        </Show>
        <Show when={props.hat === "headband-hexagon"}>
          <path
            d="M 20 24 Q 50 6 80 24"
            stroke="#e64980"
            stroke-width="6"
            fill="none"
            stroke-linecap="round"
          ></path>
          <circle cx="50" cy="10" r="3" fill="#c2255c"></circle>
        </Show>

        <Show when={props.hat === "cap-cloud"}>
          <path
            d="M 20 20 Q 50 2 80 20 L 80 24 L 20 24 Z"
            fill="#364fc7"
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.2"
          ></path>
          <rect
            x="14"
            y="20"
            width="24"
            height="6"
            rx="3"
            fill="#2f3ea8"
          ></rect>
          <circle cx="50" cy="5" r="2" fill="#2f3ea8"></circle>
        </Show>
        <Show when={props.hat === "headband-cloud"}>
          <path
            d="M 16 28 Q 50 8 84 28"
            stroke="#e64980"
            stroke-width="6"
            fill="none"
            stroke-linecap="round"
          ></path>
          <circle cx="50" cy="13" r="3" fill="#c2255c"></circle>
        </Show>
      </g>
    </svg>
  );
}
