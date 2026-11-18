import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  JSXElement,
  on,
  onCleanup,
  Show,
  untrack,
} from "solid-js";

import { cn } from "../../utils/cn";
import { sfx } from "../mini/mini-sounds";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { HERO_ART } from "./hero-art";
import {
  FLASH_CLASS,
  FlashKind,
  flashFor,
  FxKind,
  fxForMove,
  fxParticles,
} from "./quest-fx";
import { MONSTER_ART } from "./quest-monsters";
import {
  BATTLE_COUNT,
  CLASS_INFO,
  eventMs,
  GUARD_MS,
  HERO_TURN_MS,
  HeroAction,
  HeroInput,
  heroId,
  HitResult,
  MonsterState,
  PendingGuard,
  PendingHero,
  QuestEvent,
  QuestSetup,
  QuestState,
  typingPower,
} from "./quest-rules";

type Popup = { id: number; target: string; text: string; tone: string };
type Burst = { id: number; target: string; emoji: string };
type Fx = { id: number; target: string; kind: FxKind; fromRight: boolean };
type Motion = "lunge-left" | "lunge-right" | "cast";
const MOTION_CLASS: Record<Motion, string> = {
  "lunge-left": "animate-quest-lunge-left",
  "lunge-right": "animate-quest-lunge-right",
  cast: "animate-quest-cast",
};
type Step = "menu" | "target" | "type";

/** Hits land a little after the move name shows. */
const HIT_DELAY_MS = 380;

/**
 * The battle screen. Plays the quest's events one by one (so everyone sees
 * the same story), then asks me for my move or my guard word.
 */
export function QuestBattle(props: {
  setup: QuestSetup;
  state: QuestState;
  myUid: string;
  now: number;
  startAt: number;
  /** when the current prompt times out */
  deadline: number | null;
  onHero: (input: HeroInput) => void;
  onGuard: (guarded: boolean) => void;
  /** the quest is over and the last move has been shown */
  onFinished: () => void;
}): JSXElement {
  // ---------------------------------------------------------- playback
  const [shown, setShown] = createSignal(0);
  const [heroHp, setHeroHp] = createSignal<number[]>([]);
  const [monsters, setMonsters] = createSignal<MonsterState[]>([]);
  const [battle, setBattle] = createSignal(0);
  const [active, setActive] = createSignal<string | null>(null);
  const [hurt, setHurt] = createSignal<Set<string>>(new Set());
  const [message, setMessage] = createSignal("");
  const [banner, setBanner] = createSignal<string | null>(null);
  const [popups, setPopups] = createSignal<Popup[]>([]);
  const [bursts, setBursts] = createSignal<Burst[]>([]);
  const [motion, setMotion] = createSignal<{ id: string; kind: Motion } | null>(
    null,
  );
  const [quake, setQuake] = createSignal(false);
  const [effects, setEffects] = createSignal<Fx[]>([]);
  const [flash, setFlash] = createSignal<{
    id: number;
    kind: FlashKind;
  } | null>(null);
  const [entering, setEntering] = createSignal(false);
  const [victory, setVictory] = createSignal(false);
  const motionClass = (id: string): string | false => {
    const m = motion();
    return m !== null && m.id === id && MOTION_CLASS[m.kind];
  };
  let popupId = 0;
  let finishedFired = false;
  let playTimer: ReturnType<typeof setTimeout> | undefined;
  let hitTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    clearTimeout(playTimer);
    clearTimeout(hitTimer);
  });

  const resetPlayback = (): void => {
    clearTimeout(playTimer);
    clearTimeout(hitTimer);
    playTimer = undefined;
    finishedFired = false;
    setShown(0);
    setHeroHp(props.setup.party.map((h) => CLASS_INFO[h.cls].maxHp));
    setMonsters([]);
    setActive(null);
    setMessage("");
    setMotion(null);
    setBursts([]);
    setEffects([]);
    setFlash(null);
    setQuake(false);
    setEntering(false);
    setVictory(false);
  };
  createEffect(
    on(
      () => props.setup.seed,
      () => resetPlayback(),
    ),
  );

  const party = (): QuestSetup["party"] => props.setup.party;
  const heroName = (slot: number): string => {
    const h = party()[slot];
    if (h === undefined) return "Hero";
    return h.uid === props.myUid ? "You" : h.name;
  };
  const actorName = (id: string): string => {
    const i = Number(id.slice(1));
    return id.startsWith("h")
      ? heroName(i)
      : (monsters()[i]?.name ?? "The monster");
  };

  const popup = (target: string, text: string, tone: string): void => {
    const id = ++popupId;
    setPopups((p) => [...p, { id, target, text, tone }]);
    setTimeout(() => setPopups((p) => p.filter((q) => q.id !== id)), 1000);
  };

  const burst = (target: string, emoji: string): void => {
    const id = ++popupId;
    setBursts((b) => [...b, { id, target, emoji }]);
    setTimeout(() => setBursts((b) => b.filter((q) => q.id !== id)), 700);
  };

  const effect = (target: string, kind: FxKind, fromRight: boolean): void => {
    const id = ++popupId;
    setEffects((f) => [...f, { id, target, kind, fromRight }]);
    setTimeout(() => setEffects((f) => f.filter((q) => q.id !== id)), 1100);
  };

  const applyHits = (hits: HitResult[]): void => {
    const struck = new Set<string>();
    for (const hit of hits) {
      if (hit.crit === true) burst(hit.id, "💥");
      if (hit.guarded === true) {
        effect(hit.id, "shield", false);
      }
      const i = Number(hit.id.slice(1));
      const sign = hit.heal === true ? 1 : -1;
      if (hit.id.startsWith("h")) {
        setHeroHp((hp) => {
          const next = [...hp];
          next[i] = Math.max(0, (next[i] ?? 0) + sign * hit.amount);
          return next;
        });
      } else {
        setMonsters((ms) =>
          ms.map((m) =>
            m.index === i
              ? { ...m, hp: Math.max(0, m.hp + sign * hit.amount) }
              : m,
          ),
        );
      }
      if (hit.heal === true) {
        popup(
          hit.id,
          hit.revive === true ? "✨ Up!" : `+${hit.amount}`,
          "heal",
        );
      } else {
        struck.add(hit.id);
        popup(
          hit.id,
          `${hit.crit === true ? "⭐" : ""}${hit.amount}${hit.guarded === true ? " 🛡️" : ""}`,
          hit.crit === true ? "crit" : hit.id.startsWith("h") ? "hurt" : "hit",
        );
      }
    }
    const heavy =
      hits.some((h) => h.crit === true) ||
      hits.filter((h) => h.heal !== true && h.id.startsWith("h")).length > 1;
    if (heavy) {
      setQuake(true);
      setTimeout(() => setQuake(false), 400);
    }
    setHurt(struck);
    setTimeout(() => setHurt(new Set<string>()), 420);
    if (hits.some((h) => h.heal === true)) sfx.pop();
    else if (hits.some((h) => h.crit === true)) sfx.great();
    else if (hits.some((h) => h.id.startsWith("h"))) sfx.bad();
    else if (hits.length > 0) sfx.good();
  };

  const play = (e: QuestEvent): void => {
    setActive(null);
    if (e.type === "battle") {
      setMonsters(e.monsters.map((m) => ({ ...m })));
      setBattle(e.battle);
      const boss = e.battle === BATTLE_COUNT - 1;
      setBanner(boss ? "👑 BOSS BATTLE!" : `⚔️ Battle ${e.battle + 1}`);
      setMessage(
        boss
          ? `${e.monsters[0]?.name ?? "The boss"} appears!`
          : "Monsters appear!",
      );
      setTimeout(() => setBanner(null), 1500);
      setVictory(false);
      setEntering(true);
      setTimeout(() => setEntering(false), 750);
      return;
    }
    if (e.type === "rest") {
      setHeroHp(e.hp);
      setMessage("☕ Short rest - everyone feels better!");
      sfx.pop();
      return;
    }
    if (e.type === "angry") {
      setActive(e.actor);
      setMessage(`😡 ${actorName(e.actor)} is ANGRY! Watch out!`);
      sfx.boom();
      return;
    }
    if (e.type === "end") {
      setMessage(e.won ? "🎉 Victory!" : "💤 The party fell asleep…");
      setVictory(e.won);
      return;
    }
    setActive(e.actor);
    const targets =
      e.hits.length === 1 && e.hits[0] !== undefined
        ? ` on ${actorName(e.hits[0].id)}`
        : "";
    setMessage(
      `${actorName(e.actor)}: ${e.emoji} ${e.move}${targets}!${e.note !== undefined ? ` (${e.note})` : ""}`,
    );
    const hero = e.actor.startsWith("h");
    const strikes = e.hits.some(
      (h) => h.heal !== true && h.id.startsWith(hero ? "m" : "h"),
    );
    const kind = fxForMove(e.move, hero);
    const melee =
      strikes && (kind === "slash" || kind === "bigslash" || kind === "claw");
    setMotion({
      id: e.actor,
      kind: melee ? (hero ? "lunge-left" : "lunge-right") : "cast",
    });
    setTimeout(() => setMotion(null), 720);
    // effects start now so they land with the hit
    const fxTargets =
      e.shield !== undefined ? [e.shield] : e.hits.map((h) => h.id);
    for (const t of fxTargets) effect(t, kind, hero);
    const tint = flashFor(kind);
    if (tint !== null && e.hits.length > 1) {
      const id = ++popupId;
      setFlash({ id, kind: tint });
      setTimeout(() => setFlash((f) => (f?.id === id ? null : f)), 650);
    }
    hitTimer = setTimeout(() => applyHits(e.hits), HIT_DELAY_MS);
  };

  // play events one at a time, after the 3-2-1
  createEffect(() => {
    const events = props.state.events;
    const i = shown();
    if (events.length < i) {
      untrack(resetPlayback);
      return;
    }
    if (i >= events.length || playTimer !== undefined) return;
    if (props.now < props.startAt) return;
    const e = events[i] as QuestEvent;
    untrack(() => play(e));
    playTimer = setTimeout(() => {
      playTimer = undefined;
      setShown((n) => n + 1);
    }, eventMs(e));
  });

  const caughtUp = (): boolean =>
    shown() >= props.state.events.length && props.now >= props.startAt;

  createEffect(() => {
    if (!caughtUp() || !props.state.over || finishedFired) return;
    finishedFired = true;
    untrack(() => props.onFinished());
  });

  // ---------------------------------------------------------- my prompt
  const [submitted, setSubmitted] = createSignal(-1);
  const myHero = (): PendingHero | null => {
    const p = props.state.pending;
    if (p === null || p.kind !== "hero" || !caughtUp()) return null;
    return p.uid === props.myUid && submitted() !== p.n ? p : null;
  };
  const myGuard = (): (PendingGuard & { word: string }) | null => {
    const p = props.state.pending;
    if (p === null || p.kind !== "guard" || !caughtUp()) return null;
    const word = p.words[props.myUid];
    return word !== undefined && submitted() !== p.n ? { ...p, word } : null;
  };
  /** someone else is choosing */
  const waitingOn = (): string | null => {
    const p = props.state.pending;
    if (p === null || !caughtUp() || props.state.over) return null;
    if (p.kind === "hero") {
      return p.uid === props.myUid ? null : heroName(p.slot);
    }
    return p.words[props.myUid] === undefined ? "a friend to guard" : null;
  };

  const [step, setStep] = createSignal<Step>("menu");
  const [action, setAction] = createSignal<HeroAction>("attack");
  const [target, setTarget] = createSignal<number | undefined>();
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  let errors = 0;
  let typeStart = 0;
  let inputEl: HTMLInputElement | undefined;
  const clearInput = (): void => {
    setTyped("");
    setWrong(false);
    if (inputEl !== undefined) inputEl.value = "";
  };

  // new prompt: back to the menu
  createEffect(
    on(
      () => {
        const p = props.state.pending;
        return p === null ? -1 : p.n;
      },
      () => {
        setStep("menu");
        setTarget(undefined);
        clearInput();
        errors = 0;
        typeStart = performance.now();
      },
    ),
  );
  // a guard prompt starts timing right away
  createEffect(
    on(
      () => myGuard()?.n,
      (n) => {
        if (n === undefined) return;
        errors = 0;
        typeStart = performance.now();
        sfx.tick();
      },
    ),
  );

  const me = (): QuestState["heroes"][number] | undefined => {
    const p = myHero();
    return p === null ? undefined : props.state.heroes[p.slot];
  };
  const myClass = (): QuestSetup["party"][number]["cls"] =>
    me()?.cls ?? "knight";

  type Option = {
    action: HeroAction;
    label: string;
    emoji: string;
    off?: boolean;
  };
  const menu = (): Option[] => {
    const info = CLASS_INFO[myClass()];
    return [
      { action: "attack", label: "Attack", emoji: "⚔️" },
      { action: "skill", label: info.skill, emoji: info.skillEmoji },
      { action: "defend", label: "Defend", emoji: "🛡️" },
      {
        action: "potion",
        label: `Potion x${props.state.potions}`,
        emoji: "🧪",
        off: props.state.potions <= 0,
      },
    ];
  };

  type TargetOption = { index: number; label: string; detail: string };
  const targetsFor = (a: HeroAction): TargetOption[] | null => {
    const info = CLASS_INFO[myClass()];
    const aim =
      a === "attack"
        ? "monster"
        : a === "skill"
          ? info.skillTarget
          : a === "potion"
            ? "ally"
            : "none";
    if (aim === "monster") {
      return props.state.monsters
        .filter((m) => m.hp > 0)
        .map((m) => ({
          index: m.index,
          label: m.name,
          detail: `${m.hp}/${m.maxHp}`,
        }));
    }
    if (aim === "ally") {
      const heroes = props.state.heroes.filter((h) => {
        if (a === "skill" && myClass() === "healer") return true;
        if (a === "skill" && myClass() === "guardian") {
          return h.hp > 0 && h.slot !== me()?.slot;
        }
        return h.hp > 0;
      });
      return heroes.map((h) => ({
        index: h.slot,
        label: heroName(h.slot),
        detail: h.hp <= 0 ? "💤 asleep" : `${h.hp}/${h.maxHp}`,
      }));
    }
    return null;
  };

  const startTyping = (): void => {
    setStep("type");
    clearInput();
    errors = 0;
    typeStart = performance.now();
  };

  const choose = (o: Option): void => {
    if (o.off === true) {
      sfx.oops();
      return;
    }
    setAction(o.action);
    const list = targetsFor(o.action);
    if (list === null) {
      setTarget(undefined);
      startTyping();
    } else if (list.length === 1) {
      setTarget(list[0]?.index);
      startTyping();
    } else if (list.length === 0) {
      sfx.oops();
    } else {
      setStep("target");
    }
    sfx.tick();
  };

  const pickTarget = (t: TargetOption): void => {
    setTarget(t.index);
    sfx.tick();
    startTyping();
  };

  const word = (): string => myHero()?.words[action()] ?? "";

  const submitHero = (): void => {
    const p = myHero();
    if (p === null) return;
    const power = typingPower(word(), errors, performance.now() - typeStart);
    setSubmitted(p.n);
    clearInput();
    props.onHero({
      kind: "hero",
      action: action(),
      ...(target() === undefined ? {} : { target: target() }),
      power,
    });
  };

  const onInput = (raw: string): void => {
    // phrases: ignore case, extra spaces and a leading space
    const value = normalize(raw);
    const guard = myGuard();
    if (guard !== null) {
      if (value === guard.word) {
        setSubmitted(guard.n);
        clearInput();
        sfx.great();
        popup(heroId(myGuardSlot()), "🛡️ Guard!", "heal");
        props.onGuard(true);
        return;
      }
      const ok = guard.word.startsWith(value);
      if (!ok && !wrong()) sfx.oops();
      setWrong(!ok);
      setTyped(raw);
      return;
    }
    if (myHero() === null) {
      clearInput();
      return;
    }
    if (step() !== "type") {
      // number keys pick from the menu / target list
      const n = Number(value);
      if (Number.isInteger(n) && n >= 1) {
        if (step() === "menu") {
          const o = menu()[n - 1];
          if (o !== undefined) choose(o);
        } else {
          const t = targetsFor(action())?.[n - 1];
          if (t !== undefined) pickTarget(t);
        }
      }
      clearInput();
      return;
    }
    if (value === word()) {
      submitHero();
      return;
    }
    const ok = word().startsWith(value);
    if (!ok && !wrong()) {
      errors++;
      sfx.oops();
    }
    setWrong(!ok);
    setTyped(raw);
  };

  const myGuardSlot = (): number =>
    party().find((h) => h.uid === props.myUid)?.slot ?? 0;

  const secondsLeft = (): number | null =>
    props.deadline === null
      ? null
      : Math.max(0, Math.ceil((props.deadline - props.now) / 1000));
  const timerShare = (total: number): number =>
    props.deadline === null
      ? 0
      : Math.max(0, Math.min(1, (props.deadline - props.now) / total));

  const countdown = (): number =>
    Math.max(0, Math.ceil((props.startAt - props.now) / 1000));

  // tick sound in the last seconds of my turn
  createEffect(
    on(secondsLeft, (s, prev) => {
      if (
        (myHero() !== null || myGuard() !== null) &&
        s !== null &&
        s <= 3 &&
        s !== prev &&
        s > 0
      ) {
        sfx.tick();
      }
    }),
  );

  const upNext = createMemo(() =>
    caughtUp() && !props.state.over ? props.state.upNext.slice(0, 8) : [],
  );

  // ---------------------------------------------------------- view
  return (
    <div class="relative flex h-full w-full flex-col overflow-hidden bg-game-night font-kid text-game-cream select-none">
      {/* turn order */}
      <div class="flex min-h-14 items-center gap-1.5 bg-game-ink/70 px-3 pt-16 pb-1.5 sm:pt-1.5 sm:pr-44 sm:pl-20">
        <span class="mr-1 text-xs font-bold tracking-wide text-game-grey uppercase">
          Turns
        </span>
        <For each={upNext()}>
          {(id, i) => (
            <span
              class={cn(
                "grid h-9 w-9 place-items-center rounded-lg border-2",
                i() === 0
                  ? "border-game-yellow bg-game-navy"
                  : "border-game-navy bg-game-ink",
              )}
              title={actorName(id)}
            >
              <img
                src={
                  id.startsWith("h")
                    ? HERO_ART[party()[Number(id.slice(1))]?.cls ?? "knight"]
                    : MONSTER_ART[
                        props.state.monsters[Number(id.slice(1))]?.kind ??
                          "slime"
                      ]
                }
                alt=""
                class="h-7 w-7 object-contain [image-rendering:pixelated]"
              />
            </span>
          )}
        </For>
        <span class="ml-auto text-sm text-game-grey">
          {battle() === BATTLE_COUNT - 1
            ? "👑 Boss"
            : `Battle ${battle() + 1}/${BATTLE_COUNT}`}
        </span>
      </div>

      {/* battlefield */}
      <div
        class={cn(
          "relative grid min-h-60 flex-1 grid-cols-2 bg-linear-to-b from-game-night via-game-navy to-game-grass-dark",
          quake() && "animate-quest-quake motion-reduce:animate-none",
        )}
      >
        <div class="flex flex-col items-center justify-center gap-3 p-3">
          <Index each={monsters()}>
            {(m, i) => (
              <div
                class={cn(
                  "relative flex flex-col items-center",
                  entering() && "animate-quest-enter",
                  motionClass(`m${m().index}`),
                  m().hp <= 0 && "animate-quest-die",
                )}
                style={{ "animation-delay": entering() ? `${i * 0.12}s` : "" }}
              >
                <span
                  class="block animate-quest-idle motion-reduce:animate-none"
                  style={{ "animation-delay": `${i * 0.35}s` }}
                >
                  <img
                    src={MONSTER_ART[m().kind]}
                    alt={m().name}
                    class={cn(
                      "h-auto object-contain [image-rendering:pixelated]",
                      m().boss ? "w-44 sm:w-56" : "w-20 sm:w-24",
                      hurt().has(`m${m().index}`)
                        ? "animate-quest-hit"
                        : m().boss &&
                            props.state.angry &&
                            shown() > 0 &&
                            "animate-quest-aura",
                    )}
                  />
                </span>
                <div class="mt-1 h-2 w-20 overflow-hidden rounded-full bg-game-ink sm:w-24">
                  <div
                    class={cn(
                      "h-full rounded-full transition-[width] duration-300",
                      m().hp / m().maxHp > 0.5
                        ? "bg-game-green"
                        : m().hp / m().maxHp > 0.25
                          ? "bg-game-yellow"
                          : "bg-game-red",
                    )}
                    style={{ width: `${(m().hp / m().maxHp) * 100}%` }}
                  ></div>
                </div>
                <FxLayer effects={effects()} target={`m${m().index}`} />
                <BurstLayer bursts={bursts()} target={`m${m().index}`} />
                <PopupLayer popups={popups()} target={`m${m().index}`} />
              </div>
            )}
          </Index>
        </div>
        <div class="flex flex-col items-end justify-center gap-1 p-3 pr-6">
          <For each={party()}>
            {(h) => {
              const asleep = (): boolean => (heroHp()[h.slot] ?? 1) <= 0;
              return (
                <div
                  class={cn(
                    "relative",
                    h.slot % 2 === 1 && "-translate-x-8",
                    motionClass(`h${h.slot}`),
                  )}
                >
                  <span
                    class={cn(
                      "block motion-reduce:animate-none",
                      asleep()
                        ? ""
                        : victory()
                          ? "animate-quest-victory"
                          : "animate-quest-idle",
                    )}
                    style={{ "animation-delay": `${h.slot * 0.15}s` }}
                  >
                    <img
                      src={HERO_ART[h.cls]}
                      alt={CLASS_INFO[h.cls].name}
                      class={cn(
                        "h-auto w-16 transition-[rotate,opacity,filter] duration-300 [image-rendering:pixelated] sm:w-20",
                        asleep() && "rotate-90 opacity-50 grayscale",
                        hurt().has(`h${h.slot}`) && "animate-quest-hit",
                        h.uid === props.myUid &&
                          !hurt().has(`h${h.slot}`) &&
                          "drop-shadow-[0_0_6px_var(--color-game-yellow)]",
                      )}
                    />
                  </span>
                  <FxLayer effects={effects()} target={`h${h.slot}`} />
                  <BurstLayer bursts={bursts()} target={`h${h.slot}`} />
                  <PopupLayer popups={popups()} target={`h${h.slot}`} />
                </div>
              );
            }}
          </For>
        </div>

        <Show when={flash()} keyed>
          {(f) => (
            <div
              class={cn(
                "pointer-events-none absolute inset-0 animate-quest-flash motion-reduce:hidden",
                FLASH_CLASS[f.kind],
              )}
            ></div>
          )}
        </Show>
        <Show when={banner()}>
          {(b) => (
            <div class="pointer-events-none absolute inset-0 grid place-items-center">
              <span class="animate-game-pop rounded-2xl border-4 border-game-cream bg-game-navy px-6 py-3 text-4xl font-bold text-game-yellow motion-reduce:animate-none">
                {b()}
              </span>
            </div>
          )}
        </Show>
        <Show when={props.now < props.startAt}>
          <div class="pointer-events-none absolute inset-0 grid place-items-center bg-game-ink/40">
            <span class="animate-game-pop text-8xl font-bold text-game-yellow motion-reduce:animate-none">
              {countdown()}
            </span>
          </div>
        </Show>
      </div>

      {/* windows: message / menu + party */}
      <div class="grid gap-2 bg-game-ink p-2 sm:grid-cols-[1fr_minmax(0,18rem)]">
        <div class="relative min-h-36 rounded-xl border-4 border-game-cream bg-game-navy p-3">
          <Show
            when={
              props.deadline !== null &&
              (myHero() !== null || myGuard() !== null)
            }
          >
            <div class="absolute inset-x-0 top-0 h-1.5 overflow-hidden rounded-t-md bg-game-ink">
              <div
                class={cn(
                  "h-full",
                  (secondsLeft() ?? 99) <= 3 ? "bg-game-red" : "bg-game-yellow",
                )}
                style={{
                  width: `${timerShare(myGuard() !== null ? GUARD_MS : HERO_TURN_MS) * 100}%`,
                }}
              ></div>
            </div>
          </Show>

          <Show
            when={myGuard()}
            fallback={
              <Show
                when={myHero()}
                fallback={
                  <div class="grid gap-1">
                    <div class="text-lg leading-snug">{message()}</div>
                    <Show when={waitingOn()}>
                      {(who) => (
                        <div class="text-sm text-game-grey">
                          ⏳ Waiting for {who()}…
                        </div>
                      )}
                    </Show>
                  </div>
                }
              >
                <Show when={step() === "menu"}>
                  <div class="mb-2 text-sm text-game-grey">
                    Your turn, {CLASS_INFO[myClass()].name}! Pick a move (or
                    press 1-4):
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <For each={menu()}>
                      {(o, i) => (
                        <button
                          type="button"
                          class={cn(
                            "press-3d flex min-h-12 cursor-pointer items-center gap-2 rounded-lg bg-game-ink px-3 py-2 text-left text-lg font-bold text-game-cream hover:bg-game-blue hover:text-game-ink",
                            o.off === true && "cursor-not-allowed opacity-40",
                          )}
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => choose(o)}
                        >
                          <span class="text-sm text-game-grey">{i() + 1}</span>
                          <span>{o.emoji}</span>
                          <span class="truncate">{o.label}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={step() === "target"}>
                  <div class="mb-2 flex items-center justify-between text-sm text-game-grey">
                    <span>Who? (press a number)</span>
                    <button
                      type="button"
                      class="cursor-pointer rounded bg-transparent px-1 text-game-grey underline hover:text-game-cream"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => setStep("menu")}
                    >
                      ← back
                    </button>
                  </div>
                  <div class="grid gap-2 sm:grid-cols-2">
                    <For each={targetsFor(action()) ?? []}>
                      {(t, i) => (
                        <button
                          type="button"
                          class="press-3d flex min-h-12 cursor-pointer items-center gap-2 rounded-lg bg-game-ink px-3 py-2 text-left text-lg font-bold text-game-cream hover:bg-game-blue hover:text-game-ink"
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => pickTarget(t)}
                        >
                          <span class="text-sm text-game-grey">{i() + 1}</span>
                          <span class="flex-1 truncate">{t.label}</span>
                          <span class="text-sm font-normal">{t.detail}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={step() === "type"}>
                  <div class="flex items-center justify-between text-sm text-game-grey">
                    <span>
                      {menu().find((o) => o.action === action())?.emoji} Type it
                      fast for a ⭐ critical!
                    </span>
                    <button
                      type="button"
                      class="cursor-pointer rounded bg-transparent px-1 text-game-grey underline hover:text-game-cream"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setStep("menu");
                        clearInput();
                      }}
                    >
                      ← back
                    </button>
                  </div>
                  <TypedWord word={word()} typed={typed()} />
                </Show>
              </Show>
            }
          >
            {(g) => (
              <div class="grid gap-1">
                <div class="text-lg font-bold text-game-red">
                  ⚠️ {monsters()[g().monster]?.name ?? "The monster"}{" "}
                  {g().big ? "attacks EVERYONE" : "attacks you"}! Guard:
                </div>
                <TypedWord word={g().word} typed={typed()} />
              </div>
            )}
          </Show>
        </div>

        {/* party window */}
        <div class="grid content-start gap-1.5 rounded-xl border-4 border-game-cream bg-game-navy p-2.5">
          <For each={party()}>
            {(h) => {
              const hp = (): number => heroHp()[h.slot] ?? 0;
              const max = CLASS_INFO[h.cls].maxHp;
              const live = (): QuestState["heroes"][number] | undefined =>
                caughtUp() ? props.state.heroes[h.slot] : undefined;
              return (
                <div
                  class={cn(
                    "grid gap-0.5 rounded-md px-1.5 py-0.5",
                    active() === `h${h.slot}` && "bg-game-ink",
                    myHero()?.slot === h.slot && "ring-2 ring-game-yellow",
                  )}
                >
                  <div class="flex items-center gap-1.5 text-sm">
                    <span>{CLASS_INFO[h.cls].emoji}</span>
                    <span
                      class={cn(
                        "flex-1 truncate font-bold",
                        h.uid === props.myUid && "text-game-yellow",
                        hp() <= 0 && "text-game-grey",
                      )}
                    >
                      {heroName(h.slot)}
                      {live()?.away === true ? " (helper)" : ""}
                    </span>
                    <Show when={live()?.defending === true}>
                      <span title="Defending">🛡️</span>
                    </Show>
                    <Show when={live()?.protectedBy !== undefined}>
                      <span title="Protected">💠</span>
                    </Show>
                    <span class="tabular-nums">
                      {hp() <= 0 ? "💤" : `${hp()}/${max}`}
                    </span>
                  </div>
                  <div class="h-1.5 overflow-hidden rounded-full bg-game-ink">
                    <div
                      class={cn(
                        "h-full rounded-full transition-[width] duration-300",
                        hp() / max > 0.5
                          ? "bg-game-green"
                          : hp() / max > 0.25
                            ? "bg-game-yellow"
                            : "bg-game-red",
                      )}
                      style={{ width: `${(hp() / max) * 100}%` }}
                    ></div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* always mounted so the iPad keyboard stays up */}
      <div class="flex justify-center bg-game-ink px-3 pb-3">
        <MiniTypingInput
          value={typed()}
          onInput={onInput}
          wrong={wrong()}
          waiting={myHero() === null && myGuard() === null}
          placeholder={
            myGuard() !== null
              ? "type the guard word!"
              : step() === "type"
                ? "type the word"
                : myHero() !== null
                  ? "press a number"
                  : "wait for your turn"
          }
          ref={(el) => (inputEl = el)}
        />
      </div>
    </div>
  );
}

const normalize = (raw: string): string =>
  raw.toLowerCase().replace(/\s+/g, " ").replace(/^ /, "");

/** The words to type, with what's typed so far coloured in. */
function TypedWord(props: { word: string; typed: string }): JSXElement {
  const done = (): number => {
    const t = normalize(props.typed);
    let i = 0;
    while (i < t.length && t[i] === props.word[i]) i++;
    return i;
  };
  return (
    <div
      class={cn(
        "py-2 text-center font-mono font-bold tracking-wide whitespace-pre-wrap",
        props.word.length > 16
          ? "text-2xl sm:text-3xl"
          : props.word.length > 9
            ? "text-3xl sm:text-4xl"
            : "text-4xl sm:text-5xl",
      )}
    >
      <span class="text-game-green">{props.word.slice(0, done())}</span>
      <span class="text-game-cream">{props.word.slice(done())}</span>
    </div>
  );
}

function PopupLayer(props: { popups: Popup[]; target: string }): JSXElement {
  return (
    <For each={props.popups.filter((p) => p.target === props.target)}>
      {(p) => (
        <span
          class={cn(
            "pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 animate-game-float-up text-2xl font-bold whitespace-nowrap drop-shadow motion-reduce:animate-none",
            p.tone === "heal" && "text-game-green",
            p.tone === "crit" && "text-3xl text-game-yellow",
            p.tone === "hurt" && "text-game-red",
            p.tone === "hit" && "text-game-cream",
          )}
        >
          {p.text}
        </span>
      )}
    </For>
  );
}

function BurstLayer(props: { bursts: Burst[]; target: string }): JSXElement {
  return (
    <For each={props.bursts.filter((b) => b.target === props.target)}>
      {(b) => (
        <span class="pointer-events-none absolute top-1/2 left-1/2 animate-quest-burst text-5xl drop-shadow motion-reduce:hidden">
          {b.emoji}
        </span>
      )}
    </For>
  );
}

function FxLayer(props: { effects: Fx[]; target: string }): JSXElement {
  return (
    <For each={props.effects.filter((f) => f.target === props.target)}>
      {(f) => (
        <For each={fxParticles(f.kind, f.fromRight)}>
          {(p) => <span class={p.class} style={p.style}></span>}
        </For>
      )}
    </For>
  );
}
