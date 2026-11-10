import {
  createEffect,
  createSignal,
  JSXElement,
  onCleanup,
  Show,
} from "solid-js";

import { Fa } from "../../components/common/Fa";
import {
  declineInvite,
  GameInvite,
  isFreshInvite,
  myGrade,
  waitForInvite,
} from "../shared/game-invites";

/**
 * "Wait for an invite": puts the student on their grade's waiting list for
 * this game while the screen is open, and pops up Join / No thanks when a
 * classmate hosting the game invites them.
 */
export function WaitForInvite(props: {
  gameId: string;
  disabled?: boolean;
  onAccept: (code: string) => void;
}): JSXElement {
  const [waiting, setWaiting] = createSignal(false);
  const [invite, setInvite] = createSignal<GameInvite | null>(null);

  createEffect(() => {
    if (!waiting()) return;
    const stop = waitForInvite(props.gameId, setInvite);
    onCleanup(() => {
      stop();
      setInvite(null);
    });
  });

  const fresh = (): GameInvite | undefined => {
    const i = invite();
    return isFreshInvite(i ?? undefined) ? (i ?? undefined) : undefined;
  };

  return (
    <Show
      when={myGrade()}
      fallback={
        <div class="text-center text-em-xs text-sub">
          Ask your teacher to set your class to get invites from classmates.
        </div>
      }
    >
      {(grade) => (
        <Show
          when={waiting()}
          fallback={
            <button
              type="button"
              class="flex items-center justify-center gap-2 rounded-lg bg-sub-alt px-4 py-2 text-sm font-semibold text-text hover:bg-text hover:text-bg disabled:opacity-50"
              disabled={props.disabled}
              onClick={() => setWaiting(true)}
            >
              <Fa icon="fa-envelope" />
              Wait for a classmate to invite me
            </button>
          }
        >
          <Show
            when={fresh()}
            fallback={
              <div class="grid gap-2 rounded-xl bg-sub-alt p-3 text-center font-kid">
                <div class="flex items-center justify-center gap-2 text-base font-bold text-text">
                  <Fa icon="fa-envelope" class="animate-pulse text-main" />
                  Waiting for an invite…
                </div>
                <div class="text-sm text-sub">
                  Classmates in {grade()} who host this game can see you.
                </div>
                <button
                  type="button"
                  class="text-sm text-sub underline"
                  onClick={() => setWaiting(false)}
                >
                  Stop waiting
                </button>
              </div>
            }
          >
            {(inv) => (
              <div class="grid animate-game-pop gap-3 rounded-xl bg-main p-4 text-center font-kid text-bg motion-reduce:animate-none">
                <div class="text-lg font-bold">
                  📨 {inv().fromName} invited you to play!
                </div>
                <div class="flex justify-center gap-2">
                  <button
                    type="button"
                    class="rounded-lg bg-bg px-5 py-2 text-base font-bold text-text hover:bg-text hover:text-bg"
                    onClick={() => {
                      const code = inv().code;
                      setWaiting(false);
                      props.onAccept(code);
                    }}
                  >
                    Join
                  </button>
                  <button
                    type="button"
                    class="rounded-lg px-4 py-2 text-base font-semibold text-bg underline"
                    onClick={() => void declineInvite(props.gameId)}
                  >
                    No thanks
                  </button>
                </div>
              </div>
            )}
          </Show>
        </Show>
      )}
    </Show>
  );
}
