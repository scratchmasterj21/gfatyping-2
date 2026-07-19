import { createSignal, For, JSXElement, Show } from "solid-js";

import { getRace } from "../../../race/race-db";
import { exitRace, joinAsParticipant } from "../../../race/race-runner";
import {
  getActiveRacePin,
  getCurrentRace,
  getRaceParticipants,
} from "../../../race/race-state";
import { showErrorNotification } from "../../../states/notifications";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";
import { H2 } from "../../common/Headers";
import { Page } from "../../common/Page";

const inputClass =
  "w-full rounded bg-bg px-3 py-2 text-center text-[2em] tracking-[0.4em] text-text outline-none focus:ring-2 focus:ring-sub";

function Avatar(props: { url?: string }): JSXElement {
  return (
    <Show
      when={props.url !== undefined && props.url !== ""}
      fallback={
        <div class="flex aspect-square w-8 items-center justify-center rounded-full bg-bg text-sub">
          <Fa icon="fa-user" />
        </div>
      }
    >
      <img
        src={props.url}
        alt=""
        class="aspect-square w-8 rounded-full object-cover"
      />
    </Show>
  );
}

function JoinForm(): JSXElement {
  const [pin, setPin] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const join = async (): Promise<void> => {
    const code = pin().trim();
    if (!/^\d{6}$/.test(code)) {
      showErrorNotification("Enter the 6-digit race PIN");
      return;
    }
    setBusy(true);
    try {
      const race = await getRace(code);
      if (race === null) {
        showErrorNotification("Race not found");
        return;
      }
      if (race.status !== "lobby") {
        showErrorNotification("That race has already started");
        return;
      }
      await joinAsParticipant(code);
    } catch (e) {
      showErrorNotification("Failed to join race", { error: e });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="mx-auto grid w-full max-w-md gap-4 py-8">
      <H2 fa={{ icon: "fa-flag-checkered" }} text="join a race" />
      <p class="text-sub">
        Enter the PIN your teacher is showing on the board.
      </p>
      <input
        type="text"
        inputMode="numeric"
        maxLength="6"
        class={inputClass}
        placeholder="000000"
        value={pin()}
        onInput={(e) =>
          setPin(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") void join();
        }}
      />
      <Button
        text={busy() ? "joining..." : "join race"}
        fa={{ icon: "fa-sign-in-alt" }}
        onClick={() => void join()}
        disabled={busy()}
      />
    </div>
  );
}

function Lobby(): JSXElement {
  const participants = (): ReturnType<typeof getRaceParticipants> =>
    getRaceParticipants();

  return (
    <div class="mx-auto grid w-full max-w-md gap-4 py-8">
      <H2 fa={{ icon: "fa-hourglass-half" }} text="waiting to start" />
      <div class="flex items-center justify-between rounded bg-sub-alt p-3">
        <span class="text-sub">race pin</span>
        <span class="text-[1.5em] tracking-[0.3em] text-main">
          {getActiveRacePin()}
        </span>
      </div>
      <p class="text-sub">
        Hang tight - the race will begin when your teacher starts it.
      </p>
      <div class="grid gap-2">
        <div class="text-sub">players ({participants().length})</div>
        <For
          each={participants()}
          fallback={<div class="text-sub">no players yet</div>}
        >
          {(p) => (
            <div class="flex items-center gap-3 rounded bg-sub-alt p-2">
              <Avatar url={p.avatarUrl} />
              <span class="text-text">{p.name}</span>
            </div>
          )}
        </For>
      </div>
      <Button
        variant="text"
        text="leave"
        fa={{ icon: "fa-arrow-left" }}
        onClick={() => void exitRace()}
      />
    </div>
  );
}

export function RacePage(): JSXElement {
  const inRace = (): boolean => getActiveRacePin() !== null;
  const status = (): string | undefined => getCurrentRace()?.status;

  return (
    <Page id="race" needsAuthentication>
      <div class="content-grid">
        <Show when={inRace()} fallback={<JoinForm />}>
          <Show
            when={status() === "lobby" || status() === undefined}
            fallback={
              <div class="mx-auto grid w-full max-w-md gap-4 py-8 text-center">
                <H2
                  fa={{ icon: "fa-flag-checkered" }}
                  text="race in progress"
                />
                <p class="text-sub">Your race is running.</p>
                <Button
                  text="go to the test"
                  fa={{ icon: "fa-keyboard" }}
                  href="/"
                  router-link
                />
              </div>
            }
          >
            <Lobby />
          </Show>
        </Show>
      </div>
    </Page>
  );
}
