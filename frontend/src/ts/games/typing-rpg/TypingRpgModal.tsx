import type Phaser from "phaser";

import {
  createEffect,
  createSignal,
  JSXElement,
  onCleanup,
  Show,
} from "solid-js";

import { UserAvatar } from "../../components/common/UserAvatar";
import { getAuthenticatedUser } from "../../firebase";
import { realWords } from "../../lessons/lessons-data";
import { showErrorNotification } from "../../states/notifications";
import { cn } from "../../utils/cn";
import { createTypingRpgGame } from "./game-config";
import { prepareRpgWords } from "./rpg-words";
import { claimTypingQuestReward, TypingQuestReward } from "./typing-rpg-reward";

type Battle = {
  name: string;
  word: string;
  hp: number;
  maxHp: number;
  playerHp: number;
  stage: "typing" | "enemy";
  ready: boolean;
  seconds: number;
  wordsTyped: number;
  mistakesThisTurn: number;
  turn: number;
  message?: string;
};
type Result = {
  score: number;
  elapsed: number;
  hits: number;
  mistakes: number;
};
type Position = { x: number; y: number; size: number };
type Impact = { target: "player" | "monster" | "power"; label: string };
type Direction = "up" | "down" | "left" | "right";

type Props = {
  open: boolean;
  onClose: () => void;
  onResult?: (score: number) => void;
};

function MonsterPortrait(props: { name: string }): JSXElement {
  const guardian = () => props.name === "Gate Guardian";
  const imp = () => props.name === "Forest Imp";
  return (
    <svg
      viewBox="0 0 80 80"
      role="img"
      aria-label={`${props.name} portrait`}
      class={cn(
        "h-20 w-20 drop-shadow-lg",
        guardian() ? "text-error" : "text-main",
      )}
    >
      <Show when={imp() || guardian()}>
        <path d="M16 30 10 8 30 24M64 30 70 8 50 24" fill="currentColor"></path>
      </Show>
      <Show
        when={guardian()}
        fallback={
          <path
            d="M10 54Q8 27 30 20Q54 12 69 38L72 63Q62 72 53 64Q42 75 31 65Q17 73 10 54Z"
            fill="currentColor"
          ></path>
        }
      >
        <path
          d="M40 14 65 25 64 53 40 72 16 53 15 25Z"
          fill="currentColor"
        ></path>
      </Show>
      <ellipse cx="29" cy="43" rx="5" ry="7" class="fill-bg"></ellipse>
      <ellipse cx="51" cy="43" rx="5" ry="7" class="fill-bg"></ellipse>
      <circle cx="30" cy="44" r="2" class="fill-text"></circle>
      <circle cx="50" cy="44" r="2" class="fill-text"></circle>
      <path
        d="M33 57Q40 62 47 57"
        fill="none"
        class="stroke-bg"
        stroke-width="3"
        stroke-linecap="round"
      ></path>
    </svg>
  );
}

export function TypingRpgModal(props: Props): JSXElement {
  const [phase, setPhase] = createSignal<
    "intro" | "loading" | "playing" | "results" | "defeated"
  >("intro");
  const [battle, setBattle] = createSignal<Battle | null>(null);
  const [typed, setTyped] = createSignal("");
  const [wrongKey, setWrongKey] = createSignal(false);
  const [prompt, setPrompt] = createSignal("");
  const [objective, setObjective] = createSignal("Defeat the monsters · 0/3");
  const [dialogue, setDialogue] = createSignal<string | null>(null);
  const [position, setPosition] = createSignal<Position>();
  const [result, setResult] = createSignal<Result>();
  const [reward, setReward] = createSignal<
    TypingQuestReward | "pending" | "error"
  >();
  const [impact, setImpact] = createSignal<Impact | null>(null);
  let containerRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;
  let game: Phaser.Game | null = null;
  let latestBattle: Battle | null = null;
  let cachedWords: string[] | undefined;
  let impactTimeout: ReturnType<typeof setTimeout> | undefined;
  let wrongKeyTimeout: ReturnType<typeof setTimeout> | undefined;
  let runId = 0;
  let pointerStartedAt = 0;

  const startMoving = (direction: Direction): void => {
    pointerStartedAt = performance.now();
    game?.events.emit("rpg-move-start", direction);
  };
  const stopMoving = (direction: Direction): void => {
    game?.events.emit("rpg-move-stop", direction);
  };
  const nudgeOnTap = (direction: Direction, detail: number): void => {
    if (detail === 0 || performance.now() - pointerStartedAt < 150) {
      game?.events.emit("rpg-nudge", direction);
    }
  };

  const showImpact = (next: Impact): void => {
    if (impactTimeout !== undefined) clearTimeout(impactTimeout);
    setImpact(next);
    impactTimeout = setTimeout(() => {
      setImpact(null);
      impactTimeout = undefined;
    }, 550);
  };
  const rewardMessage = (): string => {
    const claim = reward();
    if (claim === "pending" || claim === undefined) {
      return "Claiming quest coins…";
    }
    if (claim === "error") {
      return "Could not confirm the coin reward. Check your balance.";
    }
    return "This run's coin reward has already been claimed.";
  };
  const rewardClaim = (): TypingQuestReward | undefined => {
    const claim = reward();
    return typeof claim === "object" ? claim : undefined;
  };

  const cleanup = (): void => {
    runId++;
    if (impactTimeout !== undefined) clearTimeout(impactTimeout);
    if (wrongKeyTimeout !== undefined) clearTimeout(wrongKeyTimeout);
    wrongKeyTimeout = undefined;
    setWrongKey(false);
    impactTimeout = undefined;
    setImpact(null);
    game?.destroy(true);
    game = null;
    latestBattle = null;
    setBattle(null);
    setDialogue(null);
    setTyped("");
    setObjective("Defeat the monsters · 0/3");
    setPosition(undefined);
    setResult(undefined);
    setReward(undefined);
    setPhase("intro");
  };

  const start = async (): Promise<void> => {
    if (phase() === "loading") return;
    runId++;
    const thisRun = runId;
    const rewardRunId = crypto.randomUUID();
    const onResult = props.onResult;
    game?.destroy(true);
    if (impactTimeout !== undefined) clearTimeout(impactTimeout);
    if (wrongKeyTimeout !== undefined) clearTimeout(wrongKeyTimeout);
    wrongKeyTimeout = undefined;
    setWrongKey(false);
    impactTimeout = undefined;
    setImpact(null);
    game = null;
    latestBattle = null;
    setBattle(null);
    setDialogue(null);
    setTyped("");
    setObjective("Defeat the monsters · 0/3");
    setResult(undefined);
    setReward(undefined);
    setPhase("loading");
    try {
      const words =
        cachedWords ??
        prepareRpgWords(
          await realWords(
            "english_1k",
            80,
            (word) => word.length >= 3 && word.length <= 7,
          ),
        );
      cachedWords = words;
      if (!props.open) return;
      setPhase("playing");
      await Promise.resolve();
      if (containerRef === undefined) return;
      const nextGame = await createTypingRpgGame(containerRef, words);
      if (!props.open) {
        nextGame.destroy(true);
        return;
      }
      game = nextGame;
      game.events.on("rpg-player-position", setPosition);
      game.events.on("rpg-resume-input", () => {
        setTimeout(() => inputRef?.focus(), 0);
      });
      game.events.on("rpg-prompt", setPrompt);
      game.events.on("rpg-objective", setObjective);
      game.events.on("rpg-battle", (next: Battle | null) => {
        const current = latestBattle;
        latestBattle = next;
        setBattle(next);
        if (
          next === null ||
          next.word !== current?.word ||
          next.turn !== current?.turn ||
          next.stage !== current?.stage
        ) {
          setTyped("");
        }
        if (next?.stage === "typing" && current?.stage !== "typing") {
          setTimeout(() => inputRef?.focus(), 0);
        } else if (next?.stage === "typing" && current === null) {
          setTimeout(() => inputRef?.focus(), 0);
        }
      });
      game.events.on("rpg-dialogue", setDialogue);
      game.events.on("rpg-word-hit", () =>
        showImpact({ target: "power", label: "+2 power" }),
      );
      game.events.on("rpg-turn-hit", (damage: number) =>
        showImpact({ target: "monster", label: `−${damage} HP` }),
      );
      game.events.on("rpg-enemy-hit", (damage: number) =>
        showImpact({ target: "player", label: `−${damage} HP` }),
      );
      game.events.on("rpg-defeat", () => {
        setBattle(null);
        setPhase("defeated");
      });
      game.events.on("rpg-result", (next: Result) => {
        setResult(next);
        setBattle(null);
        setReward("pending");
        setPhase("results");
        void claimTypingQuestReward(next, rewardRunId).then(
          (claimed) => {
            if (runId === thisRun) setReward(claimed);
          },
          (error: unknown) => {
            console.error("Failed to claim Typing Quest coins:", error);
            if (runId === thisRun) setReward("error");
          },
        );
        onResult?.(next.score);
      });
    } catch (error) {
      setPhase("intro");
      showErrorNotification("Could not start Typing Quest", { error });
    }
  };

  const handleTyping = (value: string): void => {
    const target = battle()?.word;
    if (
      target === undefined ||
      battle()?.stage !== "typing" ||
      !battle()?.ready
    ) {
      return;
    }
    const previous = typed();
    if (!target.toLowerCase().startsWith(value.toLowerCase())) {
      if (value.length > previous.length) {
        game?.events.emit("rpg-miss");
        setWrongKey(true);
        if (wrongKeyTimeout !== undefined) clearTimeout(wrongKeyTimeout);
        wrongKeyTimeout = setTimeout(() => setWrongKey(false), 700);
      }
      if (inputRef !== undefined) inputRef.value = previous;
      return;
    }
    setTyped(value);
    if (value.toLowerCase() === target.toLowerCase()) {
      setTyped("");
      game?.events.emit("rpg-attack");
    }
  };

  createEffect(() => {
    if (!props.open) {
      cleanup();
      cachedWords = undefined;
    }
  });
  onCleanup(cleanup);

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-[150] flex items-center justify-center bg-bg/95">
        <div
          class={cn(
            "relative overflow-hidden rounded-xl border border-main/30 bg-bg shadow-2xl",
            phase() === "playing"
              ? "h-[90vh] w-[95vw] max-w-5xl"
              : "w-[95vw] max-w-lg p-6",
          )}
        >
          <button
            type="button"
            class="absolute top-3 right-3 z-30 min-h-10 rounded bg-sub-alt px-3 text-sm font-semibold text-sub hover:text-text"
            onClick={() => props.onClose()}
          >
            ← Back to lessons
          </button>

          <Show when={phase() === "intro"}>
            <h2 class="mb-3 pr-40 text-xl font-bold text-text">Typing Quest</h2>
            <p class="mb-3 text-sub">
              Explore the forest, type to defeat three monsters, then open the
              treasure chest.
            </p>
            <p class="mb-2 text-em-sm text-sub">
              Hold arrows or WASD to move. Talk to the Guide with Enter.
              Monsters patrol; type as many words as you can during each battle
              turn.
            </p>
            <p class="mb-5 text-em-sm text-main">
              Battles use common English words.
            </p>
            <p class="mb-5 text-em-sm text-main">
              First clear: 100 coins. Next 10 clears: 10 coins each. After that:
              1 coin per clear.
            </p>
            <button
              type="button"
              class="button primary"
              onClick={() => void start()}
            >
              Start quest →
            </button>
          </Show>

          <Show when={phase() === "loading"}>
            <div class="py-12 text-center text-sub">Loading quest…</div>
          </Show>

          <Show when={phase() === "playing"}>
            <div
              ref={(element) => {
                containerRef = element;
              }}
              class="h-full w-full"
            ></div>
            <Show when={position() && getAuthenticatedUser()?.uid}>
              {(uid) => (
                <div
                  class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-sub-alt ring-2 ring-main"
                  style={{
                    left: `${position()?.x ?? 0}px`,
                    top: `${position()?.y ?? 0}px`,
                    width: `${position()?.size ?? 28}px`,
                    height: `${position()?.size ?? 28}px`,
                  }}
                >
                  <UserAvatar uid={uid()} class="h-full w-full" />
                </div>
              )}
            </Show>
            <div
              class="pointer-events-none absolute top-12 left-3 z-10 rounded border border-main/40 bg-bg/90 px-3 py-2 text-em-sm font-bold text-text"
              aria-live="polite"
            >
              {objective()}
            </div>
            <div class="pointer-events-none absolute right-2 bottom-2 left-2 z-20 rounded bg-bg/90 px-3 py-2 text-center text-em-xs text-text">
              {prompt()}
            </div>
            <Show when={battle() === null && dialogue() === null}>
              <div class="absolute bottom-12 left-3 z-20 grid touch-none grid-cols-3 gap-1 rounded bg-bg/80 p-2">
                <div></div>
                <button
                  type="button"
                  class="button"
                  aria-label="Move up"
                  onPointerDown={() => startMoving("up")}
                  onPointerUp={() => stopMoving("up")}
                  onPointerLeave={() => stopMoving("up")}
                  onPointerCancel={() => stopMoving("up")}
                  onClick={(event) => nudgeOnTap("up", event.detail)}
                >
                  ↑
                </button>
                <div></div>
                <button
                  type="button"
                  class="button"
                  aria-label="Move left"
                  onPointerDown={() => startMoving("left")}
                  onPointerUp={() => stopMoving("left")}
                  onPointerLeave={() => stopMoving("left")}
                  onPointerCancel={() => stopMoving("left")}
                  onClick={(event) => nudgeOnTap("left", event.detail)}
                >
                  ←
                </button>
                <button
                  type="button"
                  class="button"
                  aria-label="Move down"
                  onPointerDown={() => startMoving("down")}
                  onPointerUp={() => stopMoving("down")}
                  onPointerLeave={() => stopMoving("down")}
                  onPointerCancel={() => stopMoving("down")}
                  onClick={(event) => nudgeOnTap("down", event.detail)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="button"
                  aria-label="Move right"
                  onPointerDown={() => startMoving("right")}
                  onPointerUp={() => stopMoving("right")}
                  onPointerLeave={() => stopMoving("right")}
                  onPointerCancel={() => stopMoving("right")}
                  onClick={(event) => nudgeOnTap("right", event.detail)}
                >
                  →
                </button>
                <button
                  type="button"
                  class="button col-span-3"
                  onClick={() => game?.events.emit("rpg-interact")}
                >
                  Talk / Open
                </button>
              </div>
            </Show>
            <Show when={dialogue()}>
              {(message) => (
                <div class="absolute inset-0 z-20 flex items-center justify-center bg-bg/75 p-4">
                  <div class="w-full max-w-md rounded-xl border border-main bg-sub-alt p-5 text-text shadow-xl">
                    <p class="mb-4">{message()}</p>
                    <button
                      type="button"
                      class="button primary"
                      onClick={() => {
                        setDialogue(null);
                        game?.events.emit("rpg-close-dialogue");
                      }}
                    >
                      Got it
                    </button>
                  </div>
                </div>
              )}
            </Show>
            <Show when={battle()}>
              {(enemy) => (
                <div class="absolute inset-0 z-20 flex items-center justify-center bg-bg/75 p-4">
                  <div class="w-full max-w-md rounded-xl border border-main bg-sub-alt p-5 shadow-xl">
                    <div class="mb-1 text-em-xs font-bold tracking-widest text-sub uppercase">
                      Typing battle · turn {enemy().turn}
                    </div>
                    <div
                      class={cn(
                        "mb-4 rounded px-3 py-2 text-center text-em-sm font-bold",
                        enemy().stage === "typing"
                          ? "bg-main/15 text-main"
                          : "bg-error/15 text-error",
                      )}
                      aria-live="polite"
                    >
                      {enemy().stage === "typing"
                        ? enemy().ready
                          ? "YOUR TURN · TYPE WORDS"
                          : "READY · FOCUS THE TYPING BOX"
                        : enemy().hp === 0
                          ? "MONSTER DEFEATED!"
                          : enemy().message?.includes("hit you")
                            ? "MONSTER ATTACKED"
                            : "MONSTER'S TURN"}
                    </div>
                    <div class="mb-4 grid grid-cols-[1fr_auto_1fr] items-start gap-3 text-center">
                      <div class="min-w-0">
                        <div
                          class={cn(
                            "relative mx-auto mb-2 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-main bg-bg transition-transform duration-150",
                            impact()?.target === "player" &&
                              "scale-110 ring-4 ring-error",
                          )}
                        >
                          <Show
                            when={getAuthenticatedUser()?.uid}
                            fallback={<span class="text-3xl">🙂</span>}
                          >
                            {(uid) => (
                              <UserAvatar
                                uid={uid()}
                                size={80}
                                class="h-full w-full"
                              />
                            )}
                          </Show>
                          <Show when={impact()?.target === "player"}>
                            <span
                              class="absolute inset-x-0 bottom-0 bg-bg/85 text-em-xs font-bold text-error"
                              aria-live="polite"
                            >
                              {impact()?.label}
                            </span>
                          </Show>
                        </div>
                        <div class="text-em-sm font-bold text-text">You</div>
                        <div class="text-em-xs text-sub">
                          {enemy().playerHp}/12 HP
                        </div>
                        <div class="mt-1 h-2 rounded bg-bg">
                          <div
                            class="h-2 rounded bg-main motion-safe:transition-[width] motion-safe:duration-300"
                            style={{
                              width: `${(100 * enemy().playerHp) / 12}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                      <span class="pt-7 text-em-sm font-bold text-sub">VS</span>
                      <div class="min-w-0">
                        <div
                          class={cn(
                            "relative mx-auto mb-2 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-error bg-bg transition-transform duration-150",
                            impact()?.target === "monster" &&
                              "scale-110 ring-4 ring-main",
                            enemy().stage === "enemy" &&
                              !enemy().message?.includes("hit you") &&
                              "animate-pulse",
                          )}
                        >
                          <MonsterPortrait name={enemy().name} />
                          <Show when={impact()?.target === "monster"}>
                            <span
                              class="absolute inset-x-0 bottom-0 bg-bg/85 text-em-xs font-bold text-main"
                              aria-live="polite"
                            >
                              {impact()?.label}
                            </span>
                          </Show>
                        </div>
                        <div
                          class="truncate text-em-sm font-bold text-text"
                          title={enemy().name}
                        >
                          {enemy().name}
                        </div>
                        <div class="text-em-xs text-sub">
                          {enemy().hp}/{enemy().maxHp} HP
                        </div>
                        <div class="mt-1 h-2 rounded bg-bg">
                          <div
                            class="h-2 rounded bg-error motion-safe:transition-[width] motion-safe:duration-300"
                            style={{
                              width: `${(100 * enemy().hp) / enemy().maxHp}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    <Show
                      when={enemy().stage === "typing"}
                      fallback={
                        <p class="rounded bg-bg p-4 text-center text-xl font-bold text-text">
                          {enemy().message ??
                            `${enemy().name} prepares to attack…`}
                        </p>
                      }
                    >
                      <p class="mb-2 text-em-sm text-main">
                        {enemy().ready ? "Your turn" : "Tap the box to start"}:{" "}
                        {enemy().seconds}s · {enemy().wordsTyped} words typed
                      </p>
                      <div
                        class="mb-3 h-2 overflow-hidden rounded bg-bg"
                        role="progressbar"
                        aria-label="Time left in your turn"
                        aria-valuemin={0}
                        aria-valuemax={8}
                        aria-valuenow={enemy().seconds}
                      >
                        <div
                          class={cn(
                            "h-full rounded",
                            enemy().seconds <= 3 ? "bg-error" : "bg-main",
                          )}
                          style={{ width: `${(enemy().seconds / 8) * 100}%` }}
                        ></div>
                      </div>
                      <p class="mb-3 text-em-xs text-sub">
                        Damage ready: {enemy().wordsTyped * 2} · No-mistake
                        bonus: +
                        {enemy().wordsTyped > 0 &&
                        enemy().mistakesThisTurn === 0
                          ? 2
                          : 0}
                        <Show when={impact()?.target === "power"}>
                          <span
                            class="ml-2 font-bold text-main"
                            aria-live="polite"
                          >
                            {impact()?.label}
                          </span>
                        </Show>
                      </p>
                      <div class="mb-3 rounded bg-bg p-3 text-center font-mono text-2xl tracking-wider text-text">
                        <span class="text-main">
                          {enemy().word.slice(0, typed().length)}
                        </span>
                        {enemy().word.slice(typed().length)}
                      </div>
                      <input
                        ref={(element) => {
                          inputRef = element;
                        }}
                        class={cn(
                          "w-full rounded border bg-bg p-3 text-center font-mono text-xl text-text outline-none",
                          wrongKey() ? "border-error" : "border-main",
                        )}
                        aria-label={`Type ${enemy().word} to attack`}
                        autocomplete="off"
                        autocapitalize="off"
                        spellcheck={false}
                        value={typed()}
                        onFocus={() => game?.events.emit("rpg-input-focus")}
                        onBlur={() => game?.events.emit("rpg-input-blur")}
                        onInput={(event) =>
                          handleTyping(event.currentTarget.value)
                        }
                      />
                      <Show when={wrongKey()}>
                        <p
                          class="mt-2 text-center text-em-xs text-error"
                          aria-live="polite"
                        >
                          Wrong key—try the next letter again.
                        </p>
                      </Show>
                    </Show>
                  </div>
                </div>
              )}
            </Show>
          </Show>

          <Show when={phase() === "results"}>
            <div class="pt-12 text-center">
              <div class="mb-3 text-3xl font-bold text-main">
                Quest complete! ✨
              </div>
              <p class="mb-4 text-sub">
                You cleared the forest and found the treasure.
              </p>
              <p class="mb-1 text-text">
                {result()?.hits} successful attacks · {result()?.mistakes}{" "}
                mistakes
              </p>
              <p class="mb-5 text-text">
                Time {result()?.elapsed}s · Score {result()?.score}
              </p>
              <div
                class="mb-5 rounded-xl border border-main/50 bg-sub-alt p-4"
                aria-live="polite"
              >
                <p class="mb-1 text-em-sm font-bold text-sub">Treasure chest</p>
                <Show
                  when={rewardClaim()}
                  fallback={
                    <p class="text-em-sm text-text">{rewardMessage()}</p>
                  }
                >
                  {(claim) => (
                    <Show
                      when={claim().coins > 0}
                      fallback={
                        <p class="text-em-sm text-sub">{rewardMessage()}</p>
                      }
                    >
                      <p class="text-4xl font-bold text-main">
                        +{claim().coins} coins
                      </p>
                      <p class="mt-1 text-em-sm text-text">
                        {claim().firstClear
                          ? "First-clear bonus!"
                          : claim().coins === 10
                            ? `${10 - (claim().bonusRepeatClears ?? 10)} bonus clears left`
                            : "Keep farming!"}
                      </p>
                    </Show>
                  )}
                </Show>
              </div>
              <div class="flex justify-center gap-3">
                <button
                  type="button"
                  class="button primary"
                  onClick={() => void start()}
                >
                  Play again
                </button>
                <button
                  type="button"
                  class="button"
                  onClick={() => props.onClose()}
                >
                  Back to lessons
                </button>
              </div>
            </div>
          </Show>
          <Show when={phase() === "defeated"}>
            <div class="pt-12 text-center">
              <h2 class="mb-3 text-2xl font-bold text-text">
                The forest won this round
              </h2>
              <p class="mb-5 text-sub">
                Try typing more words each turn, and use Backspace to fix
                mistakes.
              </p>
              <div class="flex justify-center gap-3">
                <button
                  type="button"
                  class="button primary"
                  onClick={() => void start()}
                >
                  Try again
                </button>
                <button
                  type="button"
                  class="button"
                  onClick={() => props.onClose()}
                >
                  Back to lessons
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
