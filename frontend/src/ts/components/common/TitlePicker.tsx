import { For, JSXElement, Show } from "solid-js";

import { useBuyGuard } from "../../hooks/useBuyGuard";
import { showErrorNotification } from "../../states/notifications";
import { TITLES } from "../../titles/titles";
import { cn } from "../../utils/cn";
import { Fa } from "./Fa";

async function pick(
  onPick: (titleId: string | null) => Promise<void>,
  titleId: string | null,
): Promise<void> {
  try {
    await onPick(titleId);
  } catch (e) {
    console.error("Failed to set title:", e);
    showErrorNotification("Couldn't change your title");
  }
}

/** Earned titles show on leaderboards; locked ones say how to earn them. */
export function TitlePicker(props: {
  current: string | undefined;
  earned: Map<string, number> | undefined;
  onPick: (titleId: string | null) => Promise<void>;
}): JSXElement {
  const { pendingId, guardedBuy } = useBuyGuard();

  return (
    <div class="grid gap-1.5 rounded bg-sub-alt p-2">
      <span class="text-em-xs font-medium text-sub">
        <Fa icon="fa-id-badge" class="mr-1.5 text-main" />
        Title (shows on leaderboards)
      </span>
      <div class="flex flex-wrap gap-1.5">
        <For each={TITLES}>
          {(title) => {
            const earned = (): boolean =>
              props.earned?.has(title.achievement) === true;
            const active = (): boolean => props.current === title.id;
            return (
              <button
                type="button"
                class={cn(
                  "flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-em-xs transition-colors disabled:cursor-not-allowed",
                  active()
                    ? "bg-main text-bg"
                    : earned()
                      ? "bg-bg text-text hover:text-main"
                      : "bg-bg text-sub opacity-60",
                )}
                title={earned() ? title.label : `Locked: ${title.hint}`}
                aria-pressed={active()}
                disabled={!earned() || pendingId() !== null}
                onClick={() => {
                  const onPick = props.onPick;
                  const next = active() ? null : title.id;
                  void guardedBuy(title.id, async () => pick(onPick, next));
                }}
              >
                <Show
                  when={pendingId() !== title.id}
                  fallback={<Fa icon="fa-circle-notch" spin size={0.7} />}
                >
                  <Fa icon={earned() ? title.icon : "fa-lock"} size={0.7} />
                </Show>
                {title.label}
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
}
