import { loadFromLocalStorage } from "../config/lifecycle";
import { setConfig } from "../config/setters";
import { getConfig } from "../config/store";
import { navigationEvent } from "../events/navigation";
import { restartTestEvent } from "../events/test";
import { setActiveLesson } from "../lessons/lesson-progress";
import { getActivePage } from "../states/core";
import { games, FunboxGame } from "./games-data";

const gameIds = new Set<string>(
  games.filter((g) => g.type === "funbox").map((g) => g.id),
);

/** True when a game funbox is currently active. */
export function isGameActive(): boolean {
  return getConfig.funbox.some((f) => gameIds.has(f));
}

/**
 * Start a typing game: a plain words/english test with a single funbox active.
 * Uses `nosave` so the game settings never persist across reloads, and clears
 * any active lesson so the run is not recorded as lesson progress.
 */
export function startGame(game: FunboxGame): void {
  setActiveLesson(null);

  setConfig("mode", "words", { nosave: true });
  setConfig("language", "english", { nosave: true });
  setConfig("punctuation", false, { nosave: true });
  setConfig("numbers", false, { nosave: true });
  setConfig("words", 25, { nosave: true });
  setConfig("funbox", [game.id], { nosave: true });

  if (getActivePage() === "test") {
    restartTestEvent.dispatch();
  } else {
    navigationEvent.dispatch({ url: "/", options: {} });
  }
}

/**
 * Leave a game and restore the user's normal setup. Games are started with
 * `nosave`, so the saved config in local storage still holds the real
 * settings - reloading it reverts mode/language/funbox, then we restart.
 */
export async function exitGame(): Promise<void> {
  await loadFromLocalStorage();
  // configLS cache may include the game funbox if any config was saved during
  // the game session, so explicitly strip game funboxes from the restored config
  const cleaned = getConfig.funbox.filter((f) => !gameIds.has(f));
  if (cleaned.length !== getConfig.funbox.length) {
    setConfig("funbox", cleaned, { nosave: true });
  }
  navigationEvent.dispatch({ url: "/lessons", options: { force: true } });
}
