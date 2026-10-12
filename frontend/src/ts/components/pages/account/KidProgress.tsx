import { createMemo, For, JSXElement, Show } from "solid-js";

import { goalForClass } from "../../../constants/grade-goals";
import { getSnapshot } from "../../../states/snapshot";
import { getXpDetails } from "../../../utils/levels";
import { Bar } from "../../common/Bar";
import { Fa } from "../../common/Fa";

function bestSpeed(): { wpm: number; acc: number } {
  const list = getSnapshot()?.personalBests?.time?.["30"] ?? [];
  let wpm = 0;
  let acc = 0;
  for (const pb of list) {
    if (pb.language === "english" && pb.wpm > wpm) {
      wpm = pb.wpm;
      acc = pb.acc;
    }
  }
  return { wpm, acc };
}

export function KidProgress(props: {
  results: { wpm: number; acc: number; timestamp: number }[];
}): JSXElement {
  const snap = (): ReturnType<typeof getSnapshot> => getSnapshot();
  const level = (): number => getXpDetails(snap()?.xp ?? 0).level;
  const best = createMemo(() => bestSpeed());
  const goal = createMemo(() => goalForClass(snap()?.classId));
  const recent = createMemo(() => props.results.slice(0, 5));
  const wpmPercent = (): number => {
    const g = goal();
    if (g === undefined || g.wpm <= 0) return 0;
    return Math.min(100, (best().wpm / g.wpm) * 100);
  };
  const accPercent = (): number => {
    const g = goal();
    if (g === undefined || g.acc <= 0) return 0;
    return Math.min(100, (best().acc / g.acc) * 100);
  };

  return (
    <div class="grid gap-4 rounded-xl bg-sub-alt p-4">
      <div class="text-lg font-bold text-text">My progress</div>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-lg bg-bg p-3">
          <div class="text-2xl font-bold text-main">
            {Math.round(best().wpm)}
          </div>
          <div class="text-xs text-sub">best speed</div>
        </div>
        <div class="rounded-lg bg-bg p-3">
          <div class="text-2xl font-bold text-text">
            <Fa icon="fa-fire" class="mr-1 text-main" />
            {snap()?.streak ?? 0}
          </div>
          <div class="text-xs text-sub">day streak</div>
        </div>
        <div class="rounded-lg bg-bg p-3">
          <div class="text-2xl font-bold text-text">{level()}</div>
          <div class="text-xs text-sub">level</div>
        </div>
      </div>
      <Show when={goal()} keyed>
        {(g) => (
          <div class="grid gap-2">
            <div class="text-sm text-sub">Grade goal ({snap()?.classId})</div>
            <div class="grid grid-cols-[5rem_1fr_6rem] items-center gap-2 text-sm">
              <span class="text-sub">speed</span>
              <Bar percent={wpmPercent()} fill="main" bg="bg" />
              <span class="text-text">
                {Math.round(best().wpm)} / {g.wpm}
              </span>
              <span class="text-sub">accuracy</span>
              <Bar percent={accPercent()} fill="main" bg="bg" />
              <span class="text-text">
                {Math.round(best().acc)} / {g.acc}%
              </span>
            </div>
          </div>
        )}
      </Show>
      <div class="grid gap-1">
        <div class="text-sm text-sub">Last tests</div>
        <Show
          when={recent().length > 0}
          fallback={
            <div class="text-sm text-sub">
              Finish a test and it will show up here.
            </div>
          }
        >
          <For each={recent()}>
            {(result) => (
              <div class="flex items-center justify-between gap-3 rounded bg-bg px-3 py-2 text-sm">
                <span class="text-sub">
                  {new Date(result.timestamp).toLocaleDateString()}
                </span>
                <span class="font-bold text-text">
                  {Math.round(result.wpm)} wpm
                </span>
                <span class="text-text">{Math.round(result.acc)}%</span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
