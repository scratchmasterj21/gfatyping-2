import { JSXElement } from "solid-js";

export function rankMedal(rank: number | undefined): string | undefined {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return undefined;
}

export function RankDisplay(props: {
  rank: number | undefined;
  class?: string;
}): JSXElement {
  const medal = () => rankMedal(props.rank);
  return (
    <span class={props.class} aria-label={`Rank ${props.rank ?? "unknown"}`}>
      {props.rank === undefined
        ? "—"
        : medal() === undefined
          ? props.rank
          : medal()}
    </span>
  );
}
