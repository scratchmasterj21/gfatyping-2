import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  on,
  Show,
} from "solid-js";

import { UserAvatar } from "../../components/common/UserAvatar";
import { cn } from "../../utils/cn";
import { sfx } from "../mini/mini-sounds";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { raidLineup } from "./raid-monsters";
import {
  Charge,
  RAID_TIME_LIMIT_MS,
  RaidMode,
  RaidTeam,
  RaidView,
  START_HEARTS,
  wordDamage,
} from "./raid-rules";

export const TEAM_LABEL: Record<RaidTeam, string> = {
  red: "Red team",
  blue: "Blue team",
  green: "Green team",
  yellow: "Yellow team",
};
export const TEAM_BG: Record<RaidTeam, string> = {
  red: "bg-game-red",
  blue: "bg-game-blue",
  green: "bg-game-green",
  yellow: "bg-game-yellow",
};

export type RaidMember = { uid: string; name: string; dealt: number };

/** One shield of the charging attack, as I see it. */
export type ShieldView = {
  key: string;
  word: string;
  targetName: string;
  /** aimed at me - only I can block it */
  mine: boolean;
  blocked: boolean;
};

export type HealView = {
  n: number;
  word: string;
  startsAt: number;
  endsAt: number;
};

type Popup = { id: number; text: string; x: number };

/**
 * The battle screen: my team's monster, hearts and shield word, my own word
 * to type, and (team mode) how the other teams are doing.
 */
export function RaidBattle(props: {
  mode: RaidMode;
  view: RaidView;
  now: number;
  startAt: number;
  seed: number;
  myTeam: RaidTeam;
  myUid: string;
  members: RaidMember[];
  /** my words, in order */
  words: string[];
  charge: Charge | null;
  shields: ShieldView[];
  heal: HealView | null;
  /** my team's boss is angry */
  angry: boolean;
  onHit: (damage: number, combo: number) => void;
  onBlock: (key: string) => void;
  onHeal: (n: number) => void;
}): JSXElement {
  const [wordIndex, setWordIndex] = createSignal(0);
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  const [clean, setClean] = createSignal(true);
  const [combo, setCombo] = createSignal(0);
  const [popups, setPopups] = createSignal<Popup[]>([]);
  const [hitKey, setHitKey] = createSignal(0);
  let popupId = 0;
  let inputEl: HTMLInputElement | undefined;
  const clearInput = (): void => {
    setTyped("");
    if (inputEl !== undefined) inputEl.value = "";
  };

  const lineup = createMemo(() => raidLineup(props.seed));
  const mine = createMemo(
    () => props.view.teams.find((t) => t.team === props.myTeam) ?? null,
  );
  const monster = createMemo(
    () => lineup()[mine()?.wave.index ?? 0] ?? lineup()[0],
  );
  const word = (): string =>
    props.words[wordIndex() % Math.max(1, props.words.length)] ?? "";
  const counting = (): boolean => props.now < props.startAt;
  const done = (): boolean =>
    props.view.over ||
    mine()?.knockedOut === true ||
    mine()?.wave.cleared === true;
  /** shields only I can type right now */
  const myShields = (): ShieldView[] =>
    props.charge === null || done()
      ? []
      : props.shields.filter((sh) => sh.mine && !sh.blocked);
  const shieldUp = (): boolean => myShields().length > 0;
  const healUp = (): boolean => props.heal !== null && !done();
  const secondsLeft = (): number =>
    Math.max(
      0,
      Math.ceil((props.startAt + RAID_TIME_LIMIT_MS - props.now) / 1000),
    );

  const popup = (text: string): void => {
    const id = ++popupId;
    setPopups((p) => [...p, { id, text, x: 35 + Math.random() * 30 }]);
    setTimeout(() => setPopups((p) => p.filter((q) => q.id !== id)), 900);
  };

  const onInput = (raw: string): void => {
    if (counting() || done()) return;
    const value = raw.trim().toLowerCase();
    const shield = myShields().find((sh) => sh.word === value);
    if (shield !== undefined) {
      props.onBlock(shield.key);
      sfx.pop();
      popup("🛡️ Blocked!");
      clearInput();
      setWrong(false);
      return;
    }
    const heal = healUp() ? props.heal : null;
    if (heal !== null && value === heal.word) {
      props.onHeal(heal.n);
      sfx.great();
      popup("💖 +1 heart!");
      clearInput();
      setWrong(false);
      return;
    }
    if (value === word()) {
      const nextCombo = clean() ? combo() + 1 : 0;
      const dmg = wordDamage(word(), clean(), nextCombo);
      props.onHit(dmg, nextCombo);
      setCombo(nextCombo);
      sfx.good();
      popup(`-${dmg}`);
      setHitKey((k) => k + 1);
      setWordIndex((i) => i + 1);
      clearInput();
      setWrong(false);
      setClean(true);
      return;
    }
    const ok =
      word().startsWith(value) ||
      myShields().some((sh) => sh.word.startsWith(value)) ||
      (heal !== null && heal.word.startsWith(value));
    if (!ok) {
      setClean(false);
      if (!wrong()) sfx.oops();
    }
    setWrong(!ok);
    setTyped(raw);
  };

  // heart lost / wave cleared sounds
  createEffect(
    on(
      () => mine()?.hearts ?? START_HEARTS,
      (h, prev) => {
        if (prev !== undefined && h < prev) {
          sfx.bad();
          popup("💥 Ouch!");
        }
      },
    ),
  );
  createEffect(
    on(
      () => props.angry,
      (angry, prev) => {
        if (angry && prev === false) {
          sfx.bad();
          popup("😡 The boss is ANGRY!");
          setHitKey((k) => k + 1);
        }
      },
    ),
  );
  createEffect(
    on(
      () => mine()?.wave.index ?? 0,
      (w, prev) => {
        if (prev !== undefined && w > prev) sfx.great();
      },
    ),
  );

  const typedPart = (): string => {
    const v = typed().trim().toLowerCase();
    return word().startsWith(v) ? v : "";
  };

  return (
    <div class="relative flex h-full w-full flex-col items-center gap-2 overflow-hidden bg-game-night px-3 pt-16 pb-3 font-kid text-game-cream sm:px-4">
      {/* top bar */}
      <div class="flex w-full max-w-3xl items-center justify-between gap-2">
        <div class="text-xl tracking-tight sm:text-2xl" aria-label="hearts">
          <For each={Array.from({ length: START_HEARTS }, (_, i) => i)}>
            {(i) => (
              <span class={cn(i >= (mine()?.hearts ?? 0) && "opacity-25")}>
                ❤️
              </span>
            )}
          </For>
        </div>
        <Show when={props.mode === "teams"}>
          <span
            class={cn(
              "rounded-full px-3 py-0.5 text-sm font-bold text-game-ink",
              TEAM_BG[props.myTeam],
            )}
          >
            {TEAM_LABEL[props.myTeam]}
          </span>
        </Show>
        <div class="rounded-full bg-game-navy px-3 py-1 text-sm font-bold">
          ⏱ {Math.floor(secondsLeft() / 60)}:
          {String(secondsLeft() % 60).padStart(2, "0")}
        </div>
      </div>

      {/* other teams */}
      <Show when={props.mode === "teams"}>
        <div class="flex w-full max-w-3xl flex-wrap justify-center gap-2">
          <For each={props.view.teams.filter((t) => t.team !== props.myTeam)}>
            {(t) => (
              <div class="flex min-w-36 flex-1 items-center gap-2 rounded-xl bg-game-navy/70 px-2 py-1 text-xs">
                <span
                  class={cn("h-3 w-3 shrink-0 rounded-full", TEAM_BG[t.team])}
                ></span>
                <div class="h-2 flex-1 overflow-hidden rounded-full bg-game-ink">
                  <div
                    class={cn(
                      "h-full transition-[width] duration-300",
                      TEAM_BG[t.team],
                    )}
                    style={{
                      width: `${Math.min(100, (t.dealt / t.maxHp) * 100)}%`,
                    }}
                  ></div>
                </div>
                <span>{t.knockedOut ? "💀" : `❤️${t.hearts}`}</span>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* monster */}
      <div class="relative flex min-h-0 w-full max-w-3xl flex-1 flex-col items-center justify-center">
        <div class="text-center text-sm font-bold text-game-cream/80">
          {(mine()?.wave.index ?? 0) === 2
            ? props.angry
              ? "👑 BOSS · 😡 ANGRY!"
              : "👑 BOSS"
            : `Wave ${(mine()?.wave.index ?? 0) + 1} of 3`}{" "}
          · {monster().name}
        </div>
        <div class="mt-1 h-4 w-64 max-w-full overflow-hidden rounded-full bg-game-ink ring-2 ring-game-cream/30">
          <div
            class="h-full bg-game-red transition-[width] duration-300"
            style={{
              width: `${((mine()?.wave.hp ?? 0) / (mine()?.wave.maxHp ?? 1)) * 100}%`,
            }}
          ></div>
        </div>
        <div class="text-xs text-game-cream/70">
          {mine()?.wave.hp ?? 0} / {mine()?.wave.maxHp ?? 0} HP
        </div>

        <div class="relative mt-2 flex min-h-0 flex-1 items-center justify-center">
          <Show when={monster().id} keyed>
            <div class="flex h-full animate-game-pop items-center justify-center motion-reduce:animate-none">
              <Show when={`hit-${hitKey()}`} keyed>
                <img
                  src={monster().image}
                  alt={monster().name}
                  draggable={false}
                  class={cn(
                    "max-h-[min(34vh,100%)] w-auto object-contain [image-rendering:pixelated]",
                    (mine()?.wave.index ?? 0) === 2 ? "h-56 sm:h-64" : "h-40",
                    hitKey() > 0 && "animate-game-shake",
                    mine()?.wave.cleared === true && "opacity-0",
                    (shieldUp() || props.angry) &&
                      "drop-shadow-[0_0_14px_rgb(255_90_95)]",
                    props.angry && "saturate-150",
                  )}
                  style={{ "image-rendering": "pixelated" }}
                />
              </Show>
            </div>
          </Show>
          <For each={popups()}>
            {(p) => (
              <span
                class="pointer-events-none absolute top-1/3 animate-game-float-up text-2xl font-bold text-game-yellow drop-shadow motion-reduce:animate-none"
                style={{ left: `${p.x}%` }}
              >
                {p.text}
              </span>
            )}
          </For>
        </div>

        {/* shields: the one aimed at me to type, the rest for info */}
        <Show when={props.charge !== null && !done() && props.charge}>
          {(c) => (
            <div class="mt-1 grid w-80 max-w-full justify-items-center gap-1.5">
              <For each={props.shields}>
                {(sh) => (
                  <Show
                    when={!sh.blocked}
                    fallback={
                      <div class="rounded-full bg-game-green px-4 py-1 text-sm font-bold text-game-ink">
                        🛡️{" "}
                        {sh.mine ? "Blocked!" : `${sh.targetName} blocked it!`}
                      </div>
                    }
                  >
                    <Show
                      when={sh.mine}
                      fallback={
                        <div class="rounded-full bg-game-navy px-4 py-1 text-sm font-bold text-game-cream">
                          🎯 {monster().name} is aiming at {sh.targetName}!
                        </div>
                      }
                    >
                      <div class="grid w-full gap-1 rounded-2xl bg-game-red/90 px-4 py-2 text-center text-game-cream shadow-[0_4px_0_rgb(0_0_0/0.3)]">
                        <div class="text-xs font-bold tracking-wide uppercase">
                          ⚠️ {monster().name} is aiming at YOU! Type to block:
                        </div>
                        <div class="font-mono text-3xl font-bold">
                          {sh.word}
                        </div>
                        <div class="h-1.5 overflow-hidden rounded-full bg-game-ink/40">
                          <div
                            class="h-full bg-game-yellow"
                            style={{
                              width: `${Math.max(0, ((c().landsAt - props.now) / (c().landsAt - c().startsAt)) * 100)}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </Show>
                  </Show>
                )}
              </For>
            </div>
          )}
        </Show>

        {/* heal word: anyone on the team can grab it */}
        <Show when={healUp() && props.heal}>
          {(h) => (
            <div class="mt-1 grid w-72 max-w-full gap-1 rounded-2xl bg-game-pink/90 px-4 py-2 text-center text-game-ink shadow-[0_4px_0_rgb(0_0_0/0.3)]">
              <div class="text-xs font-bold tracking-wide uppercase">
                💖 Type to win back a heart:
              </div>
              <div class="font-mono text-2xl font-bold">{h().word}</div>
              <div class="h-1.5 overflow-hidden rounded-full bg-game-ink/30">
                <div
                  class="h-full bg-game-cream"
                  style={{
                    width: `${Math.max(0, ((h().endsAt - props.now) / (h().endsAt - h().startsAt)) * 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          )}
        </Show>
      </div>

      {/* my word */}
      <div class="flex w-full max-w-3xl flex-col items-center gap-2">
        <Show
          when={!done()}
          fallback={
            <div class="text-center text-xl font-bold">
              {mine()?.knockedOut === true
                ? "💀 Your team is out of hearts!"
                : mine()?.wave.cleared === true
                  ? "🎉 Boss beaten!"
                  : ""}
            </div>
          }
        >
          <div class="flex items-center gap-2">
            <span class="font-mono text-4xl font-bold tracking-wide sm:text-5xl">
              <span class="text-game-green">{typedPart()}</span>
              <span>{word().slice(typedPart().length)}</span>
            </span>
            <Show when={combo() >= 3}>
              <span class="rounded-full bg-game-orange px-2 text-sm font-bold text-game-ink">
                🔥 x{combo()}
              </span>
            </Show>
          </div>
        </Show>
        <MiniTypingInput
          ref={(el) => {
            inputEl = el;
          }}
          value={typed()}
          onInput={onInput}
          wrong={wrong()}
          waiting={counting() || done()}
          placeholder={counting() ? "get ready…" : "type the word to attack!"}
        />
        <div class="flex flex-wrap justify-center gap-2">
          <For each={props.members}>
            {(m) => (
              <div
                class={cn(
                  "flex items-center gap-1.5 rounded-full bg-game-navy/80 py-0.5 pr-3 pl-0.5 text-sm",
                  m.uid === props.myUid && "ring-2 ring-game-yellow",
                )}
              >
                <UserAvatar uid={m.uid} class="h-6 w-6 rounded-full" />
                <span class="max-w-24 truncate">
                  {m.uid === props.myUid ? "You" : m.name}
                </span>
                <span class="font-bold text-game-yellow">⚔️{m.dealt}</span>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* 3-2-1 */}
      <Show when={counting()}>
        <div class="absolute inset-0 flex items-center justify-center bg-game-ink/50">
          <Show when={Math.ceil((props.startAt - props.now) / 1000)} keyed>
            {(n) => (
              <span class="animate-game-pop text-8xl font-bold text-game-yellow motion-reduce:animate-none">
                {n}
              </span>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}
