import { JSXElement } from "solid-js";

export function GameModalHeader(props: {
  title: string;
  onClose: () => void;
}): JSXElement {
  return (
    <div class="flex shrink-0 items-start justify-between gap-3">
      <h2 class="text-2xl font-bold text-text">{props.title}</h2>
      <button
        type="button"
        class="flex min-h-11 shrink-0 items-center justify-center rounded-full bg-sub-alt px-4 text-sm font-semibold text-text hover:bg-text hover:text-bg"
        onClick={() => props.onClose()}
      >
        ← Back
      </button>
    </div>
  );
}
