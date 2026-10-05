import { JSXElement } from "solid-js";

import { GameSetupPrimaryAction } from "./GameSetupPrimaryAction";

export function GameMultiplayerRoomFooter(props: {
  roomBusy: boolean;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  createLabel?: string;
}): JSXElement {
  const createText = (): string =>
    props.roomBusy
      ? "Please wait…"
      : (props.createLabel ?? "Create multiplayer room");
  return (
    <div class="grid gap-2">
      <GameSetupPrimaryAction
        text={createText()}
        showArrow={false}
        disabled={props.roomBusy}
        onClick={() => props.onCreateRoom()}
      />
      <div class="text-center text-em-xs text-sub">or join a room</div>
      <div class="flex gap-2">
        <input
          class="min-w-0 flex-1 rounded-lg bg-sub-alt px-3 py-2 text-center font-bold tracking-widest text-text"
          inputMode="numeric"
          maxLength={6}
          placeholder="6-digit code"
          value={props.joinCode}
          onInput={(event) =>
            props.onJoinCodeChange(
              event.currentTarget.value.replace(/\D/g, "").slice(0, 6),
            )
          }
        />
        <button
          type="button"
          class="rounded-lg bg-sub-alt px-4 py-2 text-sm font-semibold text-text hover:bg-text hover:text-bg disabled:opacity-50"
          disabled={props.roomBusy}
          onClick={() => props.onJoinRoom()}
        >
          Join
        </button>
      </div>
    </div>
  );
}
