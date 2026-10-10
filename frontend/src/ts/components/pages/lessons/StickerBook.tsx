import { For, JSXElement } from "solid-js";

import { LessonGroup } from "../../../lessons/lessons-data";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";

const TILTS = ["-rotate-6", "rotate-3", "-rotate-2", "rotate-6", "rotate-1"];

/** One sticker per lesson group, earned when every lesson in it is complete. */
export function StickerBook(props: {
  groups: LessonGroup[];
  isGroupComplete: (group: LessonGroup) => boolean;
}): JSXElement {
  const earned = (): number =>
    props.groups.filter((g) => props.isGroupComplete(g)).length;

  return (
    <section class="rounded-2xl bg-sub-alt p-4" data-ui-element="stickerBook">
      <div class="mb-3 flex items-center justify-between gap-2">
        <span class="flex items-center gap-2 font-bold text-text">
          <Fa icon="fa-book-open" class="text-main" />
          My Sticker Book
        </span>
        <span class="rounded bg-bg px-2 py-0.5 text-em-xs font-bold text-main">
          {earned()}/{props.groups.length}
        </span>
      </div>
      <div class="flex flex-wrap justify-center gap-3 sm:justify-start">
        <For each={props.groups}>
          {(group, i) => {
            const done = (): boolean => props.isGroupComplete(group);
            return (
              <div
                class="flex w-16 flex-col items-center gap-1 text-center"
                title={
                  done()
                    ? `${group.name} sticker earned!`
                    : `Finish ${group.name} to earn this sticker`
                }
              >
                <div
                  class={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full border-4 transition-transform",
                    done()
                      ? cn(
                          "border-bg bg-main text-bg shadow-md hover:scale-110",
                          TILTS[i() % TILTS.length],
                        )
                      : "border-dashed border-sub bg-bg text-sub opacity-50",
                  )}
                >
                  <Fa icon={done() ? group.icon : "fa-lock"} size={1.3} />
                </div>
                <span
                  class={cn(
                    "text-em-xs leading-tight",
                    done() ? "text-text" : "text-sub",
                  )}
                >
                  {group.name}
                </span>
              </div>
            );
          }}
        </For>
      </div>
    </section>
  );
}
