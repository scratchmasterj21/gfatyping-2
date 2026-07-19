import { JSXElement } from "solid-js";

import { restartTestEvent } from "../../../events/test";
import { getActivePage } from "../../../states/core";
import { getFocus } from "../../../states/test";
import { cn } from "../../../utils/cn";

export function Logo(): JSXElement {
  return (
    <a
      href={`${location.origin}/`}
      class="-m-2 flex h-6 w-max items-center gap-2 rounded-[0.8rem] p-2"
      aria-label="GFA Typing Home"
      router-link
      style={{ "box-sizing": "content-box" }}
      data-ui-element="logo"
      onClick={() => {
        if (getActivePage() === "test") restartTestEvent.dispatch();
      }}
    >
      <img
        src="/images/logo-header.png"
        alt="GFA Typing"
        class={cn(
          "h-[150px] w-auto object-contain transition-opacity duration-250",
          {
            "opacity-50": getFocus(),
          },
        )}
        data-ui-element="logoText"
      />
    </a>
  );
}
