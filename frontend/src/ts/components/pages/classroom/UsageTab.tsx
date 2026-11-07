import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import {
  estimateUsage,
  getUsageInput,
  UsageLevel,
  UsageLine,
} from "../../../classroom/usage";
import { cn } from "../../../utils/cn";

const CONSOLE_URL =
  "https://console.firebase.google.com/project/gfa-typing/usage";

const LEVEL_TEXT: Record<UsageLevel, string> = {
  ok: "✅ fine",
  watch: "⚠️ keep an eye on it",
  high: "🚨 close to the limit",
};

function formatValue(line: UsageLine): string {
  if (line.label.includes("bytes")) {
    const mb = (b: number): string => `${Math.round(b / 1024 / 1024)} MB`;
    return `~${mb(line.value)} of ${mb(line.limit)}`;
  }
  return `~${line.value.toLocaleString()} of ${line.limit.toLocaleString()}`;
}

/**
 * Teacher view: a rough check that the app is still inside Firebase's free
 * (Spark) plan. One read per student + small room lists, cached 5 minutes.
 */
export function UsageTab(): JSXElement {
  const usageQuery = useQuery(() => ({
    queryKey: ["classroom", "usage"],
    queryFn: async () => estimateUsage(await getUsageInput()),
    staleTime: 5 * 60 * 1000,
  }));

  return (
    <section class="grid gap-4">
      <div>
        <h3 class="text-xl text-text">Free plan check</h3>
        <p class="mt-1 text-sm text-sub">
          A rough estimate of today&apos;s Firebase use from what students did
          today, compared with the free (Spark) plan limits. Daily limits reset
          around 4-5pm Japan time. For exact numbers, open the{" "}
          <a
            class="text-main underline"
            href={CONSOLE_URL}
            target="_blank"
            rel="noreferrer"
          >
            Firebase console usage page
          </a>
          .
        </p>
      </div>

      <Show when={usageQuery.isPending}>
        <div class="text-sub">Counting…</div>
      </Show>
      <Show when={usageQuery.isError}>
        <div class="rounded bg-bg p-4 text-error">
          Could not load usage. Try refresh.
        </div>
      </Show>

      <Show when={usageQuery.data}>
        {(u) => (
          <>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <For
                each={[
                  ["students", u().students],
                  ["active today", u().activeToday],
                  ["lessons passed today", u().lessonsToday],
                  ["games played today", u().gamesToday],
                  ["typing minutes today", u().typingMinutesToday],
                  ["live game rooms", u().liveRooms],
                ]}
              >
                {([label, value]) => (
                  <div class="rounded bg-bg p-3">
                    <div class="text-2xl text-text">{value}</div>
                    <div class="text-xs text-sub">{label}</div>
                  </div>
                )}
              </For>
            </div>

            <div class="grid gap-2">
              <For each={u().lines}>
                {(line) => (
                  <div class="grid gap-1 rounded bg-bg p-3">
                    <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span class="text-text">
                        {line.label.replace(" (bytes)", "")}
                      </span>
                      <span class="text-sub">
                        {formatValue(line)} · {LEVEL_TEXT[line.level]}
                      </span>
                    </div>
                    <div class="h-2.5 overflow-hidden rounded-full bg-sub-alt">
                      <div
                        class={cn(
                          "h-full rounded-full",
                          line.level === "ok"
                            ? "bg-main"
                            : line.level === "watch"
                              ? "bg-game-yellow"
                              : "bg-error",
                        )}
                        style={{
                          width: `${Math.min(100, Math.max(1, (line.value / line.limit) * 100))}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </For>
            </div>

            <p class="text-sm text-sub">
              Tips if something turns yellow or red: avoid refreshing the
              Student progress tab many times (it reads every lesson for every
              student), and keep online game rooms to a few classes at a time
              (the free plan allows 100 players connected at once).
            </p>
          </>
        )}
      </Show>
    </section>
  );
}
