import { createSignal } from "solid-js";

import {
  isKeyboardSkinItemId,
  KeyboardSkinItemId,
} from "../../../keyboard-skins/keyboard-skin-items";

export type GuidedKeyboardStyle =
  | "flat"
  | "cartoon"
  | "modern"
  | "marble"
  | "rgb"
  | KeyboardSkinItemId;

type RgbMode = "wave" | "breathe" | "solid" | "static";
type RgbBrightness = "low" | "med" | "high";

export const FREE_KEYBOARD_STYLES: ReadonlySet<string> = new Set([
  "flat",
  "cartoon",
  "modern",
  "marble",
  "rgb",
]);

export function isGuidedKeyboardStyle(
  style: string,
): style is GuidedKeyboardStyle {
  return FREE_KEYBOARD_STYLES.has(style) || isKeyboardSkinItemId(style);
}

function loadKeyboardStyle(): GuidedKeyboardStyle {
  const stored = localStorage.getItem("keyboardGraphicStyle");
  return stored !== null && isGuidedKeyboardStyle(stored) ? stored : "marble";
}

export const [keyboardStyle, setKeyboardStyleSignal] =
  createSignal<GuidedKeyboardStyle>(loadKeyboardStyle());

export function setKeyboardStyle(style: GuidedKeyboardStyle): void {
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

export function keyboardShowColors(): boolean {
  return showKeyColors();
}

export function setKeyboardShowColors(val: boolean): void {
  setShowKeyColors(val);
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

export const [rgbMode, setRgbModeSignal] = createSignal<RgbMode>(loadRgbMode());
export const [rgbBrightness, setRgbBrightnessSignal] =
  createSignal<RgbBrightness>(loadRgbBrightness());

export function setRgbMode(mode: RgbMode): void {
  localStorage.setItem("rgbMode", mode);
  setRgbModeSignal(mode);
}

export function setRgbBrightness(b: RgbBrightness): void {
  localStorage.setItem("rgbBrightness", b);
  setRgbBrightnessSignal(b);
}
