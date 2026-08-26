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
        src="/images/logo-header.webp"
        alt="GFA Typing"
        // Intrinsic size is 2x the rendered height, so it stays sharp on
        // retina without making the browser decode-and-downscale a much
        // larger source on every raster. Declared here so the header
        // reserves its space before the image lands.
        width={450}
        height={300}
        decoding="async"
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
