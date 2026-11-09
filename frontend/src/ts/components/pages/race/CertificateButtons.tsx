import { For, JSXElement } from "solid-js";

import type { ChampionRecord } from "../../../race/race-db";

/** Print buttons for the podium's certificates (new tab). */
export function CertificateButtons(props: {
  record: ChampionRecord;
}): JSXElement {
  const places = (): number[] =>
    props.record.podium.slice(0, 3).map((_, i) => i + 1);
  return (
    <span class="flex shrink-0 gap-1">
      <For each={places()}>
        {(place) => (
          <button
            type="button"
            class="cursor-pointer rounded-lg bg-sub-alt px-2 py-1 text-xs text-text hover:bg-main hover:text-bg"
            title={`Print the ${place === 1 ? "champion" : place === 2 ? "2nd place" : "3rd place"} certificate`}
            onClick={() =>
              window.open(
                `/certificate?champion=${props.record.id}&place=${place}`,
                "_blank",
              )
            }
          >
            🖨 {place === 1 ? "👑" : place === 2 ? "🥈" : "🥉"}
          </button>
        )}
      </For>
    </span>
  );
}
