import {
  createEffect,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  Show,
} from "solid-js";

import { Fa } from "../../components/common/Fa";
import { getAuthenticatedUser } from "../../firebase";
import { showErrorNotification } from "../../states/notifications";
import {
  isFreshInvite,
  myGrade,
  sendInvite,
  WaitingClassmate,
  watchWaitingClassmates,
} from "../shared/game-invites";

/**
 * Host lobby panel: classmates in my grade who are waiting for an invite to
 * this game, each with an Invite button. Listens only while it's shown.
 */
export function InviteClassmates(props: {
  gameId: string;
  code: string | undefined;
  /** host and still in the lobby with room for more */
  show: boolean;
}): JSXElement {
  const [waiting, setWaiting] = createSignal<WaitingClassmate[]>([]);
  const [now, setNow] = createSignal(Date.now());

  createEffect(() => {
    if (!props.show || myGrade() === undefined) return;
    const unsubscribe = watchWaitingClassmates(props.gameId, setWaiting);
    // invites expire, so re-check now and then
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    onCleanup(() => {
      unsubscribe();
      clearInterval(timer);
      setWaiting([]);
    });
  });

  const others = (): WaitingClassmate[] =>
    waiting().filter((w) => w.uid !== getAuthenticatedUser()?.uid);
  const invited = (w: WaitingClassmate): boolean =>
    w.invite?.code === props.code && isFreshInvite(w.invite, now());

  return (
    <Show when={props.show && props.code !== undefined && myGrade()}>
      {(grade) => (
        <div class="grid gap-2 rounded-xl border-2 border-dashed border-sub-alt p-3 font-kid">
          <div class="flex items-center gap-2 text-sm font-bold tracking-wide text-sub uppercase">
            <Fa icon="fa-envelope" />
            {grade()} classmates waiting for an invite
          </div>
          <For
            each={others()}
            fallback={
              <div class="text-sm text-sub">
                Nobody yet. Friends can tap &ldquo;Wait for a classmate to
                invite me&rdquo;.
              </div>
            }
          >
            {(w) => (
              <div class="flex items-center gap-3 rounded-lg bg-sub-alt px-3 py-1.5">
                <span class="flex-1 truncate text-base font-bold text-text">
                  {w.name}
                  <span class="ml-2 text-sm font-normal text-sub">
                    {w.classId}
                  </span>
                </span>
                <Show
                  when={!invited(w)}
                  fallback={
                    <span class="text-sm font-bold text-main">Invited ✓</span>
                  }
                >
                  <button
                    type="button"
                    class="rounded-lg bg-main px-3 py-1 text-sm font-bold text-bg hover:bg-text"
                    onClick={() => {
                      const code = props.code;
                      if (code === undefined) return;
                      sendInvite(props.gameId, w.uid, code).catch(
                        (e: unknown) =>
                          showErrorNotification("Could not send invite", {
                            error: e,
                          }),
                      );
                    }}
                  >
                    Invite
                  </button>
                </Show>
              </div>
            )}
          </For>
        </div>
      )}
    </Show>
  );
}
