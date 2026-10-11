import { For, JSXElement, Show } from "solid-js";

import { useBuyGuard } from "../../../hooks/useBuyGuard";
import {
  saveSetup,
  SETUP_SLOTS,
  surpriseLook,
  wearSetup,
} from "../../../look/look-setups";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../states/notifications";
import { Fa } from "../../common/Fa";
import { keyboardStyle } from "../test/guided-keyboard-prefs";

/** Surprise + 3 saved keyboard/effects setups; one API call per tap. */
export function LookSetupsBar(props: {
  savedSetups: Partial<Record<string, Record<string, string>>> | undefined;
}): JSXElement {
  const { pendingId, guardedBuy } = useBuyGuard();

  const run = async (
    action: () => Promise<void>,
    done: string,
    failed: string,
  ): Promise<void> => {
    try {
      await action();
      showSuccessNotification(done);
    } catch (e) {
      console.error(failed, e);
      showErrorNotification(failed);
    }
  };

  return (
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="cursor-pointer rounded bg-bg px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-main hover:text-bg disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pendingId() !== null}
        onClick={() =>
          void guardedBuy("surprise", async () =>
            run(surpriseLook, "Surprise look on!", "Couldn't pick a surprise"),
          )
        }
      >
        <Fa
          icon={pendingId() === "surprise" ? "fa-circle-notch" : "fa-random"}
          spin={pendingId() === "surprise"}
          class="mr-1.5 text-main"
        />
        surprise keyboard
      </button>
      <For each={SETUP_SLOTS}>
        {(slot) => (
          <div class="flex items-center gap-1 rounded bg-bg p-1 pr-2">
            <Show
              when={props.savedSetups?.[slot] !== undefined}
              fallback={
                <span class="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-sub text-em-xs text-sub">
                  {slot}
                </span>
              }
            >
              <button
                type="button"
                class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-main text-em-xs font-bold text-bg disabled:cursor-not-allowed disabled:opacity-50"
                title={`Use setup ${slot}`}
                aria-label={`Use setup ${slot}`}
                disabled={pendingId() !== null}
                onClick={() =>
                  void guardedBuy(`wear-${slot}`, async () =>
                    run(
                      async () => wearSetup(slot),
                      `Setup ${slot} on!`,
                      "Couldn't use that setup",
                    ),
                  )
                }
              >
                <Show
                  when={pendingId() !== `wear-${slot}`}
                  fallback={<Fa icon="fa-circle-notch" spin size={0.7} />}
                >
                  {slot}
                </Show>
              </button>
            </Show>
            <button
              type="button"
              class="cursor-pointer text-em-xs text-sub hover:text-text disabled:cursor-not-allowed"
              title={`Save my keyboard and effects as setup ${slot}`}
              disabled={pendingId() !== null}
              onClick={() => {
                const style = keyboardStyle();
                void guardedBuy(`save-${slot}`, async () =>
                  run(
                    async () => saveSetup(slot, style),
                    `Saved as setup ${slot}`,
                    "Couldn't save that",
                  ),
                );
              }}
            >
              save
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
