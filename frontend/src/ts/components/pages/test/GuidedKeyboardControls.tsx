import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import { getConfig } from "../../../config/store";
import { KeyboardSkinItemId } from "../../../keyboard-skins/keyboard-skin-items";
import { getKeyboardSkinState } from "../../../keyboard-skins/keyboard-skin-state";
import { getActivePage, getUserId } from "../../../states/core";
import { showModal } from "../../../states/modals";
import { getFocus } from "../../../states/test";
import { resultVisibleSignal } from "../../../test/test-state";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";
import { FingerLegendRow } from "./FingerLegendRow";
import {
  keyboardShowColors,
  keyboardStyle,
  rgbBrightness,
  rgbMode,
  setKeyboardShowColors,
  setKeyboardStyle,
  setRgbBrightness,
  setRgbMode,
  type GuidedKeyboardStyle,
} from "./guided-keyboard-prefs";

const STYLES: GuidedKeyboardStyle[] = [
  "flat",
  "cartoon",
  "modern",
  "marble",
  "rgb",
  "wood",
  "glass",
];
const LABELS: Record<GuidedKeyboardStyle, string> = {
  flat: "Classic",
  cartoon: "Cartoon",
  modern: "Modern",
  marble: "Marble",
  rgb: "RGB",
  wood: "Wood",
  glass: "Glass",
};

const RGB_MODES = ["wave", "breathe", "solid", "static"] as const;
const RGB_MODE_LABELS: Record<(typeof RGB_MODES)[number], string> = {
  wave: "Wave",
  breathe: "Breathe",
  solid: "Solid",
  static: "Static",
};
const BRIGHTNESS_STEPS = ["low", "med", "high"] as const;

const isSkinStyle = (style: GuidedKeyboardStyle): style is KeyboardSkinItemId =>
  style === "wood" || style === "glass";

/** Style picker + finger legend — footer slot above Keytips during guided-hands tests. */
export function GuidedKeyboardControls(): JSXElement {
  const visible = (): boolean =>
    getActivePage() === "test" &&
    getConfig.showGuidedHands &&
    !resultVisibleSignal();

  const keyboardSkinStateQuery = useQuery(() => ({
    queryKey: ["keyboardSkinState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) return { coins: 0, ownedSkins: {} };
      return getKeyboardSkinState(uid);
    },
    staleTime: 0,
  }));
  const isSkinOwned = (id: KeyboardSkinItemId): boolean =>
    keyboardSkinStateQuery.data?.ownedSkins[id] === true;

  return (
    <Show when={visible()}>
      <div
        class="mx-auto mb-4 flex w-full max-w-[900px] flex-col items-center transition-opacity md:max-w-[650px] xl:max-w-[900px]"
        classList={{
          "opacity-0": getFocus(),
        }}
      >
        <div class="flex flex-wrap justify-center gap-2">
          <For each={STYLES}>
            {(style) => {
              const locked = (): boolean =>
                isSkinStyle(style) && !isSkinOwned(style);
              return (
                <button
                  type="button"
                  class={cn(
                    "rounded px-3 py-0.5 text-sm transition-colors",
                    keyboardStyle() === style
                      ? "bg-main text-bg"
                      : "bg-sub-alt text-sub hover:text-text",
                    locked() && "opacity-60",
                  )}
                  onClick={() => {
                    if (locked()) {
                      showModal("KeyboardSkinShop");
                      return;
                    }
                    setKeyboardStyle(style);
                  }}
                >
                  <Show when={locked()}>
                    <Fa icon="fa-lock" size={0.65} class="mr-1" />
                  </Show>
                  {LABELS[style]}
                </button>
              );
            }}
          </For>
          <div class="mx-1 w-px bg-sub opacity-40"></div>
          <button
            type="button"
            class={cn(
              "rounded px-3 py-0.5 text-sm transition-colors",
              keyboardShowColors()
                ? "bg-main text-bg"
                : "bg-sub-alt text-sub hover:text-text",
            )}
            onClick={() => setKeyboardShowColors(!keyboardShowColors())}
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
        <Show when={keyboardShowColors()}>
          <FingerLegendRow class="!mt-2" />
        </Show>
      </div>
    </Show>
  );
}
