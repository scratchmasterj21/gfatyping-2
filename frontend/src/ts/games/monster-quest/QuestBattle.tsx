import {
  batch,
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
  HERO_TURN_MS,
  HeroAction,
  HeroInput,
  heroId,
  HitResult,
  LandId,
  LANDS,
  MONSTER_INFO,
  MonsterState,
  PendingHero,
  QuestEvent,
  QuestSetup,
  QuestState,
  typingPower,
  monsterWord,
  ULTIMATES,
  UltimateId,
  VOTE_MS,
  VoteOption,
  WEATHER_INFO,
  Weather,
  SHOP_ITEMS,
  SPIRIT_MAX,
  TWISTS,
} from "./quest-rules";
import { UltimateField } from "./UltimateField";

type Popup = { id: number; target: string; text: string; tone: string };
type Burst = { id: number; target: string; emoji: string };
type Fx = { id: number; target: string; kind: FxKind; fromRight: boolean };
type Motion =
  | "lunge-left"
  | "lunge-right"
  | "cast"
  | "spin-dash"
  | "leap"
  | "stomp"
  | "channel";
const MOTION_CLASS: Record<Motion, string> = {
  "lunge-left": "animate-quest-lunge-left",
  "lunge-right": "animate-quest-lunge-right",
  cast: "animate-quest-cast",
  "spin-dash": "animate-quest-spin-dash",
  leap: "animate-quest-leap",
  stomp: "animate-quest-stomp",
  channel: "animate-quest-channel",
};

/** Each super move's hero motion and the effect on its targets. */
const ULT_SHOW: Record<UltimateId, { motion: Motion; fx: FxKind }> = {
  whirlwind: { motion: "spin-dash", fx: "tornado" },
  mighty: { motion: "leap", fx: "megaimpact" },
  icestorm: { motion: "channel", fx: "frost" },
  thunder: { motion: "channel", fx: "bolt" },
  groupheal: { motion: "channel", fx: "hearts" },
  holy: { motion: "channel", fx: "pillar" },
  wall: { motion: "channel", fx: "dome" },
  slam: { motion: "stomp", fx: "eruption" },
};
/** cut-in first, then the effect, then the hits land */
const CUT_IN_MS = 900;
const ULT_HIT_MS = 1400;
type Step = "menu" | "target" | "type";

/** Hits land a little after the move name shows. */
const HIT_DELAY_MS = 380;
/** Skip ahead (no animations) only when this far behind the party. */
const CATCH_UP_AFTER_MS = 8000;

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
  onVote: (choice: string) => void;
  /** a phrase or choice word was typed: for the typing results */
  onTyped?: (t: { chars: number; ms: number; errors: number }) => void;
  /** votes so far on the open vote (online), uid -> option id */
  openVotes?: Record<string, string>;
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
  const [bigQuake, setBigQuake] = createSignal(false);
  const [cutIn, setCutIn] = createSignal<{
    slot: number;
    id: UltimateId;
  } | null>(null);
  const [ultField, setUltField] = createSignal<UltimateId | null>(null);
  const [dim, setDim] = createSignal(false);
  const [effects, setEffects] = createSignal<Fx[]>([]);
  const [flash, setFlash] = createSignal<{
    id: number;
    kind: FlashKind;
  } | null>(null);
  const [entering, setEntering] = createSignal(false);
  const [victory, setVictory] = createSignal(false);
  const [land, setLand] = createSignal<LandId | null>(null);
  const [weather, setWeather] = createSignal<Weather>("clear");
  const [heroMax, setHeroMax] = createSignal<number[]>([]);
  /** monsters that just joined (slide in) */
  const [joined, setJoined] = createSignal<Set<number>>(new Set());
  const motionClass = (id: string): string | undefined => {
    const m = motion();
    return m !== null && m.id === id ? MOTION_CLASS[m.kind] : undefined;
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
    setBigQuake(false);
    setCutIn(null);
    setUltField(null);
    setDim(false);
    setEntering(false);
    setVictory(false);
    setLand(null);
    setJoined(new Set<number>());
    setWeather("clear");
    setHeroMax(props.setup.party.map((h) => CLASS_INFO[h.cls].maxHp));
  };
  // Only a NEW quest (new seed) restarts playback. on() alone re-runs on
  // every change of props.setup - and online that's a fresh object on each
  // room update, so every move replayed the battle from the very start.
  const seed = createMemo(() => props.setup.seed);
  createEffect(on(seed, () => resetPlayback()));

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

  const effect = (
    target: string,
    kind: FxKind,
    fromRight: boolean,
    ms = 1100,
  ): void => {
    const id = ++popupId;
    setEffects((f) => [...f, { id, target, kind, fromRight }]);
    setTimeout(() => setEffects((f) => f.filter((q) => q.id !== id)), ms);
  };

  /** A super move: cut-in banner, the big effect, then the hits. */
  const playUltimate = (
    e: Extract<QuestEvent, { type: "action" }>,
    u: UltimateId,
  ): void => {
    const slot = Number(e.actor.slice(1));
    setActive(e.actor);
    setMessage(
      `⭐ SUPER MOVE! ${actorName(e.actor)}: ${e.emoji} ${e.move}!${e.combo !== undefined ? ` (${e.combo})` : ""}`,
    );
    setCutIn({ slot, id: u });
    setDim(true);
    setMotion({ id: e.actor, kind: "channel" });
    sfx.great();
    setTimeout(() => {
      setCutIn(null);
      setUltField(u);
      setMotion({ id: e.actor, kind: ULT_SHOW[u].motion });
      const targets = e.shields ?? e.hits.map((h) => h.id);
      for (const t of targets) effect(t, ULT_SHOW[u].fx, true, 1700);
      if (u === "mighty" || u === "slam") {
        setTimeout(() => {
          setBigQuake(true);
          setTimeout(() => setBigQuake(false), 650);
        }, 380);
      }
      sfx.boom();
    }, CUT_IN_MS);
    hitTimer = setTimeout(() => applyHits(e.hits), ULT_HIT_MS);
    setTimeout(() => {
      setUltField(null);
      setDim(false);
      setMotion(null);
    }, 2300);
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
      } else if (hit.miss === true) {
        popup(hit.id, "Miss!", "hit");
      } else {
        struck.add(hit.id);
        popup(
          hit.id,
          `${hit.crit === true ? "⭐" : ""}${hit.amount}${hit.weak === true ? " 🔥x2" : ""}${hit.guarded === true ? " 🛡️" : ""}`,
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
    else if (hits.some((h) => h.miss !== true)) sfx.good();
    else if (hits.length > 0) sfx.oops();
  };

  /** HP changes only - no popups, sounds or shakes (see skip). */
  const applyHitsQuietly = (hits: HitResult[]): void => {
    for (const hit of hits) {
      const i = Number(hit.id.slice(1));
      const sign = hit.heal === true ? 1 : -1;
      if (hit.miss === true) continue;
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
    }
  };

  /**
   * Fast-forward one event: keep what lasts (monsters, HP, land, level) with
   * no animation. Used to catch up after a reload / rejoin, which used to
   * replay the whole quest from Battle 1 at full speed while your turn timer
   * ran out.
   */
  const skip = (e: QuestEvent): void => {
    if (e.type === "battle") {
      setMonsters(e.monsters.map((m) => ({ ...m })));
      setBattle(e.battle);
      setLand(e.land);
      setWeather(e.weather);
      setJoined(new Set<number>());
      setVictory(false);
      return;
    }
    if (e.type === "path") {
      setLand(e.land);
      return;
    }
    if (e.type === "spawn") {
      const m = e.monster;
      setMonsters((ms) => [...ms, { ...m }]);
      return;
    }
    if (e.type === "levelup") {
      setHeroMax(e.maxHp);
      setHeroHp(e.hp);
      return;
    }
    if (e.type === "rest") {
      setHeroHp(e.hp);
      return;
    }
    if (e.type === "end") {
      setVictory(e.won);
      return;
    }
    if (e.type === "status" || e.type === "team" || e.type === "outcome") {
      applyHitsQuietly(e.hits);
      return;
    }
    if (e.type === "action") {
      const flags = e.flags;
      if (flags !== undefined) {
        const i = Number(e.actor.slice(1));
        setMonsters((ms) =>
          ms.map((m) => (m.index === i ? { ...m, ...flags } : m)),
        );
      }
      applyHitsQuietly(e.hits);
    }
  };

  const play = (e: QuestEvent): void => {
    setActive(null);
    if (e.type === "battle") {
      setMonsters(e.monsters.map((m) => ({ ...m })));
      setBattle(e.battle);
      setLand(e.land);
      setWeather(e.weather);
      setJoined(new Set<number>());
      const boss = e.battle === BATTLE_COUNT - 1;
      setBanner(boss ? "👑 BOSS BATTLE!" : `⚔️ Battle ${e.battle + 1}`);
      const kinds = [...new Set(e.monsters.map((m) => m.kind))];
      const sky =
        e.weather === "clear"
          ? ""
          : ` ${WEATHER_INFO[e.weather].emoji} ${WEATHER_INFO[e.weather].name}: ${WEATHER_INFO[e.weather].tip}.`;
      const wk = props.setup.weekly;
      const twistText =
        wk === undefined
          ? ""
          : ` ${TWISTS[wk.twist].emoji} ${TWISTS[wk.twist].name}: ${TWISTS[wk.twist].tip}.`;
      setMessage(
        `${boss ? `${e.monsters[0]?.name ?? "The boss"} appears!` : "Monsters appear!"}${twistText}${sky} ${kinds
          .map((k) => `💡 ${MONSTER_INFO[k].name}: ${MONSTER_INFO[k].trick}.`)
          .join(" ")}`,
      );
      setTimeout(() => setBanner(null), 1500);
      setVictory(false);
      setEntering(true);
      setTimeout(() => setEntering(false), 750);
      return;
    }
    if (e.type === "path") {
      setLand(e.land);
      setBanner(
        e.topic === "land"
          ? `${e.choice.emoji} ${e.choice.label}`
          : `👑 ${e.choice.label}`,
      );
      setMessage(
        e.topic === "land"
          ? `The party heads into ${e.choice.label}!`
          : `To the lair of ${e.choice.label}!`,
      );
      setTimeout(() => setBanner(null), 1600);
      sfx.great();
      return;
    }
    if (e.type === "spawn") {
      const m = e.monster;
      setMonsters((ms) => [...ms, { ...m }]);
      setJoined((j) => new Set([...j, m.index]));
      setTimeout(
        () => setJoined((j) => new Set([...j].filter((x) => x !== m.index))),
        800,
      );
      setMessage(
        m.kind === "slime"
          ? "💧 The slime splits in two!"
          : `🤖 ${m.name} joins the fight!`,
      );
      sfx.pop();
      return;
    }
    if (e.type === "status") {
      const who = actorName(e.id);
      const text: Record<typeof e.what, string> = {
        poison: `🤢 ${who} ${who === "You" ? "feel" : "feels"} the poison.`,
        asleep: `💤 ${who} ${who === "You" ? "are" : "is"} fast asleep…`,
        frozen: `🧊 ${who} ${who === "You" ? "are" : "is"} frozen solid!`,
        regrow: `🌿 ${who} regrows some leaves!`,
        rebuild: `💀 ${who} rattles back together!`,
        potionsBack: "🧪 You got your potions back!",
      };
      setMessage(text[e.what]);
      if (e.what === "asleep") popup(e.id, "💤", "hit");
      if (e.what === "frozen") popup(e.id, "🧊", "hit");
      if (e.what === "poison") effect(e.id, "poison", false);
      if (e.what === "regrow") effect(e.id, "heal", false);
      if (e.what === "rebuild") effect(e.id, "spooky", false);
      applyHits(e.hits);
      return;
    }
    if (e.type === "journey") {
      const intro: Record<typeof e.what, [string, string]> = {
        chest: ["🧰 Treasure!", "You found a treasure chest on the path!"],
        trap: ["⚠️ Trap!", "Watch out - a trap on the path!"],
        fairy: ["✨ A fairy!", "A friendly fairy flies over…"],
        shop: ["🧙 A shop!", "A traveling shop! Time to spend some gold."],
      };
      setBanner(intro[e.what][0]);
      setMessage(intro[e.what][1]);
      setTimeout(() => setBanner(null), 1600);
      sfx.pop();
      return;
    }
    if (e.type === "team") {
      setBanner("🌟 TEAM ATTACK!");
      setTimeout(() => setBanner(null), 1800);
      setMessage(
        e.ids.length > 0
          ? `🌟 ${e.ids.map((id) => actorName(id)).join(", ")} typed together - TEAM ATTACK!`
          : "🌟 The whole party attacks together!",
      );
      for (const h of party()) {
        effect(`h${h.slot}`, "charge", false);
      }
      const id = ++popupId;
      setFlash({ id, kind: "laser" });
      setTimeout(() => setFlash((f) => (f?.id === id ? null : f)), 650);
      setVictory(true);
      setTimeout(() => setVictory(false), 1200);
      for (const h of e.hits) {
        effect(h.id, "thunder", true);
        effect(h.id, "holy", true);
      }
      hitTimer = setTimeout(() => applyHits(e.hits), HIT_DELAY_MS);
      sfx.boom();
      return;
    }
    if (e.type === "outcome") {
      const text: Record<typeof e.what, string> = {
        chestOpen: "🧰 The chest pops open: +1 🧪 potion and +10 💰 gold!",
        chestStuck: "🧰 The chest stayed stuck… maybe next time!",
        trapDodged: "⚠️ Everyone jumped clear of the trap!",
        trapHit: "⚠️ Ouch! The trap got some of the party.",
        fairy:
          "✨ The fairy blesses everyone: your next move is a ⭐ critical!",
        potion: `${SHOP_ITEMS["potion"]?.emoji ?? ""} The party bought a potion!`,
        feast: `${SHOP_ITEMS["feast"]?.emoji ?? ""} A picnic! Everyone feels much better.`,
        charm: `${SHOP_ITEMS["charm"]?.emoji ?? ""} Power Charm! Everyone hits harder now.`,
        save: "💰 The party saved its gold.",
      };
      setMessage(text[e.what]);
      const sparkle =
        e.what === "fairy" || e.what === "charm" || e.what === "chestOpen";
      const ids = e.what === "charm" ? party().map((h) => `h${h.slot}`) : e.ids;
      for (const id of ids) {
        effect(id, sparkle ? "charge" : "rock", false);
      }
      if (e.hits.length > 0) applyHits(e.hits);
      else if (sparkle) sfx.great();
      return;
    }
    if (e.type === "levelup") {
      setHeroMax(e.maxHp);
      setHeroHp(e.hp);
      setBanner("⭐ LEVEL UP!");
      setTimeout(() => setBanner(null), 1800);
      setMessage(
        `⭐ Everyone is stronger! New super moves: ${party()
          .map((h) => {
            const u = e.picks[h.slot];
            return u === undefined
              ? ""
              : `${heroName(h.slot)} ${ULTIMATES[u].emoji} ${ULTIMATES[u].name}`;
          })
          .filter((x) => x !== "")
          .join(", ")}.`,
      );
      for (const h of party()) effect(`h${h.slot}`, "charge", false);
      sfx.finish();
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
    if (e.ultimate !== undefined) {
      playUltimate(e, e.ultimate);
      return;
    }
    setActive(e.actor);
    const targets =
      e.hits.length === 1 && e.hits[0] !== undefined
        ? ` on ${actorName(e.hits[0].id)}`
        : "";
    setMessage(
      `${e.combo !== undefined ? `💥 COMBO ${e.combo}! ` : ""}${actorName(e.actor)}: ${e.emoji} ${e.move}${targets}!${e.note !== undefined ? ` (${e.note})` : ""}`,
    );
    if (e.combo !== undefined) {
      setBanner(`💥 COMBO! ${e.combo}`);
      setTimeout(() => setBanner(null), 1000);
    }
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
    // a monster's fading / flying / charging shows after its move
    const flags = e.flags;
    if (flags !== undefined) {
      const i = Number(e.actor.slice(1));
      setMonsters((ms) =>
        ms.map((m) => (m.index === i ? { ...m, ...flags } : m)),
      );
    }
    // effects start now so they land with the hit
    const fxTargets =
      e.shields ??
      (e.shield !== undefined
        ? [e.shield]
        : kind === "charge"
          ? [e.actor]
          : e.hits.map((h) => h.id));
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
      // a move was taken back (e.g. lost a race online): don't restart
      // the whole battle, just carry on from here
      setShown(events.length);
      return;
    }
    if (i >= events.length || playTimer !== undefined) return;
    if (props.now < props.startAt) return;
    // Behind by more than the latest move (reloaded, rejoined, or the tab
    // was asleep): jump to it instead of replaying everything since Battle 1.
    // Only when really behind - in normal play a quick friend's move can
    // land while the last one is still animating, and skipping then hid
    // things like a skeleton rattling back together.
    const starts = props.state.inputStart;
    const keepFrom = Math.min(events.length, starts[starts.length - 1] ?? 0);
    let behindMs = 0;
    for (let k = i; k < keepFrom; k++) {
      behindMs += eventMs(events[k] as QuestEvent);
    }
    if (i < keepFrom && behindMs > CATCH_UP_AFTER_MS) {
      untrack(() => {
        batch(() => {
          for (let k = i; k < keepFrom; k++) skip(events[k] as QuestEvent);
          setMessage("⏩ Caught up with the party!");
          setShown(keepFrom);
        });
      });
      return;
    }
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
  /** words I have to type right now (guard / chest / trap) */
  const myGuard = (): {
    n: number;
    word: string;
    title: string;
    challenge: boolean;
    chest: boolean;
    ms: number;
  } | null => {
    const p = props.state.pending;
    if (p === null || !caughtUp()) return null;
    if (p.kind !== "guard" && p.kind !== "challenge") return null;
    const word = p.words[props.myUid];
    if (word === undefined || submitted() === p.n) return null;
    const title =
      p.kind === "challenge"
        ? p.what === "team"
          ? "🌟 Team Spirit is full! Everyone type together:"
          : p.what === "chest"
            ? "🧰 A treasure chest! Type to open it:"
            : "⚠️ A trap! Type fast to jump clear:"
        : `⚠️ ${monsters()[p.monster]?.name ?? "The monster"} ${p.big ? "attacks EVERYONE" : "attacks you"}! Guard:`;
    return {
      n: p.n,
      word,
      title,
      challenge: p.kind === "challenge",
      chest: p.kind === "challenge" && p.what !== "trap",
      ms: p.ms,
    };
  };
  const [chosen, setChosen] = createSignal<string>();
  /** a vote (land / boss / shop) or my level-up pick */
  const myVote = (): {
    n: number;
    title: string;
    options: VoteOption[];
    shared: boolean;
  } | null => {
    const p = props.state.pending;
    if (p === null || !caughtUp()) return null;
    if (p.kind !== "vote" && p.kind !== "pick") return null;
    if (!p.voters.includes(props.myUid)) return null;
    if (p.kind === "pick") {
      return {
        n: p.n,
        title: "⭐ Level up! Pick your super move:",
        options: p.options[props.myUid] ?? [],
        shared: false,
      };
    }
    if (p.kind !== "vote") return null;
    return {
      n: p.n,
      title:
        p.topic === "land"
          ? "🗺️ Where should the party go?"
          : p.topic === "boss"
            ? "👑 Which boss will you face?"
            : `🧙 The shop! What should the party buy? (💰 ${props.state.gold} gold)`,
      options: p.options,
      shared: true,
    };
  };
  const voted = (): string | undefined => {
    const p = myVote();
    if (p === null) return undefined;
    return submitted() === p.n ? chosen() : props.openVotes?.[props.myUid];
  };
  const castVote = (id: string): void => {
    const p = myVote();
    if (p === null || voted() !== undefined) return;
    setChosen(id);
    setSubmitted(p.n);
    sfx.great();
    props.onVote(id);
  };
  const voteCount = (id: string): number =>
    Object.values(props.openVotes ?? {}).filter((v) => v === id).length +
    (chosen() === id &&
    submitted() === myVote()?.n &&
    props.openVotes?.[props.myUid] === undefined
      ? 1
      : 0);

  /** friends who haven't chosen yet on the open vote / super-move pick */
  const stillChoosing = (): string[] => {
    const p = props.state.pending;
    if (p === null || (p.kind !== "vote" && p.kind !== "pick")) return [];
    const votes = props.openVotes ?? {};
    return p.voters
      .filter((u) => u !== props.myUid && votes[u] === undefined)
      .map((u) => party().find((h) => h.uid === u)?.name ?? "a friend");
  };
  /** someone else is choosing */
  const waitingOn = (): string | null => {
    const p = props.state.pending;
    if (p === null || !caughtUp() || props.state.over) return null;
    if (p.kind === "vote" || p.kind === "pick") {
      if (voted() === undefined && p.voters.includes(props.myUid)) return null;
      const names = stillChoosing();
      const left = secondsLeft();
      return `${names.length > 0 ? names.join(", ") : "friends"} to choose${left !== null && left > 0 ? ` (${left}s)` : ""}`;
    }
    if (p.kind === "challenge") {
      return p.words[props.myUid] === undefined || submitted() === p.n
        ? "friends to type"
        : null;
    }
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
    /** what to type to pick it */
    word: string;
    label: string;
    emoji: string;
    off?: boolean;
  };
  const menu = (): Option[] => {
    const info = CLASS_INFO[myClass()];
    return [
      { action: "attack", word: "attack", label: "", emoji: "⚔️" },
      {
        action: "skill",
        word: info.skill.toLowerCase(),
        label: "",
        emoji: info.skillEmoji,
      },
      { action: "defend", word: "defend", label: "", emoji: "🛡️" },
      {
        action: "potion",
        word: "potion",
        label: `x${props.state.potions}`,
        emoji: "🧪",
        off: props.state.potions <= 0,
      },
      ...(ult() === undefined
        ? []
        : [
            {
              action: "ultimate" as const,
              word: ULTIMATES[ult() ?? "mighty"].name.toLowerCase(),
              label:
                (me()?.ultimateCooldown ?? 0) > 0
                  ? `in ${me()?.ultimateCooldown}`
                  : "⭐",
              emoji: ULTIMATES[ult() ?? "mighty"].emoji,
              off: (me()?.ultimateCooldown ?? 0) > 0,
            },
          ]),
    ];
  };
  const ult = (): QuestState["heroes"][number]["ultimate"] => me()?.ultimate;
  /** does what's typed so far fit this choice word? */
  const fits = (w: string): boolean => w.startsWith(normalize(typed()));

  type TargetOption = {
    index: number;
    word: string;
    label: string;
    detail: string;
  };
  const targetsFor = (a: HeroAction): TargetOption[] | null => {
    const info = CLASS_INFO[myClass()];
    const aim =
      a === "attack"
        ? "monster"
        : a === "skill"
          ? info.skillTarget
          : a === "potion"
            ? "ally"
            : a === "ultimate" && ULTIMATES[ult() ?? "wall"].aim === "monster"
              ? "monster"
              : "none";
    if (aim === "monster") {
      return props.state.monsters
        .filter((m) => m.hp > 0)
        .map((m) => ({
          index: m.index,
          word: monsterWord(m),
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
        word: CLASS_INFO[h.cls].name.toLowerCase(),
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
    record(word());
    setSubmitted(p.n);
    clearInput();
    props.onHero({
      kind: "hero",
      action: action(),
      ...(target() === undefined ? {} : { target: target() }),
      power,
    });
  };

  const noop = (): void => undefined;

  /** a finished phrase / choice word, for the typing results */
  const record = (text: string): void => {
    props.onTyped?.({
      chars: text.length,
      ms: performance.now() - typeStart,
      errors,
    });
    errors = 0;
    typeStart = performance.now();
  };

  /** Typing a choice word: picks it when it matches, red when nothing fits. */
  const typeChoice = <T extends { word: string }>(
    raw: string,
    options: T[],
    onPick: (o: T) => void,
  ): void => {
    const value = normalize(raw);
    const hit = options.find((o) => o.word === value);
    if (hit !== undefined) {
      record(hit.word);
      clearInput();
      onPick(hit);
      return;
    }
    const ok = value === "" || options.some((o) => o.word.startsWith(value));
    if (!ok && !wrong()) {
      errors++;
      sfx.oops();
    }
    setWrong(!ok);
    setTyped(raw);
  };

  const onInput = (raw: string): void => {
    // phrases: ignore case, extra spaces and a leading space
    const value = normalize(raw);
    const guard = myGuard();
    if (guard !== null) {
      if (value === guard.word) {
        record(guard.word);
        setSubmitted(guard.n);
        clearInput();
        sfx.great();
        popup(
          heroId(myGuardSlot()),
          guard.challenge ? "✨ Got it!" : "🛡️ Guard!",
          "heal",
        );
        props.onGuard(true);
        return;
      }
      const ok = guard.word.startsWith(value);
      if (!ok && !wrong()) {
        errors++;
        sfx.oops();
      }
      setWrong(!ok);
      setTyped(raw);
      return;
    }
    const vote = myVote();
    if (vote !== null) {
      if (voted() !== undefined) {
        clearInput();
        return;
      }
      const hit = vote.options.find((o) => o.word === normalize(raw));
      typeChoice(raw, vote.options, noop);
      if (hit !== undefined) castVote(hit.id);
      return;
    }
    if (myHero() === null) {
      clearInput();
      return;
    }
    if (step() === "menu") {
      typeChoice(raw, menu(), choose);
      return;
    }
    if (step() === "target") {
      typeChoice(
        raw,
        [...(targetsFor(action()) ?? []), { word: "back", index: -1 }],
        (t) => {
          if (t.index === -1) {
            setStep("menu");
          } else {
            pickTarget(t as TargetOption);
          }
        },
      );
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
        (myHero() !== null || myGuard() !== null || myVote() !== null) &&
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
    <div class="game-motion relative flex h-full w-full flex-col overflow-hidden bg-game-night font-kid text-game-cream select-none">
      {/* turn order */}
      <div class="flex min-h-14 items-center gap-1.5 bg-game-ink/70 px-3 pt-16 pb-1.5 sm:pt-1.5 sm:pr-60 sm:pl-20">
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
          "[container-type:size] relative grid min-h-52 flex-1 grid-cols-2 overflow-hidden bg-linear-to-b transition-colors duration-700",
          land() === "mountain"
            ? "from-game-night via-game-blue/60 to-game-mint"
            : land() === "castle"
              ? "from-game-ink via-game-purple/60 to-game-grey"
              : "from-game-night via-game-navy to-game-grass-dark",
          bigQuake()
            ? "animate-quest-big-quake motion-reduce:animate-none"
            : quake() && "animate-quest-quake motion-reduce:animate-none",
        )}
      >
        <Show when={weather() !== "clear"}>
          <WeatherLayer weather={weather()} />
        </Show>
        <Show when={land()}>
          {(l) => (
            <div class="pointer-events-none absolute inset-x-0 bottom-0 flex justify-around text-5xl opacity-20 select-none">
              <For each={[0, 1, 2, 3, 4]}>
                {(n) => (
                  <span class={n % 2 === 1 ? "text-4xl" : ""}>
                    {LANDS[l()].emoji}
                  </span>
                )}
              </For>
            </div>
          )}
        </Show>
        <Show when={dim()}>
          <div class="pointer-events-none absolute inset-0 animate-quest-dim bg-game-ink/65"></div>
        </Show>
        <div class="relative flex flex-wrap content-center items-center justify-center gap-x-4 gap-y-1 p-2">
          <Index each={monsters()}>
            {(m, i) => (
              <div
                class={cn(
                  "relative flex flex-col items-center",
                  // one animation at a time: custom animate-* classes don't
                  // override each other, so a leftover slide-in hid deaths
                  m().hp <= 0
                    ? "animate-quest-die"
                    : (motionClass(`m${m().index}`) ??
                        ((entering() || joined().has(m().index)) &&
                          "animate-quest-enter")),
                )}
                style={{ "animation-delay": entering() ? `${i * 0.12}s` : "" }}
              >
                <Show
                  when={m().hp > 0 && (m().faded || m().flying || m().charging)}
                >
                  <span class="absolute -top-3 z-10 rounded-full bg-game-ink/80 px-2 text-xs font-bold whitespace-nowrap text-game-cream">
                    {m().charging
                      ? "⚡ charging - Defend!"
                      : m().flying
                        ? "🪽 flying - use spells!"
                        : "👻 faded - use spells!"}
                  </span>
                </Show>
                <span
                  class={cn(
                    "block animate-quest-idle transition-[translate] duration-500",
                    m().flying && "-translate-y-12",
                  )}
                  style={{ "animation-delay": `${i * 0.35}s` }}
                >
                  <img
                    src={MONSTER_ART[m().kind]}
                    alt={m().name}
                    class={cn(
                      "h-auto object-contain transition-opacity duration-500 [image-rendering:pixelated]",
                      m().boss
                        ? "h-[min(58cqh,14rem)] w-auto"
                        : m().mini === true
                          ? "h-[min(13cqh,3.5rem)] w-auto"
                          : "h-[min(22cqh,6rem)] w-auto",
                      m().faded && "opacity-30",
                      hurt().has(`m${m().index}`)
                        ? "animate-quest-hit"
                        : m().charging
                          ? "drop-shadow-[0_0_14px_var(--color-game-yellow)]"
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
        <div class="relative flex flex-col items-end justify-center gap-[1cqh] py-1 pr-6">
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
                      "block",
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
                        "h-[min(20cqh,5.5rem)] w-auto transition-[rotate,opacity,filter] duration-300 [image-rendering:pixelated]",
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
                "pointer-events-none absolute inset-0 animate-quest-flash",
                FLASH_CLASS[f.kind],
              )}
            ></div>
          )}
        </Show>
        <Show when={ultField()} keyed>
          {(k) => <UltimateField kind={k} />}
        </Show>
        <Show when={cutIn()}>
          {(c) => (
            <div class="pointer-events-none absolute inset-0 z-20 grid items-center">
              <div class="relative h-[min(40cqh,9rem)] origin-center animate-quest-cutin overflow-hidden border-y-4 border-game-yellow bg-linear-to-r from-game-ink via-game-purple to-game-ink shadow-[0_0_30px_var(--color-game-purple)]">
                <For each={[0, 1, 2, 3, 4, 5, 6, 7]}>
                  {(i) => (
                    <span
                      class="absolute h-0.5 w-1/3 animate-quest-streak bg-game-cream/50"
                      style={{
                        top: `${10 + i * 11}%`,
                        "animation-delay": `${(i * 0.07) % 0.4}s`,
                      }}
                    ></span>
                  )}
                </For>
                <div class="relative flex h-full animate-quest-cutin-slide items-center justify-center gap-4 px-4">
                  <img
                    src={HERO_ART[party()[c().slot]?.cls ?? "knight"]}
                    alt=""
                    class="h-[85%] w-auto drop-shadow-[0_0_14px_var(--color-game-yellow)] [image-rendering:pixelated]"
                  />
                  <div class="grid">
                    <span class="text-sm font-bold tracking-widest text-game-cream uppercase">
                      {heroName(c().slot)} · super move!
                    </span>
                    <span class="text-3xl leading-tight font-bold text-game-yellow sm:text-5xl">
                      {ULTIMATES[c().id].emoji} {ULTIMATES[c().id].name}!
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Show>
        <Show when={myVote()}>
          {(v) => (
            <div class="absolute inset-0 z-10 grid content-center gap-3 bg-game-ink/70 p-3">
              <div class="text-center text-2xl font-bold text-game-yellow">
                {v().title}
              </div>
              <Show when={voted() !== undefined}>
                <div class="text-center text-lg font-bold text-game-cream">
                  ✅ Picked! Waiting for{" "}
                  {stillChoosing().length > 0
                    ? stillChoosing().join(", ")
                    : "the others"}
                  {secondsLeft() !== null && (secondsLeft() ?? 0) > 0
                    ? ` · ${secondsLeft()}s`
                    : ""}
                </div>
              </Show>
              <div
                class={cn(
                  "grid gap-2",
                  v().options.length === 3
                    ? "sm:grid-cols-3"
                    : v().options.length === 4
                      ? "grid-cols-2 sm:grid-cols-4"
                      : "grid-cols-2",
                )}
              >
                <For each={v().options}>
                  {(o) => (
                    <div
                      class={cn(
                        "grid justify-items-center gap-1 rounded-xl border-4 bg-game-navy p-2 text-center text-game-cream",
                        voted() === o.id
                          ? "border-game-yellow"
                          : fits(o.word)
                            ? "border-game-cream/60"
                            : "border-game-cream/20 opacity-50",
                      )}
                    >
                      <Show
                        when={o.monster}
                        fallback={<span class="text-4xl">{o.emoji}</span>}
                      >
                        {(k) => (
                          <img
                            src={MONSTER_ART[k()]}
                            alt=""
                            class="h-16 w-auto [image-rendering:pixelated]"
                          />
                        )}
                      </Show>
                      <span class="text-sm leading-tight text-game-grey">
                        {o.label}
                      </span>
                      <ChoiceWord word={o.word} typed={typed()} />
                      <span class="text-xs leading-tight text-game-grey">
                        {o.detail}
                      </span>
                      <Show when={v().shared && voteCount(o.id) > 0}>
                        <span class="text-sm text-game-yellow">
                          {"🗳️".repeat(voteCount(o.id))}
                        </span>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </Show>
        <Show when={banner()}>
          {(b) => (
            <div class="pointer-events-none absolute inset-0 grid place-items-center">
              <span class="animate-game-pop rounded-2xl border-4 border-game-cream bg-game-navy px-6 py-3 text-4xl font-bold text-game-yellow">
                {b()}
              </span>
            </div>
          )}
        </Show>
        <Show when={props.now < props.startAt}>
          <div class="pointer-events-none absolute inset-0 grid place-items-center bg-game-ink/40">
            <span class="animate-game-pop text-8xl font-bold text-game-yellow">
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
              (myHero() !== null ||
                myGuard() !== null ||
                (myVote() !== null && voted() === undefined))
            }
          >
            <div class="absolute inset-x-0 top-0 h-1.5 overflow-hidden rounded-t-md bg-game-ink">
              <div
                class={cn(
                  "h-full",
                  (secondsLeft() ?? 99) <= 3 ? "bg-game-red" : "bg-game-yellow",
                )}
                style={{
                  width: `${timerShare(myGuard()?.ms ?? (myVote() !== null ? VOTE_MS : HERO_TURN_MS)) * 100}%`,
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
                    <Show
                      when={myVote() !== null && voted() === undefined}
                      fallback={
                        <div class="text-lg leading-snug">{message()}</div>
                      }
                    >
                      <div class="text-lg leading-snug font-bold text-game-yellow">
                        ⌨️ Type your choice:{" "}
                        {myVote()
                          ?.options.map((o) => o.word)
                          .join(" · ")}
                      </div>
                    </Show>
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
                  <Show when={myHero()?.away === true}>
                    <div class="mb-2 rounded-lg bg-game-yellow px-3 py-1 text-sm font-bold text-game-ink">
                      👋 A helper played while you were away. Type a move now to
                      jump back in!
                    </div>
                  </Show>
                  <div class="mb-2 text-sm text-game-grey">
                    Your turn, {CLASS_INFO[myClass()].name}! Type a move:
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <For each={menu()}>
                      {(o) => (
                        <div
                          class={cn(
                            "flex min-h-12 items-center gap-2 rounded-lg bg-game-ink px-3 py-2 text-left text-lg font-bold text-game-cream",
                            (o.off === true || !fits(o.word)) && "opacity-40",
                          )}
                        >
                          <span>{o.emoji}</span>
                          <ChoiceWord word={o.word} typed={typed()} />
                          <span class="ml-auto text-sm font-normal text-game-grey">
                            {o.label}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={step() === "target"}>
                  <div class="mb-2 flex items-center justify-between text-sm text-game-grey">
                    <span>Who? Type a name (or &ldquo;back&rdquo;):</span>
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
                      {(t) => (
                        <div
                          class={cn(
                            "flex min-h-12 items-center gap-2 rounded-lg bg-game-ink px-3 py-2 text-left text-lg font-bold text-game-cream",
                            !fits(t.word) && "opacity-40",
                          )}
                        >
                          <ChoiceWord word={t.word} typed={typed()} />
                          <span class="flex-1 truncate text-sm font-normal text-game-grey">
                            {t.label}
                          </span>
                          <span class="text-sm font-normal">{t.detail}</span>
                        </div>
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
                <div
                  class={cn(
                    "text-lg font-bold",
                    g().chest ? "text-game-yellow" : "text-game-red",
                  )}
                >
                  {g().title}
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
              const max = (): number =>
                heroMax()[h.slot] ?? CLASS_INFO[h.cls].maxHp;
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
                    <Show when={(live()?.streak ?? 0) >= 2}>
                      <span title="Clean typing streak: extra damage">
                        🔥{live()?.streak}
                      </span>
                    </Show>
                    <Show when={live()?.blessed === true}>
                      <span title="Fairy blessing: next move is a critical">
                        ✨
                      </span>
                    </Show>
                    <Show
                      when={
                        live()?.ultimate !== undefined &&
                        live()?.ultimateCooldown === 0
                      }
                    >
                      <span title="Super move ready">
                        {ULTIMATES[live()?.ultimate ?? "wall"].emoji}
                      </span>
                    </Show>
                    <Show when={live()?.defending === true}>
                      <span title="Defending">🛡️</span>
                    </Show>
                    <Show when={(live()?.poison ?? 0) > 0}>
                      <span title="Poisoned">🤢</span>
                    </Show>
                    <Show when={(live()?.sleep ?? 0) > 0}>
                      <span title="Can't move">
                        {live()?.sleepWhy === "frozen" ? "🧊" : "💤"}
                      </span>
                    </Show>
                    <Show when={live()?.protectedBy !== undefined}>
                      <span title="Protected">💠</span>
                    </Show>
                    <span class="tabular-nums">
                      {hp() <= 0 ? "💤" : `${hp()}/${max()}`}
                    </span>
                  </div>
                  <div class="h-1.5 overflow-hidden rounded-full bg-game-ink">
                    <div
                      class={cn(
                        "h-full rounded-full transition-[width] duration-300",
                        hp() / max() > 0.5
                          ? "bg-game-green"
                          : hp() / max() > 0.25
                            ? "bg-game-yellow"
                            : "bg-game-red",
                      )}
                      style={{ width: `${(hp() / max()) * 100}%` }}
                    ></div>
                  </div>
                </div>
              );
            }}
          </For>
          <div class="grid gap-0.5 border-t border-game-ink pt-1">
            <div class="flex items-center justify-between text-xs font-bold text-game-yellow">
              <span>🌟 Team Spirit</span>
              <span>
                {Math.min(props.state.spirit, SPIRIT_MAX)}/{SPIRIT_MAX}
              </span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-game-ink">
              <div
                class={cn(
                  "h-full rounded-full bg-linear-to-r from-game-orange to-game-yellow transition-[width] duration-500",
                  props.state.spirit >= SPIRIT_MAX - 2 && "animate-game-pulse",
                )}
                style={{
                  width: `${Math.min(1, props.state.spirit / SPIRIT_MAX) * 100}%`,
                }}
              ></div>
            </div>
          </div>
          <div class="flex justify-between text-sm text-game-grey">
            <span>🧪 {props.state.potions} potions</span>
            <span>💰 {props.state.gold} gold</span>
          </div>
        </div>
      </div>

      {/* always mounted so the iPad keyboard stays up */}
      <div class="flex justify-center bg-game-ink px-3 pb-3">
        <MiniTypingInput
          value={typed()}
          onInput={onInput}
          wrong={wrong()}
          waiting={
            myHero() === null &&
            myGuard() === null &&
            (myVote() === null || voted() !== undefined)
          }
          placeholder={
            myGuard()?.challenge === true
              ? "type it fast!"
              : myGuard() !== null
                ? "type the guard word!"
                : myVote() !== null && voted() === undefined
                  ? "type your choice"
                  : step() === "type"
                    ? "type the words"
                    : myHero() !== null
                      ? "type a move or name"
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
            "pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 animate-game-float-up text-2xl font-bold whitespace-nowrap drop-shadow",
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
        <span class="pointer-events-none absolute top-1/2 left-1/2 animate-quest-burst text-5xl drop-shadow">
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
          {(p) => (
            <span class={p.class} style={p.style}>
              {p.text}
            </span>
          )}
        </For>
      )}
    </For>
  );
}

function WeatherLayer(props: { weather: Weather }): JSXElement {
  const drops = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <Show when={props.weather === "rain"}>
        <For each={drops}>
          {(i) => (
            <span
              class="absolute -top-8 h-6 w-0.5 rotate-12 animate-quest-rain bg-game-sky/60"
              style={{
                left: `${(i * 37) % 100}%`,
                "animation-delay": `${((i * 13) % 10) / 10}s`,
              }}
            ></span>
          )}
        </For>
      </Show>
      <Show when={props.weather === "sun"}>
        <span class="absolute -top-16 -right-16 h-48 w-48 animate-game-pulse rounded-full bg-radial from-game-yellow/50 to-transparent"></span>
      </Show>
      <Show when={props.weather === "wind"}>
        <For each={drops.slice(0, 10)}>
          {(i) => (
            <span
              class="absolute -left-24 h-0.5 w-20 animate-quest-wind rounded-full bg-game-cream/40"
              style={{
                top: `${((i * 29) % 90) + 5}%`,
                "animation-delay": `${((i * 17) % 12) / 10}s`,
              }}
            ></span>
          )}
        </For>
      </Show>
    </div>
  );
}

/** A choice word with the typed part coloured in. */
function ChoiceWord(props: { word: string; typed: string }): JSXElement {
  const done = (): number => {
    const t = normalize(props.typed);
    return props.word.startsWith(t) ? t.length : 0;
  };
  return (
    <span class="font-mono text-lg font-bold tracking-wide">
      <span class="text-game-green">{props.word.slice(0, done())}</span>
      <span>{props.word.slice(done())}</span>
    </span>
  );
}
