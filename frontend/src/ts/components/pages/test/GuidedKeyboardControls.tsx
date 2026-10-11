import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import { getConfig } from "../../../config/store";
import { focusInputElement } from "../../../input/input-element";
import {
  KEYBOARD_SKIN_ITEMS,
  KeyboardSkinItemId,
} from "../../../keyboard-skins/keyboard-skin-items";
import { getKeyboardSkinState } from "../../../keyboard-skins/keyboard-skin-state";
import { getActivePage, getUserId } from "../../../states/core";
import { showModal } from "../../../states/modals";
import { getFocus } from "../../../states/test";
import { resultVisibleSignal } from "../../../test/test-state";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";
import { FingerLegendRow } from "./FingerLegendRow";
import {
  isGuideFolded,
  isPhoneWidth,
  keyboardShowColors,
  keyboardStyle,
  rgbBrightness,
  rgbMode,
  setGuideFolded,
  setKeyboardShowColors,
  setKeyboardStyle,
  setRgbBrightness,
  setRgbMode,
  type GuidedKeyboardStyle,
} from "./guided-keyboard-prefs";

const FREE_STYLES: GuidedKeyboardStyle[] = [
  "flat",
  "cartoon",
  "modern",
  "marble",
  "rgb",
];
const LABELS: Record<GuidedKeyboardStyle, string> = {
  flat: "Classic",
  cartoon: "Cartoon",
  modern: "Modern",
  marble: "Marble",
  rgb: "RGB",
  ...(Object.fromEntries(
    KEYBOARD_SKIN_ITEMS.map((skin) => [skin.id, skin.name]),
  ) as Record<KeyboardSkinItemId, string>),
};

const RGB_MODES = ["wave", "breathe", "solid", "static"] as const;
const RGB_MODE_LABELS: Record<(typeof RGB_MODES)[number], string> = {
  wave: "Wave",
  breathe: "Breathe",
  solid: "Solid",
  static: "Static",
};
const BRIGHTNESS_STEPS = ["low", "med", "high"] as const;

/** Taller on touch screens so small fingers hit the chip, not its neighbor. */
const CHIP =
  "rounded px-3 py-0.5 text-sm transition-colors pointer-coarse:min-h-10 pointer-coarse:px-4";

/** Runs a control, then hands focus back so the next key types (not swallowed by the refocus in global.ts). */
function thenType(action: () => void): () => void {
  return () => {
    action();
    focusInputElement(true);
  };
}

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
    // Only fetch while the test keyboard chrome is shown — not on every page
    // via the global footer (was burning Firestore reads with staleTime: 0).
    enabled: visible() && getUserId() !== null,
    staleTime: 5 * 60 * 1000,
  }));
  const isSkinOwned = (id: KeyboardSkinItemId): boolean =>
    keyboardSkinStateQuery.data?.ownedSkins[id] === true;
  // Owned skins sit with the free styles; the rest live behind the shop button.
  const styles = (): GuidedKeyboardStyle[] => [
    ...FREE_STYLES,
    ...KEYBOARD_SKIN_ITEMS.filter((skin) => isSkinOwned(skin.id)).map(
      (skin) => skin.id,
    ),
  ];
  const hasUnownedSkins = (): boolean =>
    KEYBOARD_SKIN_ITEMS.some((skin) => !isSkinOwned(skin.id));

  return (
    <Show when={visible()}>
      <div
        class="mx-auto mb-4 flex w-full max-w-[min(900px,88vh)] flex-col items-center transition-opacity md:max-w-[min(650px,88vh)] xl:max-w-[min(900px,88vh)]"
        classList={{
          "opacity-0": getFocus(),
        }}
      >
        <Show when={isPhoneWidth()}>
          <button
            type="button"
            class={cn(CHIP, "mb-2 bg-sub-alt text-sub hover:text-text")}
            onClick={thenType(() => setGuideFolded(!isGuideFolded()))}
          >
            <Fa
              icon={isGuideFolded() ? "fa-keyboard" : "fa-eye-slash"}
              size={0.75}
              class="mr-1.5"
            />
            {isGuideFolded() ? "show keyboard guide" : "hide keyboard guide"}
          </button>
        </Show>
        <Show when={!isGuideFolded()}>
          <div class="flex flex-wrap justify-center gap-2">
            <For each={styles()}>
              {(style) => (
                <button
                  type="button"
                  class={cn(
                    CHIP,
                    keyboardStyle() === style
                      ? "bg-main text-bg"
                      : "bg-sub-alt text-sub hover:text-text",
                  )}
                  onClick={thenType(() => setKeyboardStyle(style))}
                >
                  {LABELS[style]}
                </button>
              )}
            </For>
            <Show when={hasUnownedSkins()}>
              <button
                type="button"
                class={cn(
                  CHIP,
                  "bg-sub-alt text-sub opacity-80 hover:text-text",
                )}
                onClick={() => showModal("KeyboardSkinShop")}
              >
                <Fa icon="fa-store" size={0.65} class="mr-1" />
                skins
              </button>
            </Show>
            <div class="mx-1 w-px bg-sub opacity-40"></div>
            <button
              type="button"
              class={cn(
                CHIP,
                keyboardShowColors()
                  ? "bg-main text-bg"
                  : "bg-sub-alt text-sub hover:text-text",
              )}
              onClick={thenType(() =>
                setKeyboardShowColors(!keyboardShowColors()),
              )}
            >
              Colors
            </button>
            <Show when={keyboardStyle() === "rgb"}>
              <div class="mx-1 w-px bg-sub opacity-40"></div>
              <button
                type="button"
                class={cn(CHIP, "bg-sub-alt text-sub hover:text-text")}
                onClick={thenType(() => {
                  const idx = RGB_MODES.indexOf(rgbMode());
                  setRgbMode(RGB_MODES[(idx + 1) % RGB_MODES.length] ?? "wave");
                })}
              >
                {RGB_MODE_LABELS[rgbMode()]}
              </button>
              <button
                type="button"
                disabled={rgbBrightness() === "low"}
                class={cn(
                  "rounded px-2 py-0.5 text-sm transition-colors pointer-coarse:min-h-10 pointer-coarse:min-w-10",
                  rgbBrightness() === "low"
                    ? "cursor-not-allowed bg-sub-alt text-sub opacity-30"
                    : "bg-sub-alt text-sub hover:text-text",
                )}
                onClick={thenType(() => {
                  const idx = BRIGHTNESS_STEPS.indexOf(rgbBrightness());
                  if (idx > 0) {
                    setRgbBrightness(BRIGHTNESS_STEPS[idx - 1] ?? "med");
                  }
                })}
              >
                −
              </button>
              <button
                type="button"
                disabled={rgbBrightness() === "high"}
                class={cn(
                  "rounded px-2 py-0.5 text-sm transition-colors pointer-coarse:min-h-10 pointer-coarse:min-w-10",
                  rgbBrightness() === "high"
                    ? "cursor-not-allowed bg-sub-alt text-sub opacity-30"
                    : "bg-sub-alt text-sub hover:text-text",
                )}
                onClick={thenType(() => {
                  const idx = BRIGHTNESS_STEPS.indexOf(rgbBrightness());
                  if (idx < BRIGHTNESS_STEPS.length - 1) {
                    setRgbBrightness(BRIGHTNESS_STEPS[idx + 1] ?? "med");
                  }
                })}
              >
                +
              </button>
            </Show>
          </div>
          <Show when={keyboardShowColors()}>
            <FingerLegendRow class="!mt-2" />
          </Show>
        </Show>
      </div>
    </Show>
  );
}
