import { Config } from "../config/store";
import { getCurrentInput } from "./events/data";
import * as TestState from "../test/test-state";
import { configEvent } from "../events/config";
import { Caret } from "../elements/caret";
import * as CompositionState from "../legacy-states/composition";
import { qsr } from "../utils/dom";
import {
  setActiveFinger,
  setActiveChar,
} from "../components/pages/test/AnimatedHands";
import { fingerForChar } from "../lessons/finger-map";
import * as TestWords from "./test-words";

export function stopAnimation(): void {
  caret.stopBlinking();
}

export function startAnimation(): void {
  caret.startBlinking();
}

export function hide(): void {
  caret.hide();
}

export function resetPosition(): void {
  caret.stopAllAnimations();
  caret.clearMargins();
  caret.goTo({
    wordIndex: 0,
    letterIndex: 0,
    isLanguageRightToLeft: TestState.isLanguageRightToLeft,
    isDirectionReversed: TestState.isDirectionReversed,
    animate: false,
  });
}

export function updatePosition(noAnim = false): void {
  const letterIndex =
    getCurrentInput().length + CompositionState.getData().length;
  caret.goTo({
    wordIndex: TestState.activeWordIndex,
    letterIndex,
    isLanguageRightToLeft: TestState.isLanguageRightToLeft,
    isDirectionReversed: TestState.isDirectionReversed,
    animate: Config.smoothCaret !== "off" && !noAnim,
  });

  if (Config.showGuidedHands) {
    const word = TestWords.words.getCurrentText();
    if (word && letterIndex < word.length) {
      const char = word[letterIndex] as string;
      setActiveFinger(fingerForChar(char) ?? null);
      setActiveChar(char);
    } else {
      setActiveFinger("thumb");
      setActiveChar(" ");
    }
  }
}

export const caret = new Caret(qsr("#caret"), Config.caretStyle);

configEvent.subscribe(({ key }) => {
  if (key === "caretStyle") {
    caret.setStyle(Config.caretStyle);
    updatePosition(true);
  }
  if (key === "smoothCaret") {
    caret.updateBlinkingAnimation();
  }
});

export function show(noAnim = false): void {
  caret.show();
  updatePosition(noAnim);
  startAnimation();
}
