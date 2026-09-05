import { createSignal } from "solid-js";
import { ThemeName } from "@monkeytype/schemas/configs";
import { ColorName, Theme, themes } from "../constants/themes";

export type ThemeIdentifier = ThemeName | "custom";
const defaultTheme: Theme & { name: ThemeIdentifier } = {
  ...themes.viridescent,
  name: "viridescent",
};

export const [getTheme, setTheme] = createSignal(defaultTheme);

export function updateThemeColor(key: ColorName, color: string): void {
  setTheme((prev) => ({
    ...prev,
    [key]: color,
  }));
}
