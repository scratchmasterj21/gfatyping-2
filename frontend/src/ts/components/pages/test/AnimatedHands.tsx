import {
  createSignal,
  createEffect,
  onCleanup,
  JSXElement,
  Show,
  For,
} from "solid-js";

// eslint-disable-next-line no-restricted-imports
import handsSvgRaw from "../../../../assets/hands.svg?raw";
// eslint-disable-next-line no-restricted-imports
import cartoonKeyboardSvgRaw from "../../../../assets/keyboard-cartoon.svg?raw";
// eslint-disable-next-line no-restricted-imports
import marbleKeyboardSvgRaw from "../../../../assets/keyboard-marble.svg?raw";
// eslint-disable-next-line no-restricted-imports
import modernKeyboardSvgRaw from "../../../../assets/keyboard-modern.svg?raw";
// eslint-disable-next-line no-restricted-imports
import keyboardSvgRaw from "../../../../assets/keyboard.svg?raw";
import { getConfig } from "../../../config/store";
import { fingerForChar, Finger } from "../../../lessons/finger-map";
import { cn } from "../../../utils/cn";
import { generateMechanicalKeyboardSvg } from "./mechanical-keyboard-svg";

export const [activeFinger, setActiveFinger] = createSignal<Finger | null>(
  null,
);
export const [activeChar, setActiveChar] = createSignal<string | null>(null);

type KeyboardStyle = "flat" | "cartoon" | "modern" | "marble" | "rgb";
type RgbMode = "wave" | "breathe" | "solid" | "static";
type RgbBrightness = "low" | "med" | "high";

function loadKeyboardStyle(): KeyboardStyle {
  const stored = localStorage.getItem("keyboardGraphicStyle");
  if (
    stored === "cartoon" ||
    stored === "modern" ||
    stored === "marble" ||
    stored === "rgb"
  ) {
    return stored;
  }
  return "flat";
}

const [keyboardStyle, setKeyboardStyleSignal] =
  createSignal<KeyboardStyle>(loadKeyboardStyle());

function setKeyboardStyle(style: KeyboardStyle): void {
  localStorage.setItem("keyboardGraphicStyle", style);
  setKeyboardStyleSignal(style);
}

const [showKeyColors, setShowKeyColorsSignal] = createSignal<boolean>(
  localStorage.getItem("keyboardShowColors") !== "false",
);

function setShowKeyColors(val: boolean): void {
  localStorage.setItem("keyboardShowColors", String(val));
  setShowKeyColorsSignal(val);
}

function loadRgbMode(): RgbMode {
  const s = localStorage.getItem("rgbMode");
  if (s === "breathe" || s === "solid" || s === "static") return s;
  return "wave";
}

function loadRgbBrightness(): RgbBrightness {
  const s = localStorage.getItem("rgbBrightness");
  if (s === "low" || s === "high") return s;
  return "med";
}

const RGB_MODES: RgbMode[] = ["wave", "breathe", "solid", "static"];
const RGB_MODE_LABELS: Record<RgbMode, string> = {
  wave: "Wave",
  breathe: "Breathe",
  solid: "Solid",
  static: "Static",
};

const [rgbMode, setRgbModeSignal] = createSignal<RgbMode>(loadRgbMode());
const [rgbBrightness, setRgbBrightnessSignal] =
  createSignal<RgbBrightness>(loadRgbBrightness());

function setRgbMode(mode: RgbMode): void {
  localStorage.setItem("rgbMode", mode);
  setRgbModeSignal(mode);
}

function setRgbBrightness(b: RgbBrightness): void {
  localStorage.setItem("rgbBrightness", b);
  setRgbBrightnessSignal(b);
}

const BRIGHTNESS_STEPS: RgbBrightness[] = ["low", "med", "high"];

// Returns CSS overrides for the current RGB mode + brightness combination.
// Injected into the AnimatedHands <style> block only when rgb style is active.
function buildRgbOverrideCss(mode: RgbMode, brightness: RgbBrightness): string {
  const KEY_OP: Record<RgbBrightness, number> = {
    low: 0.18,
    med: 0.45,
    high: 0.75,
  };
  const UNDER_OP: Record<RgbBrightness, number> = {
    low: 0.3,
    med: 0.7,
    high: 1.0,
  };
  const BREATHE_MIN: Record<RgbBrightness, number> = {
    low: 0.04,
    med: 0.08,
    high: 0.12,
  };
  const BREATHE_MAX: Record<RgbBrightness, number> = {
    low: 0.35,
    med: 0.9,
    high: 1.0,
  };

  // Opacity override for non-breathe modes
  const opCss =
    brightness === "med"
      ? ""
      : `.mech-rgb-key-glow{opacity:${KEY_OP[brightness]}!important}` +
        `.mech-rgb-under{opacity:${UNDER_OP[brightness]}!important}`;

  if (mode === "wave") return opCss;

  if (mode === "static") return `.mech-rgb{animation:none}${opCss}`;

  if (mode === "breathe") {
    const mn = BREATHE_MIN[brightness];
    const mx = BREATHE_MAX[brightness];
    return (
      `@keyframes mech-rgb-breathe{0%,100%{opacity:${mn}}50%{opacity:${mx}}}` +
      `.mech-rgb-key-glow{animation:mech-rgb-breathe 2.5s ease-in-out infinite}` +
      `.mech-rgb-under{animation:mech-rgb-breathe 2.5s ease-in-out infinite}` +
      `.mech-rgb{animation:mech-rgb-wave 6s linear infinite}`
    );
  }

  // solid — all keys cycle the same hue simultaneously
  return `@keyframes mech-rgb-solid{from{filter:blur(3px) hue-rotate(0deg)}to{filter:blur(3px) hue-rotate(360deg)}}@keyframes mech-rgb-solid-under{from{filter:blur(9px) hue-rotate(0deg)}to{filter:blur(9px) hue-rotate(360deg)}}.mech-rgb{animation:none}.mech-rgb rect{fill:#ff2200}.mech-rgb-key-glow{animation:mech-rgb-solid 3s linear infinite}.mech-rgb-under{animation:mech-rgb-solid-under 3s linear infinite}${opCss}`;
}

// Per-style keypress flourish for the non-rgb styles (rgb has its own
// lighting via buildRgbOverrideCss). Reuses each style's activeKeySelector,
// the same hook activeHighlightCss() uses for the fill/stroke highlight.
function buildPressAnimationCss(
  style: KeyboardStyle,
  keyId: string | null,
): string {
  if (keyId === null || style === "rgb") return "";
  const sel = STYLE_CONFIG[style].activeKeySelector(keyId);
  // fill-box + center origin so keys scale from their own middle, not the SVG's.
  const base = `${sel}{transform-box:fill-box;transform-origin:center;}`;

  if (style === "flat") {
    return `${base}@keyframes press-classic{0%{transform:scale(1)}40%{transform:scale(0.92) translateY(1px)}100%{transform:scale(1)}}${sel}{animation:press-classic 120ms ease-out}`;
  }

  if (style === "cartoon") {
    return `${base}@keyframes press-cartoon{0%{transform:scale(1,1)}30%{transform:scale(1.18,0.82)}60%{transform:scale(0.9,1.12)}100%{transform:scale(1,1)}}${sel}{animation:press-cartoon 300ms cubic-bezier(.34,1.56,.64,1)}`;
  }

  if (style === "modern") {
    return `${base}@keyframes press-modern{0%{transform:scale(1);filter:none}50%{transform:scale(1.1);filter:drop-shadow(0 0 6px var(--main-color))}100%{transform:scale(1);filter:none}}${sel}{animation:press-modern 200ms ease-out}`;
  }

  // marble
  return `${base}@keyframes press-marble{0%{filter:brightness(1) scale(1)}45%{filter:brightness(1.4) scale(1.05)}100%{filter:brightness(1) scale(1)}}${sel}{animation:press-marble 220ms ease-out}`;
}

const KEY_TO_SVG_ID: Record<string, string> = {
  a: "a",
  b: "b",
  c: "c",
  d: "d",
  e: "e",
  f: "f",
  g: "g",
  h: "h",
  i: "i",
  j: "j",
  k: "k",
  l: "l",
  m: "m",
  n: "n",
  o: "o",
  p: "p",
  q: "q",
  r: "r",
  s: "s",
  t: "t",
  u: "u",
  v: "v",
  w: "w",
  x: "x",
  y: "y",
  z: "z",
  "0": "key-0",
  "1": "key-1",
  "2": "key-2",
  "3": "key-3",
  "4": "key-4",
  "5": "key-5",
  "6": "key-6",
  "7": "key-7",
  "8": "key-8",
  "9": "key-9",
  "-": "minus",
  "=": "equal",
  "[": "open-bracket",
  "]": "close-bracket",
  "\\": "backslash",
  ";": "semicolon",
  "'": "quote",
  ",": "comma",
  ".": "dot",
  "/": "slash",
  "`": "tilda",
  " ": "space",
};

// Finger palette — mirrors $finger-colors in keymap.scss
const FINGER_COLORS: Record<string, string> = {
  lp: "#ef4444",
  lr: "#f97316",
  lm: "#eab308",
  li: "#22c55e",
  ri: "#14b8a6",
  rm: "#3b82f6",
  rr: "#8b5cf6",
  rp: "#ec4899",
};

function buildFingerCss(selector: (svgId: string) => string): string {
  const rules: string[] = [];
  for (const [char, svgId] of Object.entries(KEY_TO_SVG_ID)) {
    if (char === " ") continue;
    const finger = fingerForChar(char);
    if (finger === undefined || finger === "thumb") continue;
    const color = FINGER_COLORS[finger];
    if (color !== undefined) {
      rules.push(`${selector(svgId)}{fill:${color}}`);
    }
  }
  return rules.join(" ");
}

const PATH_ID_SELECTOR = (id: string): string =>
  `#animatedKeyboard-svg svg path#${id}`;
const CARTOON_SELECTOR = (id: string): string =>
  `#animatedKeyboard-svg svg g#${id} path.on`;
const MARBLE_SELECTOR = (id: string): string =>
  `#animatedKeyboard-svg svg g#${id} path.background, #animatedKeyboard-svg svg g#${id} path.upper-shadow`;
const RGB_SELECTOR = (id: string): string =>
  `#animatedKeyboard-svg svg #${id} .key-top`;

// Build finger-color CSS per style at module load (runs once, not per render).
const FLAT_FINGER_CSS = buildFingerCss(PATH_ID_SELECTOR);
const CARTOON_FINGER_CSS = buildFingerCss(CARTOON_SELECTOR);
const MODERN_FINGER_CSS = buildFingerCss(PATH_ID_SELECTOR); // same selector as flat
const MARBLE_FINGER_CSS = buildFingerCss(MARBLE_SELECTOR);
const RGB_FINGER_CSS = buildFingerCss(RGB_SELECTOR);

const rgbKeyboardSvgRaw = generateMechanicalKeyboardSvg();

type StyleConfig = {
  svgRaw: string;
  /** CSS aspect-ratio value matching the SVG viewBox */
  aspectRatio: string;
  activeKeySelector: (id: string) => string;
  fingerCss: string;
  /** Extra CSS to override .edc-st1 visibility (empty = let SVG handle it) */
  edcSt1Css: string;
  hands: { width: string; left: string; top: string };
};

const STYLE_CONFIG: Record<KeyboardStyle, StyleConfig> = {
  flat: {
    svgRaw: keyboardSvgRaw,
    aspectRatio: "683.3 / 254",
    activeKeySelector: PATH_ID_SELECTOR,
    fingerCss: FLAT_FINGER_CSS,
    edcSt1Css:
      "#animatedKeyboard-svg svg .edc-st1 { opacity: 0.9; fill: #1a1a1a; }",
    hands: { width: "82.06%", left: "4.95%", top: "-40.69%" },
  },
  cartoon: {
    svgRaw: cartoonKeyboardSvgRaw,
    aspectRatio: "683.3 / 254",
    activeKeySelector: CARTOON_SELECTOR,
    fingerCss: CARTOON_FINGER_CSS,
    edcSt1Css: "",
    hands: { width: "82.5%", left: "1%", top: "-37%" },
  },
  modern: {
    svgRaw: modernKeyboardSvgRaw,
    // viewBox "330 -124 683.3 263" → aspect ratio 683.3 / 263
    aspectRatio: "683.3 / 263",
    activeKeySelector: PATH_ID_SELECTOR,
    fingerCss: MODERN_FINGER_CSS,
    edcSt1Css: "",
    // F center: (583.4-330)/683.3=37.1%, J center: (718.4-330)/683.3=56.8%
    // top = (F_y% × containerH - fingertip_offset) / containerH ≈ -34.7%
    hands: { width: "82%", left: "4.9%", top: "-34.7%" },
  },
  marble: {
    svgRaw: marbleKeyboardSvgRaw,
    aspectRatio: "683.3 / 254",
    // key groups: <g id="f"><path class="background">
    activeKeySelector: MARBLE_SELECTOR,
    fingerCss: MARBLE_FINGER_CSS,
    edcSt1Css:
      "#animatedKeyboard-svg svg .edc-st2 { fill: var(--text-color) !important; }",
    // translate(-59,-18) on keys; F raw center (308.75,149.2) → (249.75,131.2)
    // 36.55% horiz; top ≈ -37.7% of container H
    hands: { width: "82%", left: "4.3%", top: "-37.7%" },
  },
  rgb: {
    svgRaw: rgbKeyboardSvgRaw,
    // viewBox 658 × 238 — generated by mechanical-keyboard-svg.ts
    aspectRatio: "658 / 238",
    activeKeySelector: RGB_SELECTOR,
    fingerCss: RGB_FINGER_CSS,
    edcSt1Css: "",
    hands: { width: "82.06%", left: "4.95%", top: "-40.69%" },
  },
};

// Pre-crop the hands SVG viewBox at module load time to remove empty whitespace.
// Original viewBox: "0 0 716.3 380" — actual hand content runs from x=100 to x=490.
// Cropping to "100 0 390 380" removes the dead margins so sizing math works correctly.
const croppedHandsSvgRaw = handsSvgRaw.replace(
  /viewBox="[^"]*"/,
  'viewBox="100 0 390 380"',
);

export function AnimatedHands(): JSXElement {
  const [activeLeftId, setActiveLeftId] = createSignal<string>("neutral-left");
  const [activeRightId, setActiveRightId] =
    createSignal<string>("neutral-right");

  createEffect(() => {
    const finger = activeFinger();
    const char = activeChar();

    if (finger === null || char === null || char === "") {
      setActiveLeftId("neutral-left");
      setActiveRightId("neutral-right");
      return;
    }

    const svgId = KEY_TO_SVG_ID[char.toLowerCase()] ?? null;

    if (svgId === null) {
      setActiveLeftId("neutral-left");
      setActiveRightId("neutral-right");
      return;
    }

    const isLeft = finger.startsWith("l");
    const isRight = finger.startsWith("r");

    if (svgId === "space" || finger === "thumb") {
      setActiveLeftId("neutral-left");
      setActiveRightId("space");
    } else if (isLeft) {
      setActiveLeftId(svgId);
      setActiveRightId("neutral-right");
    } else if (isRight) {
      setActiveRightId(svgId);
      setActiveLeftId("neutral-left");
    } else {
      setActiveLeftId("neutral-left");
      setActiveRightId("neutral-right");
    }
  });

  const activeKeyId = (): string | null => {
    const char = activeChar();
    if (char === null || char === "") return null;
    return KEY_TO_SVG_ID[char.toLowerCase()] ?? null;
  };

  createEffect(() => {
    const keymapEl = document.getElementById("keymap");
    if (keymapEl) {
      keymapEl.style.display = getConfig.showGuidedHands ? "none" : "";
    }
  });

  onCleanup(() => {
    const keymapEl = document.getElementById("keymap");
    if (keymapEl) keymapEl.style.display = "";
  });

  const config = (): StyleConfig => STYLE_CONFIG[keyboardStyle()];

  const pressAnimationCss = (): string =>
    buildPressAnimationCss(keyboardStyle(), activeKeyId());

  const rgbCss = (): string => {
    if (keyboardStyle() !== "rgb") return "";
    return buildRgbOverrideCss(rgbMode(), rgbBrightness());
  };

  const activeHighlightCss = (): string => {
    const keyId = activeKeyId();
    if (keyId === null) return "";
    const sel = config().activeKeySelector(keyId);
    return `${sel} { fill: var(--main-color) !important; stroke: var(--sub-color) !important; stroke-width: 2px !important; }`;
  };

  const STYLES: KeyboardStyle[] = [
    "flat",
    "cartoon",
    "modern",
    "marble",
    "rgb",
  ];
  const LABELS: Record<KeyboardStyle, string> = {
    flat: "Classic",
    cartoon: "Cartoon",
    modern: "Modern",
    marble: "Marble",
    rgb: "RGB",
  };

  return (
    <Show when={getConfig.showGuidedHands}>
      <div
        id="animatedHandsContainer"
        // Narrower between md and xl: at those widths #typingTest isn't much
        // wider than 900px, leaving no room for the side image panels
        // (positioned relative to #typingTest) before they collide with the
        // keyboard. Plenty of room again at xl+, so it relaxes back to 900px.
        class="max-w-[900px] md:max-w-[650px] xl:max-w-[900px]"
        style={{
          position: "relative",
          width: "100%",
          margin: "0 auto",
          "z-index": 10,
        }}
      >
        {/* Keyboard + hands — pointer-events-none so typing isn't blocked */}
        <div
          class="pointer-events-none"
          style={{
            position: "relative",
            width: "100%",
            "aspect-ratio": config().aspectRatio,
            overflow: "visible",
          }}
        >
          <style>
            {`
              #keymap {
                display: none !important;
              }

              #animatedKeyboard-svg svg {
                width: 100%;
                height: 100%;
                display: block;
                position: absolute;
                top: 0;
                left: 0;
              }

              #hands-wrapper {
                position: absolute;
                width: ${config().hands.width};
                left: ${config().hands.left};
                top: ${config().hands.top};
                overflow: visible;
              }

              #hands-wrapper svg {
                width: 100%;
                height: auto;
                display: block;
                overflow: visible;
              }

              #hands-wrapper g.st0 {
                display: none !important;
              }
              #hands-wrapper g#${activeLeftId()} {
                display: inline !important;
              }
              #hands-wrapper g#${activeRightId()} {
                display: inline !important;
              }

              ${showKeyColors() ? config().fingerCss : ""}

              ${config().edcSt1Css}

              ${activeHighlightCss()}

              ${pressAnimationCss()}

              ${rgbCss()}
            `}
          </style>

          {/* eslint-disable-next-line solid/no-innerhtml */}
          <div id="animatedKeyboard-svg" innerHTML={config().svgRaw}></div>

          {/* eslint-disable-next-line solid/no-innerhtml */}
          <div id="hands-wrapper" innerHTML={croppedHandsSvgRaw}></div>
        </div>

        {/* Style picker + color toggle */}
        <div class="mt-1 flex justify-center gap-2">
          <For each={STYLES}>
            {(style) => (
              <button
                type="button"
                class={cn(
                  "rounded px-3 py-0.5 text-sm transition-colors",
                  keyboardStyle() === style
                    ? "bg-main text-bg"
                    : "bg-sub-alt text-sub hover:text-text",
                )}
                onClick={() => setKeyboardStyle(style)}
              >
                {LABELS[style]}
              </button>
            )}
          </For>
          <div class="mx-1 w-px bg-sub opacity-40"></div>
          <button
            type="button"
            class={cn(
              "rounded px-3 py-0.5 text-sm transition-colors",
              showKeyColors()
                ? "bg-main text-bg"
                : "bg-sub-alt text-sub hover:text-text",
            )}
            onClick={() => setShowKeyColors(!showKeyColors())}
          >
            Colors
          </button>
          <Show when={keyboardStyle() === "rgb"}>
            <div class="mx-1 w-px bg-sub opacity-40"></div>
            <button
              type="button"
              class="rounded bg-sub-alt px-3 py-0.5 text-sm text-sub transition-colors hover:text-text"
              onClick={() => {
                const idx = RGB_MODES.indexOf(rgbMode());
                setRgbMode(RGB_MODES[(idx + 1) % RGB_MODES.length] ?? "wave");
              }}
            >
              {RGB_MODE_LABELS[rgbMode()]}
            </button>
            <button
              type="button"
              disabled={rgbBrightness() === "low"}
              class={cn(
                "rounded px-2 py-0.5 text-sm transition-colors",
                rgbBrightness() === "low"
                  ? "cursor-not-allowed bg-sub-alt text-sub opacity-30"
                  : "bg-sub-alt text-sub hover:text-text",
              )}
              onClick={() => {
                const idx = BRIGHTNESS_STEPS.indexOf(rgbBrightness());
                if (idx > 0) {
                  setRgbBrightness(BRIGHTNESS_STEPS[idx - 1] ?? "med");
                }
              }}
            >
              −
            </button>
            <button
              type="button"
              disabled={rgbBrightness() === "high"}
              class={cn(
                "rounded px-2 py-0.5 text-sm transition-colors",
                rgbBrightness() === "high"
                  ? "cursor-not-allowed bg-sub-alt text-sub opacity-30"
                  : "bg-sub-alt text-sub hover:text-text",
              )}
              onClick={() => {
                const idx = BRIGHTNESS_STEPS.indexOf(rgbBrightness());
                if (idx < BRIGHTNESS_STEPS.length - 1) {
                  setRgbBrightness(BRIGHTNESS_STEPS[idx + 1] ?? "med");
                }
              }}
            >
              +
            </button>
          </Show>
        </div>
      </div>
    </Show>
  );
}
