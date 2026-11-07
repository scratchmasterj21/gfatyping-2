import type { FontName } from "@monkeytype/schemas/fonts";

import { setConfig } from "../config/setters";
import { getConfig } from "../config/store";

/**
 * "Easy reading" - one switch in the account menu for kids who find the
 * typing text hard to read: a clear, wide font (Lexend, designed for reading
 * fluency) and bigger letters. Turning it off puts back what they had.
 */

export const EASY_READ_FONT: FontName = "Lexend_Deca";
export const EASY_READ_SIZE = 3.25;
const PREV_KEY = "gfaEasyReadPrev";

type Prev = { fontFamily: FontName; fontSize: number };

export function isEasyRead(): boolean {
  // the reactive store, so the menu label updates
  return (
    getConfig.fontFamily === EASY_READ_FONT &&
    getConfig.fontSize >= EASY_READ_SIZE
  );
}

function readPrev(): Prev | undefined {
  try {
    const raw = localStorage.getItem(PREV_KEY);
    if (raw === null) return undefined;
    const p = JSON.parse(raw) as Partial<Prev>;
    if (typeof p.fontFamily !== "string" || typeof p.fontSize !== "number") {
      return undefined;
    }
    return { fontFamily: p.fontFamily, fontSize: p.fontSize };
  } catch {
    return undefined;
  }
}

export function setEasyRead(on: boolean): void {
  if (on) {
    if (!isEasyRead()) {
      localStorage.setItem(
        PREV_KEY,
        JSON.stringify({
          fontFamily: getConfig.fontFamily,
          fontSize: getConfig.fontSize,
        } satisfies Prev),
      );
    }
    setConfig("fontFamily", EASY_READ_FONT);
    setConfig("fontSize", EASY_READ_SIZE);
    return;
  }
  const prev = readPrev();
  setConfig("fontFamily", prev?.fontFamily ?? "Roboto_Mono");
  setConfig("fontSize", prev?.fontSize ?? 2);
  localStorage.removeItem(PREV_KEY);
}
