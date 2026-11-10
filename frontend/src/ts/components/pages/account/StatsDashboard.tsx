import { useQuery } from "@tanstack/solid-query";
import { doc, getDoc } from "firebase/firestore";
import { createMemo, For, JSXElement, Show } from "solid-js";

import { getEarnedAchievements } from "../../../achievements/achievements";
import { achievements } from "../../../achievements/achievements-data";
import { nextLevel, stillNeeds } from "../../../classroom/certificate-levels";
import { goalForClass } from "../../../constants/grade-goals";
import { getAuthenticatedUser, getDb } from "../../../firebase";
import { games } from "../../../games/games-data";
import { getAllProgress } from "../../../lessons/lesson-progress";
import { lessonOrder } from "../../../lessons/lessons-data";
import { getActivePage, isAuthenticated } from "../../../states/core";
import { getSnapshot } from "../../../states/snapshot";
import { cn } from "../../../utils/cn";
import { getXpDetails } from "../../../utils/levels";
import { Bar } from "../../common/Bar";
import {
  lastSevenDays,
  speedSeries,
  StatValues,
  upNext,
  WeekDay,
} from "./stats-helpers";

type Extras = {
  coins: number;
  raceBestWpm: number;
  raceTotalRaces: number;
  raceBestBlitz: number;
  raceBestTug: number;
  gameScores: Record<string, number>;
};

const GAME_NAMES: Record<string, string> = {
  ...Object.fromEntries(games.map((g) => [g.id, g.name])),
  "maipaso-romaji": "Romaji 60s",
};

async function loadExtras(): Promise<Extras> {
  const uid = getAuthenticatedUser()?.uid;
  const empty: Extras = {
    coins: 0,
    raceBestWpm: 0,
    raceTotalRaces: 0,
    raceBestBlitz: 0,
    raceBestTug: 0,
    gameScores: {},
  };
  if (uid === undefined) return empty;
  const snap = await getDoc(doc(getDb(), "users", uid));
  const d = (snap.data() ?? {}) as Partial<Extras>;
  return {
    coins: d.coins ?? 0,
    raceBestWpm: d.raceBestWpm ?? 0,
    raceTotalRaces: d.raceTotalRaces ?? 0,
    raceBestBlitz: d.raceBestBlitz ?? 0,
    raceBestTug: d.raceBestTug ?? 0,
    gameScores: d.gameScores ?? {},
  };
}

function bestEnglish(time: string): { wpm: number; acc: number } {
  const list = getSnapshot()?.personalBests?.time?.[time] ?? [];
  let best = { wpm: 0, acc: 0 };
  for (const pb of list) {
    if (pb.language === "english" && pb.wpm > best.wpm) {
      best = { wpm: pb.wpm, acc: pb.acc };
    }
  }
  return best;
}

function Tile(props: {
  value: string;
  label: string;
  emoji: string;
  highlight?: boolean;
}): JSXElement {
  return (
    <div
      class={cn(
        "grid justify-items-center gap-0.5 rounded-xl bg-bg p-3 text-center",
        props.highlight === true && "ring-2 ring-main",
      )}
    >
      <span class="text-xl" aria-hidden="true">
        {props.emoji}
      </span>
      <span class="text-2xl leading-tight font-bold text-text">
        {props.value}
      </span>
      <span class="text-xs text-sub">{props.label}</span>
    </div>
  );
}

function GoalRow(props: {
  emoji: string;
  title: string;
  detail: string;
  percent: number;
}): JSXElement {
  return (
    <div class="grid gap-1.5 rounded-xl bg-bg p-3">
      <div class="flex items-center gap-2">
        <span class="text-lg" aria-hidden="true">
          {props.emoji}
        </span>
        <span class="font-semibold text-text">{props.title}</span>
      </div>
      <Bar percent={props.percent} fill="main" bg="sub-alt" />
      <span class="text-sm text-sub">{props.detail}</span>
    </div>
  );
}

function SpeedChart(props: { series: number[]; goal?: number }): JSXElement {
  const W = 480;
  const H = 150;
  const pad = 18;
  // scale to the student's own range (and the goal), so changes are visible
  const max = (): number => Math.max(10, ...props.series, props.goal ?? 0) + 5;
  const min = (): number =>
    Math.max(0, Math.min(...props.series, props.goal ?? Infinity) - 10);
  const x = (i: number): number =>
    props.series.length <= 1
      ? W / 2
      : pad + (i * (W - pad * 2)) / (props.series.length - 1);
  const y = (v: number): number =>
    H - pad - ((v - min()) / Math.max(1, max() - min())) * (H - pad * 2);
  const points = (): string =>
    props.series.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const best = (): number => Math.max(0, ...props.series);
  return (
    <div class="grid gap-2 rounded-xl bg-bg p-3">
      <div class="flex items-baseline justify-between gap-2">
        <span class="font-semibold text-text">📈 My speed</span>
        <span class="text-xs text-sub">
          last {props.series.length} tests · best {best()} wpm
        </span>
      </div>
      <Show
        when={props.series.length >= 2}
        fallback={
          <div class="py-8 text-center text-sm text-sub">
            Do a few typing tests and your speed line shows up here!
          </div>
        }
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          class="h-auto max-h-44 w-full"
          role="img"
        >
          <title>Speed over your last tests</title>
          <Show when={props.goal}>
            {(g) => (
              <>
                <line
                  x1={pad}
                  x2={W - pad}
                  y1={y(g())}
                  y2={y(g())}
                  class="text-sub"
                  stroke="currentColor"
                  stroke-width="1.5"
                  style={{ "stroke-dasharray": "5 4" }}
                ></line>
                <text
                  x={W - pad}
                  y={y(g()) - 4}
                  text-anchor="end"
                  font-size="10"
                  class="text-sub"
                  style={{ fill: "currentColor", opacity: 1 }}
                >
                  goal {g()}
                </text>
              </>
            )}
          </Show>
          <polyline
            points={points()}
            fill="none"
            class="text-main"
            stroke="currentColor"
            stroke-width="3"
            stroke-linejoin="round"
            stroke-linecap="round"
          ></polyline>
          <For each={props.series}>
            {(v, i) => (
              <circle
                cx={x(i())}
                cy={y(v)}
                r={v === best() ? 4.5 : 2.5}
                class={v === best() ? "text-text" : "text-main"}
                fill="currentColor"
              ></circle>
            )}
          </For>
        </svg>
      </Show>
    </div>
  );
}

function WeekChart(props: { days: WeekDay[] }): JSXElement {
  const max = (): number =>
    Math.max(10, ...props.days.map((d) => d.typingMin + d.gameMin));
  const typing = (): number => props.days.reduce((n, d) => n + d.typingMin, 0);
  const gaming = (): number => props.days.reduce((n, d) => n + d.gameMin, 0);
  return (
    <div class="grid gap-2 rounded-xl bg-bg p-3">
      <div class="flex items-baseline justify-between gap-2">
        <span class="font-semibold text-text">📅 My week</span>
        <span class="text-xs text-sub">
          ⌨️ {typing()} min typing · 🎮 {gaming()} min games
        </span>
      </div>
      <div class="grid h-32 grid-cols-7 items-end gap-2">
        <For each={props.days}>
          {(d) => (
            <div class="flex h-full flex-col items-center justify-end gap-1">
              <div
                class="flex w-full max-w-8 flex-col justify-end overflow-hidden rounded-md bg-sub-alt"
                style={{ height: "100%" }}
                title={`${d.label}: ${d.typingMin} min typing, ${d.gameMin} min games`}
              >
                <div
                  class="w-full bg-game-yellow"
                  style={{ height: `${(d.gameMin / max()) * 100}%` }}
                ></div>
                <div
                  class="w-full bg-main"
                  style={{ height: `${(d.typingMin / max()) * 100}%` }}
                ></div>
              </div>
              <span class="text-xs text-sub">{d.label}</span>
            </div>
          )}
        </For>
      </div>
      <div class="flex gap-4 text-xs text-sub">
        <span class="flex items-center gap-1">
          <span class="h-2.5 w-2.5 rounded-sm bg-main"></span> typing
        </span>
        <span class="flex items-center gap-1">
          <span class="h-2.5 w-2.5 rounded-sm bg-game-yellow"></span> games
        </span>
      </div>
    </div>
  );
}

/**
 * The top of User stats for students: key numbers, what to aim for next,
 * a speed line, this week's typing vs games, and races & games. Reads the
 * snapshot, the (shared, cached) lesson progress and one user doc.
 */
export function StatsDashboard(props: {
  results: { wpm: number; acc: number; timestamp: number }[];
}): JSXElement {
  const open = (): boolean =>
    getActivePage() === "account" && isAuthenticated();
  const progressQuery = useQuery(() => ({
    queryKey: ["lessonProgress"],
    queryFn: getAllProgress,
    enabled: open(),
    staleTime: 5 * 60 * 1000,
  }));
  const extrasQuery = useQuery(() => ({
    queryKey: ["myStatsExtras"],
    queryFn: loadExtras,
    enabled: open(),
    staleTime: 5 * 60 * 1000,
  }));
  const earnedQuery = useQuery(() => ({
    queryKey: ["achievements"],
    queryFn: getEarnedAchievements,
    enabled: open(),
  }));

  const snap = (): ReturnType<typeof getSnapshot> => getSnapshot();
  const best30 = createMemo(() => bestEnglish("30"));
  const lessons = createMemo(() => {
    const map = progressQuery.data;
    let completed = 0;
    let stars = 0;
    let threeStar = 0;
    for (const id of lessonOrder) {
      const p = map?.get(id);
      if (p === undefined) continue;
      if (p.completed) completed++;
      stars += p.stars ?? 0;
      if ((p.stars ?? 0) >= 3) threeStar++;
    }
    return { completed, stars, threeStar, total: lessonOrder.length };
  });
  const values = createMemo(
    (): StatValues => ({
      bestWpm30: best30().wpm,
      bestWpm60: bestEnglish("60").wpm,
      completedTests: snap()?.typingStats.completedTests ?? 0,
      timeTyping: snap()?.typingStats.timeTyping ?? 0,
      streak: snap()?.streak ?? 0,
      level: getXpDetails(snap()?.xp ?? 0).level,
      lessonsCompleted: lessons().completed,
      lessonStars: lessons().stars,
      threeStarLessons: lessons().threeStar,
      raceWins: snap()?.raceWins ?? 0,
    }),
  );
  const goal = createMemo(() => goalForClass(snap()?.classId));
  const nextCert = createMemo(() =>
    nextLevel({
      lessonsCompleted: lessons().completed,
      lessonStars: lessons().stars,
      bestWpm: best30().wpm,
    }),
  );
  const nextAchievements = createMemo(() =>
    upNext(
      achievements,
      (id) => earnedQuery.data?.has(id) === true,
      values(),
      2,
    ),
  );
  const topGames = createMemo(() =>
    Object.entries(extrasQuery.data?.gameScores ?? {})
      .filter(([, s]) => s > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4),
  );

  return (
    <div class="grid gap-4 rounded-xl bg-sub-alt p-4 font-kid">
      <div class="text-xl font-bold text-text">My progress</div>

      {/* key numbers */}
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile
          emoji="⚡"
          value={`${Math.round(best30().wpm)}`}
          label="best speed (wpm)"
          highlight
        />
        <Tile
          emoji="🎯"
          value={`${Math.round(best30().acc)}%`}
          label="accuracy"
        />
        <Tile
          emoji="🔥"
          value={`${snap()?.streak ?? 0}`}
          label={`day streak (best ${snap()?.maxStreak ?? 0})`}
        />
        <Tile emoji="🌟" value={`${values().level}`} label="level" />
        <Tile
          emoji="🪙"
          value={`${extrasQuery.data?.coins ?? 0}`}
          label="coins"
        />
        <Tile
          emoji="⭐"
          value={`${lessons().stars}`}
          label={`stars · ${lessons().completed}/${lessons().total} lessons`}
        />
      </div>

      {/* next goals */}
      <div class="grid gap-2">
        <div class="font-semibold text-text">🎯 Next goals</div>
        <div class="grid gap-2 md:grid-cols-2">
          <Show when={goal()}>
            {(g) => (
              <GoalRow
                emoji="🏫"
                title={`Grade goal: ${g().wpm} wpm`}
                percent={Math.min(100, (best30().wpm / g().wpm) * 100)}
                detail={
                  best30().wpm >= g().wpm
                    ? "You've reached your grade goal - amazing!"
                    : `${Math.ceil(g().wpm - best30().wpm)} wpm more to reach your grade goal!`
                }
              />
            )}
          </Show>
          <Show
            when={nextCert()}
            fallback={
              <GoalRow
                emoji="🏆"
                title="Every certificate earned!"
                percent={100}
                detail="You're a Typing Star - keep it up!"
              />
            }
          >
            {(level) => (
              <GoalRow
                emoji="📜"
                title={`Next certificate: ${level().name} (${level().title})`}
                percent={Math.min(
                  100,
                  (Math.min(1, lessons().completed / level().lessons) +
                    Math.min(1, lessons().stars / level().stars) +
                    Math.min(1, best30().wpm / level().wpm)) *
                    (100 / 3),
                )}
                detail={`Still to go: ${stillNeeds(level(), {
                  lessonsCompleted: lessons().completed,
                  lessonStars: lessons().stars,
                  bestWpm: best30().wpm,
                })}`}
              />
            )}
          </Show>
          <For each={nextAchievements()}>
            {(n) => (
              <GoalRow
                emoji="🏅"
                title={`Next badge: ${n.achievement.name}`}
                percent={Math.min(100, (n.current / n.target) * 100)}
                detail={`${n.achievement.description} - ${Math.max(0, n.target - n.current)} ${n.unit} to go`}
              />
            )}
          </For>
        </div>
      </div>

      {/* charts */}
      <div class="grid gap-2 lg:grid-cols-2">
        <SpeedChart series={speedSeries(props.results)} goal={goal()?.wpm} />
        <WeekChart days={lastSevenDays(snap()?.activityDays)} />
      </div>

      {/* races & games */}
      <div class="grid gap-2">
        <div class="font-semibold text-text">🏁 Races & games</div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile
            emoji="🏆"
            value={`${snap()?.raceWins ?? 0}`}
            label="race wins"
          />
          <Tile
            emoji="🏎️"
            value={`${Math.round(extrasQuery.data?.raceBestWpm ?? 0)}`}
            label="best race wpm"
          />
          <Tile
            emoji="🔁"
            value={`${extrasQuery.data?.raceTotalRaces ?? 0}`}
            label="races played"
          />
          <Tile
            emoji="👑"
            value={`${snap()?.championWins ?? 0}`}
            label="Class Champion"
          />
        </div>
        <Show
          when={topGames().length > 0}
          fallback={
            <div class="text-sm text-sub">
              Play some games to see your high scores here!
            </div>
          }
        >
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <For each={topGames()}>
              {([id, score]) => (
                <div class="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2">
                  <span class="truncate text-sm text-text">
                    🎮 {GAME_NAMES[id] ?? id}
                  </span>
                  <span class="font-bold text-main">{score}</span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
