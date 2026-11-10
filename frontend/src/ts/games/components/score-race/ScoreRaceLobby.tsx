import { For, JSXElement, Show } from "solid-js";

import { Fa } from "../../../components/common/Fa";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { cn } from "../../../utils/cn";
import { GameSetupPrimaryAction } from "../GameSetupPrimaryAction";
import { InviteClassmates } from "../InviteClassmates";
import { formatTime } from "./score-race-format";
import { ScoreRace } from "./use-score-race";

/** Lobby: room code, players (host can remove), invites, start. */
export function ScoreRaceLobby(props: {
  race: ScoreRace;
  onLeave: () => void;
}): JSXElement {
  const room = (): ReturnType<ScoreRace["room"]> => props.race.room();
  const online = (): number =>
    props.race.players().filter((p) => p.online).length;
  return (
    <div class="grid gap-4 p-4 pt-12 font-kid">
      <div class="text-center">
        <div class="text-em-xs font-bold tracking-widest text-sub uppercase">
          {props.race.title} room code
        </div>
        <div class="text-4xl font-bold tracking-[0.25em] text-main">
          {props.race.code()}
        </div>
        <Show when={room()}>
          {(r) => (
            <div class="mt-2 text-sm text-sub">
              {[
                r().difficultyLabel,
                r().wordListLabel,
                formatTime(r().durationSec),
              ]
                .filter((x) => x !== "")
                .join(" · ")}
            </div>
          )}
        </Show>
      </div>
      <p class="text-center text-sm text-sub">
        Everyone plays at the same time with the same words. Highest score wins!
      </p>
      <div class="grid gap-2">
        <For each={props.race.players()}>
          {(player) => (
            <div class="flex items-center gap-3 rounded-xl bg-sub-alt px-3 py-2">
              <UserAvatar uid={player.uid} class="h-8 w-8" />
              <span class="flex-1 truncate text-base font-bold text-text">
                {player.name}
                <Show when={player.uid === room()?.hostUid}>
                  <span class="ml-2 text-sm font-normal text-sub">host</span>
                </Show>
              </span>
              <span
                class={cn("text-sm", player.online ? "text-main" : "text-sub")}
              >
                {player.online ? "ready" : "offline"}
              </span>
              <Show
                when={
                  props.race.isHost() &&
                  player.uid !== room()?.hostUid &&
                  room()?.status === "lobby"
                }
              >
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-full text-sub hover:bg-error hover:text-bg"
                  aria-label={`Remove ${player.name}`}
                  title={`Remove ${player.name}`}
                  onClick={() => props.race.kick(player.uid)}
                >
                  <Fa icon="fa-times" />
                </button>
              </Show>
            </div>
          )}
        </For>
      </div>
      <InviteClassmates
        gameId={props.race.gameId}
        code={props.race.code()}
        show={props.race.isHost() && room()?.status === "lobby"}
      />
      <Show
        when={props.race.countdown()}
        fallback={
          <Show
            when={props.race.isHost()}
            fallback={
              <div class="text-center text-base text-sub">
                Waiting for the host to start…
              </div>
            }
          >
            <GameSetupPrimaryAction
              text={online() < 2 ? "Waiting for players…" : "Start match"}
              disabled={online() < 2}
              onClick={() => props.race.start()}
            />
          </Show>
        }
      >
        {(n) => (
          <div class="animate-game-pop text-center text-5xl font-bold text-main motion-reduce:animate-none">
            {n()}
          </div>
        )}
      </Show>
      <button
        type="button"
        class="justify-self-center text-sm text-sub underline"
        onClick={() => props.onLeave()}
      >
        Leave room
      </button>
    </div>
  );
}
