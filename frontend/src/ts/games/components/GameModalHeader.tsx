import { JSXElement } from "solid-js";

export function GameModalHeader(props: {
  title: string;
  onClose: () => void;
}): JSXElement {
  return (
    <div class="flex shrink-0 items-start justify-between gap-3">
      <h2 class="text-lg font-bold text-text">{props.title}</h2>
      <button
        type="button"
        class="flex min-h-10 shrink-0 items-center justify-center rounded bg-sub-alt px-3 text-sm font-semibold text-sub hover:text-text"
        onClick={() => props.onClose()}
      >
        ← Back
      </button>
    </div>
  );
}
