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
    <div class="grid gap-1.5">
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="min-h-10 cursor-pointer rounded bg-bg px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-main hover:text-bg disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pendingId() !== null}
          onClick={() =>
            void guardedBuy("surprise", async () =>
              run(
                surpriseLook,
                "Surprise look on!",
                "Couldn't pick a surprise",
              ),
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
                  <span class="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-sub text-em-xs text-sub pointer-coarse:h-10 pointer-coarse:w-10">
                    {slot}
                  </span>
                }
              >
                <button
                  type="button"
                  class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-main text-em-xs font-bold text-bg disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:h-10 pointer-coarse:w-10"
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
                class="flex min-h-8 cursor-pointer items-center rounded px-2 text-em-xs text-sub hover:bg-sub-alt hover:text-text disabled:cursor-not-allowed pointer-coarse:min-h-10"
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
      <p class="text-em-xs text-sub">
        Tap a number to use that setup. Tap save to keep your keyboard and
        effects in that slot.
      </p>
    </div>
  );
}
