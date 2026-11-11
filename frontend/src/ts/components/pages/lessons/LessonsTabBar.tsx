import { For, JSXElement, Show } from "solid-js";

import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";
import { LESSONS_TABS, LessonsTab } from "./lessons-tabs";

/** Five big picture buttons - one area of the page at a time. */
export function LessonsTabBar(props: {
  tab: LessonsTab;
  onSelect: (tab: LessonsTab) => void;
  /** small badge on a tab: a count, ✓ or 🎁 */
  badges: Partial<Record<LessonsTab, string>>;
}): JSXElement {
  const select = (tab: LessonsTab): void => {
    props.onSelect(tab);
    document.getElementById(`lessons-tab-${tab}`)?.focus();
  };
  return (
    <nav
      role="tablist"
      aria-label="Lessons page"
      class="grid grid-cols-5 gap-1.5 font-kid sm:gap-3"
    >
      <For each={LESSONS_TABS}>
        {(t, i) => (
          <button
            id={`lessons-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={props.tab === t.id}
            aria-controls="lessons-tab-panel"
            tabIndex={props.tab === t.id ? 0 : -1}
            class={cn(
              "press-3d relative flex min-h-18 cursor-pointer flex-col items-center justify-center gap-1 rounded-double px-1 py-2 text-sm font-bold sm:min-h-20 sm:flex-row sm:gap-2.5 sm:text-lg",
              props.tab === t.id
                ? "bg-main text-bg [--press-color:color-mix(in_srgb,var(--main-color)_60%,black)]"
                : "bg-sub-alt text-text hover:bg-text hover:text-bg",
            )}
            onClick={() => props.onSelect(t.id)}
            onKeyDown={(e) => {
              const n = LESSONS_TABS.length;
              const idx =
                e.key === "ArrowRight"
                  ? (i() + 1) % n
                  : e.key === "ArrowLeft"
                    ? (i() + n - 1) % n
                    : undefined;
              const next = idx === undefined ? undefined : LESSONS_TABS[idx];
              if (next === undefined) return;
              e.preventDefault();
              select(next.id);
            }}
          >
            <Fa icon={t.icon} size={1.5} />
            <span class="leading-tight">{t.label}</span>
            <Show when={props.badges[t.id]}>
              {(badge) => (
                <span class="absolute -top-1.5 -right-1 grid min-w-6 place-items-center rounded-full bg-error px-1.5 py-0.5 text-xs font-bold text-bg">
                  {badge()}
                </span>
              )}
            </Show>
          </button>
        )}
      </For>
    </nav>
  );
}
