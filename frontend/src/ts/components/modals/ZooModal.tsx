import { useQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createSignal,
  For,
  JSXElement,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";

import { isCurrentUserStaff } from "../../auth";
import { tokyoDate } from "../../classroom/activity";
import { getGameAccess, resolvePolicy } from "../../games/game-access";
import { ZOO_INFO, ZooSpecies } from "../../games/zoo/zoo-animals";
import {
  CARE_JOB_INFO,
  careWords,
  ZOO_CARE_COINS,
  ZOO_CARE_JOBS,
  ZooArea,
  ZooCareJob,
} from "../../games/zoo/zoo-areas";
import {
  GOLDEN_BOWL_STREAK,
  nextBonusDay,
  ZOO_DECOR,
  ZooDecorId,
} from "../../games/zoo/zoo-decor";
import {
  buyZooItem,
  claimZooCare,
  getZooState,
  setZooPosition,
  ZooState,
} from "../../games/zoo/zoo-state";
import { setZooVisit, zooVisit } from "../../games/zoo/zoo-visit";
import { ZooAction } from "../../games/zoo/ZooAnimal";
import { CareReward, ZooCarePanel } from "../../games/zoo/ZooCarePanel";
import { ZooAnimalLook } from "../../games/zoo/ZooMap";
import { ZooMap3D } from "../../games/zoo/ZooMap3D";
import { ZooShopPanel } from "../../games/zoo/ZooShopPanel";
import { useBuyGuard } from "../../hooks/useBuyGuard";
import { getAllProgress } from "../../lessons/lesson-progress";
import { lessonGroups } from "../../lessons/lessons-data";
import { queryClient } from "../../queries";
import { getUserId, isAuthenticated } from "../../states/core";
import { isModalOpen } from "../../states/modals";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../states/notifications";
import { getSnapshot } from "../../states/snapshot";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Fa } from "../common/Fa";

const CARE_ACTION: Record<ZooCareJob, ZooAction> = {
  feed: "eat",
  clean: "wash",
  vet: "heal",
};

const EMPTY: ZooState = {
  coins: 0,
  animals: ["rabbit"],
  decor: [],
  layout: {},
  careDates: {},
  streak: 0,
};

export function ZooModal(): JSXElement {
  const isOpen = (): boolean => isModalOpen("Zoo");
  const [tab, setTab] = createSignal<"zoo" | "shop">("zoo");
  const [editing, setEditing] = createSignal(false);
  const [job, setJob] = createSignal<ZooCareJob | null>(null);
  // care animations playing right now (species -> action)
  const [acting, setActing] = createSignal<
    Partial<Record<ZooSpecies, ZooAction>>
  >({});
  const timers: ReturnType<typeof setTimeout>[] = [];
  onCleanup(() => timers.forEach(clearTimeout));
  const { pendingId, guardedBuy } = useBuyGuard();

  /** a classmate's or student's zoo (view only), else your own */
  const viewUid = (): string | null => zooVisit()?.uid ?? getUserId();
  createEffect(() => {
    if (!isOpen()) setZooVisit(undefined);
  });
  const zooQuery = useQuery(() => ({
    queryKey: ["zooState", viewUid()],
    queryFn: async () => {
      const uid = viewUid();
      return uid === null ? EMPTY : getZooState(uid);
    },
    enabled: isOpen() && isAuthenticated(),
    // visits: one read, then cached
    staleTime: zooVisit() === undefined ? 60_000 : 5 * 60_000,
  }));
  // teacher's on/off switch (the shared, cached game settings doc)
  const accessQuery = useQuery(() => ({
    queryKey: ["gameAccess"],
    queryFn: getGameAccess,
    enabled: isOpen() && isAuthenticated() && !isCurrentUserStaff(),
    staleTime: 1000 * 60 * 5,
  }));
  const zooOff = (): boolean =>
    !isCurrentUserStaff() &&
    resolvePolicy(
      accessQuery.data,
      getSnapshot()?.classId ?? undefined,
      getUserId() ?? undefined,
    ).zooOff;
  const progressQuery = useQuery(() => ({
    queryKey: ["lessonProgress"],
    queryFn: getAllProgress,
    enabled: isOpen() && isAuthenticated(),
    staleTime: 5 * 60 * 1000,
  }));

  const zoo = (): ZooState => zooQuery.data ?? EMPTY;
  const today = (): string => tokyoDate();
  const doneToday = (j: ZooCareJob): boolean => zoo().careDates[j] === today();
  /** most recent care day ("today" when it's today) */
  const lastCare = (): string | undefined => {
    const days = Object.values(zoo().careDates).sort();
    const last = days[days.length - 1];
    return last === today() ? "today" : last;
  };
  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["zooState"] });
  };

  const areaOpen = (area: ZooArea): boolean => {
    if (area.requires === undefined) return true;
    const group = lessonGroups.find((g) => g.id === area.requires);
    const p = progressQuery.data;
    return (
      group !== undefined &&
      p !== undefined &&
      group.lessons.every((l) => p.get(l.id)?.completed === true)
    );
  };

  const act = (s: ZooSpecies, action: ZooAction, ms: number): void => {
    setActing((a) => ({ ...a, [s]: action }));
    timers.push(
      setTimeout(
        () =>
          setActing((a) =>
            Object.fromEntries(Object.entries(a).filter(([k]) => k !== s)),
          ),
        ms,
      ),
    );
  };

  const look = (s: ZooSpecies): ZooAnimalLook => {
    const action = acting()[s];
    if (action !== undefined) return { mood: "happy", action };
    const fed = doneToday("feed");
    return {
      mood: fed ? "happy" : "waiting",
      dirty: !doneToday("clean"),
      bubble: fed ? undefined : "fa-carrot",
    };
  };

  const claim = async (j: ZooCareJob): Promise<CareReward | null> => {
    zoo().animals.forEach((s, i) =>
      timers.push(setTimeout(() => act(s, "cheer", 1400), i * 120)),
    );
    try {
      const r = await claimZooCare(j);
      refresh();
      return r.claimed
        ? { coins: r.coins, bonus: r.bonus ?? 0, streak: r.streak ?? 0 }
        : null;
    } catch (error) {
      showErrorNotification("Couldn't add coins - check your connection", {
        error,
      });
      return null;
    }
  };

  const buy = (s: ZooSpecies): void => {
    void guardedBuy(s, async () => {
      const r = await buyZooItem("zoo", s);
      if (!r.ok) {
        showErrorNotification(r.reason ?? "Couldn't buy that");
        return;
      }
      showSuccessNotification(
        `The ${ZOO_INFO[s].name.toLowerCase()} moved into your zoo!`,
      );
      refresh();
    });
  };

  const buyDecor = (id: ZooDecorId): void => {
    void guardedBuy(id, async () => {
      const r = await buyZooItem("zooDecor", id);
      if (!r.ok) {
        showErrorNotification(r.reason ?? "Couldn't buy that");
        return;
      }
      const name = ZOO_DECOR.find((d) => d.id === id)?.name ?? "It";
      showSuccessNotification(`${name} added - tap Move to place it!`);
      refresh();
    });
  };

  const move = (
    id: ZooSpecies | ZooDecorId,
    pos: { xPct: number; yPct: number },
  ): void => {
    const uid = getUserId();
    if (uid === null) return;
    setZooPosition(uid, id, pos)
      .then(refresh)
      .catch((error: unknown) =>
        showErrorNotification("Couldn't move that pen", { error }),
      );
  };

  return (
    <AnimatedModal
      id="Zoo"
      title={(() => {
        const v = zooVisit();
        return v === undefined ? "My Zoo" : `${v.name}'s zoo`;
      })()}
      modalClass="max-w-5xl"
    >
      <Show
        when={isAuthenticated()}
        fallback={
          <p class="p-6 text-center font-kid text-lg text-text">
            Sign in to visit your zoo.
          </p>
        }
      >
        <Switch>
          <Match when={zooVisit()}>
            <div class="grid gap-3 font-kid">
              <div class="flex flex-wrap items-center gap-2 text-sm font-semibold text-sub">
                <span class="rounded-full bg-sub-alt px-3 py-1">
                  <Fa icon="fa-paw" class="mr-1.5 text-main" />
                  {zoo().animals.length}{" "}
                  {zoo().animals.length === 1 ? "animal" : "animals"}
                </span>
                <span class="rounded-full bg-sub-alt px-3 py-1">
                  <Fa icon="fa-fire" class="mr-1.5 text-main" />
                  {zoo().streak}-day care streak
                </span>
                <span class="rounded-full bg-sub-alt px-3 py-1">
                  <Fa icon="fa-calendar-check" class="mr-1.5 text-main" />
                  Last care: {lastCare() ?? "not yet"}
                </span>
              </div>
              <ZooMap3D
                active={isOpen()}
                animals={zoo().animals}
                decor={zoo().decor}
                goldenBowls={zoo().streak >= GOLDEN_BOWL_STREAK}
                layout={zoo().layout}
                look={look}
                editing={false}
              />
            </div>
          </Match>
          <Match when={zooOff()}>
            <p class="p-6 text-center font-kid text-lg text-text">
              <Fa icon="fa-paw" class="mr-2 text-main" />
              Your teacher has closed My Zoo for now. Your animals are safe!
            </p>
          </Match>
          <Match when={true}>
            <div class="grid gap-3 font-kid">
              {/* tabs + coins */}
              <div class="flex flex-wrap items-center gap-2">
                <For
                  each={
                    [
                      { id: "zoo", label: "My zoo", icon: "fa-paw" },
                      { id: "shop", label: "Zoo shop", icon: "fa-store" },
                    ] as const
                  }
                >
                  {(t) => (
                    <button
                      type="button"
                      class={cn(
                        "press-3d flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl text-base font-bold",
                        tab() === t.id
                          ? "bg-main text-bg"
                          : "bg-sub-alt text-text",
                      )}
                      aria-pressed={tab() === t.id}
                      onClick={() => {
                        setTab(t.id);
                        setEditing(false);
                      }}
                    >
                      <Fa icon={t.icon} />
                      {t.label}
                    </button>
                  )}
                </For>
                <span class="flex min-h-12 items-center gap-2 rounded-xl bg-sub-alt px-4 text-xl font-bold text-main">
                  <Fa icon="fa-coins" />
                  {zoo().coins}
                </span>
              </div>

              <Show
                when={tab() === "zoo"}
                fallback={
                  <ZooShopPanel
                    coins={zoo().coins}
                    owned={new Set(zoo().animals)}
                    areaOpen={areaOpen}
                    pendingId={pendingId()}
                    onBuy={buy}
                    decorOwned={new Set(zoo().decor)}
                    onBuyDecor={buyDecor}
                  />
                }
              >
                {/* daily care */}
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-semibold text-sub">
                    Daily care:
                  </span>
                  <For each={ZOO_CARE_JOBS}>
                    {(j) => (
                      <button
                        type="button"
                        class={cn(
                          "press-3d flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold",
                          job() === j
                            ? "bg-main text-bg"
                            : doneToday(j)
                              ? "bg-sub-alt text-sub"
                              : "bg-sub-alt text-text ring-2 ring-main",
                        )}
                        onClick={() => {
                          setEditing(false);
                          setJob(job() === j ? null : j);
                        }}
                      >
                        <Fa icon={CARE_JOB_INFO[j].icon} />
                        {CARE_JOB_INFO[j].title}
                        <Show
                          when={doneToday(j)}
                          fallback={
                            <span class="rounded-full bg-bg px-2 text-xs text-main">
                              +{ZOO_CARE_COINS}
                            </span>
                          }
                        >
                          <Fa icon="fa-check-circle" class="text-main" />
                        </Show>
                      </button>
                    )}
                  </For>
                  <span
                    class={cn(
                      "flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold",
                      zoo().streak > 0
                        ? "bg-game-orange text-game-cream"
                        : "bg-sub-alt text-sub",
                    )}
                    title={`Do all 3 jobs every day. Bonus coins on day ${nextBonusDay(zoo().streak)}!`}
                  >
                    <Fa icon="fa-fire" />
                    {zoo().streak > 0
                      ? `${zoo().streak}-day streak`
                      : "Start a streak!"}
                  </span>
                  <div class="flex-1"></div>
                  <button
                    type="button"
                    class={cn(
                      "press-3d flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold",
                      editing() ? "bg-main text-bg" : "bg-sub-alt text-text",
                    )}
                    aria-pressed={editing()}
                    onClick={() => {
                      setJob(null);
                      setEditing(!editing());
                    }}
                  >
                    <Fa icon="fa-arrows-alt" />
                    {editing() ? "Done moving" : "Move pens"}
                  </button>
                </div>

                <p class="-mt-1 text-xs text-sub">
                  Do all 3 jobs every day for a care streak: bonus coins on day
                  3, 5, 7 and 10, and golden food bowls from day{" "}
                  {GOLDEN_BOWL_STREAK}!
                </p>

                <Show when={job()} keyed>
                  {(j) => (
                    <ZooCarePanel
                      job={j}
                      words={careWords(j, zoo().animals, today())}
                      paidToday={doneToday(j)}
                      onWord={(i) => {
                        const list = zoo().animals;
                        const s = list[i % list.length];
                        if (s !== undefined) act(s, CARE_ACTION[j], 1500);
                      }}
                      onDone={claim}
                      onClose={() => setJob(null)}
                    />
                  )}
                </Show>

                <Show when={editing()}>
                  <p class="text-center text-sm text-sub">
                    Drag the pens and decorations to where you want them.
                  </p>
                </Show>

                <ZooMap3D
                  active={isOpen()}
                  animals={zoo().animals}
                  decor={zoo().decor}
                  goldenBowls={zoo().streak >= GOLDEN_BOWL_STREAK}
                  layout={zoo().layout}
                  look={look}
                  editing={editing()}
                  onMove={move}
                />

                <Show when={zoo().animals.length === 1}>
                  <p class="text-center text-sm text-sub">
                    Look after your rabbit every day, then visit the Zoo shop to
                    grow your zoo!
                  </p>
                </Show>
              </Show>
            </div>
          </Match>
        </Switch>
      </Show>
    </AnimatedModal>
  );
}
