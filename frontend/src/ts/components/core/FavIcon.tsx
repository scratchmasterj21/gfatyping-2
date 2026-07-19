import { Link } from "@solidjs/meta";
import { JSXElement } from "solid-js";

import { Theme } from "../../constants/themes";

export function FavIcon(_props: { theme: Theme }): JSXElement {
  return (
    <Link
      id="favicon"
      rel="shortcut icon"
      type="image/svg+xml"
      href="/images/favicon/favicon.svg"
    />
  );
}
