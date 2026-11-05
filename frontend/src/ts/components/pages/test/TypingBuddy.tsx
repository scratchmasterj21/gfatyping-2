import { useQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createSignal,
  JSXElement,
  on,
  onCleanup,
  Show,
} from "solid-js";

import { getEquippedAvatar } from "../../../avatar/avatar-state";
import { restartTestEvent, typedCharEvent } from "../../../events/test";
import {
  getActivePage,
  getUserId,
  isAuthenticated,
} from "../../../states/core";
import { resultVisibleSignal } from "../../../test/test-state";
import { cn } from "../../../utils/cn";
import { Avatar } from "../../common/Avatar";
import { Fa } from "../../common/Fa";

const HIDDEN_KEY = "gfa_typing_buddy_hidden";
/** Correct characters in a row before the buddy cheers. */
const STREAK_CHEER = 20;
/** Mistakes within MISTAKE_WINDOW_MS before the buddy encourages. */
const MISTAKES_FOR_HELP = 3;
const MISTAKE_WINDOW_MS = 6000;
/** Never talk more often than this, so it doesn't distract. */
const BUBBLE_GAP_MS = 7000;
const BUBBLE_MS = 2600;

const CHEERS = ["You're on fire! 🔥", "Nice typing! ⭐", "Keep it up! 💪"];
const HELP = [
  "Slow down a little 🐢",
  "Eyes on the screen 👀",
  "You've got this! 💪",
];
const DONE = ["You did it! 🎉", "Great job! 🌟", "Awesome! 🏆"];

const pick = (list: string[]): string =>
  list[Math.floor(Math.random() * list.length)] ?? "";

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The student's own avatar in the corner of the typing page: smiles at a
 * good streak, looks surprised at a mistake, encourages after a few
 * mistakes, and celebrates when the test is done. Can be hidden.
 */
export function TypingBuddy(): JSXElement {
  const [hidden, setHidden] = createSignal(readHidden());
  const [face, setFace] = createSignal<string | undefined>();
  const [bubble, setBubble] = createSignal<string | undefined>();

  const visible = (): boolean =>
    isAuthenticated() && getActivePage() === "test" && !hidden();

  const avatarQuery = useQuery(() => ({
    queryKey: ["houseEquippedAvatar", getUserId()],
    queryFn: async () => getEquippedAvatar(getUserId() ?? ""),
    enabled: visible() && getUserId() !== null,
    staleTime: 5 * 60 * 1000,
  }));

  let streak = 0;
  let mistakes: number[] = [];
  let lastBubbleAt = 0;
  let faceTimer: ReturnType<typeof setTimeout> | undefined;
  let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    clearTimeout(faceTimer);
    clearTimeout(bubbleTimer);
  });

  const showFace = (f: string, ms: number): void => {
    setFace(f);
    clearTimeout(faceTimer);
    faceTimer = setTimeout(() => setFace(undefined), ms);
  };
  const say = (text: string, force = false): void => {
    const now = Date.now();
    if (!force && now - lastBubbleAt < BUBBLE_GAP_MS) return;
    lastBubbleAt = now;
    setBubble(text);
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => setBubble(undefined), BUBBLE_MS);
  };
  const reset = (): void => {
    streak = 0;
    mistakes = [];
    setFace(undefined);
    setBubble(undefined);
  };

  typedCharEvent.useListener(({ correct }) => {
    if (!visible()) return;
    if (correct) {
      streak++;
      if (streak > 0 && streak % STREAK_CHEER === 0) {
        showFace("laughing", 1500);
        say(pick(CHEERS));
      }
      return;
    }
    streak = 0;
    showFace("surprised", 700);
    const now = Date.now();
    mistakes = [...mistakes.filter((t) => now - t < MISTAKE_WINDOW_MS), now];
    if (mistakes.length >= MISTAKES_FOR_HELP) {
      mistakes = [];
      say(pick(HELP));
    }
  });
  restartTestEvent.useListener(reset);

  createEffect(
    on(resultVisibleSignal, (done) => {
      if (done) {
        showFace("starstruck", 4000);
        say(pick(DONE), true);
      } else {
        reset();
      }
    }),
  );

  const toggleHidden = (): void => {
    const next = !hidden();
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  return (
    <Show when={isAuthenticated() && getActivePage() === "test"}>
      <div class="pointer-events-none fixed bottom-4 left-4 z-20 flex items-end gap-2 font-kid">
        <Show
          when={!hidden()}
          fallback={
            <button
              type="button"
              class="pointer-events-auto grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-sub-alt text-sub opacity-60 hover:opacity-100"
              aria-label="Show my typing buddy"
              title="Show my typing buddy"
              onClick={toggleHidden}
            >
              <Fa icon="fa-smile" />
            </button>
          }
        >
          <div class="pointer-events-auto relative">
            <Avatar
              color={avatarQuery.data?.color}
              shape={avatarQuery.data?.shape}
              hair={avatarQuery.data?.hair}
              hat={avatarQuery.data?.hat}
              accessory={avatarQuery.data?.accessory}
              face={face() ?? avatarQuery.data?.face}
              background={avatarQuery.data?.background}
              highlightColor={avatarQuery.data?.highlight}
              animalImage={avatarQuery.data?.animalImage}
              celebrate={resultVisibleSignal() && face() === "starstruck"}
              size={64}
            />
            <button
              type="button"
              class="absolute -top-1 -left-1 grid h-5 w-5 cursor-pointer place-items-center rounded-full bg-sub-alt text-[10px] text-sub opacity-70 hover:opacity-100"
              aria-label="Hide my typing buddy"
              title="Hide"
              onClick={toggleHidden}
            >
              <Fa icon="fa-times" />
            </button>
          </div>
          <Show when={bubble()}>
            {(text) => (
              <div
                class={cn(
                  "mb-10 max-w-44 rounded-2xl rounded-bl-none bg-game-cream px-3 py-1.5 text-sm font-semibold text-game-ink shadow-lg",
                  "motion-safe:animate-game-pop",
                )}
              >
                {text()}
              </div>
            )}
          </Show>
        </Show>
      </div>
    </Show>
  );
}
