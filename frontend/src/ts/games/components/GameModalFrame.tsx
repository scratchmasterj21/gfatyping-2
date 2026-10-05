import { JSXElement, Show } from "solid-js";

import { cn } from "../../utils/cn";

export function GameModalFrame(props: {
  layout: "pick" | "playing" | "compact";
  onClose: () => void;
  showBackButton?: boolean;
  children: JSXElement;
}): JSXElement {
  const showBack = (): boolean => props.showBackButton !== false;
  return (
    <div class="fixed inset-0 z-[150] flex items-center justify-center bg-bg/95">
      <div
        class={cn(
          "relative flex flex-col overflow-hidden rounded-xl border border-main/30 bg-bg shadow-2xl",
          props.layout === "playing"
            ? "h-[90vh] w-[95vw] max-w-5xl"
            : props.layout === "pick"
              ? "max-h-[94vh] w-full max-w-lg"
              : "w-full max-w-lg p-5",
        )}
      >
        <Show when={showBack() && props.layout === "playing"}>
          <button
            type="button"
            class="absolute top-3 right-3 z-10 flex min-h-10 items-center justify-center rounded bg-sub-alt px-3 text-sm font-semibold text-sub hover:text-text"
            onClick={() => props.onClose()}
          >
            ← Back to lessons
          </button>
        </Show>
        {props.children}
      </div>
    </div>
  );
}
