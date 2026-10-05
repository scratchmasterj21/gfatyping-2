import { JSXElement } from "solid-js";

import { FaSolidIcon } from "../../../types/font-awesome";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";

export function LessonsCollapsibleHeader(props: {
  sectionId: string;
  text: string;
  icon: FaSolidIcon;
  collapsed: () => Set<string>;
  onToggle: (id: string) => void;
}): JSXElement {
  const isCollapsed = (): boolean => props.collapsed().has(props.sectionId);
  return (
    <button
      type="button"
      class="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg py-2 text-left transition-colors hover:bg-sub-alt/70"
      aria-expanded={!isCollapsed()}
      aria-controls={`lessons-section-${props.sectionId}`}
      onClick={() => props.onToggle(props.sectionId)}
    >
      <span class="flex items-center gap-2 text-[1.65em] leading-tight font-bold text-text sm:text-[1.85em]">
        <Fa icon={props.icon} class="text-main" fixedWidth />
        {props.text}
      </span>
      <Fa
        icon="fa-chevron-down"
        class={cn(
          "shrink-0 text-sub transition-transform duration-200",
          isCollapsed() ? "-rotate-90" : "",
        )}
      />
    </button>
  );
}
