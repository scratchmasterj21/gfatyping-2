import { JSXElement } from "solid-js";

import { SelfSummaryCard } from "./SelfSummaryCard";

export function UserRank(
  props: Parameters<typeof SelfSummaryCard>[0],
): JSXElement {
  return <SelfSummaryCard {...props} />;
}

export { SelfSummaryCard } from "./SelfSummaryCard";
