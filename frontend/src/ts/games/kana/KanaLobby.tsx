import { For, JSXElement, Show } from "solid-js";

import type { KanaRoom } from "./kana-room";

import { UserAvatar } from "../../components/common/UserAvatar";
import { GameSetupPrimaryAction } from "../components/GameSetupPrimaryAction";
import { InviteClassmates } from "../components/InviteClassmates";

/** Waiting room for the romaji games: code, players, Start for the host. */
export function KanaLobby(props: {
  gameId: string;
  room: KanaRoom<unknown> | null;
  code: string | undefined;
  me: string | undefined;
  maxPlayers: number;
  onStart: () => void;
  onLeave: () => void;
}): JSXElement {
  const players = (): KanaRoom<unknown>["players"][string][] =>
    Object.values(props.room?.players ?? {}).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    );
  return (
    <div class="grid gap-4 p-6 pt-12 font-kid">
      <div class="text-center">
        <div class="text-sm font-bold tracking-widest text-sub uppercase">
          Room code - tell your friends!
        </div>
        <div class="text-5xl font-bold tracking-[0.25em] text-main">
          {props.code}
        </div>
        <div class="mt-2 text-sm text-sub">
          {props.room?.difficultyLabel} words · {players().length}/
          {props.maxPlayers} players
        </div>
      </div>
      <For each={players()}>
        {(player) => (
          <div class="flex items-center gap-3 rounded-xl bg-sub-alt px-3 py-2">
            <UserAvatar uid={player.uid} class="h-9 w-9" />
            <span class="flex-1 truncate text-lg font-bold text-text">
              {player.name}
              {player.uid === props.room?.hostUid ? " · host" : ""}
            </span>
            <span class={player.online ? "text-main" : "text-sub"}>
              {player.online ? "ready" : "offline"}
            </span>
          </div>
        )}
      </For>
      <Show when={players().length < 2}>
        <div class="text-center text-sub">Waiting for friends to join…</div>
      </Show>
      <InviteClassmates
        gameId={props.gameId}
        code={props.code}
        show={
          props.room?.hostUid === props.me &&
          players().length < props.maxPlayers
        }
      />
      <Show
        when={props.room?.hostUid === props.me}
        fallback={
          <div class="text-center text-sub">Waiting for the host to start…</div>
        }
      >
        <GameSetupPrimaryAction
          text="Start game"
          disabled={players().filter((p) => p.online).length < 2}
          onClick={() => props.onStart()}
        />
      </Show>
      <button
        type="button"
        class="text-center text-sm text-sub underline"
        onClick={() => props.onLeave()}
      >
        Leave room
      </button>
    </div>
  );
}
