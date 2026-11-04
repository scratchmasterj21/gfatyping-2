import { JSXElement, Show } from "solid-js";

import { cn } from "../../utils/cn";

type CardTone = "plain" | "raised" | "accent";

type BaseProps = {
  tone?: CardTone;
  padding?: "sm" | "md" | "lg";
  class?: string;
  children?: JSXElement;
  "aria-label"?: string;
};

type StaticCardProps = BaseProps & { onClick?: never; disabled?: never };

type ClickableCardProps = BaseProps & {
  onClick: (e: MouseEvent) => void;
  disabled?: boolean;
};

export type CardProps = StaticCardProps | ClickableCardProps;

/**
 * Rounded surface for the kid UI. With `onClick` it renders as a real
 * button with the pressable ledge, so it works with keyboard and touch.
 */
export function Card(props: CardProps): JSXElement {
  const tone = (): CardTone => props.tone ?? "raised";

  const classes = (clickable: boolean): string =>
    cn(
      "block w-full rounded-double text-left text-text",
      props.padding === "sm" && "p-3",
      (props.padding ?? "md") === "md" && "p-4",
      props.padding === "lg" && "p-6",
      tone() === "plain" && "bg-sub-alt",
      tone() === "raised" &&
        "border-2 border-[color-mix(in_srgb,var(--sub-color)_35%,transparent)] bg-sub-alt",
      tone() === "accent" &&
        "border-2 border-main bg-[color-mix(in_srgb,var(--main-color)_14%,var(--sub-alt-color))]",
      clickable &&
        "press-3d cursor-pointer appearance-none hover:border-main focus-visible:shadow-[0_0_0_0.1rem_var(--bg-color),_0_0_0_0.25rem_var(--main-color)] focus-visible:outline-none",
      clickable &&
        tone() === "accent" &&
        "[--press-color:color-mix(in_srgb,var(--main-color)_60%,black)]",
      clickable && props.disabled === true && "pointer-events-none opacity-50",
      props.class,
    );

  return (
    <Show
      when={props.onClick !== undefined}
      fallback={
        <div class={classes(false)} aria-label={props["aria-label"]}>
          {props.children}
        </div>
      }
    >
      <button
        type="button"
        class={classes(true)}
        onClick={(e) => props.onClick?.(e)}
        disabled={props.disabled ?? false}
        aria-label={props["aria-label"]}
      >
        {props.children}
      </button>
    </Show>
  );
}
