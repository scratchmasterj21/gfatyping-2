import { For, JSXElement, Show } from "solid-js";

import { cn } from "../../utils/cn";
import { kartUrl } from "./car-art";
import { CarPreview } from "./CarPreview";
import { CarLook, GARAGE, GarageKind, isUnlocked } from "./race-rules";

const SECTIONS: { kind: GarageKind; title: string; key: keyof CarLook }[] = [
  { kind: "color", title: "🎨 Colours", key: "color" },
  { kind: "sticker", title: "✨ Stickers", key: "sticker" },
  { kind: "driver", title: "🧑‍✈️ Drivers", key: "driver" },
];

export function Garage(props: {
  look: CarLook;
  points: number;
  signedIn: boolean;
  onChange: (look: CarLook) => void;
}): JSXElement {
  return (
    <div class="grid gap-3">
      <div class="flex items-center gap-4 rounded-xl bg-sub-alt p-3">
        <CarPreview look={props.look} class="w-28 text-3xl" />
        <div class="grid gap-1 text-sm">
          <div class="font-bold text-text">
            🏁 {props.points} garage point{props.points === 1 ? "" : "s"}
          </div>
          <div class="text-sub">
            1st place +3 · 2nd +2 · 3rd +1 · Grand Prix champion +3
          </div>
          <Show when={!props.signedIn}>
            <div class="text-sub">Sign in to keep your points.</div>
          </Show>
        </div>
      </div>
      <For each={SECTIONS}>
        {(sec) => (
          <div class="grid gap-1">
            <div class="text-sm font-bold text-sub">{sec.title}</div>
            <div class="grid grid-cols-4 gap-2 sm:grid-cols-7">
              <For each={GARAGE.filter((g) => g.kind === sec.kind)}>
                {(item) => {
                  const open = (): boolean => isUnlocked(item.id, props.points);
                  const chosen = (): boolean => props.look[sec.key] === item.id;
                  return (
                    <button
                      type="button"
                      disabled={!open()}
                      class={cn(
                        "grid place-items-center gap-0.5 rounded-lg border-2 p-1 text-xs",
                        chosen()
                          ? "border-main bg-main/15 text-text"
                          : "border-transparent bg-sub-alt text-sub",
                        open()
                          ? "cursor-pointer"
                          : "cursor-not-allowed opacity-50",
                      )}
                      onClick={() =>
                        props.onChange({ ...props.look, [sec.key]: item.id })
                      }
                    >
                      <span class="text-2xl">
                        <Show when={item.color} fallback={item.emoji ?? "—"}>
                          {(c) => (
                            <img src={kartUrl(c())} alt="" class="h-6 w-auto" />
                          )}
                        </Show>
                      </span>
                      <span class="truncate">
                        {open() ? item.name : `🔒 ${item.points}`}
                      </span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
