import { For, JSXElement } from "solid-js";

import { Fa } from "../../common/Fa";

export function LessonStars(props: { count: number }): JSXElement {
  return (
    <div class="lesson-stars flex gap-0.5">
      <For each={[1, 2, 3]}>
        {(n) => (
          <Fa
            icon="fa-star"
            variant={n <= props.count ? "solid" : "regular"}
            class={n <= props.count ? "text-main" : "text-sub"}
            size={1.1}
          />
        )}
      </For>
    </div>
  );
}
